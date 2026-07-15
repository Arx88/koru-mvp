#!/bin/bash
# Keep Koru server alive — restart if it crashes
cd /home/z/my-project/koru-mvp

# Load .env
export $(grep -v '^#' .env | xargs)

while true; do
  echo "[$(date)] Starting Koru server..."
  node --experimental-strip-types server/index.ts 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 3s..."
  sleep 3
done
