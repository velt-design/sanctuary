#!/usr/bin/env bash
set -euo pipefail

legacy_paths=$(git ls-files | rg '(^|/)(src/costing|apps/.*/src/costing)/' || true)

if [[ -n "${legacy_paths}" ]]; then
  echo "Legacy costing paths detected. Use packages/costing and @sp/costing instead."
  echo "Found:"
  echo "${legacy_paths}"
  exit 1
fi

echo "OK: no legacy costing paths found."
