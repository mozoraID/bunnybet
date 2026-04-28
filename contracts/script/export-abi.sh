#!/usr/bin/env bash
# export-abi.sh — run after `forge build` to push ABIs to the frontend.
set -euo pipefail

OUT="./out"
DEST="../frontend/src/lib/abis"
mkdir -p "$DEST"

for c in PredictionMarketFactory PredictionMarket; do
  src="$OUT/${c}.sol/${c}.json"
  if [[ -f "$src" ]]; then
    jq '.abi' "$src" > "$DEST/${c}.json"
    echo "✓ $c"
  else
    echo "✗ $c — run forge build first"
  fi
done
echo "Done → $DEST"
