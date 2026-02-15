
import { describe, it, expect } from 'vitest';
import { TaxEngine } from '../index';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('Tax Engine Orchestrator', () => {
    const mockPayerBase: TaxPayer = {
        id: '999',
        name: 'Integration User',
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

    it('should calculate a full return for a simple employee', () => {
        // Simple case: Salary 60M/year.
        // INCR: 4.8M
        // Net: 55.2M
        // 25% Exempt: 13.8M
        // Taxable: 41.4M
        // Taxable UVT: ~879 UVT -> Range 1 (0-1090) -> Tax 0.
        
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'inc1',
                category: 'renta_trabajo',
                description: 'Wage',
                grossValue: 60_000_000,
                healthContribution: 2_400_000,
                pensionContribution: 2_400_000
            }]
        };

        const result = TaxEngine.calculate(payer);

        expect(result.cedulaGeneral.grossIncome).toBe(60_000_000);
        expect(result.cedulaGeneral.incrTotal).toBe(4_800_000);
        expect(result.cedulaGeneral.netIncome).toBe(55_200_000);
        // Taxable income should be > 0 but tax should be 0 because it's below 1090 UVT
        // 1090 * 47065 = 51,300,850.
        // Taxable is ~41M.
        expect(result.cedulaGeneral.taxableIncome).toBeLessThan(51_300_850);
        expect(result.totalIncomeTax).toBe(0);
        expect(result.isObligatedToFile).toBe(false); // < 1400 UVT Income
    });

    it('should calculate dividend tax with discount for residents', () => {
        // Resident with Dividend Sub-1
        // Gross: 2000 UVT (~94M)
        // Taxable: 2000 UVT
        // Tax Table on 2000 UVT:
        // (2000 - 1700)*0.28 + 116 = 84 + 116 = 200 UVT.
        // Discount 19%:
        // Base Excess 1090: 2000 - 1090 = 910 UVT.
        // Discount: 910 * 0.19 = 172.9 UVT.
        // Net Tax: 200 - 172.9 = 27.1 UVT.
        
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

        const result = TaxEngine.calculate(payer);

        const expectedTaxUVT = 200; // From previous manual calc for 2000 UVT
        
        // Check intermediate values
        expect(result.cedulaDividendos.subCedula1.tax).toBeGreaterThan(0);
        
        const expectedDiscountUVT = (2000 - 1090) * 0.19;
        const expectedDiscount = Math.round(expectedDiscountUVT * UVT);
        
        expect(Math.abs(result.cedulaDividendos.subCedula1.discount19 - expectedDiscount)).toBeLessThanOrEqual(UVT);

        // Final Net Tax
        expect(result.netIncomeTax).toBeLessThan(result.totalIncomeTax);
    });

    it('should handle a High Net Worth Individual (Complex Scenario)', () => {
        // Scenario:
        // 1. Labor Income: 500M (High bracket)
        // 2. Dividends: 100M (Taxed)
        // 3. Wealth: 5,000M (~106,000 UVT) -> Subject to Wealth Tax
        // 4. Occasional Gain: 200M (Inheritance)
        
        const laborIncome = 500_000_000;
        const dividends = 100_000_000;
        const wealth = 5_000_000_000;
        const inheritance = 200_000_000; // < 3250 UVT limit, likely exempt? 3250*47065 = 152M. Wait.
        // 3250 UVT is exemption per heir. 
        // 200M > 152M. So partially taxable.
        
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [
                { id: '1', category: 'renta_trabajo', description: 'Salary', grossValue: laborIncome, healthContribution: 20_000_000, pensionContribution: 20_000_000 },
                { id: '2', category: 'dividendos_gravados', description: 'Divs', grossValue: dividends },
                { id: '3', category: 'ganancia_ocasional', description: 'Herencia Tio', grossValue: inheritance }
            ],
            assets: [
                { id: 'a1', category: 'inversion', description: 'Portfolio', value: wealth }
            ]
        };

        const result = TaxEngine.calculate(payer);

        // 1. Wealth Tax Check
        expect(result.patrimonioTax.isSubject).toBe(true);
        expect(result.patrimonioTax.tax).toBeGreaterThan(0);

        // 2. General Schedule
        expect(result.cedulaGeneral.grossIncome).toBe(laborIncome);
        expect(result.cedulaGeneral.netIncome).toBe(laborIncome - 40_000_000); // INCR

        // 3. Dividends
        // Taxed dividends (Sub-2): 35% tax
        expect(result.cedulaDividendos.subCedula2.grossIncome).toBe(dividends);
        expect(result.cedulaDividendos.subCedula2.tax35).toBe(35_000_000);

        // 4. Occasional Gain
        expect(result.gananciaOcasional.grossIncome).toBe(inheritance);
        expect(result.gananciaOcasional.taxGeneral).toBeGreaterThan(0);

        // 5. Total Tax Liability
        // Should include: Income Tax + Dividend Tax + Occasional Gain Tax + Wealth Tax
        expect(result.balanceToPay).toBeGreaterThan(100_000_000); 
    });
});
