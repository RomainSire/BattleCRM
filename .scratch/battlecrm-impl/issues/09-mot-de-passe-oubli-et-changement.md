# 09: Mot de passe oublié et changement

**What to build:** l'Utilisateur réinitialise un mot de passe oublié par un lien d'une heure, ou change son mot de passe depuis Réglages › Compte en redonnant l'actuel ; dans les deux cas, ses autres appareils sont déconnectés et un e-mail part. Sources : spec UX §5.9 ; spec stack §7 ; ADR 0010 ; ST-12, ST-16, ST-20.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Mot de passe oublié : message toujours neutre (« Si un compte existe pour cette adresse, un lien vient de partir. »), e-mail `password_reset_link`, jeton à usage unique de 1 h
- [ ] Fin de réinitialisation maison (le `/reset-password` natif reste hors liste blanche) : nouveau mot de passe (HIBP), révocation de toutes les sessions, levée du blocage de `login_attempt`, connexion de l'appareil ; point d'insertion prévu pour le code 2FA (ticket 11)
- [ ] Réauthentification : le mot de passe accompagne chaque requête sensible, vérifié côté serveur, sans fenêtre ; mécanisme réutilisable par les tickets 10 et 11
- [ ] Changer le mot de passe : réauthentification, HIBP, révocation des autres sessions, e-mail `password_changed`
