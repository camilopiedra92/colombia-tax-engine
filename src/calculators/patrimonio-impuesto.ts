// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — IMPUESTO AL PATRIMONIO (Art. 292-3, 295-3 ET)
// Ley 2277 de 2022 — Permanente desde año gravable 2023
//
// Sujetos pasivos: PN y sucesiones ilíquidas con patrimonio
// líquido ≥ 72,000 UVT al 1° de enero del año gravable.
//
// Exclusión: Primeras 12,000 UVT del valor patrimonial de la
// vivienda de habitación del contribuyente.
//
// Tarifas marginales:
//   72,000 – 122,000 UVT: 0.5%
//   122,000 – 239,000 UVT: 1.0%
//   > 239,000 UVT: 1.5%
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer, Asset } from '../types';
import { getTaxRules } from '../rules';

export interface PatrimonioTaxResult {
    isSubject: boolean;
    taxableBase: number;
    tax: number;
}

export function calculatePatrimonioTax(
    payer: TaxPayer,
    patrimonioLiquido: number
): PatrimonioTaxResult {
    const rules = getTaxRules(payer.year);
    const { UVT } = rules;
    const { THRESHOLD_UVT, HOUSING_EXCLUSION_UVT, TABLE } = rules.IMPUESTO_PATRIMONIO;

    // ═══ 1. Determinar si es sujeto pasivo ═══
    const patrimonioUVT = patrimonioLiquido / UVT;
    if (patrimonioUVT < THRESHOLD_UVT) {
        return { isSubject: false, taxableBase: 0, tax: 0 };
    }

    // ═══ 2. Calcular exclusión de vivienda propia ═══
    // Art. 295-3: Se excluyen las primeras 12,000 UVT del valor
    // patrimonial de la casa/apartamento de habitación.
    const primaryResidence = payer.assets.find(
        a => a.description.toLowerCase().includes('vivienda')
            || a.description.toLowerCase().includes('casa')
            || a.description.toLowerCase().includes('apartamento')
    );
    let housingExclusion = 0;
    if (primaryResidence) {
        housingExclusion = Math.min(primaryResidence.value, HOUSING_EXCLUSION_UVT * UVT);
    }

    // ═══ 3. Base gravable ═══
    const taxableBase = Math.max(0, patrimonioLiquido - housingExclusion);
    const taxableBaseUVT = taxableBase / UVT;

    // ═══ 4. Aplicar tabla progresiva (Base + Marginal) ═══

    // Buscar el rango donde: min < taxableBaseUVT <= max
    // Invariante: threshold (72,000 UVT) > max exclusion (12,000 UVT)
    // → taxableBase > 0 → taxableBaseUVT > 0 → TABLE siempre encuentra rango
    // (TABLE[0].min = 0, TABLE[-1].max = Infinity)
    const bracket = TABLE.find(r => taxableBaseUVT > r.min && taxableBaseUVT <= r.max)!;

    const baseTax: number = (bracket as any).baseTax;
    const taxUVT = baseTax + ((taxableBaseUVT - bracket.min) * bracket.rate);

    const tax = Math.round(taxUVT * UVT);

    return {
        isSubject: true,
        taxableBase,
        tax,
    };
}
