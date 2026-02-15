# EPERM and Cache Handling Rule

## Context

This project runs in an **Antigravity isolation environment** where direct access to system temporary directories (like `/var/folders/`, `/tmp/`, etc.) is restricted and results in `EPERM: operation not permitted` errors.

## Critical Rules

### 1. Always Use Local Temporary Directories

**NEVER** rely on system temp directories. **ALWAYS** configure tools to use project-local directories:

- ✅ Use `TMPDIR="$(pwd)/.tmp"` environment variable for commands
- ✅ Configure cache directories to project root (e.g., `.vitest-cache/`, `.cache/`, etc.)
- ✅ Configure output directories to project root (e.g., `coverage/`, `dist/`, etc.)

### 2. Package.json Scripts (PRIMARY SOLUTION)

**This is the enterprise-grade approach** - use TMPDIR in npm scripts:

```json
{
  "scripts": {
    "test": "TMPDIR=\"$(pwd)/.tmp\" vitest run",
    "build": "TMPDIR=\"$(pwd)/.tmp\" vite build",
    "any-command": "TMPDIR=\"$(pwd)/.tmp\" <command>"
  }
}
```

**Why this is better:**

- ✅ Keeps config files clean and portable
- ✅ Environment-specific logic stays in execution layer (package.json)
- ✅ Tool configurations remain standard and shareable
- ✅ Separation of concerns: execution environment vs tool configuration

### 3. Tool Configuration Files (AVOID IF POSSIBLE)

**Only use this approach if TMPDIR doesn't work:**

Configure build tools to use project-local directories:

**Vitest/Vite:**

```typescript
import { resolve } from "path";

export default defineConfig({
  cacheDir: resolve(__dirname, ".vitest-cache"), // ⚠️ Only if TMPDIR insufficient
  test: {
    coverage: {
      reportsDirectory: resolve(__dirname, "coverage"), // ⚠️ Only if needed
    },
  },
});
```

**⚠️ Note:** This couples your config to the execution environment. Prefer TMPDIR in package.json scripts.

**Webpack/Other bundlers:**

- Set `cache.cacheDirectory` to project-local path
- Set output paths to project directories

### 4. Gitignore Updates

Always add local temp/cache directories to `.gitignore`:

```gitignore
.tmp/
.cache/
.vitest-cache/
.webpack-cache/
coverage/
dist/
```

### 5. Node Modules Cache Issues

If you encounter npm/yarn cache issues:

```bash
# Clear npm cache to project-local directory
npm cache clean --force
npm config set cache "$(pwd)/.npm-cache"

# Or use TMPDIR workaround
TMPDIR="$(pwd)/.tmp" npm install
```

## Common EPERM Error Patterns

### Pattern 1: Test Framework Errors

```
Error: EPERM: operation not permitted, mkdir '/var/folders/.../T/...'
```

**Solution:** Add `TMPDIR="$(pwd)/.tmp"` to test scripts

### Pattern 2: Build Tool Errors

```
Error: EPERM: operation not permitted, mkdir '/tmp/...'
```

**Solution:** Configure tool's cache directory to project root

### Pattern 3: npm install Errors

```
Error: EPERM: operation not permitted, open '/var/folders/...'
```

**Solution:** Use `TMPDIR="$(pwd)/.tmp" npm install` or configure npm cache

## Default Response Protocol

When you encounter an EPERM error:

1. **Identify the tool** causing the error (vitest, webpack, npm, etc.)
2. **Check if TMPDIR workaround** is applied in package.json scripts
3. **Check tool configuration** for cache/temp directory settings
4. **Update .gitignore** to exclude new local directories
5. **Test the fix** by running the failing command

## Never Do This ❌

- Don't suggest using `sudo` - it won't work in Antigravity
- Don't suggest changing system permissions
- Don't suggest using `/tmp/` or other system directories
- Don't create workarounds that write outside the project directory

## Always Do This ✅

- Configure tools to use project-local directories
- Use `TMPDIR` environment variable for commands
- Update `.gitignore` for new cache/temp directories
- Test that temp files are created in project root
- Document the workaround in package.json or config files with comments
