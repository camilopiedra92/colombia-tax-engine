
import { describe, it, expect } from 'vitest';
import { TaxEngine } from '../index';
import { TaxPayer, IncomeSource, Deduction } from '../types';
import { getTaxRules } from '../rules';

// Helper to create a basic payer
const createPayer = (incomes: IncomeSource[] = [], deductions: Deduction[] = []): TaxPayer => ({
    id: '123456789',
    name: 'Test Audit User',
    year: 2024,
    declarationYearCount: 1,
    isResident: true,
    dependentsCount: 0,
    incomes,
    deductions,
    assets: [],
    liabilities: [],
    taxCredits: []
});

describe('Tax Engine Audit Fixes (Golden Standard)', () => {
    const rules = getTaxRules(2024);
    const UVT = rules.UVT;

    // 🚨 Bug Crítico 1: La base del Límite del 40%
    it('Bug 1: 40% limit should be calculated on Gross Income - INCR (before costs)', () => {
        // Independent: 100M Income. Costs: 60M. No INCR (simplified).
        // 40% Limit should be on 100M = 40M.
        // If calculated on Net (40M), Limit would be 16M.
        const incomeValue = 100000000;
        const costsValue = 60000000;
        
        const payer = createPayer([
            {
                id: '1',
                category: 'honorarios',
                description: 'Honorarios Independiente',
                grossValue: incomeValue,
                costs: costsValue,
                preferCostsOverExemption: true, // Use costs
                healthContribution: 0,
                pensionContribution: 0,
                solidarityFund: 0
            }
        ]);

        const result = TaxEngine.calculate(payer);
        const general = result.cedulaGeneral;

        // Base for 40% limit: Gross (100M) - INCR (0) = 100M
        const expectedLimitBase = incomeValue;
        const expectedLimit = expectedLimitBase * 0.40;

        // Check globalLimit matches 40M (assuming it's less than 1340 UVT approx 63M)
        expect(general.globalLimit).toBeCloseTo(expectedLimit, -1);
        
        // Ensure it is NOT 16M (which would be 40% of 40M)
        expect(general.globalLimit).not.toBeCloseTo((incomeValue - costsValue) * 0.40, -1);
    });

    // 🚨 Bug Crítico 2: FPV y AFC within "Smart Allocation"
    it('Bug 2: FPV and AFC should NOT be smart-allocated to Capital, must stay in Labor', () => {
        // Labor Income: 200M. Capital Income: 50M.
        // FPV: 50M.
        // If Smart Allocation moves FPV to Capital, Capital Net would be 0.
        // Correct behavior: FPV reduces Labor base (Labor is exempt 25%, Capital is full tax).
        // Wait, normally we WANT deductions in Capital to save 100% tax vs 75% tax in Labor.
        // BUT the law says FPV/AFC are tied to source. So they MUST stay in Labor.
        
        const laborIncome = 200000000;
        const capitalIncome = 50000000;
        const fpvValue = 30000000;

        const payer = createPayer(
            [
                {
                    id: '1',
                    category: 'renta_trabajo',
                    description: 'Salario',
                    grossValue: laborIncome,
                    healthContribution: 0, pensionContribution: 0, solidarityFund: 0
                },
                {
                    id: '2',
                    category: 'renta_capital',
                    description: 'Intereses',
                    grossValue: capitalIncome,
                    financialYields: false, // disable inflationary for simplicity
                    healthContribution: 0, pensionContribution: 0, solidarityFund: 0
                }
            ],
            [
                {
                    id: 'd1',
                    category: 'fpv',
                    description: 'Aporte Voluntario',
                    value: fpvValue
                }
            ]
        );

        const result = TaxEngine.calculate(payer);
        const general = result.cedulaGeneral;

        // Smart Allocation should NOT have imputed FPV to Capital
        // Imputed to Capital should be 0 (since we have no other deductions)
        expect(general.smartAllocation.imputedToCapital).toBe(0);
        
        // FPV should be accounted in totalExemptions
        expect(general.totalExemptions).toBeGreaterThanOrEqual(fpvValue); // Might include 25% exempt
    });

    // 🚨 Bug Crítico 3: "Doble Impacto" Rentas CAN
    it('Bug 3: CAN Income should be added to Gross and subtracted at the end', () => {
        // Colombia Income: 100M. CAN Income: 50M.
        // Gross: 150M.
        // Taxable: (Calculated on 100M) ... then - 50M CAN? No.
        // Law: CAN income is Exempt (Progressivity clause).
        // It enters the base to determine the rate (if consolidated? No, Decision 578 says it's EXEMPT).
        // The issue was: "return" early meant it didn't sum to Gross, but was subtracted at end.
        // If I have 100M local, 50M CAN.
        // Old Code: Gross = 100M. Net = ... - 50M CAN. Result = 50M Net. (Wrong, used CAN to reduce local tax).
        // New Code: Gross = 150M. Net = ... (depurated). Final Taxable = Net - 50M CAN.
        
        const localIncome = 100000000;
        const canIncome = 50000000;
        
        const payer = createPayer([
            {
                id: '1',
                category: 'renta_trabajo',
                description: 'Salario CO',
                grossValue: localIncome,
                healthContribution: 0, pensionContribution: 0, solidarityFund: 0
            },
            {
                id: '2',
                category: 'honorarios',
                description: 'Honorarios Perú',
                grossValue: canIncome,
                isCANIncome: true,
                healthContribution: 0, pensionContribution: 0, solidarityFund: 0
            }
        ]);

        const result = TaxEngine.calculate(payer);
        const general = result.cedulaGeneral;

        // Gross should be 150M
        expect(general.grossIncome).toBe(localIncome + canIncome);
        
        // Taxable Income should roughly be Local Income depurated.
        // It shouldn't be (Local - CAN).
        // If we assumed 0 deductions/exemptions:
        // Total Base = 150M.
        // Subtract CAN = 50M.
        // Taxable = 100M.
        
        // With the fix, we ensure CAN is treated as "Exempt" at the end of the process
        // but it doesn't reduce the tax of the Local income "below zero" or disproportionately?
        // Actually, if it's exempt, it just goes out.
        // The key is: it shouldn't produce a double subtraction.
        // If it wasn't in Gross, and we subtracted it from Net, we would be subtracting 50M from 100M -> 50M.
        // Which is wrong. It should be 100M taxable.
        
        // Let's verify result taxable income is close to 100M minus 25% exempt of 100M roughly.
        // Depuration of 150M:
        // 25% of 150M? No, 25% applies to Labor Eligible.
        // CAN income classified as Honorarios (without opt) -> Labor Eligible.
        // So 25% of 150M = 37.5M.
        // Limit 40% of 150M = 60M.
        // Net = 150M - 37.5M = 112.5M.
        // Subtract CAN 50M = 62.5M.
        // Taxable should be around 62.5M.
        
        // VS Old Logic (Return early):
        // Gross = 100M.
        // 25% of 100M = 25M.
        // Net = 75M.
        // Subtract CAN 50M.
        // Taxable = 25M. (THIS IS THE HUGE GAP! 25M vs 62.5M).
        
        expect(general.taxableIncome).toBeGreaterThan(40000000); 
    });

    // 🚨 Bug Crítico 4: Orden Compensación Pérdidas
    it('Bug 4: Loss Compensation should be applied AFTER deductions', () => {
        // Capital Income: 50M. Loss Carryforward: 20M. Deductions: 10M.
        // Correct Order:
        // 1. Income 50M.
        // 2. Deductions 10M. Net = 40M.
        // 3. Loss 20M. Taxable = 20M.
        // CarryForward Remaining used = 20M.
        
        // Incorrect Order (Old):
        // 1. Income 50M.
        // 2. Loss 20M. Base = 30M.
        // 3. Deductions 10M. Taxable = 20M.
        // Result is same? Not always.
        // If Deductions were 40M.
        // Correct: 50 - 40 = 10. Loss used = 10. Taxable = 0. Loss Remaining = 10.
        // Incorrect: 50 - 20 = 30. Deductions 40 -> Cap at 30? Or 10?
        // If deductions cap at 40% of 30 (=12). Taxable = 30 - 12 = 18.
        // USER LOSES DEDUCTIONS!
        
        // Let's test the "Loss of Deductions" scenario.
        const capitalIncome = 100000000;
        const loss = 50000000;
        // Deductions 40% of 100M = 40M.
        // If applied correctly: 
        // Base 100M. Deductions 40M. Net 60M. Loss 50M. Taxable 10M.
        // If applied early:
        // Base 100M - Loss 50M = 50M.
        // Deductions Limit 40% of 50M = 20M.
        // Taxable = 50M - 20M = 30M.
        // Difference: 10M vs 30M taxable. Wrong order hurts the taxpayer here (limits deductions).
        
        const payer = createPayer(
            [{
                id: '1', category: 'renta_capital', description: 'Cap', grossValue: capitalIncome,
                financialYields: false
            }],
            [{
                id: 'd1', category: 'intereses_vivienda', description: 'Int', value: 40000000 
            }]
        );
        payer.previousYearCapitalLosses = loss;

        const result = TaxEngine.calculate(payer);
        // Correct Taxable SHOULD BE 10M (approx).
        // If logic is wrong, it would be higher.
        
        expect(result.cedulaGeneral.taxableIncome).toBeLessThan(15000000); 
    });
    
    // 🚨 Bug Crítico 5: RAIS Global Limit
    it('Bug 5: RAIS Limit should be global (2500 UVT), not per income', () => {
       // 2 Incomes. Each tries to deduct 2000 UVT RAIS.
       // Total RAIS deducted should be 2500, NOT 4000.
       const uvtVal = UVT;
       const bigIncome = 10000 * uvtVal; 
       
       const payer = createPayer([
           {
               id: '1', category: 'renta_trabajo', description: 'Job 1', grossValue: bigIncome,
               voluntaryPensionRAIS: 2000 * uvtVal
           },
           {
               id: '2', category: 'renta_trabajo', description: 'Job 2', grossValue: bigIncome,
               voluntaryPensionRAIS: 2000 * uvtVal
           }
       ]);
       
       const result = TaxEngine.calculate(payer);
       // Check INCR total or specific logic
       // We can infer from Net Income or look at some debug if exposed?
       // General Result doesn't expose RAIS total directly.
       // But we know Total INCR.
       // Health 4% + Pension 4% + Sol 2% = 10% of Income.
       // Plus RAIS.
       
       const totalRaisExpected = 2500 * uvtVal;
       // Note: Inputs have 0 for health/pension, so incrTotal is purely RAIS.
       
       const totalIncr = result.cedulaGeneral.incrTotal;
       
       // Should be exactly capped at 2500 UVT
       expect(totalIncr).toBeCloseTo(totalRaisExpected, -5); 
    });

    // 💎 God Level: ICA Optimization
    it('God Level: ICA Optimization should pick best strategy', () => {
        // Independent with high income.
        // Income 200M. ICA Paid 2M (1%).
        // Scenario A (Cost): Income 200M - 2M = 198M. Tax ~ (Rate * 198)
        // Scenario B (Discount): Income 200M. Tax ~ (Rate * 200) - (2M * 50%).
        // Usually Discount is better if Tax Rate > 50% (Impossible in Colombia, max 39%).
        // WAIT.
        // Cost deduction reduces base by 100% of ICA. Saving = ICA * MarginalRate.
        // Discount reduces tax by 50% of ICA.
        // If MarginalRate > 50%, Cost is better.
        // But max MarginalRate is 39%.
        // So 100% * 39% = 39% saving.
        // Discount is ALWAYS 50% saving.
        // RESULT: Discount should almost ALWAYS be better in Colombia.
        // Exception: If user has 0 tax (due to exemptions), discount is wasted.
        // Cost might increase loss carryforward?
        
        // Let's test a case where tax is high. Discount should win.
        const income = 200000000;
        const ica = 5000000; // 5M
        
        const payer = createPayer([{
            id: '1', category: 'honorarios', description: 'Indep', grossValue: income,
            preferCostsOverExemption: true,
            costs: 0,
            icaPaid: ica
        }]);
        
        const result = TaxEngine.calculate(payer);
        
        // If discount chosen, totalTaxCredits should include ~2.5M.
        // If cost chosen, totalCosts should include 5M.
        
        // Given 39% max rate < 50%, Discount wins.
        const discountFound = result.totalTaxCredits > 2000000;
        expect(discountFound).toBe(true);
        expect(result.cedulaGeneral.costs).toBe(0); // Should not be in costs
    });

    // 📜 Regla: Componente Inflacionario 2024 (50.88%)
    it('Regulatory: Inflationary Component should satisfy 2024 rate', () => {
        // Financial Yield 100M.
        // Non-taxable = 100M * 50.88% = 50.88M.
        // Taxable = 49.12M.
        
        const yieldVal = 100000000;
        const payer = createPayer([{
            id: '1', category: 'renta_capital', description: 'Yield', grossValue: yieldVal,
            financialYields: true
        }]);
        
        const result = TaxEngine.calculate(payer);
        // Gross reported in general schedule might be effective gross or total gross?
        // In general.ts we modify capitalNonLaborGross with effectiveGross.
        // BUT generalResult.grossIncome sums totalGross (raw).
        // tax is calculated on taxableIncome.
        
        // Taxable Income (assuming 0 deductions) = Effective Gross.
        // Effective Gross = 100 - 50.88 = 49.12M.
        
        expect(result.cedulaGeneral.taxableIncome).toBeCloseTo(yieldVal * (1 - 0.5088), -1);
    });

    // 📜 Regla: Loterías (20% plano, sin exención en renta)
    it('Regulatory: Lotteries should be taxed at 20% exactly (no 48 UVT exempt in annual tax)', () => {
        const lotteryPrize = 100000000;
        const payer = createPayer([{
            id: 'lot', category: 'loteria_premios', description: 'Premio Baloto',
            grossValue: lotteryPrize
        }]);
        
        const result = TaxEngine.calculate(payer);
        const go = result.gananciaOcasional;
        
        // Should be 0 exempt
        expect(go.exemptions).toBe(0);
        // Tax 20%
        expect(go.taxLotteries).toBe(20000000);
        expect(go.totalTax).toBe(20000000);
    });

    // 📜 Regla: Donaciones Recibidas (20% exento, tope 1625 UVT)
    it('Regulatory: Donations Received should be 20% exempt capped at 1625 UVT', () => {
        const uvtVal = UVT;
        // Case 1: Small donation (below cap)
        // 100M donation. Exempt 20M.
        const smallDonation = 100000000;
        const payer1 = createPayer([{
            id: 'don1', category: 'ganancia_ocasional', description: 'Donación Recibida Familiar',
            grossValue: smallDonation, heldDurationDays: 1000 // > 2 years equivalent for GO check
        }]);
        const res1 = TaxEngine.calculate(payer1);
        expect(res1.gananciaOcasional.exemptions).toBe(20000000);

        // Case 2: Huge donation (above cap)
        // Cap is 1625 UVT.
        const capAmount = 1625 * uvtVal;
        const hugeDonation = 10000000000; // 10B
        const payer2 = createPayer([{
            id: 'don2', category: 'ganancia_ocasional', description: 'Donación Recibida',
            grossValue: hugeDonation, heldDurationDays: 1000
        }]);
        const res2 = TaxEngine.calculate(payer2);
        expect(res2.gananciaOcasional.exemptions).toBeCloseTo(capAmount, -1);
    });

    // 💎 God Level: Dividend Discount Lock
    it('God Level: Dividend Discount (19%) should NOT exceed the tax generated by the dividends', () => {
        // We need a scenario where 19% discount > Marginal Tax from Dividends.
        // This happens if the Dividend adds very little tax (e.g. falls in low bracket or exempt range of general?).
        // Actually, Dividends are added ON TOP of General.
        // If General is 0, Dividends start at 0 bracket (0-1090 UVT = 0%).
        // But Discount is calculated on (Dividend - 1090 UVT) * 19%.
        // Wait, if Rate is 0%, Tax is 0. Discount is (Base * 19%).
        // So Discount > Tax (0).
        // If we don't lock it, we get a Tax Credit that eats into other taxes (impossible) or generated negative tax?
        // Code prevents negative tax, but we want to ensure the discount is capped at the marginal tax.

        // Scenario:
        // General Income: 0.
        // Dividend Sub1: 1500 UVT.
        // Base for tax: 1500 UVT.
        // Tax Table 2024:
        // 0-1090: 0%.
        // 1090-1700: 19%.
        // Tax = (1500 - 1090) * 19% = 410 * 0.19 = 77.9 UVT.
        
        // Discount Base: (1500 - 1090) = 410 UVT.
        // Discount Rate: 19%.
        // Discount = 410 * 0.19 = 77.9 UVT.
        
        // In this mathematical equality case, Tax == Discount. Net Tax = 0.
        // It matches exactly.
        
        // We need a case where Marginal Tax < 19% Discount?
        // Since the first bracket IS 19%, it's hard to be less than 19%.
        // UNLESS the dividend spans across the 0% bracket of the General Schedule?
        // But Dividends are added ON TOP.
        // If General is 0. Dividends fill the 0-1090 bucket (0% tax).
        // But the Discount formula (Art 254-1) says "dividendos... que excedan 1090 UVT".
        // So the discount base MATCHES the taxable base of the first bracket.
        // And the rate MATCHES the tax rate (19%).
        // So it seems they always cancel out in the first bracket.
        
        // What if we are in a higher bracket?
        // General: 5000 UVT (33% bracket).
        // Dividend: 1000 UVT. (Adds to 5000->6000 bracket).
        // Tax Rate: 33%.
        // Discount: 19%.
        // Tax > Discount. Safe.
        
        // What if "Dividend Double Dipping"?
        // The lock is for safety. Let's force a scenario or just verify it works as expected (0 net tax).
        // Let's use the 1500 UVT scenario. Tax should be exactly covered by Discount.
        // Net Tax for Sub1 should be 0.
        
        const dividendVal = 1500 * UVT;
        const payer = createPayer([{
            id: 'div', category: 'dividendos_ordinarios', description: 'Divs 2023',
            grossValue: dividendVal,
            isForeignSource: false,
            partnersDistributionYear: 2020 // > 2017 -> Sub1
        }]);
        
        const result = TaxEngine.calculate(payer);
        const sub1 = result.cedulaDividendos.subCedula1;
        
        // Tax should be > 0
        expect(sub1.tax).toBeGreaterThan(0);
        // Discount should be > 0
        expect(sub1.discount19).toBeGreaterThan(0);
        // Net Tax should be 0 (Discount fully covers it)
        expect(sub1.netTax).toBe(0);
        
        // Verify constraint: Discount <= Tax
        expect(sub1.discount19).toBeLessThanOrEqual(sub1.tax);
    });

});
