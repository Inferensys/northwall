#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building agent control server..."
cd agent-control
npm install
npx tsc
cd ..

echo "Building Docker image: northwall-agent-vm..."
docker build -t northwall-agent-vm .

echo "Done! Run with:"
echo "  docker run -p 6080:6080 -p 9999:9999 northwall-agent-vm"
echo ""
echo "  noVNC: http://localhost:6080/vnc.html?autoconnect=true"
echo "  Control API: http://localhost:9999"
