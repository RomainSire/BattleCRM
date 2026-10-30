# 10: Livrer l'extension avec l'app

**What to build:** chaque tag de version produit une extension signée par AMO (non listée), au numéro de l'app. Elle est servie par l'app sous `/extension/` avec son `updates.json`, si bien que Firefox la met à jour seul. Réglages › Préférences de l'app propose « Installer l'extension » (« Pour Firefox »). La procédure et la recette suggérée sont dans la doc d'exploitation. Sources : [spec extension](../../battlecrm-extension/spec.md) §11, §12 ; ST-124, ST-125 ; ADR 0013.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Job `extension` dans `release.yml`, avant `images` : build Firefox avec l'origine de `vars.APP_ORIGIN`, signature `web-ext sign --channel unlisted` (`--approval-timeout` 30 min, `timeout-minutes: 40`) ; son échec bloque la livraison
- [ ] Relance : si AMO a déjà la version, le job télécharge le fichier signé au lieu de signer ; la relivraison d'un tag (`workflow_dispatch`) ne signe rien
- [ ] `.xpi` (`battlecrm-<version>.xpi`, un seul) et `updates.json` copiés dans l'image `web`, servis par nginx sous `/extension/` ; `update_url` du manifeste pointe dessus ; `.xpi` joint à la GitHub Release
- [ ] Réglages › Préférences : ligne « Extension Firefox », « Installer l'extension » vers le `.xpi` de la version de la SPA, mention « Pour Firefox », visible dans tous les navigateurs ; Paraglide FR/EN ; axe
- [ ] `docs/ops/install.md` : créer les clés AMO, poser `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET` et `vars.APP_ORIGIN` ; dans « Livrer une version », une ligne qui suggère la recette (spec §12) avant un tag qui change la lecture de LinkedIn ; `MIN_EXTENSION_VERSION` montée à la main dans la PR d'une étape « contract »
