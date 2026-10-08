# 11: Double authentification

**What to build:** l'Utilisateur active la double authentification (TOTP) avec son mot de passe, reçoit 10 codes de secours, et doit ensuite donner un code à la connexion et à la réinitialisation du mot de passe ; il voit combien de codes il lui reste, les régénère et peut désactiver la 2FA. Sources : spec UX §5.9 ; spec stack §7 ; ST-18, ST-20, ST-60.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Plugin `twoFactor` : activation avec mot de passe, QR code et clé copiable, code de confirmation
- [ ] 10 codes de secours affichés une fois (Copier, Télécharger, case « J'ai mis mes codes en lieu sûr ») ; nombre restant par une route maison, mention à 3 ou moins ; régénération avec mot de passe
- [ ] Connexion en deux temps ; codes TOTP et de secours dans les compteurs de `login_attempt`
- [ ] Réinitialisation du mot de passe : code 2FA exigé quand elle est active
- [ ] Désactivation avec mot de passe ; e-mails `two_factor_enabled` et `two_factor_disabled`
