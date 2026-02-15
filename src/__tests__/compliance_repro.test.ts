
import { describe, it, expect } from 'vitest';
import { calculateGananciaOcasional } from '../calculators/ganancia-ocasional';
import { calculateGeneralSchedule } from '../calculators/general';
import { calculatePensionesSchedule } from '../calculators/pensiones';
import { checkObligadoDeclarar } from '../calculators/obligados';
import { calculateAnticipo } from '../calculators/anticipo';
import { TaxPayer } from '../types';
import { UVT_BY_YEAR } from '../rules';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR]; // 47,065

describe('Tax Engine Compliance Verification (Ley 2277/2022)', () => {
    
    const basePayer: TaxPayer = {
        id: 'TEST-001',
        name: 'Compliance Test User',
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

    describe('1. Ganancia Ocasional Limits', () => {
        it('should exempt strictly 3,250 UVT for Life Insurance (Seguros de Vida)', () => {
             // Input: 15,000 UVT Insurance
             const grossVal = 15000 * UVT;
             const payer = {
                 ...basePayer,
                 incomes: [{
                     id: 'go1', 
                     category: 'ganancia_ocasional' as const, 
                     grossValue: grossVal,
                     description: 'Seguro de vida indemnización' 
                 }]
             };

             const result = calculateGananciaOcasional(payer);
             
             // Expect: Exempt 3,250 UVT
             const expectedExempt = 3250 * UVT;
             expect(result.exemptions).toBe(expectedExempt);
             expect(result.taxableIncome).toBe(grossVal - expectedExempt);
        });
    });

    describe('2. Two-Year Possession Rule', () => {
        it('should exclude assets held for less than 2 years (730 days)', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: 'go_short',
                    category: 'ganancia_ocasional' as const,
                    grossValue: 100_000_000,
                    description: 'Venta apartamento',
                    heldDurationDays: 365 // < 730 days
                }]
            };

            const result = calculateGananciaOcasional(payer);
            
            // Should be filtered out of GO
            expect(result.grossIncome).toBe(0);
        });

        it('should include assets held for more than 2 years', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: 'go_long',
                    category: 'ganancia_ocasional' as const,
                    grossValue: 100_000_000,
                    description: 'Venta apartamento',
                    heldDurationDays: 800 // > 730 days
                }]
            };

            const result = calculateGananciaOcasional(payer);
            expect(result.grossIncome).toBe(100_000_000);
        });
    });

    describe('3. GMF (4x1000) Inside 40% Limit (Fixed)', () => {
        it('should include GMF INSIDE the 40% limit bucket (Art. 336)', () => {
            // Setup:
            // Net Income = 100M
            // Limit 40% = 40M
            // Deductions Subject to Limit (Interest 50M + GMF 2M) = 52M (capped to 40M)
            // GMF is now INSIDE the bucket → accepted = 40M (no extras)
            
            const netIncome = 100_000_000;
            const payer = {
                ...basePayer,
                incomes: [{
                    id: 'inc1', category: 'renta_trabajo' as const, grossValue: netIncome, description: 'Salario'
                }],
                deductions: [
                    { id: 'd1', category: 'intereses_vivienda' as const, value: 50_000_000, description: 'Interest' },
                    { id: 'd2', category: 'gmf' as const, value: 4_000_000, description: '4x1000 Paid' } // 50% = 2M
                ]
            };

            const result = calculateGeneralSchedule(payer);
            
            expect(result.netIncome).toBe(netIncome);
            expect(result.globalLimit).toBe(netIncome * 0.40); // 40M

            // GMF is INSIDE the 40% bucket now.
            // Total subject = Interest(50M) + GMF(2M) + 25% exempt → all capped at 40M
            // Accepted = 40M (capped at limit, no extra GMF outside)
            expect(result.acceptedClaims).toBe(netIncome * 0.40);
        });
    });

    describe('4. Pension Exemption Limit', () => {
        it('should use 1000 UVT * mesadas (e.g. 14)', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: 'pen1', 
                    category: 'pensiones' as const, 
                    grossValue: 14000 * UVT, // 14,000 UVT
                    numberOfMesadas: 14,
                    description: 'Pension'
                }]
            };

            const result = calculatePensionesSchedule(payer);
            
            // Limit = 14 * 1000 = 14,000 UVT. Entire income exempt.
            expect(result.exemptAmount).toBe(14000 * UVT);
            expect(result.taxableIncome).toBe(0);
        });

        it('should cap at monthly limit', () => {
            const payer = {
                ...basePayer,
                incomes: [{
                    id: 'pen1', 
                    category: 'pensiones' as const, 
                    grossValue: 15000 * UVT, // 15,000 UVT (Excess 1,000 if 14 mesadas)
                    numberOfMesadas: 14,
                    description: 'Pension High'
                }]
            };

            const result = calculatePensionesSchedule(payer);
            
            const limit = 14000 * UVT;
            expect(result.exemptAmount).toBe(limit);
            expect(result.taxableIncome).toBe(1000 * UVT);
        });
    });

    describe('5. Labor Base 25% Exemption Rule (with Smart Allocation)', () => {
        it('should calculate 25% exempt on labor income with Smart Allocation', () => {
             // Scenario:
             // Labor Gross: 100M. Labor INCR: 10M.
             // Capital Gross: 100M. Costs: 0.
             // Housing Interest Deduction: 20M.
             
             // WITH SMART ALLOCATION:
             // laborEligibleNet = 100M - 10M = 90M
             // capitalNonLaborNet = 100M
             // totalNetIncome = 90M + 100M = 190M
             // commonDeductions = housingInterest(20M)
             // imputedToCapital = min(20M, 100M) = 20M → ALL goes to capital!
             // imputedToLaborEligible = 0
             // laborBaseFor25 = 90M - 0 = 90M
             // exempt25 = min(90M * 0.25, 790*UVT) = min(22.5M, 37.18M) = 22.5M
             
             const taxpayer = {
                 ...basePayer,
                 incomes: [
                     { id: '1', category: 'renta_trabajo' as const, grossValue: 100_000_000, healthContribution: 5_000_000, pensionContribution: 5_000_000, description: 'Wages' },
                     { id: '2', category: 'renta_capital' as const, grossValue: 100_000_000, description: 'Interest' }
                 ],
                 deductions: [
                     { id: 'd1', category: 'intereses_vivienda' as const, value: 20_000_000, description: 'Housing Interest' }
                 ]
             };

             const result = calculateGeneralSchedule(taxpayer);
             
             // With Smart Allocation: deductions go to capital first
             // laborBaseFor25 = 90M, exempt25 = 22.5M
             expect(result.totalExemptions).toBe(22_500_000);
             expect(result.smartAllocation.imputedToCapital).toBe(20_000_000);
             expect(result.smartAllocation.imputedToLaborEligible).toBe(0);
        });
    });

    describe('6. Obligados - Strict Inequality', () => {
        it('should NOT be obligated if exactly equal to threshold (1400 UVT)', () => {
            const payer = {
                ...basePayer,
                incomes: [{ id: '1', category: 'renta_trabajo' as const, grossValue: 1400 * UVT, description: 'Exact Limit' }]
            };
            
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(false);
        });

        it('should be obligated if strictly greater than threshold', () => {
            const payer = {
                ...basePayer,
                incomes: [{ id: '1', category: 'renta_trabajo' as const, grossValue: (1400 * UVT) + 1, description: 'Over Limit' }]
            };
            
            const result = checkObligadoDeclarar(payer);
            expect(result.isObligated).toBe(true);
        });
    });

    describe('7. Anticipo Year 1', () => {
        it('should calculate 25% of current tax without averaging with 0', () => {
             // Year 1
             // Net Tax: 100M.
             // Withholding: 0.
             // Anticipo = 25M.
             
             const res = calculateAnticipo({ ...basePayer, declarationYearCount: 1 }, 100_000_000, 0);
             expect(res.anticipoNextYear).toBe(25_000_000);
             expect(res.percentage).toBe(0.25);
        });
    });

    describe('8. Ring-Fencing (Art. 336 ET)', () => {
        it('should prevent capital losses from reducing labor taxable base', () => {
            // Labor: 100M with 10M INCR → laborNet = 90M
            // Capital: 50M gross - 80M costs → capitalNonLaborNet = max(0, 40M - 80M) = 0
            // Without ring-fencing: totalNet = 90+(-30) = 60M ← WRONG
            // With ring-fencing:    totalNet = 90+0 = 90M     ← CORRECT
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 100_000_000,
                        healthContribution: 5_000_000,
                        pensionContribution: 5_000_000,
                        description: 'Salary'
                    },
                    {
                        id: '2', category: 'renta_capital' as const,
                        grossValue: 50_000_000,
                        costs: 80_000_000, // Costs exceed gross → loss
                        description: 'Business with loss'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer);
            // Ring-fencing: capital contributes 0, not -30M
            expect(result.netIncome).toBe(90_000_000); // laborNet(90M) + capitalNet(0) = 90M
        });
    });

    describe('9. RAIS as INCR (Art. 55 ET)', () => {
        it('should deduct RAIS as INCR with 25%/2500 UVT limit', () => {
            // Gross: 200M. RAIS contribution: 80M (40% of gross).
            // RAIS limit: min(200M * 0.25, 2500 * 47065) = min(50M, 117.66M) = 50M
            // So effective RAIS INCR = min(80M, 50M) = 50M
            // Health: 5M, Pension: 5M
            // Total INCR = 5M + 5M + 50M = 60M
            // laborNet = max(0, 200M - 60M) = 140M
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 200_000_000,
                        healthContribution: 5_000_000,
                        pensionContribution: 5_000_000,
                        voluntaryPensionRAIS: 80_000_000,
                        description: 'High earner with RAIS'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer);
            // RAIS capped at 50M (25% of 200M), total INCR = 5M+5M+50M = 60M
            expect(result.incrTotal).toBe(60_000_000);
            expect(result.netIncome).toBe(140_000_000);
        });
    });

    describe('10. Cesantías as Income Category (Art. 206 Num 4)', () => {
        it('should exempt 100% of cesantías when avgSalary <= 350 UVT', () => {
            // Cesantías: 20M, avg salary = 300 UVT (< 350 UVT threshold)
            // → 100% exempt
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'cesantias' as const,
                        grossValue: 20_000_000,
                        avgSalaryLast6MonthsUVT: 300, // <= 350 UVT → 100% exempt
                        description: 'Cesantías 2024'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer);
            // 100% exempt → totalExemptions includes all cesantías
            // The 25% exempt also applies on the remaining base after cesantías
            // laborNet = 20M (no INCR), cesantiasExempt = 20M
            // laborBaseFor25 = max(0, 20M - 20M) = 0 → exempt25 = 0
            // So totalExemptions = 20M (only cesantías)
            expect(result.totalExemptions).toBe(20_000_000);
        });

        it('should exempt 0% when avgSalary > 650 UVT', () => {
            const payer = {
                ...basePayer,
                incomes: [
                    {
                        id: '1', category: 'cesantias' as const,
                        grossValue: 20_000_000,
                        avgSalaryLast6MonthsUVT: 700, // > 650 UVT → 0% exempt
                        description: 'Cesantías high earner'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer);
            // 0% cesantías exempt, but the 25% labor exemption applies
            // laborNet = 20M, cesantiasExempt = 0
            // laborBaseFor25 = max(0, 20M - 0) = 20M
            // exempt25 = min(20M * 0.25, 790 * UVT) = min(5M, 37.18M) = 5M
            expect(result.totalExemptions).toBe(5_000_000);
        });
    });

    describe('11. Year 2026 Support', () => {
        it('should calculate correctly with 2026 UVT ($52,374)', () => {
            const UVT_2026 = UVT_BY_YEAR[2026]; // 52,374
            expect(UVT_2026).toBe(52374);

            const payer2026: TaxPayer = {
                ...basePayer,
                year: 2026,
                incomes: [
                    {
                        id: '1', category: 'renta_trabajo' as const,
                        grossValue: 100_000_000,
                        healthContribution: 4_000_000,
                        pensionContribution: 4_000_000,
                        description: 'Salary 2026'
                    }
                ]
            };

            const result = calculateGeneralSchedule(payer2026);
            // INCR = 4M + 4M = 8M
            // netIncome = 100M - 8M = 92M
            expect(result.incrTotal).toBe(8_000_000);
            expect(result.netIncome).toBe(92_000_000);
            // 25% exempt uses 2026 UVT: min(92M * 0.25, 790 * 52374)
            // = min(23M, 41.37M) = 23M
            expect(result.totalExemptions).toBe(23_000_000);
        });
    });

});
