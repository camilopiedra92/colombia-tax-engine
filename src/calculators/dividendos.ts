// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — CÉDULA DE DIVIDENDOS (Art. 242, 245 ET, Ley 2277/2022)
//
// Normativa completa implementada:
//   • Art. 242 ET (Ley 2277/2022): Dividendos PN residentes
//     - Sub-cédula 1: Dividendos de utilidades como INCR (Art. 49 num 3)
//       → Se CONSOLIDAN con renta líquida de las demás cédulas (Art. 241)
//       → Impuesto diferencial (marginal) atribuible a dividendos
//       → Descuento tributario del 19%
//     - Sub-cédula 2: Dividendos gravados (Art. 49 par 2)
//       → 35% (Art. 240) + Art. 241 sobre remanente
//   • Art. 242 parágrafo: Retención en la fuente sobre dividendos
//     → 0% hasta 1,090 UVT; 15% sobre exceso de 1,090 UVT
//   • Art. 245 ET: Dividendos para no residentes
//     → Tarifa del 20% sobre el total (sin consolidación)
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer, IncomeCategory } from '../types';
import { getTaxRules, applyTaxTable } from '../rules';

const DIVIDEND_CATEGORIES: IncomeCategory[] = ['dividendos_ordinarios', 'dividendos_gravados'];

export interface DividendosSubCedula1 {
    grossIncome: number;
    taxableIncome: number;            // = grossIncome (se consolida externamente)
    tax: number;                      // Impuesto marginal (calculado en index.ts)
    discount19: number;
    netTax: number;
}

export interface DividendosSubCedula2 {
    grossIncome: number;
    tax35: number;
    remainingBase: number;
    additionalTax: number;
    netTax: number;
}

export interface DividendosResult {
    subCedula1: DividendosSubCedula1;
    subCedula2: DividendosSubCedula2;
    withholding: number;              // Retención en la fuente calculada
    totalTax: number;
    isNonResident: boolean;           // Flag: se usó tarifa Art. 245
}

/**
 * Calcula los dividendos según residencia del contribuyente.
 * 
 * RESIDENTES (Art. 242 ET):
 *   - Sub-cédula 1 se calcula en index.ts por consolidación con las demás cédulas.
 *   - Sub-cédula 2 se calcula aquí: 35% + Art. 241 sobre remanente.
 * 
 * NO RESIDENTES (Art. 245 ET):
 *   - Tarifa plana del 20% sobre el total de dividendos.
 *   - No hay consolidación con otras cédulas.
 */
export function calculateDividendSchedule(payer: TaxPayer): DividendosResult {
    const rules = getTaxRules(payer.year);
    const { UVT, DIVIDENDOS } = rules;

    // ═══ 1. Separar Sub-cédulas ═══
    const sub1Gross = payer.incomes
        .filter(i => i.category === 'dividendos_ordinarios')
        .reduce((sum, i) => sum + i.grossValue, 0);

    const sub2Gross = payer.incomes
        .filter(i => i.category === 'dividendos_gravados')
        .reduce((sum, i) => sum + i.grossValue, 0);

    const totalDividends = sub1Gross + sub2Gross;

    // ═══ NO RESIDENTES: Art. 245 ET — Tarifa plana 20% ═══
    if (!payer.isResident) {
        const nonResidentTax = Math.round(totalDividends * DIVIDENDOS.NON_RESIDENT_RATE);

        // Retención: para no residentes, se aplica 20% sobre el total
        const withholding = nonResidentTax;

        return {
            subCedula1: {
                grossIncome: sub1Gross,
                taxableIncome: sub1Gross,
                tax: 0,
                discount19: 0,
                netTax: 0,
            },
            subCedula2: {
                grossIncome: sub2Gross,
                tax35: 0,
                remainingBase: 0,
                additionalTax: 0,
                netTax: 0,
            },
            withholding,
            totalTax: nonResidentTax,
            isNonResident: true,
        };
    }

    // ═══ RESIDENTES: Art. 242 ET ═══

    // ═══ 2. Sub-cédula 1 (Art. 242 num 1 ET) ═══
    // NOTA CRÍTICA: Desde Ley 2277/2022, los dividendos de sub-cédula 1
    // se SUMAN a la renta líquida gravable de las demás cédulas antes de
    // aplicar la tabla Art. 241. El impuesto se calcula por DIFERENCIA
    // MARGINAL en el orchestrador (index.ts).
    // Aquí solo preparamos los datos; tax se calcula en index.ts.
    const subCedula1: DividendosSubCedula1 = {
        grossIncome: sub1Gross,
        taxableIncome: sub1Gross,      // Base que se consolida
        tax: 0,                        // Se calcula en index.ts por consolidación
        discount19: 0,                 // Se calcula en index.ts después del tax
        netTax: 0,
    };

    // ═══ 3. Sub-cédula 2 (Art. 242 num 2 ET) ═══
    // Paso a: Tarifa Art. 240 (35%) sobre el total gravado
    const tax35 = Math.round(sub2Gross * DIVIDENDOS.SUB2_RATE);

    // Paso b: Remanente = Base original - impuesto 35%
    const remainingBase = Math.max(0, sub2Gross - tax35);

    // Paso c: El remanente se suma a la base gravable general (index.ts)
    // NO se calcula impuesto adicional aquí aisladamente.
    const additionalTax = 0; // Se calculará en consolidadción

    const subCedula2: DividendosSubCedula2 = {
        grossIncome: sub2Gross,
        tax35,
        remainingBase,
        additionalTax,
        netTax: tax35, // Solo incluye el 35% inicial; el resto va al consolidado
    };

    // ═══ 4. Retención en la Fuente (Art. 242 parágrafo) ═══
    // Se aplica sobre dividendos brutos totales:
    //   - 0% hasta 1,090 UVT
    //   - 15% sobre el exceso de 1,090 UVT
    const totalDividendsUVT = totalDividends / UVT;
    let withholding = 0;

    if (totalDividendsUVT > DIVIDENDOS.WITHHOLDING_TABLE[0].max) {
        // Solo se grava el exceso sobre 1,090 UVT al 15%
        const excessUVT = totalDividendsUVT - DIVIDENDOS.WITHHOLDING_TABLE[0].max;
        withholding = Math.round(excessUVT * DIVIDENDOS.WITHHOLDING_TABLE[1].rate * UVT);
    }

    return {
        subCedula1,
        subCedula2,
        withholding,
        totalTax: subCedula2.netTax, // Sub-cédula 1 tax se añade en index.ts
        isNonResident: false,
    };
}
