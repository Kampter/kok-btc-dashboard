#!/bin/bash
# Commit plan and spec documents to prevent loss
#
# Usage: ./scripts/commit-plan-spec.sh [spec|plan|both]
#   spec  — commit docs/superpowers/specs/*.md
#   plan  — commit docs/superpowers/plans/*.md
#   both  — commit both (default)

set -e

TYPE="${1:-both}"

case "$TYPE" in
    spec)
        FILES="docs/superpowers/specs/*.md"
        MSG="docs: update $(date +%Y-%m-%d) spec"
        ;;
    plan)
        FILES="docs/superpowers/plans/*.md"
        MSG="docs: update $(date +%Y-%m-%d) plan"
        ;;
    both)
        FILES="docs/superpowers/specs/*.md docs/superpowers/plans/*.md"
        MSG="docs: update $(date +%Y-%m-%d) spec and plan"
        ;;
    *)
        echo "Usage: $0 [spec|plan|both]"
        exit 1
        ;;
esac

# Check if there are any changes
if git diff --quiet HEAD -- $FILES 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard $FILES 2>/dev/null)" ]; then
    echo "✅ No changes to commit in $FILES"
    exit 0
fi

git add $FILES
git commit -m "$MSG"
echo "✅ Committed: $MSG"
