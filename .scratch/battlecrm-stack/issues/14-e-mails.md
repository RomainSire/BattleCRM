# E-mails transactionnels traduits

Type: grilling
Status: open
Blocked by: 09

## Question

Comment les e-mails transactionnels (ST-11, ST-12) sont-ils écrits, traduits et envoyés par le SMTP Gmail de Romain ?

À trancher :
- Gabarits : outil (React Email, MJML, texte + HTML écrits à la main), version texte, traduction (les messages Paraglide partagés ou des gabarits par langue), langue de l'Utilisateur ou de la tentative d'inscription.
- Envoi : bibliothèque SMTP (Nodemailer…), mot de passe d'application en secret ; envoi direct dans la requête ou file d'attente en base reprise par le planificateur de l'API (relances en cas d'échec, sans retarder la réponse neutre de l'inscription ou du mot de passe oublié, qui ne doit pas trahir par son délai).
- Limites du SMTP Gmail (quota quotidien, délivrabilité, adresse d'expédition `romainsire.com` ou Gmail) et ce qui se passe quand elles sont atteintes.
- Liste à couvrir, venue de « [Auth : bibliothèque, sessions et client extension](08-auth.md) » : vérification, « Tu as déjà un compte », réinitialisation, changement d'e-mail (nouvelle et ancienne adresse), mot de passe changé, 2FA activée ou désactivée, nouvel appareil, récupération de la 2FA (alerte, rappel à J-1, fin), chacun avec « Ce n'était pas moi » quand l'UX le prévoit.

- Architecture tranchée (« [Architecture : où vivent les règles du domaine](09-architecture.md) ») : une file d'e-mails se brancherait sur le module `jobs` (tâches idempotentes inscrites par les modules) ; tout le code et les clés de gabarits en anglais.
