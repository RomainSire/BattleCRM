## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Development

- **What is authoritative**: `CONTEXT.md` and `docs/adr/`, then `.scratch/battlecrm-ux/spec.md` and `.scratch/battlecrm-stack/spec.md`. A prototype (`prototype/*` branches) only shows a layout: when it disagrees with a spec (States, labels, colours), follow the spec. Prototypes 01–19 still show the old States.
- **All code is in English** (files, identifiers, tables, columns, endpoints, comments). Domain terms use the `_EN_` line of `CONTEXT.md`; a notion with no glossary term gets one there first.
- Review rules (error display, migrations, endpoints) are in `CODING_STANDARDS.md`.
- Run `pnpm check` before handing back. Web tests run in Chromium: once per machine, `pnpm exec playwright install chromium`. API tests need the dev Postgres: `docker compose -f compose.dev.yml up -d`. When Postgres runs but connections from the host fail (tests, `db:migrate`, 500s from the dev API), Romain's VPN is the cause: ask him to turn it off, then run again.
- Before handing an issue back, check whether it added a migration (`apps/api/drizzle/`); if so, apply it to the dev database: `pnpm --filter @battlecrm/api db:migrate`. Tests migrate a database of their own, so they never show a dev database left behind.
- Run `drizzle-kit push` only on a throwaway database.
- `.private/` holds personal infrastructure notes: it is git-ignored, never copy its content into a tracked file.
