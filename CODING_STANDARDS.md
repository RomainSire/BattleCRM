# Coding standards

Rules a review checks on a diff. Rules a tool can check live in the tools instead: `.oxlintrc.json` (module boundaries, banned libraries), `pnpm --filter @battlecrm/api db:drift` (tables without their migration).

## Errors shown to the User

Every error shown to the User goes through `ErrorMessage` or `FieldErrorMessage` (`apps/web/src/components/ui/error-message.tsx`): the Error colour and an icon, the faulty field outlined. Red means an error and nothing else, never an outcome (spec UX §2).

## Migrations and endpoints

- A shipped migration (one already on `main`) stays as it is: a change goes in a new migration.
- Every migration and endpoint change stays compatible with the previous version (expand/contract): the previous web build and API keep working during a deploy. Adding a column or an endpoint is fine; renaming or dropping one takes two releases, the first one adding the new shape.
