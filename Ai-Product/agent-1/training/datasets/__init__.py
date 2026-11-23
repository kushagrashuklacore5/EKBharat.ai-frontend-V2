"""Dataset loaders for the temporal cheating model.

- synthetic.py : a realistic, feature-grounded synthetic generator used to BOOTSTRAP the
                 temporal model before real recordings exist (chosen path: bootstrap now,
                 record later). It emits the exact `features.build_feature_vector` layout
                 so there is zero train/serve skew.
- real.py      : loaders for recorded sessions (from labeling/record_tool) and public
                 datasets (OEP, Gaze360/MPIIGaze, 300W-LP/BIWI). These drive production
                 accuracy once data is collected.
"""
