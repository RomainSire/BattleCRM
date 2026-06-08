# Plan de dev — Fonctionnalité « Mot de passe oublié »

> Statut : **à implémenter** · Branche conseillée : `feat/forgot-password`
> Décisions validées : anti-énumération (toujours `200`), expiry token = **1h**, **pas** de feature flag (toujours actif).

## 0. Décisions d'architecture

| Sujet | Décision | Raison |
|---|---|---|
| Lib mail | **`@adonisjs/mail`** (officiel, batteries-included) avec transport **SMTP/Gmail** | Wrapper Nodemailer, déjà anticipé via l'alias `#mails/*` dans `package.json#imports` |
| Transport | SMTP `smtp.gmail.com:587` (host/port **câblés en dur** dans `config/mail.ts`) + **App Password** Gmail | Pas d'OAuth, simple comme demandé |
| Stockage token | Nouvelle table `password_reset_tokens`, on stocke le **hash SHA-256** du token (jamais le token brut) | Si la BDD fuite, les tokens ne sont pas réutilisables |
| Token brut | 32 bytes aléatoires → hex (64 chars), envoyé uniquement dans l'email | — |
| Cycle de vie | Single-use + expiry 1h ; à la demande, on **supprime les anciens tokens** du user avant d'en créer un nouveau | — |
| Réponse `forgot-password` | **Toujours `200`** message générique (même si email inconnu) | Anti-énumération de comptes |
| Lien de reset | Pointe vers le **frontend** : `${FRONTEND_URL}/reset-password?token=...` | SPA gère l'UI de saisie |

---

## 1. Backend — `apps/backend`

### 1.1 Installation & config mail
- [ ] `cd apps/backend && ENV_PATH=../../ node ace add @adonisjs/mail` (ou ajout manuel de la dép + provider si l'installer interactif pose problème).
  - Sélectionner le transport **smtp**.
- [ ] Vérifier/écrire `config/mail.ts` : mailer `smtp` lisant les vars d'env, `from` par défaut = `MAIL_FROM_ADDRESS`.

### 1.2 Variables d'environnement (`start/env.ts` + `.env` racine + `.env.example`)
Ajouter au schéma `Env.create` (host/port Gmail en dur dans la config, donc pas de var) :
```
GMAIL_USER=Env.schema.string()           # adresse Gmail dédiée (= aussi le "from")
GMAIL_APP_PASSWORD=Env.schema.string()   # App Password 16 chars (2FA requis)
FRONTEND_URL=Env.schema.string()         # ex: http://localhost:5173
```
- [x] Clés ajoutées à `.env.example` (section « Email (Gmail SMTP — password reset) »).
- [ ] Romain renseigne les valeurs réelles dans le `.env` racine (monorepo).
- [ ] `config/mail.ts` : transport smtp avec `host: 'smtp.gmail.com'`, `port: 587`, `secure: false`, auth `{ user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }`, `from` par défaut = `GMAIL_USER`.

### 1.3 Migration `database/migrations/0015_create_password_reset_tokens_table.ts`
```
ENV_PATH=../../ node ace make:migration password_reset_tokens
```
Colonnes :
- `id` uuid PK (default gen)
- `user_id` uuid, FK → `users.id`, `onDelete('CASCADE')`, indexé
- `token` string, **unique** (= hash SHA-256)
- `expires_at` `timestamptz`
- `created_at` `timestamptz`
> Cohérence avec migration `0014` (timestamps en `timestamptz`).

### 1.4 Model `app/models/password_reset_token.ts`
- `make:model` puis colonnes mappées camelCase (`userId`, `expiresAt`, `createdAt`).
- Helper statique éventuel `isExpired()` ou comparaison dans le service.

### 1.5 Service `app/services/password_reset_service.ts`
Logique métier isolée (testable en unitaire) :
- `generateResetToken(user)` → crée token brut (random 32 bytes), stocke le hash, purge les anciens tokens du user, retourne le **token brut**.
- `hashToken(raw)` → SHA-256 (via `node:crypto`).
- `consumeToken(rawToken)` → hash, lookup, check expiry, retourne le user ou `null` ; supprime le token (single-use).

### 1.6 Mail `app/mails/reset_password_notification.ts`
- Classe étendant `BaseMail` (ou closure `mail.send`), sujet i18n-friendly, corps avec lien `${FRONTEND_URL}/reset-password?token=${rawToken}`.
- Template HTML simple (texte + bouton/lien).

### 1.7 Validators `app/validators/auth.ts` (ajouts)
```ts
export const forgotPasswordValidator = vine.create(
  vine.object({ email: vine.string().email().trim().toLowerCase() }),
)
export const resetPasswordValidator = vine.create(
  vine.object({
    token: vine.string(),
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  }),
)
```

### 1.8 Controller `app/controllers/auth_controller.ts` (2 méthodes)
- `forgotPassword({ request, response })` :
  - valide email → `User.findBy('email', ...)`.
  - si user trouvé : `generateResetToken` + envoi mail (idéalement `mail.sendLater` / queue, sinon `mail.send`).
  - **toujours** `response.ok({ message: 'auth.forgotPassword.emailSent' })` (générique).
- `resetPassword({ request, response })` :
  - valide payload → `consumeToken(token)`.
  - si `null` (invalide/expiré) → `response.badRequest({ errors: [{ message: 'auth.resetPassword.invalidToken', rule: 'invalid' }] })`.
  - sinon : `user.password = data.password; await user.save()` → `response.ok({ message: 'auth.resetPassword.success' })`.

### 1.9 Routes `start/routes.ts` (dans le groupe `/auth`, `middleware.guest()`)
```ts
router.post('/forgot-password', [AuthController, 'forgotPassword']).use(middleware.guest())
router.post('/reset-password', [AuthController, 'resetPassword']).use(middleware.guest())
```

### 1.10 Tests backend (Japa fonctionnels — `tests/functional/`)
Red-green-refactor. Utiliser `mail.fake()` pour intercepter les emails (pas d'envoi réel).
- [ ] `forgot-password` : email existant → `200` + 1 token en base + 1 mail capturé.
- [ ] `forgot-password` : email inconnu → `200` + **aucun** token + **aucun** mail (anti-énumération, même status).
- [ ] `forgot-password` : un 2e appel purge le token précédent (1 seul token actif).
- [ ] `reset-password` : token valide → password modifié (re-login OK avec nouveau mdp), token consommé.
- [ ] `reset-password` : token expiré → `400` invalidToken.
- [ ] `reset-password` : token déjà utilisé (single-use) → `400`.
- [ ] `reset-password` : token bidon → `400`.
- [ ] `reset-password` : `passwordConfirmation` != `password` → erreur de validation.
- [ ] (unit) `password_reset_service` : hash déterministe, expiry, consume.

---

## 2. Frontend — `apps/frontend`

### 2.1 API `src/features/auth/lib/api.ts` (ajouts)
```ts
forgotPassword(email: string) {
  return fetchApi<{ message: string }>('/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  })
},
resetPassword(data: { token: string; password: string; passwordConfirmation: string }) {
  return fetchApi<{ message: string }>('/auth/reset-password', {
    method: 'POST', body: JSON.stringify(data),
  })
},
```

### 2.2 Hooks `src/features/auth/hooks/useAuth.ts`
- `useForgotPassword()` (mutation, pas d'invalidation auth.me).
- `useResetPassword()` (mutation).

### 2.3 Schémas (VineJS, côté client)
- `schemas/forgotPassword.ts` : `{ email }`.
- `schemas/resetPassword.ts` : `{ password (min 8), passwordConfirmation (sameAs password) }` (token vient de l'URL, pas du form).

### 2.4 Pages
- [ ] `ForgotPasswordPage.tsx` : formulaire email (shadcn `TextField`, `Card`), submit → message de succès générique (toujours, même UX que back). Lien retour `/login`.
- [ ] `ResetPasswordPage.tsx` : lit `token` via `useSearchParams`. Form `password` + `passwordConfirmation`. Submit → succès → `navigate('/login')` + toast. Si pas de token dans l'URL → message d'erreur + lien vers `/forgot-password`.

### 2.5 Lien sur `LoginPage.tsx`
- [ ] Ajouter sous le champ password (ou dans la rangée d'actions) un `Button variant="link" asChild` → `<Link to="/forgot-password">{t('auth.login.forgotPassword')}</Link>`.

### 2.6 Routing `src/routes.tsx`
Ajouter dans le bloc `GuestGuard > GuestLayout` :
```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

### 2.7 i18n `public/locales/{fr,en}.json` (namespace `auth`)
Ajouter :
- `auth.login.forgotPassword` : « Mot de passe oublié ? »
- `auth.forgotPassword.{title,description,submit,submitting,emailSent,backToLogin}`
- `auth.resetPassword.{title,description,submit,submitting,success,invalidToken,missingToken}`
- `auth.fields.newPassword`, `auth.placeholders.newPassword` (réutiliser `confirmPassword` existant).

### 2.8 Tests E2E (Playwright) — `apps/frontend` / racine
> ⚠️ **Ne PAS lancer automatiquement** — demander à Romain.
- [ ] Parcours : login → clic « Mot de passe oublié ? » → saisie email → message de succès.
- [ ] Reset : visite `/reset-password?token=...` (token injecté via helper de test back) → nouveau mdp → redirection login → login OK avec le nouveau mdp.
- Stratégie token en E2E : exposer un helper/route de test (cf. `TestController` + `E2E_TEST_ROUTES_ENABLED`) pour récupérer/forger un token de reset, ou lire le mail capturé.

---

## 3. Packages partagés — `packages/shared`
Optionnel : les endpoints renvoient `{ message }`, pas de nouvelle entité. Possibilité d'ajouter des types de requête `ForgotPasswordRequest` / `ResetPasswordRequest` dans `src/types/auth.ts` pour partage front/back si souhaité (sinon inline).

---

## 4. Ordre d'exécution (red-green-refactor)
1. **Shared** (si types ajoutés) → `pnpm shared:build`.
2. **Backend** : env + config mail → migration → model → service (+ tests unit) → mail → validators → controller → routes → tests fonctionnels (`mail.fake()`).
3. `ENV_PATH=../../ node ace migration:run` puis `ENV_PATH=../../ node ace test`.
4. **Frontend** : api → hooks → schémas → pages → lien Login → routes → i18n.
5. **Qualité** : `pnpm lint` + `pnpm type-check`.
6. **E2E** : écrire les specs, **demander à Romain** pour l'exécution.

## 5. Checklist finale
- [ ] `pnpm lint` clean (Biome)
- [ ] `pnpm type-check` clean
- [ ] `ENV_PATH=../../ node ace test` → 100% vert
- [ ] Build extension non impacté
- [x] `.env.example` documente `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `FRONTEND_URL`
- [ ] Email réellement reçu via Gmail (test manuel ponctuel)

## 6. Points de vigilance (conventions projet)
- Champs nullable backend : assigner explicitement (`?? null`).
- Lucid sérialise en **camelCase** côté réponses.
- `fetch` front : `credentials: 'include'` (déjà géré par `fetchApi`).
- Ne jamais committer sans demande explicite de Romain.
- Préfixe `ENV_PATH=../../` sur **toutes** les commandes `node ace`.
- Ne pas lancer les E2E automatiquement.
