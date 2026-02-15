# Changelog

All notable changes to the Colombian Tax Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-15

### Added

- Initial release of portable Colombian Tax Engine
- Complete implementation of Formulario 210 (Declaración de Renta Personas Naturales)
- All tax schedules: General, Pensiones, Dividendos, Ganancia Ocasional
- Impuesto al Patrimonio (Wealth Tax) implementation
- ICA automatic optimization (Cost vs Tax Credit)
- Dividend discount lock (prevents artificial refunds)
- 100% test coverage with 17 comprehensive test suites
- Full TypeScript type definitions
- Zero runtime dependencies
- Standalone package configuration

### Tax Law Implementation

- Estatuto Tributario (ET): Art. 55-57, 115, 119, 126-1/4, 188, 206, 241, 242, 245, 254-260-1, 261-286, 292-3, 295-3, 299-317, 330-337, 387, 592-594, 807-809
- Ley 2277/2022: Dividend consolidation, 1340 UVT limit, electronic invoice exclusion, wealth tax
- Ley 2010/2019: 0% presumptive income
- Ley 2380/2024: 37% food donation tax credit
- DUR 1625/2016: Independent contractors social security base
- Decreto 2229/2023: 2025 tax calendar

### Documentation

- Comprehensive README.md
- Detailed USAGE.md with examples for all income categories
- Complete API reference
- Migration guide

### Testing

- 17 test suites covering all scenarios
- Audit compliance tests
- Full coverage tests
- Edge case handling

## [Unreleased]

### Planned

- npm package publication
- CLI tool for quick calculations
- JSON schema validation
- Additional documentation in Spanish
