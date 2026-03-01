# Brainstorming — Extension Navigateur LinkedIn → BattleCRM

**Date:** 2026-02-28
**Participants:** Romain, Mary (Analyst)
**Statut:** Exploration initiale — à transmettre au PM pour intégration PRD + epics

---

## Idée en une phrase

Ajouter une extension navigateur (Chromium + Firefox) au monorepo BattleCRM qui permet, depuis la page LinkedIn d'un profil, d'ajouter ce profil en un clic à la liste des prospects — avec formulaire pré-rempli, détection de doublon automatique, et fenêtre flottante qui reste ouverte pendant les copier/coller.

---

## Alignement avec le projet existant

- **Complémentaire à l'Epic 6 (CSV Import)** : le CSV couvre le cold start massif (0 → 50 prospects en < 2h) ; l'extension couvre la prospection continue en temps réel, profil par profil.
- **S'appuie sur le modèle Prospect existant** : l'`linkedin_url` est déjà un champ de données (FR1) — c'est la clé naturelle pour la détection de doublons.
- **Philosophie "zero friction"** cohérente avec le PRD : moins de 30 secondes pour capturer un prospect depuis LinkedIn.

---

## Workflow utilisateur imaginé

### Cas 1 — Prospect non présent dans le CRM

```
Utilisateur est sur linkedin.com/in/john-doe
    → Content script détecte le profil
    → Appel silencieux API BattleCRM : "est-il dans le CRM ?"
    → Réponse : non
    → Badge rouge "+" sur l'icône de l'extension
    → Utilisateur clique l'icône
    → Fenêtre flottante (reste ouverte pendant copier/coller !)
    → Formulaire pré-rempli : Nom, Prénom, Titre, Entreprise, URL LinkedIn
    → Champs manuels : Email, Téléphone (copier/coller depuis LinkedIn)
    → Bouton "Ajouter le prospect"
    → Prospect créé au premier stage funnel ("Lead qualified")
    → Toast succès → fenêtre se ferme
```

### Cas 2 — Prospect déjà dans le CRM

```
    → Badge vert "✓" sur l'icône
    → Utilisateur clique
    → Fenêtre flottante
    → Alerte visible : "⚠️ Ce prospect est déjà dans BattleCRM"
    → Formulaire pré-rempli avec les DONNÉES CRM (pas le DOM LinkedIn)
    → Option : modifier et sauvegarder
```

---

## Décisions clés issues de la session

| Sujet | Décision | Raison |
|-------|----------|--------|
| Détection doublon | Via `linkedin_url` (unique par user) | Simple, stable, déjà dans le modèle |
| Indexation | Ajouter un index sur `(user_id, linkedin_url)` | Performance lookup temps réel |
| Popup vs fenêtre | `chrome.windows.create({ type: "popup" })` | Reste ouverte pendant copier/coller — une browser action popup standard se ferme au clic extérieur |
| Authentification extension | **Login email/password → API Token Bearer** (pas réutilisation des cookies de session) | CORS cookies httpOnly = cauchemar cross-origin ; Bearer token = propre, révocable, SaaS-ready |
| Stockage token | `chrome.storage.local` | Sécurisé, inaccessible aux pages web |
| Funnel stage à l'ajout | Premier stage ("Lead qualified") — pas de sélecteur dans la popup | Zéro friction ; cohérent avec l'import CSV |
| Positionnement variant | Hors scope — pas dans la popup | Complexité non justifiée à l'ajout |
| Distribution | Pas de Chrome Web Store pour le MVP — zip téléchargeable + tuto installation | Évite le processus de review Google |
| Navigateurs | Chromium-first (Chrome, Edge, Brave) + Firefox compatible | Couverture max sans effort supplémentaire si on utilise WXT |

---

## Architecture technique esquissée

### Nouveau workspace : `apps/extension/`

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Framework | **WXT** (Web Extension Tools) | Vite-based, TypeScript, React, Chrome+Firefox, HMR — cohérent avec le monorepo |
| UI | React + Tailwind (même stack) | Pas de nouvelle dépendance, design tokens réutilisables |
| Manifest | V3 | Standard actuel, support Firefox via WXT |
| Permissions | `storage`, `activeTab`, `scripting` | Minimum nécessaire |
| Host perms | `*://www.linkedin.com/*` | Scope réduit au strict nécessaire |

### Modifications backend nécessaires

**Nouveaux éléments (non exhaustif — à spécifier par le PM + Archi) :**

```
Nouvelle table : extension_tokens
├── user_id → FK users
├── token_hash (bcrypt du token brut)
├── name (ex: "Mon Chrome")
├── last_used_at
└── revoked_at

Nouveaux endpoints (groupe /api/extension/*) :
├── POST   /api/extension/auth/login    → retourne token brut (une seule fois)
├── POST   /api/extension/auth/logout   → révoque token
├── GET    /api/extension/prospects/check?linkedin_url=  → { found, prospect? }
├── POST   /api/extension/prospects     → créer (premier funnel stage auto)
└── PATCH  /api/extension/prospects/:id → modifier

CORS : autoriser chrome-extension:// et moz-extension:// via env var
Middleware : BearerTokenMiddleware (additionnel au session middleware existant)
```

### Flux d'authentification

```
User ouvre l'extension pour la 1ère fois
    → Saisit : URL BattleCRM + email + password
    → POST /api/extension/auth/login
    → Token retourné → stocké dans chrome.storage.local
    → Token jamais réaffiché dans l'UI (seulement hash en DB)
    → Logout = révocation côté serveur + suppression locale
```

---

## Données scrappables depuis LinkedIn (DOM public)

| Champ | Source DOM | Fiabilité |
|-------|-----------|-----------|
| Prénom + Nom | `h1` du profil | Haute |
| Titre / Poste | Headline sous le nom | Haute |
| Entreprise actuelle | Section expérience (1er item) | Moyenne (DOM complexe) |
| URL LinkedIn | `window.location.href` | Très haute (canonique) |
| Email | Non visible (sauf partage explicite) | → Champ manuel |
| Téléphone | Non visible | → Champ manuel |

**Note importante :** LinkedIn est une SPA React — le content script doit gérer la navigation interne (MutationObserver ou navigation API) pour re-déclencher la détection lors des changements d'URL sans rechargement de page.

---

## Questions ouvertes / à trancher lors de la spec

1. **Extension ID fixe** : utiliser la feature `key` du manifest WXT pour fixer l'ID Chrome (évite de reconfigurer CORS à chaque rechargement en dev) — à confirmer avec l'architecte.
2. **Durée de vie des tokens** : long-lived sans expiry automatique (MVP) ou rotation périodique ? À décider selon l'appétit sécurité.
3. **Page settings BattleCRM** : est-ce qu'on ajoute une page "Tokens d'extension" dans les Settings de l'app web pour voir/révoquer ses tokens ? (recommandé pour un futur SaaS)
4. **Gestion du offline** : l'extension doit dégrader gracieusement si le serveur BattleCRM est inaccessible — à spécifier dans les ACs.

---

## Prochaines étapes recommandées

1. **PM → mise à jour PRD** : ajouter les nouvelles FRs (FR-EXT1 à FR-EXT11) et NFRs extension
2. **Architecte → mise à jour Architecture** : valider le choix WXT, documenter `apps/extension/`, extension_tokens table, Bearer middleware, CORS config
3. **PM → création Epic 8** dans `epics.md` avec stories découpées
4. **UX Designer → wireframes extension** : login screen, popup formulaire, états badge icône
