// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — ANTICIPO DE RENTA (Art. 807 ET)
// Anticipo para el año fiscal siguiente
//
// Normativa completa implementada:
//   • Art. 807 ET: Cálculo del anticipo según año de declaración
//     - 1er año: 25% del impuesto neto de renta actual
//     - 2do año: 50% (menor entre imp. actual y promedio 2 últimos años)
//     - 3er año+: 75% (menor entre imp. actual y promedio 2 últimos años)
//   • Art. 808 ET: Reducción del anticipo (no implementada — requiere solicitud DIAN)
//   • Art. 809 ET: El contribuyente elige la opción más favorable
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

export type AnticipoMethod = 'first_year' | 'second_year' | 'third_year_plus';

export interface AnticipoResult {
    anticipoNextYear: number;        // Anticipo calculado para el año siguiente
    anticipoPreviousYear: number;    // Anticipo pagado año anterior (se resta)
    method: AnticipoMethod;
    percentage: number;              // Porcentaje aplicado (0.25, 0.50, 0.75)
    option1?: number;                // Opción 1: sobre impuesto del año actual
    option2?: number;                // Opción 2: sobre promedio últimos 2 años
}

export function calculateAnticipo(
    payer: TaxPayer,
    netIncomeTax: number,           // Impuesto neto de renta del año actual
    totalWithholding: number        // Total retenciones del año actual
): AnticipoResult {
    const rules = getTaxRules(payer.year);
    const { ANTICIPO } = rules;

    const anticipoPreviousYear = payer.previousYearAdvance || 0;
    const previousTax = payer.previousYearTax || 0;
    const yearCount = Math.max(1, payer.declarationYearCount || 1);

    // ═══ Determinar porcentaje y método según año de declaración ═══
    let percentage: number;
    let method: AnticipoMethod;

    if (yearCount === 1) {
        percentage = ANTICIPO.FIRST_YEAR_PCT;    // 25%
        method = 'first_year';
    } else if (yearCount === 2) {
        percentage = ANTICIPO.SECOND_YEAR_PCT;   // 50%
        method = 'second_year';
    } else {
        percentage = ANTICIPO.THIRD_YEAR_PLUS_PCT; // 75%
        method = 'third_year_plus';
    }

    // ═══ Primer año: solo sobre impuesto neto actual ═══
    if (yearCount === 1) {
        // Art. 807: "Para el primer año ... el veinticinco por ciento (25%) del impuesto neto de renta"
        // NO se promedia con nada.
        const anticipo = Math.max(
            0,
            Math.round(netIncomeTax * percentage) - totalWithholding
        );
        return {
            anticipoNextYear: anticipo,
            anticipoPreviousYear,
            method,
            percentage,
            option1: anticipo, // Para consistencia
        };
    }

    // ═══ Segundo año y siguientes: menor entre 2 opciones ═══
    // Art. 807 / Art. 809: El contribuyente puede elegir la opción más favorable

    // Opción 1: Porcentaje sobre impuesto neto de renta del año actual
    const option1 = Math.round(netIncomeTax * percentage) - totalWithholding;

    // Opción 2: Porcentaje sobre promedio de los últimos 2 años
    const avgTax = (netIncomeTax + previousTax) / 2;
    const option2 = Math.round(avgTax * percentage) - totalWithholding;

    // Se toma el menor de los dos (beneficio del contribuyente)
    const anticipo = Math.max(0, Math.min(option1, option2));

    return {
        anticipoNextYear: anticipo,
        anticipoPreviousYear,
        method,
        percentage,
        option1: Math.max(0, option1),
        option2: Math.max(0, option2),
    };
}
