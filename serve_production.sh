#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

if [ ! -f node_modules/@tarekraafat/autocomplete.js/dist/autoComplete.min.js ]; then
  echo "autoComplete.js is missing. Run npm install before starting the planner." >&2
  exit 1
fi

echo "Production planner: http://127.0.0.1:8000/production.html"
exec python3 -m http.server 8000 --bind 127.0.0.1
