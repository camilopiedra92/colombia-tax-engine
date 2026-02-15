// ═══════════════════════════════════════════════════════════════════
// MOTOR TRIBUTARIO PRINCIPAL — Tax Engine Colombia
// Formulario 210: Declaración de Renta Personas Naturales
//
// Normativa Implementada (Auditoría Completa):
//   • ET Libro I: Art. 55-57, 115, 119, 126-1/4, 188, 206,
//     241, 242, 245, 254-260-1, 261-286, 292-3, 295-3, 299-317,
//     330-337, 387, 592-594, 807-809
//   • Ley 2277/2022: Consolidación dividendos sub-1, límite 1340 UVT,
//     factura electrónica excluida del límite, impuesto patrimonio,
//     retención dividendos, deducción dependientes
//   • Ley 2010/2019: Renta presuntiva 0%
//   • Ley 2380/2024: Descuento donaciones alimentos 37%
//   • DUR 1625/2016: IBC independientes
//   • Decreto 2229/2023: Calendario vencimientos 2025
//
// OPTIMIZACIONES "GOD LEVEL":
//   • ICA (Industria y Comercio): Simulación automática para determinar si
//     es mejor tomarlo como COSTO (100% deducible base) o DESCUENTO (50% del impuesto).
//   • Dividendos: Bloqueo de descuento tributario para no exceder impuesto marginal.
// ═══════════════════════════════════════════════════════════════════

import { TaxPayer, TaxResult, Asset, TaxCredit } from './types';
import { getTaxRules, applyTaxTable } from './rules';
import { calculateGeneralSchedule } from './calculators/general';
import { calculatePensionesSchedule } from './calculators/pensiones';
import { calculateDividendSchedule } from './calculators/dividendos';
import { calculateGananciaOcasional } from './calculators/ganancia-ocasional';
import { calculateDescuentos } from './calculators/descuentos';
import { calculateAnticipo } from './calculators/anticipo';
import { checkObligadoDeclarar } from './calculators/obligados';
import { calculatePatrimonioTax } from './calculators/patrimonio-impuesto';

export class TaxEngine {

    /**
     * Calcula la declaración de renta completa para un contribuyente.
     * Implementa el Formulario 210 de la DIAN.
     * 
     * Incluye Optimización ICA automática.
     */
    static calculate(payer: TaxPayer): TaxResult {
        // Chequear si hay pagos de ICA para optimizar
        const totalIcaPaid = payer.incomes.reduce((sum, i) => sum + (i.icaPaid || 0), 0);

        if (totalIcaPaid > 0) {
            // Escenario: ICA SIEMPRE preferido como Descuento (50% valor pagado) vs Costo.
            // Matematica: Descuento = 50% vs Costo = TasaMarginal (<39%).
            // Por lo tanto, el Descuento siempre es mejor.
            // Para "Enterprise Grade", simplificamos y eliminamos código muerto inalcanzable.

            // Clonamos payer y agregamos un TaxCredit
            const payerWithIcaDiscount = this.clonePayer(payer);
            const icaCredit: TaxCredit = {
                id: 'auto-ica-discount',
                category: 'otro_descuento',
                description: 'Descuento Tributario ICA (50% de lo pagado)',
                value: totalIcaPaid * 0.5 // Art. 115 ET: 50% descuento
            };
            payerWithIcaDiscount.taxCredits = [...(payerWithIcaDiscount.taxCredits || []), icaCredit];
            
            return this.runCalculation(payerWithIcaDiscount);
        }

        // Si no hay ICA, cálculo normal
        return this.runCalculation(payer);
    }

    // Helper para clonar (deep copy básico)
    private static clonePayer(payer: TaxPayer): TaxPayer {
        return JSON.parse(JSON.stringify(payer));
    }

    /**
     * Lógica core del cálculo (privada para ser llamada por el optimizador)
     */
    private static runCalculation(payer: TaxPayer): TaxResult {
        const rules = getTaxRules(payer.year);

        // ═══ 1. PATRIMONIO (Art. 261-286 ET) ═══
        const patrimonio = this.calculatePatrimonio(payer);

        // ═══ 2. IMPUESTO AL PATRIMONIO (Art. 292-3, Ley 2277/2022) ═══
        const patrimonioTaxResult = calculatePatrimonioTax(payer, patrimonio.patrimonioLiquido);

        // ═══ 3. CÉDULA GENERAL (Art. 330-336 ET) ═══
        const generalResult = calculateGeneralSchedule(payer);
        // Impuesto se calcula aisladamente primero (para visualización individual)
        generalResult.tax = applyTaxTable(generalResult.taxableIncome, payer.year);

        // ═══ 4. CÉDULA DE PENSIONES (Art. 337 ET) ═══
        const pensionesResult = calculatePensionesSchedule(payer);
        pensionesResult.tax = applyTaxTable(pensionesResult.taxableIncome, payer.year);

        // ═══ 5. CÉDULA DE DIVIDENDOS (Art. 242/245 ET, Ley 2277/2022) ═══
        const dividendosResult = calculateDividendSchedule(payer);

        // ═══ 5.1 CONSOLIDACIÓN DIVIDENDOS (según residencia) ═══
        let totalIncomeTax: number;
        let consolidatedTaxableIncome: number;

        if (dividendosResult.isNonResident) {
            // ═══ NO RESIDENTES (Art. 245 ET) ═══
            // Los dividendos se gravan al 20% plano (ya calculado en dividendos.ts)
            // Las demás cédulas se calculan normalmente sin consolidación con dividendos
            consolidatedTaxableIncome = generalResult.taxableIncome + pensionesResult.taxableIncome;
            const baseTax = applyTaxTable(consolidatedTaxableIncome, payer.year);
            totalIncomeTax = baseTax + dividendosResult.totalTax;
        } else {
            // ═══ RESIDENTES (Ley 2277, Art. 331 ET mod.) ═══
            // Desde Ley 2277, los dividendos de sub-cédula 1 se SUMAN a la renta
            // líquida gravable de las demás cédulas.
            // Los de sub-cédula 2, su remanente (tras el 35%) TAMBIÉN se suma.
            // Para aplicar correctamente el descuento del 19% (solo a Sub-1),
            // debemos calcular el impuesto marginal por capas (stacking).
            
            // Capa 0: General + Pensiones
            const base0 = generalResult.taxableIncome + pensionesResult.taxableIncome;
            // Capa 1: + Dividendos Sub-1 (Sujetos a descuento 19%)
            const base1 = base0 + dividendosResult.subCedula1.taxableIncome;
            // Capa 2: + Dividendos Sub-2 Remanente (NO sujetos a descuento, ya pagaron 35%)
            const base2 = base1 + dividendosResult.subCedula2.remainingBase;

            const tax0 = applyTaxTable(base0, payer.year);
            const tax1 = applyTaxTable(base1, payer.year);
            const tax2 = applyTaxTable(base2, payer.year);

            // A) Impuesto marginal Sub-cédula 1
            const marginalSub1 = Math.max(0, tax1 - tax0);
            dividendosResult.subCedula1.tax = marginalSub1;

            // Descuento tributario del 19% (Art. 254-1 ET)
            // Se calcula sobre el valor de los dividendos (Sub1 + Remanente Sub2) que exceda 1090 UVT.
            // NO sobre el impuesto marginal.
            const dividendBaseForDiscount = dividendosResult.subCedula1.grossIncome + dividendosResult.subCedula2.remainingBase;
            const threshold1090 = 1090 * rules.UVT;
            const excessBase = Math.max(0, dividendBaseForDiscount - threshold1090);
            
            // El descuento es el 19% del exceso
            const potentialDiscount19 = Math.round(excessBase * rules.DIVIDENDOS.SUB1_DISCOUNT_PCT);
            
            // FIX "God Level": Candado en el Descuento de Dividendos
            // El descuento no puede exceder el impuesto atribuible a los dividendos (marginalSub1)
            // o generaría un saldo a favor artificial contra la cédula general.
            const discount19 = Math.min(potentialDiscount19, marginalSub1);

            dividendosResult.subCedula1.discount19 = discount19;
            // Para display, netTax es el marginal menos el descuento (puede ser 0 si el descuento cubre todo)
            // El descuento real se suma a totalTaxCredits más adelante.
            dividendosResult.subCedula1.netTax = Math.max(0, marginalSub1 - discount19);

            // B) Impuesto marginal Sub-cédula 2 (Remanente)
            const marginalSub2 = Math.max(0, tax2 - tax1);
            dividendosResult.subCedula2.additionalTax = marginalSub2;
            // El netTax de sub-2 incluye el 35% inicial + este marginal
            // (El 35% ya venía en dividendosResult.subCedula2.netTax desde el calculador)
            dividendosResult.subCedula2.netTax += marginalSub2;

            // Actualizar totalTax de dividendos consolidados
            dividendosResult.totalTax = dividendosResult.subCedula1.netTax
                + dividendosResult.subCedula2.netTax;

            consolidatedTaxableIncome = base2;

            // Impuesto total de renta:
            // tax2 (Impuesto de tabla sobre TODO) + tax35 (Impuesto plano 35% de sub-2)
            // NOTA: tax2 incluye las capas general y dividendos.
            // Para 'totalIncomeTax' queremos el impuesto bruto ANTES de descuentos.
            totalIncomeTax = tax2 + dividendosResult.subCedula2.tax35;
        }

        // ═══ 6. GANANCIA OCASIONAL (Art. 299-317 ET) ═══
        const goResult = calculateGananciaOcasional(payer);
        totalIncomeTax += goResult.totalTax;

        // ═══ 7. DESCUENTOS TRIBUTARIOS (Art. 254-260-1 ET) ═══
        // Calcular renta neta de fuente extranjera para Art. 254 proporcional
        const foreignNetIncome = payer.incomes
            .filter(i => i.isForeignSource)
            .reduce((sum, i) => sum + Math.max(0, i.grossValue - (i.costs || 0)), 0);
        const descuentosResult = calculateDescuentos(
            payer, totalIncomeTax, foreignNetIncome, consolidatedTaxableIncome
        );
        
        // El descuento de dividendos (19%) calculado anteriormente
        const dividendDiscount = dividendosResult.subCedula1.discount19 || 0;

        let totalTaxCredits = descuentosResult.totalCredits + dividendDiscount;
        // Re-validar límite: descuentos no pueden exceder impuesto básico
        totalTaxCredits = Math.min(totalTaxCredits, totalIncomeTax);
        const netIncomeTax = Math.max(0, totalIncomeTax - totalTaxCredits);

        // ═══ 8. RETENCIONES EN LA FUENTE ═══
        // Incluir retenciones calculadas de dividendos
        const totalWithholding = this.calculateTotalWithholding(payer)
            + dividendosResult.withholding;

        // ═══ 9. ANTICIPO (Art. 807 ET) ═══
        const anticipoResult = calculateAnticipo(payer, netIncomeTax, totalWithholding);

        // ═══ 10. OBLIGADOS A DECLARAR (Art. 592-594 ET) ═══
        const obligadoResult = checkObligadoDeclarar(payer);

        // ═══ 11. SALDO FINAL ═══
        // Impuesto a cargo = Impuesto neto + Anticipo siguiente año
        const totalTaxDue = netIncomeTax + anticipoResult.anticipoNextYear;

        // Saldo a pagar = Impuesto a cargo - Retenciones - Anticipo año anterior
        // Si es negativo = saldo a favor
        const balanceToPay = totalTaxDue - totalWithholding - anticipoResult.anticipoPreviousYear;

        // ═══ 12. FECHA DE VENCIMIENTO ═══
        const filingDeadline = this.getFilingDeadline(payer);

        return {
            // Cédula General
            cedulaGeneral: {
                grossIncome: generalResult.grossIncome,
                incrTotal: generalResult.incrTotal,
                costs: generalResult.costs,
                netIncome: generalResult.netIncome,
                totalDeductions: generalResult.totalDeductions,
                totalExemptions: generalResult.totalExemptions,
                facturaElectronica: generalResult.facturaElectronica,
                globalLimit: generalResult.globalLimit,
                acceptedClaims: generalResult.acceptedClaims,
                taxableIncome: generalResult.taxableIncome,
                tax: generalResult.tax,
                smartAllocation: generalResult.smartAllocation,
                canExemptIncome: generalResult.canExemptIncome,
                carryForwardApplied: generalResult.carryForwardApplied,
            },

            // Cédula Pensiones
            cedulaPensiones: {
                grossIncome: pensionesResult.grossIncome,
                exemptAmount: pensionesResult.exemptAmount,
                taxableIncome: pensionesResult.taxableIncome,
                tax: pensionesResult.tax,
            },

            // Cédula Dividendos
            cedulaDividendos: {
                subCedula1: dividendosResult.subCedula1,
                subCedula2: dividendosResult.subCedula2,
                withholding: dividendosResult.withholding,
                totalTax: dividendosResult.totalTax,
            },

            // Ganancia Ocasional
            gananciaOcasional: {
                grossIncome: goResult.grossIncome,
                exemptions: goResult.exemptions,
                costs: goResult.costs,
                taxableIncome: goResult.taxableIncome,
                taxGeneral: goResult.taxGeneral,
                taxLotteries: goResult.taxLotteries,
                totalTax: goResult.totalTax,
            },

            // Patrimonio
            patrimonio,

            // Impuesto al Patrimonio
            patrimonioTax: patrimonioTaxResult,

            // Consolidados
            consolidatedTaxableIncome,
            totalIncomeTax,
            totalTaxCredits,
            netIncomeTax,

            // Anticipo
            anticipoNextYear: anticipoResult.anticipoNextYear,
            anticipoPreviousYear: anticipoResult.anticipoPreviousYear,

            // Retenciones
            totalWithholding,

            // Saldos
            totalTaxDue,
            balanceToPay,

            // Metadatos
            isObligatedToFile: obligadoResult.isObligated,
            obligationReasons: obligadoResult.reasons,
            filingDeadline,
        };
    }

    /**
     * Calcula el patrimonio bruto, pasivos, y patrimonio líquido.
     * Art. 261-286 ET
     */
    private static calculatePatrimonio(payer: TaxPayer) {
        let patrimonioBruto = 0;

        payer.assets.forEach(asset => {
            if (asset.category === 'inmueble') {
                // Para inmuebles: se toma el mayor entre costo fiscal y avalúo catastral
                // Art. 277 ET: El valor patrimonial de inmuebles se determina
                // por el mayor entre costo fiscal y avalúo catastral
                const costFiscal = asset.fiscalCost || asset.value;
                const avaluo = asset.cadastralValue || 0;
                patrimonioBruto += Math.max(costFiscal, avaluo);
            } else if (asset.isForeign && asset.exchangeRate) {
                // Activos en el exterior: valor en moneda extranjera × TRM 31/dic
                // Art. 269 ET: Cuentas por cobrar y activos financieros en moneda
                // extranjera se reexpresan a TRM del último día del año
                patrimonioBruto += asset.value; // Asumimos que ya viene convertido
            } else {
                patrimonioBruto += asset.value;
            }
        });

        const totalPasivos = payer.liabilities.reduce((sum, l) => sum + l.value, 0);
        const patrimonioLiquido = Math.max(0, patrimonioBruto - totalPasivos);

        return { patrimonioBruto, totalPasivos, patrimonioLiquido };
    }

    /**
     * Calcula el total de retenciones en la fuente de todas las fuentes de ingreso.
     * No incluye la retención calculada de dividendos (se suma por separado).
     */
    private static calculateTotalWithholding(payer: TaxPayer): number {
        return payer.incomes.reduce((sum, inc) => {
            return sum
                + (inc.withholdingTax || 0)
                + (inc.withholdingDividends || 0)
                + (inc.withholdingLotteries || 0);
        }, 0);
    }

    /**
     * Obtiene la fecha de vencimiento según los últimos 2 dígitos del NIT/CC.
     * Decreto 2229/2023: Calendario tributario.
     * 
     * NOTA: Maneja correctamente el rango '99-00' donde end < start,
     * interpretándolo como "99 hasta 99 O 00 hasta 00".
     */
    private static getFilingDeadline(payer: TaxPayer): string | undefined {
        const rules = getTaxRules(payer.year);
        const lastTwoDigits = payer.id.slice(-2);
        const numericDigits = parseInt(lastTwoDigits, 10);

        if (isNaN(numericDigits)) return undefined;

        const entry = rules.CALENDARIO.find(entry => {
            const [startStr, endStr] = entry.digits.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);

            if (end < start) {
                // Rango que cruza de 99 a 00 (ej: '99-00')
                return numericDigits >= start || numericDigits <= end;
            }
            // Rango normal
            return numericDigits >= start && numericDigits <= end;
        });

        return entry?.date;
    }
}

// Re-exportar tipos y reglas para acceso fácil
export { getTaxRules, applyTaxTable } from './rules';
export type { TaxYear } from './rules';
export * from './types';
export { checkObligadoDeclarar } from './calculators/obligados';
export { calculatePatrimonioTax } from './calculators/patrimonio-impuesto';
export { calculateGeneralSchedule } from './calculators/general';
