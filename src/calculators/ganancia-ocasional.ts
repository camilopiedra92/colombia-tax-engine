// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — GANANCIA OCASIONAL (Art. 299-317 ET)
// Venta activos fijos >2 años, herencias, loterías, premios
//
// Normativa completa implementada:
//   • Art. 299-302: Ingresos que constituyen ganancia ocasional
//   • Art. 303 ET: Tarifa general 15%
//   • Art. 303-1 ET: Exención seguros de vida (12,500 UVT)
//   • Art. 306 num 4: Exención primeros 48 UVT de loterías
//   • Art. 307 ET: Exenciones por herencias y legados
//     - num 1: Vivienda de habitación del causante (13,000 UVT)
//     - num 2: Asignación por heredero/legatario (3,250 UVT c/u)
//     - num 3: 20% para no legitimarios, tope 1,625 UVT (Actualizado Ley 2277)
//   • Art. 311-1 ET: Exención venta vivienda habitación (5,000 UVT)
//   • Art. 317 ET: Tarifa 20% para loterías, rifas, premios
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer } from '../types';
import { getTaxRules } from '../rules';

export interface GananciaOcasionalResult {
  grossIncome: number;
  exemptions: number;
  costs: number;
  taxableIncome: number;
  taxGeneral: number; // 15% general
  taxLotteries: number; // 20% loterías
  totalTax: number;
}

export function calculateGananciaOcasional(payer: TaxPayer): GananciaOcasionalResult {
  const rules = getTaxRules(payer.year);
  const { UVT, GANANCIA_OCASIONAL: GO } = rules;

  // ═══ 1. Separar ganancias ocasionales generales vs loterías ═══
  // FILTRO PREVIO: Regla de 2 años (Art. 300 ET)
  // Se excluyen activos poseídos por menos de 2 años (730 días).
  // Deben ser tratados como Renta Externa (General) - Renta No Laboral
  // (Esta lógica de filtrado inicial se hace en el caller, pero aquí re-validamos)
  const generalGO = payer.incomes.filter((i) => {
    if (i.category !== 'ganancia_ocasional') return false;

    // FIX: La regla de 2 años NO aplica a herencias, seguros ni donaciones
    // Solo aplica a la VENTA de activos fijos.
    const isSale = i.description.toLowerCase().match(/(venta|enajenacion|enajenación)/);

    if (isSale) {
      // Regla de 2 años (Art. 300 ET): Activos con posesión < 2 años no son GO
      const yearsHeld =
        i.holdingPeriodYears ??
        (i.heldDurationDays !== undefined ? i.heldDurationDays / 365 : undefined);
      if (yearsHeld !== undefined && yearsHeld < 2) {
        return false; // Es renta líquida (general.ts lo reclasifica como renta_no_laboral)
      }
    }
    return true; // Si es herencia/donación/seguro, SIEMPRE es GO.
  });

  const lotteryGO = payer.incomes.filter((i) => i.category === 'loteria_premios');

  // ═══ 2. Ganancias Ocasionales Generales (15%) ═══
  // Art. 300-302: Venta de activos fijos poseídos > 2 años, herencias, legados
  let grossGeneral = 0;
  let costsGeneral = 0;
  let exemptionsGeneral = 0;

  generalGO.forEach((inc) => {
    grossGeneral += inc.grossValue;

    // Restar costo fiscal del activo vendido (Art. 90 ET)
    if (inc.costBasis) {
      costsGeneral += inc.costBasis;
    }
  });

  // ═══ Aplicar exenciones según tipo de ganancia ocasional ═══

  // Art. 311-1: Venta de vivienda de habitación — primeras 5,000 UVT exentas
  // Identifica ingresos por venta de vivienda (no herencia)
  // ⚠️ REQUISITO LEGAL: Para que proceda esta exención, la totalidad del dinero
  // debe depositarse en una cuenta AFC o destinarse al pago de hipoteca.
  const ventaVivienda = generalGO.filter((i) => {
    const desc = i.description.toLowerCase();
    const isHousingSale =
      (desc.includes('venta') || desc.includes('enajenación') || desc.includes('enajenacion')) &&
      (desc.includes('vivienda') || desc.includes('casa') || desc.includes('apartamento'));

    // OPTIMIZACIÓN 3: Verificar cumplimiento de requisitos (AFC / Hipoteca)
    // Y FIX Auditoría: Costo fiscal debe ser <= 15.000 UVT (Par. 1 Art. 311-1)
    const complies = (i.depositedInAFC || i.usedForMortgage) && (i.costBasis || 0) <= 15000 * UVT;

    return isHousingSale && complies;
  });
  ventaVivienda.forEach((inc) => {
    const netGain = Math.max(0, inc.grossValue - (inc.costBasis || 0));
    exemptionsGeneral += Math.min(netGain, GO.EXEMPT_HOUSING_SALE_UVT * UVT);
  });

  // Art. 307 num 1: Herencias — Vivienda de habitación del causante — 13,000 UVT
  const herenciaVivienda = generalGO.filter((i) => {
    const desc = i.description.toLowerCase();
    return (
      (desc.includes('herencia') ||
        desc.includes('legado') ||
        desc.includes('sucesión') ||
        desc.includes('sucesion')) &&
      (desc.includes('vivienda') || desc.includes('casa') || desc.includes('apartamento'))
    );
  });
  // FIX: Sumar primero, topar después
  const totalHerenciaVivienda = herenciaVivienda.reduce((sum, inc) => sum + inc.grossValue, 0);
  exemptionsGeneral += Math.min(totalHerenciaVivienda, GO.EXEMPT_HOUSING_INHERITANCE_UVT * UVT);

  // Art. 307 num 2: Herencias — Asignación por heredero/legatario — 3,250 UVT c/u
  // Se aplica a los legitimarios (herederos legales) y al cónyuge supérstite
  const herenciaGral = generalGO.filter((i) => {
    const desc = i.description.toLowerCase();
    return (
      (desc.includes('herencia') ||
        desc.includes('legado') ||
        desc.includes('sucesión') ||
        desc.includes('sucesion')) &&
      !desc.includes('vivienda') &&
      !desc.includes('casa') &&
      !desc.includes('apartamento') &&
      !desc.includes('finca') &&
      !desc.includes('lote') &&
      !desc.includes('local') &&
      !desc.includes('bodega')
    );
  });
  // FIX: Sumar primero, topar después (Herencias Generales)
  const totalHerenciaGral = herenciaGral.reduce((sum, inc) => sum + inc.grossValue, 0);
  exemptionsGeneral += Math.min(totalHerenciaGral, GO.EXEMPT_PER_HEIR_UVT * UVT);

  // Art. 307 num 2 (Ley 2277): Herencias — Inmuebles diferentes a vivienda — 6,500 UVT
  // (Fincas, lotes, locales, oficinas, bodegas, etc.)
  const herenciaInmueblesOtros = generalGO.filter((i) => {
    const desc = i.description.toLowerCase();
    const isInheritance =
      desc.includes('herencia') ||
      desc.includes('legado') ||
      desc.includes('sucesión') ||
      desc.includes('sucesion');
    const isRealEstate =
      desc.includes('finca') ||
      desc.includes('lote') ||
      desc.includes('local') ||
      desc.includes('oficina') ||
      desc.includes('bodega');
    const isNotHousing =
      !desc.includes('vivienda') && !desc.includes('casa') && !desc.includes('apartamento');
    return isInheritance && isRealEstate && isNotHousing;
  });
  // FIX: Sumar primero, topar después
  const totalHerenciaInmueblesOtros = herenciaInmueblesOtros.reduce(
    (sum, inc) => sum + inc.grossValue,
    0,
  );
  const limitInmuebles = GO.EXEMPT_REAL_ESTATE_INHERITANCE_UVT * UVT;
  exemptionsGeneral += Math.min(totalHerenciaInmueblesOtros, limitInmuebles);

  // Art. 303-1: Seguros de vida — primeras 12,500 UVT exentas
  // FIX: Actualizado valor a 3,250 UVT (GO.EXEMPT_LIFE_INSURANCE_UVT) según rules.ts
  const seguroExempt = generalGO
    .filter((i) => i.description.toLowerCase().includes('seguro'))
    .reduce((sum, i) => sum + Math.min(i.grossValue, GO.EXEMPT_LIFE_INSURANCE_UVT * UVT), 0);
  exemptionsGeneral += seguroExempt;

  // Art. 307 num 3: Donaciones recibidas — 20% exento, tope 1,625 UVT
  const donaciones = generalGO.filter((i) => {
    const desc = i.description.toLowerCase();
    return desc.includes('donacion') || desc.includes('donación');
  });

  // FIX: Sumar primero, topar después (Donaciones)
  const totalDonaciones = donaciones.reduce((sum, inc) => sum + inc.grossValue, 0);
  const exempt20Pct = Math.round(totalDonaciones * GO.EXEMPT_OTHER_BENEFICIARY_PCT);
  exemptionsGeneral += Math.min(exempt20Pct, GO.EXEMPT_DONATIONS_RECEIVED_UVT * UVT);

  // Deducción adicional de exenciones desde deducciones del contribuyente
  // (para mantener retrocompatibilidad con exenciones ingresadas manualmente)
  const otrasExenciones = payer.deductions
    .filter(
      (d) =>
        d.category === 'otras_exentas' &&
        d.description.toLowerCase().includes('ganancia ocasional'),
    )
    .reduce((sum, d) => sum + d.value, 0);
  exemptionsGeneral += otrasExenciones;

  const netGeneral = Math.max(0, grossGeneral - costsGeneral - exemptionsGeneral);
  const taxGeneral = Math.round(netGeneral * GO.RATE_GENERAL);

  // ═══ 3. Loterías, Rifas, Premios (20%) — Art. 304, 317 ═══
  let grossLottery = 0;
  lotteryGO.forEach((inc) => {
    grossLottery += inc.grossValue;
  });

  // Exención: primeros 48 UVT (Art. 306 num 4)
  // ⚠️ AUDIT FIX: El Art. 317 establece que los premios están gravados a la tarifa del 20%.
  // El Art. 404-1 (que menciona 48 UVT) se refiere a que NO SE PRACTICA RETENCIÓN EN LA FUENTE
  // si el premio es menor a 48 UVT. Pero en la declaración de renta, es 100% gravado.

  const lotteryExempt = 0; // No hay exención en renta anual

  const netLottery = grossLottery; // 100% Gravado
  const taxLotteries = Math.round(netLottery * GO.RATE_LOTTERIES);

  return {
    grossIncome: grossGeneral + grossLottery,
    exemptions: exemptionsGeneral + lotteryExempt,
    costs: costsGeneral,
    taxableIncome: netGeneral + netLottery,
    taxGeneral,
    taxLotteries,
    totalTax: taxGeneral + taxLotteries,
  };
}
