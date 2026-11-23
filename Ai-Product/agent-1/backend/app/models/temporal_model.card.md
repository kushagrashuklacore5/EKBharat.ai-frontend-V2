# Temporal cheating model -- card

- **Version:** 20261119_073408
- **Source:** synthetic:48persons
- **Window:** 50 frames (5s @ 10fps), feature dim 57
- **Classes:** normal, looking_away, talking, phone_use, reading_material, other_person_present, person_absent, identity_mismatch, suspicious_hand_movement, screen_switching
- **Test macro-F1:** 0.9941  (val 0.9962)
- **Per-class F1:** {'normal': 0.9967, 'looking_away': 0.9935, 'talking': 0.985, 'phone_use': 1.0, 'reading_material': 1.0, 'other_person_present': 1.0, 'person_absent': 1.0, 'identity_mismatch': 1.0, 'suspicious_hand_movement': 1.0, 'screen_switching': 0.9655}

## Intended use
Smooths per-frame proctoring features into per-second multi-label cheating signals that
feed risk.py. A human proctor makes every final decision; this model only flags.

## Caveats
If `source` is synthetic, this is a BOOTSTRAP to prove the pipeline and provide temporal
smoothing -- NOT production truth. Retrain on real recorded sessions (labeling/record_tool
-> extract_features.py -> --recorded) and re-evaluate (false-alerts/hour < 0.5, recall
> 0.90) before relying on it.
