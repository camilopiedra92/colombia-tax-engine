// ═══════════════════════════════════════════════════════════════════
// TIPOS — Motor Tributario Colombia
// Formulario 210: Declaración de Renta Personas Naturales
// ═══════════════════════════════════════════════════════════════════

import type { TaxYear } from './rules';

// ═══════════════════════════════════════════════════════════════════
// CONTRIBUYENTE
// ═══════════════════════════════════════════════════════════════════
export type { TaxYear };

export interface TaxPayer {
  id: string;                        // CC / NIT
  name: string;
  year: TaxYear;

  // Datos declarante
  declarationYearCount?: number;      // Año de declaración: 1=primera vez, 2=segundo año, 3+=tercer año y siguientes (Art. 807 ET)
  isResident: boolean;               // Residente fiscal en Colombia
  isVATResponsible?: boolean;        // Responsable de IVA (antiguo Régimen Común)
  dependentsCount: number;           // Número de dependientes (0-4)

  // Datos del año anterior (para anticipo y carry-forward)
  previousYearTax?: number;          // Impuesto neto de renta año anterior
  previousYearAdvance?: number;      // Anticipo pagado año anterior
  previousYearCapitalLosses?: number; // Pérdidas fiscales acumuladas años anteriores (Art. 330 ET)

  // Datos para simulación "¿Estoy obligado a declarar?"
  creditCardExpenses?: number;       // Consumos tarjeta de crédito
  totalPurchases?: number;           // Total compras y consumos
  bankDeposits?: number;             // Consignaciones bancarias

  // Componentes financieros
  incomes: IncomeSource[];
  deductions: Deduction[];
  assets: Asset[];
  liabilities: Liability[];

  // Descuentos tributarios (reducen impuesto directamente)
  taxCredits?: TaxCredit[];
}

// ═══════════════════════════════════════════════════════════════════
// INGRESOS
// ═══════════════════════════════════════════════════════════════════
export type IncomeCategory =
  // Cédula General (Art. 330-336 ET)
  | 'renta_trabajo'          // Salarios, comisiones
  | 'honorarios'             // Honorarios independientes
  | 'renta_capital'          // Intereses, rendimientos, arrendamientos
  | 'renta_no_laboral'       // Otros ingresos no clasificados
  | 'cesantias'              // Cesantías (Art. 206 Num 4) — Renta Exenta progresiva
  | 'intereses_cesantias'    // Intereses sobre cesantías (Art. 206 Num 4) — Misma tabla progresiva que cesantías

  // Cédula de Pensiones (Art. 337 ET)
  | 'pensiones'              // Jubilación, invalidez, vejez, sobrevivientes

  // Cédula de Dividendos (Art. 242 ET)
  | 'dividendos_ordinarios'  // Sub-cédula 1: utilidades 2017+ (gravados como renta)
  | 'dividendos_gravados'    // Sub-cédula 2: sociedad no pagó impuesto (35%)

  // Ganancia Ocasional (Art. 299-317 ET)
  | 'ganancia_ocasional'     // Venta activos fijos > 2 años, herencias
  | 'loteria_premios';       // Loterías, rifas, apuestas, premios

export interface IncomeSource {
  id: string;
  description: string;
  category: IncomeCategory;
  grossValue: number;                // Ingreso bruto

  // Seguridad Social (INCR — Ingresos No Constitutivos de Renta)
  healthContribution?: number;       // Aporte salud empleado (4%)
  pensionContribution?: number;      // Aporte pensión obligatoria (4%)
  solidarityFund?: number;           // Fondo Solidaridad Pensional (1-2%)

  // Cesantías — Renta exenta Art. 206 num 4 ET (NO son INCR)
  // Exentas si ingreso mensual promedio ≤ 350 UVT
  severance?: number;                // Cesantías del período
  severanceInterest?: number;        // Intereses sobre cesantías (misma exención)
  averageMonthlySalary?: number;     // Promedio salarial mensual últimos 6 meses

  // Costos y gastos procedentes
  costs?: number;                    // Costos para honorarios/capital/no laboral
  costBasis?: number;                // Costo fiscal activo (para ganancia ocasional)

  // Retenciones practicadas
  withholdingTax?: number;           // Retención renta
  withholdingDividends?: number;     // Retención dividendos
  withholdingLotteries?: number;     // Retención loterías/premios

  // Fuente del ingreso
  isForeignSource?: boolean;         // Ingreso de fuente extranjera
  foreignTaxPaid?: number;           // Impuesto pagado en el exterior (Art. 254)
  foreignCurrencyValue?: number;     // Valor en moneda extranjera
  exchangeRate?: number;             // TRM aplicable

  // Para independientes (Art. 206 par. 5 Ley 2277)
  hasMoreThanOneEmployee?: boolean;  // Tiene > 1 trabajador (afecta 25% exento)
  preferCostsOverExemption?: boolean;// true = costos/gastos; false = 25% exento

  // Nuevos campos para cumplimiento (Ley 2277 / Conceptos DIAN)
  heldDurationDays?: number;         // Días de posesión (para regla < 2 años en GO)
  holdingPeriodYears?: number;       // Años de posesión del activo (alternativo a heldDurationDays)
  numberOfMesadas?: number;          // Número de mesadas pensionales (13 o 14)
  avgSalaryLast6MonthsUVT?: number;  // Promedio salarial últimos 6 meses en UVT (para cesantías Art 206 Num 4)

  // Aportes Voluntarios — CRÍTICO: Diferenciar RAIS (INCR) vs FPV (Renta Exenta)
  voluntaryPensionRAIS?: number;     // Aporte Voluntario a Pensión Obligatoria RAIS (Art 55) — Es INCR
  voluntaryPensionContribution?: number; // @deprecated — Usar fpv en deductions. Mantenido por retrocompatibilidad.

  // Componente Inflacionario (Art. 38 ET) — Rendimientos financieros
  financialYields?: boolean;          // ¿Es un rendimiento de entidad bancaria/financiera?
  inflationaryComponentPct?: number;  // Override del % componente inflacionario (por defecto: valor decreto anual)

  // Rentas CAN — Decisión 578 Comunidad Andina (Perú, Ecuador, Bolivia)
  isCANIncome?: boolean;              // Renta exenta 100%, NO sujeta al límite del 40%

  // Optimización ICA (Industria y Comercio) — "God Level"
  icaPaid?: number;                   // Valor pagado por ICA (para comparar Costo vs Descuento)
}

// ═══════════════════════════════════════════════════════════════════
// DEDUCCIONES Y RENTAS EXENTAS
// ═══════════════════════════════════════════════════════════════════
export type DeductionCategory =
  | 'dependientes'            // 72 UVT × dependiente, max 4
  | 'gmf'                     // 50% del 4×1000
  | 'intereses_vivienda'      // Tope 1,200 UVT (Art. 119 ET)
  | 'salud_prepagada'         // Tope 16 UVT/mes (Art. 387 ET)
  | 'factura_electronica'     // 1% compras, tope 240 UVT (Art. 336 par 1)
  | 'icetex'                  // Intereses ICETEX, tope 100 UVT (Art. 119.1)
  | 'donaciones'              // Donaciones (como deducción si no es descuento)
  | 'otras_deducciones';      // Otras deducciones procedentes

export type ExemptCategory =
  | 'afc'                     // Aportes AFC (Art. 126-4 ET)
  | 'fpv'                     // Fondo de Pensión Voluntaria (Art. 126-1 ET) — Es Renta Exenta, NO INCR
  | 'cesantias'               // Cesantías exentas
  | 'renta_25_laboral'        // 25% renta exenta laboral (Art. 206 num 10)
  | 'pension_exenta'          // Pensiones exentas (hasta 1,000 UVT/mes)
  | 'indemnizacion_accidente' // Indemnización accidente trabajo (Art. 206 num 1)
  | 'gastos_entierro'         // Gastos de entierro (Art. 206 num 2)
  | 'otras_exentas';          // Otras rentas exentas (Art. 206)

export interface Deduction {
  id: string;
  category: DeductionCategory | ExemptCategory;
  description: string;
  value: number;
  monthsReported?: number;           // Número de meses a los que corresponde el pago (def: 12). Para topes mensuales.
}

// ═══════════════════════════════════════════════════════════════════
// DESCUENTOS TRIBUTARIOS (Art. 254-260-1 ET)
// Se restan directamente del impuesto, no de la base gravable
// ═══════════════════════════════════════════════════════════════════
export type TaxCreditCategory =
  | 'impuesto_exterior'       // Art. 254: Impuestos pagados en el exterior
  | 'donacion_general'        // 25% donaciones a RTE/no contribuyentes
  | 'donacion_alimentos'      // 37% donaciones alimentos (Ley 2380/2024)
  | 'inversion_id'            // 30% inversión I+D (Art. 256 ET)
  | 'iva_activos_fijos'       // IVA activos fijos reales productivos
  | 'dividendos_descuento'    // 19% descuento dividendos (Art. 242 ET)
  | 'otro_descuento';

export interface TaxCredit {
  id: string;
  category: TaxCreditCategory;
  description: string;
  value: number;                     // Valor del descuento tributario
}

// ═══════════════════════════════════════════════════════════════════
// PATRIMONIO (Art. 261-286 ET)
// ═══════════════════════════════════════════════════════════════════
export type AssetCategory =
  | 'cuenta_bancaria'         // Saldos bancarios
  | 'inversion'               // CDTs, fondos, acciones, bonos
  | 'inmueble'                // Bienes raíces
  | 'vehiculo'                // Vehículos
  | 'criptoactivo'            // Criptomonedas
  | 'participacion_societaria'// Participaciones en sociedades
  | 'cuenta_exterior'         // Cuentas en el exterior
  | 'bien_exterior'           // Bienes en el exterior
  | 'otro_activo';

export interface Asset {
  id: string;
  category: AssetCategory;
  description: string;
  value: number;                     // Costo fiscal o avalúo catastral
  cadastralValue?: number;           // Avalúo catastral (para inmuebles)
  fiscalCost?: number;               // Costo fiscal (para inmuebles/activos)
  isForeign?: boolean;               // Activo en el exterior
  exchangeRate?: number;             // TRM 31/dic para activos en exterior
}

export interface Liability {
  id: string;
  description: string;
  value: number;                     // Saldo deuda al 31/dic
  debtType?: 'hipotecario' | 'vehiculo' | 'tarjeta_credito' | 'educativo' | 'otro';
}

// ═══════════════════════════════════════════════════════════════════
// RESULTADO COMPLETO DE LA DECLARACIÓN
// ═══════════════════════════════════════════════════════════════════
export interface TaxResult {
  // Cédula General (Art. 330-336)
  cedulaGeneral: {
    grossIncome: number;             // Total ingresos brutos
    incrTotal: number;               // Total INCR (salud + pensión + solidaridad)
    costs: number;                   // Costos y gastos procedentes
    netIncome: number;               // Ingresos netos
    totalDeductions: number;         // Deducciones antes del límite (SIN factura electrónica)
    totalExemptions: number;         // Rentas exentas antes del límite
    facturaElectronica: number;      // Deducción factura electrónica (EXCLUIDA del límite)
    globalLimit: number;             // Límite aplicado (40% o 1,340 UVT)
    acceptedClaims: number;          // Total aceptado después del límite + factura
    taxableIncome: number;           // Renta líquida gravable
    tax: number;                     // Impuesto sobre renta líquida
    // Smart Allocation breakdown
    smartAllocation: {
      imputedToCapital: number;      // Deducciones asignadas a capital/no laboral
      imputedToLaborWithCosts: number; // Deducciones asignadas a honorarios con costos
      imputedToLaborEligible: number;  // Deducciones asignadas a renta laboral elegible
    };
    canExemptIncome: number;         // Rentas CAN exentas (Decisión 578)
    carryForwardApplied: number;     // Pérdidas fiscales aplicadas
  };

  // Cédula de Pensiones (Art. 337)
  cedulaPensiones: {
    grossIncome: number;
    exemptAmount: number;            // Hasta 1,000 UVT/mes exentas
    taxableIncome: number;
    tax: number;
  };

  // Cédula de Dividendos (Art. 242, Ley 2277)
  cedulaDividendos: {
    subCedula1: {
      grossIncome: number;           // Dividendos ordinarios
      taxableIncome: number;         // = grossIncome (se consolida con demás cédulas)
      tax: number;                   // Impuesto marginal atribuible a dividendos
      discount19: number;            // Descuento 19%
      netTax: number;
    };
    subCedula2: {
      grossIncome: number;           // Dividendos gravados
      tax35: number;                 // Art. 240: 35%
      remainingBase: number;         // Base después de 35%
      additionalTax: number;         // Art. 241 sobre remanente
      netTax: number;
    };
    withholding: number;             // Retención calculada (Art. 242 par.)
    totalTax: number;
  };

  // Ganancia Ocasional (Art. 299-317)
  gananciaOcasional: {
    grossIncome: number;
    exemptions: number;
    costs: number;
    taxableIncome: number;
    taxGeneral: number;              // Tarifa 15%
    taxLotteries: number;            // Tarifa 20%
    totalTax: number;
  };

  // Patrimonio
  patrimonio: {
    patrimonioBruto: number;
    totalPasivos: number;
    patrimonioLiquido: number;
  };

  // Impuesto al Patrimonio (Art. 292-3 Ley 2277)
  patrimonioTax: {
    isSubject: boolean;              // ¿Sujeto al impuesto?
    taxableBase: number;             // Base gravable (después de exclusiones)
    tax: number;                     // Impuesto al patrimonio
  };

  // Consolidado Impuesto Renta
  consolidatedTaxableIncome: number; // Renta líquida consolidada (general + pensiones + div sub-1)
  totalIncomeTax: number;            // Suma de impuestos de todas las cédulas
  totalTaxCredits: number;           // Total descuentos tributarios
  netIncomeTax: number;              // Impuesto neto después de descuentos

  // Anticipo
  anticipoNextYear: number;          // Anticipo renta año siguiente
  anticipoPreviousYear: number;      // Anticipo pagado año anterior

  // Retenciones
  totalWithholding: number;          // Total retenciones en la fuente

  // Saldos finales
  totalTaxDue: number;               // Impuesto a cargo total
  balanceToPay: number;              // Saldo a pagar (positivo) o favor (negativo)

  // Metadatos
  isObligatedToFile: boolean;        // ¿Está obligado a declarar?
  obligationReasons: string[];       // Razones por las que está obligado
  filingDeadline?: string;           // Fecha de vencimiento
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS AUXILIARES
// ═══════════════════════════════════════════════════════════════════
export interface OptimizationTip {
  category: 'deduccion' | 'renta_exenta' | 'descuento' | 'patrimonio' | 'general';
  title: string;
  description: string;
  potentialSaving: number;           // Ahorro estimado en COP
  legalReference: string;            // Artículo del ET
}

export interface ValidationWarning {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  legalReference?: string;
}
