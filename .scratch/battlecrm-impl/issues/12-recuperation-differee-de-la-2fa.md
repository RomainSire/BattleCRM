# 12: Récupération différée de la 2FA

**What to build:** un Utilisateur qui a perdu son second facteur et ses codes demande une récupération par e-mail ; elle désactive la 2FA au bout de 7 jours, avec une alerte annulable et un rappel la veille. Une connexion avec un vrai code l'annule. Sources : spec UX §5.9 ; spec stack §7, §10.6 ; ST-19.

**Blocked by:** 11, 05

**Status:** ready-for-agent

- [ ] Table `two_factor_recovery` ; demande depuis l'écran de code 2FA ; e-mail `two_factor_recovery_started` avec « Annuler »
- [ ] Tâche planifiée : rappel `two_factor_recovery_reminder` à J-1, désactivation et `two_factor_recovery_completed` à J+7 ; étape marquée en base dans la transaction, envoi après le commit
- [ ] Une connexion avec un vrai code (TOTP ou secours) annule la récupération en cours
- [ ] Tests avec l'horloge pilotable : J-1, J+7, annulation
