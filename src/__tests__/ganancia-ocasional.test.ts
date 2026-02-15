
import { describe, it, expect } from 'vitest';
import { calculateGananciaOcasional } from '../calculators/ganancia-ocasional';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

describe('Occasional Gain (Ganancia Ocasional) Calculator', () => {
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

    it('should calculate 15% tax on general occasional gains (Asset Sale)', () => {
        // Sale of asset > 2 years
        const salePrice = 200_000_000;
        const costBasis = 100_000_000;
        
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go1',
                category: 'ganancia_ocasional',
                description: 'Venta Lote',
                grossValue: salePrice,
                costBasis: costBasis
            }]
        };

        const result = calculateGananciaOcasional(payer);
        
        expect(result.grossIncome).toBe(salePrice);
        expect(result.costs).toBe(costBasis);
        
        const netGain = salePrice - costBasis; // 100M
        expect(result.taxableIncome).toBe(netGain);
        
        // Tax 15%
        const expectedTax = Math.round(netGain * 0.15);
        expect(result.taxGeneral).toBe(expectedTax);
        expect(result.totalTax).toBe(expectedTax);
    });

    it('should apply 5000 UVT exemption for Housing Sale (Vivienda)', () => {
        // Gain 6000 UVT
        const netGain = 6000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go2',
                category: 'ganancia_ocasional',
                description: 'Venta Vivienda Habitacion',
                grossValue: netGain,
                costBasis: 0
            }]
        };

        const result = calculateGananciaOcasional(payer);
        
        const expectedExempt = 5000 * UVT;
        const expectedTaxable = 1000 * UVT;
        
        expect(result.exemptions).toBe(expectedExempt);
        expect(result.taxableIncome).toBe(expectedTaxable);
        expect(result.taxGeneral).toBe(Math.round(expectedTaxable * 0.15));
    });

    it('should apply 13000 UVT exemption for Inherited Housing', () => {
        // Inheritance 15000 UVT
        const val = 15000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go3',
                category: 'ganancia_ocasional',
                description: 'Herencia Vivienda Causante',
                grossValue: val
            }]
        };

        const result = calculateGananciaOcasional(payer);
        
        const expectedExempt = 13000 * UVT;
        const expectedTaxable = 2000 * UVT;
        
        expect(result.exemptions).toBe(expectedExempt);
        expect(result.taxableIncome).toBe(expectedTaxable);
    });
    
    it('should apply 6500 UVT exemption for Inherited Real Estate (Other)', () => {
        // Inheritance Finca 8000 UVT
        const val = 8000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go4',
                category: 'ganancia_ocasional',
                description: 'Herencia Finca',
                grossValue: val
            }]
        };
        const result = calculateGananciaOcasional(payer);
        const expectedExempt = 6500 * UVT;
        expect(result.exemptions).toBe(expectedExempt);
    });


    it('should calculate flat 20% tax on Lotteries with NO exemption', () => {
        // Prize 100M
        const val = 100_000_000;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'lot1',
                category: 'loteria_premios',
                description: 'Baloto',
                grossValue: val
            }]
        };

        const result = calculateGananciaOcasional(payer);
        
        expect(result.grossIncome).toBe(val);
        // Exemption should be 0 for final tax calculation (Art 317)
        expect(result.exemptions).toBe(0);
        expect(result.taxableIncome).toBe(val);
        
        // Tax 20%
        const expectedTax = Math.round(val * 0.20);
        expect(result.taxLotteries).toBe(expectedTax);
        expect(result.totalTax).toBe(expectedTax);
    });

    it('should return zero result when no GO incomes', () => {
        const payer: TaxPayer = { ...mockPayerBase, incomes: [] };
        const result = calculateGananciaOcasional(payer);
        expect(result.grossIncome).toBe(0);
        expect(result.totalTax).toBe(0);
    });

    it('should apply 3250 UVT exemption for Seguro de Vida', () => {
        const val = 5000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go5',
                category: 'ganancia_ocasional',
                description: 'Seguro de Vida',
                grossValue: val,
            }]
        };
        const result = calculateGananciaOcasional(payer);
        const expectedExempt = 3250 * UVT;
        expect(result.exemptions).toBe(expectedExempt);
    });

    it('should apply 20% exemption capped at 1625 UVT for Donación received', () => {
        const val = 5000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go6',
                category: 'ganancia_ocasional',
                description: 'Donacion recibida',
                grossValue: val,
            }]
        };
        const result = calculateGananciaOcasional(payer);
        // 20% of 5000 UVT = 1000 UVT, capped at 1625 UVT → 1000 UVT
        const expectedExempt = Math.min(Math.round(val * 0.20), 1625 * UVT);
        expect(result.exemptions).toBe(expectedExempt);
    });

    it('should handle GO without cost basis (costBasis defaults to 0)', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go7',
                category: 'ganancia_ocasional',
                description: 'Venta Activo',
                grossValue: 50_000_000,
                // No costBasis → defaults to 0
            }]
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.costs).toBe(0);
        expect(result.taxableIncome).toBe(50_000_000);
    });

    it('should aggregate multiple GO items', () => {
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [
                { id: 'go8', category: 'ganancia_ocasional', description: 'Venta Terreno', grossValue: 80_000_000, costBasis: 30_000_000 },
                { id: 'go9', category: 'ganancia_ocasional', description: 'Otro activo', grossValue: 20_000_000 },
            ]
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.grossIncome).toBe(100_000_000);
        expect(result.costs).toBe(30_000_000);
    });

    it('should apply herencia exemption for porcion conyugal/sobreviviente', () => {
        const val = 10000 * UVT;
        const payer: TaxPayer = {
            ...mockPayerBase,
            incomes: [{
                id: 'go10',
                category: 'ganancia_ocasional',
                description: 'Herencia Porcion Conyugal',
                grossValue: val,
            }]
        };
        const result = calculateGananciaOcasional(payer);
        // Herencia porcion conyugal → 3250 UVT exemption
        const expectedExempt = 3250 * UVT;
        expect(result.exemptions).toBe(expectedExempt);
    });
});
