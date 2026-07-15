#!/bin/bash
# Convert HEVC MP4s to H.264 web-friendly MP4s at 720x1280 (phone portrait)
# Keeps file size reasonable for demo while preserving aspect ratio

set -e
SRC_DIR="/home/z/my-project/download/koru-states-preview/assets-animados"
DST_DIR="/home/z/my-project/download/koru-states-preview/assets"
mkdir -p "$DST_DIR"

# Map original names to state-based names
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
  
  echo "Converting: $src_name -> $dst_name"
  # H.264, yuv420p, 720x1280, CRF 26 (good quality/size balance)
  # -movflags +faststart for progressive web playback
  ffmpeg -y -i "$src_path" \
    -c:v libx264 \
    -preset medium \
    -crf 26 \
    -pix_fmt yuv420p \
    -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black" \
    -an \
    -movflags +faststart \
    "$dst_path" 2>&1 | tail -3
  
  # Get final size
  size=$(stat -c%s "$dst_path")
  size_mb=$(echo "scale=2; $size / 1048576" | bc)
  echo "  -> $dst_path (${size_mb} MB)"
done

echo ""
echo "=== Final assets ==="
ls -lh "$DST_DIR"
