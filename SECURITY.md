# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in `colombia-tax-engine`, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email: **security@colombiataxengine.dev** (or create a [private security advisory](https://github.com/camilopiedra92/colombia-tax-engine/security/advisories/new))
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Action                    | Timeline              |
| ------------------------- | --------------------- |
| Acknowledgement           | 48 hours              |
| Initial assessment        | 5 business days       |
| Fix development & release | 14 business days      |
| Public disclosure         | After fix is released |

### What to Expect

- We will acknowledge your report within **48 hours**
- We will provide regular updates on the progress
- We will credit you in the security advisory (unless you prefer anonymity)
- We follow [responsible disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure) practices

### Scope

This policy applies to:

- The `colombia-tax-engine` npm package
- Source code in this repository
- Documentation and examples

### Out of Scope

- Tax law interpretation disputes (use GitHub Issues instead)
- Vulnerabilities in dependencies (report to the dependency maintainer)
- Social engineering attacks

## Security Best Practices for Users

- Always use the **latest version** of the package
- Run `npm audit` regularly on your projects
- Verify package integrity with `npm audit signatures`
- Pin exact dependency versions in production
