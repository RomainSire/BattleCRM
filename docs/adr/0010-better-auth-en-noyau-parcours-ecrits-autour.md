# Better Auth sert de noyau, les parcours sensibles sont écrits autour

Better Auth fournit les sessions en base, la connexion, la 2FA (TOTP et codes de secours) et le contrôle HIBP, mais seule une **liste blanche de chemins** atteint son handler ; tout autre endpoint natif répond 404. Les parcours où ses endpoints natifs ne tiennent pas l'UX ou la sécurité sont écrits dans nos propres routes : l'inscription en attente (le compte n'existe qu'au clic sur le lien, et chaque tentative porte son propre mot de passe, contre la prise de compte anticipée), la fin de la réinitialisation (code 2FA exigé, appareil connecté), le changement d'e-mail (le lien natif ouvre une session sans 2FA), la réauthentification à chaque action sensible, la détection d'un nouvel appareil, la récupération différée de la 2FA et la limitation par compte. Better Auth en entier aurait été moins de code, mais aurait laissé joignables des endpoints que nous n'utilisons pas, dans une bibliothèque qui compte 37 avis de sécurité ; tout écrire à la main aurait mis entre nos mains le hachage, les sessions et le TOTP.

## Consequences

- Un endpoint natif ne s'ouvre qu'en l'ajoutant à la liste blanche ; `/sign-up/email`, `/change-email` et `/reset-password` n'y sont pas.
- Le code d'auth vit dans un seul module, le seul à toucher les tables de Better Auth et les nôtres (`pending_signup`, `known_device`, `login_attempt`, `two_factor_recovery`), toutes hors RLS.
- À chaque montée de version de Better Auth, relire les changements des chemins de la liste blanche et des API internes que nos parcours appellent.
