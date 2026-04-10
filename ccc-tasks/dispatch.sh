#!/usr/bin/env bash
# Usage: bash ccc-tasks/dispatch.sh <task-id>

TASK_ID="${1:-make24-demo}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_FILE="${REPO_ROOT}/ccc-tasks/${TASK_ID}.json"
RESULT_FILE="${REPO_ROOT}/ccc-tasks/${TASK_ID}-result.json"

if [ ! -f "$TASK_FILE" ]; then
  echo "ERROR: Task file not found: $TASK_FILE"
  exit 1
fi

rm -f "$RESULT_FILE"

echo "=== CCC DISPATCH: $TASK_ID ==="
echo "Task file:   $TASK_FILE"
echo "Result file: $RESULT_FILE"
echo ""
echo "Launching CCC session..."
echo ""

printf 'You are a CCC agent executing a delegated task.\n\nRead the task specification at: %s\n\nExecute every phase. When complete (or on fatal error), write your structured result as valid JSON to: %s\n\nThe result must match the result_schema in the task spec. Do not truncate. Do not ask questions. Begin immediately.\n' \
  "$TASK_FILE" "$RESULT_FILE" \
  | claude \
      --print \
      --name "$TASK_ID" \
      --dangerously-skip-permissions \
      --add-dir "$HOME/make24-demo" \
      --add-dir "${REPO_ROOT}/ccc-tasks" \
      2>&1

echo ""
echo "=== CCC SESSION COMPLETE ==="

if [ -f "$RESULT_FILE" ]; then
  echo ""
  echo "--- RESULT ---"
  cat "$RESULT_FILE"
else
  echo "WARNING: No result file written."
fi
