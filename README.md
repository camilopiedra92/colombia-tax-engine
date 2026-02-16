# Colombian Tax Engine 🇨🇴

> **Enterprise-grade Colombian Tax Calculator**
>
> The most accurate and comprehensive implementation of Colombian tax law for natural persons (Formulario 210 - Declaración de Renta Personas Naturales).

[![npm version](https://img.shields.io/npm/v/colombia-tax-engine?color=cb0000&logo=npm)](https://www.npmjs.com/package/colombia-tax-engine)
[![npm downloads](https://img.shields.io/npm/dm/colombia-tax-engine?color=blue&logo=npm)](https://www.npmjs.com/package/colombia-tax-engine)
[![CI](https://img.shields.io/github/actions/workflow/status/camilopiedra92/colombia-tax-engine/ci.yml?branch=main&label=CI&logo=github)](https://github.com/camilopiedra92/colombia-tax-engine/actions/workflows/ci.yml)
[![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg?logo=vitest&logoColor=white)](./src/__tests__)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg?logo=npm&logoColor=white)](./package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

**📖 [Documentation](./USAGE.md)** · **❓ [FAQ](./FAQ.md)** · **🐛 [Report Bug](https://github.com/camilopiedra92/colombia-tax-engine/issues/new?template=bug_report.yml)** · **✨ [Request Feature](https://github.com/camilopiedra92/colombia-tax-engine/issues/new?template=feature_request.yml)** · **🗺️ [Roadmap](./ROADMAP.md)**

---

## 🌟 Features

| Feature | Status |
| ------- | ------ |
| Complete Formulario 210 calculation | ✅ |
| General, Pensiones, Dividendos, Ganancia Ocasional schedules | ✅ |
| Impuesto al Patrimonio (wealth tax) | ✅ |
| ICA automatic optimization (cost vs. tax credit) | ✅ |
| Dividend Discount Lock (Ley 2277/2022) | ✅ |
| Year-versioned rules (2024, 2025, 2026) | ✅ |
| Filing obligation detection | ✅ |
| Filing deadline calculation | ✅ |
| Anticipo calculation | ✅ |
| 100% test coverage (251 tests) | ✅ |
| Zero runtime dependencies | ✅ |
| Full TypeScript support | ✅ |
| Tree-shakeable exports | ✅ |

## 📦 Installation

```bash
npm install colombia-tax-engine
```

```bash
# Yarn
yarn add colombia-tax-engine

# pnpm
pnpm add colombia-tax-engine
```

## 🚀 Quick Start

```typescript
import { TaxEngine, TaxPayer } from "colombia-tax-engine";

const taxpayer: TaxPayer = {
  id: "1234567890",
  name: "Juan Pérez",
  year: 2026,
  isResident: true,
  dependentsCount: 2,
  incomes: [
    {
      id: "salary-1",
      description: "Salario Empresa XYZ",
      category: "renta_trabajo",
      grossValue: 120_000_000,
      healthContribution: 4_800_000,
      pensionContribution: 4_800_000,
      withholdingTax: 8_500_000,
    },
  ],
  deductions: [],
  assets: [],
  liabilities: [],
};

const result = TaxEngine.calculate(taxpayer);

console.log("Impuesto neto:", result.netIncomeTax);
console.log("Saldo a pagar:", result.balanceToPay);
console.log("Obligado a declarar:", result.isObligatedToFile);
```

## 📚 Tax Law Coverage

### Normativa Implementada

| Norma | Artículos | Descripción |
| ----- | --------- | ----------- |
| **Estatuto Tributario** | Art. 55-57, 115, 119, 126-1/4, 188, 206, 241, 242, 245, 254-260-1, 261-286, 292-3, 295-3, 299-317, 330-337, 387, 592-594, 807-809 | Base normativa completa |
| **Ley 2277/2022** | — | Consolidación dividendos, límite 1340 UVT |
| **Ley 2010/2019** | — | Renta presuntiva 0% |
| **Ley 2380/2024** | — | Descuento donaciones alimentos 37% |
| **DUR 1625/2016** | — | IBC independientes |
| **Decreto 2229/2023** | — | Calendario vencimientos |

### Tax Schedules

1. **Cédula General** (Art. 330-336): Labor income, capital, independent services
2. **Cédula de Pensiones** (Art. 337): Pension income with exemptions
3. **Cédula de Dividendos** (Art. 242, Ley 2277): Dividend taxation with consolidation
4. **Ganancia Ocasional** (Art. 299-317): Occasional gains
5. **Impuesto al Patrimonio** (Art. 292-3): Wealth tax ≥ 72,000 UVT

### Special Optimizations

#### 🎯 ICA Optimization (Automatic)

Determines whether ICA is better as **cost** (100% deductible) or **tax credit** (50% discount). Always picks the optimal route.

#### 🔒 Dividend Discount Lock

Ensures the 19% dividend discount never exceeds marginal tax attributable to dividends, preventing artificial refunds.

## 📖 API Reference

### `TaxEngine.calculate(payer: TaxPayer): TaxResult`

Calculates the complete tax return for a taxpayer.

```typescript
import { TaxEngine, TaxPayer, TaxResult } from "colombia-tax-engine";

const result: TaxResult = TaxEngine.calculate(taxpayer);
```

### Key Types

| Type | Description |
| ---- | ----------- |
| `TaxPayer` | Input data structure |
| `TaxResult` | Complete calculation result |
| `IncomeCategory` | All income types |
| `DeductionCategory` | All deduction types |
| `TaxCreditCategory` | All tax credit types |
| `TaxYear` | `2024 \| 2025 \| 2026` |

📖 See [USAGE.md](./USAGE.md) for detailed examples, advanced scenarios, and migration guide.

## 🧪 Testing

```bash
npm test              # Run all tests (251 tests)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report (100%)
```

## 🛠️ Development

```bash
npm run build         # Compile TypeScript
npm run typecheck     # Type check without emit
npm run lint          # ESLint
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier
npm run format:check  # Prettier check
npm run docs          # Generate API docs
npm run size          # Bundle size analysis
npm run validate      # Full validation (types + lint + test + build)
```

## 🏗️ Project Structure

```
colombia-tax-engine/
├── src/
│   ├── index.ts              # Main TaxEngine class
│   ├── types.ts              # Type definitions
│   ├── rules.ts              # Tax rules & constants
│   ├── calculators/          # Specialized calculators
│   │   ├── general.ts
│   │   ├── pensiones.ts
│   │   ├── dividendos.ts
│   │   ├── ganancia-ocasional.ts
│   │   ├── descuentos.ts
│   │   ├── anticipo.ts
│   │   ├── obligados.ts
│   │   └── patrimonio-impuesto.ts
│   └── __tests__/            # 17 test suites
├── .github/
│   ├── workflows/            # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/       # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── examples/                 # Usage examples
├── docs/                     # Generated API docs
├── USAGE.md                  # Comprehensive usage guide
├── CONTRIBUTING.md           # Contribution guidelines
├── SECURITY.md               # Security policy
├── FAQ.md                    # Frequently asked questions
├── ROADMAP.md                # Development roadmap
└── CHANGELOG.md              # Version history
```

## 📝 Documentation

| Document | Description |
| -------- | ----------- |
| [USAGE.md](./USAGE.md) | Comprehensive usage guide with examples |
| [FAQ.md](./FAQ.md) | Frequently asked questions |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [SECURITY.md](./SECURITY.md) | Security policy |
| [ROADMAP.md](./ROADMAP.md) | Development roadmap |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community guidelines |

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting PRs.

**Requirements:**
- Zero runtime dependencies
- 100% test coverage
- TypeScript strict mode
- Conventional commits
- Tax law references

## 🔒 Security

Found a vulnerability? Please read our [Security Policy](./SECURITY.md) for responsible disclosure.

## 📄 License

[MIT](./LICENSE) © Tax Optimizer Team

## 🔗 Resources

- [DIAN](https://www.dian.gov.co/) - Dirección de Impuestos y Aduanas Nacionales
- [Estatuto Tributario](https://estatuto.co/) - Colombian Tax Code
- [Gerencie.com](https://www.gerencie.com/) - Tax Resources

---

<p align="center"><b>Made with ❤️ for Colombian taxpayers</b></p>
