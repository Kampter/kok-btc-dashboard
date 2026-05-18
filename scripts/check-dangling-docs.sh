#!/bin/bash
# Check for lost docs/superpowers/ files in dangling commits
#
# Usage: ./scripts/check-dangling-docs.sh
#        ./scripts/check-dangling-docs.sh --recover  # Auto-recover to docs/superpowers/recovered/

set -e

DOCS_PATTERN="docs/superpowers"
RECOVER_DIR="$DOCS_PATTERN/recovered"

# Find dangling commits
DANGLING=$(git fsck --lost-found --dangling 2>/dev/null | grep "dangling commit" | awk '{print $3}')

if [ -z "$DANGLING" ]; then
    echo "✅ No dangling commits found."
    exit 0
fi

FOUND=0
for commit in $DANGLING; do
    # Check if this commit touches docs/superpowers/
    FILES=$(git diff-tree --no-commit-id --name-only -r "$commit" 2>/dev/null | grep "^$DOCS_PATTERN/" || true)

    if [ -n "$FILES" ]; then
        FOUND=$((FOUND + 1))
        echo ""
        echo "🚨 DANGLING COMMIT WITH DOCS: $commit"
        echo "   Date: $(git show -s --format=%ci "$commit" 2>/dev/null || echo 'unknown')"
        echo "   Message: $(git show -s --format=%s "$commit" 2>/dev/null || echo 'unknown')"
        echo "   Files:"
        echo "$FILES" | sed 's/^/     - /'

        if [ "$1" = "--recover" ]; then
            mkdir -p "$RECOVER_DIR"
            for file in $FILES; do
                rel_path="${file#$DOCS_PATTERN/}"
                TARGET="$RECOVER_DIR/$rel_path"
                mkdir -p "$(dirname "$TARGET")"
                if [ ! -f "$TARGET" ]; then
                    git show "$commit:$file" > "$TARGET" 2>/dev/null
                    echo "   ✏️  Recovered to $TARGET"
                else
                    echo "   ⏭️  Skipped $TARGET (already exists)"
                fi
            done
        fi
    fi
done

if [ "$FOUND" -eq 0 ]; then
    echo "✅ No dangling docs found."
else
    echo ""
    echo "⚠️  Found $FOUND dangling commit(s) with docs/superpowers/ files."
    if [ "$1" != "--recover" ]; then
        echo "   Run with --recover to auto-restore them."
    fi
fi
