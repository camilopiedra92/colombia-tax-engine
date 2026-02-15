
import { describe, it, expect } from 'vitest';
import { checkObligadoDeclarar } from '../calculators/obligados';
import { calculateAnticipo } from '../calculators/anticipo';
import { calculateDescuentos } from '../calculators/descuentos';
import { TaxPayer, TaxCredit } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('Tax Utilities Tests', () => {
    const mockPayerBase: TaxPayer = {
        id: '123',
        name: 'Test',
        year: YEAR,
        declarationYearCount: 1,
        isResident: true,
        dependentsCount: 0,
        incomes: [],
        deductions: [],
        assets: [],
        liabilities: [],
        taxCredits: []
    };

    describe('Obligados a Declarar (Art. 592-594 ET)', () => {
        it('should NOT be obligated if all values are below thresholds', () => {
            const payer = { ...mockPayerBase }; // Empty values
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(false);
        });

        it('should be obligated if Gross Income > 1400 UVT', () => {
            const income = 1401 * UVT; // Strictly ABOVE threshold
            const payer: TaxPayer = {
                ...mockPayerBase,
                incomes: [{ id: 'i1', category: 'renta_trabajo', description: 'Salary', grossValue: income }]
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
            expect(result.thresholds.ingresosBrutos.exceeds).toBe(true);
        });

        it('should be obligated if Gross Equity > 4500 UVT', () => {
            const wealth = 4501 * UVT; // Strictly ABOVE threshold
            const payer: TaxPayer = {
                ...mockPayerBase,
                assets: [{ id: 'a1', category: 'otro_activo', description: 'Other asset', value: wealth }]
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
            expect(result.thresholds.patrimonioBruto.exceeds).toBe(true);
        });

        it('should be obligated if Credit Card consumption > 1400 UVT', () => {
            const cons = 1401 * UVT; // Strictly ABOVE threshold
            const payer: TaxPayer = {
                ...mockPayerBase,
                creditCardExpenses: cons
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
        });
    });

    describe('Anticipo de Renta (Art. 807 ET)', () => {
        it('should calculate 25% for Year 1', () => {
            const netTax = 10_000_000;
            const withholding = 0;
            const payer: TaxPayer = { ...mockPayerBase, declarationYearCount: 1 };
            
            const result = calculateAnticipo(payer, netTax, withholding);
            
            expect(result.percentage).toBe(0.25);
            expect(result.anticipoNextYear).toBe(2_500_000);
        });

        it('should calculate 50% for Year 2 (Lower of Option 1 vs 2)', () => {
            // Option 1: Current Tax * 50%
            // Option 2: Avg(Current, Prev) * 50%
            
            const currentTax = 10_000_000;
            const prevTax = 20_000_000; // High previous tax makes Opt 2 higher
            // Avg = 15M.
            
            const payer: TaxPayer = { 
                ...mockPayerBase, 
                declarationYearCount: 2,
                previousYearTax: prevTax 
            };
            
            const result = calculateAnticipo(payer, currentTax, 0);
            
            expect(result.percentage).toBe(0.50);
            // Opt 1: 5M vs Opt 2: 7.5M. Choose 5M.
            expect(result.anticipoNextYear).toBe(5_000_000);
        });

        it('should calculate 75% for Year 3+', () => {
            const currentTax = 10_000_000;
            const payer: TaxPayer = { ...mockPayerBase, declarationYearCount: 3 };
            
            const result = calculateAnticipo(payer, currentTax, 0);
            expect(result.percentage).toBe(0.75);
            // Option 1: 10M * 0.75 = 7.5M
            // Option 2: Avg(10M, 0) * 0.75 = 3.75M
            // Result is Min(Opt1, Opt2) = 3.75M
            expect(result.anticipoNextYear).toBe(3_750_000);
        });

        it('should subtract withholding from anticipo', () => {
            // Year 1: 25% of 10M = 2.5M. Withholding = 1M. Result = 1.5M.
            const payer: TaxPayer = { ...mockPayerBase, declarationYearCount: 1 };
            const result = calculateAnticipo(payer, 10_000_000, 1_000_000);
            expect(result.anticipoNextYear).toBe(1_500_000);
        });
    });

    describe('Descuentos Tributarios (Art. 254+ ET)', () => {
        it('should limit donations to 25% of basic income tax', () => {
            // Tax: 100M. Limit 25% = 25M.
            // Donation: 200M. Credit 25% of val = 50M.
            // Result should be capped at 25M.
            
            const tax = 100_000_000;
            const donationVal = 200_000_000;
            
            const payer: TaxPayer = {
                ...mockPayerBase,
                taxCredits: [{ 
                    id: 'c1', 
                    category: 'donacion_general', 
                    description: 'Fundacion', 
                    value: donationVal 
                }]
            };

            const result = calculateDescuentos(payer, tax, 0, tax);
            
            // Raw donation credit = 200M * 0.25 (assuming rule pct) = 50M.
            // Group limit = 100M * 0.25 = 25M.
            // Expected allowed = 25M.
            
            expect(result.totalCredits).toBe(25_000_000);
        });

        it('should limit foreign tax credit to total Colombian tax', () => {
            // Foreign Tax Paid: 50M. Colombian Tax: 40M.
            // All income is foreign (foreignNetIncome = totalTaxableIncome = 40M)
            // Proportional limit = (40M / 40M) * 40M = 40M
            // Credit = min(50M, 40M, 40M) = 40M
            
            const tax = 40_000_000;
            const payer: TaxPayer = {
                ...mockPayerBase,
                taxCredits: [{ 
                    id: 'c2', 
                    category: 'impuesto_exterior', 
                    description: 'Foreign tax',
                    value: 50_000_000 
                }]
            };

            // foreignNetIncome = totalTaxableIncome = tax → 100% foreign
            const result = calculateDescuentos(payer, tax, tax, tax);
            expect(result.foreignTaxCredit).toBe(40_000_000);
            expect(result.totalCredits).toBe(40_000_000);
        });
    });

    // ═══ Additional Obligados Tests ═══
    describe('Obligados — Additional Branches', () => {
        it('should be obligated if totalPurchases > 1400 UVT', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                totalPurchases: 1401 * UVT,
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
            expect(result.thresholds.comprasConsumos.exceeds).toBe(true);
        });

        it('should be obligated if bankDeposits > 1400 UVT', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                bankDeposits: 1401 * UVT,
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
            expect(result.thresholds.consignaciones.exceeds).toBe(true);
        });

        it('should be obligated if isVATResponsible is true', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                isVATResponsible: true,
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
            expect(result.reasons).toContain('Es responsable del impuesto sobre las ventas (IVA)');
        });

        it('should NOT be obligated at exactly the threshold (strict >)', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                incomes: [{ id: 'i1', category: 'renta_trabajo', description: 'Salary', grossValue: 1400 * UVT }],
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(false);
        });

        it('should report multiple reasons when exceeding multiple thresholds', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                incomes: [{ id: 'i1', category: 'renta_trabajo', description: 'Salary', grossValue: 1401 * UVT }],
                assets: [{ id: 'a1', category: 'otro_activo', description: 'Asset', value: 4501 * UVT }],
                creditCardExpenses: 1401 * UVT,
            };
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
            expect(result.reasons.length).toBeGreaterThanOrEqual(3);
        });
    });

    // ═══ Additional Anticipo Tests ═══
    describe('Anticipo — Additional Branches', () => {
        it('should floor anticipo at 0 when withholding exceeds calculated amount', () => {
            const payer: TaxPayer = { ...mockPayerBase, declarationYearCount: 1 };
            // 25% of 10M = 2.5M, withholding = 5M → anticipo = max(0, -2.5M) = 0
            const result = calculateAnticipo(payer, 10_000_000, 5_000_000);
            expect(result.anticipoNextYear).toBe(0);
        });

        it('should choose option 2 when it is lower (Year 3+)', () => {
            const currentTax = 20_000_000;
            const prevTax = 5_000_000; // Low previous tax makes avg lower
            // Avg = (20M + 5M)/2 = 12.5M
            // Opt1: 20M * 0.75 = 15M
            // Opt2: 12.5M * 0.75 = 9.375M
            // Min(15M, 9.375M) = 9.375M → rounds to 9375000
            const payer: TaxPayer = {
                ...mockPayerBase,
                declarationYearCount: 3,
                previousYearTax: prevTax,
            };
            const result = calculateAnticipo(payer, currentTax, 0);
            expect(result.anticipoNextYear).toBe(9_375_000);
            expect(result.method).toBe('third_year_plus');
        });

        it('should pass through previousYearAdvance', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                declarationYearCount: 1,
                previousYearAdvance: 3_000_000,
            };
            const result = calculateAnticipo(payer, 10_000_000, 0);
            expect(result.anticipoPreviousYear).toBe(3_000_000);
        });

        it('should handle Year 2 with no previousYearTax (defaults to 0)', () => {
            const payer: TaxPayer = {
                ...mockPayerBase,
                declarationYearCount: 2,
                // No previousYearTax → defaults to 0
            };
            // Opt1: 10M * 0.50 = 5M
            // Opt2: avg(10M,0)*0.50 = 2.5M
            // Min(5M,2.5M) = 2.5M
            const result = calculateAnticipo(payer, 10_000_000, 0);
            expect(result.anticipoNextYear).toBe(2_500_000);
            expect(result.method).toBe('second_year');
        });

        it('should calculate Year 1 with large withholding (floor at 0)', () => {
            const payer: TaxPayer = { ...mockPayerBase, declarationYearCount: 1 };
            const result = calculateAnticipo(payer, 1_000_000, 10_000_000);
            // 25% of 1M = 250K - 10M → negative → 0
            expect(result.anticipoNextYear).toBe(0);
        });
    });
});
