# TypeScript de bout en bout

BattleCRM est un monorepo TypeScript géré par pnpm : une SPA React (Vite), une API Hono sur Node LTS et une landing page Astro statique, plus tard l'extension Firefox. Go et Rust ont été écartés pour le backend : ils obligent à écrire toute l'auth à la main et à générer les types du front depuis OpenAPI, alors que TypeScript partage les types sans génération et réduit le code de sécurité grâce à Better Auth. L'idée qu'un compilateur plus strict ferait écrire moins de bugs aux agents n'est pas démontrée. Le rendu serveur a été écarté pour l'app : il n'apporte rien derrière une connexion et gêne la coque hors ligne (ADR 0004).

## Considered Options

- Go (bibliothèque standard, sqlc, pgx) : la pile la plus calme à entretenir, et le repli si TypeScript déçoit.
- Rust (Axum, sqlx) : le meilleur compilateur, mais un écosystème web encore en 0.x.
- C# / .NET : écarté par préférence.

## Consequences

- Une veille de sécurité lourde (Hono, Better Auth, npm) : liste blanche de middlewares, Renovate, gardes de pnpm.
