---
description: Fix EPERM errors in Antigravity isolation
---

# Fix EPERM Errors Workflow

This workflow guides you through diagnosing and fixing `EPERM: operation not permitted` errors in the Antigravity isolation environment.

## Step 1: Identify the Command Causing EPERM

Run the failing command to see the exact error:

```bash
npm test
# or
npm run build
# or the failing command
```

**Expected output:** Error message with path like `/var/folders/...` or `/tmp/...`

## Step 2: Check Current Package.json Scripts

**Action:** Review the `package.json` scripts section

Look for scripts that might create temporary files (test, build, dev, etc.)

## Step 3: Add TMPDIR Workaround to Package.json

**Action:** Update the failing script with TMPDIR prefix

Example:

```json
{
  "scripts": {
    "test": "TMPDIR=\"$(pwd)/.tmp\" vitest run",
    "test:watch": "TMPDIR=\"$(pwd)/.tmp\" vitest",
    "test:coverage": "TMPDIR=\"$(pwd)/.tmp\" vitest run --coverage"
  }
}
```

// turbo

## Step 4: Update Tool Configuration Files

**Action:** Check and update config files (vite.config.ts, vitest.config.ts, webpack.config.js, etc.)

Add cache directory configuration:

```typescript
import { resolve } from "path";

export default defineConfig({
  cacheDir: resolve(__dirname, ".cache-name"),
  // ... other config
});
```

## Step 5: Update .gitignore

**Action:** Add new local temp/cache directories to `.gitignore`

Example additions:

```gitignore
.tmp/
.vitest-cache/
.npm-cache/
coverage/
```

// turbo

## Step 6: Create Local Temp Directory

**Action:** Create the temp directory if it doesn't exist

```bash
mkdir -p .tmp
```

// turbo

## Step 7: Test the Fix

**Action:** Run the original failing command again

```bash
npm test
```

**Expected:** Command should complete without EPERM errors

// turbo

## Step 8: Verify Temp Files Location

**Action:** Check that temp files are created in project root

```bash
ls -la | grep -E "^\\.tmp|^\\..*-cache|^coverage"
```

**Expected:** Should see `.tmp/`, cache directories, etc. in project root

// turbo

## Step 9: Clean Up (Optional)

**Action:** Remove temp directories if needed

```bash
rm -rf .tmp .vitest-cache coverage
```

// turbo

## Common Issues and Solutions

### Issue: npm install failing with EPERM

**Solution:**

```bash
TMPDIR="$(pwd)/.tmp" npm install
```

### Issue: Permission denied on node_modules/.cache

**Solution:** Configure tool to use custom cache directory in project root

### Issue: Multiple tools failing

**Solution:** Apply TMPDIR workaround globally by setting it in all npm scripts

## Verification Checklist

- [ ] TMPDIR set in relevant package.json scripts
- [ ] Tool config files updated with local cache directories
- [ ] .gitignore updated with new directories
- [ ] Command runs without EPERM errors
- [ ] Temp files created in project root (not system temp)
