/**
 * Comprehensive Tests for calculateDescuentos — Coverage Completion
 * 
 * Covers:
 *  - R&D investment credit (inversion_id)
 *  - IVA on fixed assets (iva_activos_fijos)
 *  - otro_descuento category
 *  - donacion_alimentos year-specific rates (2024 vs 2025/2026)
 *  - Group limit (donations + R&D ≤ 25% of basic tax)
 *  - No credits → zero result
 *  - Credits exceeding total tax → capped
 *  - All credit types combined
 */

import { describe, it, expect } from 'vitest';
import { calculateDescuentos } from '../calculators/descuentos';
import { TaxPayer, TaxCredit } from '../types';

function basePayer(overrides: Partial<TaxPayer> = {}): TaxPayer {
    return {
        id: '1234567890',
        name: 'Test User',
        year: 2025,
        declarationYearCount: 3,
        isResident: true,
        dependentsCount: 0,
        incomes: [],
        deductions: [],
        assets: [],
        liabilities: [],
        taxCredits: [],
        ...overrides,
    };
}

function makeCredit(overrides: Partial<TaxCredit>): TaxCredit {
    return {
        id: 'credit-1',
        category: 'otro_descuento',
        description: 'Test Credit',
        value: 0,
        ...overrides,
    };
}

describe('calculateDescuentos — Coverage Completion', () => {

    describe('No Credits', () => {
        it('should return zeros when no credits exist', () => {
            const payer = basePayer();
            const result = calculateDescuentos(payer, 10_000_000, 0, 50_000_000);
            expect(result.totalCredits).toBe(0);
            expect(result.foreignTaxCredit).toBe(0);
            expect(result.donationsGeneral).toBe(0);
            expect(result.donationsFood).toBe(0);
            expect(result.rdInvestment).toBe(0);
            expect(result.ivaFixedAssets).toBe(0);
            expect(result.otherCredits).toBe(0);
        });
    });

    describe('Foreign Tax Credit (Art. 254)', () => {
        it('should calculate proportional limit correctly', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'impuesto_exterior',
                    value: 5_000_000,
                })],
            });
            // Foreign net income = 20M out of 100M total, tax = 10M
            // Proportional limit = (20/100)*10M = 2M
            const result = calculateDescuentos(payer, 10_000_000, 20_000_000, 100_000_000);
            expect(result.foreignTaxCredit).toBe(2_000_000);
        });

        it('should limit to actual foreign tax paid when lower', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'impuesto_exterior',
                    value: 1_000_000, // Lower than proportional limit
                })],
            });
            const result = calculateDescuentos(payer, 10_000_000, 50_000_000, 100_000_000);
            expect(result.foreignTaxCredit).toBe(1_000_000);
        });

        it('should return 0 when totalTaxableIncome is 0', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'impuesto_exterior',
                    value: 5_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 10_000_000, 20_000_000, 0);
            expect(result.foreignTaxCredit).toBe(0);
        });

        it('should not exceed totalIncomeTax', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'impuesto_exterior',
                    value: 50_000_000,
                })],
            });
            // proportional = (100/100)*5M = 5M, but totalIncomeTax = 5M
            const result = calculateDescuentos(payer, 5_000_000, 100_000_000, 100_000_000);
            expect(result.foreignTaxCredit).toBe(5_000_000);
        });
    });

    describe('R&D Investment Credit (Art. 256)', () => {
        it('should calculate 30% of investment value', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'inversion_id',
                    value: 10_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.rdInvestment).toBe(3_000_000); // 30% of 10M
        });
    });

    describe('IVA Fixed Assets (Art. 258-2)', () => {
        it('should include full IVA amount as credit', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'iva_activos_fijos',
                    value: 8_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.ivaFixedAssets).toBe(8_000_000);
        });
    });

    describe('Other Credits (otro_descuento)', () => {
        it('should include other credits', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'otro_descuento',
                    value: 3_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.otherCredits).toBe(3_000_000);
        });
    });

    describe('Donation - General (Art. 257)', () => {
        it('should calculate 25% of donation value', () => {
            const payer = basePayer({
                taxCredits: [makeCredit({
                    category: 'donacion_general',
                    value: 20_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.donationsGeneral).toBe(5_000_000); // 25% of 20M
        });
    });

    describe('Donation - Food (Ley 2380/2024)', () => {
        it('should apply 25% for year 2024', () => {
            const payer = basePayer({
                year: 2024,
                taxCredits: [makeCredit({
                    category: 'donacion_alimentos',
                    value: 10_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.donationsFood).toBe(2_500_000); // 25% of 10M
        });

        it('should apply 37% for year 2025', () => {
            const payer = basePayer({
                year: 2025,
                taxCredits: [makeCredit({
                    category: 'donacion_alimentos',
                    value: 10_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.donationsFood).toBe(3_700_000); // 37% of 10M
        });

        it('should apply 37% for year 2026', () => {
            const payer = basePayer({
                year: 2026,
                taxCredits: [makeCredit({
                    category: 'donacion_alimentos',
                    value: 10_000_000,
                })],
            });
            const result = calculateDescuentos(payer, 100_000_000, 0, 100_000_000);
            expect(result.donationsFood).toBe(3_700_000); // 37% of 10M
        });
    });

    describe('Group Limit (Art. 258)', () => {
        it('should cap donations + R&D at 25% of basic income tax', () => {
            const payer = basePayer({
                taxCredits: [
                    makeCredit({ id: 'don', category: 'donacion_general', value: 100_000_000 }),
                    makeCredit({ id: 'rd', category: 'inversion_id', value: 100_000_000 }),
                ],
            });
            // totalIncomeTax = 10M
            // donationsGeneral = 25% of 100M = 25M
            // rdInvestment = 30% of 100M = 30M
            // group = 55M, but group limit = 25% of 10M = 2.5M
            const result = calculateDescuentos(payer, 10_000_000, 0, 100_000_000);
            expect(result.totalCredits).toBeLessThanOrEqual(2_500_000);
        });
    });

    describe('Global Limit', () => {
        it('should cap total credits at totalIncomeTax', () => {
            const payer = basePayer({
                taxCredits: [
                    makeCredit({ id: 'iva', category: 'iva_activos_fijos', value: 50_000_000 }),
                    makeCredit({ id: 'other', category: 'otro_descuento', value: 50_000_000 }),
                ],
            });
            const result = calculateDescuentos(payer, 5_000_000, 0, 100_000_000);
            // totalCredits = 50M + 50M = 100M, but capped at totalIncomeTax = 5M
            expect(result.totalCredits).toBe(5_000_000);
        });
    });

    describe('All Credit Types Combined', () => {
        it('should handle mixed credits correctly', () => {
            const payer = basePayer({
                taxCredits: [
                    makeCredit({ id: 'for', category: 'impuesto_exterior', value: 2_000_000 }),
                    makeCredit({ id: 'don', category: 'donacion_general', value: 4_000_000 }),
                    makeCredit({ id: 'food', category: 'donacion_alimentos', value: 2_000_000 }),
                    makeCredit({ id: 'rd', category: 'inversion_id', value: 3_000_000 }),
                    makeCredit({ id: 'iva', category: 'iva_activos_fijos', value: 1_500_000 }),
                    makeCredit({ id: 'other', category: 'otro_descuento', value: 500_000 }),
                ],
            });
            const result = calculateDescuentos(payer, 50_000_000, 10_000_000, 100_000_000);

            expect(result.foreignTaxCredit).toBeGreaterThan(0);
            expect(result.donationsGeneral).toBe(1_000_000);  // 25% of 4M
            expect(result.donationsFood).toBe(740_000);        // 37% of 2M
            expect(result.rdInvestment).toBe(900_000);         // 30% of 3M
            expect(result.ivaFixedAssets).toBe(1_500_000);
            expect(result.otherCredits).toBe(500_000);
            expect(result.totalCredits).toBeGreaterThan(0);
            expect(result.totalCredits).toBeLessThanOrEqual(50_000_000);
        });
    });
});
