# 24: Pièces jointes des Positionnements

**What to build:** l'Utilisateur joint des fichiers (un CV, par exemple) à un Positionnement et les télécharge depuis l'atelier et, plus tard, depuis le geste central. Sources : spec stack §6 (pièces jointes) ; spec UX §5.6, §6.1 ; ST-35.

**Blocked by:** 23

**Status:** ready-for-agent

- [ ] Interface de stockage du module `funnel` (`put`, `get`, `delete`), implémentée en `bytea` dans `attachment_blob` sous RLS
- [ ] 5 Mio par fichier, 100 Mio par Utilisateur, refus clairs ; tous types
- [ ] Téléchargement par une route sous `withUser`, en `Content-Disposition: attachment` avec `nosniff` ; accès croisé → 404 (test)
- [ ] Pièces jointes figées avec le Positionnement une fois utilisé ; supprimées avec un Positionnement jamais utilisé (et restaurées par « Annuler »)
