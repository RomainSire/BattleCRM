# Rust, Go et TypeScript au banc d'essai

Type: research
Status: open
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
