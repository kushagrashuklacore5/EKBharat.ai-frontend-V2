# Agent-2 — Vaani (Voice AI Agent)

A browser-based, real-time **voice AI agent**. You pick a voice and a business sector,
tap **Start Live Talk**, and speak — Vaani listens, understands your emotion, and replies
out loud in a warm, human voice. Rendered as a phone mock-up UI.

## Highlights

- **Low-latency voice pipeline** — streaming STT → LLM → TTS with barge-in and
  endpointing, so replies come back in well under a second after you stop talking.
- **Emotional intelligence** — a dedicated classifier senses the caller's emotion each
  turn, and a tone-mapping + personality + cross-turn feedback loop shapes Vaani's voice
  tone, pace and wording (see `emotion.py`).
- **Multi-sector with guardrails** — choose a sector (Real estate, Healthcare, Finance,
  E-commerce, Insurance, Restaurants, Education, Lead generation, Collections). Each has
  its own company identity, and Vaani stays strictly on-topic for the selected sector.
- **Multilingual** — replies in the caller's language (English, Hindi, Hinglish, …).
- **2-minute demo timer** — the call auto-ends at 2:00 with a goodbye spoken in the
  caller's language, beginning at 1:57.
- **Live voice equalizer** — animated bars that move while Vaani speaks.

## Stack

| Part | Tech |
|------|------|
| Backend | FastAPI + Uvicorn (`server.py`) |
| STT | Deepgram (realtime WebSocket + batch) |
| LLM | Groq (OpenAI-compatible) |
| TTS | ElevenLabs (default), with Cartesia / Gemini fallbacks |
| Frontend | Single-page `static/index.html` (no build step) |

## Run locally

```bash
# 1. Install deps (Python 3.10+)
pip install -r requirements.txt

# 2. Configure keys
cp .env.example .env     # then edit .env and add your keys

# 3. Start the server
python -m uvicorn server:app --host 127.0.0.1 --port 8800

# 4. Open the demo
#    http://127.0.0.1:8800
```

A microphone and a Chromium-based browser are recommended.

## Configuration

- `agent.json` — persona, greeting, voice/TTS provider, personality sliders.
- `.env` — API keys (never committed; see `.env.example`).
- Sectors and their company identities + topic guardrails live in `server.py` (`SECTORS`).

## Project layout

```
server.py          FastAPI app: STT/LLM/TTS, sectors, guardrails, demo timer
emotion.py         Emotional-intelligence layer (tone-map, personality, feedback loop)
agent.json         Persona + voice configuration
requirements.txt   Python dependencies
static/
  index.html       Phone-mockup UI + client voice pipeline
  vaani.png        Avatar
```

> **Security:** never commit real API keys. Keep them in `.env` only.
