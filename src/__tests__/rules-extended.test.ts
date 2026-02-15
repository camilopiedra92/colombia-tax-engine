import { describe, it, expect } from 'vitest';
import { calculateSocialSecurity, getTaxRules } from '../rules';

const YEAR = 2024;
const rules = getTaxRules(YEAR);
const SMLMV = rules.SMLMV;

describe('rules.ts — Extended Coverage', () => {

    // ═══ calculateSocialSecurity ═══
    describe('calculateSocialSecurity (Helper)', () => {

        it('should calculate social security for independant worker (40% IBC, no FSP)', () => {
             // Income: 10M → IBC = 4M (< 4 SMLMV) → No FSP
             // Health (12.5%) + Pension (16%) on 4M
             // 4M * 0.285 = 1,140,000
             const income = 10_000_000;
             const result = calculateSocialSecurity(income, SMLMV, true);
             
             const expectedIBC = 4_000_000; // 10M * 40%
             const expectedTotal = expectedIBC * (0.125 + 0.16); // 28.5%
             
             expect(result.baseIBC).toBe(expectedIBC);
             expect(result.solidarity).toBe(0);
             expect(result.total).toBe(expectedTotal);
        });

        it('should calculate social security for employee (100% IBC, rate 8%)', () => {
            // Income: 5M → IBC = 5M
            // Rate: 4% (Health) + 4% (Pension) = 8%
            // 5M * 0.08 = 400,000
            // FSP: 5M / 1.3M = 3.84 SMLMV (< 4) → 0 FSP
            const income = 5_000_000;
            const result = calculateSocialSecurity(income, SMLMV, false);

            expect(result.baseIBC).toBe(5_000_000);
            expect(result.total).toBe(400_000);
        });

        it('should apply FSP 1% for income >= 4 SMLMV and < 16 SMLMV', () => {
            // Income: 6M (4.6 SMLMV)
            // Employee → IBC 6M
            // FSP: 1%
            // Health+Pension: 8%
            // Total: 9%
            const income = 6_000_000;
            const result = calculateSocialSecurity(income, SMLMV, false);
            
            expect(result.solidarity).toBe(6_000_000 * 0.01);
            expect(result.total).toBe(6_000_000 * 0.09);
        });

        it('should apply progressive FSP rates correctly', () => {
            // Test 16-17 SMLMV range (1% + 0.2%)
            const income16_5 = 16.5 * SMLMV;
            const res1 = calculateSocialSecurity(income16_5, SMLMV, false);
            expect(res1.solidarity).toBeCloseTo(income16_5 * (0.01 + 0.002));

            // Test 17-18 SMLMV range (1% + 0.4%)
            const income17_5 = 17.5 * SMLMV;
            const res2 = calculateSocialSecurity(income17_5, SMLMV, false);
            expect(res2.solidarity).toBeCloseTo(income17_5 * (0.01 + 0.004));

            // Test 18-19 SMLMV range (1% + 0.6%)
            const income18_5 = 18.5 * SMLMV;
            const res3 = calculateSocialSecurity(income18_5, SMLMV, false);
            expect(res3.solidarity).toBeCloseTo(income18_5 * (0.01 + 0.006));

            // Test 19-20 SMLMV range (1% + 0.8%)
            const income19_5 = 19.5 * SMLMV;
            const res4 = calculateSocialSecurity(income19_5, SMLMV, false);
            expect(res4.solidarity).toBeCloseTo(income19_5 * (0.01 + 0.008));
            
             // Test > 20 SMLMV (1% + 1% = 2%)
            const income21 = 21 * SMLMV;
            const res5 = calculateSocialSecurity(income21, SMLMV, false);
            expect(res5.solidarity).toBeCloseTo(income21 * 0.02);
        });

        it('should cap IBC at 25 SMLMV', () => {
            // Income: 100M (> 25 SMLMV which is ~32.5M)
            const hugeIncome = 100_000_000;
            const cap = 25 * SMLMV;
            
            const result = calculateSocialSecurity(hugeIncome, SMLMV, false);
            
            expect(result.baseIBC).toBe(cap);
            // Calculation should be based on capped amount
            // FSP is max 2% on cap
            expect(result.solidarity).toBe(cap * 0.02);
            expect(result.healthAndPension).toBe(cap * 0.08); // Employee 8%
        });
    });
});
