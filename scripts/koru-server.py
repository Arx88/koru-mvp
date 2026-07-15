#!/usr/bin/env python3
"""
Koru production server — serves static files from dist/ and proxies API to Node backend.
Python handles static files (lightweight), Node handles API (heavy but only 1 request at a time).
"""
import http.server
import socketserver
import urllib.request
import json
import os
import sys
import subprocess
import time
import threading
import signal

PORT = 3000
DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "koru-mvp", "dist")
NODE_BACKEND = "http://127.0.0.1:3001"

# Start Node backend on port 3001
print(f"Starting Node backend on port 3001...", flush=True)
env = os.environ.copy()
# Load .env
env_path = os.path.join(os.path.dirname(__file__), "..", "koru-mvp", ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip()

node_proc = subprocess.Popen(
    ["node", "server-bundle.mjs"],
    cwd=os.path.join(os.path.dirname(__file__), "..", "koru-mvp"),
    env={**env, "PORT": "3001"},
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)
# Wait for backend to start
time.sleep(3)
print(f"Node backend started (PID {node_proc.pid})", flush=True)

MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
}

class KoruHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        # API proxy
        if self.path.startswith("/api/"):
            self._proxy("GET")
            return
        # Static files
        if "." not in os.path.basename(self.path):
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self._proxy("POST")
            return
        self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._add_cors()
        self.end_headers()

    def _add_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _proxy(self, method):
        try:
            # Read body
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

            url = NODE_BACKEND + self.path
            headers = {k: v for k, v in self.headers.items() if k.lower() != "host"}

            # For streaming, we need to handle chunked response
            if self.path == "/api/koru/turn" and body and b'"stream":true' in body:
                req = urllib.request.Request(url, data=body, headers={**headers, "Content-Type": "application/json"}, method=method)
                resp = urllib.request.urlopen(req, timeout=120)

                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self._add_cors()
                self.end_headers()

                # Stream response
                for line in resp:
                    self.wfile.write(line)
                    self.wfile.flush()
                return

            # Non-streaming
            req = urllib.request.Request(url, data=body, headers={**headers, "Content-Type": "application/json"}, method=method)
            resp = urllib.request.urlopen(req, timeout=120)
            data = resp.read()

            self.send_response(resp.status)
            self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
            self._add_cors()
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            print(f"Proxy error: {e}", flush=True)
            self.send_response(502)
            self._add_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

def cleanup(signum=None, frame=None):
    if node_proc:
        node_proc.terminate()
        node_proc.wait()
    sys.exit(0)

signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

print(f"Serving Koru on http://localhost:{PORT}", flush=True)
with socketserver.TCPServer(("0.0.0.0", PORT), KoruHandler) as httpd:
    httpd.serve_forever()
