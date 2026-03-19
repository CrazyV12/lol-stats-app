require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    API_KEY: process.env.RIOT_API_KEY,
    REGION: 'europe',

    // Cache TTLs (en secondes)
    CACHE_TTL_PROFILE: 300,      // 5 minutes pour les profils
    CACHE_TTL_MATCH: 3600,       // 1 heure pour les matchs (ne changent plus)
    CACHE_TTL_TIMELINE: 3600,    // 1 heure pour les timelines

    // Rate Limiter
    RATE_LIMIT_PER_SEC: 15,      // 15 req/s (marge vs limite Riot de 20/s)

    // Data Dragon
    DDRAGON_UPDATE_INTERVAL: 24 * 60 * 60 * 1000  // 24h en ms
};
