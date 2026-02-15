
import { describe, it, expect } from 'vitest';
import { calculateGeneralSchedule } from '../calculators/general';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('General Schedule Calculator', () => {
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

    it('should calculate basic salary net income correctly', () => {
        // 100M salary, 4M health, 4M pension
        const incomeValue = 100000000;
        const health = 4000000;
        const pension = 4000000;

        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: '1',
                description: 'Salary',
                category: 'renta_trabajo',
                grossValue: incomeValue,
                healthContribution: health,
                pensionContribution: pension,
                solidarityFund: 0
            }]
        };

        const result = calculateGeneralSchedule(payer);

        expect(result.grossIncome).toBe(incomeValue);
        expect(result.incrTotal).toBe(health + pension);
        expect(result.netIncome).toBe(incomeValue - health - pension);
        expect(result.costs).toBe(0);
    });

    it('should apply 25% exempt income limit (790 UVT)', () => {
        // High salary to trigger 790 UVT limit
        // Net Income = 200M
        // 25% = 50M
        // 790 UVT = 790 * 47065 = 37,181,350
        // Expected Exempt = 37,181,350
        
        const incomeValue = 200000000 + 8000000; // Add back INCR to get ~200M Net
        const health = 4000000;
        const pension = 4000000;

        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: '1',
                description: 'High Salary',
                category: 'renta_trabajo',
                grossValue: incomeValue,
                healthContribution: health,
                pensionContribution: pension
            }]
        };

        const result = calculateGeneralSchedule(payer);

        const expectedLimit = 790 * UVT;
        // Total exemptions might include other things if default, but here only 25% applies
        // However, result.totalExemptions includes 25%.
        // limit is global 40% vs absolute.
        // Let's check specifically that the 25% calculation capped at limit.
        // Since we can't inspect internal variables, we infer from totalExemptions.
        expect(result.totalExemptions).toBe(expectedLimit);
    });

    it('should exclude Electronic Invoice deduction from 40% limit', () => {
        // Setup a case where 40% limit is reached by other deductions
        const incomeValue = 100_000_000; // Net 100M approx
        // 40% = 40M.
        // Add 50M in deductions (should be capped at 40M)
        // Add 1M electronic invoice (should be ADDED on top of 40M)

        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: '1',
                category: 'renta_trabajo',
                description: 'Salary',
                grossValue: 100_000_000,
                healthContribution: 0,
                pensionContribution: 0
            }],
            deductions: [
                { id: 'd1', category: 'intereses_vivienda', description: 'Interest', value: 50_000_000 },
                { id: 'd2', category: 'factura_electronica', description: 'Invoice', value: 1_000_000 }
            ]
        };

        const result = calculateGeneralSchedule(payer);
        
        // Net Income = 100M
        // Global Limit = 40M (min of 40% and 1340 UVT)
        // Claims Subject to Limit = 50M (Interest) + ~25% Exempt (25M) = 75M
        // Limited Claims = 40M
        // Accepted Claims = 40M + 1M (Electronic Invoice) = 41M
        
        const netIncome = 100_000_000;
        const limit40 = netIncome * 0.40; // 40M
        // 1340 UVT = 63M > 40M. So limit is 40M.

        expect(result.globalLimit).toBe(limit40);
        expect(result.facturaElectronica).toBe(1_000_000);
        
        // acceptedClaims should include the electronic invoice exceeding the limit
        // Claims subject to limit: 50M (interest) + 25M (25% labor exempt) = 75M.
        // These get capped at 40M.
        // Then + 1M Invoice.
        // Total = 41M.
        expect(result.acceptedClaims).toBe(limit40 + 1_000_000);
    });

    it('should correctly handle independent costs vs 25% exemption', () => {
        // Case 1: Independent chooses costs (preferCostsOverExemption: true)
        const payerCosts: TaxPayer = {
             ...mockPayerBase,
             incomes: [{
                 id: 'i1',
                 category: 'honorarios',
                 description: 'Services',
                 grossValue: 50_000_000,
                 costs: 20_000_000,
                 preferCostsOverExemption: true
             }]
        };

        const resCosts = calculateGeneralSchedule(payerCosts);
        expect(resCosts.costs).toBe(20_000_000);
        // Should NOT have 25% exemption because they are mutually exclusive for Honorarios?
        // Code says: eligibleIncomes = labor + (honorarios IF !preferCosts).
        // So here eligibleIncomes is empty.
        expect(resCosts.totalExemptions).toBe(0);


        // Case 2: Independent chooses 25% exemption (preferCostsOverExemption: false)
        const payerExempt: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'i1',
                category: 'honorarios',
                description: 'Services',
                grossValue: 50_000_000,
                costs: 20_000_000, // Should be ignored
                preferCostsOverExemption: false
            }]
       };
       const resExempt = calculateGeneralSchedule(payerExempt);
       expect(resExempt.costs).toBe(0);
       // Should have 25% exemption
       // Base ~ 50M. 25% = 12.5M.
       expect(resExempt.totalExemptions).toBeGreaterThan(0);
    });
});
