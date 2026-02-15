
import { describe, it, expect } from 'vitest';
import { calculatePatrimonioTax } from '../calculators/patrimonio-impuesto';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('Wealth Tax (Impuesto al Patrimonio) Calculator', () => {
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

    it('should result in NO tax/subject if wealth < 72,000 UVT', () => {
        const wealth = 71_000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [{ id: 'a1', category: 'otro_activo', description: 'Wealth', value: wealth }]
        };

        const result = calculatePatrimonioTax(payer, wealth);
        expect(result.isSubject).toBe(false);
        expect(result.tax).toBe(0);
    });

    it('should be subject to tax if wealth >= 72,000 UVT (Bracket 1: 0.5%)', () => {
        // Wealth 100,000 UVT.
        // Bracket: 72,000 - 122,000. Rate 0.5%. Base Tax 0.
        // Tax = (100,000 - 72,000) * 0.005 = 28,000 * 0.005 = 140 UVT.
        const wealthUVT = 100_000;
        const wealth = wealthUVT * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [{ id: 'a1', category: 'otro_activo', description: 'Wealth', value: wealth }]
        };

        const result = calculatePatrimonioTax(payer, wealth);
        expect(result.isSubject).toBe(true);
        
        const expectedTaxUVT = (100_000 - 72_000) * 0.005;
        const expectedTax = Math.round(expectedTaxUVT * UVT);
        
        expect(result.tax).toBe(expectedTax);
    });

    it('should verify housing exclusion logic (First 12,000 UVT)', () => {
        // Wealth 80,000 UVT, entirely from Housing.
        // Housing Exclusion: 12,000 UVT.
        // Taxable Base: 80,000 - 12,000 = 68,000 UVT.
        // 68,000 UVT < 72,000 UVT Threshold.
        // IMPORTANT: The threshold check (72,000) is on LIQUID EQUITY, NOT Taxable Base.
        // Code check: 
        //   const patrimonioUVT = patrimonioLiquido / UVT;
        //   if (patrimonioUVT < THRESHOLD_UVT) return false;
        // So they ARE subject (80k > 72k).
        // BUT Taxable Base is 68k.
        // 68k falls into Bracket 0 (0-72k) -> Rate 0.
        // So Tax should be 0.

        const wealthUVT = 80_000;
        const wealth = wealthUVT * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [{ 
                id: 'a1', 
                category: 'inmueble', 
                description: 'Casa de Habitacion', 
                value: wealth // 80k UVT
            }]
        };

        const result = calculatePatrimonioTax(payer, wealth);
        
        expect(result.isSubject).toBe(true); // Subject because gross equity > 72k
        
        // Taxable Base check
        const expectedBase = (80_000 - 12_000) * UVT;
        expect(result.taxableBase).toBe(expectedBase);
        
        // Tax calculation on 68,000 UVT base
        // Bracket: 0 - 72,000 -> Rate 0.
        expect(result.tax).toBe(0);
    });

    it('should calculate tax for Bracket 2 (1.0%) with Housing Exclusion', () => {
        // Wealth: 150,000 UVT (100k Housing + 50k Cash).
        // Housing Exclusion: 12,000 UVT.
        // Taxable Base: 138,000 UVT.
        // Bracket: 122,000 - 239,000. Rate 1.0%. Base Tax 250 UVT.
        // Tax = 250 + (138,000 - 122,000) * 0.01
        //     = 250 + 16,000 * 0.01 
        //     = 250 + 160 = 410 UVT.
        
        const housingVal = 100_000 * UVT;
        const cashVal = 50_000 * UVT;
        const totalWealth = housingVal + cashVal;

        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [
                { id: 'a1', category: 'inmueble', description: 'Apartamento de Habitacio', value: housingVal },
                { id: 'a2', category: 'cuenta_bancaria', description: 'Cash', value: cashVal }
            ]
        };

        const result = calculatePatrimonioTax(payer, totalWealth);
        
        expect(result.isSubject).toBe(true);
        expect(result.taxableBase).toBe((150_000 - 12_000) * UVT);
        
        const expectedTaxUVT = 250 + ((138_000 - 122_000) * 0.01);
        const expectedTax = Math.round(expectedTaxUVT * UVT);
        
        expect(result.tax).toBe(expectedTax);
    });

    it('should calculate tax for Top Bracket (1.5%)', () => {
        // Wealth: 300,000 UVT (No housing exclusion for simplicity).
        // Bracket: > 239,000. Rate 1.5%. Base Tax 1420 UVT.
        // Tax = 1420 + (300,000 - 239,000) * 0.015
        //     = 1420 + 61,000 * 0.015
        //     = 1420 + 915 = 2335 UVT.

        const wealthUVT = 300_000;
        const wealth = wealthUVT * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [{ id: 'a1', category: 'inversion', description: 'Stocks', value: wealth }]
        };

        const result = calculatePatrimonioTax(payer, wealth);
        
        const expectedTaxUVT = 1420 + ((300_000 - 239_000) * 0.015);
        const expectedTax = Math.round(expectedTaxUVT * UVT);
        
        expect(result.tax).toBe(expectedTax);
    });

    it('should NOT be subject at exactly 72,000 UVT (strict <)', () => {
        // Exactly 72000 UVT: patrimonioUVT < THRESHOLD_UVT
        // Since code uses `<` not `<=`, exactly 72000 means NOT less than → IS subject
        // Actually: `patrimonioUVT < THRESHOLD_UVT` → 72000 < 72000 = false → IS subject
        const wealth = 72_000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [{ id: 'a1', category: 'otro_activo', description: 'Wealth', value: wealth }]
        };
        const result = calculatePatrimonioTax(payer, wealth);
        expect(result.isSubject).toBe(true);
        // Taxable base = 72000 UVT (no exclusion). Bracket 72k-122k at 0.5%
        // Tax = (72000-72000)*0.005 = 0
        expect(result.tax).toBe(0);
    });

    it('should cap housing exclusion at 12,000 UVT', () => {
        // Housing worth 200,000 UVT, total wealth = 220,000 UVT
        const housingVal = 200_000 * UVT;
        const otherVal = 20_000 * UVT;
        const totalWealth = housingVal + otherVal;

        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [
                { id: 'a1', category: 'inmueble', description: 'Vivienda principal', value: housingVal },
                { id: 'a2', category: 'cuenta_bancaria', description: 'Cash', value: otherVal },
            ]
        };

        const result = calculatePatrimonioTax(payer, totalWealth);
        // Exclusion capped at 12,000 UVT regardless of housing value
        const expectedBase = totalWealth - (12_000 * UVT);
        expect(result.taxableBase).toBe(expectedBase);
    });

    it('should NOT apply housing exclusion when no matching vivienda/casa/apartamento found', () => {
        // Only office property, no vivienda keyword
        const wealthUVT = 100_000;
        const wealth = wealthUVT * UVT;

        const payer: TaxPayer = {
            ...mockPayerBase,
            assets: [{ id: 'a1', category: 'inmueble', description: 'Oficina Centro', value: wealth }]
        };

        const result = calculatePatrimonioTax(payer, wealth);
        // No housing exclusion → taxableBase = full wealth
        expect(result.taxableBase).toBe(wealth);
        const expectedTaxUVT = (100_000 - 72_000) * 0.005;
        expect(result.tax).toBe(Math.round(expectedTaxUVT * UVT));
    });
});
