import sys
from pathlib import Path

# Make `backend/` importable so `from vendsoft import ...` works regardless of CWD.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
