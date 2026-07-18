#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

echo "Production planner: http://127.0.0.1:8000/production.html"
exec python3 -m http.server 8000 --bind 127.0.0.1
