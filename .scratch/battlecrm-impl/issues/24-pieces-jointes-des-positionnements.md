# 24: Pièces jointes des Positionnements

**What to build:** l'Utilisateur joint des fichiers (un CV, par exemple) à un Positionnement et les télécharge depuis l'atelier et, plus tard, depuis le geste central. Sources : spec stack §6 (pièces jointes) ; spec UX §5.6, §6.1 ; ST-35.

**Blocked by:** 23

**Status:** resolved

- [x] Interface de stockage du module `funnel` (`put`, `get`, `delete`), implémentée en `bytea` dans `attachment_blob` sous RLS
- [x] 5 Mio par fichier, 100 Mio par Utilisateur, refus clairs ; tous types
- [x] Téléchargement par une route sous `withUser`, en `Content-Disposition: attachment` avec `nosniff` ; accès croisé → 404 (test)
- [x] Pièces jointes figées avec le Positionnement une fois utilisé ; supprimées avec un Positionnement jamais utilisé (et restaurées par « Annuler »)

## Comments

**2026-10-15, implémentation (agent).**

- **API** (`funnel`) : `attachment-storage.ts`, l'interface `put` / `get` / `delete` et son implémentation `bytea` dans `attachment_blob` ; `attachments.ts`, les opérations (joindre dans la place restante, copier, retirer, rétablir, effacer, purger) ; métadonnées dans `positioning_attachment` (nom, type, taille, `added_at`, `removed_at`), sans clé étrangère vers le Positionnement, dont la suppression s'annule. Migrations `0026_positioning_attachments` et `0027_positioning_attachments_access` (RLS forcée), appliquées à la base de dev.
- **Routes** : `POST /positionings/:id/attachments` (multipart, champ `file` ; 413 `too_large` au-delà de 5 Mio, 409 `quota_exceeded` au-delà de 100 Mio), `POST /attachments/:id/remove`, `GET /attachments/:id` (`Content-Disposition: attachment` avec `filename*` UTF-8, `nosniff`, `Cache-Control: private, no-store`). Nom sans chemin ni caractère de contrôle ; type réduit à `type/sous-type`, sinon `application/octet-stream`. Accès croisé et routes sans session : tests générés étendus.
- **Annuler** : deux gestes (`positioning_attachment_added`, `positioning_attachment_removed`). Une pièce jointe retirée, seule ou avec son Positionnement supprimé, est gardée 15 min (`removed_at`) puis purgée, octets compris, au passage d'un geste suivant de l'atelier (même principe que `recordGesture`, faute de tâche planifiée sous RLS). Seules les non retirées comptent dans les 100 Mio.
- **Copie modifiée** : elle reprend les pièces jointes de l'original, en fichiers à elle (refusée, `quota_exceeded`, si elles ne tiennent pas). Ajouté à `CONTEXT.md` (Positionnement) ; _EN_ : *attachment*.
- **SPA** : sur la fiche, « Pièces jointes » (lien de téléchargement par nom, taille, « Retirer » avec Annuler), « Joindre un fichier » (refus local au-delà de 5 Mo) ; nombre de pièces jointes dans la lignée ; dans le panneau, note « reprises dans la copie » ou « à joindre depuis sa fiche une fois créé ». Figé : téléchargement seul.
- **Laissé au ticket 28** : le refus serveur `frozen` sur joindre / retirer (aujourd'hui aucun Positionnement n'est figé ; la SPA masque déjà les boutons) ; au ticket 25 / 28, le téléchargement depuis le geste central réutilise `GET /attachments/:id`.
- **À trancher** : une pièce jointe retirée reste en base jusqu'au prochain geste de l'atelier de l'Utilisateur (au plus tard, la suppression du compte) ; une tâche de purge demanderait un rôle hors RLS.
