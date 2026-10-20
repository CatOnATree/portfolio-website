#!/usr/bin/env python3
"""
Local static file server for previewing this site.

Plain `python -m http.server` doesn't send a Cache-Control header, so
Chrome sometimes serves a stale cached copy of script.js/style.css after
you edit them, even on a normal refresh. This wrapper just adds
`Cache-Control: no-store` to every response so edits always show up.

Usage:
    python serve.py [port]      (defaults to 8080)
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    http.server.test(HandlerClass=NoCacheHandler, port=port)
