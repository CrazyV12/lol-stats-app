const express = require('express');
const router = express.Router();
const config = require('../config');
const { fetchRiot } = require('../services/riotApi');
const cache = require('../services/cache');

router.get('/:matchId/timeline', async (req, res) => {
    try {
        const { matchId } = req.params;

        // Vérifier le cache
        const cached = cache.getTimeline(matchId);
        if (cached) {
            console.log(`⚡ Cache HIT timeline : ${matchId}`);
            return res.json(cached);
        }

        const timelineUrl = `https://${config.REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
        
        console.log(`⏱️ Récupération Timeline : ${matchId}`);
        const response = await fetchRiot(timelineUrl);
        
        if (!response.ok) throw new Error("Erreur lors de la récupération de la Timeline");
        const data = await response.json();

        // Sauvegarder en cache
        cache.setTimeline(matchId, data);

        res.json(data);
    } catch (error) {
        console.error("❌ ERREUR TIMELINE :", error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
