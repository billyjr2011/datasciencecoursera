# SYVIEF

**Système de Vérification d'Inventaire d'Exploitation Forestière** — plateforme de
contrôle des inventaires d'exploitation forestière. SYVIEF permet à un service de
vérification (administration, cabinet de certification, cellule qualité d'une société
forestière) d'auditer, cellule par cellule, un inventaire d'exploitation : repérer les
anomalies de comptage, tracer les décisions de contrôle et visualiser la concession sur
une carte GIS.

L'application est amorcée avec un jeu de données réel extrait d'un rapport de conformité :
**4 blocs, 127 unités de comptage (UC), 1 064 tiges irrégulières, 11 alertes d'isolement**
sur une concession en zone UTM 33N (~3,55–3,60 °N).

## Architecture

Monorepo à deux applications (voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)) :

```
syvief/
├── server/          API REST — Node.js + Express + SQLite (node:sqlite intégré)
│   ├── schema.sql   Schéma relationnel (blocs, ucs, trees, alerts, verifications)
│   ├── data/        Jeu de données seed (JSON extrait du rapport de conformité)
│   └── src/         db, seed, serveur, routes
├── web/             Interface — React 18 + Vite + React Router
│   └── src/         pages, composants, client API
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
- **Carte GIS** — rendu canvas des UC colorées par sévérité, cliquables.

## Modèle métier

| Entité | Description |
|--------|-------------|
| `blocs` | Assiettes de coupe (A1, A2, B1, B2). |
| `ucs` | Unités de comptage : cellules de 500 m × 500 m, avec taux d'anomalie, sévérité, DBH moyen. |
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
```
