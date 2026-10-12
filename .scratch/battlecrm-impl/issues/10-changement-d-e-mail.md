# 10: Changement d'e-mail

**What to build:** depuis Réglages › Compte, l'Utilisateur change son e-mail en redonnant son mot de passe ; le changement prend effet au clic sur un lien envoyé à la nouvelle adresse, et l'ancienne est prévenue. Sources : spec UX §5.9 ; spec stack §7 ; ADR 0010.

**Blocked by:** 09

**Status:** resolved

- [x] Parcours maison (le `/change-email` natif reste hors liste blanche) : mot de passe exigé, jeton à usage unique de 1 h, e-mails `email_change_confirm` (nouvelle adresse) et `email_change_notice` (ancienne, avec « Ce n'était pas moi »)
- [x] Le clic sur le lien n'ouvre aucune session ; adresse déjà prise : réponse neutre
- [x] Les e-mails suivants partent dans la langue de l'Utilisateur au moment de l'envoi, dates dans son fuseau

## Comments

**2026-10-12, implémentation (agent).**

- **Routes** (session exigée pour les deux) : `POST /api/account/email` (`{ password, email }` → 204 toujours ; 403 `wrong_password` ; 429 `too_many_attempts` ; 400 `invalid`), `POST /api/account/email/confirm` (`{ token }` → 200 `{ email }` ; 400 `invalid_link`). Aucune ne rejoint `PUBLIC_ROUTES` ; le `/change-email` natif reste hors liste blanche.
- **Aucune migration** : un changement en cours est une ligne de `verification`, identifiant `email-change:<SHA-256 du jeton>`, valeur `<id de l'Utilisateur> <nouvelle adresse>`. Jeton dans le fragment (`/change-email#<jeton>`), 1 h, usage unique.
- **Demande** (`auth/email-change.ts`, `request`) : réauthentification (ticket 09), puis une nouvelle demande remplace la précédente (sous verrou consultatif par Utilisateur). E-mail `email_change_confirm` à la nouvelle adresse, `email_change_notice` à l'actuelle, tous deux dans la langue de l'Utilisateur. **Adresse déjà prise** : même 204, la ligne est écrite, aucun lien ne part ; l'avertissement part quand même à l'adresse actuelle. **Même adresse que l'actuelle** : rien ne part ; la SPA le refuse avant l'envoi (« C'est déjà ton adresse. »).
- **L'avertissement part à la demande, pas à la prise d'effet** : tant que rien n'a changé, « Ce n'était pas moi » (`/forgot-password`) atteint encore le compte, et **un nouveau mot de passe annule le changement en cours** (`setPassword` appelle `cancelEmailChanges`, réinitialisation comme changement depuis Réglages, tests). Envoyé après coup, le lien n'aurait mené nulle part : l'ancienne adresse n'a plus de compte.
- **Clic** (`confirm`) : **exige une session du même compte** et n'en ouvre aucune (décision du wayfinder stack, issue 08). Lien supprimé et adresse écrite dans une transaction ; lien d'un autre compte, expiré, déjà utilisé, remplacé, ou adresse prise entre-temps : `invalid_link` (deux Utilisateurs qui cliquent ensemble pour la même adresse : un seul l'obtient, test). Les autres sessions ne sont pas révoquées (la spec ne le demande que pour le mot de passe).
- **E-mails suivants** : rien à écrire, ils lisent l'adresse, la langue et le fuseau au moment de l'envoi ; tests : `password_changed` et `new_device` (date dans le fuseau) partent à la nouvelle adresse, la réinitialisation ne connaît plus l'ancienne, qui redevient libre.
- **Purge** : la tâche `purge expired sessions and counters` efface aussi ces liens expirés ; `purgeExpiredLinks(prefix, now)` (`auth/purge.ts`) sert aux deux préfixes.
- **SPA** : « E-mail » en tête de Réglages › Compte (adresse actuelle, nouvelle adresse, mot de passe actuel, message « Un lien vient de partir à … »), et la route `/change-email` (dans la coque) : sans session, la connexion passe d'abord et ramène au lien ; réussite → Réglages, la nouvelle adresse en place, sans message ; lien invalide → « Ce lien n'est plus valable » et « Refaire la demande dans les Réglages ». `EmailField` prend un `label`.
- **Libellés à valider** : « Ton adresse : … », « Le changement prend effet quand tu cliques sur le lien envoyé à la nouvelle adresse. », « Nouvelle adresse e-mail », « Changer d'e-mail », « Un lien vient de partir à … », « C'est déjà ton adresse. », « Refaire la demande dans les Réglages », « Changement d'adresse… », et les textes des deux e-mails.
- **Revue (deux axes), corrigé** : `cancelEmailChanges` et `isTaken` (le module garde pour lui sa table et son préfixe), `linkRequest` pour les deux routes à jeton, verrou sur la demande, même adresse refusée dans la SPA, test d'une session terminée au moment du clic.
- **Revue, relevé et laissé, à trancher** :
  - un attaquant qui tient la session **et** le mot de passe peut cliquer son lien avant que le titulaire ne réagisse à l'avertissement : « Ce n'était pas moi » ne mène alors plus au compte. Aucun délai n'est prévu par la spec (contrairement à la récupération 2FA) ;
  - aucun e-mail à l'ancienne adresse quand le changement prend effet (12 gabarits, un seul avertissement) ;
  - aucune limite sur les demandes au-delà de la réauthentification : chacune envoie un e-mail à une adresse arbitraire depuis le Gmail expéditeur (un délai silencieux aurait avalé la correction d'une faute de frappe) ;
  - sans session, le lien profond porte le jeton dans `?redirect=` de la page de connexion (comportement du ticket 07 pour tout fragment) : un rechargement l'envoie au serveur web. Le jeton ne vaut rien sans une session du même compte ;
  - une inscription vérifiée sur la même adresse à l'instant exact du clic ferait un 500 (index unique), sans rien changer ni consommer ;
  - adresse prise : l'avertissement dit qu'un lien est parti alors qu'aucun n'est parti (prix de la réponse neutre) ;
  - forme répétée entre `change-email.tsx` et `change-password.tsx` (et leurs tests) : à factoriser si le ticket 11 en ajoute une troisième ; les écrans « lien invalide » restent un texte, comme aux tickets 06 et 09 ; pas de parcours e2e (même raison qu'aux tickets 07 à 09).
