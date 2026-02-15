# Colombian Tax Engine 🇨🇴

> **Portable and Reusable Colombian Tax Calculator**
>
> Enterprise-grade implementation of Colombian tax law for natural persons (Formulario 210 - Declaración de Renta Personas Naturales).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg?logo=vitest&logoColor=white)](./src/__tests__)
[![Tests](https://img.shields.io/badge/Tests-251_passed-success?logo=vitest&logoColor=white)](./src/__tests__)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg?logo=npm&logoColor=white)](./package.json)
[![Node Version](https://img.shields.io/badge/Node-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Code Style](https://img.shields.io/badge/Code_Style-TypeScript_Strict-blue)](./tsconfig.json)

## 🌟 Features

- ✅ **Complete Tax Calculation**: Implements all tax schedules (General, Pensiones, Dividendos, Ganancia Ocasional)
- ✅ **Fully Compliant**: Based on Estatuto Tributario + Ley 2277/2022
- ✅ **100% Test Coverage**: 17 comprehensive test suites
- ✅ **Zero Dependencies**: Pure TypeScript, no external runtime dependencies
- ✅ **Type-Safe**: Full TypeScript support with detailed type definitions
- ✅ **Optimized**: Includes "God Level" optimizations (ICA automatic selection, dividend discount lock)
- ✅ **Portable**: Can be used in any TypeScript/Node.js project

## 📦 Installation

### As a Local Package

```bash
# From your project root
npm install file:./packages/colombia-tax-engine
```

### As a Git Submodule

```bash
git submodule add <repository-url> packages/colombia-tax-engine
cd packages/colombia-tax-engine
npm install
```

## 🚀 Quick Start

```typescript
import { TaxEngine, TaxPayer } from "@tax-optimizer/colombia-tax-engine";

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
      grossValue: 120000000,
      healthContribution: 4800000,
      pensionContribution: 4800000,
      withholdingTax: 8500000,
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

## 📚 Implemented Tax Law

### Normativa Completa

- **Estatuto Tributario (ET)**: Art. 55-57, 115, 119, 126-1/4, 188, 206, 241, 242, 245, 254-260-1, 261-286, 292-3, 295-3, 299-317, 330-337, 387, 592-594, 807-809
- **Ley 2277/2022**: Consolidación dividendos, límite 1340 UVT, factura electrónica, impuesto patrimonio
- **Ley 2010/2019**: Renta presuntiva 0%
- **Ley 2380/2024**: Descuento donaciones alimentos 37%
- **DUR 1625/2016**: IBC independientes
- **Decreto 2229/2023**: Calendario vencimientos

### Tax Schedules

1. **Cédula General** (Art. 330-336): Labor income, capital income, independent services
2. **Cédula de Pensiones** (Art. 337): Pension income with exemptions
3. **Cédula de Dividendos** (Art. 242, Ley 2277): Dividend taxation with consolidation
4. **Ganancia Ocasional** (Art. 299-317): Occasional gains (assets, inheritances, lotteries)
5. **Impuesto al Patrimonio** (Art. 292-3): Wealth tax for patrimony ≥ 72,000 UVT

### Special Optimizations

#### 🎯 ICA Optimization

Automatically determines whether ICA (Industria y Comercio) is better as:

- **Cost** (100% deductible from taxable base), or
- **Tax Credit** (50% direct discount from tax)

The engine always chooses the optimal route (typically tax credit).

#### 🔒 Dividend Discount Lock

Ensures the 19% dividend discount never exceeds the marginal tax attributable to dividends, preventing artificial refunds.

## 📖 API Reference

### Main Class: `TaxEngine`

#### `TaxEngine.calculate(payer: TaxPayer): TaxResult`

Calculates the complete tax return for a taxpayer.

**Parameters:**

- `payer`: Complete taxpayer information (see `TaxPayer` interface)

**Returns:**

- `TaxResult`: Complete tax calculation with all schedules, taxes, credits, and final balance

### Key Types

- **`TaxPayer`**: Input data structure (taxpayer, incomes, deductions, assets, liabilities)
- **`TaxResult`**: Complete calculation result
- **`IncomeCategory`**: All income types (labor, pensions, dividends, etc.)
- **`DeductionCategory`**: All deduction types
- **`TaxCreditCategory`**: All tax credit types
- **`TaxYear`**: 2024 | 2025 | 2026

See [USAGE.md](./USAGE.md) for detailed examples and migration guide.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Coverage**: 100% across all metrics (statements, branches, functions, lines)

## 📝 Documentation

- [USAGE.md](./USAGE.md) - Comprehensive usage guide with examples
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [/src/types.ts](./src/types.ts) - Complete type definitions
- [/src/rules.ts](./src/rules.ts) - Tax rules and constants

## 🏗️ Project Structure

```
packages/colombia-tax-engine/
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
│   └── __tests__/            # 17 comprehensive test suites
├── examples/                 # Usage examples
├── package.json
├── tsconfig.json
└── vitest.config.mts
```

## 🤝 Contributing

Contributions are welcome! This project aims to be the most accurate and comprehensive Colombian tax engine available.

Please read our [Contributing Guidelines](./CONTRIBUTING.md) before submitting pull requests.

### Quick Guidelines

- Zero runtime dependencies
- 100% test coverage required
- Full compliance with Colombian tax law
- TypeScript strict mode
- All tests must pass before merging

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Related

- [DIAN - Dirección de Impuestos y Aduanas Nacionales](https://www.dian.gov.co/)
- [Estatuto Tributario](https://estatuto.co/)
- [Gerencie.com - Tax Resources](https://www.gerencie.com/)

---

**Made with ❤️ for Colombian taxpayers**
