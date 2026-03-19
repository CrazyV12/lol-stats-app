const NodeCache = require('node-cache');
const config = require('../config');

// Un cache pour les profils (TTL court) et un pour les matchs (TTL long)
const profileCache = new NodeCache({ stdTTL: config.CACHE_TTL_PROFILE, checkperiod: 60 });
const matchCache = new NodeCache({ stdTTL: config.CACHE_TTL_MATCH, checkperiod: 120 });

module.exports = {
    // --- PROFIL ---
    getProfile(gameName, tagLine) {
        return profileCache.get(`player:${gameName.toLowerCase()}:${tagLine.toLowerCase()}`);
    },

    setProfile(gameName, tagLine, data) {
        profileCache.set(`player:${gameName.toLowerCase()}:${tagLine.toLowerCase()}`, data);
        console.log(`💾 Cache SET profil : ${gameName}#${tagLine}`);
    },

    // --- MATCH ---
    getMatch(matchId) {
        return matchCache.get(`match:${matchId}`);
    },

    setMatch(matchId, data) {
        matchCache.set(`match:${matchId}`, data);
    },

    // --- TIMELINE ---
    getTimeline(matchId) {
        return matchCache.get(`timeline:${matchId}`);
    },

    setTimeline(matchId, data) {
        matchCache.set(`timeline:${matchId}`, data);
        console.log(`💾 Cache SET timeline : ${matchId}`);
    },

    // --- STATS ---
    getStats() {
        return {
            profiles: profileCache.getStats(),
            matches: matchCache.getStats()
        };
    }
};
