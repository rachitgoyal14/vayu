"""
logger.py  ─  VAYU Backend Structured Logger
=============================================
Drop this file next to main.py.

Usage in main.py:
    from logger import log, log_request, log_model_load, log_supabase, log_waqi, log_prediction

Features:
  • Colour-coded terminal output per level (works on Render's log viewer)
  • Structured single-line format → easy to grep / ctrl-F in Render dashboard
  • Request middleware with latency + status code
  • Per-route semantic helpers (model load, Supabase, WAQI, prediction)
  • Zero extra dependencies — stdlib only (logging + time + traceback)
"""

import logging
import sys
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Optional

# ─── ANSI colours (Render's log viewer renders these) ────────────────────────
RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"

BLACK   = "\033[30m"
RED     = "\033[31m"
GREEN   = "\033[32m"
YELLOW  = "\033[33m"
BLUE    = "\033[34m"
MAGENTA = "\033[35m"
CYAN    = "\033[36m"
WHITE   = "\033[37m"

BRIGHT_RED     = "\033[91m"
BRIGHT_GREEN   = "\033[92m"
BRIGHT_YELLOW  = "\033[93m"
BRIGHT_BLUE    = "\033[94m"
BRIGHT_MAGENTA = "\033[95m"
BRIGHT_CYAN    = "\033[96m"
BRIGHT_WHITE   = "\033[97m"

BG_RED    = "\033[41m"
BG_GREEN  = "\033[42m"
BG_YELLOW = "\033[43m"
BG_BLUE   = "\033[44m"


# ─── Level tag styling ───────────────────────────────────────────────────────
_LEVEL_STYLES = {
    "DEBUG":    f"{DIM}{WHITE}[DEBUG]{RESET}",
    "INFO":     f"{BOLD}{BRIGHT_CYAN}[INFO]{RESET} ",
    "SUCCESS":  f"{BOLD}{BRIGHT_GREEN}[OK]  {RESET} ",
    "WARNING":  f"{BOLD}{BRIGHT_YELLOW}[WARN]{RESET} ",
    "ERROR":    f"{BOLD}{BRIGHT_RED}[ERR] {RESET} ",
    "CRITICAL": f"{BOLD}{BG_RED}{WHITE}[CRIT]{RESET} ",
    "REQUEST":  f"{BOLD}{BRIGHT_BLUE}[REQ] {RESET} ",
    "MODEL":    f"{BOLD}{BRIGHT_MAGENTA}[MDL] {RESET} ",
    "DB":       f"{BOLD}{CYAN}[DB]  {RESET} ",
    "EXT":      f"{BOLD}{YELLOW}[EXT] {RESET} ",
    "PREDICT":  f"{BOLD}{BRIGHT_WHITE}[PRED]{RESET} ",
}


def _now() -> str:
    """UTC timestamp, compact format."""
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def _fmt(level: str, message: str, **ctx) -> str:
    """
    Build a single log line:
      HH:MM:SS  [LEVEL]  message  key=value key=value
    """
    tag   = _LEVEL_STYLES.get(level, f"[{level}]")
    ts    = f"{DIM}{_now()}{RESET}"
    body  = f"{BOLD}{message}{RESET}" if level in ("ERROR", "CRITICAL") else message
    parts = [ts, tag, body]

    if ctx:
        kv = "  ".join(
            f"{DIM}{k}{RESET}={BRIGHT_WHITE}{v}{RESET}"
            for k, v in ctx.items()
            if v is not None
        )
        parts.append(f"  {DIM}│{RESET}  {kv}")

    return "  ".join(parts)


def _emit(level: str, message: str, **ctx):
    stream = sys.stderr if level in ("ERROR", "CRITICAL", "WARNING") else sys.stdout
    print(_fmt(level, message, **ctx), file=stream, flush=True)


# ─── Public helpers ──────────────────────────────────────────────────────────

def log(message: str, level: str = "INFO", **ctx):
    """Generic log. level = INFO | DEBUG | WARNING | SUCCESS | ERROR | CRITICAL"""
    _emit(level.upper(), message, **ctx)


def log_startup(env: str = "production"):
    """Call once at app startup."""
    _emit("INFO",  "─" * 60)
    _emit("INFO",  f"  {BOLD}{BRIGHT_CYAN}VAYU  Backend{RESET}  starting up")
    _emit("INFO",  f"  env={env}   pid={__import__('os').getpid()}")
    _emit("INFO",  "─" * 60)


def log_model_load(name: str, path: str, elapsed_ms: Optional[float] = None):
    """
    Called after each joblib.load().

    Usage:
        t0 = time.perf_counter()
        models['xgb_6h'] = joblib.load(path)
        log_model_load('xgb_6h', path, elapsed_ms=(time.perf_counter()-t0)*1000)
    """
    ctx: dict[str, Any] = {"path": path}
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"
    _emit("MODEL", f"Loaded  {BOLD}{name}{RESET}", **ctx)


def log_models_ready(names: list[str]):
    """Summary line once all models are loaded."""
    _emit("MODEL", f"{BRIGHT_GREEN}All models ready{RESET}  ({len(names)} loaded)")
    for n in names:
        _emit("MODEL", f"  ✓  {n}")


def log_request(method: str, path: str, status: int, latency_ms: float,
                city: Optional[str] = None, client_ip: Optional[str] = None):
    """
    Emit one line per HTTP request.
    Colour the status code: green=2xx, yellow=4xx, red=5xx.

    Usage (FastAPI middleware):
        See log_middleware() below.
    """
    if status < 300:
        status_str = f"{BRIGHT_GREEN}{status}{RESET}"
    elif status < 500:
        status_str = f"{BRIGHT_YELLOW}{status}{RESET}"
    else:
        status_str = f"{BRIGHT_RED}{status}{RESET}"

    latency_str = (
        f"{BRIGHT_RED}{latency_ms:.0f}ms{RESET}" if latency_ms > 2000
        else f"{BRIGHT_YELLOW}{latency_ms:.0f}ms{RESET}" if latency_ms > 500
        else f"{BRIGHT_GREEN}{latency_ms:.0f}ms{RESET}"
    )

    ctx: dict[str, Any] = {"status": status_str, "latency": latency_str}
    if city:
        ctx["city"] = city
    if client_ip:
        ctx["ip"] = client_ip

    _emit("REQUEST", f"{BOLD}{method:6}{RESET} {path}", **ctx)


def log_supabase(operation: str, table: str, city: Optional[str] = None,
                 rows: Optional[int] = None, elapsed_ms: Optional[float] = None,
                 error: Optional[Exception] = None):
    """
    Call before/after every Supabase query.

    Usage:
        t0 = time.perf_counter()
        response = supabase.table("aqi_data").select(...).execute()
        log_supabase("SELECT", "aqi_data", city=city,
                     rows=len(response.data),
                     elapsed_ms=(time.perf_counter()-t0)*1000)
    """
    ctx: dict[str, Any] = {"table": table}
    if city:
        ctx["city"] = city
    if rows is not None:
        ctx["rows"] = rows
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"

    if error:
        ctx["error"] = str(error)
        _emit("DB", f"{BRIGHT_RED}FAILED{RESET}  {operation}", **ctx)
    else:
        _emit("DB", f"{operation}", **ctx)


def log_waqi(city: str, stations_found: int, aqi_values: list[float],
             final_aqi: Optional[int], elapsed_ms: Optional[float] = None,
             error: Optional[Exception] = None):
    """
    Call after _fetch_waqi() resolves.

    Usage:
        log_waqi(city, stations_found=len(aqi_values), aqi_values=aqi_values,
                 final_aqi=final_aqi, elapsed_ms=...)
    """
    ctx: dict[str, Any] = {"city": city}
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"

    if error:
        ctx["error"] = str(error)
        _emit("EXT", f"WAQI  {BRIGHT_RED}FAILED{RESET}", **ctx)
        return

    sorted_vals = sorted(aqi_values) if aqi_values else []
    ctx["stations"] = stations_found
    ctx["values"]   = str(sorted_vals) if sorted_vals else "[]"
    ctx["median"]   = final_aqi if final_aqi is not None else "n/a"
    _emit("EXT", f"WAQI  {BRIGHT_GREEN}OK{RESET}", **ctx)


def log_openweather(city: str, elapsed_ms: Optional[float] = None,
                    error: Optional[Exception] = None):
    """Call after _fetch_openweather() resolves."""
    ctx: dict[str, Any] = {"city": city}
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"
    if error:
        ctx["error"] = str(error)
        _emit("EXT", f"OpenWeather  {BRIGHT_RED}FAILED{RESET}", **ctx)
    else:
        _emit("EXT", f"OpenWeather  {BRIGHT_GREEN}OK{RESET}", **ctx)


def log_prediction(city: str, horizon: str, input_aqi: Optional[float],
                   predicted_aqi: float, category: str,
                   lag1: Optional[float] = None,
                   elapsed_ms: Optional[float] = None):
    """
    Call once per XGBoost prediction output.

    Usage:
        log_prediction(city, "6h", input_aqi=lag1, predicted_aqi=pred6,
                       category=cat6, lag1=lag1, elapsed_ms=...)
    """
    ctx: dict[str, Any] = {
        "city":     city,
        "horizon":  horizon,
        "pred_aqi": f"{predicted_aqi:.1f}",
        "category": category,
    }
    if input_aqi is not None:
        ctx["input_aqi"] = f"{input_aqi:.1f}"
    if lag1 is not None:
        ctx["lag1"] = f"{lag1:.1f}"
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"
    _emit("PREDICT", f"Forecast", **ctx)


def log_classify(city: str, predicted_class: int, predicted_category: str,
                 elapsed_ms: Optional[float] = None):
    """Call after classifier.predict()."""
    ctx: dict[str, Any] = {
        "city":     city,
        "class":    predicted_class,
        "category": predicted_category,
    }
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"
    _emit("PREDICT", f"Classify", **ctx)


def log_shap(city: str, top_feature: Optional[str] = None,
             top_value: Optional[float] = None,
             elapsed_ms: Optional[float] = None,
             error: Optional[Exception] = None):
    """Call after SHAP explain."""
    ctx: dict[str, Any] = {"city": city}
    if top_feature:
        ctx["top_feature"] = top_feature
    if top_value is not None:
        ctx["shap_val"] = f"{top_value:.4f}"
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"
    if error:
        ctx["error"] = str(error)
        _emit("PREDICT", f"SHAP  {BRIGHT_YELLOW}SKIPPED{RESET}", **ctx)
    else:
        _emit("PREDICT", f"SHAP  {BRIGHT_GREEN}OK{RESET}", **ctx)


def log_error(message: str, exc: Optional[Exception] = None,
              route: Optional[str] = None, city: Optional[str] = None,
              show_trace: bool = True):
    """
    Structured error log with optional full traceback.

    Usage:
        except Exception as e:
            log_error("forecast_realtime failed", exc=e, route="/predict/forecast/realtime", city=city)
            raise HTTPException(...)
    """
    ctx: dict[str, Any] = {}
    if route:
        ctx["route"] = route
    if city:
        ctx["city"] = city
    if exc:
        ctx["exc"] = type(exc).__name__
        ctx["msg"] = str(exc)

    _emit("ERROR", message, **ctx)

    if exc and show_trace:
        tb = traceback.format_exc()
        # Print each line with the ERROR tag so it's visually grouped
        for line in tb.strip().splitlines():
            print(f"  {DIM}{BRIGHT_RED}{line}{RESET}", file=sys.stderr, flush=True)


def log_health():
    """Call from /health endpoint to confirm backend is alive."""
    _emit("INFO", f"{BRIGHT_GREEN}●{RESET}  Health check  {BRIGHT_GREEN}OK{RESET}")


def log_history_query(city_count: int, since: str, total_rows: int,
                      elapsed_ms: Optional[float] = None):
    """Call after the 24h history batch query."""
    ctx: dict[str, Any] = {
        "cities":     city_count,
        "since":      since,
        "total_rows": total_rows,
    }
    if elapsed_ms is not None:
        ctx["elapsed"] = f"{elapsed_ms:.0f}ms"
    _emit("DB", "History 24h  all-cities", **ctx)


# ─── FastAPI middleware ───────────────────────────────────────────────────────

def make_logging_middleware():
    """
    Returns a Starlette BaseHTTPMiddleware that logs every request.

    Usage in main.py:
        from starlette.middleware.base import BaseHTTPMiddleware
        from logger import make_logging_middleware
        app.add_middleware(BaseHTTPMiddleware, dispatch=make_logging_middleware())
    """
    async def dispatch(request, call_next):
        t0     = time.perf_counter()
        method = request.method
        path   = request.url.path
        ip     = request.client.host if request.client else None

        # Parse city from body if it's a POST — best-effort, never blocks
        city = None
        try:
            if method == "POST":
                body = await request.body()
                import json
                payload = json.loads(body)
                city = payload.get("city")
                # Re-attach body so downstream can still read it
                from starlette.requests import Request
                from starlette.datastructures import Headers
                scope = dict(request.scope)
                async def receive():
                    return {"type": "http.request", "body": body}
                request = Request(scope, receive)
        except Exception:
            pass

        try:
            response    = await call_next(request)
            status      = response.status_code
        except Exception as exc:
            elapsed_ms  = (time.perf_counter() - t0) * 1000
            log_request(method, path, 500, elapsed_ms, city=city, client_ip=ip)
            raise

        elapsed_ms = (time.perf_counter() - t0) * 1000
        log_request(method, path, status, elapsed_ms, city=city, client_ip=ip)
        return response

    return dispatch


# ─── stdlib logging bridge (captures uvicorn + third-party logs) ─────────────

class _VayuHandler(logging.Handler):
    """
    Bridges Python's stdlib logging into our coloured formatter.
    Captures uvicorn, fastapi, and any library that uses logging.getLogger().
    """
    _LEVEL_MAP = {
        logging.DEBUG:    "DEBUG",
        logging.INFO:     "INFO",
        logging.WARNING:  "WARNING",
        logging.ERROR:    "ERROR",
        logging.CRITICAL: "CRITICAL",
    }

    def emit(self, record: logging.LogRecord):
        level  = self._LEVEL_MAP.get(record.levelno, "INFO")
        source = f"{DIM}({record.name}){RESET}"
        msg    = self.format(record)
        _emit(level, f"{source}  {msg}")


def install_stdlib_bridge(level: int = logging.WARNING):
    """
    Redirect Python stdlib logging (uvicorn.access, sqlalchemy, etc.)
    into our coloured output.  Call once at startup.

    Only WARNING+ by default to avoid Uvicorn flooding the terminal.
    Set level=logging.INFO to also see Uvicorn access logs (though
    make_logging_middleware is more informative for those).

    Usage:
        from logger import install_stdlib_bridge
        install_stdlib_bridge()
    """
    handler = _VayuHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))

    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(level)

    # Silence uvicorn's own access logger — our middleware handles that
    logging.getLogger("uvicorn.access").propagate = False


# ─── Convenience timing context manager ──────────────────────────────────────

class Timer:
    """
    Usage:
        with Timer() as t:
            result = some_slow_call()
        log_supabase("SELECT", "aqi_data", elapsed_ms=t.ms)
    """
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.ms = (time.perf_counter() - self._start) * 1000

    @property
    def elapsed(self) -> str:
        return f"{self.ms:.0f}ms"