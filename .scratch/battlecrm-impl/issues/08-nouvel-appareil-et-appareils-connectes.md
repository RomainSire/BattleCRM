# 08: Nouvel appareil et appareils connectés

**What to build:** une connexion réussie depuis un appareil inconnu envoie un e-mail de sécurité ; dans Réglages › Compte, l'Utilisateur voit ses appareils connectés et peut en déconnecter un ou tous les autres. Sources : spec UX §5.9 ; spec stack §7 ; ST-16, ST-17.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Cookie d'appareil `__Host-`, aléatoire, longue durée, qui survit à la déconnexion ; empreinte dans `known_device`
- [ ] E-mail `new_device` (avec « Ce n'était pas moi ») à une connexion réussie sans cookie connu ; rien pour la première session du compte
- [ ] Section Compte de Réglages : appareils connectés (navigateur et système, dernière activité, appareil courant repéré), Déconnecter, Déconnecter tous les autres
- [ ] Un appareil dont la session a été révoquée reçoit 401 et efface ses données locales avant de proposer la reconnexion (ST-04)
