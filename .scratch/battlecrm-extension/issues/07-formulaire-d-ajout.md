# Formulaire d'ajout depuis LinkedIn

Type: grilling
Status: resolved
Blocked by: 04, 06

## Question

En quoi l'ajout depuis LinkedIn s'écarte-t-il de l'ajout rapide de la SPA (spec UX §6) ?

- Champs visibles et champs pré-remplis ; ce que l'Utilisateur corrige.
- **Organisation lue sur LinkedIn** : rapprochement avec les Organisations existantes (normalisation de `packages/domain`), création à la volée et moment où l'on demande son type (ESN ou client final), cas « aucune Organisation ».
- État : Vivier par défaut, En prospection (avec l'Étape) ou Allié, comme l'ajout rapide ? `Entrée` et `Ctrl Entrée` ont-ils un sens ici ?
- Doublons : URL bloquante (ne devrait pas arriver, puisque la présence est connue avant) ; nom, e-mail, téléphone informatifs : l'extension a-t-elle les données pour le faire ? (D'après [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) : nom, poste et Organisation toujours tentés ; e-mail et téléphone seulement si « Coordonnées » était ouverte.)
- Après l'ajout : retour à l'état « déjà un Contact », « Annuler » (`undoToken`, ADR 0011) dans l'extension ?

## Answer

Tranché avec Romain le 2026-10-30. Le formulaire est l'ajout rapide de la SPA (spec UX §6.8), avec les écarts suivants.

1. **Champs** : tous visibles, sans « Plus de champs » : nom (seul obligatoire), poste, Organisation, e-mail, téléphone, note. Les valeurs lues sur la page sont pré-remplies et modifiables, sans marqueur ; un champ non lu reste vide. **URL LinkedIn** visible, pré-remplie avec l'URL normalisée du profil et **désactivée** : l'Utilisateur voit qu'elle part dans BattleCRM, sans pouvoir la changer. La note n'est jamais pré-remplie.
2. **Organisation lue** : choisie parmi les Organisations existantes si son nom est le même après `normalizeName` (casse, accents, espaces) ; sinon proposée comme **nouvelle Organisation**, nom pré-rempli. Aucun rapprochement approché (« Capgemini Engineering » ne devient pas « Capgemini »). L'Utilisateur peut effacer, choisir dans la liste filtrée ou « Aucune Organisation », comme dans la SPA. L'extension reçoit donc la liste des Organisations (nom, type).
3. **Type d'une nouvelle Organisation** : « ESN · Client final », sans présélection ; l'ajout est bloqué tant qu'il manque. Aucun indice tiré de LinkedIn.
4. **État** : commande **Vivier · En prospection · Allié**, Vivier par défaut, jamais retenue ; Étape pour En prospection, la première non archivée par défaut (liste des Étapes fournie par l'API). `Entrée` ajoute. **Pas de `Ctrl Entrée`** : les gestes du Funnel passent par « Ouvrir sa fiche ».
5. **Doublons** :
   - Pour un profil qui n'est pas un Contact, l'API renvoie les **Contacts du même nom** (`normalizeName`) : une ligne discrète « Même nom : Jean Dupont · Capgemini » avec « Ouvrir sa fiche », qui ne bloque pas l'ajout. C'est le cas d'un Contact ajouté dans l'app sans URL LinkedIn.
   - Pas de vérification sur l'e-mail ni le téléphone. Pas de « lier ce profil au Contact existant » (modifier un Contact est hors périmètre).
   - URL déjà prise malgré tout (`linkedin_taken`, ajout depuis deux onglets) : la sidebar montre la carte du Contact existant.
6. **« Relire la page »** : un bouton du formulaire relit le profil et ne remplit que les champs que l'Utilisateur n'a pas touchés (pour « Coordonnées » ouverte après coup). Lancé tout seul quand le nom n'a pas été lu (garde-fou du slug), en attendant que le bon profil soit affiché, 10 s au plus.
7. **Brouillon** : il appartient au profil et se perd au changement de profil ou d'onglet, sans confirmation ni mémoire.
8. **Après l'ajout** : la sidebar passe à la carte du Contact (celle d'un Contact existant, avec « Ouvrir sa fiche ») ; badge `✓` ; l'élément de la page montre l'État. Une ligne « Ajouté au Vivier · **Annuler** » (`undoToken`, ADR 0011), aussi longtemps que la notification de la SPA ; « Annuler » ramène au formulaire rempli et remet le badge à `+`.

Conséquences pour [Contrat d'API : présence et ajout](08-contrat-presence-et-ajout.md) : Organisations (nom, type) et Étapes non archivées à fournir à l'extension ; Contacts du même nom dans la réponse de présence d'un profil inconnu ; création d'Organisation dans le même geste (`newOrganization`, comme `POST /contacts` aujourd'hui) ; `undoToken` dans la réponse d'ajout.

## Comments

- 2026-10-30 : résolu en une séance de questions avec Romain ; seul écart à la recommandation, tous les champs visibles et l'URL LinkedIn affichée désactivée.
