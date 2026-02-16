# ❓ Frequently Asked Questions

## General

### Q: Does this engine calculate taxes for companies (personas jurídicas)?

**A:** No. This engine currently only supports **natural persons** (personas naturales) using Formulario 210. Support for personas jurídicas (Formulario 110) is on the [roadmap](./ROADMAP.md).

### Q: Which tax years are supported?

**A:** The engine supports tax years **2024, 2025, and 2026**. Each year uses the correct UVT value and tax rules for that period.

### Q: Is this engine officially endorsed by DIAN?

**A:** No. This is an independent open-source implementation based on public tax law. Always verify results with a certified tax professional.

### Q: Does the engine require an internet connection?

**A:** No. All calculations are performed locally with zero external dependencies or API calls.

---

## Technical

### Q: Can I use this without TypeScript?

**A:** Yes! The package ships compiled JavaScript with TypeScript type definitions. You can use it in plain JavaScript projects.

### Q: Why does the engine have zero dependencies?

**A:** Zero dependencies means:
- **Security**: No supply chain attack surface
- **Reliability**: No breaking changes from upstream
- **Performance**: Minimal bundle size
- **Portability**: Works anywhere Node.js runs

### Q: How is the UVT value determined?

**A:** The UVT (Unidad de Valor Tributario) is set per year in the engine's rules:
- 2024: $47,065 COP
- 2025: $49,799 COP  
- 2026: $52,631 COP

These values are updated annually per DIAN resolution.

### Q: What happens if I pass invalid data?

**A:** The engine performs basic validation. For missing or malformed data, it will throw descriptive errors. We recommend validating input data before passing it to `TaxEngine.calculate()`.

---

## Tax Law

### Q: How does the ICA optimization work?

**A:** The engine automatically determines whether your ICA (Industria y Comercio) payment is better used as:
1. **Cost/deduction** (100% deductible from taxable base)
2. **Tax credit** (50% direct discount from tax)

It calculates both scenarios and picks the one that results in the lowest tax.

### Q: What is the Dividend Discount Lock?

**A:** Per Ley 2277/2022, dividends declared at the component level receive a 19% discount. The Dividend Discount Lock ensures this discount never exceeds the marginal tax attributable to dividends, preventing artificial refunds.

### Q: Are presumptive income calculations included?

**A:** Yes. Per Ley 2010/2019, the presumptive income rate is 0% starting from tax year 2021.

---

## Support

### Q: I found a calculation error. How do I report it?

**A:** Open a [bug report](https://github.com/camilopiedra92/colombia-tax-engine/issues/new?template=bug_report.yml) and include the relevant tax law article reference.

### Q: Can I contribute to this project?

**A:** Absolutely! Read our [Contributing Guide](./CONTRIBUTING.md) to get started.
