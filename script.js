// Global verfügbar machen
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

// 1. Firebase Konfiguration
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

// 2. Zustand
let players = [];
let availableClubs = [...DEFAULT_CLUBS];
let teams = [];
let groups = [];
let groupMatches = [];
let koMatches = [];
let myPlayerName = localStorage.getItem('fifa_my_player') || null;
let pendingAdminLogin = false;

// Interaktive Auslosungs-Variablen
let draftPairs = [];
let draftCurrentIndex = 0;
let remainingClubsForDraft = []; // Pool für verbleibende Teams auf dem Rad

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

// 3. Rollen & Auth
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

// 4. Live-Sync
db.ref('tournament').on('value', (snapshot) => {
  const data = snapshot.val() || {};
  let rawPlayers = data.players || [];
  
  players = rawPlayers.map(p => typeof p === 'string' ? { name: p, isRef: false, password: null } : p);
  availableClubs = data.availableClubs || [...DEFAULT_CLUBS];
  teams = data.teams || [];
  groups = data.groups || [];
  groupMatches = data.groupMatches || [];
  koMatches = data.koMatches || [];

  renderAll();
});

function saveData() {
  db.ref('tournament').set({ players, availableClubs, teams, groups, groupMatches, koMatches });
}

// 5. Profi-Clubs Verwaltung
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

// 6. INTERAKTIVE AUSLOSUNG & SPINNER WHEEL SHOW
function startInteractiveDraft() {
  if (!isAdmin()) return;
  if (players.length < 2 || players.length % 2 !== 0) {
    return alert(`Du benötigst eine gerade Anzahl an Spielern (aktuell: ${players.length}).`);
  }
  if (availableClubs.length < (players.length / 2)) {
    return alert(`Du hast zu wenige Profi-Clubs in der Liste! Mindestens ${players.length / 2} benötigt.`);
  }

  if (confirm('Soll die Auslosungs-Show jetzt gestartet werden?')) {
    const shuffledPlayers = [...players.map(p => p.name)].sort(() => Math.random() - 0.5);
    
    // Kopie der Clubs für die Auslosung erstellen
    remainingClubsForDraft = [...availableClubs].sort(() => Math.random() - 0.5);

    draftPairs = [];
    let idCounter = 1;
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      draftPairs.push({
        id: idCounter,
        name: `Team ${idCounter}`,
        p1: shuffledPlayers[i],
        p2: shuffledPlayers[i + 1],
        club: null // Wird live durchs Rad ermittelt
      });
      idCounter++;
    }

    draftCurrentIndex = 0;
    teams = [];
    groups = [];
    groupMatches = [];
    koMatches = [];

    document.getElementById('draft-modal').style.display = 'flex';
    renderDraftStep();
  }
}

function renderDraftStep() {
  const stage = document.getElementById('draft-stage');
  if (!stage) return;

  if (draftCurrentIndex >= draftPairs.length) {
    // Auslosung beendet!
    teams = [...draftPairs];
    saveData();
    stage.innerHTML = `
      <h3 style="color:#4CAF50;">🎉 Alle Teams wurden gelost! 🎉</h3>
      <p>Die Teams und zugelosten Fußballmannschaften stehen fest!</p>
      <button class="btn-primary role-btn" onclick="document.getElementById('draft-modal').style.display='none'; showTab('teams');">
        Fertigstellen & Teams anzeigen
      </button>
    `;
    return;
  }

  const currentPair = draftPairs[draftCurrentIndex];

  stage.innerHTML = `
    <p style="font-size:0.9em; opacity:0.8;">Team ${draftCurrentIndex + 1} von ${draftPairs.length}</p>
    
    <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; margin: 15px 0;">
      <h3 style="margin:0 0 10px 0; color:var(--fal-yellow);">👥 Spieler-Duo:</h3>
      <h2 style="margin:0; font-size:1.4em;">${currentPair.p1} & ${currentPair.p2}</h2>
    </div>

    <div class="wheel-container">
      <div class="wheel-pointer"></div>
      <canvas id="wheel-canvas" width="260" height="260"></canvas>
    </div>

    <div id="spin-result" style="height: 35px; font-weight: bold; font-size: 1.2em; color: var(--fal-yellow); margin-top:5px;"></div>

    <button class="btn-primary role-btn" id="btn-spin-wheel" style="margin-top:10px;" onclick="spinWheel()">
      🎰 Rad drehen
    </button>
  `;

  drawWheelCanvas(0);
}

function drawWheelCanvas(angleOffset) {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const numClubs = remainingClubsForDraft.length;
  const sliceAngle = (2 * Math.PI) / numClubs;

  ctx.clearRect(0, 0, 260, 260);

  const colors = ['#1e3e62', '#0b192c', '#132a4a', '#2a2a2a', '#10233d'];

  for (let i = 0; i < numClubs; i++) {
    const startAngle = angleOffset + i * sliceAngle;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(130, 130);
    ctx.arc(130, 130, 130, startAngle, endAngle);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,200,0,0.3)';
    ctx.stroke();

    // Text auf Glücksrad zeichnen
    ctx.save();
    ctx.translate(130, 130);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(remainingClubsForDraft[i].substring(0, 12), 120, 4);
    ctx.restore();
  }
}

function spinWheel() {
  const spinBtn = document.getElementById('btn-spin-wheel');
  if (spinBtn) spinBtn.disabled = true;

  // Zufällig ein Team aus den NOCH VERBLEIBENDEN Teams wählen
  const targetIndex = Math.floor(Math.random() * remainingClubsForDraft.length);
  const targetClub = remainingClubsForDraft[targetIndex];

  const currentPair = draftPairs[draftCurrentIndex];
  currentPair.club = targetClub; // Dem Team zuweisen

  const numClubs = remainingClubsForDraft.length;
  const sliceAngle = (2 * Math.PI) / numClubs;

  // Exakte Position für den oberen Zeiger (12 Uhr / 1.5 * Math.PI)
  const targetSegmentCenter = (targetIndex + 0.5) * sliceAngle;
  const targetAngleAtTop = (1.5 * Math.PI) - targetSegmentCenter;
  const totalRotation = (2 * Math.PI * 5) + targetAngleAtTop; // 5 volle Umdrehungen + Ziel

  let start = null;
  const duration = 4000; // 4 Sekunden Animation

  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    
    // Smooth Ease-Out Kurve
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentAngle = easeOut * totalRotation;

    drawWheelCanvas(currentAngle);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      const resultEl = document.getElementById('spin-result');
      if (resultEl) {
        resultEl.innerHTML = `⚽ Gewählter Club: <u>${targetClub}</u>`;
      }

      // Gezogenen Club aus dem aktiven Pool entfernen
      remainingClubsForDraft.splice(targetIndex, 1);

      setTimeout(() => {
        const stage = document.getElementById('draft-stage');
        if (stage) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'btn-primary role-btn';
          nextBtn.style.marginTop = '15px';
          nextBtn.innerText = draftCurrentIndex + 1 < draftPairs.length ? 'Weiter zum nächsten Team ➡️' : 'Auslosung abschließen 🎉';
          nextBtn.onclick = () => {
            draftCurrentIndex++;
            renderDraftStep();
          };
          stage.appendChild(nextBtn);
          if (spinBtn) spinBtn.style.display = 'none';
        }
      }, 500);
    }
  }

  requestAnimationFrame(animate);
}

// 7. Standard Admin Handlungen
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

// 8. Gruppen & KO-Phase Logik
function drawGroups() {
  if (!isAdmin()) return;
  if (teams.length < 4) return alert('Du benötigst mindestens 4 Teams für Gruppen!');

  if (confirm('Gruppen jetzt neu auslosen & optimierten Spielplan erstellen?')) {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const groupLetters = ['Gruppe A', 'Gruppe B', 'Gruppe C', 'Gruppe D'];
    
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
  const standings = calculateGroupStandings();
  const qualified1st = [];
  const qualified2nd = [];

  standings.forEach(g => {
    if (g.rankings.length >= 1) qualified1st.push(g.rankings[0]);
    if (g.rankings.length >= 2) qualified2nd.push(g.rankings[1]);
  });

  if (qualified1st.length === 0 || qualified2nd.length === 0) {
    return alert('Nicht genügend Ergebnisse für das Viertelfinale vorhanden!');
  }

  if (confirm('Viertelfinale jetzt auslosen?')) {
    const shuffled2nd = [...qualified2nd].sort(() => Math.random() - 0.5);
    koMatches = [];
    let matchId = 101;

    for (let i = 0; i < Math.min(qualified1st.length, shuffled2nd.length); i++) {
      let court = (i % 2 === 0) ? 'Hauptplatz' : 'Nebenplatz';
      koMatches.push({
        id: matchId++,
        round: 'Viertelfinale',
        court: court,
        t1Id: qualified1st[i].teamId,
        t2Id: shuffled2nd[i].teamId,
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
    saveData();
  }
}

// 9. Match & Team Updates
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

// 10. Render Panel & UI
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
        <div style="display: flex; justify-size: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <input type="text" value="${t.name}" 
                 ${canEditName ? '' : 'disabled'} 
                 onchange="updateTeamName(${t.id}, this.value)"
                 style="font-weight: bold; font-size: 1.1em; max-width: 180px;">
          ${clubBadgeHtml}
        </div>
        ${isMyTeam ? '<div style="color:var(--fal-yellow); font-size:0.85em; font-weight:bold; margin-top:4px;">⭐ (Dein Team)</div>' : ''}
        <p style="margin-top: 8px; margin-bottom:0;">Mitglieder: <strong>${t.p1}</strong> & <strong>${t.p2}</strong></p>
      </div>
    `;
  }).join('');
}

function calculateGroupStandings() {
  return groups.map(g => {
    const stats = {};
    g.teams.forEach(tId => {
      const teamObj = teams.find(t => t.id === tId);
      let displayName = teamObj ? teamObj.name : `Team ${tId}`;
      if (teamObj && teamObj.club) displayName += ` (${teamObj.club})`;
      stats[tId] = { teamId: tId, name: displayName, played: 0, gf: 0, ga: 0, diff: 0, points: 0 };
    });

    groupMatches.filter(m => m.group === g.letter && m.played).forEach(m => {
      const t1 = stats[m.t1Id];
      const t2 = stats[m.t2Id];
      if (t1 && t2) {
        t1.played++; t2.played++;
        t1.gf += m.score1; t1.ga += m.score2;
        t2.gf += m.score2; t2.ga += m.score1;

        if (m.score1 > m.score2) t1.points += 3;
        else if (m.score2 > m.score1) t2.points += 3;
        else { t1.points += 1; t2.points += 1; }

        t1.diff = t1.gf - t1.ga;
        t2.diff = t2.gf - t2.ga;
      }
    });

    const rankings = Object.values(stats).sort((a, b) => b.points - a.points || b.diff - a.diff || b.gf - a.gf);
    return { letter: g.letter, rankings };
  });
}

function renderGroups() {
  const container = document.getElementById('groups-container');
  if (!container) return;

  if (groups.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Gruppen gelost.</p>';
    return;
  }

  const standings = calculateGroupStandings();

  container.innerHTML = standings.map(g => `
    <div class="admin-card">
      <h3 style="color:var(--fal-yellow); margin-top:0;">${g.letter}</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Sp</th>
              <th>Tore</th>
              <th>Diff</th>
              <th>Pkt</th>
            </tr>
          </thead>
          <tbody>
            ${g.rankings.map((r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${r.name}</strong></td>
                <td>${r.played}</td>
                <td>${r.gf}:${r.ga}</td>
                <td>${r.diff > 0 ? '+' + r.diff : r.diff}</td>
                <td><strong>${r.points}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function renderMatches() {
  const gList = document.getElementById('group-matches-list');
  const kList = document.getElementById('ko-matches-list');
  const myTeam = getMyTeam();

  if (gList) {
    if (groupMatches.length === 0) {
      gList.innerHTML = '<p class="empty-state">Noch keine Gruppenspiele generiert.</p>';
    } else {
      gList.innerHTML = groupMatches.map(m => renderMatchCard(m, false, myTeam)).join('');
    }
  }

  if (kList) {
    if (koMatches.length === 0) {
      kList.innerHTML = '<p class="empty-state">KO-Phase wurde noch nicht gelost.</p>';
    } else {
      let html = '';

      const finalMatch = koMatches.find(m => m.round === '🏆 FINALE');
      if (finalMatch && finalMatch.played) {
        const winnerId = finalMatch.score1 > finalMatch.score2 ? finalMatch.t1Id : finalMatch.t2Id;
        const winnerTeam = teams.find(t => t.id === winnerId);
        if (winnerTeam) {
          html += `
            <div class="admin-card highlight-me" style="text-align: center; margin-bottom: 25px; background: linear-gradient(135deg, #132A4A, #1A3E66);">
              <h2 style="color: var(--fal-yellow); margin: 0 0 10px 0;">🏆 TURNIERSIEGER 🏆</h2>
              <h3 style="font-size: 1.5em; margin: 0; color: white;">${winnerTeam.p1} & ${winnerTeam.p2}</h3>
              <p style="margin: 5px 0 0 0; color: var(--fal-yellow); font-weight: bold;">(${winnerTeam.name} - ${winnerTeam.club || ''})</p>
            </div>
          `;
        }
      }

      const qfMatches = koMatches.filter(m => m.round === 'Viertelfinale');
      const qfFinished = qfMatches.length === 4 && qfMatches.every(m => m.played);
      const hasHF = koMatches.some(m => m.round.includes('Halbfinale'));

      const hfMatches = koMatches.filter(m => m.round.includes('Halbfinale'));
      const hfFinished = hfMatches.length === 2 && hfMatches.every(m => m.played);
      const hasFinal = koMatches.some(m => m.round.includes('FINALE'));

      if (isAdmin()) {
        if (qfFinished && !hasHF) {
          html += `<button class="btn-primary" style="margin-bottom: 20px;" onclick="drawSemifinals()">🎲 Halbfinale jetzt auslosen!</button>`;
        }
        if (hfFinished && !hasFinal) {
          html += `<button class="btn-primary" style="margin-bottom: 20px;" onclick="drawFinals()">🏆 Finale & Spiel um Platz 3 anlegen!</button>`;
        }
      }

      html += koMatches.map(m => renderMatchCard(m, true, myTeam)).join('');
      kList.innerHTML = html;
    }
  }
}

function renderMatchCard(m, isKO, myTeam) {
  const t1 = teams.find(t => t.id === m.t1Id);
  const t2 = teams.find(t => t.id === m.t2Id);
  const canEdit = canManageMatches() || (myTeam && (m.t1Id === myTeam.id || m.t2Id === myTeam.id));
  const courtClass = m.court === 'Hauptplatz' ? 'court-main' : 'court-side';
  const roundTitle = m.round ? `${m.round}` : `Runde ${m.slot} • ${m.group}`;
  const isFinal = m.round === '🏆 FINALE';

  const t1Label = t1 ? `${t1.name} ${t1.club ? '(' + t1.club + ')' : ''}` : 'Team 1';
  const t2Label = t2 ? `${t2.name} ${t2.club ? '(' + t2.club + ')' : ''}` : 'Team 2';

  return `
    <div class="match-card ${isFinal ? 'highlight-me' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size: 0.85em; font-weight: bold; color: var(--fal-yellow);">${roundTitle}</span>
        <span class="court-badge ${courtClass}">${m.court}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin: 10px 0;">
        <span style="font-size: 0.95em;"><strong>${t1Label}</strong> <br><small style="opacity:0.7;">vs</small><br> <strong>${t2Label}</strong></span>
      </div>
      <div style="display:flex; gap: 8px; align-items:center;">
        <input type="number" min="0" value="${m.score1 !== null ? m.score1 : ''}" 
               ${canEdit ? '' : 'disabled'} id="score1-${m.id}" placeholder="-" style="width: 60px;">
        <span>:</span>
        <input type="number" min="0" value="${m.score2 !== null ? m.score2 : ''}" 
               ${canEdit ? '' : 'disabled'} id="score2-${m.id}" placeholder="-" style="width: 60px;">
        ${canEdit ? `<button class="btn-primary btn-sm" onclick="updateMatchScore(${m.id}, ${isKO}, document.getElementById('score1-${m.id}').value, document.getElementById('score2-${m.id}').value)">Speichern</button>` : ''}
      </div>
    </div>
  `;
}

function renderAdminPanel() {
  const playerListEl = document.getElementById('admin-player-list');
  const clubListEl = document.getElementById('admin-club-list');

  if (playerListEl) {
    playerListEl.innerHTML = players.map((p, index) => {
      const hasPW = !!p.password;
      const isRefBtnClass = p.isRef ? 'btn-primary' : 'btn-secondary';

      return `
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; background: var(--fal-blue-primary); padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; gap: 8px;">
          <div>
            <strong>${index + 1}. ${p.name}</strong> 
            ${p.isRef ? '<span style="color:var(--fal-yellow); font-size:0.85em;">[🟨 Ref]</span>' : ''}
            ${hasPW ? '<span style="font-size:0.85em; opacity:0.8;">[🔒 PW]</span>' : ''}
          </div>

          <div style="display:flex; gap: 5px; flex-wrap:wrap;">
            <button class="${isRefBtnClass} btn-sm" onclick="toggleRef(${index})">
              ${p.isRef ? '🟨 Ref (Aktiv)' : 'Ref vergeben'}
            </button>
            ${hasPW 
              ? `<button class="btn-danger btn-sm" onclick="removePlayerPassword(${index})">PW löschen</button>`
              : `<button class="btn-secondary btn-sm" onclick="setPlayerPassword(${index})">+ PW</button>`
            }
            <button class="btn-danger btn-sm" onclick="removePlayer(${index})">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (clubListEl) {
    clubListEl.innerHTML = availableClubs.map((club, index) => `
      <span class="club-badge">
        ${club} <span style="cursor:pointer; color:#ff4d4d; font-weight:bold; margin-left:4px;" onclick="removeClub(${index})">×</span>
      </span>
    `).join('');
  }
}
