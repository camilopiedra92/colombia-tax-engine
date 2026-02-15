#!/usr/bin/env bash

# EPERM Fix Helper Script for Antigravity Isolation
# This script helps diagnose and fix EPERM errors by setting up local temp directories

set -e

echo "🔍 EPERM Fix Helper for Antigravity Isolation"
echo "=============================================="
echo ""

# Function to check if directory exists and create if not
ensure_dir() {
    local dir=$1
    if [ ! -d "$dir" ]; then
        echo "📁 Creating directory: $dir"
        mkdir -p "$dir"
    else
        echo "✅ Directory exists: $dir"
    fi
}

# Function to check if pattern exists in file
check_gitignore() {
    local pattern=$1
    if grep -q "^${pattern}$" .gitignore 2>/dev/null; then
        echo "✅ .gitignore contains: $pattern"
    else
        echo "⚠️  Adding to .gitignore: $pattern"
        echo "$pattern" >> .gitignore
    fi
}

echo "Step 1: Creating local temp directories..."
ensure_dir ".tmp"
ensure_dir ".vitest-cache"
ensure_dir ".npm-cache"
echo ""

echo "Step 2: Checking .gitignore..."
check_gitignore ".tmp/"
check_gitignore ".vitest-cache/"
check_gitignore ".npm-cache/"
check_gitignore "coverage/"
echo ""

echo "Step 3: Verifying package.json scripts..."
if grep -q 'TMPDIR=' package.json; then
    echo "✅ package.json has TMPDIR workaround"
else
    echo "⚠️  package.json may need TMPDIR workaround in scripts"
    echo "   Example: \"test\": \"TMPDIR=\\\"\$(pwd)/.tmp\\\" vitest run\""
fi
echo ""

echo "Step 4: Checking for config files that may need updates..."
for config in vitest.config.* vite.config.* webpack.config.*; do
    if [ -f "$config" ]; then
        echo "📄 Found: $config"
        if grep -q "cacheDir" "$config"; then
            echo "   ✅ Has cacheDir configuration"
        else
            echo "   ⚠️  May need cacheDir configuration"
        fi
    fi
done
echo ""

echo "Step 5: Environment check..."
echo "Current TMPDIR: ${TMPDIR:-not set}"
echo "Project TMPDIR should be: $(pwd)/.tmp"
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. If tests still fail, run: TMPDIR=\"\$(pwd)/.tmp\" npm test"
echo "2. Update package.json scripts with TMPDIR prefix"
echo "3. Update tool config files with cacheDir settings"
echo ""
echo "For more help, see:"
echo "  - .agent/rules/eperm-and-cache.md"
echo "  - .agent/workflows/fix-eperm.md"
