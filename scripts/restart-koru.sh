#!/bin/bash
pkill -f "vite.js" 2>/dev/null
sleep 1
cd /home/z/my-project/koru-mvp
export $(grep -v '^#' .env | xargs)
setsid node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000 < /dev/null > /tmp/vite-keep.log 2>&1 &
disown
echo "[$(date)] Koru restarted" >> /tmp/koru-restarts.log
