#!/bin/bash
# Persistent Koru dev server launcher
cd /home/z/my-project/koru-mvp
exec npx vite --port 5200 --host 0.0.0.0
