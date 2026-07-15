#!/bin/bash
export $(grep -v '^#' /home/z/my-project/koru-mvp/.env | xargs)
while true; do
  # Check if server is alive
  if ! curl -s -o /dev/null http://localhost:3000/ --max-time 2 2>/dev/null; then
    echo "[$(date)] Server dead, restarting..." >> /tmp/koru-keepalive.log
    pkill -f "vite.js" 2>/dev/null
    sleep 1
    cd /home/z/my-project/koru-mvp
    setsid node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000 < /dev/null > /tmp/vite.log 2>&1 &
    disown
    sleep 3
  fi
  sleep 5
done
