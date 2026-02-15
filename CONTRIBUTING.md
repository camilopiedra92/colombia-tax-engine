# Contributing to Colombian Tax Engine 🇨🇴

Thank you for your interest in contributing to the Colombian Tax Engine! This project aims to be the most accurate, comprehensive, and reliable tax calculation engine for Colombian natural persons.

## 🎯 Project Goals

- **Accuracy**: 100% compliance with Colombian tax law (Estatuto Tributario, DIAN regulations)
- **Reliability**: 100% test coverage with comprehensive test cases
- **Performance**: Zero runtime dependencies, optimized calculations
- **Maintainability**: Clean, well-documented TypeScript code
- **Accessibility**: Easy to use, well-documented API

## 📋 How Can I Contribute?

### 1️⃣ Reporting Bugs

If you find a bug, please open an issue with:

- **Clear title**: Brief description of the issue
- **Description**: Detailed explanation of the problem
- **Steps to reproduce**: Minimal code example that demonstrates the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Tax law reference**: If applicable, cite the relevant article(s) from Estatuto Tributario or other regulations

**Example**:

```markdown
## Bug: Incorrect calculation of labor exemption

**Description**: The 25% labor exemption is not being ring-fenced correctly when there are negative incomes.

**Steps to reproduce**:
[code example]

**Expected**: Based on Art. 206 ET, the exemption should be limited to...
**Actual**: The engine calculates...

**Tax law reference**: Art. 206 ET, Concepto DIAN 123456
```

### 2️⃣ Suggesting Features

For new features or enhancements:

- **Check existing issues** first to avoid duplicates
- **Provide tax law basis**: Cite specific articles or DIAN guidance
- **Explain the use case**: Why is this feature needed?
- **Provide examples**: Show how it would be used

### 3️⃣ Submitting Pull Requests

We love pull requests! Here's the process:

#### Before You Start

1. **Open an issue** to discuss major changes
2. **Fork the repository** and create a branch from `main`
3. **Set up your development environment**

#### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/colombia-tax-engine.git
cd colombia-tax-engine

# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Run tests in watch mode while developing
npm run test:watch
```

#### Making Changes

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write your code**:
   - Follow the existing code style
   - Use TypeScript strict mode
   - Add JSDoc comments for public APIs
   - Keep functions focused and small

3. **Write tests**:
   - Add tests for all new functionality
   - Ensure 100% coverage is maintained
   - Include edge cases
   - Reference tax law in test descriptions

   **Example**:

   ```typescript
   describe("Labor Income Exemption (Art. 206 ET)", () => {
     test("should apply 25% exemption with ring-fencing for negative incomes", () => {
       // Test implementation
     });
   });
   ```

4. **Run the test suite**:

   ```bash
   npm test
   npm run test:coverage
   npm run typecheck
   ```

5. **Update documentation**:
   - Update README.md if needed
   - Update USAGE.md for API changes
   - Add entries to CHANGELOG.md
   - Document tax law references

6. **Commit your changes**:

   ```bash
   git add .
   git commit -m "feat: add support for X (Art. 123 ET)"
   ```

   Use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for test changes
   - `refactor:` for code refactoring
   - `chore:` for maintenance tasks

7. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request**:
   - Use a clear title and description
   - Reference any related issues
   - Explain the changes and why they're needed
   - Include tax law references

#### Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows the project's TypeScript style
- [ ] All tests pass (`npm test`)
- [ ] Test coverage is 100% (`npm run test:coverage`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Commit messages follow Conventional Commits
- [ ] No runtime dependencies added
- [ ] Tax law references are cited

## 🧪 Testing Guidelines

### Test Requirements

- **100% coverage** is mandatory (statements, branches, functions, lines)
- **Enterprise-grade quality**: Tests should be comprehensive, not just coverage-focused
- **Real-world scenarios**: Use realistic tax situations
- **Edge cases**: Test boundary conditions and unusual cases
- **Tax law validation**: Verify calculations against official DIAN examples

### Test Structure

```typescript
describe("Feature Name (Tax Law Reference)", () => {
  describe("Specific Calculation", () => {
    test("should handle normal case", () => {
      // Arrange
      const taxpayer: TaxPayer = {
        /* ... */
      };

      // Act
      const result = TaxEngine.calculate(taxpayer);

      // Assert
      expect(result.someValue).toBe(expectedValue);
    });

    test("should handle edge case", () => {
      // ...
    });
  });
});
```

## 📖 Tax Law References

When contributing, always reference the relevant tax law:

- **Estatuto Tributario (ET)**: Art. XXX
- **Leyes**: Ley XXXX/YYYY
- **Decretos**: Decreto XXXX/YYYY
- **Conceptos DIAN**: Concepto XXXXX de YYYY
- **Resoluciones**: Resolución XXX de YYYY

**Resources**:

- [Estatuto Tributario](https://estatuto.co/)
- [DIAN](https://www.dian.gov.co/)
- [DIAN - Normativa](https://www.dian.gov.co/normatividad/Paginas/default.aspx)

## 💡 Code Style

### TypeScript Guidelines

- Use **TypeScript strict mode**
- Prefer **const** over **let**
- Use **interfaces** for data structures
- Use **type** for unions and aliases
- Add **JSDoc** comments for public APIs
- Keep functions **pure** when possible
- Avoid **any** type (use unknown if needed)

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase`
- **Types**: `PascalCase`

### Code Organization

```typescript
// 1. Imports
import { TaxPayer, TaxResult } from "./types";

// 2. Constants
const MAX_DEDUCTION = 1000;

// 3. Types/Interfaces
interface CalculationContext {
  // ...
}

// 4. Helper functions
function calculateHelper(value: number): number {
  // ...
}

// 5. Main exported functions
export function mainCalculation(payer: TaxPayer): TaxResult {
  // ...
}
```

## 🔍 Review Process

1. **Automated checks**: CI will run tests, coverage, and type checking
2. **Code review**: Maintainers will review your code
3. **Tax law validation**: We'll verify calculations against official sources
4. **Feedback**: We may request changes
5. **Merge**: Once approved, we'll merge your PR

## 🚫 What We Don't Accept

- Runtime dependencies (except peer dependencies)
- Code that reduces test coverage below 100%
- Calculations without tax law references
- Breaking changes without discussion
- Code that doesn't pass TypeScript strict mode
- Untested code

## ❓ Questions?

If you have questions:

1. Check existing issues and discussions
2. Read the documentation (README.md, USAGE.md)
3. Open a new issue with the "question" label

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution helps Colombian taxpayers better understand and comply with their tax obligations. Your time and effort are greatly appreciated!

---

**Made with ❤️ for the Colombian developer community**
