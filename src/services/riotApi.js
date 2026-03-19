const config = require('../config');

// --- FILE D'ATTENTE RATE LIMITER ---
const queue = [];
let activeRequests = 0;
const MAX_PER_SECOND = config.RATE_LIMIT_PER_SEC;
let tokensAvailable = MAX_PER_SECOND;

// Recharge les tokens chaque seconde
setInterval(() => {
    tokensAvailable = MAX_PER_SECOND;
    processQueue();
}, 1000);

function processQueue() {
    while (queue.length > 0 && tokensAvailable > 0) {
        tokensAvailable--;
        const { resolve, url } = queue.shift();
        resolve(executeRequest(url));
    }
}

async function executeRequest(url) {
    activeRequests++;
    try {
        const response = await fetch(url, {
            headers: {
                "X-Riot-Token": config.API_KEY,
                "User-Agent": "Mozilla/5.0"
            }
        });

        // Si rate limité par Riot, on attend le temps indiqué
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
            console.log(`⚠️ Rate limité par Riot ! Retry dans ${retryAfter}s...`);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            return executeRequest(url); // Retry
        }

        return response;
    } finally {
        activeRequests--;
    }
}

/**
 * Fait un appel à l'API Riot avec rate limiting.
 * Les requêtes sont mises en file d'attente si le quota est atteint.
 */
function fetchRiot(url) {
    if (tokensAvailable > 0) {
        tokensAvailable--;
        return executeRequest(url);
    }

    // Pas de token dispo → on met en file d'attente
    return new Promise(resolve => {
        queue.push({ resolve, url });
    });
}

module.exports = { fetchRiot };
