#!/bin/bash
# Run the Hungry Hole real-input test, retrying once if the headless browser
# itself dies mid-run (this VM runs several Chrome sessions in parallel and
# the test browser has been OOM-killed twice). A retry re-runs the whole
# suite from scratch; the reported result is the last attempt's.
cd "$(dirname "$0")"
# one hungry-hole run at a time (parallel sibling runs already strain RAM)
exec 9>/tmp/hungry-hole-test.lock
flock -n 9 || { echo "another hungry-hole test run is active"; exit 3; }
URL="file:///home/hatch/workspace/playables-inspired/hungry-hole/index.html"
for attempt in 1 2; do
  echo "=== attempt $attempt ==="
  NODE_PATH=~/workspace/tools/pw-shot/node_modules timeout 1500 node test.js "$URL" ./test-shots > "/tmp/fulltest-attempt$attempt.log" 2>&1
  rc=$?
  grep -E "^(PASS|FAIL|TEST CRASH|[0-9]+/[0-9]+ checks)" "/tmp/fulltest-attempt$attempt.log" | tail -15
  if [ $rc -eq 0 ]; then echo "GREEN on attempt $attempt"; exit 0; fi
  if ! grep -q "Target page, context or browser has been closed" "/tmp/fulltest-attempt$attempt.log"; then
    echo "FAILED (game/test failure, not a browser death) — no retry"
    exit $rc
  fi
  echo "Browser died mid-run (attempt $attempt) — retrying once"
  sleep 5
done
echo "FAILED after 2 attempts"
exit 1
