"""Point the observation log at a throwaway temp dir before the app imports."""

import os
import tempfile

os.environ.setdefault("GIGACOOKIE_DATA_DIR", tempfile.mkdtemp(prefix="ubercookie-test-"))
