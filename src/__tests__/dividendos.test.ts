
import { describe, it, expect } from 'vitest';
import { calculateDividendSchedule } from '../calculators/dividendos';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('Dividend Schedule Calculator', () => {
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

    it('should calculate flat 20% tax for Non-Residents', () => {
        const dividendValue = 100_000_000;
        const payer: TaxPayer = {
            ...mockPayerBase,
            isResident: false,
            incomes: [{
                id: 'div1',
                category: 'dividendos_ordinarios',
                description: 'Divs NR',
                grossValue: dividendValue
            }]
        };

        const result = calculateDividendSchedule(payer);
        
        expect(result.isNonResident).toBe(true);
        // Tax 20%
        expect(result.totalTax).toBe(20_000_000);
        // Withholding also 20% for NR
        expect(result.withholding).toBe(20_000_000);
        // Sub-schedules should be zeroed out
        expect(result.subCedula1.taxableIncome).toBe(100_000_000);
        expect(result.subCedula1.tax).toBe(0);
    });

    it('should handle Sub-schedule 1 for Residents (Consolidated)', () => {
        const dividendValue = 50_000_000;
        const payer: TaxPayer = {
            ...mockPayerBase,
            isResident: true,
            incomes: [{
                id: 'div1',
                category: 'dividendos_ordinarios',
                description: 'Divs Ord',
                grossValue: dividendValue
            }]
        };

        const result = calculateDividendSchedule(payer);
        
        expect(result.isNonResident).toBe(false);
        expect(result.subCedula1.grossIncome).toBe(dividendValue);
        expect(result.subCedula1.taxableIncome).toBe(dividendValue);
        // Tax is calculated in orchestrator, so here it is 0
        expect(result.subCedula1.tax).toBe(0);
        expect(result.totalTax).toBe(0); // Only Sub-2 tax is added here
    });

    it('should handle Sub-schedule 2 for Residents (35% Tax)', () => {
        const dividendValue = 100_000_000;
        const payer: TaxPayer = {
            ...mockPayerBase,
            isResident: true,
            incomes: [{
                id: 'div2',
                category: 'dividendos_gravados',
                description: 'Divs Taxed',
                grossValue: dividendValue
            }]
        };

        const result = calculateDividendSchedule(payer);
        
        expect(result.subCedula2.grossIncome).toBe(dividendValue);
        // 35% Tax
        const expectedTax35 = 35_000_000;
        expect(result.subCedula2.tax35).toBe(expectedTax35);
        // Resulting net tax
        expect(result.subCedula2.netTax).toBe(expectedTax35);
        // Remaining base for consolidation
        expect(result.subCedula2.remainingBase).toBe(100_000_000 - 35_000_000);
        
        expect(result.totalTax).toBe(expectedTax35);
    });

    it('should calculate Withholding Tax for Residents (> 1090 UVT)', () => {
        // Threshold 1090 UVT. 
        // Let's use 2000 UVT total dividends.
        // Excess = 910 UVT.
        // Rate 15%.
        const dividendValue = 2000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'div1',
                category: 'dividendos_ordinarios',
                description: 'Divs',
                grossValue: dividendValue
            }]
        };

        const result = calculateDividendSchedule(payer);
        
        const excess = (2000 - 1090) * UVT;
        const expectedWithholding = Math.round(excess * 0.15);
        
        expect(result.withholding).toBe(expectedWithholding);
    });

    it('should have 0 Withholding for Residents <= 1090 UVT', () => {
        const dividendValue = 1000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'div1',
                category: 'dividendos_ordinarios',
                description: 'Divs',
                grossValue: dividendValue
            }]
        };
        const result = calculateDividendSchedule(payer);
        expect(result.withholding).toBe(0);
    });

    it('should return zero result when no dividend incomes', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [] // No dividends
        };
        const result = calculateDividendSchedule(payer);
        expect(result.subCedula1.grossIncome).toBe(0);
        expect(result.subCedula2.grossIncome).toBe(0);
        expect(result.totalTax).toBe(0);
        expect(result.withholding).toBe(0);
    });

    it('should handle both sub-cedula 1 and 2 for residents', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            isResident: true,
            incomes: [
                { id: 'd1', category: 'dividendos_ordinarios', description: 'Ord', grossValue: 40_000_000 },
                { id: 'd2', category: 'dividendos_gravados', description: 'Grav', grossValue: 20_000_000 },
            ]
        };
        const result = calculateDividendSchedule(payer);
        expect(result.subCedula1.grossIncome).toBe(40_000_000);
        expect(result.subCedula2.grossIncome).toBe(20_000_000);
        expect(result.subCedula2.tax35).toBe(7_000_000); // 35% of 20M
        expect(result.subCedula2.remainingBase).toBe(13_000_000);
    });

    it('should have 0 withholding at exactly 1090 UVT', () => {
        const dividendValue = 1090 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{ id: 'd1', category: 'dividendos_ordinarios', description: 'Divs', grossValue: dividendValue }]
        };
        const result = calculateDividendSchedule(payer);
        expect(result.withholding).toBe(0);
    });

    it('should aggregate multiple dividend sources', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            isResident: true,
            incomes: [
                { id: 'd1', category: 'dividendos_ordinarios', description: 'Co1', grossValue: 25_000_000 },
                { id: 'd2', category: 'dividendos_ordinarios', description: 'Co2', grossValue: 35_000_000 },
            ]
        };
        const result = calculateDividendSchedule(payer);
        expect(result.subCedula1.grossIncome).toBe(60_000_000);
    });

    it('should calculate non-resident tax on both dividend types', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            isResident: false,
            incomes: [
                { id: 'd1', category: 'dividendos_ordinarios', description: 'Ord', grossValue: 30_000_000 },
                { id: 'd2', category: 'dividendos_gravados', description: 'Grav', grossValue: 20_000_000 },
            ]
        };
        const result = calculateDividendSchedule(payer);
        // Total = 50M * 20% = 10M
        expect(result.totalTax).toBe(10_000_000);
        expect(result.isNonResident).toBe(true);
    });
});
