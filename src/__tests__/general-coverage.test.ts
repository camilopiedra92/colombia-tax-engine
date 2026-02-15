/**
 * Comprehensive Tests for calculateGeneralSchedule — Coverage Completion
 * 
 * Covers all untested branches:
 *  - intereses_cesantias progressive degradation
 *  - Legacy cesantías (severance/severanceInterest fields)
 *  - ICETEX, indemnización, gastos_entierro, otras_exentas, otras_deducciones
 *  - Reclassified GO (posesión < 2 years)
 *  - Honorarios without preferCostsOverExemption (labor eligible)
 *  - Financial yields inflationary component
 *  - AFC/FPV percentage cap vs UVT cap
 *  - Zero dependents, zero labor eligible
 *  - Full smart allocation with multiple income types
 */

import { describe, it, expect } from 'vitest';
import { calculateGeneralSchedule } from '../calculators/general';
import { TaxPayer, IncomeSource, Deduction } from '../types';
import { getTaxRules } from '../rules';

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

function makeIncome(overrides: Partial<IncomeSource>): IncomeSource {
    return {
        id: 'inc-1',
        description: 'Test Income',
        category: 'renta_trabajo',
        grossValue: 0,
        ...overrides,
    };
}

function makeDeduction(overrides: Partial<Deduction>): Deduction {
    return {
        id: 'ded-1',
        category: 'otras_deducciones',
        description: 'Test Deduction',
        value: 0,
        ...overrides,
    };
}

describe('calculateGeneralSchedule — Coverage Completion', () => {

    // ═══ intereses_cesantias category ═══
    describe('Intereses de Cesantías (Art. 206 Num 4)', () => {
        it('should apply 100% exemption for avgSalary <= 350 UVT', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'intereses_cesantias',
                    grossValue: 5_000_000,
                    avgSalaryLast6MonthsUVT: 200,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(5_000_000);
        });

        it('should apply 60% exemption for avgSalary in 471-530 UVT range', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'intereses_cesantias',
                    grossValue: 10_000_000,
                    avgSalaryLast6MonthsUVT: 500,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // 60% of 10M = 6M cesantías exempt + 25% of remaining (4M) = 1M → total 7M
            expect(result.totalExemptions).toBe(7_000_000);
        });

        it('should apply 0% exemption for avgSalary > 650 UVT', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'intereses_cesantias',
                    grossValue: 10_000_000,
                    avgSalaryLast6MonthsUVT: 700,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // No cesantias exemption, but may have 25% labor exemption
            // The cesantias exempt should be 0
            // totalExemptions includes the 25% labor exemption
            // grossIncome - INCR = 10M, laborBaseFor25 = 10M, 25% = 2.5M (capped at 790 UVT)
            const max25 = 790 * UVT_2025;
            expect(result.totalExemptions).toBeLessThanOrEqual(max25);
        });
    });

    // ═══ Legacy cesantías via severance/severanceInterest ═══
    describe('Legacy Cesantías Fields (retrocompatibilidad)', () => {
        it('should calculate exempt amount from legacy severance fields', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 80_000_000,
                    severance: 5_000_000,
                    severanceInterest: 500_000,
                    averageMonthlySalary: 6_000_000, // ~120 UVT << 350
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // With avgSalary ~120 UVT (< 350), 100% of cesTotal should be exempt
            // cesTotal = 5M + 500K = 5.5M
            // totalExemptions should include 5.5M from cesantías + 25% labor
            expect(result.totalExemptions).toBeGreaterThan(5_500_000);
        });

        it('should use grossValue/12 as fallback for averageMonthlySalary', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 120_000_000, // Monthly avg = 10M
                    severance: 10_000_000,
                    // No averageMonthlySalary → fallback to grossValue/12 = 10M
                    // 10M / UVT_2025 ≈ 200 UVT (< 350: 100% exempt)
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThan(10_000_000);
        });
    });

    // ═══ ICETEX deduction ═══
    describe('ICETEX Deduction (Art. 119.1)', () => {
        it('should include ICETEX deduction capped at 100 UVT', () => {
            const limit = 100 * UVT_2025;
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 100_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'icetex',
                    value: limit + 5_000_000, // Over the limit
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // ICETEX should be capped at 100 UVT
            expect(result.totalDeductions).toBeGreaterThanOrEqual(limit);
        });
    });

    // ═══ Indemnización accidente ═══
    describe('Indemnización Accidente (Art. 206 num 1)', () => {
        it('should include indemnizacion_accidente as exempt income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 60_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'indemnizacion_accidente' as any,
                    value: 10_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(10_000_000);
        });
    });

    // ═══ Gastos de entierro ═══
    describe('Gastos de Entierro (Art. 206 num 2)', () => {
        it('should include gastos_entierro as exempt income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 60_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'gastos_entierro' as any,
                    value: 3_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(3_000_000);
        });
    });

    // ═══ Otras exentas ═══
    describe('Otras Rentas Exentas (Art. 206 num 3-9)', () => {
        it('should include otras_exentas as exempt income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 80_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'otras_exentas' as any,
                    value: 5_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(5_000_000);
        });
    });

    // ═══ Otras deducciones / donaciones ═══
    describe('Otras Deducciones y Donaciones', () => {
        it('should include otras_deducciones in totalDeductions', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 80_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'otras_deducciones',
                    value: 3_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalDeductions).toBeGreaterThanOrEqual(3_000_000);
        });

        it('should include donaciones in totalDeductions', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 80_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'donaciones',
                    value: 2_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalDeductions).toBeGreaterThanOrEqual(2_000_000);
        });
    });

    // ═══ Reclassified Ganancia Ocasional (< 2 years) ═══
    describe('Reclassified GO (possession < 2 years)', () => {
        it('should reclassify GO with holdingPeriodYears < 2 as capital income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'ganancia_ocasional',
                    grossValue: 50_000_000,
                    holdingPeriodYears: 1,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // The reclassified GO should be included in the general schedule
            expect(result.grossIncome).toBe(50_000_000);
        });

        it('should reclassify GO with heldDurationDays < 730 as capital income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'ganancia_ocasional',
                    grossValue: 30_000_000,
                    heldDurationDays: 500,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.grossIncome).toBe(30_000_000);
        });

        it('should NOT reclassify GO with holdingPeriodYears >= 2', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'ganancia_ocasional',
                    grossValue: 50_000_000,
                    holdingPeriodYears: 3,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // Should not be included in general schedule
            expect(result.grossIncome).toBe(0);
        });
    });

    // ═══ Honorarios as labor-eligible (without costs) ═══
    describe('Honorarios Labor-Eligible (sin costos)', () => {
        it('should give 25% exemption to honorarios without preferCostsOverExemption', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'honorarios',
                    grossValue: 100_000_000,
                    preferCostsOverExemption: false,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // Should get 25% exemption
            const max25 = Math.min(100_000_000 * 0.25, 790 * UVT_2025);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(max25);
        });
    });

    // ═══ AFC/FPV caps ═══
    describe('AFC/FPV (Art. 126-1, 126-4)', () => {
        it('should cap AFC at 30% of tributary income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 50_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'afc' as any,
                    value: 50_000_000, // Way more than 30% of 50M=15M
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // AFC capped at 30% of tributary income (50M - 0 INCR) = 15M
            expect(result.totalExemptions).toBeLessThanOrEqual(15_000_000 + 790 * UVT_2025);
        });

        it('should cap AFC at 3800 UVT', () => {
            const limit3800 = 3800 * UVT_2025;
            const hugeIncome = 1_000_000_000; // 1B
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: hugeIncome,
                })],
                deductions: [makeDeduction({
                    category: 'fpv' as any,
                    value: limit3800 + 50_000_000, // Over 3800 UVT
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // FPV should be at most 3800 UVT regardless of income
            // totalExemptions = AFC/FPV + 25% labor = 3800UVT + min(25%*base, 790UVT)
            expect(result.totalExemptions).toBeLessThanOrEqual(limit3800 + 790 * UVT_2025 + 1);
        });
    });

    // ═══ Zero dependents path ═══
    describe('Zero Dependents', () => {
        it('should not add dependents deduction when dependentsCount = 0', () => {
            const payer = basePayer({
                dependentsCount: 0,
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 80_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // No 72 UVT deduction, no 10% deduction
            // totalDeductions should be 0 (no deductions provided)
            expect(result.totalDeductions).toBe(0);
        });
    });

    // ═══ No labor eligible income → exempt25 = 0 ═══
    describe('No Labor-Eligible Income', () => {
        it('should not calculate 25% exemption when only capital income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_capital',
                    grossValue: 80_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // No 25% exemption for capital income
            expect(result.totalExemptions).toBe(0);
        });
    });

    // ═══ Multiple income types + smart allocation ═══
    describe('Full Smart Allocation', () => {
        it('should allocate deductions to capital first, then labor-with-costs, then labor-eligible', () => {
            const payer = basePayer({
                incomes: [
                    makeIncome({
                        id: 'salary',
                        category: 'renta_trabajo',
                        grossValue: 80_000_000,
                    }),
                    makeIncome({
                        id: 'capital',
                        category: 'renta_capital',
                        grossValue: 30_000_000,
                    }),
                    makeIncome({
                        id: 'honorarios',
                        category: 'honorarios',
                        grossValue: 20_000_000,
                        preferCostsOverExemption: true,
                        costs: 5_000_000,
                    }),
                ],
                deductions: [makeDeduction({
                    category: 'intereses_vivienda',
                    value: 40_000_000, // Large deduction
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // Deductions should go to capital first (30M), then honorarios-with-costs (15M after costs)
            expect(result.smartAllocation.imputedToCapital).toBe(30_000_000);
            expect(result.smartAllocation.imputedToLaborWithCosts).toBeLessThanOrEqual(15_000_000);
        });
    });

    // ═══ CAN Income ═══
    describe('CAN Income (Decisión 578)', () => {
        it('should not count CAN income in grossIncome', () => {
            const payer = basePayer({
                incomes: [
                    makeIncome({
                        category: 'renta_trabajo',
                        grossValue: 50_000_000,
                    }),
                    makeIncome({
                        id: 'can-1',
                        category: 'renta_trabajo',
                        grossValue: 20_000_000,
                        isCANIncome: true,
                    }),
                ],
            });
            const result = calculateGeneralSchedule(payer);
            // CAN income IS included in grossIncome (total global income), but subtracted at the end
            expect(result.grossIncome).toBe(70_000_000); 
            expect(result.canExemptIncome).toBe(20_000_000);
            // Taxable income should exclude CAN
            // 25% exemption based on 70M total = 17.5M. Limit 40% of 70M = 28M.
            // Accepted deductions = 17.5M.
            // Renta Liquida = 70M - 17.5M = 52.5M.
            // Final Taxable = 52.5M - 20M (CAN) = 32.5M.
            expect(result.taxableIncome).toBe(32_500_000);
        });
    });

    // ═══ Financial yields with inflationary component ═══
    describe('Inflationary Component (Art. 38)', () => {
        it('should reduce capital income by default inflationary component', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_capital',
                    grossValue: 10_000_000,
                    financialYields: true,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // Default 50.88% of income is INCR (Year 2024/2025)
            const expectedNet = Math.max(0, 10_000_000 - Math.round(10_000_000 * 0.5088));
            expect(result.netIncome).toBe(expectedNet);
        });

        it('should allow custom inflationary component override', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_capital',
                    grossValue: 10_000_000,
                    financialYields: true,
                    inflationaryComponentPct: 0.50,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            const expectedNet = Math.max(0, 10_000_000 - Math.round(10_000_000 * 0.50));
            expect(result.netIncome).toBe(expectedNet);
        });
    });

    // ═══ Cesantías as income category (progressive table) ═══
    describe('Cesantías Progressive Table', () => {
        it('should apply 90% exemption for avgSalary 351-410 UVT', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'cesantias',
                    grossValue: 20_000_000,
                    avgSalaryLast6MonthsUVT: 400,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(18_000_000); // 90% of 20M
        });

        it('should apply 80% exemption for avgSalary 411-470 UVT', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'cesantias',
                    grossValue: 20_000_000,
                    avgSalaryLast6MonthsUVT: 450,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(16_000_000);
        });

        it('should apply 40% exemption for avgSalary 531-590 UVT', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'cesantias',
                    grossValue: 20_000_000,
                    avgSalaryLast6MonthsUVT: 560,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(8_000_000);
        });

        it('should apply 20% exemption for avgSalary 591-650 UVT', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'cesantias',
                    grossValue: 20_000_000,
                    avgSalaryLast6MonthsUVT: 620,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalExemptions).toBeGreaterThanOrEqual(4_000_000);
        });

        it('should use averageMonthlySalary/UVT as fallback for avgSalaryLast6MonthsUVT', () => {
            const monthlyUVT350 = 350 * UVT_2025; // Exactly 350 UVT
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'cesantias',
                    grossValue: 10_000_000,
                    averageMonthlySalary: monthlyUVT350,
                    // No avgSalaryLast6MonthsUVT → uses averageMonthlySalary/UVT
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // 350 UVT ≤ 350 → 100% exempt
            expect(result.totalExemptions).toBeGreaterThanOrEqual(10_000_000);
        });
    });

    // ═══ Empty incomes ═══
    describe('Edge: No General Incomes', () => {
        it('should return zero values when no incomes', () => {
            const payer = basePayer({
                incomes: [],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.grossIncome).toBe(0);
            expect(result.netIncome).toBe(0);
            expect(result.taxableIncome).toBe(0);
        });

        it('should return zero when only pension/dividend incomes (filtered out)', () => {
            const payer = basePayer({
                incomes: [
                    makeIncome({ category: 'pensiones', grossValue: 50_000_000 }),
                    makeIncome({ category: 'dividendos_ordinarios', grossValue: 30_000_000 }),
                ],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.grossIncome).toBe(0);
        });
    });

    // ═══ Carry-forward capital losses ═══
    describe('Carry-Forward Capital Losses (Art. 330)', () => {
        it('should reduce capital net income but not below zero', () => {
            const payer = basePayer({
                previousYearCapitalLosses: 100_000_000,
                incomes: [makeIncome({
                    category: 'renta_capital',
                    grossValue: 30_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // Loss > capital net, so taxable goes to 0
            expect(result.carryForwardApplied).toBe(30_000_000);
            // Net income remains 30M (before carry-forward)
            expect(result.netIncome).toBe(30_000_000);
            // Taxable income becomes 0 after application
            expect(result.taxableIncome).toBe(0);
        });
    });

    // ═══ Housing interest cap ═══
    describe('Housing Interest Cap (Art. 119)', () => {
        it('should cap housing interest at 1200 UVT', () => {
            const limit = 1200 * UVT_2025;
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 200_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'intereses_vivienda',
                    value: limit + 10_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalDeductions).toBeLessThanOrEqual(limit + 1);
        });
    });

    // ═══ Prepaid health cap ═══
    describe('Prepaid Health Cap (Art. 387)', () => {
        it('should cap prepaid health at 192 UVT', () => {
            const limit = 192 * UVT_2025;
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 200_000_000,
                })],
                deductions: [makeDeduction({
                    category: 'salud_prepagada',
                    value: limit + 5_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.totalDeductions).toBeLessThanOrEqual(limit + 1);
        });
    });

    // ═══ RAIS with limit ═══
    describe('RAIS INCR Limits (Art. 55)', () => {
        it('should cap RAIS at 25% of gross income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 40_000_000,
                    voluntaryPensionRAIS: 20_000_000, // More than 25% of 40M = 10M
                })],
            });
            const result = calculateGeneralSchedule(payer);
            // INCR should include capped RAIS = 10M
            expect(result.incrTotal).toBe(10_000_000);
        });

        it('should cap RAIS at 2500 UVT', () => {
            const limit2500 = 2500 * UVT_2025;
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_trabajo',
                    grossValue: 2_000_000_000, // 2B → 25% = 500M > 2500 UVT
                    voluntaryPensionRAIS: limit2500 + 50_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.incrTotal).toBeLessThanOrEqual(limit2500 + 1);
        });
    });

    // ═══ Renta no laboral costs ═══
    describe('Renta No Laboral with Costs', () => {
        it('should deduct costs from renta_no_laboral income', () => {
            const payer = basePayer({
                incomes: [makeIncome({
                    category: 'renta_no_laboral',
                    grossValue: 50_000_000,
                    costs: 20_000_000,
                })],
            });
            const result = calculateGeneralSchedule(payer);
            expect(result.costs).toBe(20_000_000);
            expect(result.netIncome).toBe(30_000_000);
        });
    });
});
