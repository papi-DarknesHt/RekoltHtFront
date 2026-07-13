# Directives de lancement — RekoltHt

Ce fichier explique comment installer, compiler et lancer le frontend
(RekoltHtFront) et le backend (RekoltHtBackend).

> ⚠️ **Ces instructions supposent un checkout qui contient déjà** :
> `BackendRekoltHt/settings/` (package, pas un seul fichier `settings.py`),
> `.env.dev.example`/`.env.prod.example`, `requirements-face.txt`,
> `Registration/services/`. Si `ls BackendRekoltHt/settings/` échoue ou
> renvoie juste un fichier (pas un dossier), tu es dans un clone/checkout qui
> n'a pas encore ce travail — voir **§3. Plusieurs clones locaux** tout en bas
> avant de continuer, sinon les commandes ci-dessous échoueront.

---

## 1. Frontend (RekoltHtFront)

### Prérequis
- Node.js 20+ (testé avec Node 24.16.0 / npm 11.13.0)

### Installation
```bash
cd RekoltHtFront
npm install
```

### Variables d'environnement
Créer un fichier `.env` à la racine du projet (non commité) avec ces clés :
```
VITE_API_URL=
VITE_GOOGLE_MAPS_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_RECAPTCHA_KEY=
```
- `VITE_API_URL` : URL du backend (ex: `http://127.0.0.1:8000` en local)
- `VITE_GOOGLE_MAPS_KEY` : clé API Google Maps (MapHaiti.jsx, MapSelectionGPS.jsx)
- `VITE_GOOGLE_CLIENT_ID` : client OAuth2 Google (connexion/inscription Google)
- `VITE_RECAPTCHA_KEY` : clé Google reCAPTCHA

### Lancer en développement
```bash
npm run dev
```
Démarre le serveur Vite avec rechargement à chaud.

### Compiler pour la production
```bash
npm run build
```
Génère les fichiers statiques dans `dist/`.

### Prévisualiser le build de production
```bash
npm run preview
```

### Vérifier le code (lint)
```bash
npm run lint
```

---

## 2. Backend (RekoltHtBackend)

### Prérequis
- **Python 3.12** — nécessaire pour installer paddleocr/paddlepaddle (étape OCR)
  et playwright (vérification patente MCI). paddlepaddle==2.6.2 n'a **aucune**
  wheel pour Python 3.13+ : un venv créé avec Python 3.13 ne pourra pas
  installer requirements.txt en entier (Django/le reste fonctionne, mais pas
  l'OCR ni le scraping patente). **Vérifie avec `python --version` avant de
  blâmer autre chose** — plusieurs venvs (`venv/`, `venv312/`) existent dans ce
  dépôt et un seul suffit, peu importe son nom, du moment qu'il est en 3.12.
- PostgreSQL (production uniquement — SQLite suffit en développement)

### Créer l'environnement virtuel
Un venv nommé `venv/` (ou `venv312/`, selon le clone) existe déjà à la racine
de `Documents\GitHub\RekoltHtBackend`, en Python 3.12, avec tout
`requirements.txt` déjà installé (paddleocr, playwright + Chromium, etc.) — 
l'activer directement évite de tout refaire :
```bash
source venv/Scripts/activate
```
Sinon, pour en créer un nouveau (autre clone, autre machine) :
```bash
py -3.12 -m venv venv
```
**Activer le venv** — la commande dépend du shell utilisé, et il faut
**vraiment l'activer** (pas juste exécuter le script) sinon tout s'installera
ailleurs (ex: dans Anaconda) :
```bash
# Git Bash (MINGW64) — "source" (ou ". ") est obligatoire, avec des / :
source venv/Scripts/activate

# cmd.exe :
venv\Scripts\activate.bat

# PowerShell :
venv\Scripts\Activate.ps1

# Linux/macOS :
source venv/bin/activate
```
Vérifier que ça a marché avant d'aller plus loin :
```bash
which python   # (Git Bash) doit pointer vers .../venv/Scripts/python (ou venv312) — PAS anaconda3
python --version   # doit afficher 3.12.x
```
Si ça pointe encore vers Anaconda/le Python système, l'activation n'a pas
fonctionné — recommence avec la bonne syntaxe ci-dessus pour ton shell.

### Installer les dépendances
```bash
PYTHONUTF8=1 pip install -r requirements.txt
```
`PYTHONUTF8=1` est nécessaire sur certaines configs Windows : sans ça, pip
peut planter avec `UnicodeDecodeError: 'charmap' codec can't decode byte...`
en essayant de lire `requirements.txt` (UTF-8, accents et bannières `─`) avec
l'encodage par défaut de Windows (`cp1252`) — constaté en conditions réelles.

Après l'installation, télécharger le navigateur Chromium requis par Playwright
(vérification patente MCI, `Registration/services/patente_service.py`) :
```bash
python -m playwright install chromium
```
(`python -m playwright ...` plutôt que `playwright ...` seul — évite les
soucis de PATH selon les environnements.)

**Si `manage.py migrate`/`check` échoue avec `Cannot use ImageField because
Pillow is not installed`** alors que `pip show pillow` le montre bien installé
— l'extension compilée de Pillow (`_imaging`) est corrompue (installation
interrompue, antivirus qui a mis en quarantaine le fichier compilé, etc.),
constaté en conditions réelles. Vérifier puis réparer :
```bash
python -c "from PIL import Image"   # si ça plante avec "cannot import name '_imaging'", réinstalle :
pip install --force-reinstall --no-cache-dir pillow==12.2.0
```

**Si `from paddleocr import PaddleOCR` échoue avec
`ModuleNotFoundError: No module named 'setuptools'`** — certains venvs
Python 3.12 récents ne l'incluent plus par défaut :
```bash
pip install setuptools
```

### Variables d'environnement
Copier le modèle correspondant à l'environnement voulu — **`copy` est une
commande cmd.exe, pas Git Bash** : utiliser `cp` dans Git Bash/Linux/macOS,
`copy` uniquement dans un vrai `cmd.exe` :
```bash
cp .env.dev.example .env.dev        # Git Bash / Linux / macOS
copy .env.dev.example .env.dev      # cmd.exe uniquement
```
(ou `.env.prod.example` → `.env.prod` pour tester la config production en
local). Renseigner les valeurs réelles dans le fichier copié — jamais commité
(voir `.gitignore`).

### Base de données — migrations
```bash
python manage.py migrate --settings=BackendRekoltHt.settings.dev
```

### Lancer le serveur de développement
Deux façons de lancer le serveur, selon si le WebSocket temps réel est utile :

**`manage.py runserver`** — serveur WSGI classique, HTTP uniquement :
```bash
python manage.py runserver --settings=BackendRekoltHt.settings.dev
```
`DJANGO_SETTINGS_MODULE` vaut `BackendRekoltHt.settings.dev` par défaut (voir
`manage.py`) — l'option `--settings` ci-dessus est donc facultative en dev,
mais explicite pour éviter toute ambiguïté.

⚠️ Avec `runserver`, toute requête vers `/ws/global/` (notifications temps réel
— `Api/routing.py`) renvoie 404 en boucle dans les logs : `runserver` ne sait
pas router les WebSockets (protocole ASGI). Ce n'est **pas une erreur** — le
frontend retombe automatiquement sur le polling (`GET .../verification/statut/`
toutes les ~8s) — mais aucune notification instantanée n'arrive tant que le
serveur tourne en WSGI.

**`uvicorn`** — serveur ASGI, gère aussi le WebSocket (Django Channels) :
```bash
python -m uvicorn BackendRekoltHt.asgi:application --reload
```
`BackendRekoltHt/asgi.py` fixe déjà `DJANGO_SETTINGS_MODULE` sur
`BackendRekoltHt.settings.dev` par défaut — pas besoin d'option `--settings`
avec uvicorn (ce n'est de toute façon pas un flag reconnu par uvicorn, qui
n'est pas `manage.py`). À utiliser dès que le WebSocket compte (notifications
`utilisateur.updated`, `profil.updated`, `verification.updated`, etc.).

⚠️ **`.env.dev` n'est lu qu'au démarrage du processus** — `--reload` ne
surveille que les fichiers `.py` par défaut. Modifier `.env.dev` (ex:
`FACE_VENV_PYTHON`) pendant que le serveur tourne ne change **rien** tant
qu'il n'est pas explicitement redémarré (`Ctrl+C` puis relancer) — constaté
en conditions réelles : un changement de config ignoré silencieusement le
temps de plusieurs essais. Pour que `--reload` surveille aussi `.env.dev` :
```bash
python -m uvicorn BackendRekoltHt.asgi:application --reload --reload-include ".env.dev"
```

### Vérifications utiles
```bash
python manage.py check --settings=BackendRekoltHt.settings.dev
python manage.py migrate --check --settings=BackendRekoltHt.settings.prod   # avant tout déploiement
```

### Vérification faciale (DeepFace) — environnement séparé
DeepFace (via TensorFlow, `protobuf>=6.31.1`) est **incompatible** avec
paddleocr/paddlepaddle (`protobuf<=3.20.2`) dans le même environnement Python
— vérifié : les deux ne peuvent pas être installés côte à côte. La
vérification faciale (`Registration/services/face_service.py`) tourne donc
dans un second environnement dédié :
```bash
py -3.12 -m venv venv_face
venv_face\Scripts\pip install -r requirements-face.txt
```
Puis renseigner dans `.env.dev` (ou `.env.prod`) :
```
FACE_VENV_PYTHON=<chemin absolu vers venv_face>\Scripts\python.exe
```
Préchauffer le modèle une fois (sinon le premier appel réel peut dépasser le
délai d'attente en téléchargeant ~90 Mo) :
```bash
venv_face\Scripts\python.exe -c "from deepface import DeepFace; DeepFace.build_model('Facenet')"
```
Si `FACE_VENV_PYTHON` n'est pas configuré, la vérification faciale automatique
est simplement désactivée : les demandes individuelles passent en revue
manuelle (`en_attente_manuelle`) au lieu d'échouer.

---

## 3. Plusieurs clones locaux du même dépôt

Si `python manage.py migrate` échoue avec :
```
ModuleNotFoundError: No module named 'BackendRekoltHt.settings.dev'; 'BackendRekoltHt.settings' is not a package
```
ce n'est **pas** une erreur de commande : ce checkout ne contient tout
simplement pas encore le nouveau `BackendRekoltHt/settings/` (package). Aucune
correction de syntaxe ne peut résoudre ça — il faut que le code y arrive.

Cause typique : plusieurs clones locaux du même dépôt (ex:
`Documents\GitHub\RekoltHtBackend` et `PycharmProjects\RekoltHtBackend`), sur
des branches différentes, et le travail existe seulement dans l'un des deux
(souvent encore **non commité**). Vérifier :
```bash
git branch --show-current
git status --short
ls BackendRekoltHt/settings/   # doit lister base.py, dev.py, prod.py — pas une erreur
```

Deux façons de résoudre, selon ce que tu veux faire :

**A. Le plus simple — travailler directement dans le clone qui a déjà le code**
```bash
cd "/c/Users/<toi>/Documents/GitHub/RekoltHtBackend"
```
Aucune opération git nécessaire, tout y existe déjà (venvs y compris — `venv/`,
`venv312/` et `venv_face/` sont tous les trois déjà installés et testés dans
ce clone-là).

**B. Rapatrier le code dans ce clone-ci, sans jamais toucher GitHub**
Nécessite un commit **local** (pas de push) dans le clone source, puis un
`git fetch` direct entre les deux dossiers via un chemin local — GitHub n'est
jamais sollicité :
```bash
# 1. Dans le clone source (là où le code existe), un commit local uniquement :
cd "/c/Users/<toi>/Documents/GitHub/RekoltHtBackend"
git add -A
git commit -m "wip: vérification KYC"

# 2. Dans ce clone-ci, récupérer cette branche depuis l'autre dossier en local :
cd "/c/Users/<toi>/PycharmProjects/RekoltHtBackend"
git fetch "/c/Users/<toi>/Documents/GitHub/RekoltHtBackend" be:be-import
git merge be-import   # ou : git checkout be-import
```
