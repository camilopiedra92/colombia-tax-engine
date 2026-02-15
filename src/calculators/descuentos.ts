// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — DESCUENTOS TRIBUTARIOS (Art. 254-260-1 ET)
// Se restan directamente del impuesto, no de la base gravable
//
// Normativa completa implementada:
//   • Art. 254 ET: Impuestos pagados en el exterior (crédito fiscal)
//     IMPLEMENTACIÓN CORRECTA: El crédito se limita a la porción del
//     impuesto colombiano atribuible a la renta de fuente extranjera:
//     Límite = (Ingreso Extranjero Neto / Renta Líquida Gravable Total) * Impuesto Básico
//   • Art. 257 ET: Donaciones a entidades RTE — 25% del valor
//   • Art. 257 par. (Ley 2380/2024): Donaciones alimentos — 37% del valor
//   • Art. 256 ET: Inversión en I+D — 25% sobre valor invertido
//   • Art. 258-2 ET: IVA de activos fijos reales productivos
//   • Art. 242 par.: Descuento 19% dividendos (calculado en dividendos.ts)
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer, TaxCredit } from '../types';
import { getTaxRules } from '../rules';

export interface DescuentosResult {
    foreignTaxCredit: number;        // Art. 254: Impuestos pagados en exterior
    donationsGeneral: number;        // 25% donaciones generales
    donationsFood: number;           // 37% donaciones alimentos (Ley 2380/2024)
    rdInvestment: number;            // 25% inversión I+D (Art. 256)
    ivaFixedAssets: number;          // IVA activos fijos (Art. 258-2)
    otherCredits: number;            // Otros descuentos
    totalCredits: number;
}

export function calculateDescuentos(
    payer: TaxPayer,
    totalIncomeTax: number,
    foreignNetIncome: number,
    totalTaxableIncome: number
): DescuentosResult {
    const rules = getTaxRules(payer.year);
    const credits = payer.taxCredits || [];

    // ═══ Art. 254 ET: Impuestos pagados en el exterior ═══
    // Fórmula proporcional correcta:
    // Límite = (Ingreso Extranjero Neto / Renta Líquida Gravable Total) * Impuesto Básico
    // También limitado al impuesto total (no puede dar crédito mayor al impuesto).
    const foreignTaxRaw = credits
        .filter(c => c.category === 'impuesto_exterior')
        .reduce((sum, c) => sum + c.value, 0);
    const proportionalLimit = totalTaxableIncome > 0
        ? Math.round((foreignNetIncome / totalTaxableIncome) * totalIncomeTax)
        : 0;
    const foreignTaxCredit = Math.min(foreignTaxRaw, proportionalLimit, totalIncomeTax);

    // ═══ Art. 257 ET: 25% donaciones a entidades RTE (Art. 22-23) ═══
    const donationsGeneralBase = credits
        .filter(c => c.category === 'donacion_general')
        .reduce((sum, c) => sum + c.value, 0);
    const donationsGeneral = Math.round(donationsGeneralBase * rules.DESCUENTOS.DONATIONS_GENERAL_PCT);

    // ═══ Art. 257 par. (Ley 2380/2024): 37% donaciones alimentos ═══
    // Incluye alimentos aptos para consumo + bienes de higiene y aseo
    // donados a bancos de alimentos. 
    // Año 2024: 25% (Concepto DIAN). Año 2025+: 37%.
    const donationsFoodBase = credits
        .filter(c => c.category === 'donacion_alimentos')
        .reduce((sum, c) => sum + c.value, 0);
        
    const foodRate = payer.year >= 2025 
        ? rules.DESCUENTOS.DONATIONS_FOOD_PCT_2025 
        : rules.DESCUENTOS.DONATIONS_FOOD_PCT_2024;

    const donationsFood = Math.round(donationsFoodBase * foodRate);

    // ═══ Art. 256 ET: Inversión en I+D — 25% ═══
    const rdInvestmentBase = credits
        .filter(c => c.category === 'inversion_id')
        .reduce((sum, c) => sum + c.value, 0);
    const rdInvestment = Math.round(rdInvestmentBase * rules.DESCUENTOS.RD_INVESTMENT_PCT);

    // ═══ Art. 258-2 ET: IVA activos fijos reales productivos ═══
    const ivaFixedAssets = credits
        .filter(c => c.category === 'iva_activos_fijos')
        .reduce((sum, c) => sum + c.value, 0);

    // ═══ Otros descuentos ═══
    const otherCredits = credits
        .filter(c => c.category === 'otro_descuento')
        .reduce((sum, c) => sum + c.value, 0);

    // NOTA: El descuento de dividendos (19%, Art. 242 par.) se calcula
    // en dividendos.ts / index.ts y NO se incluye aquí para evitar doble conteo.

    // ═══ Límite conjunto Art. 258 ET ═══
    // Descuentos por Donaciones (Art. 257) e Inversión I+D (Art. 256)
    // sumados NO pueden exceder el 25% del impuesto básico de renta.
    const groupSubjectToLimit = donationsGeneral + donationsFood + rdInvestment;
    // Art. 258 ET: límite conjunto = 25% del impuesto básico de renta
    const limitPct = rules.DESCUENTOS.GROUP_LIMIT_PCT;
    const groupLimitValue = Math.round(totalIncomeTax * limitPct);
    
    const groupCreditsAllowed = Math.min(groupSubjectToLimit, groupLimitValue);

    const rawTotal = foreignTaxCredit + ivaFixedAssets + otherCredits + groupCreditsAllowed;

    // ═══ Límite global: descuentos no pueden exceder el impuesto a cargo ═══
    const totalCredits = Math.min(rawTotal, totalIncomeTax);

    return {
        foreignTaxCredit,
        donationsGeneral,
        donationsFood,
        rdInvestment,
        ivaFixedAssets,
        otherCredits,
        totalCredits,
    };
}
