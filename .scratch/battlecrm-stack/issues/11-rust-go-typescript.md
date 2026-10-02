# Rust, Go et TypeScript au banc d'essai

Type: research
Status: resolved
Blocked by:

## Question

Entre **TypeScript** (Hono, NestJS ou AdonisJS), **Rust** et **Go**, lequel sert le mieux BattleCRM au regard des critères de la carte, en approfondissant ce que « Candidats backend » n'a fait qu'effleurer ? C# / .NET est écarté (préférence de Romain).

À couvrir :
- **La thèse du compilateur strict** : un langage et un compilateur très stricts (Rust : propriété, `Result`, exhaustivité ; Go : simplicité, mais `nil` et erreurs ignorables ; TypeScript : `strict`, mais `any` et un typage effacé à l'exécution) poussent-ils les agents à produire moins de bugs ? Chercher des sources primaires (études, retours d'expérience datés et sourcés) et distinguer ce qui est mesuré de ce qui est répété. Ce que coûte la contrepartie : boucles de compilation, erreurs du vérificateur d'emprunts, temps des agents.
- **Rust** : framework (Axum, Actix Web, Loco, autres), maturité et rythme des ruptures (Axum encore en 0.x ?), accès aux données (sqlx, SeaORM, Diesel), validation, i18n, e-mail ; briques d'auth (axum-login, tower-sessions, totp-rs, argon2…) ; temps de compilation en local et en CI (cache), taille d'image. **Mesurer** mémoire et latence comme l'a fait « Candidats backend » (même route, même méthode) pour comparer.
- **Go** : framework ou bibliothèque standard, sqlc ou autre, briques d'auth existantes.
- **TypeScript** : Hono, NestJS et AdonisJS comparés entre eux (conventions, cérémonie, ce que chacun fournit, exécution TS native de Node, pérennité).
- **Écrire soi-même ou dépendre** : une dépendance en moins n'est pas forcément un défaut. Pour l'auth (ST-10 à ST-23), comparer le risque d'une bibliothèque (historique d'avis de sécurité de Better Auth, rachat, rythme des mises à jour) au risque du code écrit à la main à partir de primitives éprouvées ; estimer la quantité de code à écrire dans chaque langage.
- **Partage de types** avec le front TypeScript et l'extension : génération depuis OpenAPI (Rust : utoipa, aide ; Go : outils équivalents) contre types natifs en TypeScript ; coût en CI.

Livrable : `.scratch/battlecrm-stack/research/11-rust-go-typescript.md`, avec sources primaires, mesures et un classement argumenté.

## Comments

- Recherche disponible sur la branche `research/11-rust-go-typescript`, fichier `.scratch/battlecrm-stack/research/11-rust-go-typescript.md` (`git show research/11-rust-go-typescript:.scratch/battlecrm-stack/research/11-rust-go-typescript.md`).

## Answer

Détail, mesures et sources : la recherche ci-dessus. Faits établis, sur lesquels s'appuiera « Forme de l'app et langages » :

- **1er : TypeScript + Node LTS + Hono**, Zod, Better Auth réduit au minimum. Il gagne par **moins de code de sécurité à écrire** (environ 0,6 à 1 k lignes d'auth contre 2 à 3 k en Go ou Rust, estimation) et des **types partagés sans génération** avec le front et l'extension, pas par la rigueur de son compilateur. **Prix : une veille de sécurité lourde** (43 avis sur Hono en 2026, presque tous hors des parties utilisées ; 27 sur Better Auth) ; parade : liste blanche de middlewares, Renovate hebdomadaire.
- **2e : Go** (bibliothèque standard, sqlc, pgx, scs) : la pile la plus calme à entretenir (compilation à froid ~30 s sur 2 vCPU). Garanties les plus faibles (`nil`, erreurs ignorables : linters à ajouter), auth entièrement à écrire, types TS à générer depuis OpenAPI.
- **3e : Rust** (Axum, sqlx) : le meilleur compilateur, le plus léger (< 2 Mio). Mais Axum en 0.x avec une 0.9 à 4 ruptures déjà sur `main`, axum-login et le stockage de sessions Postgres en retard sur sqlx 0.9 et tower-sessions 0.15 ; compilation à froid ~2 min et 2,4 Go de cache.
- **« Compilateur strict = moins de bugs d'agents » : non démontré.** Mesuré : les erreurs sortent à la compilation au lieu d'échouer en silence ; aucune étude ne mesure les bugs livrés par des agents selon le langage. Sur de vrais dépôts, le dépôt et le modèle pèsent plus que le langage (Multi-SWE-bench : Rust 15,9 %, Go 7,5 %, TS 2,2 %, ce qui corrige « Candidats backend » sur Rust). Pour un CRUD, l'écart utile est entre Go et TS `strict` (absence de valeur, `switch` exhaustif) ; les bugs métier et les fuites entre Utilisateurs (ST-23) échappent aux trois.
- **Mesures** (méthode de « Candidats backend ») : latence bien sous la milliseconde partout ; au repos Rust 1,3 Mio, Go 2 Mio, Node 30 Mio.
- **Frameworks TS** : Hono > AdonisJS > NestJS ; Hono seul sans étape de build (Node exécute son TS), les deux autres imposent une compilation par leurs décorateurs, AdonisJS a une auth incomplète.
- **Ce qui pourrait inverser l'ordre** : un spike où un agent écrit la même tranche d'auth dans les trois langages (lignes, tours de compilation, durée, bugs), seule mesure directe de la thèse.
