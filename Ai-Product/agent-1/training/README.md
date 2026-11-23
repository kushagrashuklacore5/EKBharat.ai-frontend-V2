# Training (Phase 3) — built

The temporal cheating model pipeline is implemented and bootstrap-trained on synthetic
data. Replace the synthetic data with real recordings for production accuracy.

## Files
- `model.py` — the temporal Transformer (4 layers, d_model=128) over per-frame features.
- `datasets/synthetic.py` — feature-grounded synthetic generator (bootstrap).
- `datasets/real.py` — `load_recorded()` for recorded sessions; OEP/Gaze360/300W-LP hooks.
- `extract_features.py` — run the **frozen live pipeline** over recorded videos → feature
  sequences (guarantees train/serve parity, same `features.py` layout).
- `train_temporal.py` — split **by person**, focal loss, early stopping, ONNX export +
  metrics JSON + model card. Exports to `backend/app/models/temporal_model.onnx`.
- `evaluate.py` — per-class P/R/F1, confusion matrix, **false-alerts/exam-hour** (<0.5),
  **recall on cheating** (>0.90), latency.
- `train_objects.py` — YOLO11 fine-tune on custom objects (GPU; run on the T4).

## Bootstrap (done)
```bash
python training/train_temporal.py --persons 48 --epochs 25     # -> temporal_model.onnx
python training/evaluate.py                                     # headline metrics
```
Restart the backend → the pipeline hot-swaps from `BASELINE` to `TEMPORAL` automatically
(shown in the HUD and the capability chips).

## Production accuracy (real data)
1. Record scenario sessions with `labeling/record_tool/` (several different people).
2. For each session: `python training/extract_features.py --video s.webm --labels s.json --out data/features`
3. `python training/train_temporal.py --recorded data/features`
4. `python training/evaluate.py --recorded data/features` and check the headline targets.
5. (Optional) label object boxes with `labeling/label_config.xml` and run `train_objects.py` on the T4.

> The synthetic bootstrap proves the full train→ONNX→hot-swap loop and adds temporal
> smoothing, but it is **not** production truth — real recordings are what make it
> genuinely accurate. The split is always **by person** to prevent identity leakage.
