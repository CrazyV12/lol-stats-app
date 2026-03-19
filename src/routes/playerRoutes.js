const express = require('express');
const router = express.Router();
const config = require('../config');
const { fetchRiot } = require('../services/riotApi');
const cache = require('../services/cache');

// Mapping des Queue IDs vers des noms lisibles
const QUEUE_NAMES = {
    420: 'Solo/Duo', 440: 'Flex', 450: 'ARAM',
    400: 'Normal Draft', 430: 'Normal Blind',
    490: 'Quickplay', 1700: 'Arena', 1900: 'URF',
    900: 'URF', 1400: 'Ultimate Spellbook'
};

// Mapping Riot API type param pour filtrage
const QUEUE_TYPE_MAP = {
    'ranked': 'ranked',
    'normal': 'normal',
    'aram': null,  // pas de filtre direct, on filtre côté serveur
    'all': null
};

router.get('/:gameName/:tagLine', async (req, res) => {
    const { gameName, tagLine } = req.params;
    const start = parseInt(req.query.start) || 0;
    const count = parseInt(req.query.count) || 5;
    const queueFilter = req.query.queue || 'all';
    const forceRefresh = req.query.force === 'true';

    try {
        console.log(`\n=========================================`);
        console.log(`🔍 RECHERCHE : ${gameName}#${tagLine} (start=${start}, count=${count}, queue=${queueFilter}${forceRefresh ? ', FORCE' : ''})`);

        // --- CACHE : Profil complet (seulement pour la 1ère page sans filtre, pas en force) ---
        if (start === 0 && queueFilter === 'all' && !forceRefresh) {
            const cached = cache.getProfile(gameName, tagLine);
            if (cached) {
                console.log(`⚡ Cache HIT pour ${gameName}#${tagLine}`);
                return res.json(cached);
            }
        }

        // 1. PUUID
        const accountUrl = `https://${config.REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
        const accountResponse = await fetchRiot(accountUrl);
        if (!accountResponse.ok) throw new Error("Joueur introuvable ou Clé API expirée");
        const accountData = await accountResponse.json();
        const puuid = accountData.puuid;

        // 2. MATCH IDS (avec pagination et filtre de queue)
        // Pour 'other', on fetch plus de matchs car on filtre ensuite
        const fetchCount = queueFilter === 'other' ? count * 3 : count;
        let matchesApiUrl = `https://${config.REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${fetchCount}`;
        
        if (queueFilter === 'solo') matchesApiUrl += '&queue=420';
        else if (queueFilter === 'flex') matchesApiUrl += '&queue=440';
        else if (queueFilter === 'aram') matchesApiUrl += '&queue=450';
        else if (queueFilter === 'normal') matchesApiUrl += '&type=normal';

        const matchesResponse = await fetchRiot(matchesApiUrl);
        const matchIds = await matchesResponse.json();

        let dynamicPlatform = 'euw1';
        if (matchIds.length > 0) {
            dynamicPlatform = matchIds[0].split('_')[0].toLowerCase();
        }

        // 3. SUMMONER DATA
        const summonerUrl = `https://${dynamicPlatform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
        const summonerResponse = await fetchRiot(summonerUrl);
        const summonerData = await summonerResponse.json();

        // 4. MATCHES (avec cache individuel)
        const KNOWN_QUEUES = [420, 440, 450, 400, 430, 490]; // Solo, Flex, ARAM, Normal Draft, Normal Blind, Quickplay
        const matchesDetails = [];
        for (const matchId of matchIds) {
            const cachedMatch = cache.getMatch(matchId);
            if (cachedMatch) {
                // Si filtre 'other', vérifier la queue avant d'ajouter
                if (queueFilter === 'other' && KNOWN_QUEUES.includes(cachedMatch.info.queueId)) continue;

                const mainPlayer = cachedMatch.info.participants.find(p => p.puuid === puuid);
                if (mainPlayer) {
                    matchesDetails.push(formatMatchData(matchId, cachedMatch, mainPlayer, puuid));
                    continue;
                }
            }

            const matchUrl = `https://${config.REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
            const matchResponse = await fetchRiot(matchUrl);
            
            if (matchResponse.status === 429) {
                console.log(`⚠️ Limite Riot atteinte ! Arrêt à ${matchesDetails.length} matchs.`);
                break; 
            }
            if (!matchResponse.ok) continue;

            const matchData = await matchResponse.json();
            cache.setMatch(matchId, matchData);

            // Si filtre 'other', exclure les queues connues
            if (queueFilter === 'other' && KNOWN_QUEUES.includes(matchData.info.queueId)) continue;

            const mainPlayer = matchData.info.participants.find(p => p.puuid === puuid);
            matchesDetails.push(formatMatchData(matchId, matchData, mainPlayer, puuid));
        }

        // 5. RANKED
        let soloQueue = null;
        let flexQueue = null;
        const leagueUrl = `https://${dynamicPlatform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
        const leagueResponse = await fetchRiot(leagueUrl);
        
        if (leagueResponse.ok) {
            const leagueData = await leagueResponse.json();
            if (Array.isArray(leagueData)) {
                soloQueue = leagueData.find(queue => queue.queueType === 'RANKED_SOLO_5x5');
                flexQueue = leagueData.find(queue => queue.queueType === 'RANKED_FLEX_SR');
            }
        }

        // 6. MASTERIES
        const masteryUrl = `https://${dynamicPlatform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`;
        const masteryResponse = await fetchRiot(masteryUrl);
        const masteryData = await masteryResponse.json();
        const top3Masteries = Array.isArray(masteryData) ? masteryData.slice(0, 3) : [];

        // 7. RÉPONSE FINALE
        const formatRank = (q) => q ? {
            queue: q.queueType === 'RANKED_SOLO_5x5' ? 'Solo/Duo' : 'Flex',
            tier: q.tier, rank: q.rank, lp: q.leaguePoints,
            wins: q.wins, losses: q.losses
        } : null;

        const profileInfo = {
            name: gameName,
            tag: tagLine,
            level: summonerData.summonerLevel || 0,
            profileIconId: summonerData.profileIconId || 1,
            ranked: formatRank(soloQueue),
            rankedFlex: formatRank(flexQueue),
            masteries: top3Masteries
        };

        const result = { 
            profile: profileInfo, 
            recentMatches: matchesDetails,
            hasMore: matchIds.length >= fetchCount
        };

        if (start === 0 && queueFilter === 'all') {
            cache.setProfile(gameName, tagLine, result);
        }

        res.json(result);

    } catch (error) {
        console.error("❌ ERREUR :", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- Helper pour formater les données d'un match ---
function formatMatchData(matchId, matchData, mainPlayer, puuid) {
    const queueId = matchData.info.queueId;
    
    const allPlayers = matchData.info.participants.map(p => ({
        name: p.summonerName || p.riotIdGameName || "Inconnu",
        champion: p.championName,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        teamId: p.teamId,
        damage: p.totalDamageDealtToChampions,
        gold: p.goldEarned,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        spell1: p.summoner1Id,
        spell2: p.summoner2Id,
        mainRune: p.perks?.styles[0]?.selections[0]?.perk,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
    }));

    // Champions de l'équipe adverse
    const mainTeamId = mainPlayer.teamId;
    const enemyChamps = matchData.info.participants
        .filter(p => p.teamId !== mainTeamId)
        .map(p => p.championName);

    return {
        matchId,
        champion: mainPlayer.championName,
        kills: mainPlayer.kills,
        deaths: mainPlayer.deaths,
        assists: mainPlayer.assists,
        win: mainPlayer.win,
        multiKill: mainPlayer.largestMultiKill,
        firstBlood: mainPlayer.firstBloodKill,
        cs: mainPlayer.totalMinionsKilled + mainPlayer.neutralMinionsKilled,
        damage: mainPlayer.totalDamageDealtToChampions,
        duration: matchData.info.gameDuration,
        participantId: mainPlayer.participantId,
        runes: mainPlayer.perks,
        spell1: mainPlayer.summoner1Id,
        spell2: mainPlayer.summoner2Id,
        mainRune: mainPlayer.perks?.styles[0]?.selections[0]?.perk,
        subRuneStyle: mainPlayer.perks?.styles[1]?.style,
        items: [mainPlayer.item0, mainPlayer.item1, mainPlayer.item2, mainPlayer.item3, mainPlayer.item4, mainPlayer.item5, mainPlayer.item6],
        participants: allPlayers,
        teams: matchData.info.teams.map(t => ({
            teamId: t.teamId,
            dragons: t.objectives?.dragon?.kills || 0,
            barons: t.objectives?.baron?.kills || 0,
            towers: t.objectives?.tower?.kills || 0
        })),
        // NOUVEAUX CHAMPS
        role: mainPlayer.teamPosition || mainPlayer.individualPosition || 'UNKNOWN',
        queueId: queueId,
        queueName: QUEUE_NAMES[queueId] || 'Autre',
        gameCreation: matchData.info.gameCreation,
        enemyChamps: enemyChamps
    };
}

module.exports = router;
