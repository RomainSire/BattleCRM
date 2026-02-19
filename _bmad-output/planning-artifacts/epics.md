---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-02-04'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
summary:
  epics: 7
  stories: 42
  frs_covered: 64
  nfrs_integrated: 67
---

# BattleCRM - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for BattleCRM, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Prospect Management (FR1-FR9)**
- FR1: Users can create prospects with basic information (name, company, LinkedIn URL, email, phone, title)
- FR2: Users can view a list of all prospects with inline preview of key information
- FR3: Users can update prospect information
- FR4: Users can archive prospects (soft delete) to remove them from active views
- FR5: Users can search archived prospects and restore them to active status
- FR6: Users can filter prospects by funnel stage
- FR7: Users can assign a positioning variant to a prospect
- FR8: Users can view prospect detail with full information and interaction history
- FR9: Users can drill down from prospects to related interactions inline

**Positioning Management (FR10-FR17)**
- FR10: Users can create positioning variants (CV, pitch, LinkedIn message, etc.)
- FR11: Users can specify positioning type (CV, LinkedIn message, pitch, cold email, etc.)
- FR12: Users can add description and rationale for each positioning variant
- FR13: Users can view a list of all positioning variants with inline preview
- FR14: Users can update positioning variant information
- FR15: Users can archive positioning variants no longer in use
- FR16: Users can view which prospects received which positioning variant
- FR17: Users can drill down from positioning to related prospects and interactions

**Interaction Management (FR18-FR28)**
- FR18: Users can log interactions from prospect detail page
- FR19: Users can log interactions from interactions list page
- FR20: Users can add free-text notes for each interaction (objective + subjective data)
- FR21: Users can categorize interactions by type and subtype
- FR22: Users can assign interaction status (positive, pending, negative)
- FR23: Users can link an interaction to a positioning variant used
- FR24: Users can link an interaction to a prospect
- FR25: Users can view chronological timeline of all interactions
- FR26: Users can filter interactions by prospect, positioning, status, or date
- FR27: System pre-fills interaction form with last prospect and active variant
- FR28: Users can view interaction detail with full context

**Performance Analytics (FR29-FR37)**
- FR29: Users can view Performance Matrix showing conversion rates by positioning variant × funnel stage
- FR30: System calculates conversion rates using Bayesian updating for low-volume contexts
- FR31: System displays statistical reliability indicators (traffic light: 🔴🟡🟢) for conversion rates
- FR32: Users can drill down from Performance Matrix cells to see underlying prospects and interactions
- FR33: Users can view current Battle status per funnel stage in Performance Matrix
- FR34: System tracks each funnel stage's independent Battle (which variants are being tested)
- FR35: Users can view historical Battles per funnel stage (past winners, progression)
- FR36: Users can compare conversion rates across positioning variants within a Battle
- FR37: Users can identify winning variant per Battle based on conversion data and significance indicator

**Funnel Configuration (FR38-FR44)**
- FR38: Users can configure custom funnel stages (names and order)
- FR39: System provides 10 default funnel stages pre-filled
- FR40: Users can add, remove, or reorder funnel stages (max 15 stages)
- FR41: Users can configure funnel stages without touching code (via Settings page)
- FR42: System enforces linear funnel order (no branching)
- FR43: Users can move prospects between funnel stages
- FR44: System tracks prospect progression through funnel stages

**Data Import/Export (FR45-FR50)**
- FR45: Users can import prospects from LinkedIn CSV export
- FR46: System automatically maps CSV fields to prospect fields
- FR47: System detects duplicate prospects during import
- FR48: System proposes update strategies for detected duplicates with manual validation
- FR49: System assigns default funnel stage "Lead qualified" to imported prospects
- FR50: Users can manually validate and adjust imported prospect data before final import

**User Management & Authentication (FR51-FR56)**
- FR51: Users can create accounts with email and password
- FR52: Users can log in with email and password
- FR53: Users can log out
- FR54: System isolates user data by user_id (multi-tenant architecture)
- FR55: Administrator can enable/disable new user registration via environment variable
- FR56: System enforces application-level user isolation to prevent cross-user data access (implemented via AdonisJS `forUser()` query scope — RLS removed in Story 1.8 architecture change)

**Battle Management - A/B Testing per Funnel Stage (FR57-FR64)**
- FR57: Each funnel stage can have an active Battle (A vs B test between two positioning variants)
- FR58: Users can start a new Battle for a funnel stage by selecting two variants to compare
- FR59: Users can close a Battle when statistical significance is reached (system indicates via 🟢 traffic light)
- FR60: When closing a Battle, users declare the winner which becomes the "champion" for that stage
- FR61: Users can start the next Battle: champion vs new challenger variant
- FR62: Closing a Battle on one funnel stage does NOT reset or affect Battles on other stages (independent progression)
- FR63: System tracks Battle history per funnel stage (Battle #1, #2, #3... with winners)
- FR64: Performance Matrix displays current Battle info per stage (which variants, current stats, significance indicator)

### NonFunctional Requirements

**Performance (NFR1-NFR9)**
- NFR1: Page loads must complete in under 2 seconds on 4G connection
- NFR2: Subsequent SPA navigation must complete in under 500ms
- NFR3: User interactions (clicks, form submissions) must respond in under 100ms
- NFR4: Performance Matrix calculation must complete in under 2 seconds
- NFR5: List rendering (100 prospects) must complete in under 1 second
- NFR6: CSV import of 50 prospects must complete in under 5 minutes (server processing)
- NFR7: Interaction logging must complete in under 1 minute end-to-end (user perception)
- NFR8: Initial JavaScript bundle must be under 300KB gzipped
- NFR9: Tailwind CSS production build must purge unused styles

**Security (NFR10-NFR20)**
- NFR10: All user authentication must use Adonis native session auth with httpOnly cookies (scrypt password hashing)
- NFR11: Backend middleware must enforce data isolation between users (all queries filtered by user_id)
- NFR12: No user can access another user's data under any circumstance
- NFR13: Administrator registration control via `ALLOW_REGISTRATION` environment variable
- NFR14: HTTPS must be enforced for all connections
- NFR15: CSRF protection must be implemented via Adonis backend
- NFR16: XSS prevention via React's default escaping
- NFR17: Content Security Policy headers must be configured
- NFR18: Environment variables for secrets must never be committed to repository
- NFR19: All database queries must filter by user_id automatically (enforced in backend services/controllers)
- NFR20: Backend middleware must reject requests attempting to access data belonging to another user_id

**Reliability & Data Integrity (NFR21-NFR28)**
- NFR21: Zero tolerance for data bugs - any data integrity issue is immediate critical failure
- NFR22: All data mutations must use database transactions for consistency
- NFR23: All entities must implement soft delete (`deleted_at` field) - no hard deletes
- NFR24: Data validation must be rigorous before any insertion or update
- NFR25: Automated tests must cover all critical CRUD operations
- NFR26: CSV import must provide clear error messages for validation failures
- NFR27: Users must have manual override options for edge cases
- NFR28: System must gracefully handle and recover from errors without data loss

**Accessibility (NFR29-NFR40)**
- NFR29: All interactive elements must be accessible via keyboard (Tab, Enter, Escape)
- NFR30: Logical tab order must match visual flow
- NFR31: Focus indicators must be visible and clear
- NFR32: Skip navigation links must be provided where appropriate
- NFR33: Color contrast ratios must meet WCAG AA minimums (4.5:1 for text)
- NFR34: Information must not rely on color alone (use icons + colors)
- NFR35: Minimum body text size must be 16px
- NFR36: Proper heading hierarchy must be maintained (h1 → h2 → h3)
- NFR37: Semantic HTML elements must be used (nav, main, article, section)
- NFR38: Form labels must be properly associated with inputs
- NFR39: ARIA labels must be provided for icon-only buttons
- NFR40: ARIA live regions must announce dynamic updates

**Usability & User Experience (NFR41-NFR48)**
- NFR41: Maximum 3 clicks to complete any core operation (enforced rule)
- NFR42: Interaction logging must take under 1 minute (4-5 fields maximum)
- NFR43: Form fields must pre-fill intelligently (last prospect, active variant)
- NFR44: Optional fields must be truly optional (permissive validation)
- NFR45: No popups except for destructive actions (confirmation dialogs only)
- NFR46: Key information must be visible at a glance (inline preview in lists)
- NFR47: Contextual drill-down must appear inline (no navigation required)
- NFR48: Every pixel must earn its place (minimalist aggression)

**Maintainability & Code Quality (NFR49-NFR61)**
- NFR49: TypeScript strict mode must be enabled across all packages (front + back)
- NFR50: ESLint + Prettier must enforce code consistency
- NFR51: No TypeScript `any` types allowed without explicit justification
- NFR52: Shared types/DTOs must prevent API contract mismatches
- NFR53: Automated tests must cover all critical operations (CRUD, CSV import, auth)
- NFR54: Test suite must run in CI/CD pipeline
- NFR55: Tests must run in headless Chrome for consistency
- NFR56: Hot Module Replacement (HMR) must work reliably via Vite
- NFR57: pnpm workspaces must enable efficient monorepo management
- NFR58: Docker Compose must provide a consistent production environment (also usable for local dev)
- NFR59: Docker containers must be production-ready and optimized
- NFR60: Deployment must be reproducible and rollback-capable
- NFR61: Environment-based configuration via environment variables

**Browser Compatibility (NFR62-NFR67)**
- NFR62: Must support Chrome latest 2 versions (primary target)
- NFR63: Must support Firefox latest 2 versions (secondary target)
- NFR64: No legacy browser support required (IE11, old Safari excluded)
- NFR65: Must be fully responsive across desktop (1024px+), tablet (768-1023px), and mobile (<768px)
- NFR66: Desktop-first design with mobile-friendly fallbacks
- NFR67: No separate mobile app required

### Additional Requirements

**From Architecture Document:**

*Starter Template & Monorepo:*
- Composed monorepo setup with pnpm workspaces (not Turborepo - overkill for solo dev)
- Project structure: `/apps/frontend` (React+Vite), `/apps/backend` (Adonis.js), `/packages/shared` (optional)
- pnpm as package manager with workspace linking

*Authentication Strategy:*
- Adonis Sessions with httpOnly cookies (not JWT/access tokens)
- Adonis native auth with scrypt hashing (users stored in local PostgreSQL)
- `credentials: 'include'` for frontend fetch calls
- CORS configured for same-origin

*State Management:*
- TanStack Query for server state (caching, loading, errors)
- Context/Zustand for UI state (simple/complex respectively)
- Centralized query keys in dedicated file

*Validation:*
- VineJS on both frontend and backend (separate schemas, same syntax)
- Shared types deferred to post-MVP evaluation

*API & Documentation:*
- REST API with Adonis conventions
- Swagger/OpenAPI via adonis-autoswagger
- Adonis default error format

*Configuration:*
- Single `.env` file at monorepo root
- Vite config: `envDir: '../../'`
- Adonis: `node ace serve --env-path=../../.env`

*Naming Conventions:*
- Database: snake_case, plural tables (`prospects`, `funnel_stages`)
- API endpoints: snake_case (`/api/prospects`, `/api/funnel_stages`)
- Code: PascalCase components, camelCase functions/variables
- Types: PascalCase with `Type` suffix (`ProspectType`, `BattleType`)
- JSON API: snake_case fields (matches DB)

*Structure Patterns:*
- Frontend: Feature-based organization (`/features/dashboard/`, `/features/prospects/`)
- Backend: Adonis standard (`/controllers/`, `/models/`, `/services/`)
- Tests co-located with source files

*Process Patterns:*
- Soft delete everywhere (`deleted_at` field, archive toggle)
- Optimistic updates for quick actions
- Error handling: Error Boundary global + TanStack Query onError + inline form errors
- Loading states: Skeleton loaders for lists, discrete spinners on buttons

**From UX Design Document:**

*Design System:*
- shadcn/ui + Tailwind CSS as foundation
- Light mode only (user preference)
- Hybrid density: Dense for lists/matrix, airy for forms

*Custom Components Required:*
- FunnelCard: Dashboard card per funnel stage showing Battle status, expand/collapse for details
- HeatmapCell: Table cell with dynamic coloring based on conversion rate
- TrafficLight: Statistical significance indicator (🟢🟡🔴)
- LeadScoreBadge: Qualitative prospect indicator (Hot/Neutral/Cold)
- CSVImportWizard: 3-step import flow (Upload → Mapping → Validation)

*Key UX Patterns:*
- Dashboard with Funnel Cards as central view (not traditional Performance Matrix table)
- Independent Battles per funnel stage (replaces global sprints concept)
- Accordion inline drill-down (no page navigation for context)
- 3-click rule strictly enforced
- Pre-fill intelligent forms (last prospect, active variant)
- Zero popups except destructive action confirmations
- Toast notifications for success (auto-dismiss 3s)
- Inline errors for form validation

*Navigation:*
- Top navbar with 4 items max: Dashboard | Prospects | Positionings | Settings
- No sidebar
- Breadcrumbs only if drill-down depth > 1

*Responsive Strategy:*
- Desktop-first (primary use case)
- Tablet: 2-column cards
- Mobile: Stacked cards, hamburger menu
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

*Accessibility:*
- WCAG 2.1 Level A with selective AA features
- Color + emoji for traffic lights (not color-only)
- Keyboard navigation: Tab, Enter, Escape support
- Focus indicators visible
- aria-expanded for accordions

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 3 | Create prospects with basic information |
| FR2 | Epic 3 | View prospect list with inline preview |
| FR3 | Epic 3 | Update prospect information |
| FR4 | Epic 3 | Archive prospects (soft delete) |
| FR5 | Epic 3 | Search archived prospects and restore |
| FR6 | Epic 3 | Filter prospects by funnel stage |
| FR7 | Epic 3 | Assign positioning variant to prospect |
| FR8 | Epic 3 | View prospect detail with interaction history |
| FR9 | Epic 3 | Drill down from prospects to interactions |
| FR10 | Epic 4 | Create positioning variants |
| FR11 | Epic 4 | Specify positioning type |
| FR12 | Epic 4 | Add description and rationale |
| FR13 | Epic 4 | View positioning variants list |
| FR14 | Epic 4 | Update positioning variant |
| FR15 | Epic 4 | Archive positioning variants |
| FR16 | Epic 4 | View prospects per positioning |
| FR17 | Epic 4 | Drill down from positioning to prospects |
| FR18 | Epic 5 | Log interactions from prospect detail |
| FR19 | Epic 5 | Log interactions from interactions list |
| FR20 | Epic 5 | Add free-text notes |
| FR21 | Epic 5 | Categorize by type and subtype |
| FR22 | Epic 5 | Assign interaction status |
| FR23 | Epic 5 | Link interaction to positioning |
| FR24 | Epic 5 | Link interaction to prospect |
| FR25 | Epic 5 | View chronological timeline |
| FR26 | Epic 5 | Filter interactions |
| FR27 | Epic 5 | Pre-fill interaction form |
| FR28 | Epic 5 | View interaction detail |
| FR29 | Epic 7 | View Performance Matrix |
| FR30 | Epic 7 | Bayesian updating calculations |
| FR31 | Epic 7 | Traffic light reliability indicators |
| FR32 | Epic 7 | Drill down from Performance Matrix |
| FR33 | Epic 7 | View Battle status per funnel stage |
| FR34 | Epic 7 | Track independent Battles |
| FR35 | Epic 7 | View historical Battles |
| FR36 | Epic 7 | Compare conversion rates |
| FR37 | Epic 7 | Identify winning variant |
| FR38 | Epic 2 | Configure custom funnel stages |
| FR39 | Epic 2 | 10 default funnel stages |
| FR40 | Epic 2 | Add/remove/reorder stages (max 15) |
| FR41 | Epic 2 | Configure via Settings page |
| FR42 | Epic 2 | Enforce linear funnel order |
| FR43 | Epic 3 | Move prospects between stages |
| FR44 | Epic 3 | Track prospect progression |
| FR45 | Epic 6 | Import from LinkedIn CSV |
| FR46 | Epic 6 | Auto-map CSV fields |
| FR47 | Epic 6 | Detect duplicates |
| FR48 | Epic 6 | Propose update strategies |
| FR49 | Epic 6 | Default stage "Lead qualified" |
| FR50 | Epic 6 | Manual validation before import |
| FR51 | Epic 1 | Create accounts with email/password |
| FR52 | Epic 1 | Log in with email/password |
| FR53 | Epic 1 | Log out |
| FR54 | Epic 1 | Isolate user data by user_id |
| FR55 | Epic 1 | ALLOW_REGISTRATION env control |
| FR56 | Epic 1 | Application-level user isolation (forUser() scope, not RLS) |
| FR57 | Epic 7 | Active Battle per funnel stage |
| FR58 | Epic 7 | Start new Battle |
| FR59 | Epic 7 | Close Battle on significance |
| FR60 | Epic 7 | Declare winner as champion |
| FR61 | Epic 7 | Start next Battle (champion vs challenger) |
| FR62 | Epic 7 | Independent Battle progression |
| FR63 | Epic 7 | Track Battle history |
| FR64 | Epic 7 | Display Battle info in Performance Matrix |

## Epic List

### Epic 1: Project Foundation & Authentication
Établir l'infrastructure technique et permettre aux utilisateurs de créer un compte et se connecter de manière sécurisée. L'utilisateur peut créer un compte, se connecter, et accéder à une application fonctionnelle avec isolation des données.

**FRs covered:** FR51, FR52, FR53, FR54, FR55, FR56
**Additional:** Setup monorepo (pnpm workspaces), frontend (Vite+React), backend (Adonis.js), PostgreSQL schema + migrations, Docker Compose (prod + local DB), application-level user isolation via `forUser()` query scope (RLS removed — plain PostgreSQL, not Supabase)

### Epic 2: Funnel Configuration
Permettre aux utilisateurs de configurer leur pipeline de prospection personnalisé. L'utilisateur peut créer, modifier et organiser les étapes de son funnel (max 15 étapes) via une page Settings dédiée.

**FRs covered:** FR38, FR39, FR40, FR41, FR42

### Epic 3: Prospect Management
Permettre aux utilisateurs de gérer leurs contacts prospects de bout en bout. L'utilisateur peut créer, consulter, modifier, archiver et restaurer des prospects. Il peut filtrer par étape funnel et voir les informations clés en preview inline.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR43, FR44

### Epic 4: Positioning Variants
Permettre aux utilisateurs de créer et gérer leurs variantes de positionnement pour l'A/B testing. L'utilisateur peut créer des variantes (CV, pitch, messages LinkedIn), documenter leur rationale, et voir quels prospects ont reçu quelle variante.

**FRs covered:** FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17

### Epic 5: Interaction Logging
Permettre aux utilisateurs de capturer chaque interaction avec un prospect avec minimal friction. L'utilisateur peut logger une interaction en < 1 minute avec pré-remplissage intelligent, catégoriser par type/statut, lier à un prospect et positionnement, et consulter la timeline chronologique.

**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28

### Epic 6: CSV Import (Cold Start)
Permettre l'activation "mode guerre" en moins de 24h avec import massif depuis LinkedIn. L'utilisateur peut importer 50+ prospects depuis un CSV LinkedIn en < 2h avec mapping automatique, détection de doublons, et validation manuelle.

**FRs covered:** FR45, FR46, FR47, FR48, FR49, FR50

### Epic 7: Performance Analytics & Battle Management
Permettre aux utilisateurs de visualiser leurs performances et optimiser via A/B testing indépendant par étape. L'utilisateur peut voir la Performance Matrix (Dashboard Funnel Cards), comprendre quel positionnement gagne à chaque étape via indicateurs 🟢🟡🟢, et gérer des Battles indépendantes par étape funnel.

**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR57, FR58, FR59, FR60, FR61, FR62, FR63, FR64

---

## Epic 1: Project Foundation & Authentication

Établir l'infrastructure technique et permettre aux utilisateurs de créer un compte et se connecter de manière sécurisée.

### Story 1.1: Initialize Monorepo Structure

As a developer,
I want a properly configured pnpm monorepo with frontend and backend workspaces,
So that I can develop both applications with shared tooling and consistent configuration.

**Acceptance Criteria:**

**Given** I am setting up a new BattleCRM project
**When** I run the initialization commands
**Then** a pnpm-workspace.yaml is created with apps/* and packages/* configured
**And** the root package.json contains scripts for running both apps
**And** a root .env file exists with placeholder configuration variables
**And** a .gitignore properly excludes node_modules, .env, and build artifacts
**And** the folder structure matches: apps/frontend/, apps/backend/, packages/shared/

---

### Story 1.2: Scaffold Frontend Application

As a developer,
I want a React + Vite + TypeScript frontend with shadcn/ui configured,
So that I can build the user interface with modern tooling and accessible components.

**Acceptance Criteria:**

**Given** the monorepo structure exists from Story 1.1
**When** I scaffold the frontend application
**Then** React 18+ with Vite is installed in apps/frontend
**And** TypeScript strict mode is enabled
**And** Tailwind CSS is configured with the project's design tokens
**And** shadcn/ui is initialized with Button, Card, and Input components
**And** React Router v7 is configured with placeholder routes (/, /login)
**And** TanStack Query is installed and configured with QueryClientProvider
**And** the app runs on localhost:5173 with HMR working
**And** ESLint and Prettier are configured for code consistency

---

### Story 1.3: Scaffold Backend Application

As a developer,
I want an Adonis.js 6 API backend with session authentication configured,
So that I can build secure API endpoints with proper authentication.

**Acceptance Criteria:**

**Given** the monorepo structure exists from Story 1.1
**When** I scaffold the backend application
**Then** Adonis.js 6 API starter is installed in apps/backend
**And** TypeScript strict mode is enabled
**And** Session guard is configured (not access tokens) with httpOnly cookies
**And** CORS is configured to allow frontend origin with credentials
**And** A health check endpoint GET /api/health returns { status: "ok" }
**And** Environment variables are loaded from root .env (--env-path=../../.env)
**And** The app runs on localhost:3333
**And** Pino logger is configured for structured JSON logging

---

### Story 1.4: Configure PostgreSQL Database Schema

As a developer,
I want a local PostgreSQL database (via Docker) with the users table and proper schema,
So that user data is stored securely and isolated from day one.

**Acceptance Criteria:**

**Given** the backend application exists from Story 1.3
**When** I configure the PostgreSQL connection
**Then** Lucid ORM is configured to connect to the local PostgreSQL instance (Docker)
**And** Database migrations are set up in database/migrations/
**And** A users table exists with: id (uuid), email (unique), password (varchar, hashed by Adonis scrypt), created_at, updated_at, deleted_at
**And** The initial migration creates the users table with proper indexes on (email) and (deleted_at)
**And** A `.env` entry documents all required DB_ variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE)

**Given** the local Docker PostgreSQL is running (`docker compose up postgres` or similar)
**When** I run the migrations (`node ace migration:run`)
**Then** the users table is created successfully
**And** the backend health check still returns { status: "ok" }

**Note:** Data isolation between users is enforced at the backend layer (all queries include `WHERE user_id = :currentUser`), not via database-level RLS. (FR54, FR56)

---

### Story 1.5: Implement User Registration

As a new user,
I want to create an account with my email and password,
So that I can access BattleCRM and start managing my prospects.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter a valid email and password (min 8 characters)
**Then** my account is created in the database
**And** I am automatically logged in with a session cookie
**And** I am redirected to the dashboard (FR51)

**Given** the ALLOW_REGISTRATION environment variable is set to false
**When** I try to access the registration page
**Then** I see a message "Registration is currently disabled"
**And** the registration form is not displayed (FR55)

**Given** I try to register with an existing email
**When** I submit the registration form
**Then** I see an inline error "This email is already registered"
**And** no duplicate account is created

**Given** I enter an invalid email format
**When** I submit the registration form
**Then** I see an inline error under the email field
**And** the form is not submitted

---

### Story 1.6: Implement User Login

As a registered user,
I want to log in with my email and password,
So that I can access my BattleCRM data securely.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I enter valid credentials
**Then** a session is created with an httpOnly secure cookie
**And** I am redirected to the dashboard (FR52)

**Given** I enter invalid credentials
**When** I submit the login form
**Then** I see an error "Invalid email or password"
**And** no session is created

**Given** I am already logged in
**When** I navigate to the login page
**Then** I am automatically redirected to the dashboard

**Given** my session cookie exists
**When** I refresh the page or return later
**Then** I remain logged in without re-entering credentials

---

### Story 1.7: Implement User Logout

As a logged-in user,
I want to log out of BattleCRM,
So that my session is securely terminated.

**Acceptance Criteria:**

**Given** I am logged in
**When** I click the logout button in the navigation
**Then** my session is destroyed on the server
**And** my session cookie is cleared
**And** I am redirected to the login page (FR53)

**Given** I have logged out
**When** I try to access a protected page directly
**Then** I am redirected to the login page

**Given** I have logged out
**When** I press the browser back button
**Then** I cannot access protected content without logging in again

---

### Story 1.8: Setup Docker Production Environment

As a developer,
I want a Docker Compose setup for production deployment on a VPS,
So that the full stack (frontend, backend, PostgreSQL) can be deployed and run consistently.

**Note:** The `db_dev/docker-compose.yml` quick-fix file is deprecated and must be deleted as part of this story. The new Docker Compose at the root is the single source of truth.

**Acceptance Criteria:**

**Given** I have Docker installed on a production VPS (or local machine for testing)
**When** I run `docker compose up --build`
**Then** the PostgreSQL container starts and is ready (with persistent volume for data)
**And** the backend container starts and connects to the PostgreSQL container
**And** the frontend container builds (Vite production build) and is served via nginx
**And** nginx routes `/` to frontend and `/api/*` to backend
**And** environment variables are loaded from root `.env`
**And** the `db_dev/` directory and its contents are removed (replaced by this setup)

**Given** the containers are running
**When** I call the health check endpoint
**Then** `GET /api/health` returns `{ status: "ok" }`
**And** the frontend is accessible on port 80

**Given** I want to run only the database locally during development (without full Docker stack)
**When** I run `docker compose up postgres`
**Then** only the PostgreSQL container starts on port 5432
**And** I can run the backend locally with `node ace serve` connected to this containerized DB
**And** this replaces the deprecated `db_dev/docker-compose.yml` workflow

**Given** I need to deploy a new version
**When** I rebuild and restart containers (`docker compose up --build -d`)
**Then** the new images are built and containers restarted with zero data loss (persistent volume)

---

## Epic 2: Funnel Configuration

Permettre aux utilisateurs de configurer leur pipeline de prospection personnalisé via une page Settings dédiée.

### Story 2.1: Create Funnel Stages Database Schema

As a developer,
I want a funnel_stages table with proper schema and default data,
So that users can have a working funnel from day one.

**Acceptance Criteria:**

**Given** I am setting up the funnel configuration feature
**When** I run the database migration
**Then** a funnel_stages table is created with: id, user_id, name, position (integer), created_at, updated_at, deleted_at
**And** a `forUser(userId)` query scope is implemented on the FunnelStage model for application-level user isolation (no RLS — architecture decision from Story 1.8)
**And** a unique constraint exists on (user_id, position) for active stages
**And** an index exists on (user_id, deleted_at) for efficient queries

**Given** a new user registers
**When** their account is created
**Then** 10 default funnel stages are seeded for their user_id (FR39):
  1. Lead qualified
  2. First contact
  3. Connection established
  4. Positive response
  5. ESN qualification
  6. Application sent
  7. ESN interview(s)
  8. Final client interview(s)
  9. Proposal received
  10. Contract signed ✅

---

### Story 2.2: Implement Funnel Stages API

As a developer,
I want REST API endpoints to manage funnel stages,
So that the frontend can perform CRUD operations on stages.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I call GET /api/funnel_stages
**Then** I receive a list of my active funnel stages ordered by position
**And** archived stages are excluded unless ?include_archived=true

**Given** I am authenticated
**When** I call POST /api/funnel_stages with { name: "New Stage" }
**Then** a new stage is created with position = max(position) + 1
**And** the new stage is returned with its id

**Given** I am authenticated
**When** I call PUT /api/funnel_stages/:id with { name: "Updated Name" }
**Then** the stage name is updated
**And** updated_at is set to current timestamp

**Given** I am authenticated
**When** I call DELETE /api/funnel_stages/:id
**Then** the stage is soft-deleted (deleted_at = now)
**And** the stage no longer appears in active stage list

**Given** I am authenticated
**When** I call PUT /api/funnel_stages/reorder with { order: [3, 1, 2, 4] }
**Then** stages are reordered according to the array (FR38)
**And** position values are updated sequentially (1, 2, 3, 4...)

---

### Story 2.3: Build Funnel Configuration UI

As a user,
I want to configure my funnel stages in the Settings page,
So that I can customize my prospecting pipeline without touching code.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to Settings > Funnel Configuration
**Then** I see a list of my current funnel stages in order (FR41)
**And** each stage shows its name and position number

**Given** I am on the Funnel Configuration page
**When** I click "Add Stage"
**Then** an inline form appears to enter the stage name
**And** on submit, the new stage is added at the end of the list

**Given** I am viewing a funnel stage
**When** I click the edit icon
**Then** the stage name becomes editable inline
**And** I can save or cancel the edit

**Given** I am viewing a funnel stage
**When** I click the delete icon
**Then** a confirmation dialog appears (destructive action)
**And** on confirm, the stage is archived and removed from the list

**Given** I am viewing my funnel stages
**When** I drag and drop a stage to a new position
**Then** the stages are reordered visually
**And** the new order is saved to the backend

---

### Story 2.4: Enforce Funnel Constraints

As a system,
I want to enforce funnel configuration rules,
So that users cannot create invalid funnel configurations.

**Acceptance Criteria:**

**Given** I have 15 active funnel stages (FR40)
**When** I try to add another stage
**Then** I see an error "Maximum 15 stages allowed"
**And** the stage is not created

**Given** I am editing funnel stages
**When** I try to create branching logic or parallel paths
**Then** the system only allows linear ordering (FR42)
**And** each stage has exactly one predecessor and one successor (except first/last)

**Given** I am reordering stages
**When** the reorder operation completes
**Then** position values are always sequential (1, 2, 3... no gaps)
**And** the order is persisted correctly

**Given** I have prospects assigned to a funnel stage
**When** I try to delete that stage
**Then** I see a warning showing how many prospects are affected
**And** I must confirm before the stage is archived

---

## Epic 3: Prospect Management

Permettre aux utilisateurs de gérer leurs contacts prospects de bout en bout avec filtrage, archivage et suivi de progression.

### Story 3.1: Create Prospects Database Schema

As a developer,
I want a prospects table with proper schema and relationships,
So that users can store and manage their prospect data.

**Acceptance Criteria:**

**Given** I am setting up the prospects feature
**When** I run the database migration
**Then** a prospects table is created with:
  - id (uuid, primary key)
  - user_id (uuid, foreign key to users)
  - name (varchar, required)
  - company (varchar, optional)
  - linkedin_url (varchar, optional)
  - email (varchar, optional)
  - phone (varchar, optional)
  - title (varchar, optional)
  - funnel_stage_id (uuid, foreign key to funnel_stages)
  - positioning_id (uuid, foreign key to positionings, nullable)
  - notes (text, optional)
  - created_at, updated_at, deleted_at
**And** Row Level Security filters by user_id
**And** indexes exist on (user_id, deleted_at) and (user_id, funnel_stage_id)

---

### Story 3.2: Implement Prospects CRUD API

As a developer,
I want REST API endpoints to manage prospects,
So that the frontend can perform all prospect operations.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I call GET /api/prospects
**Then** I receive a paginated list of my active prospects (FR2)
**And** each prospect includes inline preview data (name, company, funnel_stage, email)
**And** archived prospects are excluded unless ?include_archived=true

**Given** I am authenticated
**When** I call GET /api/prospects?funnel_stage_id=:id
**Then** I receive only prospects in that funnel stage (FR6)

**Given** I am authenticated
**When** I call POST /api/prospects with valid data
**Then** a new prospect is created with my user_id (FR1)
**And** the prospect is returned with its id

**Given** I am authenticated
**When** I call PUT /api/prospects/:id with updated fields
**Then** the prospect is updated (FR3)
**And** updated_at is set to current timestamp

**Given** I am authenticated
**When** I call DELETE /api/prospects/:id
**Then** the prospect is soft-deleted (deleted_at = now) (FR4)

---

### Story 3.3: Build Prospects List View

As a user,
I want to see all my prospects in a list with key information visible,
So that I can quickly scan and find the prospects I need.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Prospects page
**Then** I see a list of all my active prospects
**And** each row shows: name, company, current funnel stage, email (FR2)
**And** the list is sorted by most recently updated by default

**Given** I am viewing the prospects list
**When** I click on a funnel stage filter
**Then** the list shows only prospects in that stage (FR6)
**And** a clear filter button appears to reset

**Given** I am viewing the prospects list
**When** I click on a prospect row
**Then** the row expands inline to show more details (drill-down) (FR9)
**And** I can see recent interactions without navigating away

**Given** there are more than 20 prospects
**When** I scroll to the bottom of the list
**Then** more prospects are loaded (infinite scroll)
**And** a skeleton loader appears during loading

---

### Story 3.4: Implement Prospect Create & Edit

As a user,
I want to create and edit prospect information,
So that I can maintain accurate data about my contacts.

**Acceptance Criteria:**

**Given** I am on the Prospects page
**When** I click "Add Prospect"
**Then** a form appears with fields: name (required), company, LinkedIn URL, email, phone, title, notes
**And** funnel stage defaults to "Lead qualified" (first stage)

**Given** I am filling out the prospect form
**When** I submit with valid data
**Then** the prospect is created
**And** I see a success toast "Prospect created"
**And** the new prospect appears in the list

**Given** I am viewing a prospect's inline details
**When** I click the edit button
**Then** the fields become editable inline
**And** I can save or cancel changes (FR3)

**Given** I am editing a prospect
**When** I change the positioning variant dropdown
**Then** the new positioning is assigned to the prospect (FR7)
**And** this is tracked for analytics

---

### Story 3.5: Add Archive & Restore Functionality

As a user,
I want to archive prospects I no longer need and restore them if needed,
So that I can keep my active list clean without losing data.

**Acceptance Criteria:**

**Given** I am viewing a prospect
**When** I click "Archive"
**Then** a confirmation dialog appears
**And** on confirm, the prospect is soft-deleted (FR4)
**And** the prospect disappears from the active list

**Given** I am on the Prospects page
**When** I toggle "Show archived"
**Then** archived prospects appear in the list with a visual indicator (FR5)
**And** I can search within archived prospects

**Given** I am viewing an archived prospect
**When** I click "Restore"
**Then** the prospect's deleted_at is set to null
**And** the prospect returns to the active list (FR5)

**Given** I search for a prospect name
**When** the prospect exists but is archived
**Then** it only appears if "Show archived" is enabled
**And** I can restore it from the search results

---

### Story 3.6: Implement Funnel Stage Management

As a user,
I want to move prospects between funnel stages,
So that I can track their progression through my pipeline.

**Acceptance Criteria:**

**Given** I am viewing a prospect
**When** I change the funnel stage dropdown
**Then** the prospect is moved to the new stage (FR43)
**And** the change is saved immediately
**And** a success toast confirms the change

**Given** I am viewing the prospects list filtered by stage
**When** I move a prospect to a different stage
**Then** the prospect disappears from the current filtered view
**And** it appears in the new stage if I switch filters

**Given** a prospect moves through stages
**When** I view the prospect detail
**Then** I can see the progression history (FR44)
**And** each stage change is timestamped

**Given** I am on the Prospects page
**When** I view a prospect's funnel position
**Then** I see a visual indicator of their current stage
**And** I can see how far along the funnel they are

---

### Story 3.7: Implement Prospect Detail View

As a user,
I want to see full prospect details with interaction history,
So that I have complete context when engaging with a prospect.

**Acceptance Criteria:**

**Given** I click on a prospect name in the list
**When** the detail view loads
**Then** I see all prospect fields displayed (FR8)
**And** I see the current funnel stage prominently displayed
**And** I see the assigned positioning variant if any

**Given** I am viewing prospect detail
**When** interactions exist for this prospect
**Then** I see a chronological timeline of interactions (FR9)
**And** each interaction shows: date, type, status, summary

**Given** I am viewing prospect detail
**When** I want to add an interaction
**Then** I see a prominent "Log Interaction" button
**And** clicking it opens the interaction form pre-filled with this prospect

---

## Epic 4: Positioning Variants

Permettre aux utilisateurs de créer et gérer leurs variantes de positionnement liées à chaque étape du funnel pour l'A/B testing.

### Story 4.1: Create Positionings Database Schema

As a developer,
I want a positionings table linked to funnel stages,
So that users can track different variants for each stage of their pipeline.

**Acceptance Criteria:**

**Given** I am setting up the positionings feature
**When** I run the database migration
**Then** a positionings table is created with:
  - id (uuid, primary key)
  - user_id (uuid, foreign key to users)
  - funnel_stage_id (uuid, foreign key to funnel_stages, required)
  - name (varchar, required) - e.g., "CV v2 - React Focus"
  - description (text, optional) - rationale for this variant
  - content (text, optional) - actual content or file reference
  - created_at, updated_at, deleted_at
**And** Row Level Security filters by user_id
**And** index exists on (user_id, deleted_at, funnel_stage_id)

---

### Story 4.2: Implement Positionings CRUD API

As a developer,
I want REST API endpoints to manage positioning variants,
So that the frontend can perform all positioning operations.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I call GET /api/positionings
**Then** I receive a list of my active positionings (FR13)
**And** each positioning includes: id, name, funnel_stage (name + id), description preview
**And** archived positionings are excluded unless ?include_archived=true

**Given** I am authenticated
**When** I call GET /api/positionings?funnel_stage_id=:id
**Then** I receive only positionings for that funnel stage (FR11)

**Given** I am authenticated
**When** I call POST /api/positionings with { name, funnel_stage_id, description }
**Then** a new positioning is created (FR10, FR11, FR12)
**And** the positioning is returned with its id

**Given** I am authenticated
**When** I call PUT /api/positionings/:id
**Then** the positioning is updated (FR14)

**Given** I am authenticated
**When** I call DELETE /api/positionings/:id
**Then** the positioning is soft-deleted (FR15)

**Given** I am authenticated
**When** I call GET /api/positionings/:id/prospects
**Then** I receive a list of prospects that have this positioning assigned (FR16)

---

### Story 4.3: Build Positionings List View

As a user,
I want to see all my positioning variants organized by funnel stage,
So that I can manage my variants for each step of my pipeline.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Positionings page
**Then** I see a list of all my active positioning variants (FR13)
**And** each row shows: name, funnel stage (with badge), description preview
**And** variants are grouped or filterable by funnel stage

**Given** I am viewing the positionings list
**When** I click on a positioning row
**Then** the row expands inline to show full details (FR17)
**And** I see the list of prospects who received this variant
**And** I see related interactions

**Given** I want to filter by funnel stage
**When** I select a stage filter (e.g., "Envoi CV", "Relance")
**Then** only positionings for that stage are shown

---

### Story 4.4: Implement Positioning Create & Edit

As a user,
I want to create and edit positioning variants for specific funnel stages,
So that I can track different versions of my outreach materials per stage.

**Acceptance Criteria:**

**Given** I am on the Positionings page
**When** I click "Add Positioning"
**Then** a form appears with fields:
  - Name (required) - e.g., "CV v3 - Architecture Focus"
  - Funnel Stage (required) - dropdown of my funnel stages (FR11)
  - Description/Rationale (optional) - why this variant was created (FR12)

**Given** I am filling out the positioning form
**When** I submit with valid data
**Then** the positioning is created (FR10)
**And** I see a success toast
**And** it appears in the list under its funnel stage

**Given** I am viewing a positioning
**When** I click edit
**Then** I can modify name and description (FR14)
**And** I can change the funnel stage if no interactions reference it yet
**And** changes are saved on submit

---

### Story 4.5: Add Positioning Archive & Prospect Linking

As a user,
I want to archive old positionings and see which prospects received each variant,
So that I can maintain a clean list while preserving historical data.

**Acceptance Criteria:**

**Given** I am viewing a positioning
**When** I click "Archive"
**Then** the positioning is soft-deleted (FR15)
**And** it disappears from the active list
**And** it remains visible on prospects/interactions that used it (historical data preserved)

**Given** I am viewing a positioning's expanded details
**When** prospects have been assigned this positioning
**Then** I see a list of those prospects with links (FR16)
**And** clicking a prospect navigates to their detail

**Given** I am viewing a positioning's expanded details
**When** I want more context
**Then** I see interactions that reference this positioning (FR17)
**And** I can drill down to interaction details inline

**Given** a positioning is used in an active Battle
**When** I try to archive it
**Then** I see a warning "This positioning is part of an active Battle"
**And** I must close the Battle first or choose a replacement variant

---

## Epic 5: Interaction Logging

Permettre aux utilisateurs de capturer chaque interaction avec un prospect avec minimal friction (<1 minute, 3 clics max).

### Story 5.1: Create Interactions Database Schema

As a developer,
I want an interactions table to store all prospect interactions,
So that users can track their outreach activities over time.

**Acceptance Criteria:**

**Given** I am setting up the interactions feature
**When** I run the database migration
**Then** an interactions table is created with:
  - id (uuid, primary key)
  - user_id (uuid, foreign key to users)
  - prospect_id (uuid, foreign key to prospects, required)
  - positioning_id (uuid, foreign key to positionings, optional)
  - status (varchar, required) - enum: positive, pending, negative
  - notes (text, optional) - free text for details (objective + subjective)
  - interaction_date (timestamp, defaults to now)
  - created_at, updated_at, deleted_at
**And** Row Level Security filters by user_id
**And** indexes exist on (user_id, prospect_id), (user_id, interaction_date), (user_id, positioning_id)
**And** no type/subtype fields - the funnel stage of the prospect defines the interaction context

---

### Story 5.2: Implement Interactions CRUD API

As a developer,
I want REST API endpoints to manage interactions,
So that the frontend can log and query interactions.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I call GET /api/interactions
**Then** I receive a paginated list of my interactions ordered by date desc (FR25)
**And** each interaction includes: prospect name, prospect funnel_stage, status, date, notes preview

**Given** I am authenticated
**When** I call GET /api/interactions?prospect_id=:id
**Then** I receive only interactions for that prospect (FR26)

**Given** I am authenticated
**When** I call GET /api/interactions?positioning_id=:id
**Then** I receive only interactions using that positioning (FR26)

**Given** I am authenticated
**When** I call GET /api/interactions?status=positive
**Then** I receive only interactions with positive status (FR26)

**Given** I am authenticated
**When** I call GET /api/interactions?funnel_stage_id=:id
**Then** I receive only interactions for prospects at that funnel stage

**Given** I am authenticated
**When** I call POST /api/interactions with valid data
**Then** a new interaction is created (FR18, FR19)
**And** the interaction is returned with its id

**Given** I am authenticated
**When** I call PUT /api/interactions/:id
**Then** the interaction is updated

---

### Story 5.3: Build Interaction Logging Form

As a user,
I want to log interactions quickly with minimal fields,
So that capturing data doesn't slow down my prospecting workflow.

**Acceptance Criteria:**

**Given** I want to log an interaction
**When** I open the interaction form
**Then** I see only essential fields (FR20, FR22, FR23, FR24):
  - Prospect (dropdown, pre-filled if context available)
  - Status (3 buttons: ✅ Positive, ⏳ Pending, ❌ Negative)
  - Positioning (dropdown filtered by prospect's funnel stage, pre-filled)
  - Notes (textarea, optional)
**And** the form has 4 visible fields maximum
**And** the prospect's current funnel stage is displayed for context

**Given** I just interacted with a prospect
**When** I open the interaction form from prospect detail
**Then** the prospect field is pre-filled (FR27)
**And** the positioning dropdown shows only variants for this prospect's funnel stage
**And** the last used positioning is pre-selected
**And** I can log the interaction in under 1 minute

**Given** I am logging multiple interactions
**When** I open the form from the Interactions page (FR19)
**Then** the prospect field shows my most recent prospects first
**And** I can quickly select and log

---

### Story 5.4: Implement Pre-fill & Quick Actions

As a user,
I want forms to pre-fill intelligently,
So that I can log interactions with minimal typing.

**Acceptance Criteria:**

**Given** I logged an interaction with Prospect A 5 minutes ago
**When** I open a new interaction form
**Then** Prospect A is suggested/pre-selected (FR27)
**And** the last used positioning for that funnel stage is pre-selected

**Given** I am on the Prospects list
**When** I click a quick-action "Log Interaction" button on a row
**Then** the form opens with that prospect pre-filled
**And** I can complete logging in 3 clicks max

**Given** I submitted an interaction
**When** the save completes
**Then** I see a success toast
**And** I'm returned to my previous context (prospect detail or interactions list)
**And** the data is immediately visible in the timeline

---

### Story 5.5: Build Interactions Timeline View

As a user,
I want to see a chronological timeline of all my interactions,
So that I can review my prospecting activity over time.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Interactions page
**Then** I see a chronological list of all interactions (FR25)
**And** most recent interactions appear first
**And** each row shows: date, prospect name, funnel stage (badge), status icon, notes preview

**Given** I am viewing the interactions timeline
**When** I click on an interaction row
**Then** the full details expand inline (FR28)
**And** I see the complete notes
**And** I see links to the prospect and positioning

**Given** I want to filter interactions
**When** I use the filter controls
**Then** I can filter by: prospect, positioning, status, funnel stage, date range (FR26)
**And** filters can be combined

**Given** I am viewing filtered interactions
**When** I clear filters
**Then** all interactions are shown again
**And** the filter state is reset

---

## Epic 6: CSV Import (Cold Start)

Permettre l'activation "mode guerre" en moins de 24h avec import massif de prospects depuis LinkedIn CSV.

### Story 6.1: Build CSV Upload Component

As a user,
I want to upload a LinkedIn CSV export file,
So that I can quickly import my prospects into BattleCRM.

**Acceptance Criteria:**

**Given** I am on the Prospects page
**When** I click "Import CSV"
**Then** the CSVImportWizard opens at Step 1: Upload (FR45)
**And** I see a file drop zone accepting .csv files
**And** I see instructions for exporting from LinkedIn Sales Navigator

**Given** I drag and drop a CSV file
**When** the file is valid CSV format
**Then** the file is parsed client-side
**And** I see a preview of detected columns
**And** I can proceed to Step 2: Mapping

**Given** I upload an invalid file
**When** the file is not CSV or is corrupted
**Then** I see a clear error message
**And** I can try again with a different file

---

### Story 6.2: Implement CSV Field Mapping

As a user,
I want to map CSV columns to prospect fields,
So that my data is correctly imported into the right fields.

**Acceptance Criteria:**

**Given** I uploaded a valid CSV
**When** I reach Step 2: Mapping
**Then** I see each CSV column with a dropdown to map to BattleCRM fields (FR46):
  - Name (required)
  - Company
  - LinkedIn URL
  - Email
  - Phone
  - Title
  - (Skip this column)
**And** common LinkedIn export columns are auto-mapped (First Name + Last Name → Name)

**Given** columns are being mapped
**When** I change a mapping
**Then** I see a live preview of how data will be imported
**And** I can verify the mapping is correct

**Given** the required "Name" field is not mapped
**When** I try to proceed
**Then** I see an error "Name field must be mapped"
**And** I cannot continue until mapped

---

### Story 6.3: Implement Duplicate Detection

As a user,
I want the system to detect existing prospects in my import,
So that I don't create duplicates accidentally.

**Acceptance Criteria:**

**Given** I have mapped my CSV columns
**When** I proceed to Step 3: Validation
**Then** the system checks each row against existing prospects (FR47)
**And** matching is done on: LinkedIn URL (exact), or Email (exact), or Name + Company (fuzzy)

**Given** duplicates are detected
**When** Step 3 displays results
**Then** I see a list of detected duplicates (FR48)
**And** each duplicate shows: CSV data vs existing data
**And** I can choose per duplicate: Skip, Update Existing, Create Anyway

**Given** no duplicates are found
**When** Step 3 displays results
**Then** I see "No duplicates detected - X prospects ready to import"
**And** I can proceed directly to import

---

### Story 6.4: Implement Bulk Import Processing

As a user,
I want to import all validated prospects in one action,
So that I can quickly populate my CRM with 50+ prospects.

**Acceptance Criteria:**

**Given** I have resolved all duplicates
**When** I click "Import Prospects"
**Then** all validated prospects are created in the database
**And** each prospect is assigned to "Lead qualified" funnel stage (FR49)
**And** all prospects get my user_id

**Given** the import is processing
**When** there are many prospects (50+)
**Then** I see a progress indicator
**And** the import completes in under 5 minutes (NFR6)

**Given** the import completes successfully
**When** the wizard closes
**Then** I see a success message "X prospects imported"
**And** the prospects list is refreshed with new data
**And** I can start prospecting immediately

---

### Story 6.5: Add Manual Validation & Review

As a user,
I want to review and adjust imported data before finalizing,
So that I can ensure data quality in my CRM.

**Acceptance Criteria:**

**Given** I am in Step 3: Validation
**When** I review the import preview
**Then** I can edit individual prospect data before import (FR50)
**And** I can remove specific prospects from the import
**And** changes are reflected in the preview

**Given** I spot an error in the mapping
**When** I click "Back to Mapping"
**Then** I return to Step 2 without losing my duplicate resolution choices
**And** I can adjust mappings and re-validate

**Given** the import contains validation errors
**When** errors are detected (e.g., invalid email format)
**Then** I see inline warnings on affected rows
**And** I can fix or skip those rows
**And** the import can proceed with valid rows only

---

## Epic 7: Performance Analytics & Battle Management

Permettre aux utilisateurs de visualiser leurs performances via la Performance Matrix et optimiser via A/B testing avec Battles indépendantes par étape funnel.

### Story 7.1: Create Battles Database Schema

As a developer,
I want a battles table to track A/B tests per funnel stage,
So that users can manage independent testing per stage.

**Acceptance Criteria:**

**Given** I am setting up the analytics feature
**When** I run the database migration
**Then** a battles table is created with:
  - id (uuid, primary key)
  - user_id (uuid, foreign key to users)
  - funnel_stage_id (uuid, foreign key to funnel_stages)
  - variant_a_id (uuid, foreign key to positionings)
  - variant_b_id (uuid, foreign key to positionings)
  - battle_number (integer) - sequential per stage (Battle #1, #2, #3...)
  - status (varchar) - enum: active, closed
  - winner_id (uuid, nullable, foreign key to positionings)
  - started_at (timestamp)
  - closed_at (timestamp, nullable)
  - created_at, updated_at
**And** Row Level Security filters by user_id
**And** unique constraint on (user_id, funnel_stage_id, status='active') ensures one active battle per stage
**And** index exists on (user_id, funnel_stage_id, status)

---

### Story 7.2: Implement Conversion Rate Calculations

As a developer,
I want a service to calculate conversion rates per positioning per stage,
So that the Performance Matrix can display accurate analytics.

**Acceptance Criteria:**

**Given** a positioning variant is used in interactions
**When** the analytics service calculates conversion rates
**Then** it computes: (interactions with positive status at stage N) / (total interactions at stage N)
**And** rates are calculated per positioning × funnel stage combination

**Given** there are few data points (< 20)
**When** conversion rates are calculated
**Then** Bayesian updating is applied for better estimates (FR30)
**And** a baseline prior (50% conversion, equivalent to 2 observations) is used

**Given** the analytics endpoint is called
**When** I request GET /api/analytics/performance_matrix
**Then** I receive conversion rates for each positioning × stage cell
**And** each cell includes: rate, sample_size (n/N), confidence_level

---

### Story 7.3: Build Dashboard with Funnel Cards

As a user,
I want to see my performance data in a dashboard with funnel cards,
So that I can quickly understand which positioning works best at each stage.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Dashboard (home page)
**Then** I see a grid of Funnel Cards, one per funnel stage (FR29, FR33)
**And** cards are arranged in funnel order (left to right or top to bottom)
**And** each card shows: stage name, current Battle info, winner indication

**Given** a funnel stage has an active Battle
**When** I view its card
**Then** I see: "Battle #N: [Variant A] vs [Variant B]" (FR64)
**And** I see conversion rates for each variant
**And** I see the Traffic Light indicator (🟢🟡🔴) (FR31)

**Given** I click on a Funnel Card
**When** the card expands (accordion)
**Then** I see detailed comparison: progress bars for each variant (FR36)
**And** I see sample sizes (e.g., "47% (22/47)")
**And** I see historical Battles for this stage (FR35)

---

### Story 7.4: Implement Traffic Light Significance Indicator

As a user,
I want to see a traffic light indicator for statistical significance,
So that I know if I can trust the conversion data.

**Acceptance Criteria:**

**Given** a Battle has data
**When** the system calculates significance
**Then** it uses Bayesian probability: P(A > B)
**And** the result is mapped to a traffic light:
  - 🟢 Green: >95% confidence one variant is better (FR31)
  - 🟡 Yellow: 70-95% confidence (trend visible, not significant)
  - 🔴 Red: <70% confidence or n < 10 (insufficient data)

**Given** I view a Funnel Card
**When** the Traffic Light is displayed
**Then** I see the emoji + text label (e.g., "🟢 Significant")
**And** hovering shows detail (e.g., "97% confident Variant A is better")

**Given** a Battle is 🔴 Red
**When** I view the card
**Then** I see a message "Need more data"
**And** the "Close Battle" button is disabled

---

### Story 7.5: Implement Battle Management

As a user,
I want to start, close, and iterate Battles per funnel stage,
So that I can continuously optimize my positioning through A/B testing.

**Acceptance Criteria:**

**Given** a funnel stage has no active Battle
**When** I click "Start Battle" on its card
**Then** I see a form to select two positioning variants to compare (FR58)
**And** submitting creates a new Battle with status=active

**Given** an active Battle reaches 🟢 significance
**When** I view the Funnel Card
**Then** I see "Close Battle" button enabled (FR59)
**And** clicking it opens a confirmation showing the winner

**Given** I close a Battle
**When** I confirm the winner
**Then** the winner is recorded as champion for this stage (FR60)
**And** the Battle status changes to "closed"
**And** closed_at is set to now
**And** other stage Battles are NOT affected (FR62)

**Given** a Battle was just closed
**When** I want to continue testing
**Then** I can "Start Next Battle" (FR61)
**And** the champion is pre-selected as Variant A
**And** I select a new challenger as Variant B

---

### Story 7.6: Build Battle History View

As a user,
I want to see the history of Battles per funnel stage,
So that I can track my optimization progress over time.

**Acceptance Criteria:**

**Given** I expand a Funnel Card
**When** past Battles exist for this stage
**Then** I see a list of historical Battles (FR35, FR63):
  - Battle #3: Variant C beat Variant B (52% vs 41%)
  - Battle #2: Variant B beat Variant A (48% vs 35%)
  - Battle #1: Variant A vs Variant Baseline

**Given** I view Battle history
**When** I click on a past Battle
**Then** I see detailed stats from when it was closed
**And** I can see the progression of optimization

**Given** I want to understand my overall progress
**When** I view the Dashboard
**Then** I can see which stages have iterated most (Battle #N visible)
**And** I can identify stages that need more attention

---

### Story 7.7: Implement Performance Matrix Drill-Down

As a user,
I want to drill down from analytics to see underlying data,
So that I can understand the details behind the numbers.

**Acceptance Criteria:**

**Given** I am viewing an expanded Funnel Card
**When** I click on a conversion rate cell (e.g., "47% (22/47)")
**Then** I see a drill-down showing the underlying data (FR32):
  - List of prospects at this stage with this positioning
  - Their interaction outcomes (positive/pending/negative)

**Given** I am in drill-down view
**When** I click on a prospect
**Then** I navigate to or see the prospect detail
**And** I can see full context for that prospect

**Given** I want to identify patterns
**When** I view drill-down data
**Then** I can see which prospects converted vs didn't
**And** I can identify potential improvements to my approach

---

### Story 7.8: Add Dashboard Summary Metrics

As a user,
I want to see high-level metrics on the Dashboard,
So that I can quickly assess my overall prospecting performance.

**Acceptance Criteria:**

**Given** I am on the Dashboard
**When** metrics are calculated
**Then** I see a summary section with:
  - Total active prospects
  - Prospects per funnel stage (mini funnel visualization)
  - Total interactions this week/month
  - Best performing positioning overall

**Given** I have been using BattleCRM
**When** I check the Dashboard
**Then** I can answer "How am I doing?" in under 5 seconds
**And** I know which areas need attention

**Given** no data exists yet (new user)
**When** I view the Dashboard
**Then** I see empty states with guidance:
  - "Import prospects to get started"
  - "Create positionings to start A/B testing"
  - "Log interactions to see conversion data"
