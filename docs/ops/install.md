# Installer BattleCRM sur le VPS

Une seule fois, à la main (spec stack §10 ; ADR 0013). Ensuite, chaque tag `v*` posé sur `main` livre tout seul (voir [Livrer une version](#livrer-une-version)). Les commandes se lancent en root sauf mention contraire. Les valeurs propres au VPS (hôte SSH, sous-réseaux, mots de passe, URL des moniteurs) ne vont jamais dans le dépôt ; les deux noms de domaine, eux, sont publics.

Prérequis de l'hôte : Docker avec le plugin Compose, Traefik sur le réseau externe `traefik-public` (entrypoint `websecure`, résolveur `letsencrypt`), `curl` et `flock`.

## 1. Retirer la V1 (spec stack §10.5)

Sans dump : la V1 était un POC.

```sh
cd /opt/docker/battlecrm && docker compose -f docker-compose.prod.yml down
docker volume rm battlecrm_pgdata
rm -rf /opt/docker/battlecrm
```

Retirer aussi l'ancienne clé de déploiement (son `authorized_keys`) et les anciens secrets du dépôt GitHub. Le volume doit vraiment disparaître : la V2 réutilise le nom `battlecrm_pgdata`.

## 2. DNS

`battlecrm.romainsire.com` et `app.battlecrm.romainsire.com` pointent sur le VPS (créer l'entrée de `app.` si elle manque). Pas de `www`.

## 3. Utilisateur de déploiement

```sh
useradd --create-home --shell /bin/sh battlecrm-deploy
usermod -aG docker battlecrm-deploy
install -d -m 750 -o battlecrm-deploy -g battlecrm-deploy /opt/docker/battlecrm
```

Le groupe `docker` vaut root sur l'hôte : la clé ne sert qu'à lancer `deploy.sh`, verrouillée par la commande forcée. Générer la paire sur un poste, sans phrase de passe, et n'installer sur le VPS que la publique :

```sh
ssh-keygen -t ed25519 -N '' -C battlecrm-deploy -f battlecrm-deploy
```

`/home/battlecrm-deploy/.ssh/authorized_keys` (`700` pour `.ssh`, `600` pour le fichier, propriétaire `battlecrm-deploy`) :

```
restrict,command="/opt/docker/battlecrm/deploy.sh" ssh-ed25519 AAAA… battlecrm-deploy
```

Si `sshd` filtre les comptes, y ajouter `battlecrm-deploy`, sinon la connexion est refusée quelle que soit la clé :

```sh
sshd -T | grep -iE '^(allowusers|allowgroups)'   # rien : pas de filtre
```

Une fois `deploy.sh` installé (étape 4), essayer la clé depuis le poste : sans tag valide, rien n'est livré, et la réponse attendue est `usage: deploy.sh vMAJOR.MINOR.PATCH (got '')`.

```sh
ssh -p <port> -i battlecrm-deploy -o IdentitiesOnly=yes battlecrm-deploy@<hôte>
```

## 4. Fichiers de `/opt/docker/battlecrm`

`deploy.sh` s'installe à la main et ne se remplace jamais tout seul (c'est lui qu'ouvre la clé) : depuis `main` la première fois, puis depuis le tag d'une release qui le modifie :

```sh
cd /opt/docker/battlecrm
curl -fsSLo deploy.sh https://raw.githubusercontent.com/RomainSire/BattleCRM/main/ops/prod/deploy.sh
chmod 755 deploy.sh
```

Le reste (`docker-compose.prod.yml`, `backup.sh`, `postgres/`) est déposé par `deploy.sh` à chaque livraison, depuis l'image de l'API du tag.

Les secrets, un fichier par service, d'après les `ops/prod/*.example` du dépôt, en `600`, propriétaire `battlecrm-deploy` (compose les lit sous cet utilisateur) :

| Fichier | Contenu |
|---|---|
| `.env` | `APP_HOST`, `SITE_HOST` (lus par compose) |
| `postgres.env` | superutilisateur, mots de passe des rôles propriétaire et applicatif |
| `migrate.env` | `MIGRATION_DATABASE_URL`, rôle propriétaire |
| `api.env` | `DATABASE_URL` (rôle applicatif), `TRUSTED_PROXIES`, `UPTIME_KUMA_PUSH_URL` (étape 6, facultatif) |
| `backup.env` | `BACKUP_PUSH_URL` (étape 6), entre guillemets simples : `backup.sh` charge ce fichier comme du shell |

Des mots de passe générés, par exemple `openssl rand -hex 32` (sans caractère à échapper dans une URL). `TRUSTED_PROXIES` est le sous-réseau de `traefik-public` :

```sh
docker network inspect traefik-public --format '{{(index .IPAM.Config 0).Subnet}}'
```

Les rôles sont créés au premier démarrage de Postgres, sur un volume vide : changer un mot de passe ensuite se fait par `ALTER ROLE`, plus par `postgres.env`.

## 5. GitHub

- Secrets du dépôt : `DEPLOY_SSH_KEY` (la clé privée), `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` (la sortie de `ssh-keyscan -t ed25519 <hôte>`, avec `-p <port>` si le port SSH n'est pas 22, vérifiée contre l'empreinte du VPS : `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) et, hors du port 22, `DEPLOY_PORT`. `DEPLOY_HOST` s'écrit exactement comme dans le `ssh-keyscan`.
- Les paquets `battlecrm-api` et `battlecrm-web` n'existent qu'après le premier push d'images. À la première release (2026-10-10), ils sont nés publics et le VPS les a tirés sans jeton. S'ils naissaient privés, la release échouerait au `pull` de `deploy.sh` (sans rien toucher) : les passer alors en public (Packages → Package settings → Change visibility), puis relancer la livraison : Actions → release → Run workflow, avec le même tag.

## 6. Sauvegardes et alertes (spec stack §11, §12)

Dans uptime-kuma, qui alerte par Pushover :

- un moniteur HTTP sur `https://app.battlecrm.romainsire.com/api/health` ;
- un moniteur push « BattleCRM API », intervalle de battement de 600 s et 0 nouvelle tentative : il alerte après 10 min sans ping (l'API envoie `up` toutes les 5 min, un ping raté est donc toléré) et dès qu'un `down` est poussé. L'enregistrer avant d'essayer son URL (sinon : `Monitor not found or not active`), puis pousser un `up` et un `down` à la main (`curl '<URL>?status=down&msg=test'`) : chacun doit notifier. Son URL, jusqu'au jeton (sans `?status=…`), va dans `api.env` (`UPTIME_KUMA_PUSH_URL`) et est lue au démarrage de l'API : à la livraison suivante, ou tout de suite en relivrant le tag en place (voir [Livrer une version](#livrer-une-version)). L'API y envoie `up` au démarrage puis toutes les 5 min, et `down` sur toute exception imprévue ou erreur du navigateur ;
- un moniteur push « BattleCRM sauvegardes », intervalle 25 h : son URL va dans `backup.env`.

Puis, dans la crontab de root (`crontab -e`) :

```
0 3 * * * /opt/docker/battlecrm/backup.sh
```

Après la première livraison, lancer `/opt/docker/battlecrm/backup.sh` une fois à la main, vérifier le ping dans uptime-kuma, puis [essayer la restauration](restore.md#vérifier-un-dump-sans-toucher-à-la-prod).

## Livrer une version

Sur `main` à jour, sans rien à commiter :

```sh
pnpm version minor   # ou patch, major : commit « 0.2.0 » et tag annoté v0.2.0
git push --follow-tags
```

Le workflow `release` refuse un tag hors de `main` ou différent de la version du `package.json`, rejoue la CI, pousse les images `0.2.0` et `sha-<court>`, lance `deploy.sh v0.2.0`, puis crée la GitHub Release.

`deploy.sh` passe les migrations (un échec arrête tout, l'API en place continue), redémarre, attend `/api/health`, et revient tout seul au tag de `deployed_tag` si quelque chose échoue. Pour revenir en arrière à la main : Actions → release → Run workflow, avec un tag déjà livré, ou, sur le VPS, `sudo -u battlecrm-deploy /opt/docker/battlecrm/deploy.sh v0.1.0` (sous cet utilisateur, qui possède le dossier, fermé aux autres comptes). Relivrer le tag en place sert aussi à faire relire un fichier de secrets modifié. Le retour arrière ne défait que les images : chaque migration reste compatible avec la version précédente (expand/contract).
