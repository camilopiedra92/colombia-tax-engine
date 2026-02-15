/**
 * Basic Example - Colombian Tax Engine
 * 
 * This example demonstrates a simple tax calculation for a salaried employee
 * with some deductions and assets.
 */

import { TaxEngine, TaxPayer } from '../src/index';

// Define a taxpayer with salary income
const taxpayer: TaxPayer = {
  id: '1234567890',
  name: 'Juan Pérez',
  year: 2026,
  isResident: true,
  dependentsCount: 1,
  
  incomes: [
    {
      id: 'salary-2026',
      description: 'Salario Empresa XYZ',
      category: 'renta_trabajo',
      grossValue: 120000000,           // $120M COP annual salary
      healthContribution: 4800000,     // 4% health
      pensionContribution: 4800000,    // 4% pension
      withholdingTax: 8500000,         // Tax withheld by employer
    },
  ],
  
  deductions: [
    {
      id: 'dependent-2026',
      category: 'dependientes',
      description: '1 Dependiente',
      value: 3771360,                  // 72 UVT × 52,374
    },
    {
      id: 'health-2026',
      category: 'salud_prepagada',
      description: 'Medicina Prepagada',
      value: 6000000,
      monthsReported: 12,
    },
  ],
  
  assets: [
    {
      id: 'savings-2026',
      category: 'cuenta_bancaria',
      description: 'Cuenta de Ahorros',
      value: 30000000,
    },
  ],
  
  liabilities: [],
};

// Calculate tax
const result = TaxEngine.calculate(taxpayer);

// Display results
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  COLOMBIAN TAX ENGINE - CALCULATION RESULT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();
console.log(`Taxpayer: ${taxpayer.name}`);
console.log(`ID: ${taxpayer.id}`);
console.log(`Tax Year: ${taxpayer.year}`);
console.log();
console.log('GENERAL SCHEDULE (Cédula General)');
console.log('─────────────────────────────────────────────');
console.log(`Gross Income:        ${formatCurrency(result.cedulaGeneral.grossIncome)}`);
console.log(`INCR (Contributions):${formatCurrency(result.cedulaGeneral.incrTotal)}`);
console.log(`Net Income:          ${formatCurrency(result.cedulaGeneral.netIncome)}`);
console.log(`Total Deductions:    ${formatCurrency(result.cedulaGeneral.totalDeductions)}`);
console.log(`Taxable Income:      ${formatCurrency(result.cedulaGeneral.taxableIncome)}`);
console.log(`Tax:                 ${formatCurrency(result.cedulaGeneral.tax)}`);
console.log();
console.log('CONSOLIDATED TAX');
console.log('─────────────────────────────────────────────');
console.log(`Total Income Tax:    ${formatCurrency(result.totalIncomeTax)}`);
console.log(`Tax Credits:         ${formatCurrency(result.totalTaxCredits)}`);
console.log(`Net Income Tax:      ${formatCurrency(result.netIncomeTax)}`);
console.log();
console.log('WITHHOLDINGS & ADVANCE');
console.log('─────────────────────────────────────────────');
console.log(`Total Withholding:   ${formatCurrency(result.totalWithholding)}`);
console.log(`Advance Next Year:   ${formatCurrency(result.anticipoNextYear)}`);
console.log();
console.log('WEALTH TAX (Impuesto al Patrimonio)');
console.log('─────────────────────────────────────────────');
console.log(`Gross Patrimony:     ${formatCurrency(result.patrimonio.patrimonioBruto)}`);
console.log(`Net Patrimony:       ${formatCurrency(result.patrimonio.patrimonioLiquido)}`);
console.log(`Subject to Tax:      ${result.patrimonioTax.isSubject ? 'Yes' : 'No'}`);
console.log(`Wealth Tax:          ${formatCurrency(result.patrimonioTax.tax)}`);
console.log();
console.log('FINAL BALANCE');
console.log('─────────────────────────────────────────────');
console.log(`Total Tax Due:       ${formatCurrency(result.totalTaxDue)}`);
console.log(`Balance to Pay:      ${formatCurrency(result.balanceToPay)}`);
console.log();
console.log('FILING INFORMATION');
console.log('─────────────────────────────────────────────');
console.log(`Obligated to File:   ${result.isObligatedToFile ? 'YES' : 'NO'}`);
if (result.isObligatedToFile) {
  console.log(`Reasons:             ${result.obligationReasons.join(', ')}`);
}
console.log(`Filing Deadline:     ${result.filingDeadline || 'N/A'}`);
console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Helper function to format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
