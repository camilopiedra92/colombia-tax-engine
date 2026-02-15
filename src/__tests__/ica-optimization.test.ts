import { describe, it, expect } from 'vitest';
import { TaxEngine } from '../index';
import { TaxPayer } from '../types';

const basePayer: TaxPayer = {
    id: 'ICA-TEST',
    name: 'ICA User',
    year: 2024,
    declarationYearCount: 1,
    isResident: true,
    dependentsCount: 0,
    incomes: [],
    deductions: [],
    assets: [],
    liabilities: [],
    taxCredits: []
};

describe('TaxEngine — ICA Optimization Coverage', () => {

    it('should prefer ICA as discount (50% credit) normally', () => {
        // Normal Scenario: Max Tax 39% < 50% Discount
        const payer = {
            ...basePayer,
            incomes: [{
                id: 'inc1', category: 'honorarios' as const,
                grossValue: 100_000_000,
                preferCostsOverExemption: true,
                costs: 10_000_000, 
                icaPaid: 2_000_000,
                description: 'Honorarios con ICA'
            }]
        };

        const result = TaxEngine.calculate(payer);
        // Discount wins
        expect(result.totalTaxCredits).toBeGreaterThanOrEqual(1_000_000);
    });



    it('should handle multiple incomes with ICA', () => {
        const payer = {
            ...basePayer,
            incomes: [
                {
                    id: '1', category: 'honorarios' as const,
                    grossValue: 50_000_000,
                    icaPaid: 500_000,
                    description: 'Inc 1'
                },
                {
                    id: '2', category: 'renta_no_laboral' as const,
                    grossValue: 50_000_000,
                    icaPaid: 500_000,
                    description: 'Inc 2'
                }
            ]
        };
        const result = TaxEngine.calculate(payer);
        expect(result.totalTaxCredits).toBeGreaterThanOrEqual(500_000);
    });

    it('should handle undefined taxCredits gracefully', () => {
        const payer: TaxPayer = {
            ...basePayer,
            taxCredits: undefined, // Now valid
            incomes: [{
                id: 'inc_undef', category: 'honorarios' as const,
                grossValue: 100_000_000, // Increase to ensure tax > 0
                icaPaid: 100_000,
                description: 'Inc'
            }]
        };
        const result = TaxEngine.calculate(payer);
        expect(result.totalTaxCredits).toBeGreaterThan(0);
    });
});
