# 🚀 Mini OP.GG - League of Legends Stats Tracker

Un outil d'analyse de statistiques pour League of Legends, construit avec Node.js et l'API officielle de Riot Games. Ce projet permet de rechercher n'importe quel joueur par son Riot ID et d'obtenir un profil détaillé ainsi qu'une analyse poussée de ses derniers matchs.

---

## 📂 Arborescence du Projet

lol-stats-app/
├── public/ # Dossier Frontend (Statique)
│ ├── index.html # Structure de l'interface utilisateur
│ ├── script.js # Logique client et graphiques (Chart.js)
│ └── style.css # Design moderne (Dark Mode) et responsive
├── .env # Clé API Riot (Fichier privé - NE PAS PARTAGER)
├── .gitignore # Liste des fichiers ignorés par Git (.env, node_modules)
├── index.js # Serveur Backend (Node.js + Express)
├── package.json # Gestion des dépendances (express, dotenv, cors)
├── README.md # Documentation du projet (ce fichier)
└── tasks.md # Liste des tâches et suivi du développement

---

## 🛠️ Installation et Lancement

1. Cloner le projet :
   git clone <ton-lien-de-depot-github>
   cd lol-stats-app

2. Installer les dépendances :
   npm install

3. Configurer la clé API :
   Crée un fichier .env à la racine du projet et ajoute ta clé de développement Riot Games :
   RIOT_API_KEY=RGAPI-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

4. Lancer le serveur :
   node index.js
   _Le site sera alors accessible sur http://localhost:3000._

---

## ✨ Fonctionnalités

### Profil & Classement (Phases 1 & 2)

- Recherche Universelle : Recherche par Riot ID (Pseudo + Tag) sur n'importe quel serveur.
- Détection Automatique : Le serveur identifie automatiquement la plateforme du joueur (EUW, EUNE, etc.) via ses matchs.
- Identité du Joueur : Affichage du niveau, de l'icône d'invocateur et du rang classé (Or III, etc.) récupéré via PUUID.
- Top Champions : Affichage des 3 champions ayant le plus haut score de maîtrise.

### Analyse Avancée des Matchs (Phase 3)

- Historique Complet : Affichage des 20 derniers matchs.
- Détails Techniques : Sorts d'invocateur (Flash, Smite...), Runes principales et secondaires.
- Indicateurs de Performance : Calcul automatique du ratio KDA et badges spécifiques (MVP, ACE, Double/Triple Kill, First Blood).
- Graphiques de Dégâts : Visualisation des dégâts infligés sous forme de barres horizontales (style LoL).
- Graphique Gold Diff : Courbe de progression de l'avantage en pièces d'or minute par minute via la Timeline Riot.
- Analyse d'Équipe : Total des golds par équipe et objectifs capturés (Dragons, Barons, Tours).

---

## 📚 Technologies Utilisées

- Backend : Node.js, Express.
- Frontend : HTML5, CSS3, JavaScript (Vanilla).
- Graphiques : Chart.js
- Données : API Riot Games & Data Dragon.
