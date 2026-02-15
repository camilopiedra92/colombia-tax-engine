# Usage Guide - Colombian Tax Engine

This guide provides detailed examples and usage patterns for the Colombian Tax Engine.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Income Categories](#income-categories)
3. [Deductions and Exemptions](#deductions-and-exemptions)
4. [Tax Credits](#tax-credits)
5. [Assets and Liabilities](#assets-and-liabilities)
6. [Advanced Examples](#advanced-examples)
7. [Migration Guide](#migration-guide)

## Basic Usage

### Minimal Example

```typescript
import { TaxEngine, TaxPayer } from "@tax-optimizer/colombia-tax-engine";

const taxpayer: TaxPayer = {
  id: "1234567890",
  name: "María García",
  year: 2026,
  isResident: true,
  dependentsCount: 0,
  incomes: [],
  deductions: [],
  assets: [],
  liabilities: [],
};

const result = TaxEngine.calculate(taxpayer);
console.log("Obligated to file?", result.isObligatedToFile);
```

## Income Categories

### Labor Income (Renta de Trabajo)

```typescript
const salaryIncome = {
  id: "salary-2026",
  description: "Salario Empresa ABC",
  category: "renta_trabajo",
  grossValue: 150000000,
  healthContribution: 6000000, // 4% employee
  pensionContribution: 6000000, // 4% employee
  solidarityFund: 1500000, // FSP if > 4 SMLMV
  withholdingTax: 12000000, // Withholding tax
};
```

### Independent Services (Honorarios)

```typescript
const honorariosIncome = {
  id: "fees-2026",
  description: "Honorarios Consultoría",
  category: "honorarios",
  grossValue: 80000000,
  costs: 20000000, // Deductible costs
  healthContribution: 3200000,
  pensionContribution: 3200000,
  withholdingTax: 4000000,
  hasMoreThanOneEmployee: false, // Affects 25% exemption
  preferCostsOverExemption: false, // false = use 25% exemption
};
```

### Pension Income

```typescript
const pensionIncome = {
  id: "pension-2026",
  description: "Pensión de Jubilación",
  category: "pensiones",
  grossValue: 60000000,
  numberOfMesadas: 13, // 13 or 14 mesadas
  // First 1,000 UVT/month is exempt
};
```

### Dividend Income

#### Sub-cédula 1: Ordinary Dividends

```typescript
const dividendIncome = {
  id: "div-2026",
  description: "Dividendos Empresa XYZ SA",
  category: "dividendos_ordinarios",
  grossValue: 100000000,
  // Consolidated with other schedules
  // 19% discount applies above 1,090 UVT
};
```

#### Sub-cédula 2: Taxed Dividends

```typescript
const taxedDividendIncome = {
  id: "div-taxed-2026",
  description: "Dividendos No Gravados en Sociedad",
  category: "dividendos_gravados",
  grossValue: 50000000,
  // Taxed at 35% + marginal rate on remainder
};
```

### Capital Income

```typescript
const rentalIncome = {
  id: "rent-2026",
  description: "Arrendamiento Apartamento",
  category: "renta_capital",
  grossValue: 36000000,
  costs: 5000000, // Maintenance, admin fees
  withholdingTax: 1080000, // 3.5% withholding
};
```

### Occasional Gains

#### Asset Sale

```typescript
const assetSaleIncome = {
  id: "house-sale-2026",
  description: "Venta Apartamento",
  category: "ganancia_ocasional",
  grossValue: 500000000,
  costBasis: 350000000, // Fiscal cost
  holdingPeriodYears: 3, // > 2 years = occasional gain
  // First 5,000 UVT exempt for primary residence
};
```

#### Lottery/Prizes

```typescript
const lotteryIncome = {
  id: "lottery-2026",
  description: "Premio Baloto",
  category: "loteria_premios",
  grossValue: 10000000,
  withholdingLotteries: 2000000, // 20% withholding
  // Taxed at 20% rate
};
```

### Severance (Cesantías)

```typescript
const severanceIncome = {
  id: "cesantias-2026",
  description: "Cesantías Liquidadas",
  category: "cesantias",
  grossValue: 15000000,
  averageMonthlySalary: 4000000, // Avg last 6 months
  // Exempt if avg monthly salary ≤ 350 UVT
};
```

### Foreign Source Income

```typescript
const foreignIncome = {
  id: "us-salary-2026",
  description: "Salary from US Company",
  category: "renta_no_laboral",
  grossValue: 200000000, // Already in COP
  isForeignSource: true,
  foreignTaxPaid: 30000000, // Tax paid abroad (USD converted)
  foreignCurrencyValue: 50000, // USD value
  exchangeRate: 4000, // TRM
  // Can claim foreign tax credit
};
```

## Deductions and Exemptions

### Dependents

```typescript
const dependentsDeduction = {
  id: "dependents-2026",
  category: "dependientes",
  description: "2 Dependientes (72 UVT c/u)",
  value: 7542720, // 72 UVT × 2 × 52,374
};

// Also set in taxpayer:
taxpayer.dependentsCount = 2; // Max 4
```

### Health Prepaid / Insurance

```typescript
const healthDeduction = {
  id: "health-2026",
  category: "salud_prepagada",
  description: "Medicina Prepagada",
  value: 9000000,
  monthsReported: 12,
  // Limit: 16 UVT/month
};
```

### Housing Interest

```typescript
const housingDeduction = {
  id: "housing-interest-2026",
  category: "intereses_vivienda",
  description: "Intereses Crédito Hipotecario",
  value: 15000000,
  monthsReported: 12,
  // Limit: 100 UVT/month (1,200 UVT/year)
};
```

### Electronic Invoice

```typescript
const invoiceDeduction = {
  id: "invoice-2026",
  category: "factura_electronica",
  description: "Factura Electrónica",
  value: 1200000,
  // 1% of purchases, max 240 UVT
  // EXCLUDED from 40%/1,340 UVT limit
};
```

### GMF (4x1000)

```typescript
const gmfDeduction = {
  id: "gmf-2026",
  category: "gmf",
  description: "GMF Pagado",
  value: 500000,
  // 50% of 4×1000 paid is deductible
};
```

### AFC (Voluntary Savings)

```typescript
const afcExemption = {
  id: "afc-2026",
  category: "afc",
  description: "Aportes AFC",
  value: 25000000,
  // 30% of income, max 3,800 UVT
};
```

### FPV (Voluntary Pension Fund)

```typescript
const fpvExemption = {
  id: "fpv-2026",
  category: "fpv",
  description: "Fondo Pensión Voluntaria",
  value: 20000000,
  // 30% of income,max 3,800 UVT
  // NOTE: This is Renta Exenta, NOT INCR
};
```

### 25% Labor Exemption

This is calculated automatically by the engine for eligible labor income. Set:

```typescript
honorariosIncome.preferCostsOverExemption = false; // Use 25% exemption
// Eligible if hasMoreThanOneEmployee = false
// Limit: 790 UVT/year
```

## Tax Credits

Tax credits reduce the tax directly (not the taxable base).

### Foreign Tax Credit

```typescript
const foreignTaxCredit = {
  id: "us-tax-2026",
  category: "impuesto_exterior",
  description: "Impuesto Pagado en USA",
  value: 25000000,
  // Proportional to foreign net income
};
```

### Donations

```typescript
// General donations: 25%
const donationCredit = {
  id: "donation-2026",
  category: "donacion_general",
  description: "Donación Cruz Roja",
  value: 5000000, // 25% of this = credit
};

// Food donations: 37% (2025+)
const foodDonationCredit = {
  id: "food-donation-2026",
  category: "donacion_alimentos",
  description: "Donación Banco de Alimentos",
  value: 10000000, // 37% of this = credit
};
```

### ICA Optimization (Automatic)

The engine automatically handles ICA optimization:

```typescript
const incomeWithICA = {
  id: "business-2026",
  category: "renta_no_laboral",
  grossValue: 100000000,
  costs: 40000000,
  icaPaid: 2000000, // ICA paid
  // Engine simulates: Cost vs Tax Credit (50%)
  // Always chooses optimal (usually Tax Credit)
};
```

## Assets and Liabilities

### Assets

#### Real Estate

```typescript
const houseAsset = {
  id: "house-2026",
  category: "inmueble",
  description: "Apartamento Bogotá",
  value: 400000000, // Fiscal cost
  cadastralValue: 420000000, // Catastral value
  // Engine takes max(fiscal, catastral)
};
```

#### Bank Accounts

```typescript
const bankAsset = {
  id: "savings-2026",
  category: "cuenta_bancaria",
  description: "Cuenta Ahorros Bancolombia",
  value: 50000000,
};
```

#### Foreign Assets

```typescript
const foreignAsset = {
  id: "us-account-2026",
  category: "cuenta_exterior",
  description: "Cuenta USA",
  value: 80000000, // Already in COP
  isForeign: true,
  exchangeRate: 4000, // TRM Dec 31
};
```

### Liabilities

```typescript
const mortgage = {
  id: "mortgage-2026",
  description: "Hipoteca Apartamento",
  value: 150000000, // Balance at Dec 31
  debtType: "hipotecario",
};

const creditCard = {
  id: "cc-2026",
  description: "Tarjeta Crédito",
  value: 5000000,
  debtType: "tarjeta_credito",
};
```

## Advanced Examples

### Complete Taxpayer with Multiple Income Sources

```typescript
const completeTaxpayer: TaxPayer = {
  id: "1234567890",
  name: "Carlos Rodríguez",
  year: 2026,
  isResident: true,
  isVATResponsible: true,
  dependentsCount: 2,

  // Previous year data for advance calculation
  previousYearTax: 15000000,
  previousYearAdvance: 11250000, // 75% of previous
  declarationYearCount: 3, // Third year+ = 75% advance

  incomes: [
    // Salary
    {
      id: "salary",
      description: "Salario Principal",
      category: "renta_trabajo",
      grossValue: 180000000,
      healthContribution: 7200000,
      pensionContribution: 7200000,
      solidarityFund: 1800000,
      withholdingTax: 15000000,
    },
    // Independent services
    {
      id: "consulting",
      description: "Consultoría",
      category: "honorarios",
      grossValue: 60000000,
      costs: 15000000,
      healthContribution: 2400000,
      pensionContribution: 2400000,
      withholdingTax: 3000000,
      hasMoreThanOneEmployee: false,
      preferCostsOverExemption: false,
    },
    // Rental income
    {
      id: "rental",
      description: "Arrendamiento",
      category: "renta_capital",
      grossValue: 48000000,
      costs: 8000000,
      withholdingTax: 1680000,
    },
    // Dividends
    {
      id: "dividends",
      description: "Dividendos",
      category: "dividendos_ordinarios",
      grossValue: 80000000,
    },
  ],

  deductions: [
    {
      id: "dependents",
      category: "dependientes",
      description: "Dependientes",
      value: 7542720,
    },
    {
      id: "health",
      category: "salud_prepagada",
      description: "Medicina Prepagada",
      value: 10000000,
      monthsReported: 12,
    },
    {
      id: "mortgage-int",
      category: "intereses_vivienda",
      description: "Intereses Hipoteca",
      value: 18000000,
      monthsReported: 12,
    },
    {
      id: "gmf",
      category: "gmf",
      description: "GMF",
      value: 600000,
    },
    {
      id: "afc",
      category: "afc",
      description: "AFC",
      value: 30000000,
    },
  ],

  assets: [
    {
      id: "house",
      category: "inmueble",
      description: "Casa",
      value: 500000000,
      cadastralValue: 520000000,
    },
    {
      id: "savings",
      category: "cuenta_bancaria",
      description: "Ahorros",
      value: 80000000,
    },
    {
      id: "car",
      category: "vehiculo",
      description: "Vehículo",
      value: 60000000,
    },
  ],

  liabilities: [
    {
      id: "mortgage",
      description: "Hipoteca",
      value: 200000000,
      debtType: "hipotecario",
    },
  ],

  taxCredits: [
    {
      id: "donation",
      category: "donacion_alimentos",
      description: "Donación Alimentos",
      value: 5000000,
    },
  ],
};

const result = TaxEngine.calculate(completeTaxpayer);

// Access results
console.log("General Schedule Tax:", result.cedulaGeneral.tax);
console.log("Dividend Tax:", result.cedulaDividendos.totalTax);
console.log("Total Income Tax:", result.totalIncomeTax);
console.log("Tax Credits:", result.totalTaxCredits);
console.log("Net Income Tax:", result.netIncomeTax);
console.log("Balance to Pay:", result.balanceToPay);
console.log("Filing Deadline:", result.filingDeadline);
```

## Migration Guide

### From Embedded Engine to Standalone Package

If migrating from the embedded `lib/tax-engine/`, update your imports:

**Before:**

```typescript
import { TaxEngine } from "@/lib/tax-engine";
import type { TaxPayer } from "@/lib/tax-engine/types";
```

**After:**

```typescript
import { TaxEngine, TaxPayer } from "@tax-optimizer/colombia-tax-engine";
```

All types and classes are now exported from the main package entry point.

### Breaking Changes

None - this is the same engine, just packaged standalone.

### Compatibility

- ✅ Node.js 18+
- ✅ TypeScript 5.0+
- ✅ ES2020+

---

For more information, see [README.md](./README.md)
