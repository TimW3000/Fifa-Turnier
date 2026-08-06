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
let currentRole = localStorage.getItem('fal_role') || 'spectator';

let draftState = {
  active: false,
  step: 0,
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

  if (typeof firebase !== 'undefined' && firebase.database) {
    try {
      firebase.database().ref('tournament').set({
        teams, groups, groupMatches, koMatches, bets, rulesText, players, availableClubs
      });
    } catch (e) {
      console.warn("Firebase Sync Fehler:", e);
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

function updateUserStatusDisplay() {
  const badgeEl = document.getElementById('user-badge');
  if (!badgeEl) return;

  if (myPlayerName) {
    let roleText = 'Spieler';
    if (isAdmin()) roleText = '👑 Admin (Tim)';
    else if (isRef()) roleText = '🟨 Schiedsrichter';

    badgeEl.innerHTML = `Eingeloggt als: <strong>${myPlayerName}</strong> (${roleText})`;
  } else {
    badgeEl.innerHTML = `Modus: <strong>Zuschauer</strong>`;
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
// 5. LIVE-DRAFT & GLÜCKSRAD
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
  const modal = document.getElementById('draft-modal');
  if (modal) modal.style.display = 'flex';
  renderDraftContent();
}

function closeDraftModal() {
  const modal = document.getElementById('draft-modal');
  if (modal) modal.style.display = 'none';
  draftState.active = false;
  renderAll();
}

function renderDraftContent() {
  const stage = document.getElementById('draft-stage');
  const wheelWrapper = document.getElementById('wheel-wrapper');
  if (!stage) return;

  if (wheelWrapper) wheelWrapper.style.display = 'block';

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

  stage.innerHTML = `
    <h3>${title}</h3>
    <button id="btn-spin" class="btn-primary" style="font-size:1.1em; margin-bottom:15px;" onclick="spinWheel()">🔥 RAD DREHEN!</button>

    <div style="text-align:left; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
      <h4 style="margin:0 0 8px 0;">Bisher geloste Teams (${teams.length}):</h4>
      <ul style="max-height:100px; overflow-y:auto; margin:0; padding-left:20px;">
        ${teams.map(t => `<li><strong>${t.name}:</strong> ${t.p1} & ${t.p2} (${t.club})</li>`).join('')}
      </ul>
    </div>

    <button class="btn-secondary" style="margin-top:15px;" onclick="closeDraftModal()">Draft beenden</button>
  `;

  setTimeout(() => drawWheel(itemsToDraw), 50);
}

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

    const newTeamId = teams.length + 1;
    teams.push({
      id: newTeamId,
      name: `Team ${newTeamId}`,
      p1: draftState.currentP1,
      p2: draftState.currentP2,
      club: draftState.currentClub
    });

    saveData();

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
// 6. TAB-NAVIGATION (KLICK-STEUERUNG)
// ==========================================
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`btn-${tabId}`);

  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
  }
  if (targetBtn) {
    targetBtn.classList.add('active');
  }

  renderAll();
}

// ==========================================
// 7. RENDER-STEUERUNG (ALLE VIEWS)
// ==========================================
function renderAll() {
  updateUserStatusDisplay();
  renderAdminNav();
  renderRules();
  renderTeams();
  renderAdminPlayerList();
  renderAdminClubList();
}

function renderAdminNav() {
  const adminBtn = document.getElementById('btn-admin');
  if (adminBtn) {
    adminBtn.style.display = isAdmin() ? 'inline-block' : 'none';
  }
}

function renderRules() {
  const displayArea = document.getElementById('rules-display-area');
  const editBtn = document.getElementById('btn-edit-rules');
  if (displayArea) displayArea.innerText = rulesText;
  if (editBtn) editBtn.style.display = isAdmin() ? 'inline-block' : 'none';
}

function toggleRulesEdit() {
  const displayArea = document.getElementById('rules-display-area');
  const editArea = document.getElementById('rules-edit-area');
  const textarea = document.getElementById('rules-textarea');

  if (editArea.style.display === 'none') {
    textarea.value = rulesText;
    editArea.style.display = 'block';
    displayArea.style.display = 'none';
  } else {
    editArea.style.display = 'none';
    displayArea.style.display = 'block';
  }
}

function saveRules() {
  const textarea = document.getElementById('rules-textarea');
  if (textarea) {
    rulesText = textarea.value;
    saveData();
    renderRules();
    toggleRulesEdit();
  }
}

function renderTeams() {
  const container = document.getElementById('teams-container');
  if (!container) return;

  if (teams.length === 0) {
    container.innerHTML = '<p style="opacity:0.7;">Noch keine Teams gelost. Starte die Auslosung im Admin-Bereich!</p>';
    return;
  }

  container.innerHTML = teams.map(t => `
    <div class="admin-card" style="margin-bottom:10px;">
      <h3 style="margin:0 0 5px 0; color:var(--fal-yellow,#f1c40f);">${t.name}</h3>
      <p style="margin:0;">👥 <strong>${t.p1} & ${t.p2}</strong></p>
      <p style="margin:5px 0 0 0; opacity:0.8;">⚽ Club: ${t.club}</p>
    </div>
  `).join('');
}

function renderAdminPlayerList() {
  const container = document.getElementById('admin-player-list');
  if (!container) return;

  container.innerHTML = players.map((p, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #333;">
      <span><strong>${p.name}</strong> ${p.isRef ? '🟨 (Schiri)' : ''} ${p.password ? '🔒' : ''}</span>
      <div>
        <button class="btn-secondary btn-sm" onclick="toggleRef(${idx})">${p.isRef ? 'Schiri entfernen' : 'Zu Schiri machen'}</button>
        <button class="btn-secondary btn-sm" onclick="setPlayerPassword(${idx})">PW setzen</button>
        <button class="btn-danger btn-sm" onclick="removePlayer(${idx})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderAdminClubList() {
  const container = document.getElementById('admin-club-list');
  if (!container) return;

  container.innerHTML = availableClubs.map((club, idx) => `
    <span style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-size:0.9em; display:inline-flex; align-items:center; gap:6px;">
      ${club} <button style="background:none; border:none; color:#ff4d4d; cursor:pointer;" onclick="removeClub(${idx})">✕</button>
    </span>
  `).join('');
}

// Dummy-Funktionen, um Fehler bei leeren Abschnitten zu vermeiden
function drawGroups() { alert('Funktion zum Erstellen der Gruppen wird ausgeführt.'); }
function drawKOPhase() { alert('Funktion für die KO-Phase wird ausgeführt.'); }
function resetTournament() {
  if (confirm('Wirklich das komplette Turnier zurücksetzen?')) {
    teams = []; groups = []; groupMatches = []; koMatches = [];
    saveData();
    renderAll();
  }
}

// ==========================================
// 8. EVENT-LISTENER & INITIALISIERUNG
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Modal Buttons
  const btnShowExisting = document.getElementById('btn-show-existing');
  if (btnShowExisting) {
    btnShowExisting.addEventListener('click', () => {
      document.getElementById('role-options').style.display = 'none';
      document.getElementById('existing-players-select').style.display = 'block';
      renderExistingPlayersList();
    });
  }

  const btnShowNew = document.getElementById('btn-show-new');
  if (btnShowNew) {
    btnShowNew.addEventListener('click', () => {
      document.getElementById('role-options').style.display = 'none';
      document.getElementById('new-player-select').style.display = 'block';
    });
  }

  const btnSpectator = document.getElementById('btn-enter-spectator');
  if (btnSpectator) {
    btnSpectator.addEventListener('click', () => {
      closeRoleModal();
    });
  }

  document.querySelectorAll('.btn-reset-role').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('existing-players-select').style.display = 'none';
      document.getElementById('new-player-select').style.display = 'none';
      document.getElementById('admin-password-select').style.display = 'none';
      document.getElementById('role-options').style.display = 'block';
    });
  });

  const btnRegisterNew = document.getElementById('btn-register-new');
  if (btnRegisterNew) {
    btnRegisterNew.addEventListener('click', () => {
      const input = document.getElementById('self-player-name');
      const name = input ? input.value.trim() : '';
      if (!name) return alert('Bitte gib deinen Namen ein!');
      
      if (!players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        players.push({ name: name, isRef: false, password: '' });
        saveData();
      }
      
      loginAsPlayer(name);
      closeRoleModal();
    });
  }

  const btnSwitchUser = document.getElementById('btn-switch-user');
  if (btnSwitchUser) {
    btnSwitchUser.addEventListener('click', () => {
      showRoleModal();
    });
  }

  if (myPlayerName) {
    closeRoleModal();
  } else {
    showRoleModal();
  }

  initFirebaseListener();
});

function showRoleModal() {
  const modal = document.getElementById('role-selection-modal');
  if (modal) modal.style.display = 'flex';
}

function closeRoleModal() {
  const modal = document.getElementById('role-selection-modal');
  if (modal) modal.style.display = 'none';
  
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('app-nav').style.display = 'flex';
  document.getElementById('app-main').style.display = 'block';
  
  renderAll();
}

function renderExistingPlayersList() {
  const container = document.getElementById('existing-players-list');
  if (!container) return;
  
  if (players.length === 0) {
    container.innerHTML = '<p style="opacity:0.7;">Noch keine Spieler eingetragen.</p>';
    return;
  }
  
  container.innerHTML = players.map(p => `
    <button class="btn-secondary" style="width:100%; margin-bottom:6px; text-align:left;" onclick="selectExistingPlayer('${p.name}')">
      👤 ${p.name}
    </button>
  `).join('');
}

function selectExistingPlayer(name) {
  loginAsPlayer(name);
  closeRoleModal();
}
