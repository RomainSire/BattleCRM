# Carte : BattleCRM — Extension Firefox LinkedIn

Label: wayfinder:map

## Destination

Une **spec de l'extension Firefox** (`.scratch/battlecrm-extension/spec.md`, sur le modèle des specs [UX](../battlecrm-ux/spec.md) et [stack](../battlecrm-stack/spec.md)) : surfaces, gestes, microcopie, scraping, contrat d'API, stack, tests, distribution, avec ses exigences `ST-xx`. Elle doit être prête à découper en tickets d'implémentation. La carte décide et ne construit pas.

## Notes

- Besoin de Romain (2026-10-29) : depuis un **profil LinkedIn**, savoir si la personne est déjà un Contact, sinon l'**ajouter à la volée** ; sur une **recherche de personnes**, voir d'un coup d'œil qui est déjà un Contact.
- **POC V1** dans `../BattleCRM/apps/extension` (WXT + React + shadcn, Chrome + Firefox, badge ✓/+ sur l'icône, fenêtre popup, formulaire pré-rempli, pastilles sur la recherche, lots de 50, jeton maison). Il fonctionne : on s'en inspire pour les techniques (scraping par `componentkey` et structure, Navigation API + MutationObserver, vérification par lots), mais **tout est à remettre en question** (stack, style, gestes).
- Déjà fixé par la [spec stack §9](../battlecrm-stack/spec.md) et [research/18](../battlecrm-stack/research/18-extension-firefox-auth.md) : plugin `bearer` de Better Auth (même session que le cookie, mot de passe puis 2FA, « Extension Firefox » dans « Appareils connectés »), pas de CORS (appels depuis le background, les content scripts passent par lui), `moz-extension://` dans `trustedOrigins` et `csrf()`, endpoints « un par geste », `apps/extension` sur `contract`, `domain`, `i18n` et `hc<AppType>`, même version que l'app, `X-Client` et `426`.
- Acquis du cadrage (2026-10-29) :
  - **Firefox seul** ; distribution en `.xpi` **signé AMO non listé**, pour l'instance de Romain et un petit cercle.
  - **Une seule instance** : origine fixée au build (`host_permissions` sur ce domaine, plus `localhost` en dev), pas de champ URL à la connexion.
  - Fonctions : présence et ajout sur un profil, pastille de présence sur la recherche, connexion et déconnexion, réglages minimaux, « Ouvrir sa fiche » vers l'app.
  - Présence vérifiée par un **endpoint de lecture dédié**, léger et par lots, plutôt que par le chargement du résumé complet (ADR 0012).
  - Le formulaire d'ajout **part de l'ajout rapide de la SPA** (spec UX §6 : Vivier par défaut, En prospection à une Étape, ou Allié ; Organisation filtrée ou créée avec son type). La seule nouveauté est le pré-remplissage par scraping.
  - Les pages LinkedIn enregistrées vont dans **`.private/linkedin/`** (git-ignoré, pas d'anonymisation) : elles ne sortent jamais de là.
- Skills : `grilling` + `domain-modeling` par défaut, `prototype` et `research` pour les tickets de ces types. Vocabulaire strict de `CONTEXT.md` (Contact, jamais « prospect »).

## Decisions so far

<!-- une ligne par ticket résolu -->

- [Surfaces d'interface d'une extension Firefox MV3](issues/01-surfaces-ui-firefox-mv3.md) : seule la sidebar reste ouverte pendant le copier-coller, mais elle n'a pas de badge et s'ouvre seulement par un geste ; le popup se ferme au clic dans la page ; la fenêtre détachée passe derrière ; tout appel d'API passe par le background ; seule la host permission LinkedIn est nécessaire.
- [Outillage d'une extension Firefox MV3 en 2026](issues/02-stack-extension-firefox.md) : WXT 0.21 (seul outil vivant) construit avec Vite 8 et TS 7 ; background en event page ; DOM natif pour une pastille injectée (React + Tailwind en Shadow DOM : 72 kB et React Aria expérimental) ; scraping testable en Vitest mode navigateur dans Firefox, bout en bout seulement par Puppeteer et fragile ; signature `unlisted`, version jamais réutilisée et sans suffixe.

## Pas encore spécifié

- **Tests sans fixtures dans le repo** : les pages réelles restent dans `.private/`, donc ni la CI ni `pnpm check` ne les voient. Il faudra des fixtures synthétiques minimales (structure seule) dérivées des vraies, ou des tests de scraping seulement locaux. Le scraping se teste en Vitest mode navigateur dans Firefox (jsdom n'a pas `innerText`). Le bout en bout n'est possible que par Puppeteer, sans popup ni sidebar : faut-il en faire ?
- **Quand LinkedIn change son DOM** : comment on s'en aperçoit (erreur visible, champ vide, alerte) et ce que voit l'Utilisateur quand le scraping ou la pastille échouent.
- **Livraison** : intégrer la signature AMO à la livraison par tag (ADR 0013), avec les secrets, le numéro de version partagé avec l'app et la montée de `MIN_EXTENSION_VERSION`. AMO refuse à jamais une version déjà envoyée et tout suffixe (`-rc.1`) : comment cela s'accorde-t-il avec les versions de l'app ? Mises à jour automatiques par `update_url` ; et où l'Utilisateur récupère le `.xpi` (page Réglages ? lien de release ?).
- **Activation du plugin `bearer`** dans l'API et vérification dans un vrai Firefox des points 🔎 de research/18 : peut-être une tâche à part, peut-être une partie du contrat.
- **Rédiger la spec** (`spec.md` et ses `ST-xx`) une fois les décisions prises.

## Hors périmètre

- Chromium (Chrome, Edge, Brave) : Firefox seul pour cette carte.
- Publication listée sur addons.mozilla.org (relecture humaine, page publique, politique de confidentialité).
- Modifier un Contact depuis l'extension : « Ouvrir sa fiche » renvoie vers l'app.
- Gestes du Funnel depuis LinkedIn (utiliser un Positionnement, noter une Interaction, Prendre des nouvelles…) : futur chantier.
- Plusieurs instances (URL saisie à la connexion).
