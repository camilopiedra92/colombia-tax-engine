/**
 * Comprehensive Tests for TaxEngine class methods — Coverage Completion
 * 
 * Covers:
 *  - calculatePatrimonio: inmueble (fiscalCost vs cadastralValue), foreign assets, default asset
 *  - calculateTotalWithholding: all withholding types
 *  - getFilingDeadline: NaN digits, wrap-around range 99-00, normal range, no-match
 *  - Non-resident dividend consolidation path
 *  - balanceToPay negative (saldo a favor)
 *  - TaxCredits exceeding totalIncomeTax
 *  - Full integration with all calculators
 */

import { describe, it, expect } from 'vitest';
import { TaxEngine } from '../index';
import { TaxPayer, IncomeSource, Deduction, Asset, Liability, TaxCredit } from '../types';

const UVT_2025 = 49799;

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

describe('TaxEngine Class — Coverage Completion', () => {

    // ═══ calculatePatrimonio ═══
    describe('calculatePatrimonio', () => {
        it('should use max(fiscalCost, cadastralValue) for inmuebles', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'inmueble',
                    description: 'Apartamento',
                    value: 200_000_000,
                    fiscalCost: 250_000_000,
                    cadastralValue: 180_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            // Max of fiscalCost (250M) and cadastralValue (180M) = 250M
            expect(result.patrimonio.patrimonioBruto).toBe(250_000_000);
        });

        it('should use cadastralValue when higher than fiscalCost', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'inmueble',
                    description: 'Casa',
                    value: 200_000_000,
                    fiscalCost: 150_000_000,
                    cadastralValue: 300_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.patrimonio.patrimonioBruto).toBe(300_000_000);
        });

        it('should use value as default fiscalCost when not provided', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'inmueble',
                    description: 'Lote',
                    value: 100_000_000,
                    // No fiscalCost → uses value
                    cadastralValue: 80_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            // Max of value (100M) and cadastralValue (80M) = 100M
            expect(result.patrimonio.patrimonioBruto).toBe(100_000_000);
        });

        it('should handle foreign assets with exchangeRate (assumes pre-converted)', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'cuenta_exterior',
                    description: 'Bank Account USA',
                    value: 50_000_000, // Already converted to COP
                    isForeign: true,
                    exchangeRate: 4200,
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.patrimonio.patrimonioBruto).toBe(50_000_000);
        });

        it('should use plain value for non-inmueble, non-foreign assets', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'vehiculo',
                    description: 'Carro',
                    value: 80_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.patrimonio.patrimonioBruto).toBe(80_000_000);
        });

        it('should subtract liabilities from gross patrimonio', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'vehiculo',
                    description: 'Carro',
                    value: 100_000_000,
                }],
                liabilities: [{
                    id: 'l1',
                    description: 'Préstamo Vehicular',
                    value: 40_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.patrimonio.patrimonioBruto).toBe(100_000_000);
            expect(result.patrimonio.totalPasivos).toBe(40_000_000);
            expect(result.patrimonio.patrimonioLiquido).toBe(60_000_000);
        });

        it('should not let patrimonioLiquido go below zero', () => {
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'vehiculo',
                    description: 'Carro',
                    value: 30_000_000,
                }],
                liabilities: [{
                    id: 'l1',
                    description: 'Deuda',
                    value: 80_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.patrimonio.patrimonioLiquido).toBe(0);
        });
    });

    // ═══ calculateTotalWithholding ═══
    describe('calculateTotalWithholding', () => {
        it('should sum all withholding types from incomes', () => {
            const payer = basePayer({
                incomes: [
                    {
                        id: 'inc1',
                        description: 'Salary',
                        category: 'renta_trabajo',
                        grossValue: 100_000_000,
                        withholdingTax: 5_000_000,
                        withholdingDividends: 1_000_000,
                        withholdingLotteries: 500_000,
                    },
                    {
                        id: 'inc2',
                        description: 'Capital',
                        category: 'renta_capital',
                        grossValue: 20_000_000,
                        withholdingTax: 2_000_000,
                    },
                ],
            });
            const result = TaxEngine.calculate(payer);
            // Base withholding = 5M + 1M + 500K + 2M = 8.5M (not including dividend withholding from calculator)
            expect(result.totalWithholding).toBeGreaterThanOrEqual(8_500_000);
        });
    });

    // ═══ getFilingDeadline ═══
    describe('getFilingDeadline', () => {
        it('should return correct deadline for normal digit range', () => {
            const payer = basePayer({ id: '12345678901' }); // Last 2 digits = 01
            const result = TaxEngine.calculate(payer);
            expect(result.filingDeadline).toBe('2025-08-12');
        });

        it('should handle wrap-around range 99-00', () => {
            // ID ending in 99 → should match the 99-00 range
            const payer99 = basePayer({ id: '1234567899' });
            const result99 = TaxEngine.calculate(payer99);
            expect(result99.filingDeadline).toBe('2025-10-22');

            // ID ending in 00 → should also match the 99-00 range
            const payer00 = basePayer({ id: '1234567800' });
            const result00 = TaxEngine.calculate(payer00);
            expect(result00.filingDeadline).toBe('2025-10-22');
        });

        it('should return undefined for non-numeric ID suffix', () => {
            const payer = basePayer({ id: 'ABCDEFGHIJ' });
            const result = TaxEngine.calculate(payer);
            expect(result.filingDeadline).toBeUndefined();
        });

        it('should match mid-range digits correctly', () => {
            const payer = basePayer({ id: '1234567850' }); // Last 2 = 50
            const result = TaxEngine.calculate(payer);
            expect(result.filingDeadline).toBe('2025-09-16'); // 49-50 range
        });
    });

    // ═══ Non-resident dividend path ═══
    describe('Non-Resident Dividends', () => {
        it('should apply 20% flat rate for non-residents and not consolidate', () => {
            const payer = basePayer({
                isResident: false,
                incomes: [
                    {
                        id: 'sal',
                        description: 'Salary',
                        category: 'renta_trabajo',
                        grossValue: 50_000_000,
                    },
                    {
                        id: 'div',
                        description: 'Dividends',
                        category: 'dividendos_ordinarios',
                        grossValue: 30_000_000,
                    },
                ],
            });
            const result = TaxEngine.calculate(payer);
            // Non-resident: dividends taxed at 20% = 6M
            expect(result.cedulaDividendos.totalTax).toBe(6_000_000);
            // Consolidated should NOT include dividends for non-residents
            expect(result.consolidatedTaxableIncome).toBeLessThan(
                result.cedulaGeneral.taxableIncome + 30_000_000
            );
        });
    });

    // ═══ Balance to pay negative (saldo a favor) ═══
    describe('Saldo a Favor', () => {
        it('should produce negative balanceToPay when withholdings exceed tax', () => {
            const payer = basePayer({
                incomes: [{
                    id: 'sal',
                    description: 'Salary',
                    category: 'renta_trabajo',
                    grossValue: 50_000_000,
                    withholdingTax: 30_000_000, // Very high withholding
                }],
            });
            const result = TaxEngine.calculate(payer);
            // Tax should be small but withholding is 30M → negative balance
            expect(result.balanceToPay).toBeLessThan(0);
        });
    });

    // ═══ Tax Credits Exceeding Total Tax ═══
    describe('Tax Credits Capping', () => {
        it('should cap total tax credits at totalIncomeTax', () => {
            const payer = basePayer({
                incomes: [{
                    id: 'sal',
                    description: 'Salary',
                    category: 'renta_trabajo',
                    grossValue: 80_000_000,
                }],
                taxCredits: [{
                    id: 'tc1',
                    category: 'iva_activos_fijos',
                    description: 'IVA Assets',
                    value: 500_000_000, // Way more than any tax  
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.totalTaxCredits).toBeLessThanOrEqual(result.totalIncomeTax);
            expect(result.netIncomeTax).toBe(0);
        });
    });

    // ═══ Empty scenario ═══
    describe('Empty Taxpayer', () => {
        it('should handle taxpayer with no incomes, assets, or deductions', () => {
            const payer = basePayer();
            const result = TaxEngine.calculate(payer);
            expect(result.cedulaGeneral.grossIncome).toBe(0);
            expect(result.cedulaPensiones.grossIncome).toBe(0);
            expect(result.cedulaDividendos.totalTax).toBe(0);
            expect(result.gananciaOcasional.grossIncome).toBe(0);
            expect(result.totalIncomeTax).toBe(0);
            expect(result.balanceToPay).toBe(0);
        });
    });

    // ═══ Patrimonio Tax Integration ═══
    describe('Patrimonio Tax in Full Calculation', () => {
        it('should calculate patrimonio tax for high net worth', () => {
            const threshold = 72000 * UVT_2025;
            const payer = basePayer({
                assets: [{
                    id: 'a1',
                    category: 'inversion',
                    description: 'Portafolio de Inversiones',
                    value: threshold + 1_000_000_000, // Well above threshold
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.patrimonioTax.isSubject).toBe(true);
            expect(result.patrimonioTax.tax).toBeGreaterThan(0);
        });
    });

    // ═══ Anticipo integration ═══
    describe('Anticipo in Orchestrator', () => {
        it('should include previousYearAdvance in result', () => {
            const payer = basePayer({
                previousYearAdvance: 5_000_000,
                incomes: [{
                    id: 'sal',
                    description: 'Salary',
                    category: 'renta_trabajo',
                    grossValue: 100_000_000,
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.anticipoPreviousYear).toBe(5_000_000);
        });
    });

    // ═══ Full integrations with sub-cedula 2 dividends ═══
    describe('Resident with Sub-Cedula 2 Dividends', () => {
        it('should apply 35% + marginal for sub-cedula 2', () => {
            const payer = basePayer({
                incomes: [
                    {
                        id: 'sal',
                        description: 'Salary',
                        category: 'renta_trabajo',
                        grossValue: 100_000_000,
                    },
                    {
                        id: 'div2',
                        description: 'Dividendos Gravados',
                        category: 'dividendos_gravados',
                        grossValue: 50_000_000,
                    },
                ],
            });
            const result = TaxEngine.calculate(payer);
            // Sub-cedula 2: 35% of 50M = 17.5M
            expect(result.cedulaDividendos.subCedula2.tax35).toBe(17_500_000);
            expect(result.cedulaDividendos.subCedula2.remainingBase).toBe(32_500_000);
        });
    });

    // ═══ Both sub-cedula 1 and 2 combined ═══
    describe('Resident with Both Sub-Cedula 1 and 2', () => {
        it('should calculate marginal taxes for both sub-cedulas', () => {
            const payer = basePayer({
                incomes: [
                    {
                        id: 'sal',
                        description: 'Salary',
                        category: 'renta_trabajo',
                        grossValue: 80_000_000,
                    },
                    {
                        id: 'div1',
                        description: 'Div Ordinarios',
                        category: 'dividendos_ordinarios',
                        grossValue: 40_000_000,
                    },
                    {
                        id: 'div2',
                        description: 'Div Gravados',
                        category: 'dividendos_gravados',
                        grossValue: 20_000_000,
                    },
                ],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.cedulaDividendos.subCedula1.grossIncome).toBe(40_000_000);
            expect(result.cedulaDividendos.subCedula2.grossIncome).toBe(20_000_000);
            expect(result.cedulaDividendos.totalTax).toBeGreaterThan(0);
        });
    });

    // ═══ Ganancia Ocasional in Full Calculation ═══
    describe('Ganancia Ocasional Integration', () => {
        it('should include GO tax in totalIncomeTax', () => {
            const payer = basePayer({
                incomes: [
                    {
                        id: 'go',
                        description: 'Venta activo fijo',
                        category: 'ganancia_ocasional',
                        grossValue: 100_000_000,
                        holdingPeriodYears: 5,
                    },
                ],
            });
            const result = TaxEngine.calculate(payer);
            // 15% of 100M = 15M
            expect(result.gananciaOcasional.taxGeneral).toBe(15_000_000);
            expect(result.totalIncomeTax).toBeGreaterThanOrEqual(15_000_000);
        });
    });

    // ═══ Obligados integration ═══
    describe('Obligados a Declarar Integration', () => {
        it('should mark as not obligated when below all thresholds', () => {
            const payer = basePayer();
            const result = TaxEngine.calculate(payer);
            expect(result.isObligatedToFile).toBe(false);
        });

        it('should mark as obligated when income exceeds threshold', () => {
            const payer = basePayer({
                incomes: [{
                    id: 'sal',
                    description: 'Salary',
                    category: 'renta_trabajo',
                    grossValue: 1400 * UVT_2025 + 1, // Just above threshold
                }],
            });
            const result = TaxEngine.calculate(payer);
            expect(result.isObligatedToFile).toBe(true);
            expect(result.obligationReasons.length).toBeGreaterThan(0);
        });
    });
});
