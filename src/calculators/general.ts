// ═══════════════════════════════════════════════════════════════════
// CALCULADORA — CÉDULA GENERAL (Art. 330-336 ET)
// Rentas de trabajo + honorarios + capital + no laborales + cesantías
//
// Normativa implementada:
//   • Art. 330-336 ET: Depuración cédula general
//   • Art. 38 ET: Componente inflacionario rendimientos financieros
//   • Art. 55-57 ET: INCR (salud, pensión, solidaridad, RAIS voluntario)
//   • Art. 206 num 4 ET: Cesantías E intereses como renta exenta (tabla progresiva)
//   • Art. 206 num 10 ET (mod. Ley 2277/2022): 25% exenta, tope 790 UVT
//   • Art. 206 par. 5 (Ley 2277): Independientes — costos vs 25% excluyente
//   • Art. 330 ET: Carry-forward de pérdidas fiscales de capital
//   • Art. 336 ET: Ring-Fencing (pérdidas capital no reducen base laboral)
//   • Art. 336 par. 5 (Ley 2277): Factura electrónica EXCLUIDA del límite 40%
//   • Art. 336 inc. 4 (Ley 2277): Dependientes 72 UVT EXCLUIDOS del límite 40%
//   • Art. 115 ET: GMF 50% deducible (SUJETO al límite 40% — Art. 336)
//   • Art. 119 ET: Intereses vivienda
//   • Art. 119.1 ET: Intereses ICETEX
//   • Art. 126-1, 126-4 ET: AFC/FPV sobre ingreso tributario (atado a sub-cédula fuente)
//   • Art. 300 ET: Posesión < 2 años → reclasificar GO como Renta No Laboral
//   • Art. 387 ET: Dependientes 10% sobre ingreso BRUTO laboral, medicina prepagada
//   • Concepto DIAN 416/2023: Ring-fencing sub-cédulas (protección 25%)
//   • Decisión 578 CAN: Rentas Comunidad Andina exentas, sin límite 40%
//   • DUR 1625 Art. 2.2.1.1.1.7: IBC independientes 40%
//
// OPTIMIZACIÓN:
//   • Smart Allocation: Deducciones se imputan primero a rentas sin 25%
//   • Smart Allocation: Deducciones se imputan primero a rentas sin 25%
//     (capital/no laboral, luego honorarios con costos) para maximizar
//     la base del 25% exento laboral.
//     NOTA: FPV/AFC no debe moverse, queda donde se originó (Ring-Fencing).
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer, IncomeCategory } from '../types';
import { getTaxRules } from '../rules';

// Categorías que entran en la Cédula General
const GENERAL_CATEGORIES: IncomeCategory[] = [
  'renta_trabajo',
  'honorarios',
  'renta_capital',
  'renta_no_laboral',
  'cesantias',
  'intereses_cesantias',
];

export interface GeneralScheduleResult {
  grossIncome: number;
  incrTotal: number;
  costs: number;
  netIncome: number;
  totalDeductions: number;
  totalExemptions: number;
  facturaElectronica: number; // Excluida del límite 40%/1340 UVT
  globalLimit: number;
  acceptedClaims: number; // Incluye factura electrónica
  taxableIncome: number;
  tax: number;
  // Smart Allocation breakdown
  smartAllocation: {
    imputedToCapital: number;
    imputedToLaborWithCosts: number;
    imputedToLaborEligible: number;
  };
  canExemptIncome: number; // Rentas CAN (Decisión 578)
  carryForwardApplied: number; // Pérdidas fiscales aplicadas
}

/**
 * Función auxiliar para calcular el porcentaje exento de cesantías
 * según la tabla progresiva del Art. 206 Num 4 ET.
 * NOTA: Aplica tanto a cesantías como a intereses sobre cesantías.
 */
function calculateCesantiasExemptRatio(avgSalaryUVT: number): number {
  if (avgSalaryUVT <= 350) return 1.0;
  if (avgSalaryUVT <= 410) return 0.9;
  if (avgSalaryUVT <= 470) return 0.8;
  if (avgSalaryUVT <= 530) return 0.6;
  if (avgSalaryUVT <= 590) return 0.4;
  if (avgSalaryUVT <= 650) return 0.2;
  return 0.0; // > 650 UVT: 0% exento
}

export function calculateGeneralSchedule(payer: TaxPayer): GeneralScheduleResult {
  const rules = getTaxRules(payer.year);
  const { UVT, GENERAL } = rules;

  // ═══ 1. Filtrar ingresos de Cédula General ═══
  const filteredIncomes = payer.incomes.filter((i) => GENERAL_CATEGORIES.includes(i.category));

  // Art. 300 ET: Reclasificar Ganancia Ocasional con posesión < 2 años como Renta No Laboral
  const reclassifiedGO = payer.incomes.filter((i) => {
    if (i.category !== 'ganancia_ocasional') return false;
    const yearsHeld =
      i.holdingPeriodYears ??
      (i.heldDurationDays !== undefined ? i.heldDurationDays / 365 : undefined);
    return yearsHeld !== undefined && yearsHeld < 2;
  });

  const incomes = [...filteredIncomes, ...reclassifiedGO];

  // ═══ 2. Clasificación con Sub-Cédulas y Ring-Fencing ═══
  // Concepto DIAN 416/2023: La depuración es por sub-cédulas separadas.

  // Sub-cédula A: Labor Eligible (salarios + honorarios SIN costos) → Gozan del 25%
  let laborEligibleGross = 0;
  let laborEligibleINCR = 0;

  // Sub-cédula B: Labor With Costs (honorarios CON costos) → Sin 25%
  let laborWithCostsGross = 0;
  let laborWithCostsINCR = 0;
  let laborWithCostsCosts = 0;

  // Sub-cédula C: Capital y No Laboral
  let capitalNonLaborGross = 0;
  let capitalNonLaborINCR = 0;
  let capitalNonLaborCosts = 0;

  // Cesantías e intereses: exención progresiva
  let totalCesantiasExempt = 0;

  // Ingreso Tributario = Bruto - INCR (antes de costos) — Base para AFC/FPV Art. 126-1
  let totalTributaryIncome = 0;

  // Rentas CAN (Decisión 578) — 100% exentas, sin límite 40%
  let canExemptIncome = 0;

  // Total INCR para report (solo sub-cédulas laborales + cesantías)
  let reportINCR = 0;

  // ═══ PRE-CÁLCULO RAIS GLOBAL (Fix Auditoría) ═══
  // El límite de RAIS (30% ingreso tributario o 3800 UVT) es GLOBAL y ANUAL.
  // Se debe calcular sobre la suma de TODOS los ingresos tributarios.
  let totalGrossForRais = 0;
  let totalMandatoryIncrForRais = 0;
  let totalRaisContribution = 0;

  incomes.forEach((inc) => {
    totalGrossForRais += inc.grossValue;
    totalMandatoryIncrForRais +=
      (inc.healthContribution || 0) + (inc.pensionContribution || 0) + (inc.solidarityFund || 0);
    totalRaisContribution += inc.voluntaryPensionRAIS || 0;
  });

  const globalTributaryBase = Math.max(0, totalGrossForRais - totalMandatoryIncrForRais);
  const allowedRais = Math.min(
    totalRaisContribution,
    globalTributaryBase * GENERAL.RAIS_INCR_PCT,
    GENERAL.RAIS_INCR_LIMIT_UVT * UVT,
  );

  // Factor de prorrateo para asignar el RAIS deducible a cada ingreso
  const raisFactor = totalRaisContribution > 0 ? allowedRais / totalRaisContribution : 0;

  incomes.forEach((inc) => {
    // ═══ Rentas CAN: Exención total, bypass del límite 40% ═══
    // CAN income debe sumar al Gross y restarse al final.
    if (inc.isCANIncome) {
      canExemptIncome += inc.grossValue;
      // Continúa para sumar a las sub-cédulas, luego se restará al final
    }

    // Calcular RAIS usando el factor global pre-calculado
    const rais = (inc.voluntaryPensionRAIS || 0) * raisFactor;
    // remainingRaisLimit ya no se usa aquí porque se controló globalmente arriba

    // Total INCR para este ingreso
    let totalIncr =
      (inc.healthContribution || 0) +
      (inc.pensionContribution || 0) +
      (inc.solidarityFund || 0) +
      rais;

    // Ingreso Tributario: Bruto - INCR (Art. 126-1 ET: base para AFC/FPV)
    totalTributaryIncome += Math.max(0, inc.grossValue - totalIncr);

    // ═══ Clasificación estricta por sub-cédulas (Concepto DIAN 416/2023) ═══
    // Se distribuye el ingreso CAN a su sub-cédula correspondiente también
    switch (inc.category) {
      case 'renta_trabajo':
        laborEligibleGross += inc.grossValue;
        laborEligibleINCR += totalIncr;
        reportINCR += totalIncr;
        break;

      case 'honorarios':
        if (inc.preferCostsOverExemption) {
          laborWithCostsGross += inc.grossValue;
          laborWithCostsINCR += totalIncr;
          laborWithCostsCosts += inc.costs || 0;
          reportINCR += totalIncr;
        } else {
          laborEligibleGross += inc.grossValue;
          laborEligibleINCR += totalIncr;
          reportINCR += totalIncr;
        }
        break;

      case 'renta_capital':
      case 'renta_no_laboral':
      case 'ganancia_ocasional': {
        // Reclasificada
        // ═══ Componente Inflacionario (Art. 38 ET) ═══
        if (inc.financialYields) {
          // Exógena: Inflacionario va al INCR, no reduce el Gross
          // Matemáticamente da igual, pero ante la DIAN, el banco reporta el 100% del rendimiento bruto.
          // Debes sumar el componente inflacionario a la variable totalIncr (Ingresos No Constitutivos de Renta).
          const pct = inc.inflationaryComponentPct ?? GENERAL.INFLATIONARY_COMPONENT_PCT;
          totalIncr += Math.round(inc.grossValue * pct);
        }

        capitalNonLaborGross += inc.grossValue;
        capitalNonLaborINCR += totalIncr;
        // FIX CRÍTICO: Si se reclasifica, DEBE llevarse su costo fiscal.
        capitalNonLaborCosts += (inc.costs || 0) + (inc.costBasis || 0);
        break;
      }

      case 'cesantias': {
        const avgUVT =
          inc.avgSalaryLast6MonthsUVT ??
          (inc.averageMonthlySalary ? inc.averageMonthlySalary / UVT : 0);
        const exemptRatio = calculateCesantiasExemptRatio(avgUVT);
        totalCesantiasExempt += inc.grossValue * exemptRatio;
        laborEligibleGross += inc.grossValue;
        laborEligibleINCR += totalIncr;
        reportINCR += totalIncr;
        break;
      }

      case 'intereses_cesantias': {
        const avgUVT =
          inc.avgSalaryLast6MonthsUVT ??
          (inc.averageMonthlySalary ? inc.averageMonthlySalary / UVT : 0);
        const exemptRatio = calculateCesantiasExemptRatio(avgUVT);
        totalCesantiasExempt += inc.grossValue * exemptRatio;
        laborEligibleGross += inc.grossValue;
        laborEligibleINCR += totalIncr;
        reportINCR += totalIncr;
        break;
      }
    }
  });

  // ═══ 3. Consolidación de Sub-bases ═══
  // Totales Brutos
  const totalGross = laborEligibleGross + laborWithCostsGross + capitalNonLaborGross;
  const totalINCR = laborEligibleINCR + laborWithCostsINCR + capitalNonLaborINCR;

  // La base del límite del 40% NO está restando los Costos (general.ts)
  // Calculas la base del límite del 40% sobre (Ingresos Brutos - INCR).
  // Sin embargo, la estructura técnica del Formulario 210 exige que para los independientes,
  // la Renta Líquida antes del límite sea (Ingresos Brutos - INCR - Costos y Gastos - Rentas CAN).
  const totalCosts = laborWithCostsCosts + capitalNonLaborCosts;
  const baseFor40Limit = Math.max(0, totalGross - totalINCR - totalCosts - canExemptIncome);

  // Bases Netas (Después de Costos)
  const laborEligibleNet = Math.max(0, laborEligibleGross - laborEligibleINCR);
  const laborWithCostsNet = Math.max(
    0,
    laborWithCostsGross - laborWithCostsINCR - laborWithCostsCosts,
  );
  const capitalNonLaborNet = Math.max(
    0,
    capitalNonLaborGross - capitalNonLaborINCR - capitalNonLaborCosts,
  );

  // Renta Líquida Ordinaria (antes de deducciones)
  const totalNetIncome = laborEligibleNet + laborWithCostsNet + capitalNonLaborNet;
  // totalCosts ya fue definido arriba

  // ═══ 4. Deducciones (Art. 119, 387 ET) ═══
  let totalDeductions = 0;

  // 4.1 Intereses vivienda — Art. 119 ET
  // Límite Vivienda Anual (1.200 UVT absolutas)
  // La mensualización solo aplica para la nómina/retención en la fuente, no para la declaración anual.
  const housingInterestRaw = payer.deductions
    .filter((d) => d.category === 'intereses_vivienda')
    .reduce((sum, d) => sum + d.value, 0);
  // Eliminamos lógica de mensualización
  const housingLimit = 1200 * UVT;
  const housingInterest = Math.min(housingInterestRaw, housingLimit);
  totalDeductions += housingInterest;

  // 4.2 Medicina prepagada — Art. 387 ET
  // UPDATED: Límite mensual 16 UVT * meses
  const healthRaw = payer.deductions
    .filter((d) => d.category === 'salud_prepagada')
    .reduce((sum, d) => sum + d.value, 0);
  const healthMonths =
    payer.deductions.find((d) => d.category === 'salud_prepagada')?.monthsReported || 12;
  const healthLimit = GENERAL.PREPAID_HEALTH_LIMIT_MONTHLY_UVT * healthMonths * UVT;
  const health = Math.min(healthRaw, healthLimit);
  totalDeductions += health;

  // 4.3 GMF (50% deducible)
  const gmfRaw = payer.deductions
    .filter((d) => d.category === 'gmf')
    .reduce((sum, d) => sum + d.value, 0);
  const gmfDeductible = Math.round(gmfRaw * GENERAL.GMF_DEDUCTIBLE_PCT);
  totalDeductions += gmfDeductible;

  // 4.4 Icetex
  const icetexRaw = payer.deductions
    .filter((d) => d.category === 'icetex')
    .reduce((sum, d) => sum + d.value, 0);
  const icetex = Math.min(icetexRaw, GENERAL.ICETEX_LIMIT_UVT * UVT);
  totalDeductions += icetex;

  // 4.5 Otras
  const otrasDeducciones = payer.deductions
    .filter((d) => d.category === 'otras_deducciones' || d.category === 'donaciones')
    .reduce((sum, d) => sum + d.value, 0);
  totalDeductions += otrasDeducciones;

  // 4.6 Dependientes (Algoritmo de Optimización "God Level" V4)
  // Fix Auditoría: Simular espacio en el 40% para decidir real conveniencia del 10%.

  const actualDependents = payer.dependentsCount || 0;
  const totalLaborGross = laborEligibleGross + laborWithCostsGross;

  let dependentsDeductionLey2277 = 0;
  let dependentsDeductionArt387 = 0;

  if (actualDependents > 0 && totalLaborGross > 0) {
    const limitArt387 = GENERAL.DEPENDENTS_ART_387_LIMIT_MONTHLY_UVT * 12 * UVT;
    const potential10Pct = Math.min(totalLaborGross * GENERAL.DEPENDENTS_ART_387_PCT, limitArt387);
    const value72UVT = GENERAL.DEPENDENTS_PER_UVT * UVT;

    // SIMULACIÓN: ¿Cuánto espacio real queda en el 40%?
    // Calculamos el límite teórico máximo antes de restar lo que ya llevamos
    const maxGlobalLimit = Math.min(
      baseFor40Limit * GENERAL.LIMIT_40_PCT,
      GENERAL.LIMIT_ABSOLUTE_UVT * UVT,
    );

    // Deducciones que ya sabemos que van fijas al 40%
    const currentClaims = housingInterest + health + gmfDeductible + icetex + otrasDeducciones;

    // Espacio disponible en el cubo del 40%
    const roomLeftIn40Pct = Math.max(0, maxGlobalLimit - currentClaims);

    // Beneficio EFECTIVO del 10% (limitado por lo que cabe en el 40%)
    const effective10Pct = Math.min(potential10Pct, roomLeftIn40Pct);

    // Asignación inteligente:
    // Si el 10% efectivo aporta más que 72 UVT (que van libre de límite), tomamos 10%.
    // Ojo: 72 UVT *siempre* se toman full porque van fuera del límite.

    let depsFor72 = Math.min(actualDependents, GENERAL.DEPENDENTS_MAX_COUNT);
    let depsFor10 = 0;

    if (effective10Pct > value72UVT) {
      // Nos conviene gastar 1 dependiente en el 10%
      depsFor10 = 1;
      // Los dependientes restantes (hasta 4) se van a las 72 UVT
      // Total permitidos Ley 2277: Hasta 4 adicionales
      depsFor72 = Math.min(Math.max(0, actualDependents - 1), GENERAL.DEPENDENTS_MAX_COUNT);
    }

    dependentsDeductionArt387 = depsFor10 * potential10Pct;
    dependentsDeductionLey2277 = depsFor72 * value72UVT;
  }
  totalDeductions += dependentsDeductionArt387; // Las 72 UVT se suman abajo (exentas del 40%)

  // 4.7 Factura Electrónica (Excluida límite 40%)
  const facturaRaw = payer.deductions
    .filter((d) => d.category === 'factura_electronica')
    .reduce((sum, d) => sum + d.value, 0);
  // Sumas el valor total de las compras (facturaRaw) multiplicado por el 1% (ELECTRONIC_INVOICE_PCT)
  const facturaElectronica = Math.min(
    facturaRaw * GENERAL.ELECTRONIC_INVOICE_PCT,
    GENERAL.ELECTRONIC_INVOICE_LIMIT_UVT * UVT,
  );

  // ═══ 5. Rentas Exentas ═══
  let totalExemptions = 0;

  // 5.1 AFC / FPV — Art. 126-1
  // AFC/FPV están atadas a la fuente. No entran al Smart Allocation general
  // sino que se restan específicamente. Se calculan globalmente aquí pero
  // logicamente pertenecen a la cédula laboral si vinieron de salario.
  const afcFpvRaw = payer.deductions
    .filter((d) => ['afc', 'fpv'].includes(d.category as string))
    .reduce((sum, d) => sum + d.value, 0);

  // Límite 30% del ingreso tributario
  const afcFpvLimitPct = totalTributaryIncome * GENERAL.AFC_FPV_PCT;
  const afcFpvLimitUvt = GENERAL.AFC_FPV_LIMIT_UVT * UVT;
  const afcFpv = Math.min(afcFpvRaw, afcFpvLimitPct, afcFpvLimitUvt);
  // Este valor se resta "antes" de considerar la imputación libre de otras deducciones
  // Se sumará a totalExemptions para el control del límite 40%

  // Exentas fijas (Cesantías, Indemnizaciones, Entierro)
  const indemnizacion = payer.deductions
    .filter((d) => d.category === 'indemnizacion_accidente')
    .reduce((sum, d) => sum + d.value, 0);
  const gastosEntierro = payer.deductions
    .filter((d) => d.category === 'gastos_entierro')
    .reduce((sum, d) => sum + d.value, 0);
  const otrasExentas = payer.deductions
    .filter((d) => d.category === 'otras_exentas')
    .reduce((sum, d) => sum + d.value, 0);

  totalExemptions += totalCesantiasExempt + indemnizacion + gastosEntierro + otrasExentas + afcFpv;

  // ═══ 6. SMART ALLOCATION V3 & Renta Exenta 25% ═══
  // Deducciones imputables libremente (Salud, Vivienda, GMF, Icetex, Dependientes, Otras)
  // NO incluye AFC/FPV (fix bug 2)
  const allocatableDeductions =
    housingInterest +
    icetex +
    health +
    gmfDeductible +
    dependentsDeductionArt387 +
    otrasDeducciones;

  let remainingAllocatable = allocatableDeductions;

  // Paso 1: Imputar a Capital (Full tax)
  const imputedToCapital = Math.min(remainingAllocatable, capitalNonLaborNet);
  remainingAllocatable -= imputedToCapital;

  // Paso 2: Imputar a Honorarios Costos (Full tax)
  const imputedToLaborWithCosts = Math.min(remainingAllocatable, laborWithCostsNet);
  remainingAllocatable -= imputedToLaborWithCosts;

  // Paso 3: Remanente a Laboral Elegible
  const imputedToLaborEligible = remainingAllocatable;

  // Calculo Base 25% Exento Laboral
  let exempt25 = 0;
  if (laborEligibleNet > 0) {
    // Base = Net Labor - Deducciones Imputadas a Labor - Rentas Exentas Específicas Laborales
    // Asumimos que AFC/FPV, Cesantías, Indemnizaciones, etc son Laborales
    const specificExemptionsLabor =
      afcFpv + totalCesantiasExempt + indemnizacion + gastosEntierro + otrasExentas;

    // FIX Auditoría: Restar TODAS las deducciones, incluyendo las que están por fuera del 40% (Ley 2277 y Factura)
    // Art. 206 Num 10: "...menos los ingresos no constitutivos de renta, las deducciones y las demás rentas exentas"
    const extraDeductions = dependentsDeductionLey2277 + facturaElectronica;

    const laborBaseFor25 = Math.max(
      0,
      laborEligibleNet - imputedToLaborEligible - specificExemptionsLabor - extraDeductions,
    );

    exempt25 = Math.min(laborBaseFor25 * GENERAL.EXEMPT_25_PCT, GENERAL.EXEMPT_25_LIMIT_UVT * UVT);
    totalExemptions += exempt25;
  }

  // ═══ 7. Límite Global 40% ═══
  const totalClaims = totalDeductions + totalExemptions;

  // FIX Bug 1: usas baseFor40Limit que es (Gross - INCR)
  const limit40 = baseFor40Limit * GENERAL.LIMIT_40_PCT;
  const limitAbs = GENERAL.LIMIT_ABSOLUTE_UVT * UVT;
  const globalLimit = Math.min(limit40, limitAbs);

  const limitedClaims = Math.min(totalClaims, globalLimit);

  // ═══ 8. Sumar deducciones sin límite ═══
  // Excluidas: Factura Electrónica, Dependientes Ley 2277, CAN (que se resta al final)
  const acceptedClaims = limitedClaims + facturaElectronica + dependentsDeductionLey2277;

  // Asegurar no dar negativo
  const effectiveClaims = Math.min(acceptedClaims, totalNetIncome);

  // Renta Líquida Ordinaria del Ejercicio
  const rentaLiquidaOrdinaria = Math.max(0, totalNetIncome - effectiveClaims);

  // ═══ 9. Rentas CAN (Subtract final) ═══
  // FIX Bug 5: Se depuran ANTES de compensar pérdidas para no quemar escudos fiscales innecesariamente.
  // Primero aplicamos la exención CAN a la Renta Líquida Ordinaria.
  const basePrePerdidas = Math.max(0, rentaLiquidaOrdinaria - canExemptIncome);

  // ═══ 10. Pérdidas Fiscales (Carry-Forward) ═══
  // FIX Bug 4: Se compensan DESPUÉS de depurar la renta ordinaria
  const carryForwardLosses = payer.previousYearCapitalLosses || 0;

  // FIX Ley 2010/2019: Se cruza contra toda la renta ordinaria disponible, sin límite de sub-cédula.
  // Ya no se limita a Capital/No Laboral (unificación cédula general).
  const carryForwardApplied = Math.min(carryForwardLosses, basePrePerdidas);

  // Renta Líquida Gravable Final
  const finalTaxableIncome = Math.max(0, basePrePerdidas - carryForwardApplied);

  return {
    grossIncome: totalGross, // Debe incluir CAN
    incrTotal: reportINCR,
    costs: totalCosts,
    netIncome: totalNetIncome,
    totalDeductions,
    totalExemptions,
    facturaElectronica,
    globalLimit,
    acceptedClaims: effectiveClaims + canExemptIncome, // Para reporte visual
    taxableIncome: finalTaxableIncome,
    tax: 0,
    smartAllocation: {
      imputedToCapital,
      imputedToLaborWithCosts,
      imputedToLaborEligible,
    },
    canExemptIncome,
    carryForwardApplied,
  };
}
