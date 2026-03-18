require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors()); 

const API_KEY = process.env.RIOT_API_KEY;
const REGION = 'europe'; 

// L'armure Ninja est conservée, c'est une excellente pratique !
async function fetchRiot(url) {
    return await fetch(url, {
        headers: {
            "X-Riot-Token": API_KEY,
            "User-Agent": "Mozilla/5.0" 
        }
    });
}

app.get('/api/player/:gameName/:tagLine', async (req, res) => {
    const { gameName, tagLine } = req.params;

    try {
        console.log(`\n=========================================`);
        console.log(`🔍 RECHERCHE MODERNE : ${gameName}#${tagLine}`);

        // 1. PUUID
        const accountUrl = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
        const accountResponse = await fetchRiot(accountUrl);
        if (!accountResponse.ok) throw new Error("Joueur introuvable ou Clé API expirée");
        const accountData = await accountResponse.json();
        const puuid = accountData.puuid;

        // 2. MATCH IDS
        const matchesUrl = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`;
        const matchesResponse = await fetchRiot(matchesUrl);
        const matchIds = await matchesResponse.json();

        let dynamicPlatform = 'euw1';
        if (matchIds.length > 0) {
            dynamicPlatform = matchIds[0].split('_')[0].toLowerCase();
        }

        // 3. SUMMONER DATA (Juste pour récupérer ton niveau et l'icône)
        const summonerUrl = `https://${dynamicPlatform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
        const summonerResponse = await fetchRiot(summonerUrl);
        const summonerData = await summonerResponse.json();

        // 4. MATCHES (On n'a plus besoin de "voler" l'ID caché ici !)
        const matchesDetails = [];
        for (const matchId of matchIds) {
            const matchUrl = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
            const matchResponse = await fetchRiot(matchUrl);
            
            if (matchResponse.status === 429) {
                console.log(`⚠️ Limite Riot atteinte ! Arrêt à ${matchesDetails.length} matchs.`);
                break; 
            }
            if (!matchResponse.ok) continue;

            const matchData = await matchResponse.json();
            const mainPlayer = matchData.info.participants.find(p => p.puuid === puuid);
            
            const allPlayers = matchData.info.participants.map(p => ({
                name: p.summonerName || p.riotIdGameName || "Inconnu",
                champion: p.championName,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                teamId: p.teamId,
                damage: p.totalDamageDealtToChampions,
                gold: p.goldEarned,
                spell1: p.summoner1Id,
                spell2: p.summoner2Id,
                mainRune: p.perks?.styles[0]?.selections[0]?.perk,
                items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
            }));

            matchesDetails.push({
                matchId: matchId,
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
                spell1: mainPlayer.summoner1Id,
                spell2: mainPlayer.summoner2Id,
                mainRune: mainPlayer.perks?.styles[0]?.selections[0]?.perk,
                subRuneStyle: mainPlayer.perks?.styles[1]?.style,
                items: [mainPlayer.item0, mainPlayer.item1, mainPlayer.item2, mainPlayer.item3, mainPlayer.item4, mainPlayer.item5, mainPlayer.item6],
                participants: allPlayers,
                teams: matchData.info.teams.map(t => ({
                    teamId: t.teamId,
                    dragons: t.objectives.dragon.kills,
                    barons: t.objectives.baron.kills,
                    towers: t.objectives.tower.kills
                }))
            });
        }

        // 5. RANKED - LA VRAIE SOLUTION MODERNE DE RIOT
        let soloQueue = null;
        // On utilise la nouvelle adresse "by-puuid" au lieu de "by-summoner" !
        const leagueUrl = `https://${dynamicPlatform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
        
        console.log(`👉 Envoi de la requête Rank ultra-moderne par PUUID...`);
        const leagueResponse = await fetchRiot(leagueUrl);
        
        if (leagueResponse.ok) {
            const leagueData = await leagueResponse.json();
            console.log(`✅ Succès ! Données reçues :`, leagueData.length > 0 ? "Classement trouvé" : "Vide");
            if (Array.isArray(leagueData)) {
                soloQueue = leagueData.find(queue => queue.queueType === 'RANKED_SOLO_5x5') || leagueData.find(queue => queue.queueType === 'RANKED_FLEX_SR');
            }
        } else {
            console.log(`❌ Erreur API League: ${leagueResponse.status}`);
        }

        // 6. MASTERIES
        const masteryUrl = `https://${dynamicPlatform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`;
        const masteryResponse = await fetchRiot(masteryUrl);
        const masteryData = await masteryResponse.json();
        const top3Masteries = Array.isArray(masteryData) ? masteryData.slice(0, 3) : [];

        // 7. PROFILE
        const profileInfo = {
            name: gameName,
            tag: tagLine,
            level: summonerData.summonerLevel || 0,
            profileIconId: summonerData.profileIconId || 1,
            ranked: soloQueue ? {
                queue: soloQueue.queueType === 'RANKED_SOLO_5x5' ? 'Solo/Duo' : 'Flex',
                tier: soloQueue.tier,
                rank: soloQueue.rank,
                lp: soloQueue.leaguePoints,
                wins: soloQueue.wins,
                losses: soloQueue.losses
            } : null,
            masteries: top3Masteries
        };

        res.json({ profile: profileInfo, recentMatches: matchesDetails });

    } catch (error) {
        console.error("❌ ERREUR FINALE :", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`));