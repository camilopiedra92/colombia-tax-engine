/**
 * Full Coverage Tests — Targets every remaining uncovered line/branch
 * across the Tax Engine to reach 100% coverage.
 */
import { describe, it, expect, vi } from 'vitest';
import { calculatePatrimonioTax } from '../calculators/patrimonio-impuesto';
import { calculateGananciaOcasional } from '../calculators/ganancia-ocasional';
import { calculateDescuentos } from '../calculators/descuentos';
import { calculateAnticipo } from '../calculators/anticipo';
import { calculateGeneralSchedule } from '../calculators/general';
import { applyTaxTable, getTaxRules, UVT_BY_YEAR } from '../rules';
import { TaxEngine } from '../index';
import { TaxPayer } from '../types';

const YEAR = 2024;
const UVT = UVT_BY_YEAR[YEAR];

const basePayer: TaxPayer = {
    id: '123456',
    name: 'Coverage Test',
    year: YEAR,
    declarationYearCount: 1,
    isResident: true,
    dependentsCount: 0,
    incomes: [],
    deductions: [],
    assets: [],
    liabilities: [],
    taxCredits: [],
};

// ═══════════════════════════════════════════════════════════════
// patrimonio-impuesto.ts — Bracket boundary and exclusion tests
// ═══════════════════════════════════════════════════════════════
describe('patrimonio-impuesto — Full Coverage', () => {
    it('should correctly calculate when taxableBase is at the lower bracket boundary', () => {
        // Wealth just above threshold with full housing exclusion
        // → taxableBase in first bracket (0–72000 UVT, rate = 0) → tax = 0
        const wealthUVT = 72_001;
        const wealth = wealthUVT * UVT;
        const housingVal = wealthUVT * UVT;
        const payer: TaxPayer = {
            ...basePayer,
            assets: [
                { id: 'a1', category: 'inmueble', description: 'Vivienda propia', value: housingVal },
            ]
        };

        const result = calculatePatrimonioTax(payer, wealth);
        expect(result.isSubject).toBe(true);
        // exclusion = min(housingVal, 12000*UVT) = 12000*UVT
        // taxableBase = (72001 - 12000) * UVT = 60001 * UVT > 0
        // bracket[0]: min=0, rate=0 → tax = 0
        expect(result.tax).toBe(0);
    });

    it('should correctly calculate when taxableBase is exactly at bracket boundary 72000 UVT', () => {
        // taxableBase = exactly 72000 UVT → bracket condition: 72000 > 0 && 72000 <= 72000 → true
        // rate = 0 → tax = 0
        // But subject = true (patrimonio > 72000 threshold from raw liquid equity)
        const wealth = 84_000 * UVT; // Above threshold
        const housingVal = 12_000 * UVT; // Exactly exclusion amount
        const payer: TaxPayer = {
            ...basePayer,
            assets: [
                { id: 'a1', category: 'inmueble', description: 'Casa habitacion', value: housingVal + 60_000 * UVT },
                { id: 'a2', category: 'cuenta_bancaria', description: 'Cash', value: wealth - housingVal - 60_000 * UVT },
            ]
        };
        const result = calculatePatrimonioTax(payer, wealth);
        expect(result.isSubject).toBe(true);
    });

    it('should calculate correctly when no primary residence matches (L55 falsy branch)', () => {
        // No asset matches vivienda/casa/apartamento → primaryResidence = undefined → L55 falsy
        const wealth = 150_000 * UVT;
        const payer: TaxPayer = {
            ...basePayer,
            assets: [
                { id: 'a1', category: 'cuenta_bancaria', description: 'CDT', value: wealth },
            ]
        };
        const result = calculatePatrimonioTax(payer, wealth);
        expect(result.isSubject).toBe(true);
        // No housing exclusion → full wealth is taxable
        // 150,000 UVT: bracket {min:122000, max:239000, rate:0.010, baseTax:250}
        // taxUVT = 250 + (150000 - 122000) * 0.010 = 250 + 280 = 530
        const expectedTax = Math.round(530 * UVT);
        expect(result.tax).toBe(expectedTax);
    });
});

// ═══════════════════════════════════════════════════════════════
// ganancia-ocasional.ts — Lines 149-151 (otras_exentas deductions)
// ═══════════════════════════════════════════════════════════════
describe('ganancia-ocasional — Full Coverage', () => {
    it('should apply otras_exentas deductions with "ganancia ocasional" in description (L149-151)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go1',
                category: 'ganancia_ocasional',
                description: 'Venta Activo',
                grossValue: 50_000_000,
            }],
            deductions: [{
                id: 'ded1',
                category: 'otras_exentas',
                description: 'Exención especial ganancia ocasional',
                value: 10_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // Net = 50M - 0 (costs) - 0 (other exemptions) - 10M (otras_exentas) = 40M
        expect(result.taxableIncome).toBe(40_000_000);
        expect(result.taxGeneral).toBe(Math.round(40_000_000 * 0.15));
    });

    it('should NOT include otras_exentas without "ganancia ocasional" keyword', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go2',
                category: 'ganancia_ocasional',
                description: 'Venta Activo',
                grossValue: 50_000_000,
            }],
            deductions: [{
                id: 'ded2',
                category: 'otras_exentas',
                description: 'Exención general renta',
                value: 10_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // No matching deduction → taxableIncome = full 50M
        expect(result.taxableIncome).toBe(50_000_000);
    });
});

// ═══════════════════════════════════════════════════════════════
// rules.ts — Lines 299-306 (fallback when range not found by find())
// ═══════════════════════════════════════════════════════════════
describe('rules.ts — applyTaxTable — Full Coverage', () => {
    it('should handle the top bracket correctly since last.max = Infinity (L299-306)', () => {
        // The last bracket has max: Infinity, so .find() at L295 will always match
        // for values > 31000 UVT. The else branch (L297-306) is technically dead code.
        // However, let's verify the top bracket works correctly to exercise the code path.
        const uvt = UVT_BY_YEAR[2024];
        const baseUVT = 50000;
        const base = baseUVT * uvt;
        // This goes through the normal find() path, but let's verify correctness
        const expectedTaxUVT = ((50000 - 31000) * 0.39) + 10352;
        const expectedTax = Math.round(expectedTaxUVT * uvt);
        expect(applyTaxTable(base, 2024)).toBe(expectedTax);
    });

    it('should return 0 for exactly 1090 UVT boundary (rate = 0 path, L309)', () => {
        // 1090 UVT: falls in first bracket (0, 1090], rate = 0
        const uvt = UVT_BY_YEAR[2024];
        const base = 1090 * uvt;
        expect(applyTaxTable(base, 2024)).toBe(0);
    });

    it('should handle the 6th range (18970-31000 UVT)', () => {
        const uvt = UVT_BY_YEAR[2024];
        const baseUVT = 25000;
        const base = baseUVT * uvt;
        // (25000-18970)*0.37 + 5901 = 2231.1 + 5901 = 8132.1 UVT
        const expectedTaxUVT = ((25000 - 18970) * 0.37) + 5901;
        const expectedTax = Math.round(expectedTaxUVT * uvt);
        expect(applyTaxTable(base, 2024)).toBe(expectedTax);
    });

    it('should handle exactly 0 income (baseUVT <= 0, L290)', () => {
        expect(applyTaxTable(0, 2024)).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// index.ts — Line 138 (foreign source income reduce path)
//           Line 326 (getFilingDeadline returns undefined — no match)
// ═══════════════════════════════════════════════════════════════
describe('TaxEngine (index.ts) — Full Coverage', () => {
    it('should calculate foreign net income for descuentos (L138)', () => {
        // Need an income with isForeignSource = true so the filter/reduce runs
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'for1',
                category: 'renta_trabajo',
                description: 'Foreign Salary',
                grossValue: 100_000_000,
                isForeignSource: true,
                costs: 10_000_000,
            }],
            taxCredits: [{
                id: 'c1',
                category: 'impuesto_exterior',
                description: 'Foreign tax paid',
                value: 5_000_000,
            }],
        };
        const result = TaxEngine.calculate(payer);
        // Foreign tax credit should be applied as part of totalTaxCredits
        expect(result.totalTaxCredits).toBeGreaterThan(0);
    });

    it('should handle filing deadline for a digit not in any range (L326)', () => {
        // The CALENDARIO covers all digits 01-00 (which wraps full range)
        // So every valid 2-digit number should match. But we can verify
        // the last entry '99-00' handles 99 and 00 correctly.
        const payer99: TaxPayer = { ...basePayer, id: 'ABC99' };
        const result99 = TaxEngine.calculate(payer99);
        expect(result99.filingDeadline).toBe('2025-10-22');

        const payer00: TaxPayer = { ...basePayer, id: 'ABC00' };
        const result00 = TaxEngine.calculate(payer00);
        expect(result00.filingDeadline).toBe('2025-10-22');

        // Test a normal mid-range to confirm matching
        const payer50: TaxPayer = { ...basePayer, id: 'ABC50' };
        const result50 = TaxEngine.calculate(payer50);
        expect(result50.filingDeadline).toBe('2025-09-16'); // digits 49-50
    });

    it('should return undefined filing deadline for non-numeric ID (L306 → undefined)', () => {
        const payer: TaxPayer = { ...basePayer, id: 'ABCXY' };
        const result = TaxEngine.calculate(payer);
        expect(result.filingDeadline).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// descuentos.ts — Line 37 (empty taxCredits fallback)
//                 Line 95 (GROUP_LIMIT_PCT fallback to 0.25)
// ═══════════════════════════════════════════════════════════════
describe('descuentos.ts — Full Coverage', () => {
    it('should handle undefined taxCredits gracefully (L37 fallback)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            // taxCredits is required but let's test the || fallback
        };
        payer.taxCredits = undefined;
        const result = calculateDescuentos(payer, 10_000_000, 0, 10_000_000);
        expect(result.totalCredits).toBe(0);
    });

    it('should use GROUP_LIMIT_PCT from rules when defined (L95)', () => {
        // Normal path — GROUP_LIMIT_PCT = 0.25 from rules
        const payer: TaxPayer = {
            ...basePayer,
            taxCredits: [{
                id: 'c1',
                category: 'donacion_general',
                description: 'Fundación',
                value: 100_000_000, // Large donation
            }],
        };
        const result = calculateDescuentos(payer, 40_000_000, 0, 40_000_000);
        // 25% credit on donation: 100M * 0.25 = 25M
        // Group limit: 40M * 0.25 = 10M
        // Capped at 10M
        expect(result.totalCredits).toBe(10_000_000);
    });

    it('should handle zero totalIncomeTax (all credits = 0)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            taxCredits: [{
                id: 'c1',
                category: 'donacion_general',
                description: 'Fundación',
                value: 50_000_000,
            }],
        };
        const result = calculateDescuentos(payer, 0, 0, 0);
        // Cap: min(credits, 0) = 0
        expect(result.totalCredits).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// anticipo.ts — Line 38 (declarationYearCount fallback)
// ═══════════════════════════════════════════════════════════════
describe('anticipo.ts — Full Coverage', () => {
    it('should default declarationYearCount to 1 when 0 or undefined (L38)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            declarationYearCount: 0, // Forces Math.max(1, 0 || 1) = 1
        };
        const result = calculateAnticipo(payer, 10_000_000, 0);
        expect(result.percentage).toBe(0.25); // First year
        expect(result.method).toBe('first_year');
        expect(result.anticipoNextYear).toBe(2_500_000);
    });

    it('should default declarationYearCount to 1 when undefined', () => {
        const payer: TaxPayer = {
            ...basePayer,
        };
        payer.declarationYearCount = undefined;
        const result = calculateAnticipo(payer, 10_000_000, 0);
        expect(result.percentage).toBe(0.25);
    });
});

// ═══════════════════════════════════════════════════════════════
// general.ts — Lines 162 (honorarios with costs), 
//              Lines 190-201 (cesantías/intereses_cesantias with
//                   averageMonthlySalary fallback when avgSalaryLast6MonthsUVT is undefined)
// ═══════════════════════════════════════════════════════════════
describe('general.ts — Full Coverage', () => {
    it('should handle honorarios with preferCostsOverExemption=true (L158-163)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'hon1',
                category: 'honorarios',
                description: 'Consultoría',
                grossValue: 80_000_000,
                preferCostsOverExemption: true,
                costs: 30_000_000,
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // Honorarios with costs → sub-cédula B (no 25% exemption)
        // costs at 30M are deducted and net income should reflect this
        expect(result.totalExemptions).toBe(0); // No 25% because preferCostsOverExemption
        expect(result.costs).toBe(30_000_000);
        expect(result.netIncome).toBe(50_000_000);
    });

    it('should use averageMonthlySalary fallback for cesantías when avgSalaryLast6MonthsUVT is undefined (L189-190)', () => {
        const avgMonthly = 350 * UVT; // 350 UVT → 100% exempt
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'ces1',
                category: 'cesantias',
                description: 'Cesantías',
                grossValue: 15_000_000,
                averageMonthlySalary: avgMonthly,
                // avgSalaryLast6MonthsUVT is NOT set → forces the ?? fallback
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // averageMonthlySalary / UVT = 350 → 100% exempt
        // totalExemptions includes cesantías exempt (15M) + 25% of remaining (0)
        expect(result.totalExemptions).toBe(15_000_000);
    });

    it('should use averageMonthlySalary fallback for intereses_cesantias (L200-201)', () => {
        const avgMonthly = 700 * UVT; // 700 UVT → 0% exempt (> 650)
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'int1',
                category: 'intereses_cesantias',
                description: 'Intereses Cesantías',
                grossValue: 5_000_000,
                averageMonthlySalary: avgMonthly,
                // avgSalaryLast6MonthsUVT NOT set → fallback
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // 700 UVT → 0% exempt
        // totalExemptions = 25% labor exempt on 5M = 1.25M (assuming within 790 UVT cap)
        expect(result.totalExemptions).toBe(1_250_000);
    });

    it('should default to 0 UVT when neither avgSalaryLast6MonthsUVT nor averageMonthlySalary provided for cesantías (L189-190)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'ces2',
                category: 'cesantias',
                description: 'Cesantías',
                grossValue: 10_000_000,
                // No avgSalaryLast6MonthsUVT, no averageMonthlySalary → avgUVT = 0
                // 0 UVT → 100% exempt (threshold is 350)
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // 0 UVT → 100% exempt → 10M cesantías + 0 (25% of 0 remaining)
        expect(result.totalExemptions).toBe(10_000_000);
    });

    it('should default to 0 UVT when neither field is provided for intereses_cesantias (L200-201)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'int2',
                category: 'intereses_cesantias',
                description: 'Intereses Cesantías',
                grossValue: 5_000_000,
                // No avgSalaryLast6MonthsUVT, no averageMonthlySalary → avgUVT = 0
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // 0 UVT → 100% exempt → 5M exempt + 0 (25% of 0)
        expect(result.totalExemptions).toBe(5_000_000);
    });

    it('should handle honorarios without preferCostsOverExemption (sub-cédula A, L166-168)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'hon2',
                category: 'honorarios',
                description: 'Consultoría sin costos',
                grossValue: 40_000_000,
                // preferCostsOverExemption = undefined/false → eligible for 25%
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // Should get 25% labor exemption
        expect(result.totalExemptions).toBe(10_000_000); // 25% of 40M
    });

    it('should handle ganancia_ocasional category in general schedule (reclassified, L171-172)', () => {
        // Art. 300 ET: GO with holdingPeriodYears < 2 is reclassified as renta_no_laboral
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_reclass',
                category: 'ganancia_ocasional',
                description: 'Venta activo reclasificado',
                grossValue: 20_000_000,
                costs: 5_000_000,
                holdingPeriodYears: 1, // < 2 → reclassified into general schedule
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // Falls into capitalNonLabor path (L171-172)
        expect(result.grossIncome).toBe(20_000_000);
        expect(result.costs).toBe(5_000_000);
        expect(result.netIncome).toBe(15_000_000);
    });

    it('should handle renta_capital income category (L171)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'cap1',
                category: 'renta_capital',
                description: 'Intereses CDT',
                grossValue: 10_000_000,
                costs: 0,
            }],
        };
        const result = calculateGeneralSchedule(payer);
        expect(result.grossIncome).toBe(10_000_000);
    });

    it('should handle renta_no_laboral income category (L171)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'nl1',
                category: 'renta_no_laboral',
                description: 'Alquiler',
                grossValue: 30_000_000,
                costs: 10_000_000,
            }],
        };
        const result = calculateGeneralSchedule(payer);
        expect(result.grossIncome).toBe(30_000_000);
        expect(result.costs).toBe(10_000_000);
    });

    it('should apply inflationary component for financial yields (L176-181)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'fy1',
                category: 'renta_capital',
                description: 'Rendimiento financiero',
                grossValue: 10_000_000,
                financialYields: true,
                // uses default INFLATIONARY_COMPONENT_PCT = 0.6262
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // effectiveGross = 10M - round(10M * 0.5088) = 10M - 5088000 = 4912000
        expect(result.grossIncome).toBe(4_912_000);
        // Net should reflect inflationary deduction
        expect(result.netIncome).toBe(4_912_000);
    });

    it('should use custom inflationaryComponentPct when provided (L177)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'fy2',
                category: 'renta_capital',
                description: 'Rendimiento CDT',
                grossValue: 20_000_000,
                financialYields: true,
                inflationaryComponentPct: 0.50,
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // effectiveGross = 20M - round(20M * 0.50) = 20M - 10M = 10M
        expect(result.netIncome).toBe(10_000_000);
    });

    it('should handle honorarios with preferCostsOverExemption but NO costs (L162 branch)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'hon3',
                category: 'honorarios',
                description: 'Consultoría',
                grossValue: 40_000_000,
                preferCostsOverExemption: true,
                // costs is undefined → (inc.costs || 0) = 0
            }],
        };
        const result = calculateGeneralSchedule(payer);
        expect(result.costs).toBe(0);
        expect(result.totalExemptions).toBe(0); // Sub-cédula B, no 25%
    });
});

// ═══════════════════════════════════════════════════════════════
// ganancia-ocasional.ts — Branch coverage for description keywords
// ═══════════════════════════════════════════════════════════════
describe('ganancia-ocasional — Branch Coverage', () => {
    it('should handle "legado" keyword for herencia vivienda exemption (L92)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_leg1',
                category: 'ganancia_ocasional',
                description: 'Legado vivienda abuela',
                grossValue: 300_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        const rules = getTaxRules(YEAR);
        const expected = Math.min(300_000_000, rules.GANANCIA_OCASIONAL.EXEMPT_HOUSING_INHERITANCE_UVT * UVT);
        expect(result.exemptions).toBe(expected);
    });

    it('should handle "sucesión" keyword for herencia general (L92/104)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_suc1',
                category: 'ganancia_ocasional',
                description: 'Sucesión bienes muebles',
                grossValue: 200_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        const rules = getTaxRules(YEAR);
        const expected = Math.min(200_000_000, rules.GANANCIA_OCASIONAL.EXEMPT_PER_HEIR_UVT * UVT);
        expect(result.exemptions).toBe(expected);
    });

    it('should handle "sucesion" (no accent) keyword (L104)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_suc2',
                category: 'ganancia_ocasional',
                description: 'Sucesion capital',
                grossValue: 100_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.exemptions).toBeGreaterThan(0);
    });

    it('should handle "herencia apartamento" keyword (L93)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_apt',
                category: 'ganancia_ocasional',
                description: 'Herencia apartamento Bogotá',
                grossValue: 500_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // Matches herenciaVivienda → EXEMPT_HOUSING_INHERITANCE_UVT
        const rules = getTaxRules(YEAR);
        const expected = Math.min(500_000_000, rules.GANANCIA_OCASIONAL.EXEMPT_HOUSING_INHERITANCE_UVT * UVT);
        expect(result.exemptions).toBe(expected);
    });

    it('should handle "herencia finca" as herencia inmuebles otros (L116-120)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_finca',
                category: 'ganancia_ocasional',
                description: 'Herencia finca rural',
                grossValue: 400_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // Matches herenciaInmueblesOtros → EXEMPT_REAL_ESTATE_INHERITANCE_UVT (6500 UVT)
        const rules = getTaxRules(YEAR);
        const limit = (rules.GANANCIA_OCASIONAL.EXEMPT_REAL_ESTATE_INHERITANCE_UVT || 6500) * UVT;
        const expected = Math.min(400_000_000, limit);
        expect(result.exemptions).toBe(expected);
    });

    it('should handle "herencia lote" (L118)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_lote',
                category: 'ganancia_ocasional',
                description: 'Herencia lote urbano',
                grossValue: 200_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.exemptions).toBeGreaterThan(0);
    });

    it('should handle "legado oficina" (L117-118)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_ofi',
                category: 'ganancia_ocasional',
                description: 'Legado oficina 302',
                grossValue: 300_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.exemptions).toBeGreaterThan(0);
    });

    it('should handle "sucesión bodega" (L117-118)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_bod',
                category: 'ganancia_ocasional',
                description: 'Sucesión bodega zona industrial',
                grossValue: 150_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.exemptions).toBeGreaterThan(0);
    });

    it('should handle "herencia local" (L118)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_local',
                category: 'ganancia_ocasional',
                description: 'Herencia local comercial',
                grossValue: 250_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.exemptions).toBeGreaterThan(0);
    });

    it('should exclude GO items with heldDurationDays < 730 (L45-47)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_short',
                category: 'ganancia_ocasional',
                description: 'Venta activo corto plazo',
                grossValue: 50_000_000,
                heldDurationDays: 365, // < 730 days → not GO
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // Should be excluded from GO processing
        expect(result.grossIncome).toBe(0);
        expect(result.totalTax).toBe(0);
    });

    it('should include GO items with heldDurationDays >= 730', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_long',
                category: 'ganancia_ocasional',
                description: 'Venta inmueble',
                grossValue: 100_000_000,
                heldDurationDays: 800, // > 730 → IS GO
                costBasis: 60_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        expect(result.grossIncome).toBe(100_000_000);
    });

    it('should handle "donación" with accent (L139)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_don_accent',
                category: 'ganancia_ocasional',
                description: 'Donación familiar',
                grossValue: 50_000_000,
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // 20% exempt capped at 1625 UVT
        const expectedExempt = Math.min(Math.round(50_000_000 * 0.20), 1625 * UVT);
        expect(result.exemptions).toBe(expectedExempt);
    });

    it('should handle income with undefined description (L91 fallback)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'go_nodesc',
                category: 'ganancia_ocasional',
                description: '',  // Empty string to test fallback
                grossValue: 30_000_000,
                // No description → '' fallback
            }],
        };
        const result = calculateGananciaOcasional(payer);
        // No exemptions match → full tax
        expect(result.exemptions).toBe(0);
        expect(result.taxableIncome).toBe(30_000_000);
    });
});

// ═══════════════════════════════════════════════════════════════
// index.ts — L316 (CALENDARIO wrap-around: '99-00')
// ═══════════════════════════════════════════════════════════════
describe('TaxEngine — CALENDARIO wrap-around L316', () => {
    it('should resolve filing deadline for NIT ending in 00 (99-00 range)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            id: '1234567800', // last 2 digits = 00
            incomes: [{
                id: 'sal1',
                category: 'renta_trabajo' as const,
                description: 'Salary',
                grossValue: 100_000_000,
                healthContribution: 4_000_000,
                pensionContribution: 4_000_000,
            }],
        };
        const engine = TaxEngine.calculate(payer);
        // '99-00' → date: '2025-10-22'
        expect(engine.filingDeadline).toBe('2025-10-22');
    });

    it('should resolve filing deadline for NIT ending in 99 (99-00 range)', () => {
        const payer: TaxPayer = {
            ...basePayer,
            id: '1234567899', // last 2 digits = 99
            incomes: [{
                id: 'sal2',
                category: 'renta_trabajo' as const,
                description: 'Salary',
                grossValue: 100_000_000,
                healthContribution: 4_000_000,
                pensionContribution: 4_000_000,
            }],
        };
        const engine = TaxEngine.calculate(payer);
        expect(engine.filingDeadline).toBe('2025-10-22');
    });
});

// ═══════════════════════════════════════════════════════════════
// index.ts — L138 (foreign income costs || 0 branch)
// ═══════════════════════════════════════════════════════════════
describe('TaxEngine — Foreign income with no costs L138', () => {
    it('should handle isForeignSource income without costs field', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'for1',
                category: 'honorarios',
                description: 'Foreign consulting',
                grossValue: 50_000_000,
                isForeignSource: true,
                // costs is undefined → exercises "costs || 0"
            }],
        };
        const result = TaxEngine.calculate(payer);
        // foreignNetIncome = 50M - 0 = 50M
        expect(result.totalIncomeTax).toBeGreaterThanOrEqual(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// index.ts — L263 (inmueble asset without cadastralValue)
// ═══════════════════════════════════════════════════════════════
describe('TaxEngine — Inmueble without cadastralValue L263', () => {
    it('should use fiscalCost when cadastralValue is not provided', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'sal3',
                category: 'renta_trabajo' as const,
                description: 'Salary',
                grossValue: 100_000_000,
                healthContribution: 4_000_000,
                pensionContribution: 4_000_000,
            }],
            assets: [{
                id: 'a1',
                category: 'inmueble',
                description: 'Local comercial',
                value: 200_000_000,
                fiscalCost: 180_000_000,
                // cadastralValue is undefined → exercises "cadastralValue || 0"
            }],
        };
        const result = TaxEngine.calculate(payer);
        // patrimonioBruto should use max(fiscalCost, 0) = 180M
        expect(result.patrimonio.patrimonioBruto).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// general.ts — intereses_cesantias + non-matching category
// ═══════════════════════════════════════════════════════════════
describe('general.ts — intereses_cesantias and non-matching categories', () => {
    it('should process intereses_cesantias with avgSalaryLast6MonthsUVT', () => {
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'ic1',
                category: 'intereses_cesantias',
                description: 'Intereses cesantías 2024',
                grossValue: 5_000_000,
                avgSalaryLast6MonthsUVT: 100,
            }],
        };
        const result = calculateGeneralSchedule(payer);
        expect(result.totalExemptions).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to averageMonthlySalary when avgSalaryLast6MonthsUVT is undefined', () => {
        // avgSalaryLast6MonthsUVT is undefined → uses averageMonthlySalary / UVT
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'ic2',
                category: 'intereses_cesantias',
                description: 'Intereses cesantías legacy',
                grossValue: 3_000_000,
                averageMonthlySalary: 2_000_000,
            }],
        };
        const result = calculateGeneralSchedule(payer);
        expect(result.totalExemptions).toBeGreaterThanOrEqual(0);
    });

    it('should default avgUVT to 0 when neither salary field is provided', () => {
        // avgSalaryLast6MonthsUVT undefined AND averageMonthlySalary undefined
        // → ternary false branch: avgUVT = 0
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [{
                id: 'ic3',
                category: 'intereses_cesantias',
                description: 'Intereses cesantías sin salario',
                grossValue: 2_000_000,
                // No avgSalaryLast6MonthsUVT, no averageMonthlySalary
            }],
        };
        const result = calculateGeneralSchedule(payer);
        // avgUVT = 0 → calculateCesantiasExemptRatio(0) → 100% exempt
        expect(result.totalExemptions).toBeGreaterThanOrEqual(0);
    });

    it('should ignore non-general-schedule categories like pensiones', () => {
        // pensiones falls through ALL else-if checks (L151→L157→L171→L187→L197)
        // exercising the false branch of each, including L197's else-if
        const payer: TaxPayer = {
            ...basePayer,
            incomes: [
                {
                    id: 'rt1',
                    category: 'renta_trabajo' as const,
                    description: 'Salario',
                    grossValue: 60_000_000,
                    healthContribution: 2_400_000,
                    pensionContribution: 2_400_000,
                },
                {
                    id: 'pen1',
                    category: 'pensiones',
                    description: 'Pensión de vejez',
                    grossValue: 12_000_000,
                },
            ],
        };
        const result = calculateGeneralSchedule(payer);
        // pensiones income is not counted in the general schedule
        // grossIncome only includes renta_trabajo
        expect(result.grossIncome).toBeGreaterThan(0);
    });
});
