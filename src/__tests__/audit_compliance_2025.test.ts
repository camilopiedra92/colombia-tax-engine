import { describe, it, expect } from 'vitest';
import { TaxEngine } from '../index';
import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

const rules = getTaxRules(2025);
const UVT = rules.UVT;

describe('Audit Compliance 2025 - Critical Fixes', () => {
  // A. La Base del Límite del 40% NO está restando los Costos (general.ts)
  it('Bug A: Should subtract costs AND CAN income from the 40% limit base', () => {
    // Scenario:
    // Income: 3000 UVT (Honorarios)
    // Costs: 1000 UVT
    // INCR: 0
    //
    // Wrong Calc: Base = 3000. Limit 40% = 1200.
    // Correct Calc: Base = (3000 - 1000) = 2000. Limit 40% = 800.
    //
    // Deductions: 1000 UVT
    // Wrong: Deductible = 1000 (since 1000 < 1200)
    // Correct: Deductible = 800 (cap at 800)

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [
        {
          category: 'honorarios',
          grossValue: 3000 * UVT,
          costs: 1000 * UVT,
          preferCostsOverExemption: true,
        },
      ],
      deductions: [
        { category: 'otras_deducciones', value: 1000 * UVT, description: 'Gastos varios' },
      ],
    };

    const result = TaxEngine.calculate(payer);
    const general = result.cedulaGeneral;

    // Expected:
    // Net Income = 3000 - 1000 = 2000
    // Limit 40% of 2000 = 800
    // Total Deductions Claimed = 1000
    // Accepted Deductions = min(1000, 800) = 800
    // Taxable Income = 2000 - 800 = 1200

    expect(general.globalLimit).toBeCloseTo(800 * UVT, -1);
    expect(general.acceptedClaims).toBeCloseTo(800 * UVT, -1);
    expect(general.taxableIncome).toBeCloseTo(1200 * UVT, -1);
  });

  // B. La Trampa del ICA: "Double-Dipping" Involuntario (index.ts)
  it('Bug B: Should optimize ICA (Cost vs Discount) and prevent double dipping', () => {
    // Scenario:
    // Income: 10,000 UVT
    // ICA Paid: 100 UVT
    //
    // Option 1 (Cost): Net Income = 9900. Tax on 9900.
    // Option 2 (Discount): Net Income = 10000. Tax on 10000 - (100 * 50% = 50 discount).
    //
    // The engine should pick the best one.
    // AND CRITICALLY: If picking Discount, it MUST add the discount to taxCredits
    // and NOT subtract it from costs (or add it back if it was in costs).

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [
        {
          category: 'honorarios',
          grossValue: 10000 * UVT,
          icaPaid: 100 * UVT, // ICA Paid
          costs: 0,
        },
      ],
      deductions: [],
    };

    const result = TaxEngine.calculate(payer);

    // In high income brackets (39%), Taking 100 as cost saves ~39 tax.
    // Taking 50 as discount saves 50 tax.
    // Discount (50) > Cost Benefit (39).
    // Should choose Discount.

    // Check if discount is applied
    const discount = result.totalTaxCredits;
    expect(discount).toBeGreaterThan(0);
    expect(discount).toBeCloseTo(50 * UVT, -1);
  });

  // C. Contaminación de la Ganancia Ocasional (index.ts)
  it('Bug C: Should NOT apply ordinary discounts to Ganancia Ocasional tax', () => {
    // Scenario:
    // Ordinary Tax: 0 (No income)
    // Ganancia Ocasional Tax: 1000
    // Discounts (Donations): 500
    //
    // Wrong: Total Tax = 1000 - 500 = 500
    // Correct: Total Tax = 1000. (Discounts only apply to Ordinary Tax, which is 0)

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [
        {
          category: 'ganancia_ocasional',
          grossValue: 10000 * UVT, // ~1500 Tax
          costBasis: 0,
          description: 'Venta activo < 2 años? No, > 2 años default',
          heldDurationDays: 800,
        },
      ],
      deductions: [
        // Donation 1000 -> 250 discount
        { category: 'donaciones', value: 1000 * UVT },
      ],
    };

    const result = TaxEngine.calculate(payer);

    // Ordinary Tax should be 0
    // GO Tax should be ~1500 (15% of 10000)
    // Discounts should be limited to Ordinary Tax (0)

    // Note: rules says donation discount is 25% of value.
    const expectedGoTax = 10000 * UVT * 0.15; // 15% rate

    expect(result.gananciaOcasional.totalTax).toBeCloseTo(expectedGoTax, -1);
    expect(result.netIncomeTax).toBe(0); // Ordinary tax
    expect(result.totalIncomeTax).toBeCloseTo(expectedGoTax, -1);

    // The final tax due should be exactly GO Tax (no discount applied)
    // Don't check totalTaxDue directly as it triggers anticipo calc logic which might vary
    // Check totalTaxesWithGO equivalent logic
    const calculatedTotal = result.netIncomeTax + result.gananciaOcasional.totalTax;
    expect(calculatedTotal).toBeCloseTo(expectedGoTax, -1);
  });

  // D. Factura Electrónica al 100% (general.ts)
  it('Bug D: Should apply 1% limit to Electronic Invoice deduction', () => {
    // Invoice value: 1000 UVT
    // Deduction should be: 10 UVT (1%)
    // NOT 1000 UVT.

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [{ category: 'renta_trabajo', grossValue: 5000 * UVT }],
      deductions: [{ category: 'factura_electronica', value: 1000 * UVT }],
    };

    const result = TaxEngine.calculate(payer);
    const general = result.cedulaGeneral;

    expect(general.facturaElectronica).toBeCloseTo(10 * UVT, -1);
  });

  // E. Concurrencia Ilegal de Dependientes para Independientes
  test('Bug E: Should ALLOW Art. 387/Ley 2277 deduction for Independents who take costs (Auditor Fix)', () => {
    // Explanation: The auditor clarified that independents CAN take costs AND dependents.
    // Previous logic forced it to 0. New logic allows it.
    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      dependentsCount: 1,
      incomes: [
        {
          category: 'honorarios',
          grossValue: 5000 * UVT,
          costs: 1000 * UVT,
          preferCostsOverExemption: true, // Takes costs
        },
      ],
      deductions: [],
    };

    const result = TaxEngine.calculate(payer);
    const general = result.cedulaGeneral;

    // Deductions:
    // Should have 72 UVT (Ley 2277) -> DEPENDENTS_PER_UVT
    // Should NOT have 10% (Art 387)

    // acceptedClaims includes restricted + unrestricted.
    // Let's trace back deduction components if possible, or infer from total.

    // We can check totalDeductions (which includes Art 387 but not the 72 UVT usually in logic?)
    // In current logic:
    // dependentsDeductionLey2277 is separate (added to acceptedClaims)
    // dependentsDeductionArt387 is added to totalDeductions

    // FIX: Auditor Logic says they CAN take it.
    // The engine should now calculate the optimal deduction.
    // In this case (1 dependent), it picks the better of 10% vs 72 UVT.
    // 10% of 200,000,000 = 20,000,000. Cap 32 UVT/mo = 384 UVT = ~18M.
    // 72 UVT = ~3.4M.
    // So it should pick Art 387 (approx 19M).
    // expect(general.totalDeductions).toBeGreaterThan(0);

    // Validating optimal choice:
    const expectedArt387 = 384 * UVT; // Annual Cap for Art 387
    expect(general.acceptedClaims).toBeCloseTo(expectedArt387, -1);
  });

  // F. El Loop de Herencias y Donaciones (ganancia-ocasional.ts)
  it('Bug F: Should apply Herencia Exemptions to the AGGREGATE, not per item', () => {
    // 3 herencias of 2000 UVT each. Total 6000.
    // Limit per heir: 3250 UVT.
    //
    // Wrong: min(2000, 3250) + min(2000, 3250) + min(2000, 3250) = 6000 Exemption.
    // Correct: min(6000, 3250) = 3250 Exemption.

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [
        {
          category: 'ganancia_ocasional',
          description: 'Herencia Efectivo',
          grossValue: 2000 * UVT,
          heldDurationDays: 800,
        },
        {
          category: 'ganancia_ocasional',
          description: 'Herencia Joyas',
          grossValue: 2000 * UVT,
          heldDurationDays: 800,
        },
        {
          category: 'ganancia_ocasional',
          description: 'Herencia Carro',
          grossValue: 2000 * UVT,
          heldDurationDays: 800,
        },
      ],
      deductions: [],
    };

    const result = TaxEngine.calculate(payer);
    const go = result.gananciaOcasional;

    expect(go.grossIncome).toBeCloseTo(6000 * UVT, -1);
    expect(go.exemptions).toBeCloseTo(3250 * UVT, -1);
    expect(go.taxableIncome).toBeCloseTo((6000 - 3250) * UVT, -1);
  });
});

describe('Audit Compliance 2025 - God Level Optimizations', () => {
  // Opt 1: Dividend Lock (Candado Ampliado)
  it('Opt 1: Should cap Dividend Discount at the specific Dividend Tax amount', () => {
    // Scenario:
    // General Tax: 1000
    // Dividend Tax (Sub1): 100
    // Dividend Discount calculated (19% of base): 200
    //
    // Current Logic: Discount = 200. Net Dividend Tax = 0. Remaining Discount = 100.
    // Remaining 100 reduces General Tax to 900.
    //
    // "God Level" Logic: Discount Cap = 100 (Dividend Tax).
    // Net Dividend Tax = 0.
    // General Tax stays 1000. No cross-subsidization.

    // Difficult to mock exact marginals easily without reverse engineering,
    // but we can check if subCedula1.discount19 <= subCedula1.tax + subCedula2.additionalTax

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [
        { category: 'renta_trabajo', grossValue: 5000 * UVT }, // Generates basic tax
        { category: 'dividendos', grossValue: 5000 * UVT, dividendType: '2017_adelante_gravado' }, // Generates sub1
      ],
      deductions: [],
    };

    const result = TaxEngine.calculate(payer);
    const div = result.cedulaDividendos.subCedula1;

    // The discount should not exceed the tax generated by dividends
    // Actually the audit says: "Debes ampliarlo a marginalSub1 + marginalSub2"
    // So we test that logic specifically if we have sub2.

    const limit = div.tax; // + subCedula2.additionalTax (0 here)
    expect(div.discount19).toBeLessThanOrEqual(limit + 0.1); // Float tolerance
  });

  // Opt 3: Annual Housing Interest Limit (1200 UVT)
  it('Opt 3: Should cap Housing Interest at 1200 UVT annually', () => {
    // Scenario:
    // Interest Paid: 2000 UVT
    // Months: 12
    //
    // Old Logic: 100 UVT * 12 = 1200. (Same)
    //
    // Scenario 2:
    // Interest Paid: 1500 UVT
    // Months: 6
    //
    // Old Logic: 100 UVT * 6 = 600 Limit. Deduction = 600.
    // New Logic: 1200 UVT Absolute Annual Limit. Deduction = min(1500, 1200) = 1200.
    // The audit says "La mensualización solo aplica para la nómina... no para la declaración anual."

    const payer: TaxPayer = {
      id: '123',
      year: 2025,
      assets: [],
      liabilities: [],
      incomes: [{ category: 'renta_trabajo', grossValue: 5000 * UVT }],
      deductions: [{ category: 'intereses_vivienda', value: 1500 * UVT, monthsReported: 6 }],
    };

    const result = TaxEngine.calculate(payer);

    // Should be capped at 1200, NOT 600.
    // And definitely not 1500.
    expect(result.cedulaGeneral.totalDeductions).toBeCloseTo(1200 * UVT, -1);
  });
});
