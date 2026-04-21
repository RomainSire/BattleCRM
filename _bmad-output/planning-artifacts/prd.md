---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10, 11]
inputDocuments:
  - /home/bison/DEV/BattleCRM/_bmad-output/analysis/brainstorming-session-2026-01-06.md
  - /home/bison/DEV/BattleCRM/_bmad-output/analysis/brainstorming-session-2026-01-08.md
  - /home/bison/DEV/BattleCRM/_bmad-output/analysis/brainstorming-session-2026-01-10.md
  - /home/bison/DEV/BattleCRM/_bmad-output/analysis/brainstorming-extension-linkedin-2026-02-28.md
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 4
  projectDocsCount: 0
workflowType: 'prd'
lastStep: 11
completedAt: '2026-02-02'
majorUpdate: 'Replaced Global Sprints with Independent Battles per Funnel Stage'
lastUpdated: '2026-03-01'
lastUpdateReason: 'Reprioritized epics: CSV Import delayed to Epic 8; Performance Analytics promoted to Epic 6; LinkedIn Browser Extension moved to Epic 7'
---

# Product Requirements Document - BattleCRM

**Author:** Romain
**Date:** 2026-01-28

## Executive Summary

**BattleCRM** is a data-driven CRM specifically designed for freelance consultants operating in "war machine hibernation" mode. Unlike traditional CRMs that are either too simplistic or overwhelming productivity killers, BattleCRM enables continuous improvement through simple, intuitive A/B testing with a modern, enjoyable interface.

The product addresses the unique freelance workflow: long periods in mission (hibernation mode) with minimal prospecting, followed by the need for rapid activation into "war mode" when a mission ends. The critical requirement is the ability to go from 0 to active prospecting in less than 24 hours, then find a new mission within 30-45 days.

**Primary User:** The user themselves (freelance developer prospecting to ESN firms), with controlled multi-account capability for a few freelance friends.

**Core Problem Solved:** Traditional CRM solutions fail freelancers in two ways: simple tools (Excel, Notion, Airtable) lack data-driven insights and don't measure the right KPIs, while enterprise CRMs are bloated productivity killers that cost more time than they save. Freelancers need something that delivers immediate ergonomic value while enabling scientific optimization of their approach.

### What Makes This Special

**The "Aha!" Moment:** Users realize they can continuously improve their prospecting approach through simple, intuitive A/B testing without fighting the tool. The modern, pleasant interface makes data entry faster than pen and paper, turning every interaction into actionable data for self-improvement.

**Counter-Intuitive Insight:** Most CRMs optimize for volume (sales teams, high-frequency transactions). BattleCRM optimizes for quality in a low-volume, high-stakes context (1-2 missions per year). It applies growth hacking principles to personal freelance activity - treating yourself as the product to optimize.

**Core Philosophy:** "A few highly significant KPIs > 50 KPIs measuring everything." Ruthless simplicity with scientific rigor. Every pixel must earn its place. Zero tolerance for friction.

**Differentiated Approach:**

1. **Performance Matrix (Variant × Funnel Stage)** - The central view that shows conversion rates for each CV/pitch variant at each funnel stage, with Bayesian updating to extract insights even from low sample sizes

2. **Independent Battles per Funnel Stage** - Each funnel stage has its own A/B test "Battle" that progresses independently based on its volume. When statistical significance is reached for a stage, declare a winner and start the next Battle (winner vs new challenger) - without resetting other stages. This addresses the volume asymmetry: early stages (CV sending) accumulate data fast, while late stages (interviews) take longer

3. **Cold Start Optimization** - LinkedIn CSV import to go from 0 to 50 prospects in under 2 hours. The tool must be ready to activate "war mode" within 24 hours

4. **Qualitative + Quantitative** - Lead scoring (🟢 hot / 🟡 neutral / 🔴 cold) complements quantitative metrics, because gut feeling is also data

5. **Customizable Funnel** - Workflow evolves with experience. Funnel stages are configurable without touching code (max 15 stages, linear order, no overcomplexity)

**Vision If Wildly Successful:** Freelancers continuously improve based on real market signals. Mission flow becomes completely controllable and actionable on demand. Emotions are replaced with cold, data-driven perspective. The tool is efficient enough that prospecting continues even during missions, enabling business development opportunities. The freelancer becomes a self-optimizing system.

## Project Classification

**Technical Type:** web_app (Web Application)
**Domain:** general (productivity/personal CRM tool)
**Complexity:** low (no heavy regulatory compliance)
**Project Context:** Greenfield - new project

**Technical Architecture:**
- **Frontend:** React + Vite
- **Backend:** Adonis.js
- **Database:** PostgreSQL (self-hosted via Docker Compose — no external dependency)
- **Hosting:** Self-hosted VPS
- **Authentication:** Email/Password via Adonis native auth (scrypt hashing, httpOnly session cookies) with `ALLOW_REGISTRATION` environment variable control; Bearer token auth for browser extension
- **Repository Structure:** Monorepo with front app, back app, browser extension, and shared schemas/types/DTOs

**Core Data Model:**
- **3 Primary Tables:** Prospects (people), Interactions (timeline), Positionings (A/B test variants)
- **Customizable Funnel:** 10 default stages (Lead qualified → First contact → Connection established → Positive response → ESN qualification → Application sent → ESN interview(s) → Final client interview(s) → Proposal received → Contract signed ✅)
- **Multi-user:** Data isolation via user_id from day one

**Key Architectural Principles:**
- **Ruthless Ergonomics:** 3-click maximum rule. Minimalist aggression (every pixel earns its place). Zero friction (pre-filled fields, permissive validation, no popups except destructive actions)
- **Code Quality Non-Negotiable:** Zero tolerance for data bugs (guaranteed rage quit). Automated tests on critical operations. Data integrity first (soft delete, transactions, rigorous validation)
- **Cold Start Optimized:** 0 → war mode in < 24h. CSV import as day-1 priority feature. 0 → 50 prospects in < 2h
- **Standalone Value:** App viable without external dependencies (LinkedIn/Waalaxy). Integrations are nice-to-have bonuses. Core value = CRM + Analytics + A/B testing

**Innovation Signals:**
- Bayesian updating for low-volume contexts
- Independent Battles per funnel stage for A/B testing (volume-aware progression)
- Hybrid qualitative + quantitative lead scoring
- "War machine hibernation" mental model

### Why Independent Battles (Not Global Sprints)

**The Problem with Global Sprints:**
A global sprint (e.g., "test CV v1 vs v2 for 2 weeks across all stages") fails because of volume asymmetry:
- Early funnel stages (CV sending) accumulate 50+ data points in 2 weeks
- Late funnel stages (interviews) may only have 5 data points in the same period
- A global reset would waste accumulated learning on high-volume stages while low-volume stages learned nothing

**The Battle Solution:**
Each funnel stage runs its own independent "Battle" (A vs B test):
- **Envoi CV: Battle #4** (CV v3 vs v4) - already on 4th iteration due to high volume
- **Relance: Battle #2** (Msg v1 vs v2) - progressing at its own pace
- **Entretien: Battle #1** (Pitch v1 vs v2) - still on first test due to low volume

**Key Benefits:**
1. **Volume-Adaptive:** Each stage progresses at its natural pace
2. **No Wasted Learning:** Closing a Battle on one stage doesn't reset others
3. **Continuous Optimization:** High-volume stages iterate faster, providing quicker wins
4. **Statistical Integrity:** Each Battle reaches significance before declaring a winner

## Success Criteria

### User Success

**Primary Success Moment:** User realizes they can continuously improve their prospecting approach through simple, intuitive A/B testing with an interface that makes data entry faster than pen and paper. Every interaction becomes actionable data for self-improvement.

**Immediate Success Indicators (First Battles - 2-4 weeks):**
- Identify which positioning variant (CV, pitch, message) performs best based on real conversion data for at least one funnel stage
- See measurable improvement in conversion rates as Battles conclude
- Successfully complete at least one Battle cycle (declare winner, start next Battle with winner vs new challenger)

**Conversion Improvement Targets:**
- **+10% conversion rate improvement** on any variant = significant success
- Critical challenge: System must help determine when there's enough data for results to be statistically significant vs. just noise (Bayesian updating addresses this)

**Cold Start Success (War Mode Activation):**
- Go from 0 to 50 prospects imported in under 2 hours
- Activate "war mode" in less than 24 hours from mission end
- Performance Matrix shows actionable insights with as few as 10 prospects

**Adoption Success Threshold:**
- If no perceived value after 1 week of use → adoption failure
- Logging an interaction must take maximum 3 clicks and under 1 minute
- Tool must be observably faster than "writing it down on paper"

**Long-term User Success Vision:**
- Achieve 10 interviews per week in active war mode
- Sign new mission contract within 30 days of entering war mode
- Demonstrate continuous improvement each week through measurable conversion rate increases
- Maintain cold, data-driven perspective replacing emotional decision-making
- Enable prospecting continuation even during active missions (business development)

### Business Success

**At 3 Months:**

*Hibernation Mode Success:*
- Smooth prospect import workflow with zero friction
- Automatic duplicate detection and elimination working flawlessly
- Zero data bugs (data integrity absolute - any data bug = rage quit)
- Positioning variants and funnel prepared and ready for war mode activation

*War Mode Success:*
- Significant continuous improvement as Battles conclude per funnel stage
- Multiple Battles completed across different funnel stages (early stages progress faster due to higher volume)
- User actively using the tool for prospecting decisions

**At 12 Months:**
- Primary user (Romain) actively using BattleCRM as daily prospecting tool
- Multi-user capability functional but adoption by friends is nice-to-have
- **No monetization goal** - success = self-improvement and continuous optimization
- Portfolio value demonstrated: clean code, solid architecture, real-world usage

**Business Model:**
- Not a commercial product (for now)
- Purpose: Personal continuous improvement tool
- Multi-user exists for controlled sharing with freelance friends
- Success ≠ revenue, success = demonstrable self-optimization

### Technical Success

**Code Quality (Non-Negotiable):**
- **Zero tolerance for data bugs** - any data integrity issue = immediate failure
- Automated tests on all critical operations (CRUD prospects, interactions, CSV import)
- Soft delete (archivage) implemented everywhere - no data loss ever
- Database transactions for multi-table operations
- Rigorous validation before any data insertion

**Performance Requirements:**
- CSV import of 50 prospects completes in under 5 minutes
- Page loads under 1 second (no lag, no spinner fatigue)
- Interaction logging form pre-fills intelligently and submits in under 3 clicks
- Tool must be objectively faster than Excel/Notion/Airtable for every operation

**Architecture Success:**
- Multi-user data isolation via user_id functional from day one (enforced at backend middleware level)
- Authentication working securely with user isolation (Adonis native sessions)
- Customizable funnel (max 15 stages) operational without code changes
- Bayesian updating calculations producing actionable baseline comparisons

**MVP Delivery:**
- MVP completed in 7-9 weeks (leveraging AI for acceleration)
- All MVP features functional and tested before any "war mode" activation
- Code quality suitable for portfolio showcase

### Measurable Outcomes

**Battle-Level Metrics (Per Funnel Stage):**
- Each funnel stage tracks its own independent A/B Battle
- Winner designated when statistical significance is reached (timing varies by stage volume)
- Conversion rate delta measured for each variant within each Battle
- Statistical significance indicator (Bayesian confidence) displayed per Battle

**War Mode Metrics:**
- Prospects imported: Target 50+ in first 2 hours
- Interactions logged: Daily without friction
- Conversion improvements: +10% or more on optimized variants
- Time to mission signed: 30-45 days from war mode start

**Quality Metrics:**
- Data bugs: **Zero tolerance** - any bug = critical failure
- User friction: Max 3 clicks for any core operation
- Speed: Faster than manual alternatives for 100% of workflows

## Product Scope

### MVP - Minimum Viable Product

**Core Features (Must Have for First War Mode Test):**

1. **Performance Matrix Variante × Étape Funnel**
   - Central analytics view showing conversion rates
   - Drill-down by cell to see prospects/interactions
   - Bayesian updating for low-volume contexts
   - Traffic light reliability indicators (🔴🟡🟢)

2. **Import CSV LinkedIn**
   - Map CSV fields to CRM (name, company, LinkedIn URL, email, phone, title)
   - Automatic duplicate detection
   - Pre-fill update proposals with manual validation
   - Default status: "Lead qualified" (funnel stage 1)

3. **Architecture 3 Views + Drill-Down**
   - Top navbar: Prospects | Positionings | Interactions
   - Preview inline in lists (key info visible at a glance)
   - Contextual drill-down (related data appears inline)
   - Responsive design, clear navigation

4. **Customizable Funnel**
   - 10 default stages pre-filled (Lead qualified → Contract signed)
   - User configurable without touching code
   - Max 15 stages, linear order (no complex branching)
   - Settings page for configuration (isolated from daily workflow)

5. **Multi-User + Auth**
   - Email/Password authentication (Adonis native sessions)
   - Data isolation via user_id from day one (enforced at backend level)
   - `ALLOW_REGISTRATION` environment variable control

6. **Interactions Timeline**
   - Free-text notes field per interaction (capture objective + subjective data)
   - Type/subtype for categorization
   - Status tracking (✅ positive, ⏳ pending, ❌ negative)
   - Link to positioning variant used
   - Two entry paths: from prospect detail or from interactions list

7. **Positionings (Variant Tracking)**
   - Store CV, pitch, message variants
   - Description/rationale field ("why was this variant created?")
   - Track which prospects received which variant
   - Type field (CV, LinkedIn message, pitch, etc.)

8. **Minimal Friction Logging**
   - 4-5 essential fields maximum
   - Pre-filled fields (last prospect, active variant)
   - Optional fields truly optional
   - Under 1 minute to log an interaction

9. **Searchable Archive (Soft Delete)**
   - Soft delete implementation (`deleted_at` field)
   - "Search in archives" toggle option
   - Backend ignores `deleted_at` when archive search active
   - No data loss, just organizational cleanup

10. **Independent Battles per Funnel Stage**
    - Each funnel stage has its own A/B test Battle (e.g., "CV Battle #3: v2 vs v3")
    - Battles progress independently based on stage volume (early stages faster than late stages)
    - When significance reached: close Battle, declare winner, optionally start next Battle (winner vs new challenger)
    - No global reset - closing a Battle on one stage doesn't affect other stages
    - Performance Matrix shows current Battle status per funnel stage

**Technical Requirements (MVP):**
- Stack: React + Vite / Adonis.js / PostgreSQL (Docker) / VPS
- Repository: Simple monorepo (front app / back app / shared types-schemas-DTOs)
- Automated tests on critical operations
- Data integrity absolute (transactions, validation, soft delete everywhere)
- 3-click maximum rule enforced
- Responsive design (desktop primary, mobile-friendly)

### Growth Features (Post-MVP)

**Phase 1 (Quick Wins - 1-2 weeks):**
- **Lead Scoring 3 Levels** (🟢 hot / 🟡 neutral / 🔴 cold)
- **Battle History & Comparison** (view historical Battles per stage, compare Battle performance over time)
- **Search improvements** (fuzzy search, filters per view)

**Phase 2 (Enhanced Analytics - 2-3 weeks):**
- **Enhanced Bayesian Display** (confidence intervals, effect size visualization)
- **Cohort Analysis** (performance by prospect segment, if needed)

**Phase 3 (Integrations - 3-4 weeks):**
- **Waalaxy Integration** (webhook tracking, campaign sync)
- **n8n Automation** (trigger workflows based on interaction status)
- **LinkedIn API** (if available, automated prospect sync)

**Phase 4 (Power User - 2-3 weeks):**
- **CMD+K Global Search** (fuzzy search across all entities)
- **Keyboard Shortcuts** (power user efficiency)
- **Batch Operations** (bulk prospect updates, bulk interactions)

### Vision (Future)

**Standalone Enhancements:**
- Interview AI Analysis (separate app with webhook bridge)
- Dashboard "North Star" (cockpit view for high-level metrics)
- Proactive CRM (intelligent reminders, suggested actions)

**Generalization Potential:**
- Open to other freelance consultants, sales professionals
- API for third-party integrations
- Export/import for data portability

**Community Features (if multi-user adoption grows):**
- Anonymized conversion benchmarks ("Your CV conversion vs. average")
- Template library (positioning variants that work well)
- Best practices sharing

**Monetization (Not Priority):**
- Freemium model (basic free, advanced analytics paid)
- Self-hosted remains free forever
- Cloud-hosted option for convenience

## User Journeys

### Journey 1: Romain - Le Réveil de la Machine de Guerre

Romain est en mission longue depuis 18 mois chez un grand compte. Il apprécie la stabilité mais sait que rien ne dure éternellement. Un vendredi soir, son manager lui annonce que le projet se termine dans 45 jours. Le lundi matin, au lieu de paniquer, Romain ouvre BattleCRM qu'il a préparé pendant ses soirées tranquilles.

En moins de 2 heures, il importe 50 prospects depuis son export LinkedIn Sales Navigator. Le système détecte automatiquement 5 doublons qu'il avait déjà ajoutés manuellement le mois dernier, lui propose des mises à jour qu'il valide en 3 clics. Il assigne rapidement ses 3 variantes de CV (v1, v2 optimisé React, v3 focus architecture) et ses 2 templates de messages LinkedIn qu'il avait préparés en mode hibernation.

Le breakthrough survient après 10 jours. La Battle "Envoi CV" atteint la significativité statistique : CV v2 converti à 52% au passage "Lead qualifié → Premier contact" contre 38% pour CV v1. Le feu tricolore passe au vert 🟢. Romain clôture la Battle et lance la suivante : CV v2 (le gagnant) contre CV v3. Pendant ce temps, la Battle "Message Relance" continue indépendamment à son propre rythme - elle n'a pas encore assez de volume. Les données sont claires, froides, sans émotion : il sait exactement quelle approche marche, étape par étape.

25 jours après avoir activé le mode guerre, Romain signe une nouvelle mission avec un TJM 15% plus élevé. Quand son ami freelance lui demande "comment tu as fait ?", sa réponse est simple : "J'ai traité ma prospection comme un produit à optimiser. Chaque semaine j'étais meilleur que la précédente. Les chiffres ne mentent pas."

**Capacités révélées :**
- Cold Start rapide (Import CSV + activation < 24h)
- Performance Matrix avec Bayesian updating
- Battles indépendantes par étape de funnel (A/B testing adapté au volume)
- Gestion positionnements multiples
- Dashboard conversion temps réel

### Journey 2: Romain - L'Hibernation Productive

Romain est en pleine mission, concentré sur son code. Mais tous les premiers dimanches du mois, il se réserve 2 heures pour "rester prêt". Ce dimanche, il ouvre BattleCRM et met à jour son CV avec les nouvelles technos qu'il maîtrise maintenant. Il crée une variante v4 qui met en avant son expérience récente en architecture microservices.

Il parcourt LinkedIn de manière détendue, trouve 15 nouveaux chargés d'affaires ESN intéressants, exporte le CSV, l'importe dans BattleCRM. Aucun stress, aucune friction. Il ajoute aussi un nouveau template de message LinkedIn qui met l'accent sur son expertise cloud récemment acquise.

Trois mois plus tard, quand son contrat se termine brusquement (le client coupe le budget), Romain n'a qu'à activer le mode guerre. Tout est déjà là : 80 prospects qualifiés, 4 variantes de CV testables, 3 templates de messages. Il n'a perdu aucune des 2 heures mensuelles d'investissement - c'était sa police d'assurance.

**Capacités révélées :**
- Mode hibernation utile (pas juste un gimmick)
- Préparation progressive sans pression
- Import prospects par petits lots
- Gestion variantes de positionnement
- Archive searchable (prospects anciens restent accessibles)

### Journey 3: Thomas - L'Ami Freelance Sceptique Devenu Converti

Thomas est développeur freelance et ami de Romain. Il prospecte "à l'ancienne" : un Google Sheet avec 30 prospects, des notes éparses dans Notion, ses CV dans un dossier Dropbox. Quand sa mission se termine, il panique toujours un peu et envoie le même CV à tout le monde.

Romain lui montre BattleCRM un soir : "Regarde, j'ai testé 3 CV différents. Celui-ci converti 20% mieux. J'ai les chiffres." Thomas est intrigué mais sceptique. Romain lui crée un compte (variable `ALLOW_REGISTRATION=true` activée temporairement, redémarre le backend). "Teste pendant un mois, tes données sont 100% isolées des miennes."

Thomas commence doucement. Import de 20 prospects, 2 variantes de CV. Les deux premières semaines, il trouve l'interface agréable mais pas révolutionnaire. La troisième semaine, la Performance Matrix commence à montrer des patterns : son CV "senior" performe mieux avec les grandes ESN, son CV "expert technique" marche mieux avec les ESN mid-size.

Le déclic arrive quand sa première Battle atteint la significativité : il teste son CV gagnant contre une nouvelle variante qui met plus en avant son expérience DevOps. En 10 jours il a sa réponse : +15% de conversion. Thomas réalise qu'il peut **apprendre de ses propres données**. Six semaines après avoir commencé, il a signé une mission et envoie un message à Romain : "Tu avais raison. Je ne retournerai jamais à mon Google Sheet."

**Capacités révélées :**
- Onboarding simple pour nouvel utilisateur
- Data isolation totale (confidentialité)
- Courbe d'apprentissage douce
- Value visible rapidement (3 semaines)
- Interface intuitive sans formation

### Journey 4: Romain - L'Administrateur Technique (Edge Case: Gestion Multi-User)

Romain vient de terminer le MVP de BattleCRM. Deux de ses amis freelances lui demandent d'essayer l'outil. Il se connecte en SSH sur son VPS, édite le fichier `.env` : `ALLOW_REGISTRATION=true`. Il envoie l'URL à Thomas et Julie avec un message : "Créez vos comptes, vous avez 48h. Après je referme les inscriptions."

Thomas et Julie créent leurs comptes via l'interface standard email/password. Romain vérifie que l'isolation fonctionne correctement : chaque utilisateur ne voit que ses propres données. Il fait un test rapide : se connecte avec le compte de test, essaie d'accéder à l'API avec un autre user_id → accès refusé par le backend. Parfait.

Une semaine plus tard, Thomas signale un bug étrange : "Mes doublons ne sont pas bien détectés lors de l'import CSV." Romain se connecte à son propre compte (pas celui de Thomas - il ne peut pas accéder aux données de Thomas), reproduit le bug avec ses propres données, identifie le problème dans le code, déploie un fix en 30 minutes.

Deux mois après le lancement, Romain décide de fermer temporairement les inscriptions. Il édite `.env`: `ALLOW_REGISTRATION=false`, redémarre le backend. Sur la page de login, le bouton "Créer un compte" disparaît. Simple, efficace, contrôle total.

**Capacités révélées :**
- Gestion simple variable environnement
- Monitoring basique mais efficace
- Row Level Security vérifié
- Debug sans accès aux données users
- Déploiement et maintenance VPS

### Journey Requirements Summary

**Import & Cold Start:**
- Import CSV LinkedIn (mapping automatique, détection doublons)
- Activation mode guerre < 24h
- Import par petits lots en hibernation

**Analytics & A/B Testing:**
- Performance Matrix Variante × Étape Funnel
- Bayesian updating pour faible volume
- Battles indépendantes par étape (gagnant/perdant quand significativité atteinte)
- Traffic light fiabilité statistique

**Gestion Données:**
- 3 vues (Prospects, Positionnements, Interactions)
- Drill-down contextuel inline
- Logging minimal friction (< 1 min)
- Archive searchable (soft delete)

**Multi-User & Admin:**
- Auth Adonis native sessions
- Isolation totale par user_id (backend-enforced)
- Variable ALLOW_REGISTRATION
- Onboarding simple

**UX/Ergonomie:**
- Interface intuitive (courbe apprentissage douce)
- Règle 3 clics maximum
- Pre-fill intelligent
- Value visible en 3 semaines

## Web Application Specific Requirements

### Project-Type Overview

BattleCRM is built as a **Single Page Application (SPA)** using React + Vite for the frontend and Adonis.js for the backend. The architecture prioritizes modern web standards, developer ergonomics, and portfolio-quality code over broad compatibility with legacy systems.

**Target Audience:** Developers and technical freelancers with modern browsers and devices.

### Technical Architecture Considerations

**Architecture Pattern:** SPA with RESTful Backend
- **Frontend:** React 18+ with Vite for fast development and optimized builds
- **Styling:** Tailwind CSS + shadcn/ui for component library
- **Backend:** Adonis.js providing RESTful API endpoints
- **Communication:** Standard REST API calls (no WebSockets/real-time requirements)
- **State Management:** TBD based on complexity (Context API, Zustand, or Redux if needed)
- **Routing:** Client-side routing (React Router or similar)
- **Language:** Full TypeScript strict mode (front + back)

**Monorepo Structure:**
- **Package Manager:** pnpm (fast, efficient, disk-space optimized)
- **Workspace Management:** pnpm workspaces (turborepo if needed, but likely overkill)
- `/apps/frontend` - React + Vite SPA
- `/apps/backend` - Adonis.js REST API
- `/apps/extension` - Browser extension (WXT + React + Tailwind, Manifest V3)
- `/packages/shared` - Shared TypeScript types, schemas, DTOs

**TypeScript Configuration:**
- Strict mode enabled across all packages
- Shared tsconfig.base.json for consistency
- Type-safe API contracts via shared DTOs

### Browser Matrix & Compatibility

**Supported Browsers:**
- **Chrome:** Latest 2 versions (primary development target)
- **Firefox:** Latest 2 versions (secondary target)
- **No legacy browser support** - IE11, old Safari versions explicitly excluded

**Rationale:** Target audience is developers who maintain up-to-date browsers. Eliminating legacy support enables modern JavaScript features, cleaner code, and faster development.

**Testing Strategy:**
- Primary development in Chrome
- Regular manual testing in Firefox
- Automated tests run in headless Chrome

### Responsive Design Strategy

**Device Support:**
- **Desktop:** Primary experience (1920x1080, 1440x900, 1366x768)
- **Mobile:** Responsive support (iOS Safari, Android Chrome)
- **Tablet:** Responsive support as byproduct of desktop/mobile design

**Design Philosophy:**
- Desktop-first design (primary use case is desk work during prospecting)
- Mobile-friendly for on-the-go consultation (checking stats, quick logging)
- No separate mobile app needed - responsive web suffices

**Styling Approach:**
- **Tailwind CSS:** Utility-first for rapid development and consistent design
- **shadcn/ui:** Pre-built accessible components (buttons, dialogs, forms, tables)
- **Design Tokens:** Tailwind config for colors, spacing, typography
- **Dark Mode:** Support via Tailwind (nice-to-have, not MVP blocker)

**Breakpoints:**
- Desktop: 1024px+
- Tablet: 768px - 1023px
- Mobile: < 768px

### Performance Targets

**Load Performance:**
- Initial page load: < 2 seconds on 4G connection
- Subsequent navigation: < 500ms (SPA instant transitions)
- CSV import (50 prospects): < 5 minutes (server processing time)

**Runtime Performance:**
- Page interactions: < 100ms response time
- List rendering (100 prospects): < 1 second
- Performance Matrix calculation: < 2 seconds

**Bundle Size:**
- Initial JS bundle: Target < 300KB gzipped
- Code splitting for routes not immediately needed
- Lazy loading for heavy components (charts, Performance Matrix)
- Tailwind purging unused styles in production

**Optimization Strategies:**
- Vite for optimized builds and tree-shaking
- React.memo / useMemo for expensive computations
- Virtual scrolling if lists exceed 100 items
- Debounced search/filter inputs

### SEO Strategy

**SEO Status:** Not required

**Rationale:** BattleCRM is a private, authenticated application. No public pages need indexing. All content is behind authentication wall.

**Public Pages (if any):**
- Login page (no SEO value needed)
- Optional: Landing page explaining the tool (future, low priority)

**Meta Tags:** Minimal - just title and viewport for proper rendering.

### Accessibility Level

**Target Level:** WCAG 2.1 Level A (with selective AA features)

**Rationale:** Portfolio showcase quality - code must demonstrate accessibility awareness without over-engineering for a personal tool.

**Required Accessibility Features:**

*Keyboard Navigation:*
- All interactive elements accessible via keyboard (Tab, Enter, Escape)
- Logical tab order matching visual flow
- Focus indicators visible and clear
- Skip navigation links where appropriate

*Visual Accessibility:*
- Color contrast ratios meeting WCAG AA minimums (4.5:1 for text)
- No reliance on color alone for information (use icons + colors)
- Readable fonts with adequate sizing (minimum 16px body text)

*Semantic HTML:*
- Proper heading hierarchy (h1 → h2 → h3)
- Semantic elements (nav, main, article, section)
- Form labels properly associated with inputs
- ARIA attributes where semantic HTML insufficient

*Screen Reader Support:*
- Meaningful alt text for images
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic updates (e.g., "Prospect added successfully")
- Proper form validation feedback

**shadcn/ui Advantage:** Components built with accessibility in mind (ARIA patterns, keyboard support), reducing manual accessibility work.

**Not Required (Out of Scope for MVP):**
- Full WCAG 2.1 AAA compliance
- Screen magnification optimization
- Advanced assistive technology testing
- ARIA-heavy complex widget patterns

**Testing Approach:**
- Keyboard-only navigation testing during development
- Automated accessibility tests (axe-core, eslint-plugin-jsx-a11y)
- Manual contrast checking with browser dev tools
- Occasional screen reader spot-checking (nice-to-have, not systematic)

### Implementation Considerations

**Development Workflow:**
- Hot module replacement (HMR) via Vite for fast iteration
- TypeScript strict mode for type safety across frontend and backend
- Shared types/DTOs prevent API contract mismatches
- ESLint + Prettier for code consistency
- pnpm for fast, efficient dependency management

**Deployment Strategy:**
- **Containerization:** Docker + Docker Compose (primary use: **production** on VPS; can also be used for local dev)
- **Frontend Container:** Node-based build → nginx serving static files
- **Backend Container:** Node runtime with Adonis.js application
- **Database Container:** PostgreSQL 16 (self-hosted, no external dependency)
- **Reverse Proxy:** nginx container routing /api/* to backend

**Docker Compose Structure (production):**
```yaml
services:
  frontend:
    - Vite production build
    - Nginx serving static files
    - Port 80/443 exposed

  backend:
    - Adonis.js app
    - Port 3333 internal
    - Environment variables for config

  postgres:
    - PostgreSQL 16
    - Persistent volume for data
    - Internal network only

  nginx-proxy:
    - Routes / to frontend
    - Routes /api/* to backend
    - SSL termination (Let's Encrypt)
```

**Benefits of Docker Approach:**
- Self-contained deployment (no external database dependency)
- Consistent environments (dev/prod)
- Easy deployment and rollback
- Isolated dependencies
- Simplified VPS setup
- Professional deployment practice (portfolio showcase)

**Browser API Usage:**
- LocalStorage for client-side preferences (theme, UI state)
- Fetch API for REST calls (no axios dependency needed)
- File API for CSV import handling
- No service workers (offline mode not required)

**Security Considerations:**
- HTTPS enforced
- CSRF protection via Adonis backend
- XSS prevention via React's default escaping
- Content Security Policy headers
- Environment variables for secrets (never committed)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP avec Cold Start Optimization

**Philosophy:** Résoudre le problème core du freelance qui doit activer son "mode guerre" en moins de 24h, avec capacité d'A/B testing via Battles indépendantes par étape de funnel. L'MVP doit être suffisamment ergonomique pour battre Excel/Notion dès la première semaine d'utilisation, sinon échec d'adoption.

**Strategic Rationale:**
- **User Value First:** Chaque feature MVP doit contribuer directement au succès utilisateur (import rapide, logging frictionless, Performance Matrix actionnable)
- **Data Integrity:** Zero-bug data policy signifie architecture robuste dès le MVP (soft delete, transactions, validation stricte)
- **Portfolio Showcase:** Code quality non-négociable - TypeScript strict, tests automatisés, Docker deployment

**Resource Requirements:**
- **Team Size:** Solo developer (toi) avec AI assistance pour accélération
- **Timeline:** 7-9 semaines de développement MVP
- **Skills:** Full-stack TypeScript, React, Adonis.js, PostgreSQL, Docker
- **Infrastructure:** VPS self-hosted, PostgreSQL in Docker

### MVP Feature Set (Phase 1 - 7-9 Weeks)

**Core User Journeys Supported:**
1. ✅ Journey 1: Activation mode guerre en < 24h (Cold Start)
2. ✅ Journey 2: Préparation progressive en hibernation
3. ✅ Journey 4: Administration technique simple (multi-user + env vars)
4. ⏸️ Journey 3: Adoption par amis freelances (fonctionnel mais pas prioritaire pour validation)

**Must-Have Capabilities (10 Core Features):**

1. **Performance Matrix Variante × Étape Funnel**
   - Vue centrale analytics avec conversion rates
   - Bayesian updating pour faible volume
   - Drill-down par cellule
   - Traffic light fiabilité (🔴🟡🟢)

2. **Import CSV LinkedIn**
   - Mapping automatique des champs
   - Détection doublons automatique
   - Pre-fill update proposals avec validation manuelle
   - Default status "Lead qualified"

3. **Architecture 3 Vues + Drill-Down**
   - Top navbar: Prospects | Positionings | Interactions
   - Preview inline dans listes
   - Drill-down contextuel
   - Navigation responsive

4. **Customizable Funnel**
   - 10 stages par défaut pre-filled
   - User configurable sans toucher code
   - Max 15 stages, ordre linéaire
   - Settings page isolée du workflow quotidien

5. **Multi-User + Auth**
   - Email/Password authentication (Adonis native sessions)
   - Data isolation via user_id (backend-enforced, no RLS)
   - Variable `ALLOW_REGISTRATION` pour contrôle

6. **Interactions Timeline**
   - Notes libres par interaction
   - Type/subtype categorization
   - Status tracking (✅⏳❌)
   - Link to positioning variant
   - Deux entry paths (depuis prospect ou liste interactions)

7. **Positionings (Variant Tracking)**
   - Store CV, pitch, message variants
   - Description/rationale field
   - Track prospects × variants
   - Type field (CV, LinkedIn message, pitch)

8. **Minimal Friction Logging**
   - 4-5 champs essentiels maximum
   - Pre-filled fields intelligents
   - Champs optionnels vraiment optionnels
   - < 1 minute pour logger

9. **Searchable Archive (Soft Delete)**
   - Soft delete (`deleted_at` field)
   - Toggle "Search in archives"
   - Backend ignore `deleted_at` si archive search active

10. **Independent Battles per Funnel Stage**
    - Each funnel stage has its own A/B test Battle
    - Battles progress independently based on stage volume
    - Close Battle when significance reached → declare winner → start next Battle
    - No global reset - stages are independent
    - Performance Matrix shows Battle status per stage

**Technical Foundation (Non-Negotiable):**
- TypeScript strict mode (front + back)
- pnpm monorepo avec workspaces
- Docker + Docker Compose deployment
- Tailwind CSS + shadcn/ui
- Automated tests sur opérations critiques
- Règle 3-clics maximum enforced

### Post-MVP Features

**Phase 2 - Growth (Quick Wins: 1-2 weeks each)**

Post-MVP immédiat (semaines 10-12):
- Lead Scoring 3 Levels (🟢🟡🔴)
- Battle History & Analytics (historical Battles per stage, cross-Battle comparisons)
- Search improvements (fuzzy search, filters per view)

**Phase 3 - Enhanced Analytics (2-3 weeks)**

Semaines 13-16:
- Enhanced Bayesian Display (confidence intervals, effect size)
- Cohort Analysis (si besoin identifié)

**Phase 4 - Integrations (3-4 weeks)**

Semaines 17-21:
- **LinkedIn Browser Extension** (Epic 7 — capture prospect en 1 clic depuis LinkedIn)
- Waalaxy Integration (webhook tracking, campaign sync)
- n8n Automation (trigger workflows)

**Phase 5 - Power User (2-3 weeks)**

Semaines 22-25:
- CMD+K Global Search
- Keyboard Shortcuts
- Batch Operations

### Expansion Vision (Future)

**Standalone Enhancements:**
- Interview AI Analysis (separate app + webhook bridge)
- Dashboard "North Star" (cockpit view)
- Proactive CRM (intelligent reminders)

**Generalization Potential:**
- Open to other freelance consultants
- API for third-party integrations
- Export/import data portability

**Community Features (if multi-user adoption grows):**
- Anonymized conversion benchmarks
- Template library (variants that work)
- Best practices sharing

**Monetization (Not Priority):**
- Freemium model (basic free, advanced paid)
- Self-hosted free forever
- Cloud-hosted convenience option

### Risk Mitigation Strategy

**Technical Risks:**

*Risk 1: Bayesian Updating Complexity*
- **Mitigation:** Start with simple confidence intervals, iterate based on usage
- **Fallback:** Display raw conversion % with sample size warning if Bayesian too complex

*Risk 2: Performance Matrix Calculation Performance*
- **Mitigation:** Backend caching, incremental calculations
- **Fallback:** Calculate on-demand with loading indicator if real-time too slow

*Risk 3: CSV Import Edge Cases*
- **Mitigation:** Extensive validation, clear error messages, manual override options
- **Fallback:** Manual prospect entry if CSV import fails

**Market Risks:**

*Risk 1: Tool Trop Complexe (Adoption Failure)*
- **Validation:** Onboarding flow testing, première semaine usage tracking
- **Mitigation:** Ruthless simplification if adoption < 1 week threshold
- **Metric:** If no perceived value after 1 week → pivot UX immediately

*Risk 2: A/B Testing Pas Assez de Volume*
- **Validation:** Test Bayesian avec 10-20 prospects simulés
- **Mitigation:** Traffic light reliability warnings, qualitative lead scoring backup
- **Metric:** Si insights pas actionnables avec 20 prospects → revoir approche stats

**Resource Risks:**

*Risk 1: MVP Prend Plus Que 9 Semaines*
- **Contingency:** Scope reduction - retirer features 9 et 10 (Archive, Independent Battles)
- **Absolute Minimum:** Features 1-8 suffisent pour validation

*Risk 2: Bugs Data Compromettent Adoption*
- **Prevention:** TDD sur opérations critiques, transactions partout, soft delete
- **Response:** Fix immédiat < 24h si data bug identifié (zero tolerance policy)

*Risk 3: Burnout Solo Developer*
- **Prevention:** MVP timeline réaliste (7-9 weeks, pas 4 weeks)
- **Mitigation:** Priorisation ruthless, AI assistance pour boilerplate
- **Fallback:** Extended timeline acceptable si qualité maintenue

## Functional Requirements

### Prospect Management

- **FR1:** Users can create prospects with basic information (name, company, LinkedIn URL, email, phone, title)
- **FR2:** Users can view a list of all prospects with inline preview of key information
- **FR3:** Users can update prospect information
- **FR4:** Users can archive prospects (soft delete) to remove them from active views
- **FR5:** Users can search archived prospects and restore them to active status
- **FR6:** Users can filter prospects by funnel stage
- **FR7:** Users can assign a positioning variant to a prospect (one per funnel stage; assigning a new one replaces the previous for that stage)
- **FR8:** Users can view prospect detail with full information and interaction history
- **FR9:** Users can drill down from prospects to related interactions inline
- **FR76:** Users can switch between a list view and a Kanban board view for prospects, with drag-and-drop to move prospects between funnel stages

### Positioning Management

- **FR10:** Users can create positioning variants (CV, pitch, LinkedIn message, etc.)
- **FR11:** Users can specify positioning type (CV, LinkedIn message, pitch, cold email, etc.)
- **FR12:** Users can add description and rationale for each positioning variant
- **FR13:** Users can view a list of all positioning variants with inline preview
- **FR14:** Users can update positioning variant information
- **FR15:** Users can archive positioning variants no longer in use
- **FR16:** Users can view which prospects received which positioning variant
- **FR17:** Users can drill down from positioning to related prospects and interactions

### Interaction Management

- **FR18:** Users can log interactions from prospect detail page
- **FR19:** Users can log interactions from interactions list page
- **FR20:** Users can add free-text notes for each interaction (objective + subjective data)
- **FR21:** Users can categorize interactions by type and subtype
- **FR22:** Users can assign interaction status (positive, pending, negative)
- **FR23:** System automatically links an interaction to the prospect's active positioning variant and current funnel stage at the time of logging (snapshots — immutable after creation)
- **FR24:** Users can link an interaction to a prospect
- **FR25:** Users can view chronological timeline of all interactions
- **FR26:** Users can filter interactions by prospect, positioning, status, or date
- **FR27:** System pre-fills interaction form with last prospect and active variant
- **FR28:** Users can view interaction detail with full context

### Performance Analytics

- **FR29:** Users can view Performance Matrix showing conversion rates by positioning variant × funnel stage
- **FR30:** System calculates conversion rates using Bayesian updating for low-volume contexts
- **FR31:** System displays statistical reliability indicators (traffic light: 🔴🟡🟢) for conversion rates
- **FR32:** Users can drill down from Performance Matrix cells to see underlying prospects and interactions
- **FR33:** Users can view current Battle status per funnel stage in Performance Matrix
- **FR34:** System tracks each funnel stage's independent Battle (which variants are being tested)
- **FR35:** Users can view historical Battles per funnel stage (past winners, progression)
- **FR36:** Users can compare conversion rates across positioning variants within a Battle
- **FR37:** Users can identify winning variant per Battle based on conversion data and significance indicator

### Funnel Configuration

- **FR38:** Users can configure custom funnel stages (names and order)
- **FR39:** System provides 10 default funnel stages pre-filled
- **FR40:** Users can add, remove, or reorder funnel stages (max 15 stages); removing a stage is blocked if any active prospect is currently on it — allowed if only historical data (interactions, past positionings) references it
- **FR41:** Users can configure funnel stages without touching code (via Settings page)
- **FR42:** System enforces linear funnel order (no branching)
- **FR43:** Users can move prospects between funnel stages
- **FR44:** System tracks prospect progression through funnel stages

### Data Import & Export

- **FR45:** Users can import prospects from LinkedIn CSV export
- **FR46:** System automatically maps CSV fields to prospect fields
- **FR47:** System detects duplicate prospects during import
- **FR48:** System proposes update strategies for detected duplicates with manual validation
- **FR49:** System assigns default funnel stage "Lead qualified" to imported prospects
- **FR50:** Users can manually validate and adjust imported prospect data before final import

### User Management & Authentication

- **FR51:** Users can create accounts with email and password
- **FR52:** Users can log in with email and password
- **FR53:** Users can log out
- **FR54:** System isolates user data by user_id (multi-tenant architecture)
- **FR55:** Administrator can enable/disable new user registration via environment variable
- **FR56:** System enforces Row Level Security to prevent cross-user data access

### Battle Management (A/B Testing per Funnel Stage)

- **FR57:** Each funnel stage can have an active Battle (A vs B test between two positioning variants)
- **FR58:** Users can start a new Battle for a funnel stage by selecting two variants to compare
- **FR59:** Users can close a Battle when statistical significance is reached (system indicates via 🟢 traffic light)
- **FR60:** When closing a Battle, users declare the winner which becomes the "champion" for that stage
- **FR61:** Users can start the next Battle: champion vs new challenger variant
- **FR62:** Closing a Battle on one funnel stage does NOT reset or affect Battles on other stages (independent progression)
- **FR63:** System tracks Battle history per funnel stage (Battle #1, #2, #3... with winners)
- **FR64:** Performance Matrix displays current Battle info per stage (which variants, current stats, significance indicator)

### LinkedIn Browser Extension

- **FR65:** Users can install a browser extension and authenticate using their BattleCRM email and password credentials
- **FR66:** Extension detects when the user is viewing a LinkedIn profile page (`linkedin.com/in/*`)
- **FR67:** Extension silently checks (without user action) if the visited LinkedIn profile already exists as a prospect in BattleCRM, using the LinkedIn URL as unique key
- **FR68:** Extension icon displays a visual badge indicating prospect status: red "+" badge = not in CRM (invite to add), green "✓" badge = already in CRM
- **FR69:** Users can open the extension popup pre-filled with data scraped from the LinkedIn profile (first name, last name, title, company, LinkedIn URL); form state is persisted in `chrome.storage.session` (keyed by normalized LinkedIn URL) so edits survive popup close/reopen cycles; state is automatically cleared when navigating to a different LinkedIn profile
- **FR70:** If the prospect already exists in CRM, the extension displays a prominent warning and pre-fills the form with the existing CRM data (not the scraped LinkedIn data), offering an update option
- **FR71:** Users can add a new prospect from the extension — the prospect is automatically assigned to the user's first funnel stage ("Lead qualified")
- **FR72:** Users can update an existing prospect's information from the extension
- **FR73:** Extension auth token is stored securely and persists across browser sessions (user stays logged in until explicit logout)
- **FR74:** Users can configure the BattleCRM instance URL in extension settings (supports both localhost and production VPS URLs)
- **FR75:** Users can logout from the extension, which revokes the token server-side and clears local storage

## Non-Functional Requirements

### Performance

**Response Time Requirements:**
- **NFR1:** Page loads must complete in under 2 seconds on 4G connection
- **NFR2:** Subsequent SPA navigation must complete in under 500ms
- **NFR3:** User interactions (clicks, form submissions) must respond in under 100ms
- **NFR4:** Performance Matrix calculation must complete in under 2 seconds
- **NFR5:** List rendering (100 prospects) must complete in under 1 second

**Data Processing Requirements:**
- **NFR6:** CSV import of 50 prospects must complete in under 5 minutes (server processing)
- **NFR7:** Interaction logging must complete in under 1 minute end-to-end (user perception)

**Bundle Size Requirements:**
- **NFR8:** Initial JavaScript bundle must be under 300KB gzipped
- **NFR9:** Tailwind CSS production build must purge unused styles

**Critical Success Metric:** Tool must be observably faster than manual alternatives (Excel, Notion, Airtable) for 100% of workflows. If not, adoption will fail.

### Security

**Authentication & Authorization:**
- **NFR10:** All user authentication must use Adonis native session auth with httpOnly cookies (scrypt password hashing)
- **NFR11:** Backend middleware must enforce data isolation between users (all queries filtered by user_id)
- **NFR12:** No user can access another user's data under any circumstance
- **NFR13:** Administrator registration control via `ALLOW_REGISTRATION` environment variable

**Data Protection:**
- **NFR14:** HTTPS must be enforced for all connections
- **NFR15:** CSRF protection must be implemented via Adonis backend
- **NFR16:** XSS prevention via React's default escaping
- **NFR17:** Content Security Policy headers must be configured
- **NFR18:** Environment variables for secrets must never be committed to repository

**Multi-Tenant Isolation:**
- **NFR19:** All database queries must filter by user_id automatically (enforced in backend services/controllers)
- **NFR20:** Backend middleware must reject requests attempting to access data belonging to another user_id

### Reliability & Data Integrity

**Zero-Bug Data Policy (Non-Negotiable):**
- **NFR21:** Zero tolerance for data bugs - any data integrity issue is immediate critical failure
- **NFR22:** All data mutations must use database transactions for consistency
- **NFR23:** All entities must implement soft delete (`deleted_at` field) - no hard deletes
- **NFR24:** Data validation must be rigorous before any insertion or update
- **NFR25:** Automated tests must cover all critical CRUD operations

**Error Handling:**
- **NFR26:** CSV import must provide clear error messages for validation failures
- **NFR27:** Users must have manual override options for edge cases
- **NFR28:** System must gracefully handle and recover from errors without data loss

**Critical Success Metric:** Any data bug results in guaranteed rage quit. Data integrity is the #1 non-negotiable requirement.

### Accessibility

**Target Level:** WCAG 2.1 Level A with selective AA features

**Keyboard Navigation:**
- **NFR29:** All interactive elements must be accessible via keyboard (Tab, Enter, Escape)
- **NFR30:** Logical tab order must match visual flow
- **NFR31:** Focus indicators must be visible and clear
- **NFR32:** Skip navigation links must be provided where appropriate

**Visual Accessibility:**
- **NFR33:** Color contrast ratios must meet WCAG AA minimums (4.5:1 for text)
- **NFR34:** Information must not rely on color alone (use icons + colors)
- **NFR35:** Minimum body text size must be 16px

**Semantic HTML & ARIA:**
- **NFR36:** Proper heading hierarchy must be maintained (h1 → h2 → h3)
- **NFR37:** Semantic HTML elements must be used (nav, main, article, section)
- **NFR38:** Form labels must be properly associated with inputs
- **NFR39:** ARIA labels must be provided for icon-only buttons
- **NFR40:** ARIA live regions must announce dynamic updates

**Rationale:** Portfolio showcase quality - demonstrates accessibility awareness without over-engineering.

**Testing Approach:**
- Automated accessibility tests (axe-core, eslint-plugin-jsx-a11y)
- Keyboard-only navigation testing during development
- Manual contrast checking with browser dev tools

### Usability & User Experience

**Ergonomic Requirements (Critical for Adoption):**
- **NFR41:** Maximum 3 clicks to complete any core operation (enforced rule)
- **NFR42:** Interaction logging must take under 1 minute (4-5 fields maximum)
- **NFR43:** Form fields must pre-fill intelligently (last prospect, active variant)
- **NFR44:** Optional fields must be truly optional (permissive validation)
- **NFR45:** No popups except for destructive actions (confirmation dialogs only)

**Information Architecture:**
- **NFR46:** Key information must be visible at a glance (inline preview in lists)
- **NFR47:** Contextual drill-down must appear inline (no navigation required)
- **NFR48:** Every pixel must earn its place (minimalist aggression)

**Critical Success Metric:** If no perceived value after 1 week of use → adoption failure. Tool must be faster and more pleasant than pen and paper.

### Maintainability & Code Quality

**Code Quality (Portfolio Showcase):**
- **NFR49:** TypeScript strict mode must be enabled across all packages (front + back)
- **NFR50:** ESLint + Prettier must enforce code consistency
- **NFR51:** No TypeScript `any` types allowed without explicit justification
- **NFR52:** Shared types/DTOs must prevent API contract mismatches

**Testing Requirements:**
- **NFR53:** Automated tests must cover all critical operations (CRUD, CSV import, auth)
- **NFR54:** Test suite must run in CI/CD pipeline
- **NFR55:** Tests must run in headless Chrome for consistency

**Development Experience:**
- **NFR56:** Hot Module Replacement (HMR) must work reliably via Vite
- **NFR57:** pnpm workspaces must enable efficient monorepo management
- **NFR58:** Docker Compose must provide a consistent production environment (also usable for local dev)

**Deployment Quality:**
- **NFR59:** Docker containers must be production-ready and optimized
- **NFR60:** Deployment must be reproducible and rollback-capable
- **NFR61:** Environment-based configuration via environment variables

**Rationale:** Code must be portfolio-quality to demonstrate professional development practices to potential recruiters.

### Browser Compatibility

**Supported Browsers:**
- **NFR62:** Must support Chrome latest 2 versions (primary target)
- **NFR63:** Must support Firefox latest 2 versions (secondary target)
- **NFR64:** No legacy browser support required (IE11, old Safari excluded)

**Responsive Design:**
- **NFR65:** Must be fully responsive across desktop (1024px+), tablet (768-1023px), and mobile (<768px)
- **NFR66:** Desktop-first design with mobile-friendly fallbacks
- **NFR67:** No separate mobile app required

**Rationale:** Target audience is developers with modern browsers - eliminates legacy support burden.

### Browser Extension

**Compatibility:**
- **NFR68:** Extension must be compatible with Chromium-based browsers (Chrome, Edge, Brave) as primary target and Firefox as secondary target (via WXT cross-browser build)

**Security:**
- **NFR69:** Extension authentication token must be stored in `chrome.storage.local` — not in localStorage, cookies, or any web-accessible storage
- **NFR70:** Extension token must never be displayed in the UI after initial creation (only the hash is stored server-side)

**UX & Ergonomics:**
- **NFR71:** Extension form state must persist across popup close/reopen cycles for the same LinkedIn profile (implemented via `chrome.storage.session` keyed by normalized LinkedIn URL); the user can click away from the popup to copy-paste from the LinkedIn page and resume editing on reopen with all previous edits intact; state is automatically cleared on profile navigation
- **NFR72:** Prospect existence check triggered on profile page visit must respond in under 1 second

**Resilience:**
- **NFR73:** Extension must gracefully degrade when BattleCRM server is unreachable (silent badge state, clear error in popup if opened — no crash)
- **NFR74:** Extension must re-trigger profile detection on LinkedIn SPA navigation (URL changes without full page reload, handled via MutationObserver or Navigation API)
