# -*- coding: utf-8 -*-
"""
PyInstaller runtime hook: capture any uncaught exception during startup/import time
and write it to startup_error.log next to the executable.
"""
import sys
import os
import traceback
import datetime


def _startup_excepthook(exc_type, exc_value, exc_traceback):
    try:
        base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        log_path = os.path.join(base_dir, 'startup_error.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] Uncaught exception during startup\n")
            traceback.print_exception(exc_type, exc_value, exc_traceback, file=f)
            f.write("\n")
    except Exception:
        # If logging fails, fall back silently
        pass
    # Delegate to default excepthook to ensure console also gets the traceback
    try:
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
    except Exception:
        pass


# Install the hook as early as possible
sys.excepthook = _startup_excepthook
