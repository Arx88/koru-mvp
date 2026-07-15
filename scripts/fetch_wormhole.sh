#!/bin/bash
# Try to fetch wormhole page metadata
URL="https://wormhole.app/W0MBRm"
curl -sL -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" "$URL" -o /tmp/wormhole_page.html -D /tmp/wormhole_headers.txt --max-time 20
echo "=== HEADERS ==="
cat /tmp/wormhole_headers.txt
echo ""
echo "=== PAGE SIZE ==="
wc -c /tmp/wormhole_page.html
echo ""
echo "=== TITLE / META ==="
grep -oE '<title>[^<]*</title>|meta[^>]*name="description"[^>]*content="[^"]*"' /tmp/wormhole_page.html | head -20
