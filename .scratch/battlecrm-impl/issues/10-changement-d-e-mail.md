# 10: Changement d'e-mail

**What to build:** depuis Réglages › Compte, l'Utilisateur change son e-mail en redonnant son mot de passe ; le changement prend effet au clic sur un lien envoyé à la nouvelle adresse, et l'ancienne est prévenue. Sources : spec UX §5.9 ; spec stack §7 ; ADR 0010.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Parcours maison (le `/change-email` natif reste hors liste blanche) : mot de passe exigé, jeton à usage unique de 1 h, e-mails `email_change_confirm` (nouvelle adresse) et `email_change_notice` (ancienne, avec « Ce n'était pas moi »)
- [ ] Le clic sur le lien n'ouvre aucune session ; adresse déjà prise : réponse neutre
- [ ] Les e-mails suivants partent dans la langue de l'Utilisateur au moment de l'envoi, dates dans son fuseau
