"""Fine-tune YOLO11 on the custom proctoring object classes.

Starts from COCO-pretrained YOLO11s and fine-tunes on the classes COCO lacks (tablet,
earphones, smartwatch, paper/notes, calculator) plus the ones it has, using webcam-grade
augmentations (low light, blur, JPEG compression, low resolution). Needs a YOLO-format
dataset (images + labels + data.yaml); label boxes with labeling/label_config.xml.

This is GPU work -- on the CPU-only dev box it is impractically slow. Run it on the T4.

Usage:
    python training/train_objects.py --data datasets/objects/data.yaml --epochs 100
"""
from __future__ import annotations

import argparse
from pathlib import Path

CUSTOM_CLASSES = [
    "cell phone", "book", "laptop", "tablet", "earphones", "smartwatch",
    "paper", "calculator", "second_monitor", "another_person",
]

DATA_YAML_TEMPLATE = """# YOLO dataset config -- fill paths after labelling with label_config.xml
path: {root}
train: images/train
val: images/val
names:
""" + "\n".join(f"  {i}: {c}" for i, c in enumerate(CUSTOM_CLASSES))


def write_template(root: str) -> None:
    p = Path(root); p.mkdir(parents=True, exist_ok=True)
    (p / "data.yaml").write_text(DATA_YAML_TEMPLATE.format(root=str(p.resolve())))
    print(f"[ok] wrote {p/'data.yaml'} -- add images/ and labels/ then train.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=str, help="path to data.yaml")
    ap.add_argument("--init-template", type=str, help="write a data.yaml template at this root")
    ap.add_argument("--base", default="yolo11s.pt")
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--device", default="0")
    args = ap.parse_args()

    if args.init_template:
        write_template(args.init_template); return
    if not args.data:
        ap.error("--data data.yaml required (or --init-template <root>)")

    from ultralytics import YOLO
    model = YOLO(args.base)
    model.train(
        data=args.data, epochs=args.epochs, imgsz=args.imgsz, device=args.device,
        # Webcam-grade augmentations: low light, blur, compression, scale.
        hsv_v=0.5, hsv_s=0.5, degrees=5, translate=0.1, scale=0.5, fliplr=0.5,
        mosaic=1.0, mixup=0.1, erasing=0.3, augment=True,
        project="runs/objects", name="proctor_yolo11s",
    )
    print("[ok] fine-tuned. Copy best.pt to backend/app/models/yolo11s.pt and update config.")


if __name__ == "__main__":
    main()
