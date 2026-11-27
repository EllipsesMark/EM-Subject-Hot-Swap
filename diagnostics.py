"""Opt-in, privacy-conscious diagnostics for interactive LLM requests."""

from __future__ import annotations

import logging
import os
import re
import threading
from logging.handlers import RotatingFileHandler

_LOGGER = None
_LOGGER_LOCK = threading.Lock()
_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def valid_request_id(value):
    value = str(value or "")
    return value if _REQUEST_ID.fullmatch(value) else ""


def diagnostics_log_path():
    try:
        import folder_paths
        user_dir = folder_paths.get_user_directory()
        user_dir = os.fspath(user_dir) if user_dir else ""
    except Exception:
        user_dir = ""
    if not user_dir:
        comfy_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        user_dir = os.path.join(comfy_root, "user")
    return os.path.join(user_dir, "hot_swap_diagnostics.log")


def _logger():
    global _LOGGER
    if _LOGGER is not None:
        return _LOGGER
    with _LOGGER_LOCK:
        if _LOGGER is not None:
            return _LOGGER
        try:
            path = diagnostics_log_path()
            os.makedirs(os.path.dirname(path), exist_ok=True)
            logger = logging.getLogger("EMSubjectHotSwapDiagnostics")
            logger.setLevel(logging.INFO)
            logger.propagate = False
            if not any(getattr(handler, "baseFilename", None) == os.path.abspath(path)
                       for handler in logger.handlers):
                handler = RotatingFileHandler(
                    path, maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8",
                )
                handler.setFormatter(logging.Formatter(
                    "%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S",
                ))
                logger.addHandler(handler)
            _LOGGER = logger
        except Exception:
            logging.getLogger(__name__).exception(
                "Could not initialize EM Subject Hot Swap diagnostics file."
            )
            return None
    return _LOGGER


def log_diagnostic(enabled, request_id, event, **fields):
    if not enabled:
        return
    logger = _logger()
    if logger is None:
        return
    request_id = valid_request_id(request_id) or "unknown"
    parts = [f"request={request_id}", f"event={str(event)[:80]}"]
    for key, value in sorted(fields.items()):
        if value is None:
            continue
        safe_value = str(value).replace("\r", " ").replace("\n", " ")[:500]
        parts.append(f"{key}={safe_value}")
    logger.info("%s", " ".join(parts))
