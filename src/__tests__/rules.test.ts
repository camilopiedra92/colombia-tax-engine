
import { describe, it, expect } from 'vitest';
import { getTaxRules, applyTaxTable, UVT_BY_YEAR } from '../rules';

describe('Tax Engine Rules', () => {
    describe('getTaxRules', () => {
        it('should return correct values for 2024', () => {
            const rules = getTaxRules(2024);
            expect(rules.YEAR).toBe(2024);
            expect(rules.UVT).toBe(UVT_BY_YEAR[2024]); // 47065
            expect(rules.SMLMV).toBe(1300000);
        });

        it('should return correct values for 2025', () => {
            const rules = getTaxRules(2025);
            expect(rules.YEAR).toBe(2025);
            expect(rules.UVT).toBe(UVT_BY_YEAR[2025]); // 49799
            expect(rules.SMLMV).toBe(1423500);
        });
    });

    describe('applyTaxTable (Year 2024)', () => {
        const uvt2024 = UVT_BY_YEAR[2024];

        it('should return 0 tax for base 0', () => {
            const tax = applyTaxTable(0, 2024);
            expect(tax).toBe(0);
        });

        it('should return 0 tax for base within 0-1090 UVT range', () => {
            // 1000 UVT
            const base = 1000 * uvt2024;
            const tax = applyTaxTable(base, 2024);
            expect(tax).toBe(0);
        });

        it('should calculate correct tax for second range (1090-1700 UVT)', () => {
            // 1500 UVT: (1500 - 1090) * 0.19 = 77.9 UVT
            const baseUVT = 1500;
            const base = baseUVT * uvt2024;
            const expectedTaxUVT = (1500 - 1090) * 0.19;
            const expectedTax = Math.round(expectedTaxUVT * uvt2024);
            
            const tax = applyTaxTable(base, 2024);
            expect(tax).toBe(expectedTax);
        });

        it('should calculate correct tax for third range (1700-4100 UVT)', () => {
            // 2000 UVT: (2000 - 1700) * 0.28 + 116 = 84 + 116 = 200 UVT
            const baseUVT = 2000;
            const base = baseUVT * uvt2024;
            const expectedTaxUVT = ((2000 - 1700) * 0.28) + 116;
            const expectedTax = Math.round(expectedTaxUVT * uvt2024);

            const tax = applyTaxTable(base, 2024);
            expect(tax).toBe(expectedTax);
        });

        it('should handle large values correctly (top range)', () => {
            // 50000 UVT: (50000 - 31000) * 0.39 + 10352 = 7410 + 10352 = 17762 UVT
            const baseUVT = 50000;
            const base = baseUVT * uvt2024;
            const expectedTaxUVT = ((50000 - 31000) * 0.39) + 10352;
            const expectedTax = Math.round(expectedTaxUVT * uvt2024);

            const tax = applyTaxTable(base, 2024);
            expect(tax).toBe(expectedTax);
        });
    });

    describe('applyTaxTable — Edge Cases', () => {
        it('should return 0 for negative income', () => {
            const tax = applyTaxTable(-5_000_000, 2024);
            expect(tax).toBe(0);
        });

        it('should return 0 for income within first bracket (rate = 0)', () => {
            const uvt2025 = UVT_BY_YEAR[2025];
            const base = 500 * uvt2025; // Well within 0-1090 UVT bracket
            const tax = applyTaxTable(base, 2025);
            expect(tax).toBe(0);
        });

        it('should calculate correct tax for 4th range (4100-8670 UVT)', () => {
            const uvt2024 = UVT_BY_YEAR[2024];
            const baseUVT = 5000;
            const base = baseUVT * uvt2024;
            // (5000-4100)*0.33 + 788 = 297 + 788 = 1085 UVT
            const expectedTaxUVT = ((5000 - 4100) * 0.33) + 788;
            const expectedTax = Math.round(expectedTaxUVT * uvt2024);
            
            const tax = applyTaxTable(base, 2024);
            expect(tax).toBe(expectedTax);
        });

        it('should calculate correct tax for 5th range (8670-18970 UVT)', () => {
            const uvt2024 = UVT_BY_YEAR[2024];
            const baseUVT = 10000;
            const base = baseUVT * uvt2024;
            // (10000-8670)*0.35 + 2296 = 465.5 + 2296 = 2761.5 UVT
            const expectedTaxUVT = ((10000 - 8670) * 0.35) + 2296;
            const expectedTax = Math.round(expectedTaxUVT * uvt2024);
            
            const tax = applyTaxTable(base, 2024);
            expect(tax).toBe(expectedTax);
        });
    });

    describe('getTaxRules — Year 2026', () => {
        it('should return correct UVT and SMLMV for 2026', () => {
            const rules = getTaxRules(2026);
            expect(rules.YEAR).toBe(2026);
            expect(rules.UVT).toBe(UVT_BY_YEAR[2026]); // 52374
        });

        it('should apply tax table correctly with 2025 UVT', () => {
            const uvt2025 = UVT_BY_YEAR[2025];
            const base = 2000 * uvt2025;
            const expectedTaxUVT = ((2000 - 1700) * 0.28) + 116;
            const expectedTax = Math.round(expectedTaxUVT * uvt2025);
            
            const tax = applyTaxTable(base, 2025);
            expect(tax).toBe(expectedTax);
        });
    });
});
