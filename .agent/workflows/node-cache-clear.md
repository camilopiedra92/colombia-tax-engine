---
description: Clear Node and npm caches safely
---

# Node Cache Clear Workflow

Safe procedures for clearing various Node.js and npm caches in the Antigravity isolation environment.

## When to Use This Workflow

- npm install failing with cached data issues
- Build outputs inconsistent or stale
- Test results cached incorrectly
- After major dependency updates
- After changing Node versions

## Step 1: Clear Project-Local Temp Directories

**Action:** Remove project-local cache and temp directories

```bash
rm -rf .tmp .vitest-cache .npm-cache coverage dist .next .nuxt
```

// turbo

## Step 2: Clear npm Cache (Local)

**Action:** Clear npm cache to project directory

```bash
npm cache clean --force
```

// turbo

## Step 3: Remove node_modules

**Action:** Delete node_modules to start fresh

```bash
rm -rf node_modules
```

// turbo

## Step 4: Remove package-lock.json (if needed)

**Action:** Delete lockfile if dependencies are corrupted

```bash
rm -f package-lock.json
```

**Note:** Only do this if you're experiencing dependency resolution issues

// turbo

## Step 5: Reinstall Dependencies with TMPDIR

**Action:** Clean install with Antigravity workaround

```bash
TMPDIR="$(pwd)/.tmp" npm install
```

## Step 6: Verify Installation

**Action:** Check that node_modules exists and dependencies are installed

```bash
ls node_modules | wc -l
```

**Expected:** Should show number of installed packages (>0)

// turbo

## Step 7: Run Tests to Verify

**Action:** Run tests to ensure everything works

```bash
npm test
```

// turbo

## Advanced: Clear All Caches

If issues persist, clear ALL project caches:

```bash
# Remove all cache and temp directories
find . -type d \( -name '.tmp' -o -name '*-cache' -o -name 'coverage' -o -name 'dist' -o -name '.next' \) -exec rm -rf {} + 2>/dev/null

# Remove node_modules and lockfile
rm -rf node_modules package-lock.json

# Fresh install
TMPDIR="$(pwd)/.tmp" npm install
```

## Troubleshooting

### Issue: npm cache clean fails

**Solution:** The cache is likely in a system directory. Just proceed with next steps.

### Issue: Permission errors during rm

**Solution:** Make sure you're in the project directory, not system directories

### Issue: Dependencies won't install

**Solution:**

1. Check network connection
2. Try with `TMPDIR="$(pwd)/.tmp" npm install --verbose`
3. Check npm registry is accessible

## Verification Checklist

- [ ] All cache directories removed
- [ ] node_modules removed
- [ ] Fresh npm install completed
- [ ] Tests pass
- [ ] No EPERM errors during install
