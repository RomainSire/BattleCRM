# Parcours d'authentification

Type: grilling
Status: resolved
Blocked by: 

## Question

Comment se déroulent l'inscription, la connexion et le mot de passe oublié ?

À trancher :
- Inscription ouverte ou fermée selon la configuration (variable d'environnement, hors périmètre côté administration) : que voit-on sur l'écran de connexion quand elle est fermée ?
- Les champs demandés à l'inscription, et ce qui est pré-rempli ensuite (Funnel avec ses Étapes types, langue, fuseau pour l'Activité).
- La première arrivée sur « Aujourd'hui » (état vide « Aucun Contact pour l'instant », déjà tranché : pas d'assistant).
- Mot de passe oublié, déconnexion, durée de session, notamment une fois l'app installée sur l'écran d'accueil du téléphone.

## Answer

**Méthode.** E-mail et mot de passe, rien d'autre en V1 (ni lien magique, qui s'ouvre hors de l'app installée, ni fournisseur tiers). Les clés d'accès (passkeys) sont hors périmètre pour l'instant. Le mot « compte » (EN *account*) est réservé à l'accès de l'Utilisateur : écrans de connexion, « Créer un compte », section Compte des Réglages ; il reste interdit comme synonyme d'Utilisateur (glossaire précisé).

**Inscription.**
- **Fermée par la configuration** : le lien « Créer un compte » disparaît de l'écran de connexion ; une visite directe de la page d'inscription affiche « Les inscriptions sont fermées pour le moment. » avec un lien vers la connexion. Pas de liste d'attente.
- **Champs** : e-mail et mot de passe (bouton « Afficher », pas de champ de confirmation). Ni prénom, ni case CGU. La **langue** est préremplie depuis le navigateur et modifiable par un sélecteur discret présent sur tous les écrans d'authentification : elle fixe la langue des Étapes types, jamais traduites ensuite. Le **fuseau horaire** est détecté sans être demandé.
- **Mot de passe** : 15 caractères minimum, **aucune règle de composition** (elles produisent des `Motdepasse2026!` prévisibles ; NIST SP 800-63B rév. 4 les proscrit et fixe 15 caractères quand le mot de passe est le seul facteur). Espaces autorisés, au moins 64 caractères acceptés, coller toujours permis. Refus des mots de passe connus pour avoir fuité : « Ce mot de passe apparaît dans des fuites de données connues, choisis-en un autre. » Pas de jauge de force, pas d'expiration. Aide sous le champ : « 15 caractères minimum. Une phrase fait très bien l'affaire. »
- **Vérification bloquante de l'e-mail** : après l'envoi du formulaire, un écran « Vérifie ta boîte mail », identique que l'adresse soit libre ou déjà prise (dans ce second cas, le titulaire reçoit un e-mail « Tu as déjà un compte » avec les liens de connexion et de réinitialisation) : aucune énumération d'adresses, aucun compte créé sur l'adresse d'un autre ou sur une adresse mal tapée. Le lien est valable 24 heures et à usage unique ; l'écran propose « Renvoyer le lien » (avec un délai entre deux envois) et « Ce n'est pas la bonne adresse ? ». Le lien connecte l'appareil où on le clique, même si ce n'est pas celui de l'inscription. Une inscription jamais vérifiée est effacée au bout de 7 jours ; une inscription commencée avant la fermeture des inscriptions peut encore être vérifiée.
- **Première arrivée** : le clic sur le lien mène directement sur « Aujourd'hui », vide, sans assistant ni toast de bienvenue. Sont déjà en place : les Étapes types, l'Objectif d'activité à 1 activé, la Cadence par défaut.

**Connexion.**
- Erreur : un seul message, « E-mail ou mot de passe incorrect ».
- Après plusieurs échecs, ralentissement progressif puis blocage temporaire affiché tel quel : « Trop de tentatives. Réessaie dans 15 minutes, ou réinitialise ton mot de passe. » La réinitialisation reste toujours possible. Pas de CAPTCHA.
- **Session longue et glissante**, sans case « Rester connecté » : elle n'expire qu'après environ 90 jours d'inactivité, pour ne pratiquement jamais se reconnecter sur le téléphone.
- **Lien profond** sans session : après la connexion, on arrive sur la page demandée ; sinon sur « Aujourd'hui ».

**Mot de passe oublié.** Lien « Mot de passe oublié ? » sous la connexion, puis un champ e-mail et un message toujours neutre : « Si un compte existe pour cette adresse, un lien vient de partir. » Le lien est à usage unique et valable 1 heure ; il ouvre « Nouveau mot de passe » (mêmes règles). Si la double authentification est active, son code (ou un code de secours) est exigé. À la fin : connecté sur cet appareil, sur « Aujourd'hui » ; tous les autres appareils sont déconnectés ; un e-mail « Ton mot de passe a été changé » part.

**Double authentification.**
- **Facultative**, par application (TOTP), activable dans la section Compte ; une suggestion discrète y figure tant qu'elle est inactive, jamais de bandeau ailleurs.
- **Activation** : mot de passe redemandé, QR code avec la clé en clair copiable, code à 6 chiffres pour confirmer. Puis 10 codes de secours affichés **une seule fois** (« Copier », « Télécharger ») ; on ne termine qu'après avoir coché « J'ai mis mes codes de secours en lieu sûr ».
- **Connexion** : après le mot de passe, écran « Code de ton application » avec « Utiliser un code de secours ». Pas de « Faire confiance à cet appareil » : la session longue en tient lieu.
- Une mention apparaît dans la section Compte quand il reste 3 codes de secours ou moins ; on peut les régénérer.
- **Perte du second facteur et des codes** : récupération par e-mail avec un **délai de sécurité de 7 jours**, annulable pendant ce délai, avec des e-mails d'alerte. Perdre tout son Funnel pour un téléphone cassé serait disproportionné ; le délai annoncé et annulable empêche une prise de contrôle discrète.

**Section Compte** (Réglages ; sur mobile sous Plus › Compte). Toute action sensible redemande le mot de passe, même session ouverte.
- **E-mail** : le changement n'a lieu qu'au clic sur un lien envoyé à la nouvelle adresse ; l'ancienne reçoit un avertissement.
- **Mot de passe** : l'actuel est demandé ; le changement déconnecte les autres appareils.
- **Double authentification** : activer, désactiver (mot de passe et code demandés), régénérer les codes de secours.
- **Appareils connectés** : navigateur et système, dernière activité, « cet appareil » ; « Déconnecter » par ligne et « Déconnecter tous les autres » (téléphone perdu).
- **Se déconnecter** : cet appareil seulement, sans confirmation ; aussi dans la palette de commandes.

**E-mails de sécurité.** Changement du mot de passe, changement de l'e-mail (vers l'ancienne adresse), activation ou désactivation de la double authentification, connexion depuis un nouvel appareil (rare grâce aux sessions longues). Chacun porte un lien « Ce n'était pas moi » vers la réinitialisation. Rien d'autre (ni newsletter, ni récapitulatif). Ils sont rédigés dans la langue de l'Utilisateur, ou dans celle du sélecteur avant l'inscription.

**Données sur l'appareil.** À la déconnexion, et dès qu'un appareil déconnecté à distance se reconnecte, ses données locales (copie de consultation hors ligne) sont effacées. Cas résiduel accepté : un téléphone volé resté hors ligne garde sa copie, protégée par son verrouillage.

**Mobile.** Tous les écrans d'authentification fonctionnent aussi sur téléphone, inscription et activation de la double authentification comprises.

**Exigences pour la stack** :
- inscription ouverte ou fermée selon la configuration ;
- envoi d'e-mails transactionnels traduits ;
- détection des mots de passe fuités ;
- limitation des tentatives de connexion, par compte et par origine ;
- sessions longues et glissantes, listées et révocables une à une ;
- TOTP et codes de secours ;
- récupération du second facteur différée de 7 jours et annulable ;
- effacement des inscriptions non vérifiées au bout de 7 jours ;
- effacement des données locales à la déconnexion et à la révocation de la session.
