# E-mails transactionnels traduits

Type: grilling
Status: resolved
Blocked by: 09

## Question

Comment les e-mails transactionnels (ST-11, ST-12) sont-ils écrits, traduits et envoyés par le SMTP Gmail de Romain ?

À trancher :
- Gabarits : outil (React Email, MJML, texte + HTML écrits à la main), version texte, traduction (les messages Paraglide partagés ou des gabarits par langue), langue de l'Utilisateur ou de la tentative d'inscription.
- Envoi : bibliothèque SMTP (Nodemailer…), mot de passe d'application en secret ; envoi direct dans la requête ou file d'attente en base reprise par le planificateur de l'API (relances en cas d'échec, sans retarder la réponse neutre de l'inscription ou du mot de passe oublié, qui ne doit pas trahir par son délai).
- Limites du SMTP Gmail (quota quotidien, délivrabilité, adresse d'expédition `romainsire.com` ou Gmail) et ce qui se passe quand elles sont atteintes.
- Liste à couvrir, venue de « [Auth : bibliothèque, sessions et client extension](08-auth.md) » : vérification, « Tu as déjà un compte », réinitialisation, changement d'e-mail (nouvelle et ancienne adresse), mot de passe changé, 2FA activée ou désactivée, nouvel appareil, récupération de la 2FA (alerte, rappel à J-1, fin), chacun avec « Ce n'était pas moi » quand l'UX le prévoit.

- Architecture tranchée (« [Architecture : où vivent les règles du domaine](09-architecture.md) ») : une file d'e-mails se brancherait sur le module `jobs` (tâches idempotentes inscrites par les modules) ; tout le code et les clés de gabarits en anglais.

## Answer

Tranché avec Romain le 2026-10-08. Faits vérifiés : `romainsire.com` reçoit son courrier chez Tuta (`v=spf1 include:spf.tutanota.de -all`, `DMARC p=quarantine; adkim=s`), donc un envoi par le SMTP de Gmail avec une adresse `@romainsire.com` échouerait au SPF et au DKIM aligné ; Tuta n'offre pas de SMTP. La V1 envoyait déjà par un Gmail (`smtp.gmail.com`, mot de passe d'application).

- **Expéditeur** : `SMTP_USER` (Gmail de Romain), nom « BattleCRM », sans `Reply-To` ; pied de page « Ne réponds pas à cet e-mail ». À revoir si l'app s'ouvre un jour au public. Quota Gmail (~500 destinataires/jour) sans objet à cette échelle.
- **Bibliothèque** : **Nodemailer** (catalog pnpm), `smtp.gmail.com:465` TLS ; `SMTP_USER`, `SMTP_PASSWORD` (mot de passe d'application), `EMAIL_FROM_NAME` dans `api.env`. Derrière une interface `EmailTransport` (une méthode `send`).
- **Module** : module d'infrastructure **`email`** dans l'API (comme `db` et `jobs`) : transport, gabarit HTML, échappement et tous les gabarits ; il expose `sendEmail(to, template, params)`, typé par gabarit. Seul `auth` l'appelle aujourd'hui.
- **Envoi direct, sans file** : l'envoi part **après le commit** du geste (un geste annulé n'envoie rien), **sans `await`** : la réponse neutre de l'inscription ou du mot de passe oublié ne dépend ni du délai ni du succès du SMTP. **Aucune reprise** : un échec est journalisé (gabarit, adresse masquée), l'Utilisateur garde « Renvoyer le lien » ou refait la demande ; un e-mail de sécurité perdu est un risque accepté.
- **E-mails planifiés** (récupération 2FA : rappel J-1, fin à J+7) : la tâche marque l'étape faite en base dans sa transaction (par exemple `reminder_sent_at`), puis envoie après le commit : au plus un envoi.
- **Arrêt** : au `SIGTERM`, l'API attend au plus ~5 s les envois en vol.
- **Gabarits** : écrits à la main en TS, chacun une fonction typée `(params, locale) → { subject, text, html }` ; un seul gabarit HTML minimal (tableau, styles en ligne, un bouton) ; version **texte obligatoire** ; échappement par un tagged template testé. Aucune dépendance de rendu (React Email et MJML écartés).
- **Traduction** : messages Paraglide de `packages/i18n`, clés `email_*`, appelés côté serveur avec une langue explicite ; une clé absente casse la compilation.
- **Langue et fuseau** : `verify_email` et `account_exists` dans la langue de la **tentative d'inscription** ; les autres dans la langue de l'Utilisateur **au moment de l'envoi** ; dates et heures dans son fuseau ; changement d'e-mail : les deux adresses dans la langue de l'Utilisateur.
- **Les 12 gabarits** : `verify_email`, `account_exists`, `password_reset_link`, `password_changed` (changement depuis Compte ou fin de réinitialisation, même texte), `email_change_confirm` (nouvelle adresse), `email_change_notice` (ancienne), `two_factor_enabled`, `two_factor_disabled`, `new_device`, `two_factor_recovery_started` (avec « Annuler »), `two_factor_recovery_reminder` (J-1), `two_factor_recovery_completed`. Liens construits sur `APP_HOST`. « Ce n'était pas moi » (vers la demande de réinitialisation) dans `password_changed`, `email_change_notice`, `two_factor_*` et `new_device`.
- **Dev** : le vrai Gmail, sans garde-fou ; comptes de test sur les alias `+n` de `SMTP_USER`.
- **Tests automatiques** : n'envoient **jamais** d'e-mail ; un faux `EmailTransport` les enregistre pour vérifier contenu et liens (repris par « [Stratégie de test](15-strategie-de-test.md) »).
- Pas d'ADR (envoi direct réversible), pas de nouveau terme dans `CONTEXT.md`.
