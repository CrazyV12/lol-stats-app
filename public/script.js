function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

async function getLatestPatch() {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await response.json();
        return versions[0]; 
    } catch (error) { return '14.6.1'; }
}

function getCleanChampionName(name) {
    if (name === 'FiddleSticks') return 'Fiddlesticks';
    return name;
}

// NOUVEAU : Fonction pour traduire l'ID numérique d'un champion (ex: 1) en son nom (ex: Annie)
let globalChampMap = null;
async function getChampionMap(patchVersion) {
    if (globalChampMap) return globalChampMap;
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/fr_FR/champion.json`);
    const data = await response.json();
    globalChampMap = {};
    for (const champ in data.data) {
        globalChampMap[data.data[champ].key] = data.data[champ].id;
    }
    return globalChampMap;
}

let globalSpellsMap = null;
async function getSpellsMap(patchVersion) {
    if (globalSpellsMap) return globalSpellsMap;
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/fr_FR/summoner.json`);
    const data = await response.json();
    globalSpellsMap = {};
    for (const spell in data.data) { globalSpellsMap[data.data[spell].key] = data.data[spell].id; }
    return globalSpellsMap;
}

let globalRunesMap = null;
async function getRunesMap(patchVersion) {
    if (globalRunesMap) return globalRunesMap;
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/fr_FR/runesReforged.json`);
    const data = await response.json();
    globalRunesMap = {};
    data.forEach(tree => {
        globalRunesMap[tree.id] = tree.icon;
        tree.slots.forEach(slot => {
            slot.runes.forEach(rune => { globalRunesMap[rune.id] = rune.icon; });
        });
    });
    return globalRunesMap;
}

function generateItemsHTML(itemsArray, patchVersion, isSmall = false) {
    let html = isSmall ? `<div class="player-items">` : `<div class="items-row">`;
    itemsArray.forEach(item => {
        if (item === 0) {
            html += isSmall ? `<div style="background-color: #222;"></div>` : `<div class="item-empty"></div>`;
        } else {
            const sizeClass = isSmall ? '' : 'class="item-icon"';
            html += `<img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/item/${item}.png" ${sizeClass}>`;
        }
    });
    html += `</div>`;
    return html;
}

function toggleDetails(element, matchDataString) {
    const detailsDiv = element.nextElementSibling;
    const isOpening = detailsDiv.style.display !== "block";
    detailsDiv.style.display = isOpening ? "block" : "none";

    if (isOpening && matchDataString) {
        const match = JSON.parse(decodeURIComponent(matchDataString));
        const canvas = document.getElementById(`chart-${match.matchId}`);
        
        // On génère le graphique seulement s'il n'existe pas déjà
        if (canvas && !canvas.classList.contains('chart-rendered')) {
            const ctx = canvas.getContext('2d');
            const labels = match.participants.map(p => p.champion);
            const damageData = match.participants.map(p => p.damage);
            const bgColors = match.participants.map(p => p.teamId === 100 ? '#5383e8' : '#e84057');

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ data: damageData, backgroundColor: bgColors, borderRadius: 4 }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { 
                        x: { grid: { color: '#333' } },
                        y: { grid: { display: false }, ticks: { color: '#ccc', font: {size: 10} } }
                    }
                }
            });
            canvas.classList.add('chart-rendered');
        }
    }
}

async function searchPlayer() {
    const gameName = document.getElementById('gameName').value;
    const tagLine = document.getElementById('tagLine').value;
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const profileDiv = document.getElementById('profile-section');

    if(!gameName || !tagLine) return alert("Remplis les deux champs !");

    resultsDiv.innerHTML = '';
    profileDiv.style.display = 'none';
    loadingDiv.style.display = 'block';

    try {
        const patchVersion = await getLatestPatch();
        const [champMap, spellsMap, runesMap] = await Promise.all([
            getChampionMap(patchVersion),
            getSpellsMap(patchVersion),
            getRunesMap(patchVersion)
        ]);
        
        const response = await fetch(`http://localhost:3000/api/player/${gameName}/${tagLine}`);
        const data = await response.json();

        if(data.error) throw new Error(data.error);
        loadingDiv.style.display = 'none';

        const profile = data.profile;
        const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/profileicon/${profile.profileIconId}.png`;
        
        // RANK
        let rankedHTML = '';
        if (profile.ranked) {
            const totalGames = profile.ranked.wins + profile.ranked.losses;
            const winrate = Math.round((profile.ranked.wins / totalGames) * 100);
            rankedHTML = `
                <div class="ranked-box">
                    <div class="rank-title">Classé ${profile.ranked.queue}</div>
                    <div class="rank-details">${profile.ranked.tier} ${profile.ranked.rank} <span class="rank-lp">${profile.ranked.lp} LP</span></div>
                    <div class="rank-stats">${profile.ranked.wins}V ${profile.ranked.losses}D (${winrate}% Winrate)</div>
                </div>
            `;
        } else {
            rankedHTML = `<div class="ranked-box"><div class="rank-title">Classé Solo/Duo</div><div class="rank-details" style="color:#888;">Unranked</div></div>`;
        }

        // TOP CHAMPIONS
        let masteriesHTML = '';
        if (profile.masteries && profile.masteries.length > 0) {
            masteriesHTML = profile.masteries.map(m => {
                const champName = champMap[m.championId];
                if(!champName) return '';
                const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${champName}.png`;
                const pts = m.championPoints > 1000000 
                    ? (m.championPoints / 1000000).toFixed(1) + 'M' 
                    : (m.championPoints / 1000).toFixed(0) + 'k';
                return `<div class="top-champ"><img src="${imgUrl}" title="${champName}"><span>${pts}</span></div>`;
            }).join('');
        }

        profileDiv.innerHTML = `
            <div class="profile-icon-container">
                <img src="${iconUrl}" class="profile-icon" alt="Icon">
                <div class="profile-level">${profile.level}</div>
            </div>
            <div class="profile-info">
                <h2 class="profile-name">${profile.name} <span class="profile-tag">#${profile.tag}</span></h2>
                <div class="profile-stats-row">
                    ${rankedHTML}
                    <div class="top-champions-box">
                        <div class="rank-title">Champions Préférés</div>
                        <div class="top-champs-list">${masteriesHTML}</div>
                    </div>
                </div>
            </div>
        `;
        profileDiv.style.display = 'flex';

        // GÉNÉRATION DES 20 MATCHS
        data.recentMatches.forEach(match => {
            const matchDiv = document.createElement('div');
            matchDiv.className = `match-container`;
            
            const formattedDamage = (match.damage / 1000).toFixed(1) + 'k';
            const cleanChampName = getCleanChampionName(match.champion);
            const championImageUrl = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${cleanChampName}.png`;
            const bgClass = match.win ? 'win-bg' : 'loss-bg';

            const spell1Name = spellsMap[match.spell1] || 'SummonerFlash';
            const spell2Name = spellsMap[match.spell2] || 'SummonerFlash';
            const mainRunePath = runesMap[match.mainRune] || 'perk-images/Styles/7200_Domination.png';
            const subRunePath = runesMap[match.subRuneStyle] || 'perk-images/Styles/7200_Domination.png';

            let badgesHTML = '';
            if (match.firstBlood) badgesHTML += `<span class="badge first-blood">First Blood</span>`;
            if (match.multiKill === 2) badgesHTML += `<span class="badge multikill">Double Kill</span>`;
            else if (match.multiKill === 3) badgesHTML += `<span class="badge multikill">Triple Kill</span>`;
            else if (match.multiKill === 4) badgesHTML += `<span class="badge multikill quadra">Quadra Kill</span>`;
            else if (match.multiKill >= 5) badgesHTML += `<span class="badge multikill penta">Penta Kill</span>`;

            const teamBlue = match.participants.filter(p => p.teamId === 100);
            const teamRed = match.participants.filter(p => p.teamId === 200);
            const teamBlueStats = match.teams.find(t => t.teamId === 100);
            const teamRedStats = match.teams.find(t => t.teamId === 200);

            const getTeamGold = (team) => (team.reduce((sum, p) => sum + p.gold, 0) / 1000).toFixed(1) + 'k';
            const getTeamKills = (team) => team.reduce((sum, p) => sum + p.kills, 0);

            const generateTeamHTML = (team) => {
                return team.map(p => `
                    <div class="player-row">
                        <img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${getCleanChampionName(p.champion)}.png" class="player-champ-icon">
                        <div class="player-name">${p.name}</div>
                        <div class="player-kda">${p.kills}/${p.deaths}/${p.assists}</div>
                        ${generateItemsHTML(p.items, patchVersion, true)}
                    </div>
                `).join('');
            };

            const matchDataStr = encodeURIComponent(JSON.stringify(match));
            matchDiv.innerHTML = `
                <div class="match-summary ${bgClass}" onclick="toggleDetails(this, '${matchDataStr}')">
                    <div class="champion-container">
                        <img src="${championImageUrl}" alt="${match.champion}" class="champion-icon">
                    </div>
                    <div class="spells-runes-container">
                        <div class="spells">
                            <img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${spell1Name}.png" class="spell-icon">
                            <img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${spell2Name}.png" class="spell-icon">
                        </div>
                        <div class="runes">
                            <img src="https://ddragon.leagueoflegends.com/cdn/img/${mainRunePath}" class="rune-icon main-rune">
                            <img src="https://ddragon.leagueoflegends.com/cdn/img/${subRunePath}" class="rune-icon sub-rune">
                        </div>
                    </div>
                    <div class="kda-box">
                        <div class="kda">${match.kills} / <span style="color: #e84057;">${match.deaths}</span> / ${match.assists}</div>
                        <div class="badges-container">${badgesHTML}</div>
                    </div>
                    <div class="stats">
                        <span>🗡️ ${formattedDamage} Dmg</span>
                        <span>🌾 ${match.cs} CS</span>
                    </div>
                    ${generateItemsHTML(match.items, patchVersion, false)}
                    <div class="duration">⏱️ ${formatDuration(match.duration)}<br><span style="font-size:10px; color:#555;">(Détails) ⬇️</span></div>
                    <div class="result-text">${match.win ? 'VICTOIRE' : 'DÉFAITE'}</div>
                </div>
                
                <div class="match-details">
                    <div class="teams-wrapper">
                        <div class="team team-blue">
                            <div class="team-title">
                                <span style="color: #5383e8;">ÉQUIPE BLEUE</span> ⚔️ ${getTeamKills(teamBlue)} | 💰 ${getTeamGold(teamBlue)}
                                <div class="objectives">🐉 ${teamBlueStats.dragons} | 👑 ${teamBlueStats.barons} | 🗼 ${teamBlueStats.towers}</div>
                            </div>
                            ${generateTeamHTML(teamBlue)}
                        </div>
                        
                        <div class="team team-red">
                            <div class="team-title">
                                <span style="color: #e84057;">ÉQUIPE ROUGE</span> ⚔️ ${getTeamKills(teamRed)} | 💰 ${getTeamGold(teamRed)}
                                <div class="objectives">🐉 ${teamRedStats.dragons} | 👑 ${teamRedStats.barons} | 🗼 ${teamRedStats.towers}</div>
                            </div>
                            ${generateTeamHTML(teamRed)}
                        </div>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="chart-${match.matchId}"></canvas>
                    </div>
                </div>
            `;
            resultsDiv.appendChild(matchDiv);
        });

    } catch (error) {
        loadingDiv.style.display = 'none';
        resultsDiv.innerHTML = `<p style="color: #e84057; font-weight: bold;">Erreur: ${error.message}</p>`;
    }
}