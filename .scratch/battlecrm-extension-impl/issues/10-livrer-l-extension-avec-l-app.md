# 10: Livrer l'extension avec l'app

**What to build:** chaque tag de version produit une extension signée par AMO (non listée), au numéro de l'app. Elle est servie par l'app sous `/extension/` avec son `updates.json`, si bien que Firefox la met à jour seul. Réglages › Préférences de l'app propose « Installer l'extension » (« Pour Firefox »). La procédure et la recette suggérée sont dans la doc d'exploitation. Sources : [spec extension](../../battlecrm-extension/spec.md) §11, §12 ; ST-124, ST-125 ; ADR 0013.

**Blocked by:** 04

**Status:** resolved

- [x] Job `extension` dans `release.yml`, avant `images` : build Firefox avec l'origine de `vars.APP_ORIGIN`, signature `web-ext sign --channel unlisted` (`--approval-timeout` 30 min, `timeout-minutes: 40`) ; son échec bloque la livraison
- [x] Relance : si AMO a déjà la version, le job télécharge le fichier signé au lieu de signer ; la relivraison d'un tag (`workflow_dispatch`) ne signe rien
- [x] `.xpi` (`battlecrm-<version>.xpi`, un seul) et `updates.json` copiés dans l'image `web`, servis par nginx sous `/extension/` ; `update_url` du manifeste pointe dessus ; `.xpi` joint à la GitHub Release
- [x] Réglages › Préférences : ligne « Extension Firefox », « Installer l'extension » vers le `.xpi` de la version de la SPA, mention « Pour Firefox », visible dans tous les navigateurs ; Paraglide FR/EN ; axe
- [x] `docs/ops/install.md` : créer les clés AMO, poser `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET` et `vars.APP_ORIGIN` ; dans « Livrer une version », une ligne qui suggère la recette (spec §12) avant un tag qui change la lecture de LinkedIn ; `MIN_EXTENSION_VERSION` montée à la main dans la PR d'une étape « contract »

## Comments

### 2026-11-04 : implémenté

- Job `extension` (`.github/workflows/release.yml`), après `verify`/`ci` et avant `images` (qui en dépend) : `pnpm install` filtré sur l'extension, build avec `APP_ORIGIN` = `vars.APP_ORIGIN` (refusé s'il n'est pas en `https://`, sans quoi le manifeste n'aurait pas d'`update_url`), puis signature. La version et l'id gecko sont lus dans le manifeste construit. Relivraison (`workflow_dispatch`) : `verify` sauté, donc `extension` et `images` aussi, rien n'est signé.
- Relance : `apps/extension/scripts/amo-signed-version.ts` demande à AMO `GET /api/v5/addons/addon/<id gecko>/versions/v<version>/` (JWT HS256). 404 → code 2, le job signe (`web-ext sign --channel unlisted --approval-timeout 1800000`) ; fichier `public` → téléchargé ; `unreviewed` (relance après un délai d'approbation dépassé) → attendu 30 min au plus ; autre statut → échec.
- Le job écrit `battlecrm-<version>.xpi` (un seul, vérifié) et `updates.json` (lien à côté de l'`update_url` du manifeste) dans l'artefact `extension`. `images` le pose dans `apps/web/extension/` (git-ignoré), le Dockerfile le copie sous `/extension/` (dossier vide hors release : 404). Nginx : `location /extension/`, `try_files $uri =404`, `no-cache` ; le `.xpi` part en `application/x-xpinstall` (vérifié sur l'image). Le service worker de la SPA laisse `/extension/` passer (`navigateFallbackDenylist`).
- Job `release` : le `.xpi` est joint à la GitHub Release ; une relance qui trouve la Release déjà créée renvoie seulement le fichier.
- Réglages › Préférences : « Extension Firefox » (libellé `device_firefox_extension` réutilisé), lien-bouton « Installer l'extension » vers `/extension/battlecrm-<version de la SPA>.xpi`, « Pour Firefox » en description du lien ; libellés `settings_install_extension` et `settings_extension_firefox_only` (fr, en). Test dans `settings.test.tsx`, avec axe. E2E : `/extension/updates.json` en 404 hors release.
- `docs/ops/install.md` : §5 (clés AMO, `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET`, variable `APP_ORIGIN`) ; « Livrer une version » : recette conseillée, signature, relances, retour arrière, `MIN_EXTENSION_VERSION`.
- Pas de migration.
- Non vérifié hors d'une vraie release : la lecture d'une version non listée par `versions/v<version>/` (doc d'AMO lue, pas essayée), le téléchargement du fichier signé, et le nom de fichier produit par `web-ext sign` (le job prend le seul `.xpi` du dossier). La première release dira si AMO exige aussi les sources (`--upload-source-code`) pour du code empaqueté.
- Hors ticket : `use-positioning.test.tsx` (« Ctrl Enter in the quick add… ») échoue dans Chromium quand le fichier tourne en entier, déjà sur `main` sans ces changements ; il passe seul.
- 2026-11-04 : la première signature (release `v0.8.0`) a échoué, AMO répondant `Duplicate add-on ID found.` : `battlecrm@romainsire.com` était pris par le module, supprimé, d'un ancien POC (AMO ne rend jamais l'identifiant d'un module supprimé). `gecko.id` devient `battlecrm@battlecrm.romainsire.com`, sans conséquence, aucune extension signée n'ayant été installée. Le reste a marché : clés AMO, build, envoi, validation.
