# SYVIEF — Architecture

## 1. Vue d'ensemble

SYVIEF est une application full-stack de vérification d'inventaires d'exploitation
forestière. Elle est conçue comme un MVP « prêt pour la production » : séparation
nette API / interface, schéma relationnel explicite, données seedées reproductibles,
tests d'intégration, et un chemin de déploiement mono-conteneur.

```
┌──────────────┐   HTTP/JSON   ┌───────────────┐   SQL    ┌──────────────┐
│  React SPA   │ ────────────▶ │  Express API  │ ───────▶ │   SQLite     │
│  (web/dist)  │ ◀──────────── │  (server)     │ ◀─────── │  syvief.db   │
└──────────────┘               └───────────────┘          └──────────────┘
        ▲                              │
        └──── servi en prod par ───────┘
```

### Choix techniques

| Décision | Motivation |
|----------|-----------|
| **SQLite via `node:sqlite`** | Persistance relationnelle sans dépendance native ni serveur de base ; idéal pour un MVP mono-machine. Migration vers Postgres possible sans changer les routes (SQL standard). |
| **Express** | Routeur HTTP minimal, éprouvé. Une seule dépendance runtime. |
| **React + Vite** | Interface découplée, build rapide, rechargement à chaud en dev. |
| **Workspaces npm** | `server` et `web` gérés depuis la racine, un seul `npm install`. |
| **Vue `uc_status`** | Le statut courant d'une UC est dérivé de la dernière décision, sans dénormalisation à maintenir. |

## 2. Modèle de données

Fichier de référence : [`server/schema.sql`](../server/schema.sql).

```
blocs (bloc PK) ──1:N── ucs (uc_id PK)
                          │
                          ├──1:N── trees        (tiges irrégulières)
                          ├──1:N── alerts        (isolement)
                          └──1:N── verifications (décisions de contrôle)
                                        │
                                        └── vue uc_status = dernière décision / UC
```

- **`ucs`** : cellule d'inventaire de 500 m × 500 m. `severity` (0 conforme,
  1 vigilance, 2 critique) résume l'état, `suspect_rate_pct` est le taux d'anomalie
  (PBV), `edge_flag` marque les UC en bordure d'assiette.
- **`trees`** : tige signalée irrégulière ; `grade` = qualité déclarée (OA/OB/OC),
  coordonnées en UTM 33N **et** en géographiques (lat/lon).
- **`verifications`** : journal append-only des décisions. Le workflow d'une UC
  (`a_verifier → en_cours → valide | rejete`) est reconstitué depuis ce journal,
  ce qui garantit une piste d'audit complète.

## 3. Flux principal — vérification d'une UC

1. `GET /api/ucs?severity=2` → l'inspecteur liste les UC critiques.
2. `GET /api/ucs/:id` → détail : mesures, tiges irrégulières, alertes, statut courant.
3. `POST /api/ucs/:id/verifications` → il enregistre une décision (statut + note).
4. La vue `uc_status` reflète immédiatement le nouveau statut dans les listes et la carte.

## 4. Référence API

Toutes les réponses sont en JSON. Base : `/api`.

| Méthode & route | Description | Paramètres |
|-----------------|-------------|------------|
| `GET /health` | Sonde de disponibilité. | — |
| `GET /meta` | Métadonnées projet, CRS, étendue, garde-fou géographique. | — |
| `GET /stats/overview` | Indicateurs de synthèse + avancement des vérifications. | — |
| `GET /stats/species` | Répartition des tiges par espèce. | — |
| `GET /stats/dbh` | Histogramme des DBH (classes de 10 cm). | — |
| `GET /stats/worst` | UC au taux d'anomalie le plus élevé. | `limit` |
| `GET /blocs` | Agrégats par bloc. | — |
| `GET /blocs/:bloc` | Détail d'un bloc + ses UC. | — |
| `GET /ucs` | Liste filtrable/paginée des UC. | `bloc, severity, status, edge, q, limit, offset` |
| `GET /ucs/:id` | Détail d'une UC (tiges, alertes, statut). | — |
| `GET /ucs/:id/trees` | Tiges d'une UC. | — |
| `GET /ucs/:id/verifications` | Historique des décisions. | — |
| `POST /ucs/:id/verifications` | Enregistre une décision. | corps : `status` (requis), `decision`, `note`, `inspector` |
| `GET /trees` | Tiges irrégulières filtrables. | `species, grade, uc, bloc, limit, offset` |
| `GET /alerts` | Alertes d'isolement. | `bloc, species` |

### Codes d'erreur

- `400` — corps invalide (ex. `status` hors des valeurs autorisées).
- `404` — ressource introuvable (UC, bloc) ou route API inconnue.
- `500` — erreur interne (capturée par le middleware d'erreur).

## 5. Configuration

| Variable | Défaut | Rôle |
|----------|--------|------|
| `PORT` | `4000` | Port d'écoute de l'API. |
| `SYVIEF_DB` | `server/syvief.db` | Chemin du fichier SQLite. |
| `VITE_API_BASE` | `/api` | Base de l'API côté frontend (build). |

## 6. Passage à l'échelle

Le MVP tourne sur une seule machine. Pour monter en charge :

1. **Base** — remplacer SQLite par PostgreSQL ; les requêtes sont en SQL standard,
   seule la couche `db.js` change.
2. **API** — l'API est sans état (hors base) : réplication horizontale derrière un
   répartiteur de charge.
3. **Frontend** — `web/dist` est statique : distribuable via CDN.
4. **Authentification** — la table `users` (rôles admin/inspector/viewer) est prévue
   pour brancher une authentification par jeton et restreindre l'écriture des décisions.
5. **Ingestion** — le script `seed.js` est le point d'entrée pour automatiser
   l'import de nouveaux rapports de conformité (ETL).
