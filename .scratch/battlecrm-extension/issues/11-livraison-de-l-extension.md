# Livraison de l'extension

Type: grilling
Status: resolved
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

## Answer

Décidé avec Romain le 2026-10-30, dans la livraison par tag de l'ADR 0013. Faits relevés dans le dépôt : `release.yml` n'accepte que `vX.Y.Z` (aucune préversion `-rc.N` n'existe) ; la relivraison (`workflow_dispatch`) saute déjà la construction des images ; l'image `web` est générique (`APP_HOST` lu au démarrage) ; les domaines sont publics (`docs/ops/install.md`).

1. **Numéro** : une version de l'extension **signée à chaque tag**, même sans changement de son code, toujours au numéro de l'app. Firefox l'installe sans bruit (vérification toutes les 24 h).
2. **Hébergement** : le `.xpi` signé et `updates.json` sont **copiés dans l'image `web`** et servis par nginx sous `/extension/` (`battlecrm-<version>.xpi`, un seul par image ; `updates.json` le désigne, `update_url` pointe dessus). Le `.xpi` est aussi joint à la GitHub Release, comme archive. Un retour arrière sert l'ancien `updates.json` ; Firefox ne rétrograde pas : l'extension reste en N face à l'API en N-1, le temps du retour arrière (accepté).
3. **Origine** : passée au build par `vars.APP_ORIGIN` (variable GitHub, pas un secret, le domaine est public), `http://localhost` en dev. Rien en dur dans le code.
4. **Job `extension`** dans `release.yml`, avant `images` : build `wxt build -b firefox`, puis signature `web-ext sign --channel unlisted`, `--approval-timeout` 30 min, `timeout-minutes: 40`. **Son échec bloque la livraison** : rien n'est déployé, l'app en place continue.
5. **Relance** : avant de signer, le job demande à l'API d'AMO si la version existe déjà ; si oui, il télécharge le fichier signé, sinon il signe. « Re-run failed jobs » marche donc toujours. La relivraison d'un tag ne signe rien : elle réutilise l'image `web` du tag, `.xpi` compris.
6. **Première installation** : Réglages › Préférences, ligne « Extension Firefox » avec « Installer l'extension » vers `/extension/battlecrm-<version>.xpi` (la SPA connaît sa version), visible dans tous les navigateurs avec la mention « Pour Firefox ». Firefox demande d'autoriser le site, puis les permissions ; ensuite `updates.json` prend le relais.
7. **`MIN_EXTENSION_VERSION`** : démarre à la première version qui contient l'extension ; montée à la main, dans la PR même d'une étape « contract » qui retire ce dont l'extension se sert (règle du §9 de la spec stack). Au `426`, la sidebar affiche « Mettez l'extension à jour : about:addons → Rechercher des mises à jour ».
8. **Secrets** : `WEB_EXT_API_KEY` et `WEB_EXT_API_SECRET` (clés d'API du compte AMO de Romain) en secrets du dépôt, à côté des `DEPLOY_*`. La procédure (créer les clés sur AMO, les poser dans GitHub, poser `vars.APP_ORIGIN`) va dans `docs/ops/install.md`. `browser_specific_settings.gecko.id` fixé une fois pour toutes dans le code, sous la forme `battlecrm@<domaine>`. La première version envoyée crée le module sur AMO, sans démarche à la main.
9. **Recette suggérée** (jamais obligatoire) : écrite dans la spec ; une ligne dans « Livrer une version » de `docs/ops/install.md` la conseille avant le tag si la lecture de LinkedIn a changé. Rien dans le workflow ni dans les notes de release.

## Comments

- 2026-10-30 : résolu avec Romain en deux tours, toutes les recommandations acceptées. Aucun terme nouveau pour `CONTEXT.md`, pas d'ADR (rien de difficile à défaire). Pas de commit (Romain commite).
