# Story 1.1: Initialize Monorepo Structure

Status: done

<!-- Ultimate Context Engine Analysis: 2026-02-05 -->
<!-- This is the first story - no previous story learnings available -->

## Story

As a **developer**,
I want a **properly configured pnpm monorepo with frontend and backend workspaces**,
so that I can **develop both applications with shared tooling and consistent configuration**.

## Acceptance Criteria

1. **AC1:** A `pnpm-workspace.yaml` is created with `apps/*` and `packages/*` configured
2. **AC2:** The root `package.json` contains scripts for running both apps (`pnpm dev`, `pnpm build`, `pnpm lint`, etc.)
3. **AC3:** A root `.env` file exists with placeholder configuration variables (copy from `.env.example`)
4. **AC4:** A `.gitignore` properly excludes `node_modules`, `.env`, build artifacts, and IDE files
5. **AC5:** The folder structure matches: `apps/frontend/`, `apps/backend/`, `packages/shared/`
6. **AC6:** Both apps can be started with a single root command (`pnpm dev`)

## Tasks / Subtasks

- [x] **Task 1: Initialize Root Monorepo** (AC: 1, 2)
  - [x] 1.1 Create `pnpm-workspace.yaml` with proper workspace configuration
  - [x] 1.2 Create root `package.json` with workspace scripts
  - [x] 1.3 Ensure pnpm is installed and configured correctly

- [x] **Task 2: Create Directory Structure** (AC: 5)
  - [x] 2.1 Create `apps/frontend/` directory
  - [x] 2.2 Create `apps/backend/` directory
  - [x] 2.3 Create `packages/shared/` directory (placeholder for future)

- [x] **Task 3: Setup Frontend Placeholder** (AC: 5, 6)
  - [x] 3.1 Initialize `apps/frontend/package.json` with name `@battlecrm/frontend`
  - [x] 3.2 Add placeholder `dev` script that echoes "Frontend not yet scaffolded"

- [x] **Task 4: Setup Backend Placeholder** (AC: 5, 6)
  - [x] 4.1 Initialize `apps/backend/package.json` with name `@battlecrm/backend`
  - [x] 4.2 Add placeholder `dev` script that echoes "Backend not yet scaffolded"

- [x] **Task 5: Environment Configuration** (AC: 3)
  - [x] 5.1 Create `.env.example` with all required placeholder variables
  - [x] 5.2 Create `.env` by copying from `.env.example`
  - [x] 5.3 Document environment variable purposes in comments

- [x] **Task 6: Git Configuration** (AC: 4)
  - [x] 6.1 Create comprehensive `.gitignore` with all required patterns
  - [x] 6.2 Verify `.env` is properly ignored
  - [x] 6.3 Verify `node_modules` is properly ignored

- [x] **Task 7: Documentation** (AC: 2)
  - [x] 7.1 Update root `README.md` with project setup instructions
  - [x] 7.2 Document available pnpm commands

- [x] **Task 8: Verification** (AC: 1-6)
  - [x] 8.1 Run `pnpm install` successfully at root
  - [x] 8.2 Run `pnpm dev` and verify both app placeholders respond
  - [x] 8.3 Verify workspace linking works correctly

### Review Follow-ups (User)

- [x] [MED-1] Remove `main` field from `packages/shared/package.json` or create `src/index.ts` placeholder → Resolved: `src/index.ts` created, content fixed to `export {}` by review #2
- [x] [MED-3] Fix README.md:41 - replace `cd BattleCRM` with correct directory name → Resolved: `cd BattleCRM` IS correct (project renamed from tiny-crm in commit bfc1747)

## Senior Developer Review (AI)

### Review #1

**Review Date:** 2026-02-05
**Review Outcome:** Changes Requested
**Reviewer:** Claude Opus 4.5 (Code Review Agent)

#### Summary

All 6 Acceptance Criteria are correctly implemented. All 8 tasks marked [x] are verified complete. Found 6 issues total (0 Critical, 3 Medium, 3 Low).

#### Action Items

- [x] [MED-2] Add missing `format` and `type-check` scripts to `packages/shared/package.json`
- [x] [MED-1] Shared package references non-existent `src/` directory in `main` field → Fixed in review #2
- [x] [MED-3] README.md uses `cd BattleCRM` but actual directory is `tiny-crm` → No longer valid after rename (bfc1747)
- [x] [LOW-1] Standardize filter syntax - updated `project-context.md` to use `@battlecrm/frontend`
- [x] [LOW-2] Added `license` and `repository` fields to root `package.json`

### Review #2

**Review Date:** 2026-02-05
**Review Outcome:** Approved
**Reviewer:** Claude Opus 4.6 (Code Review Agent)

#### Summary

All 6 Acceptance Criteria verified implemented. All 27 subtasks verified complete. Found 5 issues (0 Critical, 3 Medium, 2 Low). All MEDIUM issues auto-fixed.

#### Action Items

- [x] [MED-1] `packages/shared/src/index.ts` had `console.log("hello world")` → Fixed to `export {}`
- [x] [MED-2] `engines.pnpm >= 8.0.0` inconsistent with `packageManager: pnpm@9.15.0` → Fixed to `>=9.0.0`
- [x] [MED-3] Review Follow-ups (User) section was stale → Updated both items as resolved
- [ ] [LOW-1] `.gitignore` contains patterns for unused technologies (.next/, .nuxt/, yarn-*)
- [ ] [LOW-2] File List missing `packages/shared/src/index.ts` entry → Added

#### Notes

- All ACs genuinely implemented and verified via file reads + git + CLI commands
- pnpm workspace linking confirmed working (4 workspace projects recognized)
- `.env` properly gitignored and identical to `.env.example` (placeholder values as per AC3)
- Previous review MED-1 and MED-3 resolved and closed

## Dev Notes

### Critical Architecture Requirements

**MUST USE: pnpm workspaces** - NOT Turborepo (explicitly forbidden for this project as overkill for solo dev)

**Node.js Version:** >= 20.6 (required for Adonis.js 6)

### Project Structure to Create

```
BattleCRM/
├── _bmad/                           # EXISTING - Do not touch
├── _bmad-output/                    # EXISTING - Do not touch
├── .env                             # NEW - Root environment (from .env.example)
├── .env.example                     # NEW - Template for .env
├── .gitignore                       # NEW/UPDATE - Git exclusions
├── package.json                     # NEW - Root workspace config
├── pnpm-workspace.yaml              # NEW - Workspace definition
├── README.md                        # NEW/UPDATE - Project docs
├── apps/
│   ├── frontend/                    # NEW - Placeholder (scaffold in Story 1.2)
│   │   └── package.json
│   └── backend/                     # NEW - Placeholder (scaffold in Story 1.3)
│       └── package.json
└── packages/
    └── shared/                      # NEW - Placeholder (optional, post-MVP)
        └── package.json
```

### Naming Conventions (CRITICAL - Apply from Story 1.1)

| Element | Convention | Example |
|---------|------------|---------|
| Workspace packages | @battlecrm/{name} | `@battlecrm/frontend`, `@battlecrm/backend` |
| Root scripts | kebab-case | `dev`, `build`, `type-check` |
| Environment vars | SCREAMING_SNAKE | `APP_NAME`, `DB_HOST` |

### pnpm-workspace.yaml (EXACT CONTENT)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root package.json Structure

```json
{
  "name": "battlecrm",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "format": "pnpm -r format",
    "test": "pnpm -r test",
    "type-check": "pnpm -r type-check"
  },
  "engines": {
    "node": ">=20.6.0",
    "pnpm": ">=8.0.0"
  }
}
```

### .env.example Template

```env
# ===========================================
# BattleCRM Environment Configuration
# ===========================================
# Copy this file to .env and fill in your values
# NEVER commit .env to version control!

# Application
APP_NAME=BattleCRM
APP_ENV=development
APP_DEBUG=true

# Frontend (Vite)
VITE_API_URL=http://localhost:3333/api
VITE_APP_URL=http://localhost:5173

# Backend (Adonis.js)
NODE_ENV=development
APP_KEY=generate_32_char_random_key_here
PORT=3333
HOST=0.0.0.0

# Database (Supabase PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=battlecrm
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/battlecrm

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Session (Adonis.js)
SESSION_DRIVER=cookie
SESSION_COOKIE_NAME=battlecrm_session
SESSION_SECURE=false
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax

# CORS
CORS_ORIGIN=http://localhost:5173

# Registration Control
ALLOW_REGISTRATION=true

# Logging
LOG_LEVEL=debug
```

### .gitignore Patterns (COMPREHENSIVE)

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Environment - CRITICAL: Never commit secrets
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
out/
.vite/

# IDE & Editors
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# OS files
.DS_Store
Thumbs.db

# Database
*.sqlite
*.db

# Temporary
tmp/
temp/
```

### Testing Standards Summary

- Unit tests co-located with source files
- E2E tests in separate `tests/e2e/` folder
- Test files named `*.test.ts` or `*.test.tsx`
- 80% minimum coverage for critical paths

### Project Structure Notes

**Alignment with Architecture:**
- Structure exactly matches Architecture Document ADR-1 (Monorepo Structure)
- pnpm workspaces as specified in Architecture Document (not Turborepo)
- Single root .env as specified in project-context.md

**No Conflicts Detected:**
- All paths align with documented conventions
- All naming follows established patterns

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Monorepo Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Environment Configuration]
- [Source: _bmad-output/project-context.md#Technology Stack]
- [Source: _bmad-output/project-context.md#Environment]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Consulted official pnpm documentation (pnpm.io) for latest workspace syntax
- Verified pnpm version 9.15.0 installed
- Confirmed all 4 workspace projects recognized by pnpm
- Validated `pnpm dev` executes scripts in all workspaces

### Completion Notes List

- All tasks completed successfully following official pnpm documentation
- Used `packageManager` field in root package.json (pnpm@9.15.0) as per best practices
- Environment variables documented with clear section headers in `.env.example`
- All acceptance criteria verified and met

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Story created with ultimate context analysis | SM Agent |
| 2026-02-05 | Implemented monorepo structure with all 8 tasks complete | Dev Agent (Opus 4.5) |
| 2026-02-05 | Code review #1: Fixed MED-2, LOW-1, LOW-2. User to fix MED-1, MED-3 | Code Review Agent (Opus 4.5) |
| 2026-02-05 | Code review #2: Fixed MED-1 (index.ts content), MED-2 (engines.pnpm), MED-3 (stale follow-ups). All issues resolved. | Code Review Agent (Opus 4.6) |

### File List

| File | Action | Purpose |
|------|--------|---------|
| `pnpm-workspace.yaml` | CREATED | Workspace definition with apps/* and packages/* |
| `package.json` | CREATED | Root package with workspace scripts and engines |
| `.env.example` | CREATED | Environment template with documented variables |
| `.env` | CREATED | Environment config (copied from .env.example) |
| `.gitignore` | CREATED | Comprehensive git exclusions |
| `README.md` | CREATED | Project documentation with setup instructions |
| `apps/frontend/package.json` | CREATED | Frontend workspace package (@battlecrm/frontend) |
| `apps/backend/package.json` | CREATED | Backend workspace package (@battlecrm/backend) |
| `packages/shared/package.json` | CREATED | Shared package placeholder (@battlecrm/shared) |
| `pnpm-lock.yaml` | CREATED | Lockfile generated by pnpm install |
| `packages/shared/package.json` | MODIFIED | Added format and type-check scripts (review fix) |
| `package.json` | MODIFIED | Added license and repository fields (review fix) |
| `_bmad-output/project-context.md` | MODIFIED | Standardized filter syntax (review fix) |
| `packages/shared/src/index.ts` | CREATED | Empty export placeholder for shared package main entry |
| `packages/shared/src/index.ts` | MODIFIED | Fixed content from console.log to export {} (review #2 fix) |
| `package.json` | MODIFIED | Fixed engines.pnpm from >=8.0.0 to >=9.0.0 (review #2 fix) |
