
import { describe, it, expect } from 'vitest';
import { calculateGeneralSchedule } from '../calculators/general';
import { calculateDescuentos } from '../calculators/descuentos';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR]; // 47,065

describe('Auditor Assessment Fixes — Complete Verification', () => {

    const basePayer: TaxPayer = {
        id: 'AUDIT-001',
        name: 'Audit Test User',
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

    // ═══════════════════════════════════════════════════════════════
    // BUG A: GMF (4x1000) DENTRO del límite 40%
    // ═══════════════════════════════════════════════════════════════
    describe('Bug A: GMF inside 40% limit', () => {
        it('should include GMF in the 40% bucket, not add it after', () => {
            // Setup: Net Income = 100M, Limit 40% = 40M
            // Housing Interest: 50M (caps at 40M bucket, but GMF also in bucket)
            // GMF Paid: 4M → Deductible = 2M
            // OLD BEHAVIOR: 40M (capped) + 2M (GMF outside) = 42M accepted
            // NEW BEHAVIOR: Total subject = 50M + 2M = 52M → capped at 40M → Then + dependentsLey2277(0) = 40M
            const payer = {
                ...basePayer,
                incomes: [{
                    id: 'inc1', category: 'renta_trabajo' as const,
                    grossValue: 100_000_000, description: 'Salario'
                }],
                deductions: [
                    { id: 'd1', category: 'intereses_vivienda' as const, value: 50_000_000, description: 'Vivienda' },
                    { id: 'd2', category: 'gmf' as const, value: 4_000_000, description: '4x1000' }
                ]
            };

            const result = calculateGeneralSchedule(payer);

            // Total deductions should include GMF
            expect(result.totalDeductions).toBeGreaterThanOrEqual(2_000_000); // GMF is in totalDeductions

            // With Net=100M, limit = 40M. GMF is INSIDE the bucket.
            // Total subject = intereses(50M capped to limit) + GMF(2M) + 25% exempt
            // All subject to the 40M cap
            expect(result.globalLimit).toBe(40_000_000);
            // acceptedClaims should NOT exceed globalLimit (no GMF added outside)
            // Only facturaElectronica and dependentsLey2277 can exceed
            expect(result.acceptedClaims).toBe(40_000_000); // No factura, no dependents
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // BUG B: Intereses de Cesantías — tabla progresiva (NO 100% exento)
    // ═══════════════════════════════════════════════════════════════
    describe('Bug B: Intereses cesantías progressive degradation', () => {
        it('should apply 100% exemption when avg salary ≤ 350 UVT', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'intereses_cesantias' as const,
                    grossValue: 5_000_000,
                    avgSalaryLast6MonthsUVT: 300,
                    description: 'Intereses cesantías'
                }]
            };
            const result = calculateGeneralSchedule(payer);
            // 100% exempt at ≤ 350 UVT
            // Total exemptions = 5M (cesantías) + 0 (25% of 0 remaining) = 5M
            expect(result.totalExemptions).toBe(5_000_000);
        });

        it('should apply 90% exemption when avg salary 351-410 UVT', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'intereses_cesantias' as const,
                    grossValue: 10_000_000,
                    avgSalaryLast6MonthsUVT: 400,
                    description: 'Intereses cesantías high earner'
                }]
            };
            const result = calculateGeneralSchedule(payer);
            // 90% exempt → 9M exempt
            // Remaining base for 25%: 10M - 9M = 1M → 25% = 250K
            const cesantiasExempt = 9_000_000;
            const exempt25 = 250_000;
            expect(result.totalExemptions).toBe(cesantiasExempt + exempt25);
        });

        it('should apply 0% exemption when avg salary > 650 UVT', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'intereses_cesantias' as const,
                    grossValue: 10_000_000,
                    avgSalaryLast6MonthsUVT: 700,
                    description: 'Intereses cesantías very high'
                }]
            };
            const result = calculateGeneralSchedule(payer);
            // 0% cesantías exempt
            // 25%: min(10M * 0.25, 790*UVT) = min(2.5M, 37.18M) = 2.5M
            expect(result.totalExemptions).toBe(2_500_000);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // BUG C: Dependientes 10% sobre BRUTOS (no netos)
    // ═══════════════════════════════════════════════════════════════
    describe('Bug C: Dependents 10% on gross labor income', () => {
        it('should use gross (not net) labor income for 10% calculation', () => {
            // Gross: 100M, INCR: 10M (health 5M + pension 5M)
            // Net: 90M
            // OLD: 10% of 90M = 9M
            // NEW: 10% of 100M = 10M (capped at 384 UVT)
            const capArt387 = 32 * 12 * UVT; // 384 UVT
            const payer = {
                ...basePayer,
                dependentsCount: 1,
                incomes: [{
                    id: '1', category: 'renta_trabajo' as const,
                    grossValue: 100_000_000,
                    healthContribution: 5_000_000,
                    pensionContribution: 5_000_000,
                    description: 'Salary'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            // 10% of 100M gross = 10M. Cap = 384 * 47,065 = 18,072,960
            // min(10M, 18M) = 10M
            // totalDeductions should include 10M for dependents Art 387
            expect(result.totalDeductions).toBeGreaterThanOrEqual(10_000_000);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // BUG D: AFC/FPV base = Ingreso Tributario (Bruto - INCR)
    // ═══════════════════════════════════════════════════════════════
    describe('Bug D: AFC/FPV base on tributary income', () => {
        it('should use Gross-INCR (not net after costs) for 30% AFC cap', () => {
            // Gross: 100M, INCR: 10M, Costs: 30M
            // Tributary Income = 100M - 10M = 90M
            // Net Income = 100M - 10M - 30M = 60M (old base was 60M*0.3 = 18M)
            // NEW: 30% of 90M = 27M (correct limit)
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'honorarios' as const,
                    grossValue: 100_000_000,
                    healthContribution: 5_000_000,
                    pensionContribution: 5_000_000,
                    costs: 30_000_000,
                    preferCostsOverExemption: true,
                    description: 'Consulting'
                }],
                deductions: [
                    { id: 'afc1', category: 'afc' as const, value: 25_000_000, description: 'AFC' }
                ]
            };

            const result = calculateGeneralSchedule(payer);
            // Tributary income = 100M - 10M = 90M
            // 30% of 90M = 27M → AFC capped at min(25M, 27M) = 25M (full amount accepted)
            // If it were using net (60M): 30% of 60M = 18M → AFC capped at 18M (WRONG)
            expect(result.totalExemptions).toBe(25_000_000);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // BUG E: Cross-contamination del 25% (Sub-cédulas separadas)
    // ═══════════════════════════════════════════════════════════════
    describe('Bug E: Cross-contamination 25% exemption', () => {
        it('should preserve 25% for salary even when honorarios use costs', () => {
            // User has: Salary 80M (eligible for 25%) + Honorarios 40M with costs
            // OLD BUG: preferCostsOverExemption=true on honorarios killed 25% for EVERYTHING
            // NEW: Salary still gets 25%, honorarios get costs separately
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 80_000_000,
                        healthContribution: 4_000_000,
                        pensionContribution: 4_000_000,
                        description: 'Salario'
                    },
                    {
                        id: '2', category: 'honorarios' as const,
                        grossValue: 40_000_000,
                        costs: 15_000_000,
                        preferCostsOverExemption: true,
                        description: 'Consultoría'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer);

            // laborEligibleNet = 80M - 8M = 72M (salary only)
            // laborWithCostsNet = 40M - 15M = 25M (honorarios with costs)
            // capitalNonLaborNet = 0
            // totalNetIncome = 72M + 25M = 97M

            // Smart Allocation: commonDeductions = 0, so all deductions go to labor
            // laborBaseFor25 = 72M - 0 (imputedToLaborEligible) - 0 (dependents) - 0 (cesantías) = 72M
            // exempt25 = min(72M * 0.25, 790*UVT) = min(18M, 37.18M) = 18M
            expect(result.totalExemptions).toBe(18_000_000);
            expect(result.costs).toBe(15_000_000);
        });

        it('should NOT give 25% to honorarios that chose costs', () => {
            // Only honorarios with costs — no salary
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'honorarios' as const,
                    grossValue: 50_000_000,
                    costs: 20_000_000,
                    preferCostsOverExemption: true,
                    description: 'Services'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            // laborEligibleNet = 0 (no eligible labor income)
            // exempt25 = 0
            expect(result.totalExemptions).toBe(0);
            expect(result.costs).toBe(20_000_000);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // SMART ALLOCATION: Maximize 25% by imputing deductions elsewhere
    // ═══════════════════════════════════════════════════════════════
    describe('Smart Allocation optimizer', () => {
        it('should impute deductions to capital first, protecting labor 25% base', () => {
            // Salary: 100M (labor eligible)
            // Capital: 50M (no exemption)
            // Housing Interest: 30M
            //
            // WITHOUT Smart Allocation:
            //   laborBaseFor25 = 100M - 30M = 70M → 25% = 17.5M
            //
            // WITH Smart Allocation:
            //   imputedToCapital = min(30M, 50M) = 30M
            //   imputedToLaborEligible = 0
            //   laborBaseFor25 = 100M - 0 = 100M → 25% = min(25M, 790*UVT) = 25M
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 100_000_000,
                        description: 'Salary'
                    },
                    {
                        id: '2', category: 'renta_capital' as const,
                        grossValue: 50_000_000,
                        description: 'Investments'
                    }
                ],
                deductions: [
                    { id: 'd1', category: 'intereses_vivienda' as const, value: 30_000_000, description: 'Housing' }
                ]
            };

            const result = calculateGeneralSchedule(payer);

            // Smart Allocation breakdown
            expect(result.smartAllocation.imputedToCapital).toBe(30_000_000);
            expect(result.smartAllocation.imputedToLaborEligible).toBe(0);

            // 25% exempt = min(100M * 0.25, 790*UVT) = min(25M, 37.18M) = 25M
            expect(result.totalExemptions).toBe(25_000_000);
        });

        it('should spill excess to labor only when capital is exhausted', () => {
            // Salary: 100M, Capital: 10M, Deductions: 30M
            // imputedToCapital = min(30M, 10M) = 10M
            // remaining = 20M
            // imputedToLaborEligible = 20M
            // laborBaseFor25 = 100M - 20M = 80M → 25% = min(20M, 790*UVT) = 20M
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 100_000_000,
                        description: 'Salary'
                    },
                    {
                        id: '2', category: 'renta_capital' as const,
                        grossValue: 10_000_000,
                        description: 'Small investment'
                    }
                ],
                deductions: [
                    { id: 'd1', category: 'intereses_vivienda' as const, value: 30_000_000, description: 'Housing' }
                ]
            };

            const result = calculateGeneralSchedule(payer);

            expect(result.smartAllocation.imputedToCapital).toBe(10_000_000);
            expect(result.smartAllocation.imputedToLaborEligible).toBe(20_000_000);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // 3A: Art. 254 — Proportional Foreign Tax Credit
    // ═══════════════════════════════════════════════════════════════
    describe('3A: Art. 254 proportional foreign tax credit', () => {
        it('should limit credit proportionally to foreign income ratio', () => {
            // Total taxable: 100M. Foreign net: 30M (30% of total).
            // Total tax: 10M. Foreign tax paid: 5M.
            // Proportional limit = (30M / 100M) * 10M = 3M
            // Credit = min(5M, 3M, 10M) = 3M
            const payer = {
                ...basePayer,
                taxCredits: [{
                    id: 'fc1', category: 'impuesto_exterior' as const,
                    value: 5_000_000, description: 'US Tax'
                }]
            };

            const result = calculateDescuentos(payer, 10_000_000, 30_000_000, 100_000_000);
            expect(result.foreignTaxCredit).toBe(3_000_000);
        });

        it('should return 0 credit when totalTaxableIncome is 0', () => {
            const payer = {
                ...basePayer,
                taxCredits: [{
                    id: 'fc1', category: 'impuesto_exterior' as const,
                    value: 5_000_000, description: 'US Tax'
                }]
            };

            const result = calculateDescuentos(payer, 0, 0, 0);
            expect(result.foreignTaxCredit).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // 3B: Componente Inflacionario (Art. 38 ET)
    // ═══════════════════════════════════════════════════════════════
    describe('3B: Inflationary component for bank yields', () => {
        it('should reduce taxable base by inflationary component percentage', () => {
            // Bank interest: 100M. Inflationary component: 62.62%
            // Effective gross = 100M * (1 - 0.6262) = 37.38M
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'renta_capital' as const,
                    grossValue: 100_000_000,
                    financialYields: true,
                    description: 'CDT interest'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            // After inflationary component, effective = ~49.12M (100M - 50.88M)
            // Net income should reflect this
            const expectedEffective = Math.max(0, 100_000_000 - Math.round(100_000_000 * 0.5088));
            expect(result.netIncome).toBe(expectedEffective);
        });

        it('should allow override of inflationary component percentage', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'renta_capital' as const,
                    grossValue: 100_000_000,
                    financialYields: true,
                    inflationaryComponentPct: 0.70, // Override to 70%
                    description: 'CDT interest custom'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            const expectedEffective = Math.max(0, 100_000_000 - Math.round(100_000_000 * 0.70));
            expect(result.netIncome).toBe(expectedEffective);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // 3C: Pérdidas Fiscales Carry-Forward (Art. 330 ET)
    // ═══════════════════════════════════════════════════════════════
    describe('3C: Carry-forward capital losses', () => {
        it('should reduce capital net by previous year losses', () => {
            // Capital gross: 50M, costs: 10M → net without carry-forward = 40M
            // Previous year losses: 15M
            // Net after carry-forward = 40M - 15M = 25M
            const payer: TaxPayer = {
                ...basePayer,
                previousYearCapitalLosses: 15_000_000,
                incomes: [{
                    id: '1', category: 'renta_capital' as const,
                    grossValue: 50_000_000,
                    costs: 10_000_000,
                    description: 'Investment gains'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            expect(result.carryForwardApplied).toBe(15_000_000);
            // Net income remains 40M because carry-forward is applied AFTER net income (at taxableIncome level)
            expect(result.netIncome).toBe(40_000_000);
            // Taxable income should reflect the deduction
            expect(result.taxableIncome).toBe(25_000_000);
        });

        it('should not reduce below zero', () => {
            // Capital net: 20M, losses: 50M → net = 0 (carry-forward applied = 20M)
            const payer: TaxPayer = {
                ...basePayer,
                previousYearCapitalLosses: 50_000_000,
                incomes: [{
                    id: '1', category: 'renta_capital' as const,
                    grossValue: 20_000_000,
                    description: 'Small gains'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            expect(result.carryForwardApplied).toBe(20_000_000); // Only 20M could be applied
            // Net income is 20M. Taxable becomes 0 after carry-forward.
            expect(result.netIncome).toBe(20_000_000);
            expect(result.taxableIncome).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // 3D: Rentas CAN (Decisión 578 Comunidad Andina)
    // ═══════════════════════════════════════════════════════════════
    describe('3D: CAN income exemption', () => {
        it('should treat CAN income as fully exempt and bypass 40% limit', () => {
            // Salary: 50M. CAN Income: 30M.
            // CAN income is 100% exempt and NOT subject to 40% limit.
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 50_000_000,
                        description: 'Colombian salary'
                    },
                    {
                        id: '2', category: 'renta_trabajo' as const,
                        grossValue: 30_000_000,
                        isCANIncome: true,
                        description: 'Peru salary'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer);
            expect(result.canExemptIncome).toBe(30_000_000);
            // Net income should only include Colombian salary
            // The CAN 30M was added to acceptedClaims outside the 40% limit
            // So acceptedClaims includes CAN
            expect(result.acceptedClaims).toBeGreaterThanOrEqual(30_000_000);
        });

        it('should not include CAN income in the 40% base calculation', () => {
            // Only CAN income → netIncome = 0 (CAN excluded from classification)
            const payer = {
                ...basePayer,
                incomes: [{
                    id: '1', category: 'renta_trabajo' as const,
                    grossValue: 50_000_000,
                    isCANIncome: true,
                    description: 'Bolivia salary'
                }]
            };

            const result = calculateGeneralSchedule(payer);
            expect(result.canExemptIncome).toBe(50_000_000);
            // CAN income is INCLUDED in netIncome (it's part of gross), but subtracted at the very end
            // totalNetIncome includes the 50M
            expect(result.netIncome).toBe(50_000_000); 
            // Taxable income should be 0 because CAN is subtracted at the end
            expect(result.taxableIncome).toBe(0);
        });
    });
});
