# Security Policy

## Reporting a vulnerability

If you find a security issue, please **do not open a public issue**. Instead, report it
privately via GitHub's **Security advisories** ("Report a vulnerability" on the Security
tab). Include steps to reproduce and any relevant logs. We aim to respond within a few days.

## Secrets

- **No secrets live in this repository.** All API keys are read from environment variables
  at runtime (`.env.local` locally, host env vars in production). `.env*` files are
  gitignored (except the placeholder `.env.example`).
- If you believe a key was ever committed, **rotate it immediately** at the provider and
  let us know so history can be scrubbed.
- All third-party API keys are used **server-side only** (in `app/api/*` route handlers).
  No secret is exposed to the browser; there are no `NEXT_PUBLIC_*` secret variables.

## Data & privacy

WalletFolio is **read-only and non-custodial**. It never requests wallet connections,
signatures, or private keys — it only reads public on-chain data for addresses you enter.

## Hardening in this repo

- `.gitignore` blocks all env/key files.
- Secret scanning runs in CI (gitleaks) and via GitHub's native push protection.
- `/api/*` routes are rate-limited per IP to limit abuse of upstream API quotas.
- Dependabot + `npm audit` in CI flag vulnerable dependencies.
