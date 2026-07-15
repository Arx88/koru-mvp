#!/bin/bash
# Crop 46px black borders from left and right of all videos
# Original: 540x960, with 46px borders L+R
# After crop: 448x960 (content only)
# Then we re-encode keeping aspect — let's also pad back to 540x960 with content scaled to fill (no black bars)
# Or better: just keep the cropped 448x960 (which is ~9:19.3, taller than 9:16)
# Best approach: crop to 448x960, then scale that to fill 540x960 with object-fit:cover in browser
# That means we should make the video exactly 448x960 (content) and let the browser cover-fit it

set -e
SRC_DIR="/tmp/animados-src"
DST_DIR="/home/z/my-project/download/koru-states-preview/assets"
mkdir -p "$DST_DIR"

declare -A NAME_MAP=(
  ["Buscando informacion.mp4"]="estado-buscando.mp4"
  ["Guardando memoria.mp4"]="estado-memoria.mp4"
  ["Working.mp4"]="estado-trabajando.mp4"
  ["sleeping.mp4"]="estado-durmiendo.mp4"
)

for src_name in "${!NAME_MAP[@]}"; do
  dst_name="${NAME_MAP[$src_name]}"
  src_path="$SRC_DIR/$src_name"
  dst_path="$DST_DIR/$dst_name"
  
  if [ ! -f "$src_path" ]; then
    echo "SKIP: $src_path not found"
    continue
  fi
  
  echo "=== Cropping borders from $src_name ==="
  # Crop: iw - 92 (46*2) = 448 width, full 960 height, x offset 46
  # Then we need 9:16 = 540x960 — scale cropped (448x960) up to 540 width keeping height
  # 448 -> 540 means we need height = 960 * (540/448) = 1157
  # Then crop center to 540x960
  # This way the content fills the full 540x960 frame with NO black bars
  
  ffmpeg -y -i "$src_path" \
    -vf "crop=448:960:46:0,scale=540:1157,crop=540:960" \
    -c:v libx264 \
    -preset ultrafast \
    -crf 26 \
    -pix_fmt yuv420p \
    -an \
    -movflags +faststart \
    "$dst_path" 2>&1 | tail -3
  
  size=$(stat -c%s "$dst_path")
  size_kb=$((size / 1024))
  echo "  -> $dst_path (${size_kb} KB)"
done

echo ""
echo "=== Verifying no black borders ==="
python3 << 'EOF'
from PIL import Image
import numpy as np
import subprocess

for video in ['estado-trabajando.mp4', 'estado-buscando.mp4', 'estado-memoria.mp4', 'estado-durmiendo.mp4']:
    path = f'/home/z/my-project/download/koru-states-preview/assets/{video}'
    subprocess.run(['ffmpeg', '-y', '-i', path, '-vframes', '1', '-ss', '2', '/tmp/v-frame.png'],
                    capture_output=True)
    frame = Image.open('/tmp/v-frame.png')
    arr = np.array(frame)
    
    left = 0
    for x in range(arr.shape[1]):
        if arr[:, x, :3].max() > 10:
            left = x
            break
    right = 0
    for x in range(arr.shape[1]-1, -1, -1):
        if arr[:, x, :3].max() > 10:
            right = arr.shape[1] - 1 - x
            break
    
    print(f"{video} ({frame.size[0]}x{frame.size[1]}): L={left} R={right}  {'✓ CLEAN' if left < 3 and right < 3 else '✗ STILL HAS BORDERS'}")
EOF
