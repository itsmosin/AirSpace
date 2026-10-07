#!/usr/bin/env bash
# Runs the Chainlink CRE verifier sweep against the hosted web app in a loop.
# Each pass polls <webBaseUrl>/api/verify/pending, audits up to 2 lots inside a TEE handler,
# and writes DON-signed verdicts to the AirSpace program on Solana devnet.
#
# Usage:  scripts/verifier-loop.sh [interval_seconds] [target]
#   interval_seconds  default 60
#   target            CRE target in cre/airspace-verifier/workflow.yaml (default hosted-settings)
set -u
INTERVAL="${1:-60}"
TARGET="${2:-hosted-settings}"
export PATH="$HOME/.cre/bin:$HOME/.bun/bin:$PATH"
cd "$(dirname "$0")/../cre" || exit 1
echo "airspace verifier loop: target=$TARGET every ${INTERVAL}s (ctrl-c to stop)"
while true; do
  echo "── $(date -u +%FT%TZ) sweep"
  cre workflow simulate ./airspace-verifier --target "$TARGET" --non-interactive --trigger-index 1 --broadcast 2>&1 \
    | grep -E "USER LOG|workflow execution failed" | sed -E 's/^[0-9T:\-]+Z \[USER LOG\] //' | cut -c1-200
  sleep "$INTERVAL"
done
