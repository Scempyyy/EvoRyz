# Contributing to EvoRyz

Thank you for your interest in contributing to **EvoRyz**! We welcome bug reports, feature suggestions, architectural improvements, and code contributions.

---

## Code of Conduct

Please maintain a respectful, constructive, and inclusive environment for all developers and contributors.

---

## Development Workflow

1. **Fork the Repository**: Create your own copy of the repository on GitHub.
2. **Clone Locally**:
   ```bash
   git clone https://github.com/<your-username>/EvoRyz.git
   cd EvoRyz
   ```
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Run Verification & Tests**:
   Ensure all TypeScript types and Jest tests pass before opening a PR:
   ```bash
   npm test
   npx tsc --noEmit
   ```
6. **Commit with Clear Messages**:
   Follow conventional commits format (`feat:`, `fix:`, `docs:`, `chore:`).
7. **Submit a Pull Request**:
   Push your branch and submit a PR against `main`. Provide a clear summary of what was added or changed.

---

## Security Vulnerabilities

If you discover a security vulnerability or sensitive data exposure, please do **not** open a public issue. Instead, email: **business.scempyy@outlook.com**.
