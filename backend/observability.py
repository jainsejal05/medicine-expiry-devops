"""
Observability setup for the Medicine Expiry Tracker backend.

Adds the two pillars we can do inside the app:
  1. METRICS  -> /metrics endpoint in Prometheus format (scraped by Prometheus)
  2. LOGS     -> structured JSON logs on stdout (one JSON object per request)

Usage in app.py:
    from observability import setup_observability
    setup_observability(app)
"""
import json
import logging
import sys
import time

from flask import g, request
from prometheus_flask_exporter import PrometheusMetrics


class JsonFormatter(logging.Formatter):
    """Turns every log record into one JSON line (easy to search/parse in Grafana Loki later)."""

    EXTRA_FIELDS = ("http_method", "http_path", "http_status", "duration_ms", "remote_addr")

    def format(self, record):
        entry = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in self.EXTRA_FIELDS:
            if hasattr(record, field):
                entry[field] = getattr(record, field)
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry)


def setup_observability(app):
    # ---------- Structured JSON logging ----------
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    app.logger.handlers = [handler]
    app.logger.setLevel(logging.INFO)
    app.logger.propagate = False
    logging.getLogger("werkzeug").setLevel(logging.WARNING)  # avoid duplicate plain-text access logs

    # ---------- Prometheus metrics ----------
    # group_by="url_rule" -> /api/medicines/5 and /api/medicines/9 are both counted as
    # /api/medicines/<int:med_id>, which keeps the number of time series small.
    metrics = PrometheusMetrics(app, group_by="url_rule")
    metrics.info("medicine_app_info", "Medicine Expiry Tracker backend", version="1.0.0")

    # ---------- One log line per request (with latency) ----------
    @app.before_request
    def _start_timer():
        g.request_start = time.perf_counter()

    @app.after_request
    def _log_request(response):
        if request.path != "/metrics":  # don't log Prometheus' own scrapes every 15s
            start = g.get("request_start", time.perf_counter())
            app.logger.info(
                "request",
                extra={
                    "http_method": request.method,
                    "http_path": request.path,
                    "http_status": response.status_code,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                    "remote_addr": request.remote_addr,
                },
            )
        return response

    return metrics
