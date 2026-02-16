import { describe, it, expect } from 'vitest';
import { calculatePatrimonioTax } from '../calculators/patrimonio-impuesto';
import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

const YEAR = 2024;
const rules = getTaxRules(YEAR);
const { UVT } = rules;

describe('Patrimonio Tax - Sorting Logic', () => {
  it('should sort housing assets by value descending to maximize exclusion', () => {
    // Create 2 housing assets
    // House A: Value 5,000 UVT (less than limit 12,000)
    // House B: Value 10,000 UVT (less than limit 12,000)
    // Total Housing: 15,000 UVT.
    // Exclusion Limit: 12,000 UVT.

    // If we pick House A first: Exclusion = 5,000.
    // If we pick House B first: Exclusion = 10,000. -> BETTER for user.

    // However, the code sorts descending.
    // So it should pick House B (10,000).
    // Exclusion = 10,000.

    const payer: TaxPayer = {
      id: '1',
      year: YEAR,
      name: 'Test',
      isResident: true,
      dependentsCount: 0,
      incomes: [],
      deductions: [],
      assets: [
        {
          id: 'h1',
          category: 'inmueble',
          description: 'Apartamento Menor',
          value: 5000 * UVT,
          cadastralValue: 5000 * UVT,
        },
        {
          id: 'h2',
          category: 'inmueble',
          description: 'Casa Mayor',
          value: 10000 * UVT,
          cadastralValue: 10000 * UVT,
        },
      ],
      liabilities: [],
      taxCredits: [],
    };

    // Total Patrimonio = 15,000 UVT.
    // Tax threshold is 72,000 UVT.
    // We need to force it to calculate tax?
    // calculatePatrimonioTax receives `patrimonioLiquido`.
    // But the function internally accesses `payer.assets` to recalculate exclusion.

    // Let's pass a huge patrimonioLiquido > 72,000 to trigger calculation.
    const result = calculatePatrimonioTax(payer, 100000 * UVT);

    // Expected Taxable Base = 100,000 - Exclusion.
    // Exclusion should be 10,000 (House B) not 5,000 (House A).
    const expectedBase = (100000 - 10000) * UVT;

    expect(result.taxableBase).toBe(expectedBase);
  });

  it('should use fiscalCost vs cadastralValue correctly for sorting', () => {
    // House A: Fiscal 100, Cadastral 200 -> Value 200
    // House B: Fiscal 150, Cadastral 100 -> Value 150
    // Should pick House A because 200 > 150.

    const payer: TaxPayer = {
      id: '1',
      year: YEAR,
      name: 'Test',
      isResident: true,
      dependentsCount: 0,
      incomes: [],
      deductions: [],
      assets: [
        {
          id: 'h1',
          category: 'inmueble',
          description: 'Casa A',
          value: 0,
          fiscalCost: 100 * UVT,
          cadastralValue: 200 * UVT, // Effective 200
        },
        {
          id: 'h2',
          category: 'inmueble',
          description: 'Casa B',
          value: 0,
          fiscalCost: 150 * UVT,
          cadastralValue: 100 * UVT, // Effective 150
        },
      ],
      liabilities: [],
      taxCredits: [],
    };

    const result = calculatePatrimonioTax(payer, 100000 * UVT);
    const expectedBase = (100000 - 200) * UVT;
    expect(result.taxableBase).toBeCloseTo(expectedBase);
  });

  it('should use fallback values (value, 0) when fiscalCost/cadastralValue are missing', () => {
    const payer: TaxPayer = {
      id: '1',
      year: YEAR,
      name: 'Test',
      isResident: true,
      dependentsCount: 0,
      incomes: [],
      deductions: [],
      assets: [
        {
          id: 'h1',
          category: 'inmueble',
          description: 'Casa A',
          value: 200 * UVT, // No fiscal, no cadastral. Use value.
        },
        {
          id: 'h2',
          category: 'inmueble',
          description: 'Casa B',
          value: 150 * UVT,
          // Missing cadastral -> 0.
          // Missing fiscal -> value.
        },
      ],
      liabilities: [],
      taxCredits: [],
    };

    // Should sort A (200) > B (150).
    // Exclusion = 200.
    const result = calculatePatrimonioTax(payer, 100000 * UVT);
    const expectedBase = (100000 - 200) * UVT;
    // Check exclusion applied correctly
    expect(result.taxableBase).toBe(expectedBase);
  });
});
