# Antigravity Agent Quick Reference

## 🚨 EPERM Errors - Immediate Actions

When you see: `Error: EPERM: operation not permitted, mkdir '/var/folders/...'`

**DO THIS IMMEDIATELY:**

1. Add `TMPDIR="$(pwd)/.tmp"` to the failing npm script in package.json
2. Run `.agent/scripts/fix-eperm.sh` helper script
3. Check tool config files for cache directory settings
4. Update .gitignore with new temp directories

**READ THIS:** `.agent/rules/eperm-and-cache.md` for complete guide

**USE THIS:** `.agent/workflows/fix-eperm.md` for step-by-step fix

## 🔄 Node Cache Issues - Immediate Actions

When dependencies are corrupted or cache is stale:

```bash
# Quick cache clear
rm -rf .tmp .vitest-cache .npm-cache coverage node_modules
TMPDIR="$(pwd)/.tmp" npm install
```

**USE THIS:** `.agent/workflows/node-cache-clear.md` for guided process

## 📋 Common Patterns

### Pattern: New Build Tool Added

```typescript
// In tool config (vite.config.ts, webpack.config.js, etc.)
import { resolve } from "path";

export default {
  cacheDir: resolve(__dirname, ".tool-cache"),
  // ...
};
```

### Pattern: New npm Script

```json
{
  "scripts": {
    "new-script": "TMPDIR=\"$(pwd)/.tmp\" some-command"
  }
}
```

### Pattern: Update .gitignore

```gitignore
.tmp/
.<tool>-cache/
```

## 🎯 Key Principles

1. **Never use system temp directories** - Always use project-local
2. **Always set TMPDIR** - For any command that might create temp files
3. **Configure cache dirs** - In all build tool configs
4. **Update .gitignore** - For every new local directory
5. **Test in project root** - Verify temp files are created locally

## 📁 Agent Files Structure

```
.agent/
├── rules/
│   └── eperm-and-cache.md          # Detailed rules and guidelines
├── workflows/
│   ├── fix-eperm.md                # Step-by-step EPERM fix
│   └── node-cache-clear.md         # Cache clearing procedure
└── scripts/
    └── fix-eperm.sh                # Diagnostic helper script
```

## 🔍 Troubleshooting Decision Tree

```
EPERM Error?
├─ Yes → Read: .agent/rules/eperm-and-cache.md
│        Follow: .agent/workflows/fix-eperm.md
│        Run: .agent/scripts/fix-eperm.sh
│
└─ Cache Issues?
   └─ Yes → Follow: .agent/workflows/node-cache-clear.md
```

## ⚡ Quick Commands

```bash
# Run diagnostic helper
.agent/scripts/fix-eperm.sh

# Clear all caches
rm -rf .tmp .vitest-cache .npm-cache coverage node_modules

# Reinstall with workaround
TMPDIR="$(pwd)/.tmp" npm install

# Run tests with workaround
TMPDIR="$(pwd)/.tmp" npm test
```

## 📚 Related Documentation

- **Main Rule:** `.agent/rules/eperm-and-cache.md`
- **EPERM Fix:** `.agent/workflows/fix-eperm.md`
- **Cache Clear:** `.agent/workflows/node-cache-clear.md`
- **Helper Script:** `.agent/scripts/fix-eperm.sh`
