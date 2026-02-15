// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — OBLIGADOS A DECLARAR (Art. 592-594 ET)
// Verifica si una persona natural está obligada a presentar declaración
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

export interface ObligadoResult {
    isObligated: boolean;
    reasons: string[];
    thresholds: {
        patrimonioBruto: { threshold: number; actual: number; exceeds: boolean };
        ingresosBrutos: { threshold: number; actual: number; exceeds: boolean };
        consumosTC: { threshold: number; actual: number; exceeds: boolean };
        comprasConsumos: { threshold: number; actual: number; exceeds: boolean };
        consignaciones: { threshold: number; actual: number; exceeds: boolean };
    };
}

export function checkObligadoDeclarar(payer: TaxPayer): ObligadoResult {
    const rules = getTaxRules(payer.year);
    const { UVT, OBLIGADOS } = rules;
    const reasons: string[] = [];

    // 1. Patrimonio bruto > 4,500 UVT
    const patrimonioBruto = payer.assets.reduce((sum, a) => sum + a.value, 0);
    const patThreshold = OBLIGADOS.PATRIMONIO_BRUTO_UVT * UVT;
    const patExceeds = patrimonioBruto > patThreshold; // Estrictamente mayor
    if (patExceeds) {
        reasons.push(`Patrimonio bruto ($${patrimonioBruto.toLocaleString()}) superior a ${OBLIGADOS.PATRIMONIO_BRUTO_UVT} UVT ($${patThreshold.toLocaleString()})`);
    }

    // 2. Ingresos brutos > 1,400 UVT
    const ingresosBrutos = payer.incomes.reduce((sum, i) => sum + i.grossValue, 0);
    const ingThreshold = OBLIGADOS.INGRESOS_BRUTOS_UVT * UVT;
    const ingExceeds = ingresosBrutos > ingThreshold; // Estrictamente mayor
    if (ingExceeds) {
        reasons.push(`Ingresos brutos ($${ingresosBrutos.toLocaleString()}) superiores a ${OBLIGADOS.INGRESOS_BRUTOS_UVT} UVT ($${ingThreshold.toLocaleString()})`);
    }

    // 3. Consumos tarjeta de crédito > 1,400 UVT
    const consumos = payer.creditCardExpenses || 0;
    const tcThreshold = OBLIGADOS.CONSUMOS_TC_UVT * UVT;
    const tcExceeds = consumos > tcThreshold; // Estrictamente mayor
    if (tcExceeds) {
        reasons.push(`Consumos con tarjeta de crédito ($${consumos.toLocaleString()}) superiores a ${OBLIGADOS.CONSUMOS_TC_UVT} UVT ($${tcThreshold.toLocaleString()})`);
    }

    // 4. Compras y consumos > 1,400 UVT
    const compras = payer.totalPurchases || 0;
    const compThreshold = OBLIGADOS.COMPRAS_UVT * UVT;
    const compExceeds = compras > compThreshold; // Estrictamente mayor
    if (compExceeds) {
        reasons.push(`Compras y consumos ($${compras.toLocaleString()}) superiores a ${OBLIGADOS.COMPRAS_UVT} UVT ($${compThreshold.toLocaleString()})`);
    }

    // 5. Consignaciones bancarias > 1,400 UVT
    const consignaciones = payer.bankDeposits || 0;
    const consThreshold = OBLIGADOS.CONSIGNACIONES_UVT * UVT;
    const consExceeds = consignaciones > consThreshold; // Estrictamente mayor
    if (consExceeds) {
        reasons.push(`Consignaciones bancarias ($${consignaciones.toLocaleString()}) superiores a ${OBLIGADOS.CONSIGNACIONES_UVT} UVT ($${consThreshold.toLocaleString()})`);
    }

    // 6. Responsable de IVA (Art. 592 num 1)
    const vatResponsible = !!payer.isVATResponsible;
    if (vatResponsible) {
        reasons.push('Es responsable del impuesto sobre las ventas (IVA)');
    }

    // Está obligado si cumple CUALQUIERA de las condiciones
    const isObligated = patExceeds || ingExceeds || tcExceeds || compExceeds || consExceeds || vatResponsible;

    if (!isObligated) {
        reasons.push('No se cumplen los umbrales para estar obligado a declarar renta');
    }

    return {
        isObligated,
        reasons,
        thresholds: {
            patrimonioBruto: { threshold: patThreshold, actual: patrimonioBruto, exceeds: patExceeds },
            ingresosBrutos: { threshold: ingThreshold, actual: ingresosBrutos, exceeds: ingExceeds },
            consumosTC: { threshold: tcThreshold, actual: consumos, exceeds: tcExceeds },
            comprasConsumos: { threshold: compThreshold, actual: compras, exceeds: compExceeds },
            consignaciones: { threshold: consThreshold, actual: consignaciones, exceeds: consExceeds },
        },
    };
}
