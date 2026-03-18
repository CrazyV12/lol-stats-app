# 🚀 Mini OP.GG - League of Legends Stats Tracker

Un outil d'analyse de statistiques pour League of Legends, construit avec **Node.js** et l'**API officielle de Riot Games**. Ce projet permet de rechercher n'importe quel joueur par son Riot ID et d'obtenir un profil détaillé ainsi qu'une analyse poussée de ses derniers matchs.

---

## 📂 Arborescence du Projet

```text
lol-stats-app/
├── public/                 # Dossier Frontend (Statique)
│   ├── index.html          # Structure de l'interface utilisateur
│   ├── script.js           # Logique client et graphiques (Chart.js)
│   └── style.css           # Design moderne (Dark Mode) et responsive
├── .env                    # Clé API Riot (Fichier privé - NE PAS PARTAGER)
├── .gitignore              # Liste des fichiers ignorés par Git (.env, node_modules)
├── index.js                # Serveur Backend (Node.js + Express)
├── package.json            # Gestion des dépendances (express, dotenv, cors)
├── README.md               # Documentation du projet (ce fichier)
└── tasks.md                # Liste des tâches et suivi du développement
```
