# Quand LinkedIn change son DOM

Type: grilling
Status: resolved
Blocked by:

## Question

Comment l'extension s'aperçoit-elle que LinkedIn a changé son DOM, et que voit l'Utilisateur quand la lecture d'un profil ou la pastille de la recherche échouent ?

- **Constat** : avec le prototype de la sidebar, le nom lu au mauvais endroit est passé inaperçu jusqu'à l'essai sur le vrai LinkedIn ([Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md), corrigé après [Où vit l'interface et ce qu'elle montre](06-surfaces-et-gestes.md)).
- **Stratégie de lecture** : garder les clés `componentkey` et la structure, ou lire par repères de contenu (titre de la page, texte « - aujourd’hui », liens `/company/`, `mailto:`), ou les deux en cascade ?
- **Option de Romain** : un bouton « Lire la page (IA) » qui envoie le HTML à un modèle avec une clé d'API. À peser : coût, où vit la clé (extension, serveur ?), données de tiers envoyées à un fournisseur, latence, et ce que cela ajoute à la carte (hors périmètre ou non).
- **Ce que voit l'Utilisateur** : champ vide (le formulaire reste utilisable, « Relire la page »), message dans la sidebar, badge de l'icône, pastille absente sur la recherche. Où s'arrête le silence et où commence l'alerte ?
- **Comment Romain l'apprend** : journal dans la console, signalement vers l'API, rien de plus que les vérifications manuelles de chaque livraison ?

## Answer

Tranché avec Romain le 2026-10-30. Fait de départ : la présence (badge, carte, pastille) se décide sur l'URL normalisée, pas sur le DOM. Un changement de LinkedIn ne casse donc que le pré-remplissage, l'élément après le nom et le repérage des résultats de la recherche.

1. **Une seule lecture**, celle de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md), déjà mi-contenu (titre de la page, `h2`, « - aujourd’hui », `/company/`), mi-clés (`componentkey` du slug, Expérience). Pas de seconde lecture en cascade : on mise sur la détection, pas sur la redondance.
2. **« Lire la page (IA) » hors périmètre** : données personnelles de membres LinkedIn (non Contacts) envoyées à un fournisseur tiers, clé d'API à stocker, coût par appel, latence ; le formulaire reste utilisable à la main.
3. **Page illisible**, constatée au bout des 10 s déjà prévues :
   - profil : pas de nom lu (titre « Nom | LinkedIn » confirmé par un `h2`), ou aucune `componentkey` avec le slug ;
   - recherche de personnes : aucun `role="listitem"` porteur d'un lien `/in/`.
   Un poste, une Organisation ou des Coordonnées vides restent normaux et silencieux (règle « plutôt vide »).
4. **Pour Romain** : un `console.warn` explicite (« BattleCRM : profil illisible, LinkedIn a peut-être changé ») et la recette suggérée du point 8. Rien n'est envoyé à l'API.
5. **Profil illisible, dans la sidebar** :
   - Contact trouvé : la carte, normale, sans message ;
   - pas un Contact : après le « Relire la page » automatique, le formulaire quand même, URL LinkedIn pré-remplie (elle vient de l'URL), autres champs vides, pas de « Contacts du même nom » ; au-dessus, une alerte discrète, non bloquante : « BattleCRM n'a pas pu lire ce profil : LinkedIn a peut-être changé sa présentation. Remplissez les champs à la main. » « Relire la page » reste là.
6. **Élément après le nom** : pas posé si le `h2` du nom manque, rien d'autre dans la page. **Badge** inchangé (`✓` / `+` viennent de l'URL), pas d'état « illisible » ; `!` reste aux erreurs de session et d'API.
7. **Recherche illisible** : rien dans la page, badge inchangé ; la sidebar ouverte sur cette page dit « BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation. » Ailleurs que sur un profil (recherche lisible, autre page), la sidebar dit « Ouvrez un profil LinkedIn pour voir ou ajouter un Contact. »
8. **Recette suggérée, jamais obligatoire** (règle de Romain : rien d'obligatoire, mais on suggère de le faire), sur le vrai LinkedIn, écrite dans la spec et proposée après une livraison ou un changement du code de lecture : un profil avec expérience en cours lu en entier ; un profil sans expérience donne le nom seul ; une recherche montre ses pastilles ; « Coordonnées » ouverte, l'e-mail est lu.

## Comments

- 2026-10-30 : résolu en deux tours de questions avec Romain ; toutes les recommandations acceptées. Aucun terme nouveau pour `CONTEXT.md`, pas d'ADR.
- 2026-10-30 : **correction** du point 8 à la demande de Romain : pas de vérification manuelle obligatoire à chaque livraison. Les quatre points deviennent une recette suggérée. Même correction dans [Stack de l'extension](05-stack-de-l-extension.md) (décision 7).
