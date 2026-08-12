"""Shared test configuration for the backend.

Makes `backend/` importable so `from integrations import ...` works regardless
of the directory pytest was invoked from.

No test in this suite touches a real database, a real provider, or the network.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
