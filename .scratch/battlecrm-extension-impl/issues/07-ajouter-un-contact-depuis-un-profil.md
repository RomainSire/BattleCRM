# 07: Ajouter un Contact depuis un profil

**What to build:** sur le profil LinkedIn de quelqu'un qui n'est pas un Contact, la sidebar ouvre le formulaire d'ajout rapide, pré-rempli avec ce qui se lit sur la page (nom, poste, Organisation, e-mail et téléphone si « Coordonnées » est ouverte) et l'URL LinkedIn affichée, désactivée. L'Utilisateur corrige, choisit l'État (Vivier par défaut, En prospection à une Étape, ou Allié) et ajoute par `Entrée`. La sidebar passe alors à la carte du Contact, le badge à `✓`, l'élément de la page à l'État, avec « Ajouté au Vivier · Annuler ». Sources : [spec extension](../../battlecrm-extension/spec.md) §4, §6, §8, §13 (A9), §16 ; ST-95, ST-100, ST-103, ST-113, ST-114.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] `GET /contacts/linkedin-profile` pour un profil qui n'est pas un Contact : `organizations` (toutes, avec leur type) et `stages` (non archivées, dans l'ordre du Funnel)
- [ ] Lecture complète, « jamais de mauvaise valeur, plutôt vide » : poste de l'expérience en cours, sinon le headline ; Organisation du lien `/company/` de l'expérience en cours seulement, sans type de contrat, jamais l'école ; e-mail (`mailto:`) et téléphone sans son type seulement si « Coordonnées » est déjà ouverte ; tests Firefox sur les 5 profils de `expected.json` et le cas « expérience en cours retirée »
- [ ] Formulaire : tous les champs visibles, nom seul obligatoire, note jamais pré-remplie ; Organisation reprise si même nom après `normalizeName`, sinon nouvelle Organisation au nom pré-rempli avec type « ESN · Client final » obligatoire, sans présélection ; liste filtrée et « Aucune Organisation » comme dans la SPA ; État Vivier · En prospection · Allié (Vivier par défaut, jamais retenu), Étape par défaut la première non archivée ; `Entrée` ajoute, pas de `Ctrl Entrée`
- [ ] Ajout par `POST /contacts` tel quel (`newOrganization` compris) ; erreurs par `ErrorMessage` et `FieldErrorMessage`
- [ ] Après l'ajout : carte relue, badge `✓`, élément à jour ; ligne « Ajouté au Vivier · Annuler » (ou « Ajouté En prospection à <Étape> », « Ajouté au Cercle »), 10 s au moins, pause au survol et au focus ; « Annuler » (`POST /gestures/:id/undo`) ramène au formulaire rempli et remet le badge à `+`
- [ ] `linkedin_url_taken` (ajout depuis deux onglets) : la sidebar relit le profil et montre la carte du Contact existant
- [ ] Brouillon perdu au changement de profil ou d'onglet, sans confirmation
- [ ] Tests de la sidebar en Chromium (faux background) ; axe
