// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — CÉDULA DE PENSIONES (Art. 337 ET)
// Pensiones de jubilación, invalidez, vejez, sobrevivientes, riesgos laborales
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

export interface PensionesResult {
    grossIncome: number;
    exemptAmount: number;
    taxableIncome: number;
    tax: number;
}

export function calculatePensionesSchedule(payer: TaxPayer): PensionesResult {
    const rules = getTaxRules(payer.year);
    const { UVT, PENSIONES } = rules;

    // 1. Filtrar ingresos de pensiones
    const pensionIncomes = payer.incomes.filter(i => i.category === 'pensiones');

    if (pensionIncomes.length === 0) {
        return { grossIncome: 0, exemptAmount: 0, taxableIncome: 0, tax: 0 };
    }

    // 2. Total ingresos brutos por pensiones
    const grossIncome = pensionIncomes.reduce((sum, i) => sum + i.grossValue, 0);

    // 3. Exención: hasta 1,000 UVT mensuales (Art. 206 num 5 ET)
    // Para el cálculo anual, usamos 1,000 UVT * número de mesadas
    // Buscamos el mayor número de mesadas reportado en los ingresos pensionales
    const maxMesadas = pensionIncomes.reduce((max, i) => Math.max(max, i.numberOfMesadas || 13), 13);
    const exemptLimit = PENSIONES.EXEMPT_MONTHLY_UVT * maxMesadas * UVT;
    const exemptAmount = Math.min(grossIncome, exemptLimit);

    // 4. Renta líquida gravable = Excedente sobre la exención
    // Art. 337: NO se permiten deducciones ni rentas exentas adicionales
    const taxableIncome = Math.max(0, grossIncome - exemptAmount);

    // El impuesto se calculará externamente con la tabla Art. 241
    return {
        grossIncome,
        exemptAmount,
        taxableIncome,
        tax: 0, // Se calcula afuera
    };
}
