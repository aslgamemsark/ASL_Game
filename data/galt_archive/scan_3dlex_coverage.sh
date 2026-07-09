#!/bin/bash
# Batch-checks every FBX in data/3dlex/ANIM_FBX/ for usable animation data, by running fbx2gltf on
# each one and grepping its own log for the "has zero channels. Skipping." warning it prints when a
# source FBX's animation track is empty (same defect class as FRIEND/MEDICINE/NAME/PAIN — dead in
# the source, not fixable on our end). This is how the 735/938 (78.4%) usable-word figure in
# docs/3DLEX_ANIMATION_PIPELINE_HANDOFF.md was produced (2026-07-09).
#
# Prereq: fbx2gltf installed per the handoff doc's Setup section.
# Usage:  FBX2GLTF=/path/to/FBX2glTF.exe ./data/galt_archive/scan_3dlex_coverage.sh
# Output: data/galt_archive/3dlex_coverage_scan.tsv  (columns: word<TAB>OK|ZERO_CHANNELS|CONVERT_FAILED)

set -u
: "${FBX2GLTF:?Set FBX2GLTF to the fbx2gltf binary path, e.g. node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe}"

FBX_DIR="data/3dlex/ANIM_FBX"
OUT_TSV="data/galt_archive/3dlex_coverage_scan.tsv"
TMP_GLB_DIR="$(mktemp -d)"

> "$OUT_TSV"
for fbx in "$FBX_DIR"/*.fbx; do
  word="$(basename "$fbx" .fbx)"
  log="$TMP_GLB_DIR/${word}.log"
  "$FBX2GLTF" -i "$fbx" -o "$TMP_GLB_DIR/${word}.glb" --binary > "$log" 2>&1
  if grep -qi "zero channels" "$log"; then
    echo -e "${word}\tZERO_CHANNELS" >> "$OUT_TSV"
  elif [ -f "$TMP_GLB_DIR/${word}.glb" ]; then
    echo -e "${word}\tOK" >> "$OUT_TSV"
  else
    echo -e "${word}\tCONVERT_FAILED" >> "$OUT_TSV"
  fi
  rm -f "$TMP_GLB_DIR/${word}.glb"
done

rm -rf "$TMP_GLB_DIR"
echo "Done. Results in $OUT_TSV"
echo "OK: $(grep -c OK "$OUT_TSV")   ZERO_CHANNELS: $(grep -c ZERO_CHANNELS "$OUT_TSV")   CONVERT_FAILED: $(grep -c CONVERT_FAILED "$OUT_TSV")"
