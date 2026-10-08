# 06: Inscription vérifiée

**What to build:** une personne s'inscrit avec un e-mail et un mot de passe, reçoit un lien de vérification dans sa langue, clique dessus et arrive connectée sur « Aujourd'hui » vide. Une adresse déjà prise donne la même réponse à l'écran et un e-mail « Tu as déjà un compte ». Inscriptions fermées par défaut. Sources : spec UX §5.9 ; spec stack §7, §8 ; ADR 0010 ; ST-10 à ST-14, ST-37 (la création des Étapes types arrive au ticket 14), ST-40.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Better Auth (≥ 1.7.7, adaptateur Drizzle, tables générées et migrées, hors RLS avec des `GRANT` limités) derrière une liste blanche de chemins dans Hono ; tout le reste répond 404 ; test d'instantané des routes de Better Auth
- [ ] Inscription maison : chaque tentative est une ligne `pending_signup` (e-mail, empreinte du mot de passe, langue, fuseau détecté par le navigateur, empreinte du jeton) ; compte créé seulement au clic (lien 24 h, usage unique), avec le mot de passe de cette tentative, qui ouvre une session (cookie `__Secure-`, HttpOnly, SameSite=Lax, 90 j glissants)
- [ ] À la création du compte : langue et fuseau écrits par le module `settings` (fuseau en valeur en vigueur `(user_id, effective_from, value)`) ; point d'extension « compte créé » pour les tranches suivantes
- [ ] Mots de passe 15 à 128 caractères, aucune autre règle ; HIBP en k-anonymat, injoignable = refus (faux HIBP en test) ; message de la spec UX §10
- [ ] `SIGNUPS_OPEN` (fermé par défaut), `GET /api/config` → `{ signupsOpen }` ; porte fermée : le lien « Créer un compte » disparaît, la page affiche « Les inscriptions sont fermées pour le moment. » ; une tentative commencée reste vérifiable
- [ ] Module `email` : interface `EmailTransport`, Nodemailer sur Gmail, gabarits `(params, locale) → { subject, text, html }` avec échappement testé ; `verify_email` et `account_exists` dans la langue de la tentative ; envoi après le commit sans `await`, échec journalisé (adresse masquée) et alerté ; faux transport en test
- [ ] Écran « Vérifie ta boîte mail » identique adresse libre ou prise ; « Renvoyer le lien » réémet un jeton pour la même tentative, avec délai
- [ ] Sélecteur de langue discret sur tous les écrans d'authentification, langue préremplie depuis le navigateur
- [ ] Purge des `pending_signup` non vérifiées à 7 jours, en tâche du module `jobs` si le ticket 05 est fait, sinon notée pour lui (ST-21)
- [ ] Garde de la SPA : sans session, toute page de l'app renvoie à l'authentification ; fabrique de test `makeUser()` (Utilisateur vérifié et son cookie)
