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

function toggleDetails(element) {
    const detailsDiv = element.nextElementSibling;
    detailsDiv.style.display = detailsDiv.style.display === "block" ? "none" : "block";
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
        const champMap = await getChampionMap(patchVersion); // On prépare le dico des champions
        
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

            const teamBlue = match.participants.filter(p => p.teamId === 100);
            const teamRed = match.participants.filter(p => p.teamId === 200);

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

            matchDiv.innerHTML = `
                <div class="match-summary ${bgClass}" onclick="toggleDetails(this)">
                    <div class="champion-container">
                        <img src="${championImageUrl}" alt="${match.champion}" class="champion-icon">
                    </div>
                    <div class="kda">${match.kills} / <span style="color: #e84057;">${match.deaths}</span> / ${match.assists}</div>
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
                            <div class="team-title">ÉQUIPE BLEUE</div>
                            ${generateTeamHTML(teamBlue)}
                        </div>
                        <div class="team team-red">
                            <div class="team-title">ÉQUIPE ROUGE</div>
                            ${generateTeamHTML(teamRed)}
                        </div>
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