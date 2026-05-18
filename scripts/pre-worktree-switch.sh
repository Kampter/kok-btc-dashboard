#!/bin/bash
# Pre-worktree-switch hook: Prevent losing docs/superpowers/ changes
#
# Usage: Source this script before switching worktrees:
#   source scripts/pre-worktree-switch.sh
#
# NOTE: This script is designed to be sourced (not executed directly).
# All failure exits use `return` to avoid closing the user's shell.

DOCS_DIR="docs/superpowers"

# Check for uncommitted changes in docs/superpowers/
if ! git diff --quiet HEAD -- "$DOCS_DIR" 2>/dev/null; then
    echo "⚠️  WARNING: Uncommitted changes detected in $DOCS_DIR"
    echo ""
    git status --short "$DOCS_DIR"
    echo ""
    echo "Options:"
    echo "  1. Commit changes: git add $DOCS_DIR && git commit -m 'docs: ...'"
    echo "  2. Stash changes:  git stash push $DOCS_DIR"
    echo "  3. Force switch:   Set SKIP_DOCS_CHECK=1"
    echo ""

    if [ -z "$SKIP_DOCS_CHECK" ]; then
        echo "❌ Aborting worktree switch. Set SKIP_DOCS_CHECK=1 to bypass."
        return 1
    else
        echo "⚡ SKIP_DOCS_CHECK is set, proceeding anyway..."
    fi
fi

# Check for untracked files in docs/superpowers/
UNTRACKED=$(git ls-files --others --exclude-standard "$DOCS_DIR" 2>/dev/null)
if [ -n "$UNTRACKED" ]; then
    echo "⚠️  WARNING: Untracked files in $DOCS_DIR:"
    echo "$UNTRACKED"
    echo ""

    if [ -z "$SKIP_DOCS_CHECK" ]; then
        echo "❌ Aborting worktree switch. Set SKIP_DOCS_CHECK=1 to bypass."
        return 1
    else
        echo "⚡ SKIP_DOCS_CHECK is set, proceeding anyway..."
    fi
fi

echo "✅ $DOCS_DIR is clean. Safe to switch worktree."
