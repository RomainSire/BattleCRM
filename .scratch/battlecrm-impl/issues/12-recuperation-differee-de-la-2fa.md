# 12: Récupération différée de la 2FA

**What to build:** un Utilisateur qui a perdu son second facteur et ses codes demande une récupération par e-mail ; elle désactive la 2FA au bout de 7 jours, avec une alerte annulable et un rappel la veille. Une connexion avec un vrai code l'annule. Sources : spec UX §5.9 ; spec stack §7, §10.6 ; ST-19.

**Blocked by:** 11, 05

**Status:** resolved

- [x] Table `two_factor_recovery` ; demande depuis l'écran de code 2FA ; e-mail `two_factor_recovery_started` avec « Annuler »
- [x] Tâche planifiée : rappel `two_factor_recovery_reminder` à J-1, désactivation et `two_factor_recovery_completed` à J+7 ; étape marquée en base dans la transaction, envoi après le commit
- [x] Une connexion avec un vrai code (TOTP ou secours) annule la récupération en cours
- [x] Tests avec l'horloge pilotable : J-1, J+7, annulation

## Comments

**2026-10-13, implémentation (agent).**

- **Table `two_factor_recovery`** (hors RLS, module `auth`) : une ligne par récupération en cours, au plus une par Utilisateur (`user_id` unique) ; `token_hash`, `reminder_token_hash`, `requested_at`, `due_at`, `reminded_at`. La ligne disparaît quand la récupération se termine, quelle qu'en soit la fin. **Migrations** `0009_two_factor_recovery` et `0010_two_factor_recovery_access` (`GRANT`), purement additives ; appliquées à la base de dev.
- **Demande** : `POST /api/two-factor-recovery`, sans corps ni session. La preuve est le cookie de défi laissé par le mot de passe (non expiré, selon notre horloge), sur un compte dont la 2FA est active ; sinon 401 `challenge_expired`. Réponse 200 `{ dueAt }` (J+7). Une demande répétée garde sa date et n'envoie rien de plus ; deux demandes simultanées écrivent une seule ligne (un seul `INSERT … ON CONFLICT`).
- **Annulation par lien** : `POST /api/two-factor-recovery/cancel` `{ token }`, public (204, ou 400 `invalid_link`). Le jeton voyage dans le fragment (`/cancel-two-factor-recovery#…`), seule son empreinte est en base. Le rappel porte un jeton à lui (l'empreinte du premier ne permet pas de refaire son lien) ; le lien du premier e-mail reste valable.
- **Ce qui annule aussi** : une connexion avec un vrai code (TOTP ou secours) ; **un nouveau mot de passe** (réinitialisation ou changement : c'est ce que l'e-mail demande à qui n'a rien demandé) ; la désactivation à la main (sinon une récupération oubliée éteindrait une 2FA réactivée plus tard). Les deux derniers ne sont pas dans la spec.
- **Tâche planifiée** `two-factor recovery deadlines` : à J+7, dans une transaction, la ligne est effacée, la ligne `two_factor` aussi, `user.two_factor_enabled` repasse à faux (ce que fait le `disable` du plugin), puis `two_factor_recovery_completed` part après le commit ; dans les dernières 24 h, `reminded_at` et l'empreinte du second jeton sont écrits dans la transaction, puis `two_factor_recovery_reminder` part. Un second passage ne trouve plus rien à faire ; un e-mail en échec n'est pas renvoyé (spec stack §8).
- **E-mails** : les trois gabarits, dans la langue de l'Utilisateur, la date dans son fuseau. Les deux premiers ont « Annuler la récupération » pour bouton et un lien « Choisir un nouveau mot de passe » ; le troisième a « Ce n'était pas moi » vers `/forgot-password` (qui ne demande plus de code).
- **SPA** : sur l'écran de code, « Je n'ai plus accès à mes codes » ouvre une explication (7 jours, e-mail, annulation) avant toute requête, puis « Demander la récupération » affiche la date ; défi expiré → retour au mot de passe avec le message existant. Écran `/cancel-two-factor-recovery` (ouvert avec ou sans session) : « Récupération annulée » et un lien vers un nouveau mot de passe, ou « Ce lien n'est plus valable ».
- **Libellés à valider** : « Je n'ai plus accès à mes codes », « Demander la récupération », « Revenir au code », « Récupération annulée », les deux paragraphes de l'écran de code, celui de l'annulation, et les textes des trois e-mails (`email_two_factor_recovery_*`, `auth_recovery_*`).
- **Tests voisins durcis** (ils échouaient une fois sur deux dans la suite complète dès qu'un fichier de tests s'y ajoutait) : la purge des inscriptions de `signup.test.ts` effaçait, sept jours plus tard à son horloge, les inscriptions en cours des autres tests (elle part maintenant de 2024) ; le test axe de `change-password.test.tsx` mesurait le bouton encore survolé (4,48:1, relevé au ticket 11) : il écarte le pointeur, comme ceux de la connexion.
- **Revue (deux axes), corrigé** :
  - **faille** : un nouveau mot de passe annulait la récupération mais laissait vivre le défi d'une connexion commencée avec l'ancien ; son porteur pouvait redemander la récupération dans les 10 minutes. Un nouveau mot de passe efface désormais les défis de l'Utilisateur (test) ;
  - la demande lisait la ligne existante dans une seconde requête : annulée entre les deux, elle envoyait un e-mail pour une récupération qui n'existait pas ;
  - le message d'erreur pouvait apparaître un instant avant le retour au mot de passe.
- **Revue, relevé et laissé, à trancher** :
  - **le point ouvert du ticket 11 reste ouvert** : un intrus qui a enrôlé son propre facteur annule en silence, d'une connexion avec son code, la récupération demandée par le vrai propriétaire. « Une connexion avec un vrai code annule » (spec stack §7) le veut ainsi ; en sortir demande une décision (prévenir par e-mail à l'annulation, par exemple) ;
  - les deux premiers e-mails n'ont pas le libellé « Ce n'était pas moi » (spec stack §8) : « Annuler la récupération » en tient lieu ;
  - « Annuler » agit au chargement de la page, comme le lien de vérification : un antivirus de messagerie qui exécute le JavaScript annulerait une récupération légitime (l'erreur va dans le sens sûr) ;
  - l'annulation par un vrai code, ou par la désactivation à la main, suit la réponse de Better Auth dans une requête à part : un passage de la tâche pile à J+7 dans cet intervalle éteindrait quand même la 2FA ;
  - si l'API est arrêtée pendant les dernières 24 h, la désactivation a lieu sans rappel ; une récupération échue redemandée avant le passage de la tâche (15 min au plus) affiche une date passée ; un Utilisateur sans réglages ferait échouer la tâche pour tous (elle alerte) ;
  - pas de terme au glossaire ; répétitions : les aides de `two-factor.test.ts` recopiées dans le nouveau fichier de tests, `pointerOff` dans trois fichiers de tests, `Owner` déclaré trois fois, l'écran de lien périmé proche de `InvalidLinkScreen` ;
  - pas de parcours e2e (ticket 45).
