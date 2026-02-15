
import { describe, it, expect } from 'vitest';
import { calculatePensionesSchedule } from '../calculators/pensiones';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('Pension Schedule Calculator', () => {
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

    it('should return zero if no pension income', () => {
        const result = calculatePensionesSchedule(mockPayerBase);
        expect(result.grossIncome).toBe(0);
        expect(result.taxableIncome).toBe(0);
    });

    it('should calculate 100% exemption for low pensions (under 1000 UVT/mo)', () => {
        // 50M annual pension is ~4M/month = ~88 UVT/month. Well under limit.
        const pensionValue = 50_000_000;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'pen1',
                category: 'pensiones',
                description: 'Jubilacion',
                grossValue: pensionValue
            }]
        };

        const result = calculatePensionesSchedule(payer);
        expect(result.grossIncome).toBe(pensionValue);
        expect(result.exemptAmount).toBe(pensionValue);
        expect(result.taxableIncome).toBe(0);
    });

    it('should cap exemption at 12,000 UVT annually for high pensions', () => {
        // High pension: 20,000 UVT annual (> 12,000 UVT limit)
        // 20,000 UVT = 20,000 * 47065 = 941,300,000
        const highPension = 20_000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'pen2',
                category: 'pensiones',
                description: 'Mega Pension',
                grossValue: highPension
            }]
        };

        const result = calculatePensionesSchedule(payer);
        const expectedExempt = 13000 * UVT; // 1000 UVT * 13 months (includes extra mesada)

        expect(result.grossIncome).toBe(highPension);
        expect(result.exemptAmount).toBe(expectedExempt);
        expect(result.taxableIncome).toBe(highPension - expectedExempt);
    });

    it('should use custom numberOfMesadas when provided', () => {
        // 14 mesadas → limit = 1000 * 14 * UVT = 14000 UVT
        const pensionValue = 15_000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'pen3',
                category: 'pensiones',
                description: 'Pension con 14 mesadas',
                grossValue: pensionValue,
                numberOfMesadas: 14,
            }]
        };
        const result = calculatePensionesSchedule(payer);
        const expectedExempt = 14_000 * UVT;
        expect(result.exemptAmount).toBe(expectedExempt);
        expect(result.taxableIncome).toBe(pensionValue - expectedExempt);
    });

    it('should return taxableIncome = 0 when pension income is below exemption limit', () => {
        const lowPension = 500 * UVT; // Far below 13000 UVT
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'pen4',
                category: 'pensiones',
                description: 'Small Pension',
                grossValue: lowPension,
            }]
        };
        const result = calculatePensionesSchedule(payer);
        expect(result.exemptAmount).toBe(lowPension);
        expect(result.taxableIncome).toBe(0);
    });

    it('should filter out non-pension incomes', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [
                { id: 'sal', category: 'renta_trabajo', description: 'Salary', grossValue: 80_000_000 },
                { id: 'pen', category: 'pensiones', description: 'Pension', grossValue: 30_000_000 },
            ]
        };
        const result = calculatePensionesSchedule(payer);
        expect(result.grossIncome).toBe(30_000_000);
    });

    it('should aggregate multiple pension sources', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [
                { id: 'p1', category: 'pensiones', description: 'Pension 1', grossValue: 20_000_000 },
                { id: 'p2', category: 'pensiones', description: 'Pension 2', grossValue: 15_000_000 },
            ]
        };
        const result = calculatePensionesSchedule(payer);
        expect(result.grossIncome).toBe(35_000_000);
    });
});
