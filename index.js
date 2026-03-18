require('dotenv').config(); // Charge la clé API depuis le fichier .env
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Autorise ton futur site web à interroger ce serveur
app.use(cors()); 

// La clé Riot est récupérée de manière sécurisée
const API_KEY = process.env.RIOT_API_KEY;
const REGION = 'europe';

// Création de l'URL pour chercher un joueur (ex: /api/player/Faker/SKT)
app.get('/api/player/:gameName/:tagLine', async (req, res) => {
    // Récupère les paramètres tapés dans l'URL
    const { gameName, tagLine } = req.params;

    try {
        console.log(`Nouvelle recherche pour : ${gameName}#${tagLine}`);

        // ÉTAPE 1 : Récupérer le PUUID
        const accountUrl = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}?api_key=${API_KEY}`;
        const accountResponse = await fetch(accountUrl);
        if (!accountResponse.ok) throw new Error("Joueur introuvable ou erreur API");
        const accountData = await accountResponse.json();
        const puuid = accountData.puuid;

        // ÉTAPE 2 : Récupérer les ID des 5 derniers matchs
        const matchesUrl = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=5&api_key=${API_KEY}`;
        const matchesResponse = await fetch(matchesUrl);
        const matchIds = await matchesResponse.json();

        // ÉTAPE 3 : Analyser chaque match et regrouper les résultats
        // On utilise Promise.all pour charger tous les matchs en même temps (plus rapide)
        const matchesDetails = await Promise.all(matchIds.map(async (matchId) => {
            const matchUrl = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`;
            const matchResponse = await fetch(matchUrl);
            const matchData = await matchResponse.json();
            
            const participant = matchData.info.participants.find(p => p.puuid === puuid);
            
            // On renvoie uniquement les infos utiles pour notre site
            return {
                champion: participant.championName,
                kills: participant.kills,
                deaths: participant.deaths,
                assists: participant.assists,
                win: participant.win
            };
        }));

        // On envoie le résultat final au navigateur
        res.json({
            player: `${gameName}#${tagLine}`,
            puuid: puuid,
            recentMatches: matchesDetails
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
    }
});

// Allumer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur backend démarré sur http://localhost:${PORT}`);
});