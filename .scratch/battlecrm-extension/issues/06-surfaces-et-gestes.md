# Où vit l'interface et ce qu'elle montre

Type: prototype
Status: resolved
Blocked by: 01

## Question

Avec un prototype jetable que Romain manipule dans Firefox :

- **Profil** : quelle surface, entre popup, sidebar, fenêtre détachée et panneau injecté ? Comment l'Utilisateur voit-il, sans rien ouvrir, que la personne est déjà un Contact (badge de l'icône, élément dans la page) ? Que montre-t-on d'un Contact existant (nom, Organisation, État, Étape, ★ Allié, « Ouvrir sa fiche ») ?
- **Recherche** : la pastille de présence montre-t-elle seulement « déjà un Contact », ou aussi son État ou son Étape ? Que fait un clic dessus ? Quel aspect sur LinkedIn (logo, couleurs du thème, lisibilité clair et sombre) ?
- **Connexion** : mot de passe puis 2FA dans la surface choisie, session expirée, extension trop ancienne (`426`), API injoignable.

Lien du prototype à consigner dans ce ticket.

À vérifier dans le prototype (points ouverts de [research/01](../research/01-surfaces-ui-firefox-mv3.md)) :

1. `sidebarAction.toggle()` garde-t-il le geste quand le clic réveille une event page endormie ?
2. Le document de la sidebar survit-il au changement d'onglet, avec et sans la nouvelle sidebar ?
3. Sous Wayland (Fedora) : la position d'une fenêtre détachée est-elle respectée, et passe-t-elle derrière au clic dans LinkedIn ?
4. La CSP réelle de LinkedIn quand on est connecté ; un `<style>` dans un shadow root est-il bloqué ?
5. Le badge par onglet survit-il au `pushState` et s'efface-t-il au rechargement ?
6. `openPopup()` sans geste, déclenché par un message du content script, s'ouvre-t-il (Fx ≥ 149) ?

## Answer

Choisi par Romain le 2026-10-30 dans le prototype (branche `prototype/ext-06-surfaces-et-gestes`, `apps/extension-prototype/`), sur son Firefox 159 connecté à LinkedIn.

1. **Surface : la sidebar**, un seul panneau qui suit l'onglet actif. Le clic sur l'icône l'ouvre et la ferme (`sidebarAction.toggle()` appelé de façon synchrone dans `action.onClicked`, sans `default_popup`). Popup, fenêtre détachée et panneau injecté sont écartés. La surface choisie se lit au réveil sans attente (le prototype la garde dans le `localStorage` de l'event page).
2. **Présence sur un profil, des deux façons** : le badge de l'icône (`✓` déjà un Contact, `+` pas encore, `!` erreur de session ou d'API), recalculé par onglet après chaque `pushState`, et un élément dans la page **juste après le nom**. Cet élément montre le logo et l'État (comme la pastille) pour un Contact, « + Ajouter à BattleCRM » sinon, « BattleCRM : se connecter » sans session. Il ne fait qu'informer : seul le clic sur l'icône ouvre la sidebar (Firefox refuse de l'ouvrir depuis la page, voir le point 6).
3. **Contact existant : la carte complète** dans la sidebar : nom avec ★ pour un Allié, pastille d'État avec l'Étape pour un Contact En prospection, Organisation, poste, date de la dernière Interaction, bouton « Ouvrir sa fiche ↗ » (nouvel onglet de l'app). La date de la dernière Interaction est un champ de plus à renvoyer par l'endpoint de présence.
4. **Pastille sur la recherche : logo « B » et État** (avec ★ pour un Allié), seulement pour les Contacts existants, **en ligne juste après le nom**, avant le degré « · 2e ». Le nom est le lien `/in/` contenu dans la ligne du nom (un `p`), pas le premier lien `/in/` du résultat, qui entoure tout un bloc. Couleurs du thème mesurées sur la page (clair ou sombre).
5. **Clic sur la pastille : ouvrir sa fiche** dans l'app, dans un nouvel onglet.
6. **Connexion** dans la sidebar : e-mail et mot de passe, puis code à 6 chiffres ; « Ta session a expiré » avec l'e-mail déjà rempli ; écran « Extension à mettre à jour » sur `426` (Firefox met à jour seul, sinon menu Extensions › Rechercher des mises à jour ; lien vers les Réglages de l'app) ; « BattleCRM ne répond pas » avec « Réessayer ». Romain n'a rien demandé de changer sur ces écrans.

### Vérifications dans Firefox (journal du prototype)

1. `toggle()` garde le geste quand le clic réveille l'event page : **oui**, même 11 ms après le réveil.
2. Le document de la sidebar survit au changement d'onglet : **oui** (créé une fois, conservé à chaque changement).
3. Fenêtre détachée sous Wayland : sans objet (surface écartée).
4. CSP de LinkedIn : un `<style>` dans un shadow root est **appliqué**, aucune violation CSP relevée.
5. Badge : Firefox l'efface au rechargement ; un `pushState` garde l'ancien, recalculé par le content script. **Comme prévu.**
6. `openPopup()` sans geste : sans objet (popup écarté). L'ouverture de la sidebar par un clic sur l'élément de la page (message du content script vers `sidebarAction.open()`) : **refusée** par Firefox (essai de Romain le 2026-10-30), faute de geste dans le background. Romain s'en accommode : seule l'icône ouvre la sidebar.

### Ce que le prototype a révélé

- **Le nom n'était jamais lu**, et « Infos » parfois à sa place : la décision 1 de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) visait le mauvais bloc. Corrigée là-bas (titre de la page confirmé par un `h2`), revérifiée sur les quatre profils de référence.
- **Pastille en double ou absente** : deux lectures concurrentes de la recherche ajoutaient deux fois la même pastille, et l'élément du profil n'attendait pas que LinkedIn ait affiché le profil. La spec doit l'exiger : chaque résultat marqué avant la vérification par lot, et l'élément du profil posé seulement quand le nom du bon profil est affiché (10 s au plus).
- **Romain envisage une lecture par IA en secours** (« Lire la page (IA) » : le HTML envoyé à un modèle qui renvoie les champs), si LinkedIn change son DOM trop souvent. Pas décidé : versé dans « Pas encore spécifié » de la carte, avec la question de la détection des changements de DOM.

## Comments

- 2026-10-30 : prototype jetable sur la branche `prototype/ext-06-surfaces-et-gestes`, dossier `apps/extension-prototype/` (mode d'emploi dans son `README.md`). Extension sans build, données simulées : quatre surfaces (popup, sidebar, fenêtre détachée, panneau injecté), présence par badge ou dans la page, trois pastilles de recherche, connexion avec 2FA et les cas `401`, `426` et API injoignable, journal des six vérifications.
