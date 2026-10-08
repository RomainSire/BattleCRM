# 18: Page Organisation

**What to build:** une page légère par Organisation, avec ses Contacts ; l'Utilisateur la renomme, change son type (avec la fenêtre de conséquences sur la Cible), la fusionne avec une autre et la supprime quand elle n'a plus de Contact. Lecture seule sur mobile. Sources : spec UX §5.4 ; CONTEXT (Organisation, Cible) ; ST-30, ST-31.

**Blocked by:** 16

**Status:** ready-for-agent

- [ ] Page : nom, type, Contacts (Étape, État, prochaine action quand elle existe) ; accès par clic sur le nom ; fil d'Ariane « Contacts › … »
- [ ] Renommer (unicité normalisée) ; changer le type avec confirmation « 4 Contacts passent en Cible ESN. Les Essais déjà commencés gardent leur Cible. » (absente sans Contact)
- [ ] Fusionner avec… : l'Organisation qui reste, rattachement des Contacts, une transaction, même fenêtre
- [ ] Supprimer seulement sans Contact ; jamais de suppression automatique
- [ ] Gestes avec confirmation (spec UX §1) testés ; mobile en lecture seule
