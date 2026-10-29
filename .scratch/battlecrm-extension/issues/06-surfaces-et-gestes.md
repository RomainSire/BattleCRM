# Où vit l'interface et ce qu'elle montre

Type: prototype
Status: open
Blocked by: 01

## Question

Avec un prototype jetable que Romain manipule dans Firefox :

- **Profil** : quelle surface, entre popup, sidebar, fenêtre détachée et panneau injecté ? Comment l'Utilisateur voit-il, sans rien ouvrir, que la personne est déjà un Contact (badge de l'icône, élément dans la page) ? Que montre-t-on d'un Contact existant (nom, Organisation, État, Étape, ★ Allié, « Ouvrir sa fiche ») ?
- **Recherche** : la pastille de présence montre-t-elle seulement « déjà un Contact », ou aussi son État ou son Étape ? Que fait un clic dessus ? Quel aspect sur LinkedIn (logo, couleurs du thème, lisibilité clair et sombre) ?
- **Connexion** : mot de passe puis 2FA dans la surface choisie, session expirée, extension trop ancienne (`426`), API injoignable.

Lien du prototype à consigner dans ce ticket.

À vérifier dans le prototype (points ouverts de [research/01](../research/01-surfaces-ui-firefox-mv3.md)) :

1. `sidebarAction.toggle()` garde-t-il le geste quand le clic réveille une event page endormie ?
2. Le document de la sidebar survit-il au changement d'onglet, avec et sans la nouvelle sidebar ?
3. Sous Wayland (Fedora) : la position d'une fenêtre détachée est-elle respectée, et passe-t-elle derrière au clic dans LinkedIn ?
4. La CSP réelle de LinkedIn quand on est connecté ; un `<style>` dans un shadow root est-il bloqué ?
5. Le badge par onglet survit-il au `pushState` et s'efface-t-il au rechargement ?
6. `openPopup()` sans geste, déclenché par un message du content script, s'ouvre-t-il (Fx ≥ 149) ?
