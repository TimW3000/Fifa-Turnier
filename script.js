// ==========================================
// 1. GLOBALE ZUSTÄNDE & KONSTANTEN
// ==========================================
const DEFAULT_RULES = "1. Fairplay geht vor!\n2. Spielzeit: 2x 6 Minuten.\n3. Bei Gleichstand in der KO-Phase gibt es Verlängerung / Elfmeterschießen.\n4. Ergebnisse werden direkt nach Spielende eingetragen.";

const DEFAULT_CLUBS = [
  "FC Bayern München", "Real Madrid", "Manchester City", "FC Barcelona", 
  "Paris Saint-Germain", "Liverpool FC", "Arsenal FC", "Inter Mailand", 
  "Bayer 04 Leverkusen", "Borussia Dortmund", "Juventus Turin", "Atletico Madrid"
];

let players = JSON.parse(localStorage.getItem('fal_players')) || [
  { name: 'Tim', isRef: true, password: '' },
  { name: 'Max', isRef: false, password: '' },
  { name: 'Lukas', isRef: false, password: '' },
  { name: 'Julian', isRef: false, password: '' }
];

let availableClubs = JSON.parse(localStorage.getItem('fal_clubs')) || [...DEFAULT_CLUBS];
let teams = JSON.parse(localStorage.getItem('fal_teams')) || [];
let groups = JSON.parse(localStorage.getItem('fal_groups')) || [];
let groupMatches = JSON.parse(localStorage.getItem('fal_group_matches')) || [];
let koMatches = JSON.parse(localStorage.getItem('fal_ko_matches')) || [];
let bets = JSON.parse(localStorage.getItem('fal_bets')) || {};
let rulesText = localStorage.getItem('fal_rules') || DEFAULT_RULES;

let myPlayerName = localStorage.getItem('fal_my_player') || '';
let currentRole = localStorage.getItem('fal_role') || 'spectator'; // 'admin', 'ref', 'player', 'spectator'

// Live-Draft / Glücksrad Zustand
let draftState = {
  active: false,
  step: 0, // 0: Start, 1: P1, 2: P2, 3: Club
  currentP1: null,
  currentP2: null,
  currentClub: null,
  remainingPlayers: [],
  remainingClubs: [],
  isSpinning: false,
  angle: 0
};

// ==========================================
// 2. PERSISTENZ & FIREBASE SYNC
// ==========================================
function saveData() {
  localStorage.setItem('fal_players', JSON.stringify(players));
  localStorage.setItem('fal_clubs', JSON.stringify(availableClubs));
  localStorage.setItem('fal_teams', JSON.stringify(teams));
  localStorage.setItem('fal_groups', JSON.stringify(groups));
  localStorage.setItem('fal_group_matches', JSON.stringify(groupMatches));
  localStorage.setItem('fal_ko_matches', JSON.stringify(koMatches));
  localStorage.setItem('fal_bets', JSON.stringify(bets));
  localStorage.setItem('fal_rules', rulesText);

  // Sync mit Firebase Realtime Database (falls eingebunden)
  if (typeof firebase !== 'undefined' && firebase.database) {
    try {
      firebase.database().ref('tournament').set({
        teams, groups, groupMatches, koMatches, bets, rulesText, players, availableClubs
      });
    } catch (e) {
      console.warn("Firebase Sync fehlgeschlagen oder nicht konfiguriert:", e);
    }
  }
}

function initFirebaseListener() {
  if (typeof firebase !== 'undefined' && firebase.database) {
    try {
      firebase.database().ref('tournament').on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
          if (data.teams) teams = data.teams;
          if (data.groups) groups = data.groups;
          if (data.groupMatches) groupMatches = data.groupMatches;
          if (data.koMatches) koMatches = data.koMatches;
          if (data.bets) bets = data.bets;
          if (data.rulesText) rulesText = data.rulesText;
          if (data.players) players = data.players;
          if (data.availableClubs) availableClubs = data.availableClubs;
          renderAll();
        }
      });
    } catch (e) {
      console.warn("Firebase Listener Fehler:", e);
    }
  }
}

// ==========================================
// 3. AUTH & RECHTE-MANAGEMENT
// ==========================================
function loginAsPlayer(name) {
  const p = players.find(x => x.name === name);
  if (!p) return;

  if (p.password) {
    const enteredPw = prompt(`Bitte Passwort für ${name} eingeben:`);
    if (enteredPw !== p.password) {
      alert('Falsches Passwort!');
      return;
    }
  }

  myPlayerName = name;
  localStorage.setItem('fal_my_player', myPlayerName);

  if (name === 'Tim') {
    currentRole = 'admin';
  } else if (p.isRef) {
    currentRole = 'ref';
  } else {
    currentRole = 'player';
  }
  localStorage.setItem('fal_role', currentRole);

  updateUserStatusDisplay();
  renderAll();
}

function logout() {
  myPlayerName = '';
  currentRole = 'spectator';
  localStorage.removeItem('fal_my_player');
  localStorage.setItem('fal_role', 'spectator');
  updateUserStatusDisplay();
  renderAll();
}

function isAdmin() { return currentRole === 'admin' || myPlayerName === 'Tim'; }
function isRef() { return currentRole === 'ref'; }
function canManageMatches() { return isAdmin() || isRef(); }

function getMyTeam() {
  if (!myPlayerName) return null;
  return teams.find(t => t.p1 === myPlayerName || t.p2 === myPlayerName) || null;
}

function updateUserStatusDisplay() {
  const statusEl = document.getElementById('user-status');
  if (!statusEl) return;

  if (myPlayerName) {
    let roleText = 'Spieler';
    if (isAdmin()) roleText = '👑 Admin (Tim)';
    else if (isRef()) roleText = '🟨 Schiedsrichter';

    statusEl.innerHTML = `Eingeloggt als: <strong>${myPlayerName}</strong> (${roleText}) <button class="btn-secondary" style="padding:2px 6px; margin-left:8px;" onclick="logout()">Abmelden</button>`;
  } else {
    statusEl.innerHTML = `Modus: <strong>Zuschauer</strong> (Logge dich unten in der Spielerliste ein)`;
  }
}

// ==========================================
// 4. SPIELER & CLUB VERWALTUNG (ADMIN)
// ==========================================
function addPlayer() {
  const input = document.getElementById('new-player-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return alert('Bitte Namen eingeben!');
  if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return alert('Spieler existiert bereits!');
  }

  players.push({ name: name, isRef: false, password: '' });
  input.value = '';
  saveData();
  renderAll();
}

function removePlayer(idx) {
  if (confirm(`Spieler "${players[idx].name}" wirklich löschen?`)) {
    players.splice(idx, 1);
    saveData();
    renderAll();
  }
}

function toggleRef(idx) {
  players[idx].isRef = !players[idx].isRef;
  saveData();
  renderAll();
}

function setPlayerPassword(idx) {
  const pw = prompt(`Neues Passwort für ${players[idx].name} eingeben:`);
  if (pw !== null) {
    players[idx].password = pw.trim();
    saveData();
    renderAll();
  }
}

function removePlayerPassword(idx) {
  players[idx].password = '';
  saveData();
  renderAll();
}

function addClub() {
  const input = document.getElementById('new-club-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  if (availableClubs.includes(name)) return alert('Club existiert bereits!');

  availableClubs.push(name);
  input.value = '';
  saveData();
  renderAll();
}

function removeClub(idx) {
  availableClubs.splice(idx, 1);
  saveData();
  renderAll();
}

function resetClubsToDefault() {
  if (confirm('Clubs auf Standard zurücksetzen?')) {
    availableClubs = [...DEFAULT_CLUBS];
    saveData();
    renderAll();
  }
}

// ==========================================
// 5. LIVE-DRAFT & GLÜCKSRAD (CANVAS FIX)
// ==========================================
function startInteractiveDraft() {
  if (players.length < 2) return alert('Es müssen mindestens 2 Spieler eingetragen sein!');
  if (players.length % 2 !== 0) {
    if (!confirm('Achtung: Ungerade Anzahl an Spielern! Ein Spieler bleibt übrig. Trotzdem starten?')) return;
  }

  draftState.remainingPlayers = players.map(p => p.name);
  draftState.remainingClubs = [...availableClubs];
  draftState.step = 1;
  draftState.active = true;
  draftState.currentP1 = null;
  draftState.currentP2 = null;
  draftState.currentClub = null;

  teams = [];
  groups = [];
  groupMatches = [];
  koMatches = [];
  saveData();

  openDraftModal();
}

function openDraftModal() {
  let modal = document.getElementById('draft-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'draft-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  renderDraftContent();
}

function closeDraftModal() {
  const modal = document.getElementById('draft-modal');
  if (modal) modal.style.display = 'none';
  draftState.active = false;
  renderAll();
}

function renderDraftContent() {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;

  let itemsToDraw = [];
  let title = '';

  if (draftState.step === 1) {
    title = '🎯 Spieler 1 drehen';
    itemsToDraw = draftState.remainingPlayers;
  } else if (draftState.step === 2) {
    title = `🎯 Partner für ${draftState.currentP1} drehen`;
    itemsToDraw = draftState.remainingPlayers;
  } else if (draftState.step === 3) {
    title = `⚽ Profi-Club für Team (${draftState.currentP1} & ${draftState.currentP2}) drehen`;
    itemsToDraw = draftState.remainingClubs.length > 0 ? draftState.remainingClubs : ['FC Random'];
  }

  modal.innerHTML = `
    <div class="modal-content" style="background:#1e293b; color:#fff; padding:20px; border-radius:12px; max-width:500px; width:90%; text-align:center; position:relative;">
      <h2>🎰 LIVE-Auslosungs-Show</h2>
      <h3>${title}</h3>

      <div style="position:relative; width:280px; height:280px; margin: 15px auto;">
        <div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-top:20px solid #f1c40f; z-index:10;"></div>
        <canvas id="wheel-canvas" width="280" height="280"></canvas>
      </div>

      <button id="btn-spin" class="btn-primary" style="font-size:1.2em; padding:10px 24px;" onclick="spinWheel()">🔥 RAD DREHEN!</button>

      <div style="margin-top:20px; text-align:left; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
        <h4>Bisher geloste Teams (${teams.length}):</h4>
        <ul style="max-height:120px; overflow-y:auto; margin:0; padding-left:20px;">
          ${teams.map(t => `<li><strong>${t.name}:</strong> ${t.p1} & ${t.p2} (${t.club})</li>`).join('')}
        </ul>
      </div>

      <button class="btn-secondary" style="margin-top:15px;" onclick="closeDraftModal()">Draft beenden / Schließen</button>
    </div>
  `;

  setTimeout(() => drawWheel(itemsToDraw), 50);
}

// GLÜCKSRAD RENDER-FUNKTION (MIT GEWÄHRLEISTETER TEXT-ANZEIGE)
function drawWheel(items) {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const radius = width / 2;

  ctx.clearRect(0, 0, width, height);

  if (!items || items.length === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keine Elemente', radius, radius);
    return;
  }

  const numSegments = items.length;
  const arcSize = (2 * Math.PI) / numSegments;
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];

  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(draftState.angle);

  for (let i = 0; i < numSegments; i++) {
    const angle = i * arcSize;
    ctx.beginPath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 5, angle, angle + arcSize);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.stroke();

    // TEXT RENDER LOGIK
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.rotate(angle + arcSize / 2);
    
    let text = items[i];
    if (text.length > 16) text = text.substring(0, 14) + '..';
    ctx.fillText(text, radius - 15, 4);
    ctx.restore();
  }

  ctx.restore();
}

function spinWheel() {
  if (draftState.isSpinning) return;

  let items = [];
  if (draftState.step === 1 || draftState.step === 2) items = draftState.remainingPlayers;
  else if (draftState.step === 3) items = draftState.remainingClubs.length > 0 ? draftState.remainingClubs : ['FC Random'];

  if (items.length === 0) return;

  draftState.isSpinning = true;
  const btn = document.getElementById('btn-spin');
  if (btn) btn.disabled = true;

  const selectedIndex = Math.floor(Math.random() * items.length);
  const numSegments = items.length;
  const arcSize = (2 * Math.PI) / numSegments;

  // Berechne Zielwinkel, sodass das gewählte Segment oben bei der Nadel landet (270 Grad / 1.5 Pi)
  const targetSegmentCenter = (selectedIndex * arcSize) + (arcSize / 2);
  const targetRotation = (1.5 * Math.PI) - targetSegmentCenter;
  const extraRounds = (Math.floor(Math.random() * 3) + 4) * (2 * Math.PI);
  
  const totalRotationNeeded = extraRounds + (targetRotation - (draftState.angle % (2 * Math.PI)));
  const startAngle = draftState.angle;
  const duration = 3500;
  const startTime = performance.now();

  function animateWheel(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-Out Cubic Effekt für realistisches Abbremsen
    const easeOut = 1 - Math.pow(1 - progress, 3);
    draftState.angle = startAngle + (totalRotationNeeded * easeOut);

    drawWheel(items);

    if (progress < 1) {
      requestAnimationFrame(animateWheel);
    } else {
      draftState.isSpinning = false;
      const wonItem = items[selectedIndex];
      handleDraftResult(wonItem);
    }
  }

  requestAnimationFrame(animateWheel);
}

function handleDraftResult(wonItem) {
  if (draftState.step === 1) {
    draftState.currentP1 = wonItem;
    draftState.remainingPlayers = draftState.remainingPlayers.filter(p => p !== wonItem);
    draftState.step = 2;
  } else if (draftState.step === 2) {
    draftState.currentP2 = wonItem;
    draftState.remainingPlayers = draftState.remainingPlayers.filter(p => p !== wonItem);
    draftState.step = 3;
  } else if (draftState.step === 3) {
    draftState.currentClub = wonItem;
    if (draftState.remainingClubs.includes(wonItem)) {
      draftState.remainingClubs = draftState.remainingClubs.filter(c => c !== wonItem);
    }

    // Team Speichern
    const newTeamId = teams.length + 1;
    teams.push({
      id: newTeamId,
      name: `Team ${newTeamId}`,
      p1: draftState.currentP1,
      p2: draftState.currentP2,
      club: draftState.currentClub
    });

    saveData();

    // Reset für nächstes Team
    draftState.currentP1 = null;
    draftState.currentP2 = null;
    draftState.currentClub = null;

    if (draftState.remainingPlayers.length >= 2) {
      draftState.step = 1;
    } else {
      alert('🎉 Alle Teams wurden erfolgreich ausgelost!');
      closeDraftModal();
      return;
    }
  }

  renderDraftContent();
}

// ==========================================
// 6. GRUPPEN- & MATCH-GENERIERUNG (KORRIGIERT)
// ==========================================
function drawGroups() {
  if (teams.length < 2) return alert('Es müssen mindestens 2 Teams existieren!');

  const numGroups = teams.length >= 8 ? 4 : 2;
  const groupLetters = ['Gruppe A', 'Gruppe B', 'Gruppe C', 'Gruppe D'].slice(0, numGroups);

  // Teams mischen
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

  groups = groupLetters.map(letter => ({ letter: letter, teams: [] }));

  shuffledTeams.forEach((team, idx) => {
    groups[idx % numGroups].teams.push(team.id);
  });

  generateGroupMatches();
  saveData();
  renderAll();
}

function generateGroupMatches() {
  groupMatches = [];
  let matchIdCounter = 1;

  groups.forEach(group => {
    const tIds = group.teams;
    const n = tIds.length;

    // Jeder gegen Jeden innerhalb der Gruppe
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        groupMatches.push({
          id: matchIdCounter++,
          group: group.letter,
          t1Id: tIds[i],
          t2Id: tIds[j],
          score1: null,
          score2: null,
          played: false,
          court: 'Hauptplatz',
          slot: 1
        });
      }
    }
  });

  // Zeitfenster (Slots) & Plätze fair verteilen
  assignCourtsAndSlots();
}

function assignCourtsAndSlots() {
  let currentSlot = 1;
  let courtToggle = false;

  groupMatches.forEach((m, idx) => {
    m.slot = Math.floor(idx / 2) + 1;
    m.court = courtToggle ? 'Nebenplatz' : 'Hauptplatz';
    courtToggle = !courtToggle;
  });
}

// ==========================================
// 7. KO-PHASE GENERIERUNG
// ==========================================
function drawKOPhase() {
  if (groups.length === 0) return alert('Zuerst müssen die Gruppen ausgelost und gespielt werden!');

  const standings = calculateGroupStandings();
  koMatches = [];

  if (groups.length === 4) {
    // 4 Gruppen -> Viertelfinale (Über-Kreuz)
    const gA = standings.find(g => g.letter === 'Gruppe A').rankings;
    const gB = standings.find(g => g.letter === 'Gruppe B').rankings;
    const gC = standings.find(g => g.letter === 'Gruppe C').rankings;
    const gD = standings.find(g => g.letter === 'Gruppe D').rankings;

    koMatches.push(
      { id: 101, round: '⚔️ Viertelfinale 1', t1Id: gA[0].teamId, t2Id: gB[1].teamId, score1: null, score2: null, played: false, court: 'Hauptplatz' },
      { id: 102, round: '⚔️ Viertelfinale 2', t1Id: gB[0].teamId, t2Id: gA[1].teamId, score1: null, score2: null, played: false, court: 'Nebenplatz' },
      { id: 103, round: '⚔️ Viertelfinale 3', t1Id: gC[0].teamId, t2Id: gD[1].teamId, score1: null, score2: null, played: false, court: 'Hauptplatz' },
      { id: 104, round: '⚔️ Viertelfinale 4', t1Id: gD[0].teamId, t2Id: gC[1].teamId, score1: null, score2: null, played: false, court: 'Nebenplatz' }
    );
  } else {
    // 2 Gruppen -> Halbfinale direkt
    const gA = standings.find(g => g.letter === 'Gruppe A').rankings;
    const gB = standings.find(g => g.letter === 'Gruppe B').rankings;

    koMatches.push(
      { id: 201, round: '🔥 Halbfinale 1', t1Id: gA[0].teamId, t2Id: gB[1].teamId, score1: null, score2: null, played: false, court: 'Hauptplatz' },
      { id: 202, round: '🔥 Halbfinale 2', t1Id: gB[0].teamId, t2Id: gA[1].teamId, score1: null, score2: null, played: false, court: 'Nebenplatz' }
    );
  }

  saveData();
  renderAll();
}

function drawSemifinals() {
  const qf = koMatches.filter(m => m.round.includes('Viertelfinale'));
  if (qf.length < 4 || qf.some(m => !m.played)) {
    return alert('Alle Viertelfinalspiele müssen zuerst gespielt sein!');
  }

  const w1 = qf[0].score1 > qf[0].score2 ? qf[0].t1Id : qf[0].t2Id;
  const w2 = qf[1].score1 > qf[1].score2 ? qf[1].t1Id : qf[1].t2Id;
  const w3 = qf[2].score1 > qf[2].score2 ? qf[2].t1Id : qf[2].t2Id;
  const w4 = qf[3].score1 > qf[3].score2 ? qf[3].t1Id : qf[3].t2Id;

  koMatches = koMatches.filter(m => !m.round.includes('Halbfinale') && !m.round.includes('Finale') && !m.round.includes('Platz 3'));

  koMatches.push(
    { id: 201, round: '🔥 Halbfinale 1', t1Id: w1, t2Id: w4, score1: null, score2: null, played: false, court: 'Hauptplatz' },
    { id: 202, round: '🔥 Halbfinale 2', t1Id: w2, t2Id: w3, score1: null, score2: null, played: false, court: 'Nebenplatz' }
  );

  saveData();
  renderAll();
}

function drawFinals() {
  const sf = koMatches.filter(m => m.round.includes('Halbfinale'));
  if (sf.length < 2 || sf.some(m => !m.played)) {
    return alert('Alle Halbfinalspiele müssen erst absolviert werden!');
  }

  const w1 = sf[0].score1 > sf[0].score2 ? sf[0].t1Id : sf[0].t2Id;
  const l1 = sf[0].score1 > sf[0].score2 ? sf[0].t2Id : sf[0].t1Id;

  const w2 = sf[1].score1 > sf[1].score2 ? sf[1].t1Id : sf[1].t2Id;
  const l2 = sf[1].score1 > sf[1].score2 ? sf[1].t2Id : sf[1].t1Id;

  koMatches = koMatches.filter(m => !m.round.includes('Finale') && !m.round.includes('Platz 3'));

  koMatches.push(
    { id: 301, round: '🥉 Spiel um Platz 3', t1Id: l1, t2Id: l2, score1: null, score2: null, played: false, court: 'Nebenplatz' },
    { id: 302, round: '🏆 FINALE', t1Id: w1, t2Id: w2, score1: null, score2: null, played: false, court: 'Hauptplatz' }
  );

  saveData();
  renderAll();
}

function resetTournament() {
  if (confirm('🚨 MÖCHTEST DU DAS TURNIER WIRKLICH VOLLSTÄNDIG ZURÜCKSETZEN? Alle Ergebnisse, Teams und Gruppen werden gelöscht!')) {
    teams = [];
    groups = [];
    groupMatches = [];
    koMatches = [];
    bets = {};
    saveData();
    renderAll();
  }
}

// ==========================================
// 8. ERGEBNIS- & TEAM-UPDATES
// ==========================================
function updateTeamName(teamId, newName) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return;

  const isMyTeam = (myPlayerName && (team.p1 === myPlayerName || team.p2 === myPlayerName));

  if (canManageMatches() || isMyTeam) {
    team.name = newName.trim() || `Team ${team.id}`;
    saveData();
  } else {
    alert('Du kannst nur deinen eigenen Team-Namen bearbeiten!');
    renderAll();
  }
}

function updateMatchScore(matchId, isKO, score1Val, score2Val) {
  const matchArray = isKO ? koMatches : groupMatches;
  const match = matchArray.find(m => m.id === matchId);
  if (!match) return;

  const myTeam = getMyTeam();
  const canEdit = canManageMatches() || (myTeam && (match.t1Id === myTeam.id || match.t2Id === myTeam.id));

  if (!canEdit) {
    alert('Du darfst nur Ergebnisse eintragen, bei denen dein Team mitspielt!');
    renderAll();
    return;
  }

  if (score1Val === '' || score2Val === '') {
    match.score1 = null; match.score2 = null; match.played = false;
  } else {
    const s1 = parseInt(score1Val, 10);
    const s2 = parseInt(score2Val, 10);

    if (isKO && s1 === s2) return alert('In der KO-Phase muss es einen Sieger geben!');

    match.score1 = s1; match.score2 = s2; match.played = true;

    if (match.round === '🏆 FINALE') {
      const winnerTeamId = s1 > s2 ? match.t1Id : match.t2Id;
      const winnerTeam = teams.find(t => t.id === winnerTeamId);

      if (winnerTeam) {
        setTimeout(() => {
          alert(`🎉 🏆 DIE SIEGER DES FAL FIFA TURNIERS SIND: 🏆 🎉\n\n🥇 ${winnerTeam.p1} & ${winnerTeam.p2} (${winnerTeam.name} - ${winnerTeam.club || ''}) 🥇\n\nHerzlichen Glückwunsch! 👏🥳`);
        }, 300);
      }
    }
  }

  saveData();
  renderAll();
}

// ==========================================
// 9. TIPP-SPIEL & REGELN LOGIK
// ==========================================
function placeBet(teamId) {
  if (!myPlayerName) {
    return alert('Du musst angemeldet sein, um einen Tipp abzugeben!');
  }

  bets[myPlayerName] = parseInt(teamId, 10);
  saveData();
  renderAll();
}

function toggleRulesEdit() {
  const display = document.getElementById('rules-display-area');
  const edit = document.getElementById('rules-edit-area');
  const textarea = document.getElementById('rules-textarea');

  if (edit.style.display === 'none') {
    edit.style.display = 'block';
    display.style.display = 'none';
    if (textarea) textarea.value = rulesText;
  } else {
    edit.style.display = 'none';
    display.style.display = 'block';
  }
}

function saveRules() {
  const textarea = document.getElementById('rules-textarea');
  if (!textarea) return;

  rulesText = textarea.value;
  saveData();
  toggleRulesEdit();
  renderAll();
}

// ==========================================
// 10. RENDER LOGIK & UI-STEUERUNG
// ==========================================
function renderAll() {
  updateUserStatusDisplay();
  renderDashboard();
  renderTeams();
  renderGroups();
  renderMatches();
  renderAdminPanel();
}

function renderDashboard() {
  // 1. RULES RENDER
  const rulesDisplay = document.getElementById('rules-display-area');
  const editRulesBtn = document.getElementById('btn-edit-rules');
  if (rulesDisplay) {
    rulesDisplay.innerText = rulesText || DEFAULT_RULES;
  }
  if (editRulesBtn) {
    editRulesBtn.style.display = isAdmin() ? 'inline-block' : 'none';
  }

  // 2. WETTBASIS / TIPP-SPIEL RENDER
  const bettingContainer = document.getElementById('betting-container');
  if (bettingContainer) {
    if (teams.length === 0) {
      bettingContainer.innerHTML = '<p class="empty-state">Tipps können erst abgegeben werden, sobald die Teams feststehen.</p>';
    } else {
      const myCurrentBet = myPlayerName ? bets[myPlayerName] : null;
      
      const totalVotes = Object.keys(bets).length;
      const votesPerTeam = {};
      teams.forEach(t => votesPerTeam[t.id] = 0);
      Object.values(bets).forEach(tId => {
        if (votesPerTeam[tId] !== undefined) votesPerTeam[tId]++;
      });

      let betOptionsHtml = teams.map(t => {
        const isSelected = myCurrentBet === t.id;
        const count = votesPerTeam[t.id] || 0;
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

        return `
          <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div>
              <strong>${t.name}</strong> <small>(${t.p1} & ${t.p2})</small> ${t.club ? `⚽ <em>${t.club}</em>` : ''}
              <div style="font-size:0.8em; opacity:0.8;">Quoten-Anteil: <strong>${percent}%</strong> (${count} Stimme/n)</div>
            </div>
            <button class="${isSelected ? 'btn-primary' : 'btn-secondary'}" style="padding:6px 12px; font-size:0.9em;" onclick="placeBet(${t.id})">
              ${isSelected ? '✅ Dein Tipp' : 'Tippen 🎯'}
            </button>
          </div>
        `;
      }).join('');

      bettingContainer.innerHTML = `
        <p style="font-size:0.9em; opacity:0.9;">Tippe auf das Team, das deiner Meinung nach das Turnier gewinnt!</p>
        ${betOptionsHtml}
      `;
    }
  }

  // 3. STATS & ANALYTICS DASHBOARD RENDER
  const statsContainer = document.getElementById('stats-dashboard-container');
  if (statsContainer) {
    if (teams.length === 0) {
      statsContainer.innerHTML = '<p class="empty-state">Sobald Spiele absolviert wurden, erscheinen hier Statistiken.</p>';
      return;
    }

    let allMatches = [...groupMatches, ...koMatches].filter(m => m.played);
    
    let stats = {};
    teams.forEach(t => {
      stats[t.id] = { id: t.id, name: t.name, club: t.club, gf: 0, ga: 0, won: 0, played: 0 };
    });

    allMatches.forEach(m => {
      if (stats[m.t1Id]) {
        stats[m.t1Id].gf += m.score1;
        stats[m.t1Id].ga += m.score2;
        stats[m.t1Id].played++;
        if (m.score1 > m.score2) stats[m.t1Id].won++;
      }
      if (stats[m.t2Id]) {
        stats[m.t2Id].gf += m.score2;
        stats[m.t2Id].ga += m.score1;
        stats[m.t2Id].played++;
        if (m.score2 > m.score1) stats[m.t2Id].won++;
      }
    });

    let teamList = Object.values(stats);
    let topScorer = [...teamList].sort((a,b) => b.gf - a.gf)[0];
    let bestDefense = [...teamList].sort((a,b) => a.ga - b.ga)[0];

    let totalWinScore = 0;
    teamList.forEach(t => {
      let winRate = t.played > 0 ? (t.won / t.played) : 0.5;
      let diff = t.gf - t.ga;
      t.powerIndex = Math.max(1, (winRate * 50) + (diff * 2) + 10);
      totalWinScore += t.powerIndex;
    });

    teamList.forEach(t => {
      t.winChance = Math.round((t.powerIndex / totalWinScore) * 100);
    });

    let bestChanceTeam = [...teamList].sort((a,b) => b.winChance - a.winChance)[0];

    statsContainer.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:15px;">
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; border-top:3px solid #f1c40f;">
          <div style="font-size:0.8em; opacity:0.8;">🔥 Torfabrik (Meiste Tore)</div>
          <div style="font-weight:bold; font-size:1.1em; margin-top:4px; color:#f1c40f;">
            ${topScorer && topScorer.gf > 0 ? `${topScorer.name} (${topScorer.gf}⚽)` : 'Noch keine Tore'}
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; border-top:3px solid #2ecc71;">
          <div style="font-size:0.8em; opacity:0.8;">🛡️ Abwehrbollwerk (Wenigste Gegentore)</div>
          <div style="font-weight:bold; font-size:1.1em; margin-top:4px; color:#2ecc71;">
            ${bestDefense && bestDefense.played > 0 ? `${bestDefense.name} (${bestDefense.ga} 🥊)` : 'Noch keine Spiele'}
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:center; border-top:3px solid #3498db;">
          <div style="font-size:0.8em; opacity:0.8;">📈 Höchste KI-Siegchance</div>
          <div style="font-weight:bold; font-size:1.1em; margin-top:4px; color:#3498db;">
            ${bestChanceTeam ? `${bestChanceTeam.name} (${bestChanceTeam.winChance}%)` : '-'}
          </div>
        </div>
      </div>
    `;
  }
}

function renderTeams() {
  const container = document.getElementById('teams-container');
  if (!container) return;

  if (teams.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Teams gelost. Gehe in den Admin-Bereich und starte die Auslosungs-Show.</p>';
    return;
  }

  container.innerHTML = teams.map(t => {
    const isMyTeam = (myPlayerName && (t.p1 === myPlayerName || t.p2 === myPlayerName));
    const canEditName = canManageMatches() || isMyTeam;
    const clubBadgeHtml = t.club ? `<div class="club-badge">⚽ ${t.club}</div>` : '';

    return `
      <div class="admin-card ${isMyTeam ? 'highlight-me' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <input type="text" value="${t.name}" 
                 ${canEditName ? '' : 'disabled'} 
                 onchange="updateTeamName(${t.id}, this.value)"
                 style="font-weight: bold; font-size: 1.1em; max-width: 180px;">
          ${clubBadgeHtml}
        </div>
        ${isMyTeam ? '<div style="color:var(--fal-yellow, #f1c40f); font-size:0.85em; font-weight:bold; margin-top:4px;">⭐ (Dein Team)</div>' : ''}
        <p style="margin-top: 8px; margin-bottom: 0;"><strong>Spieler:</strong> ${t.p1} & ${t.p2}</p>
      </div>
    `;
  }).join('');
}

function calculateGroupStandings() {
  return groups.map(group => {
    const teamStats = {};
    group.teams.forEach(teamId => {
      const tObj = teams.find(t => t.id === teamId);
      teamStats[teamId] = {
        teamId: teamId,
        name: tObj ? tObj.name : `Team ${teamId}`,
        p1: tObj ? tObj.p1 : '',
        p2: tObj ? tObj.p2 : '',
        club: tObj ? tObj.club : '',
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, diff: 0, points: 0
      };
    });

    groupMatches.filter(m => m.group === group.letter && m.played).forEach(m => {
      const t1 = teamStats[m.t1Id];
      const t2 = teamStats[m.t2Id];
      if (t1 && t2) {
        t1.played++; t2.played++;
        t1.gf += m.score1; t1.ga += m.score2;
        t2.gf += m.score2; t2.ga += m.score1;

        if (m.score1 > m.score2) {
          t1.won++; t1.points += 3; t2.lost++;
        } else if (m.score2 > m.score1) {
          t2.won++; t2.points += 3; t1.lost++;
        } else {
          t1.drawn++; t2.drawn++;
          t1.points += 1; t2.points += 1;
        }
      }
    });

    Object.values(teamStats).forEach(s => {
      s.diff = s.gf - s.ga;
    });

    const sorted = Object.values(teamStats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.gf - a.gf;
    });

    return { letter: group.letter, rankings: sorted };
  });
}

function renderGroups() {
  const container = document.getElementById('groups-container');
  if (!container) return;

  if (groups.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Gruppen ausgelost.</p>';
    return;
  }

  const standings = calculateGroupStandings();

  container.innerHTML = standings.map(g => `
    <div class="admin-card" style="margin-bottom: 20px;">
      <h3 style="color: var(--fal-yellow, #f1c40f); margin-top: 0;">${g.letter}</h3>
      <div style="overflow-x: auto;">
        <table class="table-standings">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Sp</th>
              <th>S</th>
              <th>U</th>
              <th>N</th>
              <th>Tore</th>
              <th>Diff</th>
              <th>Pkt</th>
            </tr>
          </thead>
          <tbody>
            ${g.rankings.map((t, idx) => {
              const myTeam = getMyTeam();
              const isMyTeam = myTeam && myTeam.id === t.teamId;
              return `
                <tr class="${isMyTeam ? 'highlight-me-row' : ''}">
                  <td><strong>${idx + 1}</strong></td>
                  <td>${t.name} <small>(${t.p1} & ${t.p2})</small> ${t.club ? `⚽ <em>${t.club}</em>` : ''}</td>
                  <td>${t.played}</td>
                  <td>${t.won}</td>
                  <td>${t.drawn}</td>
                  <td>${t.lost}</td>
                  <td>${t.gf}:${t.ga}</td>
                  <td>${t.diff > 0 ? '+' + t.diff : t.diff}</td>
                  <td><strong>${t.points}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function renderMatches() {
  const container = document.getElementById('matches-container');
  if (!container) return;

  if (groupMatches.length === 0 && koMatches.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Spiele vorhanden.</p>';
    return;
  }

  let html = '';

  if (groupMatches.length > 0) {
    html += `<h2 style="color:var(--fal-yellow, #f1c40f); margin-top: 0;">🏟️ Gruppenspiele</h2>`;

    const slots = [...new Set(groupMatches.map(m => m.slot))].sort((a, b) => a - b);

    slots.forEach(slot => {
      const matchesInSlot = groupMatches.filter(m => m.slot === slot);
      html += `
        <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; opacity: 0.8;">Zeitfenster / Runde ${slot}</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
            ${matchesInSlot.map(m => renderMatchCard(m, false)).join('')}
          </div>
        </div>
      `;
    });
  }

  if (koMatches.length > 0) {
    html += `<h2 style="color:var(--fal-yellow, #f1c40f); margin-top: 25px;">🏆 KO-Phase</h2>`;
    html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">`;
    html += koMatches.map(m => renderMatchCard(m, true)).join('');
    html += `</div>`;
  }

  container.innerHTML = html;
}

function renderMatchCard(match, isKO) {
  const t1 = teams.find(t => t.id === match.t1Id);
  const t2 = teams.find(t => t.id === match.t2Id);
  const myTeam = getMyTeam();
  const isMyMatch = myTeam && (match.t1Id === myTeam.id || match.t2Id === myTeam.id);
  const canEdit = canManageMatches() || isMyMatch;

  const t1Name = t1 ? t1.name : 'TBD';
  const t2Name = t2 ? t2.name : 'TBD';

  const val1 = match.score1 !== null ? match.score1 : '';
  const val2 = match.score2 !== null ? match.score2 : '';

  return `
    <div class="admin-card ${isMyMatch ? 'highlight-me' : ''}" style="border-left: 4px solid ${match.court === 'Hauptplatz' ? '#FFD700' : '#4FC3F7'};">
      <div style="display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.8; margin-bottom: 6px;">
        <span>${isKO ? match.round : match.group}</span>
        <span>📍 ${match.court}</span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <span style="flex: 1; text-align: right; font-weight: bold; ${myTeam && t1 && t1.id === myTeam.id ? 'color: var(--fal-yellow, #f1c40f);' : ''}">
          ${t1Name}
        </span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <input type="number" min="0" max="99" value="${val1}" 
                 ${canEdit ? '' : 'disabled'}
                 onchange="updateMatchScore(${match.id}, ${isKO}, this.value, this.parentNode.querySelector('.score-2').value)"
                 class="score-1" style="width: 40px; text-align: center; padding: 4px; font-weight: bold;">
          <span>:</span>
          <input type="number" min="0" max="99" value="${val2}" 
                 ${canEdit ? '' : 'disabled'}
                 onchange="updateMatchScore(${match.id}, ${isKO}, this.parentNode.querySelector('.score-1').value, this.value)"
                 class="score-2" style="width: 40px; text-align: center; padding: 4px; font-weight: bold;">
        </div>
        <span style="flex: 1; text-align: left; font-weight: bold; ${myTeam && t2 && t2.id === myTeam.id ? 'color: var(--fal-yellow, #f1c40f);' : ''}">
          ${t2Name}
        </span>
      </div>
      ${match.played ? `<div style="text-align: center; font-size: 0.75em; color: #4CAF50; margin-top: 4px;">✔ Beendet</div>` : ''}
    </div>
  `;
}

// SPIELER-VERWALTUNG IM ADMIN-PANEL (VOLLSTÄNDIG WIEDERHERGESTELLT)
function renderAdminPanel() {
  const container = document.getElementById('admin-container');
  if (!container) return;

  if (!isAdmin()) {
    container.innerHTML = '<p class="empty-state">🔒 Nur für den Admin (Tim) zugänglich.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-card">
      <h3>👥 Spielerverwaltung (${players.length})</h3>
      <div style="display: flex; gap: 8px; margin-bottom: 15px;">
        <input type="text" id="new-player-name" placeholder="Neuer Spieler Name..." style="flex: 1;">
        <button class="btn-primary" onclick="addPlayer()">Hinzufügen</button>
      </div>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${players.map((p, idx) => `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span>
              <strong>${p.name}</strong> 
              ${p.isRef ? '<span style="color:#f1c40f;">🟨 (Schiedsrichter)</span>' : ''} 
              ${p.password ? '🔒' : ''}
            </span>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.8em;" onclick="loginAsPlayer('${p.name}')">
                Einloggen
              </button>
              <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.8em;" onclick="toggleRef(${idx})">
                ${p.isRef ? 'Ref-Rechte entziehen' : 'Als Ref setzen'}
              </button>
              <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.8em;" onclick="setPlayerPassword(${idx})">
                PW ${p.password ? 'ändern' : 'setzen'}
              </button>
              ${p.password ? `<button class="btn-secondary" style="padding: 3px 8px; font-size: 0.8em; color: #ff6b6b;" onclick="removePlayerPassword(${idx})">PW löschen</button>` : ''}
              <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.8em; color: #ff6b6b;" onclick="removePlayer(${idx})">❌</button>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>

    <div class="admin-card" style="margin-top: 20px;">
      <h3>⚽ Profi-Clubs (${availableClubs.length})</h3>
      <div style="display: flex; gap: 8px; margin-bottom: 15px;">
        <input type="text" id="new-club-name" placeholder="Neuer Profi-Club..." style="flex: 1;">
        <button class="btn-primary" onclick="addClub()">Hinzufügen</button>
        <button class="btn-secondary" onclick="resetClubsToDefault()">Standard-Reset</button>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        ${availableClubs.map((club, idx) => `
          <span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.9em; display: inline-flex; align-items: center; gap: 6px;">
            ${club}
            <span style="cursor: pointer; color: #ff6b6b;" onclick="removeClub(${idx})">×</span>
          </span>
        `).join('')}
      </div>
    </div>

    <div class="admin-card" style="margin-top: 20px;">
      <h3>⚙️ Turnier-Steuerung</h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button class="btn-primary" onclick="startInteractiveDraft()">🎰 LIVE-Auslosung (Draft) starten</button>
        <button class="btn-secondary" onclick="drawGroups()">📊 Gruppen & Spielplan auslosen</button>
        <button class="btn-secondary" onclick="drawKOPhase()">⚔️ Viertelfinale auslosen (4 Gruppen)</button>
        <button class="btn-secondary" onclick="drawSemifinals()">🔥 Halbfinale auslosen / anlegen</button>
        <button class="btn-secondary" onclick="drawFinals()">🏆 Finale & Spiel um Platz 3 anlegen</button>
        <button class="btn-secondary" style="background: #a72626; color: white; margin-top: 10px;" onclick="resetTournament()">🚨 Turnier komplett zurücksetzen</button>
      </div>
    </div>
  `;
}

// ==========================================
// 11. INITIALISIERUNG BEIM START
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initFirebaseListener();
  renderAll();
});
