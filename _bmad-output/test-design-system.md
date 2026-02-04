---
workflowType: 'test-design-system'
project_name: 'BattleCRM'
mode: 'system-level'
phase: 3
status: 'complete'
completedAt: '2026-02-04'
inputDocuments:
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/epics.md
---

# System-Level Test Design - BattleCRM

_Testability review before implementation readiness gate (Phase 3 - Solutioning)_

## 1. Architecture Testability Assessment

### 1.1 Controllability Analysis

| Component | Controllability | Notes |
|-----------|-----------------|-------|
| **Frontend (React + Vite)** | HIGH | Component isolation via props, TanStack Query mocking, Zustand/Context testable |
| **Backend (Adonis.js)** | HIGH | Controller/Service/Model separation, dependency injection, VineJS validators isolated |
| **Database (Supabase/PostgreSQL)** | MEDIUM | RLS policies require user context setup; transactions for test isolation |
| **Authentication (Sessions + httpOnly cookies)** | MEDIUM | Requires mock session setup; cannot easily test in isolation |
| **Bayesian Service** | HIGH | Pure calculations, no side effects, easily unit testable |
| **CSV Import Service** | MEDIUM | File I/O dependency; needs file fixtures and mock strategies |

**Overall Controllability: HIGH** - Architecture allows easy test setup and manipulation.

### 1.2 Observability Analysis

| Component | Observability | Notes |
|-----------|---------------|-------|
| **API Responses** | HIGH | REST JSON responses, Adonis default error format, inspectable |
| **Database State** | HIGH | Direct SQL queries for assertions, soft delete visible via `deleted_at` |
| **Frontend State** | HIGH | TanStack Query DevTools, React DevTools, Zustand inspection |
| **Performance Matrix** | MEDIUM | Complex aggregations; need to validate intermediate calculations |
| **Battle State Machine** | MEDIUM | State transitions need explicit logging for test verification |
| **Session Auth** | LOW | httpOnly cookies not directly inspectable; verify via API behavior |

**Overall Observability: HIGH** - System state is inspectable at all layers.

### 1.3 Reliability Analysis

| Aspect | Assessment | Notes |
|--------|------------|-------|
| **Test Isolation** | HIGH | Database transactions for cleanup, TanStack Query cache reset |
| **Determinism** | HIGH | No external API dependencies (Supabase self-contained), no random elements in business logic |
| **Timing Independence** | HIGH | No real-time features, no WebSockets, request/response only |
| **Environment Parity** | HIGH | Docker Compose ensures identical environments |

**Overall Reliability: HIGH** - Tests will be deterministic and repeatable.

---

## 2. Architecturally Significant Requirements (ASRs)

### 2.1 Critical NFRs Requiring Test Strategy

| NFR | Category | Risk Level | Test Strategy |
|-----|----------|------------|---------------|
| **NFR21** | Data Integrity | CRITICAL | Transaction tests, soft delete verification, data consistency checks |
| **NFR22** | Data Integrity | CRITICAL | Multi-table transaction rollback tests |
| **NFR23** | Data Integrity | HIGH | Soft delete coverage on all CRUD operations |
| **NFR11** | Security | CRITICAL | RLS policy penetration tests, cross-user access attempts |
| **NFR12** | Security | CRITICAL | User isolation E2E tests with multiple users |
| **NFR1** | Performance | HIGH | Page load benchmarks (< 2s on 4G) |
| **NFR4** | Performance | HIGH | Performance Matrix calculation benchmarks (< 2s) |
| **NFR6** | Performance | MEDIUM | CSV import timing tests (50 prospects < 5 min) |
| **NFR41** | Usability | HIGH | 3-click rule validation via E2E user flows |

### 2.2 Risk-Based Prioritization

**CRITICAL (Must Pass for Release):**
1. Data integrity - zero tolerance for data bugs (NFR21-25)
2. User isolation - RLS enforcement (NFR11-12, NFR19-20)
3. Authentication - session security (NFR10)

**HIGH (Should Pass, Blocking Issues):**
1. Performance Matrix accuracy (FR29-31)
2. Battle state machine correctness (FR57-64)
3. CSV import duplicate detection (FR47-48)
4. 3-click rule compliance (NFR41)

**MEDIUM (Quality Concerns):**
1. Bayesian calculation accuracy (FR30)
2. Pre-fill intelligence (FR27, NFR43)
3. Archive search functionality (FR5, NFR23)

---

## 3. Test Levels Strategy

### 3.1 Recommended Test Distribution

Based on architecture (React SPA + Adonis.js REST API + Supabase):

| Level | Coverage Target | Rationale |
|-------|-----------------|-----------|
| **Unit Tests** | 60% | Pure business logic (Bayesian, validators, utilities) |
| **Integration Tests** | 30% | API endpoints, database operations, service interactions |
| **E2E Tests** | 10% | Critical user journeys only (cold start, battle lifecycle) |

### 3.2 Unit Test Focus Areas

**Frontend:**
- VineJS schema validators
- Utility functions (queryKeys, formatters)
- Bayesian calculation display components
- Traffic light logic (🔴🟡🟢 thresholds)

**Backend:**
- `BayesianService` - conversion rate calculations
- `BattleService` - state machine transitions
- `CsvImportService` - field mapping, duplicate detection logic
- VineJS validators (all schemas)
- Model scopes (soft delete, user isolation)

### 3.3 Integration Test Focus Areas

**API Contract Tests:**
- All REST endpoints (CRUD for prospects, positionings, interactions)
- Authentication flows (login, logout, session validation)
- RLS policy enforcement (attempt cross-user access)
- Error response format compliance

**Database Integration:**
- Transaction rollback on error
- Soft delete cascading behavior
- Funnel stage constraints (max 15)
- Foreign key relationships

### 3.4 E2E Test Focus Areas

**Critical User Journeys (3-5 max):**

1. **Cold Start Journey** (Journey 1)
   - Login → CSV Import → View 50 prospects → Assign variants
   - Target: < 2 hours simulated

2. **Battle Lifecycle** (Core Value)
   - Create Battle → Log interactions → View significance → Close Battle → Start next
   - Verify independent progression per funnel stage

3. **Interaction Logging** (3-Click Rule)
   - From prospect detail: 2 clicks to log interaction
   - From interaction list: 3 clicks max
   - Verify pre-fill behavior

4. **Multi-User Isolation**
   - User A creates data → User B cannot see it
   - Verify at UI level (not just API)

---

## 4. NFR Testing Approach

### 4.1 Security Testing

| NFR | Test Approach | Tools/Method |
|-----|---------------|--------------|
| NFR10 (Auth) | Session token validation, cookie security flags | Manual inspection + integration tests |
| NFR11-12 (RLS) | Cross-user access attempts via API | Integration tests with 2 test users |
| NFR14 (HTTPS) | Certificate validation, redirect enforcement | Deployment verification |
| NFR15 (CSRF) | Token validation on mutations | Integration tests |
| NFR16 (XSS) | Input sanitization verification | Unit tests + manual review |

**Security Test Scenario:**
```
Given User A is authenticated
When User A attempts to access User B's prospect via API
Then API returns 404 (not 403, to prevent enumeration)
And database query never returns User B's data
```

### 4.2 Performance Testing

| NFR | Metric | Test Method |
|-----|--------|-------------|
| NFR1 (Page load < 2s) | Time to Interactive | Lighthouse CI, WebPageTest |
| NFR4 (Matrix calc < 2s) | API response time | Load test with 100 prospects, 10 variants |
| NFR6 (CSV import < 5 min) | Processing time | Integration test with 50-row fixture |
| NFR8 (Bundle < 300KB) | Gzipped JS size | Build pipeline assertion |

**Performance Baseline:**
- 100 prospects
- 10 positioning variants
- 5 funnel stages with active Battles
- 500 interactions

### 4.3 Reliability Testing

| NFR | Test Approach |
|-----|---------------|
| NFR21-24 (Data integrity) | Fault injection: kill process mid-transaction, verify rollback |
| NFR26-27 (Error handling) | Invalid CSV fixtures, boundary conditions |
| NFR28 (Graceful recovery) | Network failure simulation, retry behavior |

### 4.4 Maintainability Testing

| NFR | Verification Method |
|-----|---------------------|
| NFR49 (TypeScript strict) | CI build fails on `any` without justification |
| NFR50 (ESLint/Prettier) | CI lint step with --max-warnings=0 |
| NFR53-55 (Test coverage) | Coverage threshold in CI (e.g., 80% statements) |

---

## 5. Test Environment Requirements

### 5.1 Environment Matrix

| Environment | Purpose | Data |
|-------------|---------|------|
| **Local Dev** | Developer testing | Seeded fixtures, reset per test |
| **CI/CD** | Automated tests | Fresh database per pipeline run |
| **Staging** | Pre-release validation | Production-like data (anonymized) |
| **Production** | Monitoring only | Real user data, no tests |

### 5.2 Test Data Strategy

**Fixture Requirements:**

| Entity | Fixture Size | Variants |
|--------|--------------|----------|
| Users | 3 | Admin (Romain), User A (Thomas), User B (Julie) |
| Prospects | 100 | Mix of funnel stages, lead scores |
| Positionings | 15 | 5 per type (CV, Message, Pitch) |
| Interactions | 500 | Distributed across prospects and stages |
| Funnel Stages | 10 | Default configuration |
| Battles | 5 | One per early funnel stage |

**CSV Import Fixtures:**
- `valid_linkedin_50.csv` - Standard import
- `duplicates_mixed.csv` - 10 duplicates among 30 new
- `invalid_format.csv` - Missing required fields
- `large_100.csv` - Performance boundary test

### 5.3 Test Database Strategy

**Isolation Approach:**
- Each test suite runs in transaction
- Transaction rolled back after each test
- Supabase RLS enabled (test with real policies)
- Separate test schema or database per CI run

---

## 6. Testability Concerns & Mitigations

### 6.1 Identified Concerns

| Concern | Impact | Mitigation |
|---------|--------|------------|
| **Bayesian calculations complexity** | Hard to verify correctness | Golden test fixtures with pre-computed expected results |
| **Battle state machine** | Edge cases in state transitions | State diagram documentation + exhaustive state transition tests |
| **RLS policy testing** | Requires real Supabase instance | Integration test suite with actual Supabase project |
| **Session auth in tests** | httpOnly cookies not inspectable | Test via authenticated API calls, not cookie inspection |
| **Performance Matrix aggregations** | Complex joins, hard to debug | Intermediate calculation logging in test mode |

### 6.2 Recommended Testability Improvements

**For Sprint 0 Implementation:**

1. **Add test mode flag** - Enable verbose logging for Bayesian/Battle services
2. **Create factory functions** - `createTestProspect()`, `createTestBattle()` with sensible defaults
3. **Document state diagrams** - Battle lifecycle states with allowed transitions
4. **Pre-compute golden results** - Bayesian expected values for known inputs
5. **Add database seeder** - Consistent test data across environments

---

## 7. Recommendations for Sprint 0

### 7.1 Test Infrastructure Setup

**Must-Have:**
- [ ] Vitest configuration for frontend unit tests
- [ ] Japa configuration for backend unit/integration tests (Adonis built-in)
- [ ] Test database setup script (isolated from dev)
- [ ] CI pipeline with test execution
- [ ] Coverage reporting with thresholds

**Should-Have:**
- [ ] Playwright setup for E2E tests
- [ ] Test fixture factories
- [ ] API contract test structure
- [ ] Performance benchmark baseline

### 7.2 Sprint 0 Test Deliverables

| Deliverable | Priority | Owner |
|-------------|----------|-------|
| Backend test structure (`tests/unit/`, `tests/integration/`) | P0 | Dev |
| Frontend test structure (`*.test.tsx` co-located) | P0 | Dev |
| Database seeder for test fixtures | P0 | Dev |
| CI test pipeline (GitHub Actions) | P0 | Dev |
| Playwright E2E scaffold | P1 | Dev |
| Coverage threshold configuration (80%) | P1 | Dev |

### 7.3 Definition of Done for Tests

**Every test MUST:**
- Be deterministic (same result on every run)
- Be isolated (no shared state between tests)
- Be explicit (clear arrange/act/assert structure)
- Run in < 1.5 minutes (individual test)
- Have meaningful assertion messages

**Test suite MUST:**
- Run in < 10 minutes total (CI target)
- Achieve 80% statement coverage on critical services
- Include at least 3 E2E critical path tests
- Pass with zero flaky tests policy

---

## 8. Test Design Readiness Summary

### 8.1 Readiness Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Architecture supports testability | ✅ PASS | High controllability, observability, reliability |
| Critical NFRs have test strategies | ✅ PASS | Data integrity, security, performance covered |
| Test levels defined | ✅ PASS | 60/30/10 unit/integration/E2E split |
| E2E critical paths identified | ✅ PASS | 4 user journeys defined |
| Environment strategy defined | ✅ PASS | Local/CI/Staging matrix |
| Test data strategy defined | ✅ PASS | Fixtures and factories specified |
| Testability concerns mitigated | ✅ PASS | Golden tests, state diagrams, factories |

### 8.2 Overall Assessment

**Test Design Status: ✅ READY FOR IMPLEMENTATION**

**Confidence Level: HIGH**

The BattleCRM architecture is highly testable:
- Clean separation between frontend/backend allows isolated testing
- No external dependencies (Supabase is self-contained)
- Business logic (Bayesian, Battles) is pure and unit-testable
- REST API provides clear integration test boundaries
- Critical paths (cold start, battle lifecycle) are well-defined for E2E

**Key Strengths:**
- Simple architecture with clear boundaries
- No real-time complexity (no WebSockets)
- Deterministic business logic
- Docker ensures environment parity

**Areas Requiring Attention:**
- Bayesian calculations need golden test fixtures
- Battle state machine needs exhaustive state transition tests
- RLS policies require integration tests with real Supabase

---

## 9. Next Steps

1. **Implementation Readiness Gate** - This document satisfies the test design prerequisite
2. **Sprint Planning** - Include test infrastructure in Sprint 0
3. **Epic-Level Test Design** - Generate per-epic test plans during implementation phase using `/bmad:bmm:workflows:testarch-test-design`

---

_Generated by TEA (Test Engineering Architect) Agent_
_Date: 2026-02-04_
_Mode: System-Level (Phase 3 - Solutioning)_
