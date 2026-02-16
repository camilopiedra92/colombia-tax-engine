# 🔧 Troubleshooting Guide

## Installation Issues

### `ERR_MODULE_NOT_FOUND`

**Problem:** Module not found after installation.

**Solution:**
```bash
# Ensure the package is installed
npm ls colombia-tax-engine

# If not listed, reinstall
npm install colombia-tax-engine
```

### TypeScript types not resolving

**Problem:** TypeScript can't find type definitions.

**Solution:** Ensure your `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "moduleResolution": "node" // or "bundler"
  }
}
```

### Peer dependency warning for TypeScript

**Problem:** npm warns about TypeScript peer dependency.

**Solution:** This is informational only. TypeScript is an optional peer dependency. The package works fine without TypeScript installed (you just won't get type checking).

---

## Runtime Issues

### `TaxPayer validation error`

**Problem:** Engine throws validation error on input.

**Solution:** Verify your `TaxPayer` object:
```typescript
const taxpayer: TaxPayer = {
  id: "required",           // Non-empty string
  name: "required",         // Non-empty string
  year: 2026,              // 2024 | 2025 | 2026
  isResident: true,         // boolean
  dependentsCount: 0,       // >= 0
  incomes: [],             // Array (can be empty)
  deductions: [],          // Array (can be empty)
  assets: [],              // Array (can be empty)
  liabilities: [],         // Array (can be empty)
};
```

### Unexpected tax calculation results

**Problem:** Tax result doesn't match expected value.

**Steps to debug:**
1. Verify UVT value for the tax year
2. Check income categories are correct
3. Review deduction limits (Art. 336 ET: 1340 UVT cap)
4. Verify withholding tax amounts
5. Compare with [DIAN simulator](https://www.dian.gov.co/)

### NaN or Infinity in results

**Problem:** Calculation returns NaN or Infinity.

**Solution:** Ensure all numeric values in your input are valid numbers (not `undefined`, `null`, or `NaN`):
```typescript
// ❌ Bad
grossValue: undefined

// ✅ Good
grossValue: 0
```

---

## Build Issues

### TypeScript compilation errors

```bash
# Clear build artifacts
rm -rf dist

# Rebuild
npm run build
```

### Test failures after upgrade

```bash
# Clear cache
rm -rf node_modules .vitest-cache .tmp

# Fresh install
npm install

# Run tests
npm test
```

---

## Getting Help

If your issue isn't covered here:

1. Search [existing issues](https://github.com/camilopiedra92/colombia-tax-engine/issues)
2. Check the [FAQ](./FAQ.md)
3. Open a [new issue](https://github.com/camilopiedra92/colombia-tax-engine/issues/new/choose)
