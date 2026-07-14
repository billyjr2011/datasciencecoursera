# SYVIEF

**Système de Vérification d'Inventaire d'Exploitation Forestière** — plateforme de
contrôle des inventaires d'exploitation forestière. SYVIEF permet à un service de
vérification (administration, cabinet de certification, cellule qualité d'une société
forestière) d'auditer, unité de comptage par unité de comptage, un inventaire
d'exploitation : repérer les anomalies de comptage, tracer les décisions de contrôle,
visualiser la concession sur une carte GIS, et **scorer chaque UC via un réseau de
neurones** entraîné sur la signature des inventaires de sociétés certifiées.

Chaque **unité de comptage (UC) mesure 1000 m × 250 m, soit 25 ha** (layon d'inventaire
normalisé). L'application est amorcée avec un jeu de données réel extrait d'un rapport de
conformité : **4 blocs, 127 UC, 1 064 tiges irrégulières, 11 alertes d'isolement** sur une
concession de la **région Est** (zone UTM 33N, ~3,55–3,60 °N).

## Apprentissage automatique — conformité par région

SYVIEF apprend la **signature des inventaires conformes** des sociétés certifiées sur les
**quatre régions forestières du Cameroun** (Sud, Centre, Est, Littoral) au moyen d'un
**réseau de neurones (perceptron multicouche)** implémenté sans dépendance et entraîné par
rétropropagation du gradient. À partir des caractéristiques d'une UC (densité de tiges/ha,
DBH moyen, proportion de qualité OA, taux d'anomalie, taux de rétention, région…), le
modèle produit un **score de conformité** : *conforme*, *à surveiller* ou *atypique*.

Le pipeline complet est reproductible :

```bash
npm run reference   # (re)génère data/reference/ pour les 4 régions
npm run train       # entraîne le réseau → server/model.json (+ métriques)
```

> Les profils de référence fournis sont **synthétiques** (ordres de grandeur documentés des
> massifs camerounais). Pour un usage réel, remplacez `server/data/reference/` par les
> inventaires des sociétés certifiées et relancez `npm run train` — le reste du pipeline est
> inchangé.

## Architecture

Monorepo à deux applications (voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)) :

```
syvief/
├── server/          API REST — Node.js + Express + SQLite (node:sqlite intégré)
│   ├── schema.sql   Schéma relationnel (blocs, ucs, trees, alerts, verifications)
│   ├── data/        Jeu de données seed + data/reference/ (jeu des 4 régions)
│   ├── model.json   Réseau de neurones entraîné (poids + normalisation + métriques)
│   └── src/         db, seed, serveur, routes, train.js, ml/ (réseau, features, régions)
├── web/             Interface — React 18 + Vite + React Router
│   └── src/         pages (dont Modèle IA), composants, client API
└── docs/            Architecture et référence API
```

- **Backend sans dépendance native** : la persistance s'appuie sur `node:sqlite`
  (intégré à Node ≥ 22.5), donc aucune compilation. Seule dépendance runtime : Express.
- **Frontend découplé** : SPA React qui consomme l'API. En production, l'API sert
  directement le build (`web/dist`) — déploiement mono-conteneur possible.

## Démarrage rapide

Prérequis : **Node.js ≥ 22.5**.

```bash
cd syvief
npm install            # installe server + web (workspaces)
npm run seed           # crée et alimente server/syvief.db
npm run train          # entraîne le réseau de conformité → server/model.json
# (ou en une commande : npm run setup)
```

### Développement (deux processus)

```bash
npm run dev:api        # API sur http://localhost:4000
npm run dev:web        # interface sur http://localhost:5173 (proxy /api → 4000)
```

Ouvrir http://localhost:5173.

### Production (un processus)

```bash
npm run build          # compile web/dist
npm start              # sert l'API + l'interface sur http://localhost:4000
```

### Tests

```bash
npm test               # tests d'intégration de l'API (node:test)
```

## Version JSX autonome (mono-fichier)

[`SYVIEF.jsx`](SYVIEF.jsx) est une **version React à composant unique, sans backend** :
données d'inventaire, poids du réseau de neurones et carte GIS embarqués. Elle reproduit
toutes les vues de l'application (dont le workflow de vérification, persisté en
`localStorage`) et permet même de **réentraîner le réseau dans le navigateur**. Déposez-la
comme composant par défaut dans un projet React (Vite/CRA) ou prévisualisez-la telle quelle.

Le fichier est **généré** à partir des mêmes sources de données et du modèle entraîné :

```bash
npm run train                # (re)génère server/model.json
python3 tools/build-jsx.py   # assemble SYVIEF.jsx (données + modèle + code)
```

## Fonctionnalités

- **Aperçu** — indicateurs de campagne (taux d'anomalie, UC critiques, avancement
  des vérifications) et top des UC problématiques.
- **Unités de comptage** — table filtrable (bloc, sévérité, statut de contrôle,
  recherche) ; le détail d'une UC ouvre un volet avec ses tiges irrégulières,
  ses alertes et le **workflow de vérification** (à vérifier → en cours → validé /
  rejeté) avec historique horodaté des décisions.
- **Blocs & assiettes** — synthèse de conformité par bloc d'exploitation.
- **Espèces** — répartition des tiges relevées par essence.
- **Diamètres (DBH)** — histogramme des classes de diamètre.
- **Alertes** — tiges isolées à distance anormale de leurs congénères.
- **Modèle IA** — métriques du réseau, profils des 4 régions de référence, analyse de la
  concession par le modèle (UC atypiques) et **simulateur de conformité** interactif.
- **Carte GIS** — rendu canvas des UC (1000 m × 250 m) colorées par sévérité, cliquables.

## Modèle métier

| Entité | Description |
|--------|-------------|
| `blocs` | Assiettes de coupe (A1, A2, B1, B2). |
| `ucs` | Unités de comptage : layons de 1000 m × 250 m (25 ha), avec taux d'anomalie, sévérité, DBH moyen. |
| `trees` | Tiges signalées irrégulières (étiquette, espèce, DBH, qualité OA/OB/OC, position). |
| `alerts` | Alertes automatiques d'isolement. |
| `verifications` | Décisions de contrôle horodatées ; la vue `uc_status` expose le statut courant de chaque UC. |

## API

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour la référence complète. Points d'entrée principaux :

```
GET  /api/health
GET  /api/meta
GET  /api/stats/overview | /stats/species | /stats/dbh | /stats/worst
GET  /api/blocs | /blocs/:bloc
GET  /api/ucs?bloc=&severity=&status=&q=&limit=&offset=
GET  /api/ucs/:id
GET  /api/ucs/:id/verifications
POST /api/ucs/:id/verifications      { status, decision, note, inspector }
GET  /api/trees?species=&grade=&uc=&bloc=
GET  /api/alerts?bloc=&species=
GET  /api/ml/model                   # architecture + métriques du réseau
GET  /api/ml/regions                 # profils des 4 régions de référence
GET  /api/ml/scan                    # distribution des verdicts sur la concession
GET  /api/ucs/:id/score              # score de conformité d'une UC
POST /api/ml/score                   # score d'une UC hypothétique (simulateur)
```
