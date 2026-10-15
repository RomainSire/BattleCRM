# 08: Le résumé de travail et ses lignes modifiées sont décrits une seule fois, dans le contrat

**What to build:** aujourd'hui, la forme du résumé de travail (ADR 0012) et des lignes modifiées que renvoie un geste existe à trois endroits :
- elle est implicite dans la requête qui construit le résumé ;
- elle est recopiée à la main dans les tests de l'API ;
- elle est reconstruite dans les données de test de la SPA.

Le type des lignes modifiées, côté SPA, est même tiré de la réponse d'un endpoint précis, l'ajout d'un Contact. Ce ticket la décrit une seule fois, dans le paquet contrat, comme l'annonce son en-tête. Le résumé construit par l'API est vérifié contre cette description, et les tests de l'API s'appuient dessus. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 3) ; ADR 0012.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Le contrat décrit le résumé de travail (Contacts, Organisations, Étapes, Positionnements, Réglages, fuseau) et les lignes modifiées d'un geste
- [x] Le résumé et les lignes modifiées que construit l'API sont vérifiés à la compilation contre cette description
- [x] La copie à la main de cette forme dans les données de test de l'API est supprimée ; les tests de l'API valident les réponses contre le contrat
- [x] Côté SPA, le type du résumé et celui des lignes modifiées viennent du contrat, et non plus de la réponse d'un endpoint
- [x] Forme des réponses inchangée (compatible avec la version précédente de la SPA)
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Contrat** (`packages/contract/src/index.ts`) : les schémas zod du résumé y sont décrits une seule fois. Ce sont `summary`, `summaryContact`, `summaryStage`, `summaryOrganization`, `summaryPositioning`, `summarySettings` et `summaryChanges`, avec leurs types `z.infer`.
  - Ils sont stricts.
  - La langue vient des `locales` de `@battlecrm/i18n`. Le contrat dépend donc maintenant de `zod` et de `@battlecrm/i18n`.
  - Les nombres entiers sont décrits par `z.int()`.
- **API** : les fonctions de `views` qui construisent le résumé et les lignes modifiées, `settingsOf` et la route `/summary` ont pour type de retour celui du contrat. À la compilation, un champ manquant ou mal typé est refusé. Un champ en trop ne l'est pas, car TypeScript ne contrôle pas l'excès de propriétés sur des lignes construites. Les tests le refusent, parce que les schémas sont stricts.
- **Tests de l'API** : la copie à la main de `test/factories/contact.ts` est supprimée. `summaryOf`, `gestureAnswer` et `undone` valident contre le contrat. Les tests de l'atelier et des Étapes lisent le résumé entier par `summaryOf`, au lieu d'un extrait recopié.
- **SPA** (`apps/web/src/summary.ts`) : `Summary`, `SummaryContact`, `SummaryOrganization`, `SummaryPositioning` et `SummaryChanges` viennent du contrat. Ils ne sont plus tirés de `GET /summary` ni de `POST /contacts`.
- **Forme des réponses** : inchangée, seuls des types ont été ajoutés. Les données de test de la SPA restent pour le ticket 09.
