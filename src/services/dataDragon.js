const config = require('../config');

let currentPatch = null;

async function fetchLatestPatch() {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await response.json();
        const latest = versions[0];

        if (latest !== currentPatch) {
            console.log(`🎮 Data Dragon mis à jour : ${currentPatch || 'aucun'} → ${latest}`);
            currentPatch = latest;
        }
        return currentPatch;
    } catch (error) {
        console.error('❌ Erreur mise à jour Data Dragon:', error.message);
        return currentPatch || '14.6.1'; // Fallback
    }
}

function getCurrentPatch() {
    return currentPatch || '14.6.1';
}

// Initialisation + auto-update toutes les 24h
async function init() {
    await fetchLatestPatch();
    setInterval(fetchLatestPatch, config.DDRAGON_UPDATE_INTERVAL);
    console.log(`🔄 Auto-update Data Dragon activé (toutes les 24h)`);
}

module.exports = { init, getCurrentPatch };
