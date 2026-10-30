# Fixtures de test du scraping

Type: grilling
Status: open
Blocked by: 09

## Question

Comment tester la lecture de LinkedIn dans la CI et `pnpm check`, alors que les pages réelles restent dans `.private/linkedin/` et ne sortent jamais de là ?

- **Fixtures synthétiques** minimales (structure seule, noms inventés) dérivées des vraies pages : qui les écrit, comment on vérifie qu'elles restent fidèles aux vraies, où elles vivent dans `apps/extension`.
- **Tests locaux sur les vraies pages** : un second jeu qui ne tourne que si `.private/linkedin/` existe (sauté sinon), pour attraper l'écart entre fixtures et réalité ?
- **Ce que les fixtures doivent reproduire** : ce qu'utilise la lecture retenue par [Quand LinkedIn change son DOM](09-quand-linkedin-change-son-dom.md) (clés `componentkey` avec le slug, ligne « - aujourd’hui », `role="listitem"`, titre de la page, ou repères de contenu), plus les cas limites de [Ce que l'extension lit sur LinkedIn](04-ce-que-l-extension-scrape.md) (slug différent de l'URL, pas d'expérience en cours, école, « Coordonnées » ouverte ou non).
- Elles tournent dans l'instance Firefox du projet Vitest `extension` ([Stack de l'extension](05-stack-de-l-extension.md)).
