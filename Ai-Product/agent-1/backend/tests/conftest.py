import sys
from pathlib import Path

# Make `app` importable from the backend/ root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
