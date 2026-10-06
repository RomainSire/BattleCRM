# Relevé du VPS

Type: task
Status: resolved
Blocked by:

## Question

Quels faits du VPS contraignent le déploiement ? Ticket HITL : Romain lance la checklist sur le VPS et colle les sorties ici.

Checklist :
- [x] Ressources : `nproc`, `free -h`, `df -h /`, et l'offre exacte.
- [x] Charge actuelle : `docker stats --no-stream` (mémoire déjà prise par les autres apps).
- [x] Traefik : version (`docker ps --format '{{.Image}}' | grep -i traefik`), entrypoints, certresolver, middlewares communs (en-têtes de sécurité, limitation de débit).
- [x] Réseaux : `docker network ls`.
- [x] Watchtower : comment il est configuré (opt-in par label ou toutes les images, fréquence) ; la V1 l'avait désactivé (`com.centurylinklabs.watchtower.enable=false`).
- [x] Comment la V1 était déployée : fichier `deploy.yml` (SSH depuis Actions ?) et emplacement des `.env` sur le VPS.
- [x] Sauvegardes de l'hébergeur : ce qu'elles couvrent (disque entier, volumes Docker compris ?).

## Answer

Relevé du 2026-10-06 : sorties des commandes lancées par Romain sur le VPS, plus le dépôt de la V1. **Le relevé détaillé reste hors du dépôt** (`.private/releve-vps.md`, non versionné) ; n'en restent ici que les faits qui contraignent le déploiement.

- **Mémoire** : de la marge pour BattleCRM, mais **pas de swap** et d'autres apps sur la machine : chaque conteneur porte son `mem_limit`.
- **Traefik** v3, en `latest` : réseau externe `traefik-public`, entrypoint `websecure` (`web` redirige vers HTTPS), résolveur `letsencrypt`, fournisseur Docker en `exposedByDefault: false`. **Aucun middleware global** (ni en-têtes de sécurité, ni limitation de débit) : BattleCRM déclare les siens par labels, dans son propre compose.
- **Réseaux** : chaque app a son réseau interne (`battlecrm_internal`…) ; pas de base partagée.
- **Watchtower** : chaque nuit, il met à jour **tout** conteneur qui ne porte pas `com.centurylinklabs.watchtower.enable=false`. La V1 ne posait ce label que sur son frontend.
- **Déploiement de la V1** : à chaque push sur `main`, deux images `:latest` poussées sur GHCR, puis SSH depuis Actions et `docker compose -f docker-compose.prod.yml pull && up -d` dans `/opt/docker/battlecrm` ; le service `migrate` passe les migrations avant le backend.
- **Configuration** : `/opt/docker/<app>/.env` (droits 600) à côté de `docker-compose.prod.yml`.
- **Accès SSH d'Actions** : à refaire, avec un utilisateur dédié et une clé verrouillée par une commande forcée (voir [Déploiement](10-deploiement.md)).
- **Sauvegardes** : instantané hebdomadaire de la VM entière par l'hébergeur, volumes Docker compris, 2 à 3 semaines de rétention ; aucune sauvegarde de base programmée.
- **V1** : elle tourne encore. **Décision de Romain** : on la supprime et la V2 reprend `battlecrm.romainsire.com`.
