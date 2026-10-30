# Livraison de l'extension

Type: grilling
Status: open
Blocked by:

## Question

Comment l'extension est-elle signée, numérotée, livrée et mise à jour, dans la livraison par tag (ADR 0013) ?

Faits déjà relevés dans [Outillage d'une extension Firefox MV3 en 2026](02-stack-extension-firefox.md) (research §4) : `web-ext sign --channel unlisted`, clés `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET`, attente d'approbation de 15 min par défaut ; AMO refuse à jamais une version déjà envoyée ; version de 1 à 4 nombres, sans suffixe ; WXT ramène `0.8.0-rc.1` à `0.8.0` ; `update_url` vers un `updates.json` en HTTPS, vérifié toutes les 24 h.

- **Numéro de version** : même numéro que l'app (spec stack §9). Que faire d'une préversion `-rc.N`, et d'une release qui ne touche pas l'extension (signer quand même une nouvelle version, ou non) ?
- **Relivrer un tag** (`workflow_dispatch` de `release.yml`) : sauter la signature, réutiliser le `.xpi` déjà signé de la release ?
- **Échec ou lenteur de la signature** : bloque-t-elle la livraison de l'app, ou part-elle à côté ?
- **Hébergement de `updates.json` et du `.xpi`** : (a) servis par l'app (nginx de `web`, origine déjà fixée et en HTTPS), ou (b) GitHub Releases (redirection vers `objects.githubusercontent.com` non vérifiée).
- **Où l'Utilisateur récupère le `.xpi`** la première fois : page Réglages de l'app, lien de release, autre ?
- **`MIN_EXTENSION_VERSION`** et le `426` : quand et comment on la monte.
- **Secrets**, et où la recette suggérée de [Quand LinkedIn change son DOM](09-quand-linkedin-change-son-dom.md) est proposée (jamais obligatoire : règle de Romain, rien d'obligatoire, mais on suggère).
