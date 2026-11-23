"""
Emotional intelligence layer for Vaani — the "advanced" bit.

Three pieces, exactly as described:
  1. Personality parameters  — tunable traits (warmth, energy, empathy, ...) that
     shape both HOW she talks (prompt) and her baseline voice emotion.
  2. Tone-mapping            — map the USER's detected emotion to Vaani's reaction:
     the Cartesia voice-emotion tags, speaking speed, and a style directive for words.
  3. Emotional-feedback loop — EmotionalState remembers the mood across turns, so she
     adapts gradually (sustained sadness -> extra gentle; sustained joy -> more sparkle)
     instead of resetting every turn.

No extra model calls: the user's emotion is detected inside the same Groq reply call
(returned as JSON), so this adds intelligence without adding latency.
"""

from __future__ import annotations

from collections import deque

# --- Personality --------------------------------------------------------------

# Each trait is 0..1. Defaults = warm, upbeat, caring, lightly playful, casual.
PERSONALITY_DEFAULT = {
    "warmth": 0.9,
    "energy": 0.7,
    "empathy": 0.9,
    "playfulness": 0.5,
    "formality": 0.2,
}


def _band(v: float) -> str:
    return "very high" if v >= 0.8 else "high" if v >= 0.6 else "moderate" if v >= 0.4 else "low"


def personality_prompt(p: dict) -> str:
    """Turn the trait sliders into a short instruction the LLM can act on."""
    return (
        "# Personality\n"
        f"Warmth: {_band(p['warmth'])}. Energy: {_band(p['energy'])}. "
        f"Empathy: {_band(p['empathy'])}. Playfulness: {_band(p['playfulness'])}. "
        f"Formality: {_band(p['formality'])}.\n"
        "Let these traits colour every reply — high warmth and empathy means you truly "
        "care; high energy means lively and bright; low formality means casual and friendly; "
        "playfulness means the occasional light, gentle bit of fun. Stay consistent — this "
        "is who you are."
    )


# --- Tone-mapping -------------------------------------------------------------

# How Vaani REACTS to each user emotion. She never mirrors negativity back — she
# stays warm and adjusts her care. `emotion` = Cartesia voice tags (safe subset:
# positivity / surprise / curiosity / sadness), `speed` = pace, `style` = word guidance.
NEUTRAL = {
    "emotion": ["positivity:high", "curiosity"],
    "speed": "normal",
    "style": "Be warm, friendly and natural.",
}

TONE_MAP = {
    "happy":      {"emotion": ["positivity:highest", "surprise:high"], "speed": "normal",
                   "style": "They're happy — be delighted and match their bright energy!"},
    "excited":    {"emotion": ["positivity:highest", "surprise:high"], "speed": "normal",
                   "style": "They're excited — share the excitement, be enthusiastic and lively!"},
    "grateful":   {"emotion": ["positivity:highest"], "speed": "normal",
                   "style": "They're grateful — be warm, gracious and appreciative."},
    "curious":    {"emotion": ["positivity:high", "curiosity:highest"], "speed": "normal",
                   "style": "They're curious — be engaging and happy to explain clearly."},
    "neutral":    NEUTRAL,
    "confused":   {"emotion": ["positivity:high", "curiosity"], "speed": "slow",
                   "style": "They sound unsure — slow down, simplify, and be patient and encouraging."},
    "worried":    {"emotion": ["positivity:high"], "speed": "slow",
                   "style": "They sound worried — be steady, reassuring and clear; gently ease their concern."},
    "anxious":    {"emotion": ["positivity:high"], "speed": "slow",
                   "style": "They sound anxious — be calm, grounding and reassuring; take it gently."},
    "sad":        {"emotion": ["positivity:high", "sadness:low"], "speed": "slow",
                   "style": "They sound down — be gentle, soft and comforting; show you genuinely care."},
    "frustrated": {"emotion": ["positivity:high", "curiosity"], "speed": "slow",
                   "style": "They're frustrated — stay calm, acknowledge it sincerely, and focus on helping."},
    "angry":      {"emotion": ["positivity:high"], "speed": "slow",
                   "style": "They're upset — don't get defensive; be calm, empathetic, apologise if fair, and solve it."},
}

NEGATIVE = {"sad", "angry", "frustrated", "anxious", "worried", "confused"}
POSITIVE = {"happy", "excited", "grateful", "curious"}

# Cartesia intensity ranking, so merged tags keep the STRONGEST level per emotion
# (avoids sending both "positivity:high" and "positivity:highest").
_LEVEL_RANK = {"lowest": 0, "low": 1, "": 2, "high": 3, "highest": 4}


def _merge_tags(tags: list[str]) -> list[str]:
    best: dict[str, str] = {}
    order: list[str] = []
    for tag in tags:
        name, _, level = tag.partition(":")
        if name not in best:
            order.append(name)
        if name not in best or _LEVEL_RANK.get(level, 2) > _LEVEL_RANK.get(best[name].partition(":")[2], 2):
            best[name] = tag
    return [best[n] for n in order]

# Emotions we accept from the detector; everything else collapses to neutral.
KNOWN = set(TONE_MAP.keys())


# Synonyms -> our vocabulary.
_ALIASES = {
    "joy": "happy", "joyful": "happy", "pleased": "happy", "glad": "happy", "cheerful": "happy",
    "delighted": "excited", "enthusiastic": "excited", "thrilled": "excited",
    "thankful": "grateful", "appreciative": "grateful",
    "interested": "curious", "inquisitive": "curious", "intrigued": "curious",
    "nervous": "anxious", "scared": "anxious", "stressed": "anxious", "overwhelmed": "anxious",
    "upset": "sad", "down": "sad", "disappointed": "sad", "unhappy": "sad", "hurt": "sad",
    "annoyed": "frustrated", "irritated": "frustrated", "fed": "frustrated",
    "mad": "angry", "furious": "angry",
    "unsure": "confused", "lost": "confused", "puzzled": "confused",
    "calm": "neutral", "ok": "neutral", "okay": "neutral", "fine": "neutral", "normal": "neutral",
}


def normalize_emotion(label: str) -> str:
    label = (label or "").strip().lower()
    label = _ALIASES.get(label, label)
    return label if label in KNOWN else "neutral"


def extract_emotion(text: str) -> str:
    """Pull the first explicit emotion word out of a classifier's output (robust to
    the model adding stray words or punctuation). Defaults to neutral."""
    import re

    for tok in re.findall(r"[a-zA-Z]+", (text or "").lower()):
        if tok in KNOWN or tok in _ALIASES:
            return normalize_emotion(tok)
    return "neutral"


class EmotionalState:
    """Per-conversation mood memory — this is the feedback loop."""

    def __init__(self, personality: dict | None = None):
        self.p = {**PERSONALITY_DEFAULT, **(personality or {})}
        self.recent: deque[str] = deque(maxlen=4)
        # The style directive to feed the NEXT reply (based on mood so far).
        self.current_style = NEUTRAL["style"]

    def _base_emotion(self) -> list[str]:
        """Baseline voice emotion from personality (used to enrich every turn)."""
        tags = []
        tags.append("positivity:highest" if self.p["warmth"] >= 0.75 else "positivity:high")
        if self.p["energy"] >= 0.7:
            tags.append("surprise:high")
        if self.p["playfulness"] >= 0.6:
            tags.append("curiosity")
        return tags

    def update(self, user_emotion: str) -> dict:
        """Fold this turn's detected user emotion into the running mood and return the
        voice/pace/style to use for Vaani's reply THIS turn."""
        ue = normalize_emotion(user_emotion)
        self.recent.append(ue)
        tone = TONE_MAP.get(ue, NEUTRAL)
        base = self._base_emotion()
        if ue in NEGATIVE:
            base = [t for t in base if t.startswith("positivity")]  # keep warmth, drop liveliness
        emotion = _merge_tags(tone["emotion"] + base)  # keep strongest level per emotion
        speed = tone["speed"]
        style = tone["style"]

        # --- feedback loop: react to sustained mood, not just this instant ---
        neg = sum(1 for e in self.recent if e in NEGATIVE)
        pos = sum(1 for e in self.recent if e in POSITIVE)
        if neg >= 2:
            speed = "slow"
            if self.p["empathy"] >= 0.7:
                style += " They've been having a rough time for a little while — be extra patient, soft and caring."
        elif pos >= 2:
            emotion = _merge_tags(emotion + ["surprise:high"])
            style += " The mood's lovely and light — let your warmth and delight really shine through."

        # High-energy personalities never crawl, even when soothing.
        if speed == "slow" and self.p["energy"] >= 0.85:
            speed = "normal"

        # Remember the style so the NEXT reply's WORDS adapt to the running mood too.
        self.current_style = style
        return {"emotion": emotion, "speed": speed, "style": style, "user_emotion": ue}


def stateless_tone(user_emotion: str, personality: dict | None = None) -> dict:
    """One-shot tone-map with no memory (for the non-streaming fallback path)."""
    return EmotionalState(personality).update(user_emotion)
