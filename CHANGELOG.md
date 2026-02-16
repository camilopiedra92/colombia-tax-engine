# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-15

### Added
- **Platinum Audit Compliance**: Implemented 6 critical "God Level" fixes verified by external audit.
- **Dependents Optimization**: Smart simulation to maximize benefits (10% vs 72 UVT) within 40% limit.
- **25% Exempt Base**: Corrected deduction order (Ley 2277 deductions subtracted first).
- **Pension INCR**: Deduct Health/Solidarity before exemption to prevent "double dipping".
- **RAIS Global Limit**: Strict 25% limit based on Total Tributary Income (Gross - INCR).
- **CAN vs Losses**: Reordered logic to preserve tax loss shields.
- **Compliance Caps**: Housing sale cost cap (15,000 UVT) and strict Wealth Threshold (>).

## [1.1.1] - 2026-02-15

### Added

- **CI/CD**: GitHub Actions workflows for CI (Node 20/22), automated npm publishing with OIDC provenance, and CodeQL security scanning
- **Dependabot**: Weekly automated dependency updates for npm and GitHub Actions
- **Security**: `SECURITY.md` with vulnerability reporting process and SLA timelines
- **Governance**: `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), structured issue templates, PR template
- **DX Tooling**: ESLint (typescript-eslint strict), Prettier, Commitlint, Husky (pre-commit, commit-msg, pre-push), EditorConfig
- **Documentation**: `FAQ.md`, `TROUBLESHOOTING.md`, `ROADMAP.md`, `CHANGELOG.md`
- **Monitoring**: Bundle size tracking with size-limit (4.44 KB brotlied, 50 KB budget)
- **Funding**: GitHub Sponsors configuration
- **Badges**: npm version, downloads, CI status, coverage, bundle size, license

### Changed

- **README.md**: Complete rewrite with badges, navigation, feature tables, and structured layout
- **package.json**: Added 8 new scripts (`lint`, `format`, `docs`, `size`, `validate`, etc.), `publishConfig` with provenance, funding info, expanded keywords
- **`.npmignore`**: Updated to exclude all governance and config files from published package
- **`@types/node`**: Upgraded to v25

## [1.1.1] - 2026-02-15

### Fixed

- **Coverage Regression**: Restored 100% coverage by removing unreachable defensive code in `patrimonio-impuesto.ts`
- **Linting**: Resolved all 8 ESLint warnings (unused imports, non-null assertions) across source files
- **Cleanup**: Removed stray development files (`audit_src_dump.md`, `generate_audit_doc.py`) from repository

## [1.1.0] - 2026-02-15

### Added

- **CI/CD**: GitHub Actions workflows for CI (Node 20/22), automated npm publishing with OIDC provenance, and CodeQL security scanning
- **Dependabot**: Weekly automated dependency updates for npm and GitHub Actions
- **Security**: `SECURITY.md` with vulnerability reporting process and SLA timelines
- **Governance**: `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), structured issue templates, PR template
- **DX Tooling**: ESLint (typescript-eslint strict), Prettier, Commitlint, Husky (pre-commit, commit-msg, pre-push), EditorConfig
- **Documentation**: `FAQ.md`, `TROUBLESHOOTING.md`, `ROADMAP.md`, `CHANGELOG.md`
- **Monitoring**: Bundle size tracking with size-limit (4.44 KB brotlied, 50 KB budget)
- **Funding**: GitHub Sponsors configuration
- **Badges**: npm version, downloads, CI status, coverage, bundle size, license

### Changed

- **README.md**: Complete rewrite with badges, navigation, feature tables, and structured layout
- **package.json**: Added 8 new scripts (`lint`, `format`, `docs`, `size`, `validate`, etc.), `publishConfig` with provenance, funding info, expanded keywords
- **`.npmignore`**: Updated to exclude all governance and config files from published package
- **`@types/node`**: Upgraded to v25

### Fixed

- All source files formatted with Prettier

### Added

- Complete Colombian tax engine for Formulario 210 (Declaración de Renta Personas Naturales)
- **Cédula General** (Art. 330-336 ET): Full income, deductions, exemptions with 40%/1,340 UVT global limit
- **Cédula Pensiones** (Art. 337 ET): Pension income with 1,000 UVT monthly exemption
- **Cédula Dividendos** (Art. 242/245 ET, Ley 2277/2022): Sub-cédula 1 & 2 with consolidation, 19% discount, non-resident 20% flat rate
- **Ganancia Ocasional** (Art. 299-317 ET): General 15% and lottery 20% rates with comprehensive exemptions
- **Descuentos Tributarios** (Art. 254-260-1 ET): Foreign tax credit, donations, R&D, IVA fixed assets
- **Impuesto al Patrimonio** (Art. 292-3 ET, Ley 2277/2022): Progressive rates with housing exclusion
- **Anticipo** (Art. 807 ET): Progressive advance tax calculation
- **Obligados a Declarar** (Art. 592-594 ET): Filing obligation assessment
- **ICA Optimization**: Automatic simulation for cost vs. discount treatment
- **Dividend Discount Lock**: Prevents artificial refunds from exceeding marginal tax
- Tax calendar with filing deadlines (Decreto 2229/2023)
- Multi-year support: 2024, 2025, 2026
- 100% test coverage (251 tests across 17 suites)
- Zero runtime dependencies
- Full TypeScript with type declarations

[1.1.0]: https://github.com/camilopiedra92/colombia-tax-engine/releases/tag/v1.1.0
[1.0.0]: https://github.com/camilopiedra92/colombia-tax-engine/releases/tag/v1.0.0
