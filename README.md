# Simulateur de dette publique française

Application web pédagogique pour explorer l'évolution de la dette publique française de **2027 à 2036**, à partir d'un point de départ estimé fin 2026.

Modifiez les hypothèses économiques et budgétaires pour comparer les trajectoires de dette, de solde public et de charge d'intérêts. **Il s'agit d'une projection d'hypothèses, pas d'une prévision économique.**

## Lancer en local en une commande

Depuis la racine du dépôt, avec Node.js :

```sh
node dev-server.js
```

Ouvrez **http://localhost:8080**.

Ou, avec Docker démarré et Docker Compose installé :

```sh
bash deploy.sh
```

Ouvrez **http://localhost:8098**.

## Fonctionnalités

- Curseurs pour la croissance, l'inflation, les taux d'emprunt et la productivité.
- Réglages des dépenses par poste, des recettes fiscales, des retraites, de l'emploi, du SMIC et du revenu universel.
- Scénarios préréglés, graphiques et tableau année par année.
- Explication de la méthode, de ses limites et des sources dans l'interface.
- Partage d'un scénario en copiant l'URL : les réglages sont encodés dans son fragment, après `#`.

L'application est écrite en HTML, CSS et JavaScript, sans framework ni dépendance à installer. Les calculs sont effectués dans le navigateur ; aucun serveur applicatif ni base de données n'est nécessaire.

## Démarrage local

Prérequis : une version récente de Node.js (22 ou supérieure recommandée) et un navigateur moderne.

Depuis la racine du dépôt :

```sh
node dev-server.js
```

Ouvrez **http://localhost:8080**. Le serveur recharge automatiquement la page lors des modifications et actualise les styles CSS sans rechargement complet.

Pour choisir un autre port :

```sh
node dev-server.js 3000
```

La variable d'environnement `PORT` est également prise en charge. Arrêtez le serveur avec `Ctrl+C`. Ce serveur est destiné au développement ; utilisez Nginx pour le déploiement.

## Tests

Le modèle est testé avec le lanceur intégré à Node.js, sans installation de paquets :

```sh
node --test tests/*.test.js
```

Les tests vérifient notamment le point de départ, l'horizon de projection, les identités comptables, la transmission des taux d'intérêt et les effets des leviers.

## Déploiement avec Docker

Prérequis : Docker démarré et Docker Compose disponible (`docker compose` ou `docker-compose`).

Depuis la racine du dépôt :

```sh
bash deploy.sh
```

Le script détecte la commande Compose disponible et recrée le conteneur en arrière-plan. L'application est accessible sur **http://localhost:8098**.

La configuration utilise l'image `nginx:alpine` et monte les fichiers de l'application en lecture seule. Aucune étape de compilation n'est nécessaire. Le port hôte se règle dans [docker-compose.yml](./docker-compose.yml).

Commandes utiles avec Compose v2 :

```sh
docker compose ps
docker compose logs -f dette
docker compose down
```

Avec l'ancienne commande Compose, remplacez `docker compose` par `docker-compose`.

## Déploiement sur Raspberry Pi

Le script [deploy-to-pi.sh](./deploy-to-pi.sh) lance les tests, synchronise les fichiers par `rsync`, puis exécute le déploiement Docker via SSH.

1. Sur la machine locale, disposez de Node.js, `rsync` et d'un client SSH.
2. Sur le Raspberry Pi, installez Docker, Docker Compose et `rsync`. Le compte SSH doit pouvoir exécuter Docker.
3. Adaptez `PI_USER`, `PI_HOST` et `PI_PATH` dans le script à votre installation.
4. Depuis la racine du dépôt, lancez :

   ```sh
   bash deploy-to-pi.sh
   ```

L'application sera disponible à l'adresse `http://<adresse-du-pi>:8098`.

**Attention :** la synchronisation utilise `rsync --delete`. Utilisez un répertoire distant dédié : les fichiers absents du dépôt local peuvent y être supprimés, sauf ceux protégés par les exclusions du script. Un échec des tests annule le déploiement.

## Organisation du projet

| Fichier | Rôle |
| --- | --- |
| [index.html](./index.html) | Structure de la page |
| [style.css](./style.css) | Présentation et mise en page |
| [model.js](./model.js) | Hypothèses et calculs, utilisables dans le navigateur et sous Node.js |
| [app.js](./app.js) | Curseurs, scénarios, affichage des résultats et partage par URL |
| [charts.js](./charts.js) | Tracé des graphiques |
| [sources.js](./sources.js) | Références, chiffres et usages dans le modèle |
| [tests/model.test.js](./tests/model.test.js) | Tests du modèle |
| [dev-server.js](./dev-server.js) | Serveur local avec rechargement automatique |
| [nginx.conf](./nginx.conf) | Service des fichiers statiques et revalidation du cache |
| [docker-compose.yml](./docker-compose.yml) | Configuration du conteneur Nginx |
| [deploy.sh](./deploy.sh) | Démarrage du déploiement Docker |
| [deploy-to-pi.sh](./deploy-to-pi.sh) | Tests, synchronisation et déploiement distant |

## Méthode et limites

Chaque année, la dette augmente du déficit : dépenses hors intérêts, plus intérêts, moins recettes. Le PIB évolue avec la croissance en volume et l'inflation ; les recettes suivent le PIB et les dépenses suivent les hypothèses choisies. Les montants du modèle sont exprimés en milliards d'euros, les taux et ratios en pourcentage.

Le modèle combine des références documentées dans [sources.js](./sources.js) et des hypothèses propres à l'application, détaillées dans la rubrique **Méthode et limites**. Le point de départ fin 2026 est estimé et le scénario tendanciel n'est pas une prévision officielle.

Le modèle ne représente notamment pas l'effet des économies ou des hausses d'impôts sur la croissance, la réaction des taux au niveau de dette, les titres indexés sur l'inflation, les cessions d'actifs ni les écarts entre déficit et variation de dette.
