# Déploiement — application iPhone / web (GitHub Pages)

L'application SYVIEF est publiée comme **PWA statique** (sans serveur) sur GitHub Pages.
Une fois Pages activé, l'URL s'ouvre directement dans Safari sur iPhone et peut être
**ajoutée à l'écran d'accueil** pour s'exécuter en plein écran comme une app native.

## URL de l'application

```
https://billyjr2011.github.io/datasciencecoursera/
```

## Activer GitHub Pages (une seule fois)

Le site compilé est déjà versionné dans le dossier `docs/` à la **racine du dépôt**
(à ne pas confondre avec `syvief/docs/` qui contient la documentation).
Il reste une action manuelle (non automatisable par l'agent) :

1. Fusionner la pull request dans la branche `master` (pour un lien stable), **ou**
   choisir directement la branche de travail pour un aperçu immédiat.
2. Dépôt GitHub → **Settings** → **Pages**.
3. **Build and deployment** → **Source : _Deploy from a branch_**.
4. **Branch :** `master` · **Dossier :** `/docs` → **Save**.
5. Patienter ~1 minute : l'URL ci-dessus devient active.

## Installer sur iPhone (écran d'accueil)

1. Ouvrir l'URL dans **Safari**.
2. Bouton **Partager** (carré avec flèche) → **Sur l'écran d'accueil**.
3. L'icône SYVIEF apparaît ; l'app s'ouvre en plein écran, fonctionne hors-ligne
   (service worker) et conserve les décisions de contrôle (localStorage).

## Régénérer le site

```bash
cd syvief
npm install
npm run build:pages      # régénère SYVIEF.jsx puis compile app/ → docs/
```

Le build écrit dans `docs/` à la racine du dépôt (base `/datasciencecoursera/`).

## Alternative : déploiement par GitHub Actions

Pour un déploiement en continu, basculer **Settings → Pages → Source** sur
**_GitHub Actions_** et ajouter un workflow `actions/deploy-pages`. Le dossier `docs/`
versionné n'est alors plus nécessaire. L'approche « Deploy from a branch » ci-dessus est
retenue par défaut car elle ne requiert aucune configuration d'environnement.
