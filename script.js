// ==========================================
// 0. GLOBAL VERFÜGBAR MACHEN (WINDOW EXPORTS)
// ==========================================
window.showExistingPlayers = showExistingPlayers;
window.showNewPlayerInput = showNewPlayerInput;
window.resetRoleSelection = resetRoleSelection;
window.enterAsSpectator = enterAsSpectator;
window.switchUser = switchUser;
window.selectMyPlayer = selectMyPlayer;
window.registerNewPlayer = registerNewPlayer;
window.confirmAdminPassword = confirmAdminPassword;
window.showTab = showTab;
window.addPlayer = addPlayer;
window.removePlayer = removePlayer;
window.toggleRef = toggleRef;
window.setPlayerPassword = setPlayerPassword;
window.removePlayerPassword = removePlayerPassword;
window.drawGroups = drawGroups;
window.drawKOPhase = drawKOPhase;
window.drawSemifinals = drawSemifinals;
window.drawFinals = drawFinals;
window.resetTournament = resetTournament;
window.updateTeamName = updateTeamName;
window.updateMatchScore = updateMatchScore;
window.addClub = addClub;
window.removeClub = removeClub;
window.resetClubsToDefault = resetClubsToDefault;
window.startInteractiveDraft = startInteractiveDraft;
window.spinWheel = spinWheel;
window.nextDraftStep = nextDraftStep;
window.finishDraft = finishDraft;

// ==========================================
// 1. FIREBASE KONFIGURATION & INIT
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBh0yOA1ckPp3TFBJ-Yz932k9A2R1pkTSc",
  authDomain: "fal-fifa-turnier.firebaseapp.com",
  databaseURL: "https://fal-fifa-turnier-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fal-fifa-turnier",
  storageBucket: "fal-fifa-turnier.firebasestorage.app",
  messagingSenderId: "1095058810971",
  appId: "1:1095058810971:web:2023d72275ed8c22e2b77e"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const ADMIN_PASSWORD = "1234";

const DEFAULT_CLUBS = [
  "Real Madrid", "FC Bayern", "Manchester City", "Arsenal", 
  "FC Barcelona", "PSG", "Inter Mailand", "Bayer Leverkusen",
  "FC Liverpool", "Juventus", "Atletico Madrid", "Borussia Dortmund"
];

const WHEEL_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f", 
  "#9b59b6", "#e67e22", "#1abc9c", "#34495e"
];

// ==========================================
// 2. GLOBALE ZUSTÄNDE & VARIANTE
// ==========================================
let players = [];
let availableClubs = [...DEFAULT_CLUBS];
let teams = [];
let groups = [];
let groupMatches = [];
let koMatches = [];
let myPlayerName = localStorage.getItem('fifa_my_player') || null;
let pendingAdminLogin = false;

// Interaktive Auslosung State
let draftState = {
  active: false,
  pairs: [],
  currentIndex: 0,
  remainingClubs: [],
  spinning: false,
  startTime: null,
  targetAngle: 0,
  duration: 4000,
  lastDrawnClub: null
};

let animFrameId = null;
let lastRenderedIndex = -1;
let lastRenderedSpinning = false;

// ==========================================
// HELFER & AUTH PRÜFUNGEN
// ==========================================
function getPlayerObj(name) {
  if (!name) return null;
  return players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
}

function isAdmin() {
  return myPlayerName && myPlayerName.trim().toLowerCase() === 'tim';
}

function isRef() {
  const p = getPlayerObj(myPlayerName);
  return p && p.isRef;
}

function canManageMatches() {
  return isAdmin() || isRef();
}

function getMyTeam() {
  if (!myPlayerName) return null;
  return teams.find(t => t.p1 === myPlayerName || t.p2 === myPlayerName);
}

// ==========================================
// DOM CONTENT LOADED EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const btnShowNew = document.getElementById('btn-show-new');
  if (btnShowNew) btnShowNew.addEventListener('click', showNewPlayerInput);

  const btnShowExisting = document.getElementById('btn-show-existing');
  if (btnShowExisting) btnShowExisting.addEventListener('click', showExistingPlayers);

  const btnSpectator = document.getElementById('btn-enter-spectator');
  if (btnSpectator) btnSpectator.addEventListener('click', enterAsSpectator);

  const btnRegister = document.getElementById('btn-register-new');
  if (btnRegister) btnRegister.addEventListener('click', registerNewPlayer);

  const btnConfirmAdmin = document.getElementById('btn-confirm-admin');
  if (btnConfirmAdmin) btnConfirmAdmin.addEventListener('click', confirmAdminPassword);

  const btnSwitchUser = document.getElementById('btn-switch-user');
  if (btnSwitchUser) btnSwitchUser.addEventListener('click', switchUser);

  document.querySelectorAll('.btn-reset-role').forEach(btn => {
    btn.addEventListener('click', resetRoleSelection);
  });

  if (myPlayerName) {
    enterAsSpectator();
  }
});

// ==========================================
// 3. ROLLEN & LOGIN LOGIK
// ==========================================
function enterAsSpectator() {
  document.getElementById('role-selection-modal').style.display = 'none';
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('app-nav').style.display = 'flex';
  document.getElementById('app-main').style.display = 'block';
  
  const userBadge = document.getElementById('user-badge');
  if (userBadge) {
    let roleTag = '';
    if (isAdmin()) roleTag = '⭐ (Admin)';
    else if (isRef()) roleTag = '🟨 (Ref)';

    userBadge.innerHTML = myPlayerName 
      ? `Angemeldet als: <strong>${myPlayerName}</strong> ${roleTag}`
      : 'Modus: <strong>Zuschauer</strong>';
  }

  const adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = isAdmin() ? 'inline-block' : 'none';

  showTab('teams');
}

function switchUser() {
  localStorage.removeItem('fifa_my_player');
  myPlayerName = null;
  
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('app-nav').style.display = 'none';
  document.getElementById('app-main').style.display = 'none';
  
  resetRoleSelection();
  document.getElementById('role-selection-modal').style.display = 'flex';
}

function showNewPlayerInput() {
  document.getElementById('role-options').style.display = 'none';
  document.getElementById('new-player-select').style.display = 'block';
  document.getElementById('existing-players-select').style.display = 'none';
  document.getElementById('admin-password-select').style.display = 'none';
}

function showExistingPlayers() {
  const container = document.getElementById('existing-players-list');
  if (!container) return;

  if (players.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Spieler registriert.</p>';
  } else {
    container.innerHTML = players.map(p => `
      <button class="btn-secondary" style="margin: 4px; width: auto;" onclick="selectMyPlayer('${p.name}')">
        ${p.name} ${p.isRef ? '🟨' : ''} ${p.password ? '🔒' : ''}
      </button>
    `).join('');
  }
  
  document.getElementById('role-options').style.display = 'none';
  document.getElementById('new-player-select').style.display = 'none';
  document.getElementById('existing-players-select').style.display = 'block';
  document.getElementById('admin-password-select').style.display = 'none';
}

function resetRoleSelection() {
  pendingAdminLogin = false;
  document.getElementById('role-options').style.display = 'block';
  document.getElementById('new-player-select').style.display = 'none';
  document.getElementById('existing-players-select').style.display = 'none';
  document.getElementById('admin-password-select').style.display = 'none';
}

function selectMyPlayer(name) {
  const pObj = getPlayerObj(name);

  if (name.trim().toLowerCase() === 'tim') {
    promptPassword('admin', name, '🔒 Admin-Login für Tim: Bitte Passwort eingeben');
    return;
  }

  if (pObj && pObj.password) {
    promptPassword('player', name, `🔒 Passwort für ${name} eingeben:`);
    return;
  }
  
  myPlayerName = name;
  localStorage.setItem('fifa_my_player', name);
  enterAsSpectator();
}

function registerNewPlayer() {
  const input = document.getElementById('self-player-name');
  const name = input ? input.value.trim() : '';
  if (!name) return alert('Bitte Namen eingeben!');

  if (name.toLowerCase() === 'tim') {
    promptPassword('admin', name, '🔒 Admin-Login für Tim: Bitte Passwort eingeben');
    return;
  }

  if (getPlayerObj(name)) return alert('Dieser Name existiert bereits!');

  players.push({ name: name, isRef: false, password: null });
  myPlayerName = name;
  localStorage.setItem('fifa_my_player', name);
  saveData();
  enterAsSpectator();
}

function promptPassword(type, name, textPrompt) {
  pendingAdminLogin = { type, name };
  document.getElementById('role-options').style.display = 'none';
  document.getElementById('new-player-select').style.display = 'none';
  document.getElementById('existing-players-select').style.display = 'none';
  document.getElementById('admin-password-select').style.display = 'block';
  
  const textEl = document.getElementById('password-prompt-text');
  if (textEl) textEl.innerText = textPrompt;
  
  const pwdInput = document.getElementById('admin-password-input');
  if (pwdInput) pwdInput.value = '';
}

function confirmAdminPassword() {
  const pwdInput = document.getElementById('admin-password-input');
  const pwd = pwdInput ? pwdInput.value.trim() : '';

  if (!pendingAdminLogin) return;

  if (pendingAdminLogin.type === 'admin') {
    if (pwd === ADMIN_PASSWORD) {
      if (!getPlayerObj(pendingAdminLogin.name)) {
        players.push({ name: pendingAdminLogin.name, isRef: false, password: null });
        saveData();
      }
      myPlayerName = pendingAdminLogin.name;
      localStorage.setItem('fifa_my_player', myPlayerName);
      pendingAdminLogin = false;
      enterAsSpectator();
    } else {
      alert('Falsches Admin-Passwort!');
    }
  } else if (pendingAdminLogin.type === 'player') {
    const pObj = getPlayerObj(pendingAdminLogin.name);
    if (pObj && pObj.password === pwd) {
      myPlayerName = pendingAdminLogin.name;
      localStorage.setItem('fifa_my_player', myPlayerName);
      pendingAdminLogin = false;
      enterAsSpectator();
    } else {
      alert('Falsches Passwort!');
    }
  }
}

function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  const btn = document.getElementById(`btn-${tabName}`);
  const tab = document.getElementById(`tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (tab) tab.classList.add('active');
}

// ==========================================
// 4. ECHTZEIT-SYNCHRONISATION VIA FIREBASE
// ==========================================
db.ref('tournament').on('value', (snapshot) => {
  const data = snapshot.val() || {};
  let rawPlayers = data.players || [];
  
  players = rawPlayers.map(p => typeof p === 'string' ? { name: p, isRef: false, password: null } : p);
  availableClubs = data.availableClubs || [...DEFAULT_CLUBS];
  teams = data.teams || [];
  groups = data.groups || [];
  groupMatches = data.groupMatches || [];
  koMatches = data.koMatches || [];
  draftState = data.draftState || { active: false, pairs: [], currentIndex: 0, remainingClubs: [], spinning: false, startTime: null, targetAngle: 0, duration: 4000, lastDrawnClub: null };

  renderAll();
  handleLiveDraftUI();
});

function saveData() {
  db.ref('tournament').set({ players, availableClubs, teams, groups, groupMatches, koMatches, draftState });
}

// ==========================================
// 5. PROFI-CLUBS VERWALTUNG
// ==========================================
function addClub() {
  const input = document.getElementById('new-club-name');
  const name = input ? input.value.trim() : '';
  if (!name) return;
  if (availableClubs.includes(name)) return alert('Club bereits in der Liste!');

  availableClubs.push(name);
  input.value = '';
  saveData();
}

function removeClub(index) {
  if (!isAdmin()) return;
  availableClubs.splice(index, 1);
  saveData();
}

function resetClubsToDefault() {
  if (!isAdmin()) return;
  if (confirm('Verfügbare Clubs auf Standard-Topteams zurücksetzen?')) {
    availableClubs = [...DEFAULT_CLUBS];
    saveData();
  }
}

// ==========================================
// 6. LIVE INTERAKTIVE AUSLOSUNG SHOW & GLÜCKSRAD
// ==========================================
function startInteractiveDraft() {
  if (!isAdmin()) return;
  if (players.length < 2 || players.length % 2 !== 0) {
    return alert(`Du benötigst eine gerade Anzahl an Spielern (aktuell: ${players.length}).`);
  }
  if (availableClubs.length < (players.length / 2)) {
    return alert(`Du hast zu wenige Profi-Clubs in der Liste! Mindestens ${players.length / 2} benötigt.`);
  }

  if (confirm('Soll die Auslosungs-Show jetzt LIVE gestartet werden?')) {
    const shuffledPlayers = [...players.map(p => p.name)].sort(() => Math.random() - 0.5);
    const shuffledClubs = [...availableClubs].sort(() => Math.random() - 0.5);

    let pairs = [];
    let idCounter = 1;
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      pairs.push({
        id: idCounter,
        name: `Team ${idCounter}`,
        p1: shuffledPlayers[i],
        p2: shuffledPlayers[i + 1],
        club: null
      });
      idCounter++;
    }

    teams = [];
    groups = [];
    groupMatches = [];
    koMatches = [];

    draftState = {
      active: true,
      pairs: pairs,
      currentIndex: 0,
      remainingClubs: shuffledClubs,
      spinning: false,
      startTime: null,
      targetAngle: 0,
      duration: 4000,
      lastDrawnClub: null
    };

    saveData();
  }
}

function handleLiveDraftUI() {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;

  if (!draftState || !draftState.active) {
    modal.style.display = 'none';
    if (animFrameId) cancelAnimationFrame(animFrameId);
    lastRenderedIndex = -1;
    lastRenderedSpinning = false;
    return;
  }

  modal.style.display = 'flex';

  // Verhindere das Zerstören des Canvas während einer laufenden Drehung
  const needsReRender = (draftState.currentIndex !== lastRenderedIndex) || 
                        (draftState.spinning !== lastRenderedSpinning) ||
                        (!document.getElementById('wheel-canvas'));

  if (needsReRender) {
    lastRenderedIndex = draftState.currentIndex;
    lastRenderedSpinning = draftState.spinning;
    renderDraftStep();
  }

  startWheelAnimationLoop();
}

function renderDraftStep() {
  const stage = document.getElementById('draft-stage');
  if (!stage) return;

  if (draftState.currentIndex >= draftState.pairs.length) {
    stage.innerHTML = `
      <h3 style="color:#4CAF50;">🎉 Alle Teams wurden gelost! 🎉</h3>
      <p>Die Teams und zugelosten Fußballmannschaften stehen fest!</p>
      ${isAdmin() ? `<button class="btn-primary role-btn" onclick="finishDraft()">Fertigstellen & Teams speichern</button>` : '<p style="color:var(--fal-yellow, #f1c40f);">Warte auf Admin-Bestätigung...</p>'}
    `;
    return;
  }

  const currentPair = draftState.pairs[draftState.currentIndex];

  stage.innerHTML = `
    <p style="font-size:0.9em; opacity:0.8;">Team ${draftState.currentIndex + 1} von ${draftState.pairs.length}</p>
    
    <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; margin: 15px 0;">
      <h3 style="margin:0 0 10px 0; color:var(--fal-yellow, #f1c40f);">👥 Spieler-Duo:</h3>
      <h2 style="margin:0; font-size:1.4em;">${currentPair.p1} & ${currentPair.p2}</h2>
    </div>

    <div class="wheel-container" style="position:relative; display:inline-block;">
      <div class="wheel-pointer" style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-top:20px solid #e74c3c; z-index:10;"></div>
      <canvas id="wheel-canvas" width="260" height="260"></canvas>
    </div>

    <div id="spin-result" style="height: 35px; font-weight: bold; font-size: 1.2em; color: var(--fal-yellow, #f1c40f); margin-top:5px;">
      ${draftState.lastDrawnClub ? `⚽ Gewählter Club: <u>${draftState.lastDrawnClub}</u>` : ''}
    </div>

    ${isAdmin() ? `
      ${!draftState.spinning && !draftState.lastDrawnClub ? `
        <button class="btn-primary role-btn" id="btn-spin-wheel" style="margin-top:10px;" onclick="spinWheel()">
          🎰 Rad drehen
        </button>
      ` : ''}

      ${!draftState.spinning && draftState.lastDrawnClub ? `
        <button class="btn-primary role-btn" style="margin-top:15px;" onclick="nextDraftStep()">
          ${draftState.currentIndex + 1 < draftState.pairs.length ? 'Weiter zum nächsten Team ➡️' : 'Auslosung abschließen 🎉'}
        </button>
      ` : ''}
    ` : `
      <p style="font-size:0.9em; opacity:0.8; margin-top:10px;">
        ${draftState.spinning ? '🎰 Das Rad dreht sich live...' : (draftState.lastDrawnClub ? 'Warte auf nächstes Team...' : 'Der Admin dreht gleich am Rad!')}
      </p>
    `}
  `;

  startWheelAnimationLoop();
}

function startWheelAnimationLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  function update() {
    if (!draftState || !draftState.active) return;

    let currentAngle = 0;

    if (draftState.spinning && draftState.startTime) {
      const now = Date.now();
      const elapsed = now - draftState.startTime;
      const progress = Math.min(elapsed / draftState.duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      currentAngle = easeOut * draftState.targetAngle;

      drawWheelCanvas(currentAngle);

      if (progress < 1) {
        animFrameId = requestAnimationFrame(update);
      } else {
        drawWheelCanvas(draftState.targetAngle);
      }
    } else {
      currentAngle = draftState.targetAngle || 0;
      drawWheelCanvas(currentAngle);
    }
  }

  animFrameId = requestAnimationFrame(update);
}

function drawWheelCanvas(angleInDegrees) {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width / 2 - 10;

  const clubs = draftState.remainingClubs || AVAILABLE_CLUBS;
  const numSegments = clubs.length;
  if (numSegments === 0) return;

  const arcSize = (2 * Math.PI) / numSegments;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((angleInDegrees - 90) * Math.PI / 180);

  for (let i = 0; i < numSegments; i++) {
    const angle = i * arcSize;
    ctx.beginPath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, angle, angle + arcSize);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.rotate(angle + arcSize / 2);
    ctx.fillText(clubs[i].substring(0, 14), radius - 12, 4);
    ctx.restore();
  }

  ctx.restore();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#333333";
  ctx.stroke();
}

function spinWheel() {
  if (!isAdmin() || draftState.spinning) return;

  const clubs = draftState.remainingClubs;
  if (!clubs || clubs.length === 0) return;

  const targetIndex = Math.floor(Math.random() * clubs.length);
  const winningClub = clubs[targetIndex];

  const segmentAngle = 360 / clubs.length;
  const fullRounds = (5 + Math.floor(Math.random() * 4)) * 360;
  
  const targetSegmentCenter = 360 - (targetIndex * segmentAngle + segmentAngle / 2);
  const targetAngle = fullRounds + targetSegmentCenter;

  draftState.spinning = true;
  draftState.startTime = Date.now();
  draftState.targetAngle = targetAngle;
  draftState.duration = 4000;
  draftState.lastDrawnClub = null;
  saveData();

  setTimeout(() => {
    if (isAdmin() && draftState.spinning) {
      draftState.spinning = false;
      draftState.lastDrawnClub = winningClub;
      draftState.pairs[draftState.currentIndex].club = winningClub;
      saveData();
    }
  }, 4100);
}

function nextDraftStep() {
  if (!isAdmin()) return;

  if (draftState.lastDrawnClub) {
    const idx = draftState.remainingClubs.indexOf(draftState.lastDrawnClub);
    if (idx !== -1) {
      draftState.remainingClubs.splice(idx, 1);
    }
  }

  draftState.currentIndex++;
  draftState.lastDrawnClub = null;
  draftState.targetAngle = 0;
  draftState.startTime = null;
  draftState.spinning = false;
  saveData();
}

function finishDraft() {
  if (!isAdmin()) return;
  teams = [...draftState.pairs];
  draftState.active = false;
  saveData();
  showTab('teams');
}

// ==========================================
// 7. SPIELER & ADMIN AKTIONEN
// ==========================================
function addPlayer() {
  const input = document.getElementById('new-player-name');
  const name = input ? input.value.trim() : '';
  if (!name) return;
  if (getPlayerObj(name)) return alert('Spieler existiert bereits!');

  players.push({ name: name, isRef: false, password: null });
  input.value = '';
  saveData();
}

function removePlayer(index) {
  if (!isAdmin()) return;
  players.splice(index, 1);
  saveData();
}

function toggleRef(index) {
  if (!isAdmin()) return;
  players[index].isRef = !players[index].isRef;
  saveData();
}

function setPlayerPassword(index) {
  if (!isAdmin()) return;
  const pwd = prompt(`Neues Passwort für ${players[index].name} eingeben:`);
  if (pwd !== null) {
    if (pwd.trim() === '') return alert('Passwort darf nicht leer sein.');
    players[index].password = pwd.trim();
    saveData();
  }
}

function removePlayerPassword(index) {
  if (!isAdmin()) return;
  if (confirm(`Passwort von ${players[index].name} wirklich löschen?`)) {
    players[index].password = null;
    saveData();
  }
}

// ==========================================
// 8. GRUPPEN & KO-PHASE LOGIK
// ==========================================
function drawGroups() {
  if (!isAdmin()) return;
  if (teams.length < 4) return alert('Du benötigst mindestens 4 Teams für Gruppen!');

  let choice = prompt(
    `Du hast aktuell ${teams.length} Teams.\n\n` +
    `Wähle den Turniermodus:\n` +
    `1 = 2 Gruppen (Top 2 je Gruppe direkt ins HALBFINALE)\n` +
    `2 = 4 Gruppen (Top 2 je Gruppe ins VIERTELFINALE)\n\n` +
    `Eingabe (1 oder 2):`, 
    teams.length <= 8 ? "1" : "2"
  );

  if (!choice) return;

  let groupLetters = [];
  if (choice.trim() === "1") {
    groupLetters = ['Gruppe A', 'Gruppe B'];
  } else if (choice.trim() === "2") {
    groupLetters = ['Gruppe A', 'Gruppe B', 'Gruppe C', 'Gruppe D'];
  } else {
    return alert('Ungültige Auswahl! Bitte 1 oder 2 eingeben.');
  }

  if (confirm(`Gruppen neu auslosen (${groupLetters.length} Gruppen) & Spielplan erstellen?`)) {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    groups = groupLetters.map(letter => ({ letter, teams: [] }));
    
    shuffledTeams.forEach((team, index) => {
      groups[index % groups.length].teams.push(team.id);
    });

    let rawGroupMatches = [];
    groups.forEach(group => {
      const gTeams = group.teams;
      for (let i = 0; i < gTeams.length; i++) {
        for (let j = i + 1; j < gTeams.length; j++) {
          rawGroupMatches.push({
            group: group.letter,
            t1Id: gTeams[i],
            t2Id: gTeams[j],
            score1: null,
            score2: null,
            played: false
          });
        }
      }
    });

    let matchesByGroup = {};
    groupLetters.forEach(l => { matchesByGroup[l] = rawGroupMatches.filter(m => m.group === l); });

    let interleavedMatches = [];
    let maxLen = Math.max(...Object.values(matchesByGroup).map(arr => arr.length));
    
    for (let i = 0; i < maxLen; i++) {
      groupLetters.forEach(l => {
        if (matchesByGroup[l][i]) {
          interleavedMatches.push(matchesByGroup[l][i]);
        }
      });
    }

    groupMatches = [];
    let matchId = 1;
    let slotCounter = 1;

    for (let i = 0; i < interleavedMatches.length; i += 2) {
      let m1 = interleavedMatches[i];
      let m2 = interleavedMatches[i + 1];

      m1.id = matchId++;
      m1.court = 'Hauptplatz';
      m1.slot = slotCounter;
      groupMatches.push(m1);

      if (m2) {
        if (m2.t1Id === m1.t1Id || m2.t1Id === m1.t2Id || m2.t2Id === m1.t1Id || m2.t2Id === m1.t2Id) {
          let swapIdx = interleavedMatches.findIndex((candidate, cIdx) => 
            cIdx > i + 1 && 
            candidate.t1Id !== m1.t1Id && candidate.t1Id !== m1.t2Id &&
            candidate.t2Id !== m1.t1Id && candidate.t2Id !== m1.t2Id
          );

          if (swapIdx !== -1) {
            let temp = interleavedMatches[i + 1];
            interleavedMatches[i + 1] = interleavedMatches[swapIdx];
            interleavedMatches[swapIdx] = temp;
            m2 = interleavedMatches[i + 1];
          }
        }

        m2.id = matchId++;
        m2.court = 'Nebenplatz';
        m2.slot = slotCounter;
        groupMatches.push(m2);
      }

      slotCounter++;
    }

    koMatches = [];
    saveData();
    showTab('groups');
  }
}

function drawKOPhase() {
  if (!isAdmin()) return;
  if (groups.length === 2) {
    return alert('Du spielst im 2-Gruppen-Modus! Klicke direkt auf "Halbfinale auslosen".');
  }

  const standings = calculateGroupStandings();
  const qualified1st = [];
  const qualified2nd = [];

  standings.forEach(g => {
    if (g.rankings.length >= 1) qualified1st.push({ ...g.rankings[0], group: g.letter });
    if (g.rankings.length >= 2) qualified2nd.push({ ...g.rankings[1], group: g.letter });
  });

  if (qualified1st.length < 4 || qualified2nd.length < 4) {
    return alert('Es müssen in allen 4 Gruppen die Gruppenspiele beendet sein!');
  }

  if (confirm('Viertelfinale Über-Kreuz auslosen (keine Duelle aus gleicher Gruppe)?')) {
    let available2nd = [...qualified2nd];
    let paired2nd = [];

    for (let i = 0; i < qualified1st.length; i++) {
      let first = qualified1st[i];
      let possibleOpponents = available2nd.filter(sec => sec.group !== first.group);
      
      if (possibleOpponents.length === 0) {
        possibleOpponents = available2nd;
      }

      let chosen = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
      paired2nd.push(chosen);
      available2nd = available2nd.filter(sec => sec.teamId !== chosen.teamId);
    }

    koMatches = [];
    let matchId = 101;

    for (let i = 0; i < 4; i++) {
      let court = (i % 2 === 0) ? 'Hauptplatz' : 'Nebenplatz';
      koMatches.push({
        id: matchId++,
        round: 'Viertelfinale',
        court: court,
        t1Id: qualified1st[i].teamId,
        t2Id: paired2nd[i].teamId,
        score1: null,
        score2: null,
        played: false
      });
    }

    saveData();
    showTab('matches');
  }
}

function drawSemifinals() {
  if (!isAdmin()) return;
  const standings = calculateGroupStandings();

  if (groups.length === 2) {
    const groupA = standings.find(g => g.letter === 'Gruppe A');
    const groupB = standings.find(g => g.letter === 'Gruppe B');

    if (!groupA || !groupB || groupA.rankings.length < 2 || groupB.rankings.length < 2) {
      return alert('Es müssen erst alle Gruppenspiele in Gruppe A und B beendet sein!');
    }

    if (confirm('Halbfinale Über-Kreuz anlegen? (A1 vs B2 & B1 vs A2)')) {
      koMatches = [
        {
          id: 201, round: 'Halbfinale 1', court: 'Hauptplatz',
          t1Id: groupA.rankings[0].teamId,
          t2Id: groupB.rankings[1].teamId,
          score1: null, score2: null, played: false
        },
        {
          id: 202, round: 'Halbfinale 2', court: 'Nebenplatz',
          t1Id: groupB.rankings[0].teamId,
          t2Id: groupA.rankings[1].teamId,
          score1: null, score2: null, played: false
        }
      ];

      saveData();
      showTab('matches');
    }
    return;
  }

  const qfMatches = koMatches.filter(m => m.round === 'Viertelfinale');
  const winners = [];

  qfMatches.forEach(m => {
    if (m.played) {
      if (m.score1 > m.score2) winners.push(m.t1Id);
      else if (m.score2 > m.score1) winners.push(m.t2Id);
    }
  });

  if (winners.length < 4) return alert('Es müssen erst alle 4 Viertelfinal-Spiele beendet sein!');

  if (confirm('Halbfinale jetzt zufällig aus den 4 Siegern auslosen?')) {
    const shuffledWinners = [...winners].sort(() => Math.random() - 0.5);
    
    koMatches.push({
      id: 201, round: 'Halbfinale 1', court: 'Hauptplatz',
      t1Id: shuffledWinners[0], t2Id: shuffledWinners[1],
      score1: null, score2: null, played: false
    });

    koMatches.push({
      id: 202, round: 'Halbfinale 2', court: 'Nebenplatz',
      t1Id: shuffledWinners[2], t2Id: shuffledWinners[3],
      score1: null, score2: null, played: false
    });

    saveData();
    showTab('matches');
  }
}

function drawFinals() {
  if (!isAdmin()) return;
  const hf1 = koMatches.find(m => m.round === 'Halbfinale 1');
  const hf2 = koMatches.find(m => m.round === 'Halbfinale 2');

  if (!hf1 || !hf2 || !hf1.played || !hf2.played) return alert('Beide Halbfinal-Spiele müssen erst beendet sein!');

  const hf1Winner = hf1.score1 > hf1.score2 ? hf1.t1Id : hf1.t2Id;
  const hf1Loser  = hf1.score1 > hf1.score2 ? hf1.t2Id : hf1.t1Id;
  const hf2Winner = hf2.score1 > hf2.score2 ? hf2.t1Id : hf2.t2Id;
  const hf2Loser  = hf2.score1 > hf2.score2 ? hf2.t2Id : hf2.t1Id;

  if (confirm('Finale & Spiel um Platz 3 jetzt erstellen?')) {
    koMatches.push({
      id: 301, round: '🥉 Spiel um Platz 3', court: 'Nebenplatz',
      t1Id: hf1Loser, t2Id: hf2Loser, score1: null, score2: null, played: false
    });

    koMatches.push({
      id: 302, round: '🏆 FINALE', court: 'Hauptplatz',
      t1Id: hf1Winner, t2Id: hf2Winner, score1: null, score2: null, played: false
    });

    saveData();
    showTab('matches');
  }
}

function resetTournament() {
  if (!isAdmin()) return;
  if (confirm('Turnier wirklich zurücksetzen? Alle Teams und Ergebnisse werden gelöscht!')) {
    players = [];
    teams = [];
    groups = [];
    groupMatches = [];
    koMatches = [];
    draftState = { active: false, pairs: [], currentIndex: 0, remainingClubs: [], spinning: false, startTime: null, targetAngle: 0, duration: 4000, lastDrawnClub: null };
    saveData();
  }
}

// ==========================================
// 9. MATCH & TEAM UPDATES
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
}

// ==========================================
// 10. RENDER LOGIK & UI-STEUERUNG
// ==========================================
function renderAll() {
  renderTeams();
  renderGroups();
  renderMatches();
  renderAdminPanel();
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
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span>
              <strong>${p.name}</strong> 
              ${p.isRef ? '🟨 (Schiedsrichter)' : ''} 
              ${p.password ? '🔒' : ''}
            </span>
            <div style="display: flex; gap: 4px;">
              <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.8em;" onclick="toggleRef(${idx})">
                ${p.isRef ? 'Ref-Rechte entziehen' : 'Als Ref setzen'}
              </button>
              <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.8em;" onclick="setPlayerPassword(${idx})">
                PW ${p.password ? 'ändern' : 'setzen'}
              </button>
              ${p.password ? `<button class="btn-secondary" style="padding: 2px 6px; font-size: 0.8em; color: #ff6b6b;" onclick="removePlayerPassword(${idx})">PW löschen</button>` : ''}
              <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.8em; color: #ff6b6b;" onclick="removePlayer(${idx})">❌</button>
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
