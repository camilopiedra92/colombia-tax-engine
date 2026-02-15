// ═══════════════════════════════════════════════════════════════════
// REGLAS TRIBUTARIAS COLOMBIA — Estatuto Tributario + Ley 2277/2022
// Formulario 210: Declaración de Renta Personas Naturales
// ═══════════════════════════════════════════════════════════════════

export type TaxYear = 2024 | 2025 | 2026;

// UVT por año gravable (DIAN Resolución)
export const UVT_BY_YEAR: Record<TaxYear, number> = {
    2024: 47065,  // Resolución 000187 del 28/nov/2023
    2025: 49799,  // Resolución DIAN 2024
    2026: 52374,  // Resolución 000238 del 15/dic/2025
};

// SMLMV por año (para cálculos de seguridad social)
export const SMLMV_BY_YEAR: Record<TaxYear, number> = {
    2024: 1300000,
    2025: 1423500,
    2026: 1750905,  // Decreto 2025 — alza histórica
};

export function getTaxRules(year: TaxYear) {
    const UVT = UVT_BY_YEAR[year];
    const SMLMV = SMLMV_BY_YEAR[year];

    return {
        YEAR: year,
        UVT,
        SMLMV,

        // ═══════════════════════════════════════════════════════════
        // CÉDULA GENERAL (Art. 330, 331, 336 ET)
        // ═══════════════════════════════════════════════════════════
        GENERAL: {
            // Límite global rentas exentas + deducciones (Art. 336 ET)
            LIMIT_40_PCT: 0.40,           // 40% del ingreso neto
            LIMIT_ABSOLUTE_UVT: 1340,      // 1,340 UVT tope absoluto

            // Renta exenta 25% laboral (Art. 206 num 10 ET, mod. Ley 2277)
            EXEMPT_25_PCT: 0.25,
            EXEMPT_25_LIMIT_UVT: 790,      // 790 UVT anuales

            // Dependientes (Art. 387 ET, mod. Ley 2277/2022)
            DEPENDENTS_PER_UVT: 72,        // 72 UVT por dependiente
            DEPENDENTS_MAX_COUNT: 4,       // Máximo 4 dependientes

            // Deducción Dependientes Art. 387 (10% ingresos laborales)
            DEPENDENTS_ART_387_PCT: 0.10,
            DEPENDENTS_ART_387_LIMIT_MONTHLY_UVT: 32, // Tope 32 UVT/mes

            // Intereses vivienda (Art. 119 ET)
            // UPDATED: Cambiado base mensual 100 UVT (1,200 anuales)
            HOUSING_INTEREST_LIMIT_MONTHLY_UVT: 100,

            // Medicina prepagada y pólizas salud (Art. 387 ET)
            // UPDATED: Cambiado a base mensual 16 UVT (192 anuales)
            PREPAID_HEALTH_LIMIT_MONTHLY_UVT: 16,

            // AFC / FPV (Art. 126-1, 126-4 ET)
            AFC_FPV_PCT: 0.30,             // 30% del ingreso
            AFC_FPV_LIMIT_UVT: 3800,       // 3,800 UVT tope absoluto

            // Aporte Voluntario a Pensión Obligatoria RAIS (Art. 55 ET) — Es INCR, NO Renta Exenta
            RAIS_INCR_PCT: 0.25,           // 25% del ingreso bruto
            RAIS_INCR_LIMIT_UVT: 2500,     // 2,500 UVT tope absoluto

            // Factura electrónica (Art. 336 par. 5 ET, Ley 2277/2022)
            // NOTA: Esta deducción está EXCLUIDA del límite global 40%/1,340 UVT
            ELECTRONIC_INVOICE_PCT: 0.01,   // 1% de compras
            ELECTRONIC_INVOICE_LIMIT_UVT: 240, // 240 UVT tope

            // ICETEX (Art. 119.1 ET)
            ICETEX_LIMIT_UVT: 100,          // 100 UVT tope

            // GMF (Art. 115 ET)
            GMF_DEDUCTIBLE_PCT: 0.50,       // 50% del 4x1000 pagado

            // Cesantías — Renta exenta (Art. 206 num 4 ET)
            // Exentas si ingreso mensual promedio ≤ 350 UVT
            SEVERANCE_EXEMPT_THRESHOLD_UVT: 350,

            // Independientes: IBC = 40% de ingresos brutos (DUR 1625 Art. 2.2.1.1.1.7)
            IBC_INDEPENDENT_PCT: 0.40,

            // Componente Inflacionario (Art. 38 ET) — Rendimientos financieros de entidades bancarias
            // UPDATED: Decreto 0771 de 2024 fijó 50.88% para año gravable 2024
            INFLATIONARY_COMPONENT_PCT: year === 2024 ? 0.5088
                : year === 2025 ? 0.5088  // Asumido igual hasta nueva publicación
                : 0.5088,
        },


        // ═══════════════════════════════════════════════════════════
        // CÉDULA DE PENSIONES (Art. 337 ET)
        // ═══════════════════════════════════════════════════════════
        PENSIONES: {
            EXEMPT_MONTHLY_UVT: 1000,       // 1,000 UVT mensuales exentas
            // EXEMPT_ANNUAL_UVT se calcula dinámicamente según # mesadas (13 o 14)
            // No se permiten deducciones adicionales en esta cédula
        },

        // ═══════════════════════════════════════════════════════════
        // CÉDULA DE DIVIDENDOS (Art. 242 ET, mod. Ley 2277/2022)
        // ═══════════════════════════════════════════════════════════
        DIVIDENDOS: {
            // Sub-cédula 1: Dividendos de utilidades consideradas INCR
            // (Art. 49 num 3 ET) — Se gravan según Art. 241 consolidado
            SUB1_DISCOUNT_PCT: 0.19,        // Descuento tributario 19%

            // Sub-cédula 2: Dividendos gravados
            // (Art. 49 par 2 ET — sociedad no pagó impuesto)
            SUB2_RATE: 0.35,                // Tarifa Art. 240 ET (35%)

            // No residentes
            NON_RESIDENT_RATE: 0.20,        // 20% para no residentes

            // Tabla Retención en la Fuente (Art. 242 parágrafo)
            WITHHOLDING_TABLE: [
                { min: 0,    max: 1090, rate: 0 },
                { min: 1090, max: Infinity, rate: 0.15 },
            ],
        },

        // ═══════════════════════════════════════════════════════════════════
        // GANANCIA OCASIONAL (Art. 299-317 ET)
        // ═══════════════════════════════════════════════════════════════════
        GANANCIA_OCASIONAL: {
            RATE_GENERAL: 0.15,             // 15% tarifa general (Art. 303)
            RATE_LOTTERIES: 0.20,           // 20% loterías, rifas, premios (Art. 317)

            // Exenciones por venta de activos (Art. 311-1 ET)
            EXEMPT_HOUSING_SALE_UVT: 5000,  // Venta vivienda habitación: primeras 5,000 UVT

            // Exenciones por herencias, legados y donaciones (Art. 307 ET)
            EXEMPT_HOUSING_INHERITANCE_UVT: 13000, // Vivienda habitación del causante: primeras 13,000 UVT
            // Numeral 2 (Ley 2277): Inmuebles diferentes a vivienda (rurales/urbanos)
            EXEMPT_REAL_ESTATE_INHERITANCE_UVT: 6500, // 6,500 UVT (Art. 307 num 2)
            
            EXEMPT_PER_HEIR_UVT: 3250,      // Asignación por heredero/legatario: primeras 3,250 UVT (Art. 307 num 2)
            EXEMPT_OTHER_BENEFICIARY_PCT: 0.20, // 20% para beneficiarios no legitimarios (Art. 307 num 3)

            // Otras exenciones GO
            EXEMPT_LIFE_INSURANCE_UVT: 3250, // Seguros de vida (Art. 303-1 mod. Ley 2277)
            EXEMPT_DONATIONS_RECEIVED_UVT: 1625, // Donaciones recibidas (Art. 307 num 3) - Capped at 1,625 UVT
            EXEMPT_LOTTERY_UVT: 48,         // Primeros 48 UVT de loterías (Art. 306 num 4) - SOLO RETENCIÓN
        },

        // ═══════════════════════════════════════════════════════════════════
        // DESCUENTOS TRIBUTARIOS (Art. 254-260-1 ET)
        // ═══════════════════════════════════════════════════════════════════
        DESCUENTOS: {
            DONATIONS_GENERAL_PCT: 0.25,    // 25% donaciones generales
            DONATIONS_FOOD_PCT_2024: 0.25,  // 25% donaciones alimentos Año Gravable 2024 (Concepto DIAN 007928 Oct 2024)
            DONATIONS_FOOD_PCT_2025: 0.37,  // 37% donaciones alimentos Año Gravable 2025+ (Ley 2380/2024)
            DONATIONS_FOOD_PCT_2026: 0.37,  // 37% donaciones alimentos Año Gravable 2026 (Ley 2380/2024)
            FOREIGN_TAX_CREDIT: true,       // Art. 254 ET
            DIVIDENDS_DISCOUNT_PCT: 0.19,   // 19% descuento dividendos
            RD_INVESTMENT_PCT: 0.30,        // 30% inversión I+D
            
            // Límite conjunto para Donaciones + I+D (Art. 258 ET): 25% del impuesto básico
            GROUP_LIMIT_PCT: 0.25,
        },

        // ═══════════════════════════════════════════════════════════════════
        // ANTICIPO DE RENTA (Art. 807 ET)
        // Porcentajes progresivos según año de declaración:
        //   1er año: 25%, 2do año: 50%, 3er año+: 75%
        // ═══════════════════════════════════════════════════════════════════
        ANTICIPO: {
            FIRST_YEAR_PCT: 0.25,           // 25% primera vez (Art. 807 inc. 1)
            SECOND_YEAR_PCT: 0.50,          // 50% segundo año (Art. 807 inc. 2)
            THIRD_YEAR_PLUS_PCT: 0.75,      // 75% tercer año y siguientes (Art. 807 inc. 3)
        },

        // ═══════════════════════════════════════════════════════════════════
        // IMPUESTO AL PATRIMONIO (Art. 292-3, 295-3 ET, Ley 2277/2022)
        // Permanente desde 2023. Aplica a PN con patrimonio ≥ 72,000 UVT
        // ═══════════════════════════════════════════════════════════
        IMPUESTO_PATRIMONIO: {
            THRESHOLD_UVT: 72000,            // Patrimonio líquido ≥ 72,000 UVT
            HOUSING_EXCLUSION_UVT: 12000,    // Excluir primeras 12,000 UVT de vivienda propia
            TABLE: [
                { min: 0,      max: 72000,   rate: 0,     baseTax: 0 },
                { min: 72000,  max: 122000,  rate: 0.005, baseTax: 0 },
                { min: 122000, max: 239000,  rate: 0.010, baseTax: 250 },   // 250 UVT + 1% sobre exceso 122,000
                { min: 239000, max: Infinity, rate: 0.015, baseTax: 1420 }, // 1,420 UVT + 1.5% sobre exceso 239,000
            ],
        },

        // ═══════════════════════════════════════════════════════════
        // TABLA ART. 241 ET — Tarifa Impuesto Renta Personas Naturales
        // (Confirmada contra fuentes oficiales Gerencie/Senado)
        // ═══════════════════════════════════════════════════════════
        TAX_TABLE: [
            { min: 0,     max: 1090,     rate: 0,    base: 0 },
            { min: 1090,  max: 1700,     rate: 0.19, base: 0 },
            { min: 1700,  max: 4100,     rate: 0.28, base: 116 },
            { min: 4100,  max: 8670,     rate: 0.33, base: 788 },
            { min: 8670,  max: 18970,    rate: 0.35, base: 2296 },
            { min: 18970, max: 31000,    rate: 0.37, base: 5901 },
            { min: 31000, max: Infinity, rate: 0.39, base: 10352 },
        ],

        // ═══════════════════════════════════════════════════════════
        // OBLIGADOS A DECLARAR (Art. 592-594 ET)
        // Umbrales para año gravable (en UVT)
        // ═══════════════════════════════════════════════════════════
        OBLIGADOS: {
            PATRIMONIO_BRUTO_UVT: 4500,     // Patrimonio bruto > 4,500 UVT
            INGRESOS_BRUTOS_UVT: 1400,      // Ingresos brutos > 1,400 UVT
            CONSUMOS_TC_UVT: 1400,          // Consumos tarjeta crédito > 1,400 UVT
            COMPRAS_UVT: 1400,              // Compras y consumos > 1,400 UVT
            CONSIGNACIONES_UVT: 1400,       // Consignaciones bancarias > 1,400 UVT
        },

        // ═══════════════════════════════════════════════════════════
        // SEGURIDAD SOCIAL
        // ═══════════════════════════════════════════════════════════
        SEGURIDAD_SOCIAL: {
            SALUD_EMPLEADO_PCT: 0.04,       // 4% aporte empleado
            PENSION_EMPLEADO_PCT: 0.04,     // 4% aporte empleado
            SOLIDARIDAD_THRESHOLD_SMLMV: 4, // > 4 SMLMV
            SOLIDARIDAD_PCT: 0.01,          // 1% Fondo Solidaridad (4-16 SMLMV)
            SUBSISTENCIA_PCT: 0.005,        // 0.5% adicional si > 16 SMLMV
        },

        // ═══════════════════════════════════════════════════════════
        // CALENDARIO TRIBUTARIO 2024 (vencimientos según 2 últimos dígitos NIT)
        // ═══════════════════════════════════════════════════════════
        CALENDARIO: [
            { digits: '01-02', date: '2025-08-12' },
            { digits: '03-04', date: '2025-08-13' },
            { digits: '05-06', date: '2025-08-14' },
            { digits: '07-08', date: '2025-08-15' },
            { digits: '09-10', date: '2025-08-19' },
            { digits: '11-12', date: '2025-08-20' },
            { digits: '13-14', date: '2025-08-21' },
            { digits: '15-16', date: '2025-08-22' },
            { digits: '17-18', date: '2025-08-25' },
            { digits: '19-20', date: '2025-08-26' },
            { digits: '21-22', date: '2025-08-27' },
            { digits: '23-24', date: '2025-08-28' },
            { digits: '25-26', date: '2025-08-29' },
            { digits: '27-28', date: '2025-09-01' },
            { digits: '29-30', date: '2025-09-02' },
            { digits: '31-32', date: '2025-09-03' },
            { digits: '33-34', date: '2025-09-04' },
            { digits: '35-36', date: '2025-09-05' },
            { digits: '37-38', date: '2025-09-08' },
            { digits: '39-40', date: '2025-09-09' },
            { digits: '41-42', date: '2025-09-10' },
            { digits: '43-44', date: '2025-09-11' },
            { digits: '45-46', date: '2025-09-12' },
            { digits: '47-48', date: '2025-09-15' },
            { digits: '49-50', date: '2025-09-16' },
            { digits: '51-52', date: '2025-09-17' },
            { digits: '53-54', date: '2025-09-18' },
            { digits: '55-56', date: '2025-09-19' },
            { digits: '57-58', date: '2025-09-22' },
            { digits: '59-60', date: '2025-09-23' },
            { digits: '61-62', date: '2025-09-24' },
            { digits: '63-64', date: '2025-09-25' },
            { digits: '65-66', date: '2025-09-26' },
            { digits: '67-68', date: '2025-09-29' },
            { digits: '69-70', date: '2025-09-30' },
            { digits: '71-72', date: '2025-10-01' },
            { digits: '73-74', date: '2025-10-02' },
            { digits: '75-76', date: '2025-10-03' },
            { digits: '77-78', date: '2025-10-06' },
            { digits: '79-80', date: '2025-10-07' },
            { digits: '81-82', date: '2025-10-08' },
            { digits: '83-84', date: '2025-10-09' },
            { digits: '85-86', date: '2025-10-10' },
            { digits: '87-88', date: '2025-10-14' },
            { digits: '89-90', date: '2025-10-15' },
            { digits: '91-92', date: '2025-10-16' },
            { digits: '93-94', date: '2025-10-17' },
            { digits: '95-96', date: '2025-10-20' },
            { digits: '97-98', date: '2025-10-21' },
            { digits: '99-00', date: '2025-10-22' },
        ],
    };
}

// Helper: Aplicar tabla Art. 241 ET
// TAX_TABLE termina con max: Infinity → .find() siempre encuentra rango para baseUVT > 0
export function applyTaxTable(taxableBase: number, year: TaxYear): number {
    const { UVT, TAX_TABLE } = getTaxRules(year);
    const baseUVT = taxableBase / UVT;

    if (baseUVT <= 0) return 0;

    const range = TAX_TABLE.find(r => baseUVT > r.min && baseUVT <= r.max)!;

    if (range.rate === 0) return 0;

    // Fórmula: (Base en UVT - Límite inferior) × Tarifa + Impuesto base del rango
    const taxInUVT = ((baseUVT - range.min) * range.rate) + range.base;
    return Math.round(taxInUVT * UVT);
}

// Nueva función Helper para calcular FSP progresivo y tope de 25 SMLMV
// Ley 100 y actualizaciones recientes
export function calculateSocialSecurity(ibcBruto: number, smlmv: number, isIndependent: boolean) {
    // Para independientes, el IBC es 40% del ingreso bruto mensualizado
    // Para empleados, es el salario completo (o lo que dictamine la ley para su caso)
    const baseIBC = isIndependent ? ibcBruto * 0.40 : ibcBruto; 
    
    // Tope máximo legal de 25 SMLMV para cotizar seguridad social
    const cappedIBC = Math.min(baseIBC, 25 * smlmv); 
    
    // Salud (4% empleado) + Pensión (4% empleado)
    // NOTA: Para independientes "puros", la tasa es mayor (12.5% salud, 16% pensión),
    // pero aquí estamos calculando lo que es **DEDUCIBLE/INCR** para la persona.
    // Si la persona paga la planilla completa, el INCR es el valor total pagado.
    // Por defecto asumimos la carga del empleado/independiente reportada,
    // pero si usamos este helper para **estimar** el INCR, usamos las tasas de aporte obligatorias.
    
    // Si es independiente, paga TODO: 12.5% Salud + 16% Pensión = 28.5%
    // Si es empleado, paga su parte: 4% Salud + 4% Pensión = 8%
    const rate = isIndependent ? (0.125 + 0.16) : (0.04 + 0.04);
    const healthAndPension = cappedIBC * rate; 
    
    const smlmvCount = cappedIBC / smlmv;
    let fspRate = 0;

    // Tabla progresiva Fondo de Solidaridad Pensional (FSP)
    if (smlmvCount >= 4) {
        fspRate += 0.01; // Solidaridad básica 1%
        
        // Subsistencia progresiva
        if (smlmvCount >= 16 && smlmvCount < 17) fspRate += 0.002;
        else if (smlmvCount >= 17 && smlmvCount < 18) fspRate += 0.004;
        else if (smlmvCount >= 18 && smlmvCount < 19) fspRate += 0.006;
        else if (smlmvCount >= 19 && smlmvCount < 20) fspRate += 0.008;
        else if (smlmvCount >= 20) fspRate += 0.010; // Max 2% total
    }
    
    const solidarity = cappedIBC * fspRate;
    return {
        healthAndPension,
        solidarity,
        total: healthAndPension + solidarity,
        baseIBC: cappedIBC
    };
}
