let currentPatch = '14.6.1';

// --- ÉTAT GLOBAL ---
let currentGameName = '';
let currentTagLine = '';
let currentStart = 0;
const MATCHES_PER_PAGE = 10;
let patchVersion = '';
let champMap = null;
let spellsMap = null;
let allRunesData = null;
let allLoadedMatches = [];
let currentQueueFilter = 'all';
let currentRoleFilter = 'ALL';
let lastUpdateTime = null;

const ROLE_NAMES = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };
const ROLE_ICONS = { TOP: '🛡️', JUNGLE: '🌿', MIDDLE: '⚔️', BOTTOM: '🏹', UTILITY: '💫' };

// --- NAVIGATION ---
function goHome() {
    document.getElementById('home-screen').style.display = 'flex';
    document.getElementById('results-screen').style.display = 'none';
    renderRecentSearches();
}

function searchFromHeader() {
    const val = document.getElementById('searchInput2').value.trim();
    if (val.includes('#')) {
        document.getElementById('searchInput').value = val;
        searchPlayer();
    }
}

// =========================================================
// PHASE 6 — RECHERCHES RÉCENTES
// =========================================================

const RECENT_KEY = 'dpm_recent_searches';
const MAX_RECENT = 3;

function saveRecentSearch(gameName, tagLine) {
    let recents = getRecentSearches();
    // Supprimer si déjà présent (pour remettre en tête)
    recents = recents.filter(r => !(r.name.toLowerCase() === gameName.toLowerCase() && r.tag.toLowerCase() === tagLine.toLowerCase()));
    recents.unshift({ name: gameName, tag: tagLine });
    if (recents.length > MAX_RECENT) recents = recents.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
}

function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
        return [];
    }
}

function renderRecentSearches() {
    const container = document.getElementById('recent-searches');
    if (!container) return;
    const recents = getRecentSearches();
    if (recents.length === 0) { container.innerHTML = ''; return; }

    const chips = recents.map(r =>
        `<button class="recent-chip" onclick="searchFromRecent('${r.name}','${r.tag}')">
            <span class="recent-chip-icon">🕐</span>
            <span>${r.name}<span class="recent-chip-tag">#${r.tag}</span></span>
        </button>`
    ).join('');
    container.innerHTML = `<div class="recent-searches-inner">${chips}</div>`;
}

function searchFromRecent(name, tag) {
    document.getElementById('searchInput').value = `${name}#${tag}`;
    searchPlayer();
}

// =========================================================
// PHASE 6 — JOUEURS CLIQUABLES
// =========================================================

function navigateToPlayer(name, tag) {
    if (!name || name === 'Inconnu') return;
    const riotId = tag ? `${name}#${tag}` : name;
    document.getElementById('searchInput').value = riotId;
    document.getElementById('searchInput2').value = riotId;
    // Si on est sur l'écran résultats, on lance directement
    if (document.getElementById('results-screen').style.display !== 'none') {
        const [gn, ...rest] = riotId.split('#');
        const tl = rest.join('#').trim();
        if (gn && tl) {
            currentGameName = gn;
            currentTagLine = tl;
            currentStart = 0;
            currentQueueFilter = 'all';
            currentRoleFilter = 'ALL';
            allLoadedMatches = [];
            removeLoadMoreButton();
            document.querySelectorAll('.queue-btn').forEach(b => b.classList.toggle('active', b.dataset.queue === 'all'));
            document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === 'ALL'));
            showSkeletons();
            getLatestPatch().then(pv => {
                patchVersion = pv;
                currentPatch = pv;
                Promise.all([getChampionMap(pv), getSpellsMap(pv), getRunesMap(pv)]).then(([cm, sm, rd]) => {
                    champMap = cm; spellsMap = sm; allRunesData = rd;
                    loadMatches(true);
                });
            });
        }
    } else {
        searchPlayer();
    }
}

// --- NOTIFICATIONS TOAST ---
function showNotification(message, type = 'error') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `notification-toast toast-${type}`;
    const icons = { error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    toast.addEventListener('click', () => dismissToast(toast));
    container.appendChild(toast);
    setTimeout(() => dismissToast(toast), 5000);
}
function dismissToast(toast) {
    if (toast.classList.contains('toast-dismiss')) return;
    toast.classList.add('toast-dismiss');
    setTimeout(() => toast.remove(), 350);
}

// --- SKELETON LOADING ---
function showSkeletons() {
    const profileDiv = document.getElementById('profile-section');
    const champDiv = document.getElementById('champion-stats');
    const roleDiv = document.getElementById('role-stats');
    const resultsDiv = document.getElementById('results');

    profileDiv.innerHTML = `<div class="profile-card skeleton-profile-card">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton skeleton-line w60"></div>
        <div class="skeleton skeleton-line w40"></div>
        <div class="skeleton skeleton-line w80"></div>
    </div>`;
    champDiv.innerHTML = '';
    roleDiv.innerHTML = '';
    resultsDiv.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        resultsDiv.innerHTML += `<div class="skeleton skeleton-match"></div>`;
    }
}

// --- TOOLTIP ---
function showOpggTooltip(event, text) {
    const tooltip = document.getElementById('opgg-tooltip');
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';
    const x = event.clientX + 15;
    const y = event.clientY + 15;
    if (x + tooltip.offsetWidth > window.innerWidth) tooltip.style.left = (event.clientX - tooltip.offsetWidth - 15) + 'px';
    else tooltip.style.left = x + 'px';
    if (y + tooltip.offsetHeight > window.innerHeight) tooltip.style.top = (event.clientY - tooltip.offsetHeight - 15) + 'px';
    else tooltip.style.top = y + 'px';
}
function hideOpggTooltip() { document.getElementById('opgg-tooltip').style.display = 'none'; }

// --- UTILITY ---
function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return "à l'instant";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    return `il y a ${hours}h`;
}

function getDateLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
}

// --- DATA DRAGON ---
async function getLatestPatch() {
    try {
        const r = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        return (await r.json())[0];
    } catch { return '14.6.1'; }
}

function getCleanChampionName(name) {
    if (name === 'FiddleSticks') return 'Fiddlesticks';
    return name;
}

let globalChampMap = null;
async function getChampionMap(pv) {
    if (globalChampMap) return globalChampMap;
    const r = await fetch(`https://ddragon.leagueoflegends.com/cdn/${pv}/data/fr_FR/champion.json`);
    const d = await r.json();
    globalChampMap = {};
    for (const c in d.data) globalChampMap[d.data[c].key] = d.data[c].id;
    return globalChampMap;
}

let globalSpellsMap = null;
async function getSpellsMap(pv) {
    if (globalSpellsMap) return globalSpellsMap;
    const r = await fetch(`https://ddragon.leagueoflegends.com/cdn/${pv}/data/fr_FR/summoner.json`);
    const d = await r.json();
    globalSpellsMap = {};
    for (const s in d.data) globalSpellsMap[d.data[s].key] = d.data[s].id;
    return globalSpellsMap;
}

let globalRunesMap = null;
async function getRunesMap(pv) {
    if (globalRunesMap) return globalRunesMap;
    const r = await fetch(`https://ddragon.leagueoflegends.com/cdn/${pv}/data/fr_FR/runesReforged.json`);
    globalRunesMap = await r.json();
    return globalRunesMap;
}

function generateItemsHTML(itemsArray, pv, isSmall = false) {
    let html = isSmall ? `<div class="player-items">` : `<div class="items-row">`;
    itemsArray.forEach(item => {
        if (item === 0) html += isSmall ? `<div style="background-color:#111118;"></div>` : `<div class="item-empty"></div>`;
        else html += `<img src="https://ddragon.leagueoflegends.com/cdn/${pv}/img/item/${item}.png" ${isSmall ? '' : 'class="item-icon"'}>`;
    });
    return html + `</div>`;
}

// --- TIMELINE ---
const timelineCache = {};

async function switchTab(event, tabId, matchId, participantId) {
    const container = document.getElementById(`details-${matchId}`);
    container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if ((tabId === `generalites-${matchId}` || tabId === `build-${matchId}`) && !timelineCache[matchId]) {
        await loadTimelineData(matchId, participantId);
    }
}

async function loadTimelineData(matchId, participantId) {
    const canvas = document.getElementById(`goldChart-${matchId}`);
    if (!canvas) return;
    try {
        const r = await fetch(`http://localhost:3000/api/match/${matchId}/timeline`);
        const timelineData = await r.json();
        timelineCache[matchId] = timelineData;
        const frames = timelineData.info.frames;
        const labels = []; const goldDiffs = [];
        frames.forEach((frame, i) => {
            labels.push(`${i}:00`);
            let bG = 0, rG = 0;
            for (let j = 1; j <= 5; j++) bG += frame.participantFrames[j].totalGold;
            for (let j = 6; j <= 10; j++) rG += frame.participantFrames[j].totalGold;
            goldDiffs.push(bG - rG);
        });
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Avantage en Or', data: goldDiffs,
                fill: { target: 'origin', above: 'rgba(83,131,232,0.2)', below: 'rgba(232,64,87,0.2)' },
                segment: { borderColor: c => c.p0.parsed.y >= 0 ? '#5383e8' : '#e84057' },
                borderWidth: 2, pointBackgroundColor: c => c.raw >= 0 ? '#5383e8' : '#e84057',
                pointBorderColor: '#0e0e13', pointBorderWidth: 1, pointRadius: 3, tension: 0.1
            }]},
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw > 0 ? `+${c.raw} (Bleue)` : `${c.raw} (Rouge)` } } },
                scales: { x: { ticks: { color: '#555' }, grid: { display: false } },
                    y: { ticks: { color: '#555' }, grid: { color: c => c.tick.value === 0 ? '#444' : '#1a1a25' } } }
            }
        });
        // BUILD
        const bc = document.getElementById(`build-content-${matchId}`);
        if (bc) {
            let iHTML = '', sHTML = '';
            const sm = { 1: 'A', 2: 'Z', 3: 'E', 4: 'R' };
            frames.forEach(f => f.events.forEach(e => {
                if (e.participantId === participantId) {
                    const min = Math.floor(e.timestamp / 60000);
                    if (e.type === 'ITEM_PURCHASED') iHTML += `<div class="build-step"><img src="https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/item/${e.itemId}.png"><span>${min}m</span></div><div class="build-arrow">❯</div>`;
                    if (e.type === 'SKILL_LEVEL_UP' && sm[e.skillSlot]) sHTML += `<div class="skill-badge skill-${sm[e.skillSlot]}">${sm[e.skillSlot]}</div>`;
                }
            }));
            bc.innerHTML = `<div class="build-section"><div class="build-title">Ordre d'achat</div><div class="build-row">${iHTML}</div></div><div class="build-section" style="margin-top:20px"><div class="build-title">Compétences</div><div class="build-row">${sHTML}</div></div>`;
        }
    } catch (e) { console.error("Erreur timeline", e); }
}

function toggleDetails(element, matchDataString) {
    const d = element.nextElementSibling;
    const opening = d.style.display !== "block";
    if (opening) document.querySelectorAll('.match-details').forEach(div => div.style.display = "none");
    d.style.display = opening ? "block" : "none";
    if (opening && matchDataString) {
        const match = JSON.parse(decodeURIComponent(matchDataString));
        const canvas = document.getElementById(`chart-${match.matchId}`);
        if (canvas && !canvas.classList.contains('chart-rendered')) {
            const ctx = canvas.getContext('2d');
            const maxD = Math.max(...match.participants.map(p => p.damage));
            new Chart(ctx, {
                type: 'bar', data: { labels: match.participants.map(p => p.champion),
                    datasets: [{ data: match.participants.map(p => p.damage), backgroundColor: match.participants.map(p => p.teamId === 100 ? '#5383e8' : '#e84057'), borderRadius: 3 }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { color: '#1e1e2e' } }, y: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } } }
                }
            });
            canvas.classList.add('chart-rendered');
        }
    }
}

// --- RUNE RENDERERS ---
function generateFullTreeHTML(treeId, selectedIds, isPrimary = true) {
    const td = allRunesData.find(t => t.id === treeId);
    if (!td) return '';
    const slots = isPrimary ? td.slots : td.slots.filter(s => s.runes.some(r => selectedIds.includes(r.id)));
    let sHTML = '';
    slots.forEach((slot, i) => {
        const isKS = isPrimary && i === 0;
        let rHTML = slot.runes.map(r => {
            const sel = selectedIds.includes(r.id);
            const sn = r.name.replace(/'/g, "\\'");
            return `<div class="rune-item ${sel ? 'rune-selected' : 'rune-non-selected'}" onmouseover="showOpggTooltip(event,'${sn}')" onmouseout="hideOpggTooltip()"><img src="https://ddragon.leagueoflegends.com/cdn/img/${r.icon}"></div>`;
        }).join('');
        sHTML += `<div class="rune-slot-row ${isKS ? 'rune-row-keystone' : ''}">${rHTML}</div>`;
    });
    return `<div class="opgg-rune-tree ${isPrimary ? 'primary-tree' : 'secondary-tree'}"><div class="tree-header-opgg"><img src="https://ddragon.leagueoflegends.com/cdn/img/${td.icon}" class="tree-icon-opgg"><span>${td.name}</span></div><div class="slots-container">${sHTML}</div></div>`;
}

function generateShardsHTML(sp) {
    if (!sp) return '';
    const names = { 5001:"Éclat Santé", 5002:"Éclat Armure", 5003:"Éclat RM", 5005:"Éclat Vit. d\\'Attaque", 5007:"Éclat Accél. Compétence", 5008:"Éclat Force Adaptative" };
    const icons = { 5001:'perk-images/StatMods/StatModsHealthScalingIcon.png', 5002:'perk-images/StatMods/StatModsArmorIcon.png', 5003:'perk-images/StatMods/StatModsMagicResIcon.png', 5005:'perk-images/StatMods/StatModsAttackSpeedIcon.png', 5007:'perk-images/StatMods/StatModsCDRScalingIcon.png', 5008:'perk-images/StatMods/StatModsAdaptiveForceIcon.png' };
    const rows = [
        { id: sp.offense, opts: [5008,5005,5007] },
        { id: sp.flex, opts: [5008,5002,5003] },
        { id: sp.defense, opts: [5001,5002,5003] }
    ];
    let rHTML = rows.map(r => {
        let o = r.opts.map(id => `<div class="shard-item ${id===r.id?'shard-selected':'shard-non-selected'}" onmouseover="showOpggTooltip(event,'${names[id]||'Éclat'}')" onmouseout="hideOpggTooltip()"><img src="https://ddragon.leagueoflegends.com/cdn/img/${icons[id]}"></div>`).join('');
        return `<div class="shard-row">${o}</div>`;
    }).join('');
    return `<div class="opgg-shards-tree"><div class="tree-header-opgg">Statistiques</div><div class="shards-container">${rHTML}</div></div>`;
}

function findRuneIcon(id) {
    let icon = '';
    allRunesData.forEach(t => { if (t.id === id) icon = t.icon; t.slots.forEach(s => s.runes.forEach(r => { if (r.id === id) icon = r.icon; })); });
    return icon || 'perk-images/Styles/7200_Domination.png';
}

// --- SIDEBAR RENDERERS ---
function renderSidebar(profile, matches) {
    renderProfile(profile);
    renderChampionStats(matches);
    renderRoleStats(matches);
    renderPlayedWith(matches);
}

function renderProfile(p) {
    const div = document.getElementById('profile-section');
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/profileicon/${p.profileIconId}.png`;
    
    const formatRank = (r) => {
        if (!r) return `<div class="rank-card"><div class="rank-label">Unranked</div><div class="rank-value" style="color:#555;">—</div></div>`;
        const total = r.wins + r.losses;
        const wr = Math.round((r.wins / total) * 100);
        return `<div class="rank-card"><div class="rank-label">Classé ${r.queue}</div><div class="rank-value">${r.tier} ${r.rank} <span class="rank-lp">${r.lp} LP</span></div><div class="rank-wr">${r.wins}V ${r.losses}D — ${wr}% WR</div></div>`;
    };

    const lastUpdate = lastUpdateTime ? formatTimeAgo(lastUpdateTime) : '';

    div.innerHTML = `<div class="profile-card">
        <div class="profile-header">
            <div class="profile-icon-wrap"><img src="${iconUrl}"><div class="profile-level-badge">${p.level}</div></div>
            <div><h2 class="profile-name">${p.name}<span class="profile-tag"> #${p.tag}</span></h2></div>
        </div>
        ${formatRank(p.ranked)}
        ${p.rankedFlex ? formatRank(p.rankedFlex) : ''}
        <button class="update-btn" onclick="refreshPlayer()" id="update-btn">🔄 Mettre à jour</button>
        ${lastUpdate ? `<div class="last-update">Mis à jour ${lastUpdate}</div>` : ''}
    </div>`;
}

function renderChampionStats(matches) {
    const div = document.getElementById('champion-stats');
    if (!matches.length) { div.innerHTML = ''; return; }

    const stats = {};
    matches.forEach(m => {
        if (!stats[m.champion]) stats[m.champion] = { wins: 0, games: 0, kills: 0, deaths: 0, assists: 0, cs: 0, duration: 0 };
        const s = stats[m.champion];
        s.games++; if (m.win) s.wins++;
        s.kills += m.kills; s.deaths += m.deaths; s.assists += m.assists;
        s.cs += m.cs; s.duration += m.duration;
    });

    const sorted = Object.entries(stats).sort((a, b) => b[1].games - a[1].games).slice(0, 6);

    let rows = sorted.map(([champ, s]) => {
        const kda = s.deaths === 0 ? '∞' : ((s.kills + s.assists) / s.deaths).toFixed(1);
        const csm = (s.cs / (s.duration / 60)).toFixed(1);
        const wr = Math.round((s.wins / s.games) * 100);
        const wrClass = wr >= 60 ? 'wr-good' : wr <= 40 ? 'wr-bad' : 'wr-neutral';
        const cn = getCleanChampionName(champ);
        return `<div class="champ-perf-row" title="${champ}">
            <img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${cn}.png">
            <span class="champ-perf-stat">${kda}</span>
            <span class="champ-perf-stat">${csm}</span>
            <span class="champ-perf-stat">${s.games}</span>
            <span class="champ-perf-wr ${wrClass}">${wr}%</span>
        </div>`;
    }).join('');

    div.innerHTML = `<div class="sidebar-section">
        <div class="sidebar-title">📊 Performance par champion</div>
        <div class="sidebar-col-header">
            <span style="width:28px;flex-shrink:0"></span><span style="width:36px;flex-shrink:0;text-align:right">KDA</span><span style="width:36px;flex-shrink:0;text-align:right">CS/m</span><span style="width:36px;flex-shrink:0;text-align:right">G</span><span style="width:38px;flex-shrink:0;text-align:right">WR</span>
        </div>
        ${rows}
    </div>`;
}

function renderRoleStats(matches) {
    const div = document.getElementById('role-stats');
    if (!matches.length) { div.innerHTML = ''; return; }

    const stats = {};
    matches.forEach(m => {
        const role = m.role || 'UNKNOWN';
        if (role === 'UNKNOWN' || !ROLE_NAMES[role]) return;
        if (!stats[role]) stats[role] = { wins: 0, games: 0 };
        stats[role].games++; if (m.win) stats[role].wins++;
    });

    const sorted = Object.entries(stats).sort((a, b) => b[1].games - a[1].games);
    if (!sorted.length) { div.innerHTML = ''; return; }

    let rows = sorted.map(([role, s]) => {
        const wr = Math.round((s.wins / s.games) * 100);
        const wrClass = wr >= 55 ? 'wr-good' : wr <= 45 ? 'wr-bad' : 'wr-neutral';
        return `<div class="role-perf-row">
            <span class="role-perf-icon">${ROLE_ICONS[role] || '❓'}</span>
            <span class="role-perf-name">${ROLE_NAMES[role]}</span>
            <span class="role-perf-games">${s.games}</span>
            <span class="champ-perf-wr ${wrClass}">${wr}%</span>
        </div>`;
    }).join('');

    div.innerHTML = `<div class="sidebar-section">
        <div class="sidebar-title">🎯 Performance par rôle</div>
        <div class="sidebar-col-header">
            <span style="width:24px;flex-shrink:0"></span><span style="flex:1">Rôle</span><span style="width:30px;flex-shrink:0;text-align:right">G</span><span style="width:38px;flex-shrink:0;text-align:right">WR</span>
        </div>
        ${rows}
    </div>`;
}

function renderPlayedWith(matches) {
    const div = document.getElementById('played-with');
    if (!matches.length) { div.innerHTML = ''; return; }

    const teammates = {};
    matches.forEach(m => {
        if (!m.participants) return;
        const mainTeamId = m.participants.find(p => p.champion === m.champion)?.teamId;
        if (!mainTeamId) return;

        m.participants.forEach(p => {
            if (p.champion === m.champion && p.teamId === mainTeamId) return;
            if (p.teamId !== mainTeamId) return;
            const key = p.name;
            if (key === 'Inconnu') return;
            if (!teammates[key]) teammates[key] = { wins: 0, games: 0, champion: p.champion, tag: p.tag || '' };
            teammates[key].games++;
            if (m.win) teammates[key].wins++;
            teammates[key].lastChamp = p.champion;
            // Mettre à jour le tag s'il est disponible
            if (p.tag) teammates[key].tag = p.tag;
        });
    });

    const sorted = Object.entries(teammates)
        .filter(([_, s]) => s.games >= 2)
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 5);

    if (!sorted.length) { div.innerHTML = ''; return; }

    let rows = sorted.map(([name, s]) => {
        const wr = Math.round((s.wins / s.games) * 100);
        const wrClass = wr >= 55 ? 'wr-good' : wr <= 45 ? 'wr-bad' : 'wr-neutral';
        const cn = getCleanChampionName(s.lastChamp);
        // PHASE 6 : lien cliquable si on a le tag
        const nameTag = s.tag ? `'${name}','${s.tag}'` : null;
        const nameHTML = nameTag
            ? `<span class="player-link" onclick="navigateToPlayer(${nameTag})">${name}</span>`
            : `<span>${name}</span>`;
        return `<div class="played-with-row">
            <img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${cn}.png" class="played-with-icon">
            <div class="played-with-info">
                <div class="played-with-name">${nameHTML}</div>
            </div>
            <span class="played-with-games">${s.games}</span>
            <span class="champ-perf-wr ${wrClass}">${wr}%</span>
        </div>`;
    }).join('');

    div.innerHTML = `<div class="sidebar-section">
        <div class="sidebar-title">👥 Joué avec</div>
        <div class="sidebar-col-header">
            <span style="width:28px;flex-shrink:0"></span><span style="flex:1">Joueur</span><span style="width:30px;flex-shrink:0;text-align:right">G</span><span style="width:38px;flex-shrink:0;text-align:right">WR</span>
        </div>
        ${rows}
    </div>`;
}

// --- MATCH RENDERING ---
function renderMatch(match) {
    const div = document.createElement('div');
    div.className = 'match-container';
    div.dataset.role = match.role || 'UNKNOWN';

    const cn = getCleanChampionName(match.champion);
    const champImg = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${cn}.png`;
    const bg = match.win ? 'win-bg' : 'loss-bg';
    const sp1 = spellsMap[match.spell1] || 'SummonerFlash';
    const sp2 = spellsMap[match.spell2] || 'SummonerFlash';
    const mainRune = findRuneIcon(match.mainRune);
    const subRune = findRuneIcon(match.subRuneStyle);

    // KDA ratio
    const kdaVal = match.deaths === 0 ? Infinity : (match.kills + match.assists) / match.deaths;
    const kdaStr = match.deaths === 0 ? 'Parfait' : kdaVal.toFixed(1);
    const kdaClass = match.deaths === 0 ? 'kda-perfect' : kdaVal >= 4 ? 'kda-good' : kdaVal >= 2 ? 'kda-ok' : 'kda-bad';
    const csm = (match.cs / (match.duration / 60)).toFixed(1);
    const dmgk = (match.damage / 1000).toFixed(1) + 'k';

    // Badges
    let badges = '';
    if (match.firstBlood) badges += `<span class="badge first-blood">FB</span>`;
    if (match.multiKill === 2) badges += `<span class="badge multikill">Double</span>`;
    else if (match.multiKill === 3) badges += `<span class="badge multikill">Triple</span>`;
    else if (match.multiKill === 4) badges += `<span class="badge multikill quadra">Quadra</span>`;
    else if (match.multiKill >= 5) badges += `<span class="badge multikill penta">Penta</span>`;

    // Enemy champs
    const enemyHTML = (match.enemyChamps || []).map(c => {
        const ecn = getCleanChampionName(c);
        return `<img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${ecn}.png" class="enemy-champ-icon" title="${c}">`;
    }).join('');

    // Detail teams
    const teamBlue = match.participants.filter(p => p.teamId === 100);
    const teamRed = match.participants.filter(p => p.teamId === 200);
    const emptyTeam = { dragons: 0, barons: 0, towers: 0 };
    const tBS = match.teams?.find(t => t.teamId === 100) || emptyTeam;
    const tRS = match.teams?.find(t => t.teamId === 200) || emptyTeam;
    const getGold = t => (t.reduce((s, p) => s + (p.gold || 0), 0) / 1000).toFixed(1) + 'k';
    const getKills = t => t.reduce((s, p) => s + (p.kills || 0), 0);
    const maxDmg = Math.max(...match.participants.map(p => p.damage));

    // PHASE 6 : noms de joueurs cliquables dans les détails de match
    const teamHTML = team => team.map(p => {
        const kr = p.deaths === 0 ? "∞" : ((p.kills + p.assists) / p.deaths).toFixed(1);
        const dp = (p.damage / maxDmg) * 100;
        const ps1 = spellsMap[p.spell1] || 'SummonerFlash';
        const ps2 = spellsMap[p.spell2] || 'SummonerFlash';
        const pmr = findRuneIcon(p.mainRune);
        const bc = p.teamId === 100 ? '#5383e8' : '#e84057';
        // Lien cliquable si on a le tag
        const nameHTML = p.tag
            ? `<span class="player-link" onclick="navigateToPlayer('${p.name.replace(/'/g, "\\'")}','${p.tag.replace(/'/g, "\\'")}')">${p.name}</span>`
            : `<span>${p.name}</span>`;
        return `<div class="opgg-row"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/champion/${getCleanChampionName(p.champion)}.png" class="opgg-champ"><div class="opgg-spells"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${ps1}.png"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${ps2}.png"></div><div class="opgg-runes"><img src="https://ddragon.leagueoflegends.com/cdn/img/${pmr}" class="main-rune"></div><div class="opgg-name">${nameHTML}</div><div class="opgg-kda"><div>${p.kills}/${p.deaths}/${p.assists}</div><div class="kda-ratio">${kr}</div></div><div class="opgg-dmg"><div class="dmg-text">${p.damage}</div><div class="dmg-bar-bg"><div class="dmg-bar-fill" style="width:${dp}%;background:${bc}"></div></div></div><div class="opgg-cs">${p.cs}</div><div class="opgg-items">${generateItemsHTML(p.items, patchVersion, true)}</div></div>`;
    }).join('');

    // Runes
    let runesHTML = '';
    if (match.runes?.styles) {
        const pids = match.runes.styles[0].selections.map(s => s.perk);
        const sids = match.runes.styles[1].selections.map(s => s.perk);
        runesHTML = `<div class="build-section"><div class="build-title">Runes</div><div class="opgg-full-runes-wrapper">${generateFullTreeHTML(match.runes.styles[0].style, pids, true)}<div class="opgg-secondary-side">${generateFullTreeHTML(match.runes.styles[1].style, sids, false)}${generateShardsHTML(match.runes.statPerks)}</div></div></div>`;
    }

    const mds = encodeURIComponent(JSON.stringify(match));
    div.innerHTML = `
        <div class="match-summary ${bg}" onclick="toggleDetails(this,'${mds}')">
            <div class="match-left">
                <div class="champion-container"><img src="${champImg}" class="champion-icon"></div>
                <div class="spells-runes-col">
                    <div class="spells"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${sp1}.png" class="spell-icon"><img src="https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${sp2}.png" class="spell-icon"></div>
                    <div class="runes"><img src="https://ddragon.leagueoflegends.com/cdn/img/${mainRune}" class="rune-icon"><img src="https://ddragon.leagueoflegends.com/cdn/img/${subRune}" class="rune-icon sub-rune"></div>
                </div>
            </div>
            <div class="match-info-col">
                <div class="match-meta"><span class="match-queue-tag">${match.queueName || ''}</span><span class="match-time-ago">${match.gameCreation ? timeAgo(match.gameCreation) : ''}</span></div>
                <div class="match-kda">${match.kills} / <span class="deaths">${match.deaths}</span> / ${match.assists}<span class="match-kda-ratio ${kdaClass}">${kdaStr} KDA</span></div>
                <div class="match-sub-stats"><span>🗡️ ${dmgk}</span><span>🌾 ${csm} CS/m</span><span>⏱️ ${formatDuration(match.duration)}</span></div>
            </div>
            <div class="match-center">
                <div class="match-badges">${badges}</div>
                <div class="match-items-col">${generateItemsHTML(match.items, patchVersion, false)}</div>
            </div>
            <div class="match-right">
                <div class="enemy-champs">${enemyHTML}</div>
                <div class="match-result-col"><div class="result-tag">${match.win ? 'WIN' : 'LOSE'}</div><div class="match-duration">${formatDuration(match.duration)}</div></div>
            </div>
        </div>
        <div class="match-details" id="details-${match.matchId}">
            <div class="tabs-header">
                <button class="tab-btn active" onclick="switchTab(event,'overview-${match.matchId}','${match.matchId}',${match.participantId})">Vue d'ensemble</button>
                <button class="tab-btn" onclick="switchTab(event,'generalites-${match.matchId}','${match.matchId}',${match.participantId})">Généralités</button>
                <button class="tab-btn" onclick="switchTab(event,'build-${match.matchId}','${match.matchId}',${match.participantId})">Build</button>
            </div>
            <div id="overview-${match.matchId}" class="tab-content active">
                <div class="team-header blue-header"><span style="color:#5383e8;font-weight:700">BLEUE</span><span>⚔️${getKills(teamBlue)} 💰${getGold(teamBlue)} 🐉${tBS.dragons} 👑${tBS.barons} 🗼${tBS.towers}</span></div>
                <div class="opgg-table">${teamHTML(teamBlue)}</div>
                <div class="team-header red-header"><span style="color:#e84057;font-weight:700">ROUGE</span><span>⚔️${getKills(teamRed)} 💰${getGold(teamRed)} 🐉${tRS.dragons} 👑${tRS.barons} 🗼${tRS.towers}</span></div>
                <div class="opgg-table">${teamHTML(teamRed)}</div>
            </div>
            <div id="generalites-${match.matchId}" class="tab-content"><div class="chart-container" style="height:250px"><h3 style="color:#666;text-align:left;margin-top:0;font-size:13px">Avantage en or</h3><canvas id="goldChart-${match.matchId}"></canvas></div></div>
            <div id="build-${match.matchId}" class="tab-content"><div class="build-wrapper">${runesHTML}<div id="build-content-${match.matchId}"><div style="padding:20px;text-align:center;color:#555">Chargement... ⏳</div></div></div></div>
        </div>`;
    return div;
}

function renderMatchList(matches) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    const filtered = currentRoleFilter === 'ALL' ? matches : matches.filter(m => m.role === currentRoleFilter);

    if (filtered.length === 0) {
        resultsDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#555;">Aucun match trouvé pour ce filtre</div>`;
        return;
    }

    let lastDate = '';
    filtered.forEach(match => {
        const dateLabel = match.gameCreation ? getDateLabel(match.gameCreation) : '';
        if (dateLabel && dateLabel !== lastDate) {
            lastDate = dateLabel;
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.textContent = dateLabel;
            resultsDiv.appendChild(sep);
        }
        resultsDiv.appendChild(renderMatch(match));
    });
}

// --- FILTERS ---
function switchQueueFilter(btn) {
    document.querySelectorAll('.queue-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentQueueFilter = btn.dataset.queue;
    currentStart = 0;
    allLoadedMatches = [];
    loadMatches(true);
}

function switchRoleFilter(btn) {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRoleFilter = btn.dataset.role;
    renderMatchList(allLoadedMatches);
}

// --- LOAD MORE ---
function removeLoadMoreButton() { const e = document.getElementById('load-more-container'); if (e) e.remove(); }

function addLoadMoreButton() {
    removeLoadMoreButton();
    const c = document.createElement('div');
    c.className = 'load-more-container';
    c.id = 'load-more-container';
    c.innerHTML = `<button class="load-more-btn" onclick="loadMoreMatches()">Voir plus ▼</button>`;
    document.getElementById('results').after(c);
}

async function loadMoreMatches() {
    const btn = document.querySelector('.load-more-btn');
    btn.disabled = true; btn.textContent = 'Chargement... ⏳';
    await loadMatches(false);
    btn.disabled = false; btn.textContent = 'Voir plus ▼';
}

async function loadMatches(isNew, force = false) {
    try {
        let url = `http://localhost:3000/api/player/${currentGameName}/${currentTagLine}?start=${currentStart}&count=${MATCHES_PER_PAGE}&queue=${currentQueueFilter}`;
        if (force) url += '&force=true';
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        if (isNew) {
            allLoadedMatches = data.recentMatches;
            lastUpdateTime = new Date();
            renderSidebar(data.profile, allLoadedMatches);
        } else {
            allLoadedMatches = [...allLoadedMatches, ...data.recentMatches];
        }
        
        currentStart += data.recentMatches.length;
        renderMatchList(allLoadedMatches);
        renderChampionStats(allLoadedMatches);
        renderRoleStats(allLoadedMatches);

        if (data.hasMore !== false && data.recentMatches.length > 0) addLoadMoreButton();
        else removeLoadMoreButton();

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// --- REFRESH (MISE À JOUR) ---
async function refreshPlayer() {
    if (!currentGameName || !currentTagLine) return;
    const btn = document.getElementById('update-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Mise à jour...'; }

    currentStart = 0;
    allLoadedMatches = [];
    removeLoadMoreButton();

    try {
        await loadMatches(true, true);
        showNotification('Profil mis à jour !', 'info');
    } catch (error) {
        showNotification(error.message, 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Mettre à jour'; }
}

// --- RECHERCHE PRINCIPALE ---
async function searchPlayer() {
    const raw = document.getElementById('searchInput').value.trim();
    if (!raw.includes('#')) { showNotification('Format: Pseudo#Tag', 'warning'); return; }
    const [gameName, ...rest] = raw.split('#');
    const tagLine = rest.join('#').trim();
    if (!gameName || !tagLine) { showNotification('Format: Pseudo#Tag', 'warning'); return; }

    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('results-screen').style.display = 'block';
    document.getElementById('searchInput2').value = raw;

    currentGameName = gameName;
    currentTagLine = tagLine;
    currentStart = 0;
    currentQueueFilter = 'all';
    currentRoleFilter = 'ALL';
    allLoadedMatches = [];
    removeLoadMoreButton();
    document.querySelectorAll('.queue-btn').forEach(b => b.classList.toggle('active', b.dataset.queue === 'all'));
    document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === 'ALL'));

    showSkeletons();

    try {
        patchVersion = await getLatestPatch();
        currentPatch = patchVersion;
        [champMap, spellsMap, allRunesData] = await Promise.all([
            getChampionMap(patchVersion), getSpellsMap(patchVersion), getRunesMap(patchVersion)
        ]);

        await loadMatches(true);

        // PHASE 6 : sauvegarder et rafraîchir les chips après succès
        saveRecentSearch(gameName, tagLine);
        renderRecentSearches();

    } catch (error) {
        showNotification(error.message, 'error');
        document.getElementById('results').innerHTML = `<p style="color:#e84057;font-weight:700;text-align:center;padding:40px">Erreur: ${error.message}</p>`;
    }
}

// --- ENTER KEY + INIT ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('keypress', e => { if (e.key === 'Enter') searchPlayer(); });
    document.getElementById('searchInput2').addEventListener('keypress', e => { if (e.key === 'Enter') searchFromHeader(); });
    // PHASE 6 : afficher les recherches récentes dès le chargement
    renderRecentSearches();
});