# Enregistrer des pages LinkedIn de référence

Type: task
Status: resolved
Blocked by:

## Question

Disposer de pages LinkedIn réelles, connecté, pour juger ce qui se scrape et pour servir de référence aux tests. Aucun agent ne peut les charger : Romain les enregistre.

Checklist (Firefox, « Enregistrer la page sous… » → **Page web, HTML seulement**, puis aussi **Page web complète** pour la première) dans `.private/linkedin/` :

- [x] `profil-esn.html` : un ingénieur d'affaires d'ESN, expérience en cours visible.
- [x] `profil-client.html` : une personne chez un client final.
- [x] `profil-sans-experience.html` : un profil pauvre (pas d'expérience, ou une école seulement).
- [x] `profil-hors-reseau.html` : un profil de 3e degré ou hors réseau (nom parfois masqué).
- [x] `recherche-personnes.html` : une page de résultats `/search/results/people/` avec au moins un Contact déjà dans BattleCRM.
- [x] `recherche-personnes-page2.html` : la page 2 de la même recherche, atteinte par la pagination (pas de rechargement).
- [x] Noter dans `.private/linkedin/README.md` : date, langue de l'interface LinkedIn, et pour chaque profil ce que **toi** tu lis à l'écran (nom, poste, Organisation) : c'est la vérité de référence.

Aucun contenu de ces pages ne quitte `.private/`.

### Compléments (relectures du 2026-10-30)

Les premiers enregistrements Firefox (« HTML seulement » comme « Page web complète ») ne contenaient que le haut du profil : ni sections Expérience et Formation (chargées au défilement), ni fenêtre « Coordonnées ». Complété par une copie du DOM depuis l'inspecteur :

- [x] Chaque profil, défilé jusqu'en bas : copie de l'inspecteur (`<profil>/inspecteur/inspector.html`).
- [x] Profil ESN et profil client, fenêtre « Coordonnées » ouverte.
- [x] Les deux pages de recherche : copie de l'inspecteur (`<recherche>/inspector.html`).

## Answer

Fait le 2026-10-30. Les pages sont dans `.private/linkedin/` (git-ignoré) ; le `README.md` de ce dossier liste chaque fichier et, pour chaque profil, la vérité de référence lue à l'écran (nom, poste, lieu, Organisation, formation, coordonnées). Interface LinkedIn en français.

Faits pour les tickets suivants (sans contenu des pages) :

- **Les fichiers de référence sont les copies de l'inspecteur** (`inspector*.html`) : ce sont les seuls qui contiennent le DOM vivant, celui que verra l'extension. Les enregistrements Firefox (« HTML seulement » et « Page web complète », identiques en contenu) ne contiennent que la page servie : le haut du profil et des données JSON, sans les sections chargées au défilement.
- **Profils** (4 : ESN, client final, sans expérience, hors réseau) : le haut du profil porte `componentkey` contenant `Topcard` ; la section Expérience porte `ExperienceTopLevelSection` et la Formation `Education`, comme dans le POC. Le haut du profil affiche le titre (headline), une ligne « Organisation · école » et le lieu. Le profil sans expérience n'a qu'une Formation ; le profil hors réseau affiche son nom en entier.
- **Coordonnées** : la fenêtre « Coordonnées » (`role="dialog"`) est dans le DOM quand elle est ouverte ; elle peut porter téléphone (avec son type, ex. « Mobile »), adresse, e-mail, anniversaire et date de connexion. Deux exemples : e-mail seul, et téléphone + e-mail. La fenêtre s'ouvre par une URL `…/overlay/contact-info/`.
- **URL de profil** : présentes sous deux formes dans une même page, accents bruts et encodés en pourcents (`/in/<slug-accentué>` et `/in/<slug-%C3%A9…>`), à couvrir par la normalisation.
- **Recherche** : 10 résultats par page, chacun dans un élément `componentkey="SearchResultssnippet_ACoAA…"` (l'identifiant interne du membre est dans la clé), avec un lien `/in/<slug>` lisible : aucune URL de résultat en `/in/ACoAA…`. La page 2 (atteinte par la pagination, `page=2`) a la même structure. Les deux pages sont des recherches « ingénieur d'affaires », tous les résultats au 2e degré.
- Le README ne dit pas quels résultats sont déjà des Contacts : sans importance pour le scraping, la présence vient de l'API.
