# 🚀 Feuille de Route : Mon Mini OP.GG

Ce fichier centralise toutes les idées et tâches pour transformer le prototype en un site professionnel.

## ✅ Phase 1 : Le Prototype (MVP)

- [x] Connexion à l'API Riot Games (Récupération du PUUID).
- [x] Récupération de l'historique des derniers matchs.
- [x] Affichage des statistiques de base (KDA, Champion, Résultat).
- [x] Intégration de Data Dragon pour les images des champions.
- [x] Séparation du code en Frontend (HTML/CSS/JS) et Backend (Node.js).
- [x] Affichage des items et du menu déroulant avec les 10 joueurs.

## 📊 Phase 2 : Le Profil du Joueur (En-tête du site)

- [x] **Ranked Stats :** Récupérer et afficher le rang actuel du joueur (ex: Gold II, 54 LP) en Solo/Duo et Flex.
- [x] **Emblèmes :** Afficher l'image officielle de la ligue (Casque de fer, Bouclier d'or, etc.).
- [x] **Winrate Global :** Calculer le ratio de victoires sur les matchs récents ou la saison.
- [x] **Top Champions :** Afficher les 3 champions les plus joués par le joueur avec leur KDA moyen.
- [x] **Icône d'invocateur et Niveau :** Afficher l'icône de profil du joueur et son niveau de compte en haut de la page.

## ⚔️ Phase 3 : Détails Avancés des Matchs

- [x] **Sorts d'Invocateur (Spells) :** Afficher le Flash, Ignite, etc., à côté des items.
- [x] **Runes :** Récupérer la rune principale (ex: Conquérant, Électrocution) et l'afficher.
- [x] **Badges de Performance :** Ajouter des tags visuels comme "MVP", "ACE", ou "Triple Kill".
- [x] **Analyse de l'équipe :** Afficher le total des golds et les objectifs (Dragons, Hérauts, Barons) pour chaque équipe dans le menu déroulant.
- [x] **Graphiques :** Utiliser une librairie comme Chart.js pour afficher la courbe d'or et le graphique en barres des dégâts de la partie.

## 🎨 Phase 4 : Expérience Utilisateur (UI/UX)

- [x] **Design Responsive :** S'assurer que le site est parfaitement lisible sur un écran de téléphone mobile.
- [x] **Bouton "Voir plus" (Pagination) :** Pouvoir charger 5 ou 10 matchs supplémentaires sans recharger toute la page.
- [x] **Loading Skeletons :** Remplacer le texte "Recherche en cours..." par des blocs gris clignotants qui simulent le chargement (comme sur YouTube ou OP.GG).
- [x] **Gestion d'erreurs Pro :** Remplacer le "alert()" moche du navigateur par de belles notifications stylisées si le joueur n'existe pas.
- [x] **Barre de recherche persistante :** Garder la barre de recherche accessible en haut de l'écran même quand on défile vers le bas.

## ⚙️ Phase 5 : Backend & Optimisation (Pour survivre en ligne)

- [x] **Mise en Cache (node-cache) :** Mémoriser les profils déjà cherchés pour ne pas interroger Riot inutilement (très important pour éviter d'être banni de l'API).
- [x] **Gestion du Rate Limit :** Créer une file d'attente pour ne jamais dépasser les 20 requêtes/seconde autorisées par Riot.
- [x] **Refactoring du Backend :** Séparer le gros fichier `index.js` en plusieurs dossiers (`routes`, `services`, `config`) pour que le code reste lisible.
- [x] **Mise à jour automatique de Data Dragon :** S'assurer que le backend récupère la dernière version du patch toutes les 24h.

## 🔴 Phase 6 : Fonctionnalités Bonus

- [ ] **Recherche Récente :** Mémoriser localement les 3 derniers pseudos cherchés pour pouvoir cliquer dessus rapidement.
- [ ] **Joueurs cliquables :** A chaque endroit où un joueur est affiché, que ce soit dans les parties, les amis, ect... il doit être cliquable et mener à son profil.
