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

import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

export interface PatrimonioTaxResult {
  isSubject: boolean;
  taxableBase: number;
  tax: number;
}

export function calculatePatrimonioTax(
  payer: TaxPayer,
  patrimonioLiquido: number,
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
  // OPTIMIZACIÓN 1: Ordenar viviendas por valor para maximizar exclusión
  const viviendas = payer.assets
    .filter((a) => a.description.toLowerCase().match(/(vivienda|casa|apartamento)/))
    .sort((a, b) => {
      const valA = Math.max(a.fiscalCost || a.value, a.cadastralValue || 0);
      const valB = Math.max(b.fiscalCost || b.value, b.cadastralValue || 0);
      return valB - valA; // Descendente
    });
  const primaryResidence = viviendas.length > 0 ? viviendas[0] : null;

  let housingExclusion = 0;
  if (primaryResidence) {
    const taxValue = Math.max(
      primaryResidence.fiscalCost || primaryResidence.value,
      primaryResidence.cadastralValue || 0,
    );
    housingExclusion = Math.min(taxValue, HOUSING_EXCLUSION_UVT * UVT);
  }

  // ═══ 3. Base gravable ═══
  const taxableBase = Math.max(0, patrimonioLiquido - housingExclusion);
  const taxableBaseUVT = taxableBase / UVT;

  // ═══ 4. Aplicar tabla progresiva (Base + Marginal) ═══

  // Buscar el rango donde: min < taxableBaseUVT <= max
  // Invariante: threshold (72,000 UVT) > max exclusion (12,000 UVT)
  // → taxableBase > 0 → taxableBaseUVT > 0 → TABLE siempre encuentra rango
  // (TABLE[0].min = 0, TABLE[-1].max = Infinity)
  const bracket = TABLE.find((r) => taxableBaseUVT > r.min && taxableBaseUVT <= r.max)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

  const baseTax: number = (bracket as { baseTax: number }).baseTax;
  const taxUVT = baseTax + (taxableBaseUVT - bracket.min) * bracket.rate;

  const tax = Math.round(taxUVT * UVT);

  return {
    isSubject: true,
    taxableBase,
    tax,
  };
}
