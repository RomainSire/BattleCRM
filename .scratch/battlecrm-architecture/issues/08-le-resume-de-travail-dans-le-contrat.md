# 08: Le résumé de travail et ses lignes modifiées sont décrits une seule fois, dans le contrat

**What to build:** aujourd'hui, la forme du résumé de travail (ADR 0012) et des lignes modifiées que renvoie un geste existe à trois endroits :
- elle est implicite dans la requête qui construit le résumé ;
- elle est recopiée à la main dans les tests de l'API ;
- elle est reconstruite dans les données de test de la SPA.

Le type des lignes modifiées, côté SPA, est même tiré de la réponse d'un endpoint précis, l'ajout d'un Contact. Ce ticket la décrit une seule fois, dans le paquet contrat, comme l'annonce son en-tête. Le résumé construit par l'API est vérifié contre cette description, et les tests de l'API s'appuient dessus. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 3) ; ADR 0012.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Le contrat décrit le résumé de travail (Contacts, Organisations, Étapes, Positionnements, Réglages, fuseau) et les lignes modifiées d'un geste
- [ ] Le résumé et les lignes modifiées que construit l'API sont vérifiés à la compilation contre cette description
- [ ] La copie à la main de cette forme dans les données de test de l'API est supprimée ; les tests de l'API valident les réponses contre le contrat
- [ ] Côté SPA, le type du résumé et celui des lignes modifiées viennent du contrat, et non plus de la réponse d'un endpoint
- [ ] Forme des réponses inchangée (compatible avec la version précédente de la SPA)
- [ ] `pnpm check` vert
