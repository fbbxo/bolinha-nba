// ═══════════════════════════════════════
//  FIREBASE IMPORTS
// ═══════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ═══════════════════════════════════════
//  FIREBASE CONFIG
// ═══════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyBU1ig9r0v5qKZV-XIsCPqu_W1-AvVKg-M",
  authDomain: "bolinha-nba.firebaseapp.com",
  projectId: "bolinha-nba",
  storageBucket: "bolinha-nba.firebasestorage.app",
  messagingSenderId: "938649065840",
  appId: "1:938649065840:web:4ad9753785bfb899c617b5"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ═══════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════
let S = {
  players: [], playin: {}, pre: {}, playoffs: {},
  results: { pre:{}, playin:{}, playoffs:{} },
  bracketTeams: null, playinTeams: null
};

// ═══════════════════════════════════════
//  TIMES DEFAULT
// ═══════════════════════════════════════
const DEFAULT_TW = [
  {seed:1,name:'OKC Thunder',logo:'⚡'},{seed:2,name:'Houston Rockets',logo:'🚀'},
  {seed:3,name:'LA Clippers',logo:'💙'},{seed:4,name:'Denver Nuggets',logo:'⛏️'},
  {seed:5,name:'Memphis Grizzlies',logo:'🐻'},{seed:6,name:'Minnesota Wolves',logo:'🐺'},
  {seed:7,name:'Golden State Warriors',logo:'🌉'},{seed:8,name:'Dallas Mavericks',logo:'🤠'},
];
const DEFAULT_TE = [
  {seed:1,name:'Cleveland Cavaliers',logo:'🗡️'},{seed:2,name:'Boston Celtics',logo:'☘️'},
  {seed:3,name:'New York Knicks',logo:'🗽'},{seed:4,name:'Milwaukee Bucks',logo:'🦌'},
  {seed:5,name:'Detroit Pistons',logo:'🔧'},{seed:6,name:'Indiana Pacers',logo:'🏁'},
  {seed:7,name:'Atlanta Hawks',logo:'🦅'},{seed:8,name:'Orlando Magic',logo:'✨'},
];
const DEFAULT_PI = {
  w7:{seed:7,name:'OKC Thunder',logo:'⚡'},w8:{seed:8,name:'Golden State Warriors',logo:'🌉'},
  w9:{seed:9,name:'Memphis Grizzlies',logo:'🐻'},w10:{seed:10,name:'Phoenix Suns',logo:'🌵'},
  e7:{seed:7,name:'Indiana Pacers',logo:'🏁'},e8:{seed:8,name:'Miami Heat',logo:'🌊'},
  e9:{seed:9,name:'Chicago Bulls',logo:'🏁'},e10:{seed:10,name:'Atlanta Hawks',logo:'🦅'},
};
const PI_SLOTS = [
  {key:'w7',conf:'west'},{key:'w8',conf:'west'},{key:'w9',conf:'west'},{key:'w10',conf:'west'},
  {key:'e7',conf:'east'},{key:'e8',conf:'east'},{key:'e9',conf:'east'},{key:'e10',conf:'east'},
];
const SCORES = ['4-0','4-1','4-2','4-3'];

function getTW()    { return S.bracketTeams?.west || DEFAULT_TW; }
function getTE()    { return S.bracketTeams?.east || DEFAULT_TE; }
function getPI()    { return S.playinTeams || DEFAULT_PI; }
function allTeams() { return [...getTW(), ...getTE()]; }
function r1p(t)     { return [[t[0],t[7]],[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]]; }
function esc(s)     { return s.replace(/'/g, "\\'"); }
function teamByName(n){ return allTeams().find(t=>t.name===n)||{name:n,seed:'?',logo:'❓'}; }

// ═══════════════════════════════════════
//  FIREBASE HELPERS
// ═══════════════════════════════════════
const MAIN_DOC    = doc(db, 'bolinha', 'state');
const PLAYERS_COL = collection(db, 'players');

async function fbLoad() {
  try {
    const snap = await getDoc(MAIN_DOC);
    if (snap.exists()) {
      const d = snap.data();
      S.players      = d.players      || [];
      S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
      S.bracketTeams = d.bracketTeams || null;
      S.playinTeams  = d.playinTeams  || null;
    }
    const picksSnap = await getDocs(PLAYERS_COL);
    picksSnap.forEach(d => {
      const pid = d.id, data = d.data();
      S.playin[pid]   = data.playin   || {};
      S.pre[pid]      = data.pre      || {};
      S.playoffs[pid] = data.playoffs || {};
    });
  } catch(e) { console.error('Erro ao carregar:', e); toast('⚠️ Erro ao conectar ao Firebase.'); }
  setOnline(true);
  renderAll();
  fbListen();
}

async function fbSaveState() {
  syncBar(true);
  try {
    await setDoc(MAIN_DOC, {
      players:      S.players      || [],
      results:      S.results      || {pre:{},playin:{},playoffs:{}},
      bracketTeams: S.bracketTeams || null,
      playinTeams:  S.playinTeams  || null,
      locked:       S.locked       || {playin:false,pre:false,playoffs:false},
    });
  } catch(e) { toast('❌ Erro ao salvar!'); console.error(e); }
  syncBar(false);
}

function fbListen() {
  onSnapshot(MAIN_DOC, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    S.players      = d.players      || [];
    S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
    S.bracketTeams = d.bracketTeams || null;
    S.playinTeams  = d.playinTeams  || null;
    renderSistema();
  });
}

function renderAll() {
  renderPlayers();
  renderPlayinTeamEditor();
  renderBracketEditor();
  renderResPlayin();
  renderResPre();
  renderResPlayoffs();
  renderSistema();
}

// ═══════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════
function syncBar(active) {
  const b = document.getElementById('sync-bar');
  b.classList.toggle('active', active);
  b.classList.toggle('done', !active);
  if (!active) setTimeout(() => b.classList.remove('done'), 600);
}
function setOnline(v) {
  const dot = document.getElementById('conn-dot');
  const lbl = document.getElementById('conn-label');
  if (dot) dot.className = v ? '' : 'offline';
  if (lbl) lbl.textContent = v ? 'ONLINE' : 'OFFLINE';
}
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

window.addEventListener('online',  () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));
fbLoad();

// ═══════════════════════════════════════
//  NAVEGAÇÃO
// ═══════════════════════════════════════
window.showPage = function(id, btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-'+id).classList.add('active');
  const renders = {
    'apostadores':renderPlayers,'playin-times':renderPlayinTeamEditor,
    'bracket-times':renderBracketEditor,'res-playin':renderResPlayin,
    'res-pre':renderResPre,'res-playoffs':renderResPlayoffs,'sistema':renderSistema,
  };
  if (renders[id]) renders[id]();
};

// ═══════════════════════════════════════
//  APOSTADORES
// ═══════════════════════════════════════
function renderPlayers() {
  const el  = document.getElementById('player-list');
  const cnt = document.getElementById('player-count');
  if (cnt) cnt.textContent = S.players.length + ' APOSTADORES';
  if (!S.players.length) {
    el.innerHTML = '<div style="color:var(--muted);font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;padding:10px;">NENHUM APOSTADOR CADASTRADO</div>';
    return;
  }
  el.innerHTML = S.players.map((p, i) => `
    <div class="player-row">
      <div class="player-avatar">${p.name[0].toUpperCase()}</div>
      <div><div class="player-name-txt">${p.name}</div><div class="player-idx">#${i+1}</div></div>
      <button class="btn btn-outline btn-sm" style="margin-left:auto;color:var(--neg);border-color:var(--neg);"
        onclick="removePlayer('${p.id}')">✕ REMOVER</button>
    </div>`).join('');
}

window.addPlayer = async function() {
  const inp = document.getElementById('new-name');
  const n = inp.value.trim(); if (!n) return;
  const id = 'p' + Date.now();
  S.players.push({id, name:n});
  S.playin[id]={}; S.pre[id]={}; S.playoffs[id]={};
  inp.value = '';
  await fbSaveState();
  try { await setDoc(doc(db,'picks',id),{playin:{},pre:{},playoffs:{}}); } catch(e){}
  renderPlayers(); toast('🏀 '+n+' adicionado!');
};

window.removePlayer = async function(id) {
  if (!confirm('Remover este apostador? As apostas dele serão perdidas.')) return;
  S.players = S.players.filter(p => p.id !== id);
  delete S.playin[id]; delete S.pre[id]; delete S.playoffs[id];
  await fbSaveState();
  try { await deleteDoc(doc(db,'picks',id)); } catch(e){}
  renderPlayers(); toast('🗑 Apostador removido.');
};

// ═══════════════════════════════════════
//  TIMES PLAY-IN
// ═══════════════════════════════════════
function renderPlayinTeamEditor() {
  const pi   = getPI();
  const west = PI_SLOTS.filter(s => s.conf==='west');
  const east = PI_SLOTS.filter(s => s.conf==='east');
  function rows(slots) {
    return slots.map(s => {
      const t   = pi[s.key] || DEFAULT_PI[s.key];
      const def = DEFAULT_PI[s.key];
      return `<div class="pi-team-row">
        <span class="pi-seed-lbl">${t.seed}</span>
        <input class="pi-emoji-inp" id="pi-emoji-${s.key}" value="${t.logo}" maxlength="4">
        <div style="flex:1;">
          <input class="pi-name-inp" id="pi-name-${s.key}" value="${t.name}" placeholder="${def.name}">
          <div class="orig-hint">PADRÃO: ${def.name}</div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('pi-teams-editor').innerHTML = `
    <div class="pi-game"><div class="pi-game-head">CONFERÊNCIA OESTE</div>${rows(west)}</div>
    <div class="pi-game"><div class="pi-game-head">CONFERÊNCIA LESTE</div>${rows(east)}</div>`;
}

window.savePlayinTeams = async function() {
  const pi = {};
  PI_SLOTS.forEach(s => {
    const def = DEFAULT_PI[s.key];
    pi[s.key] = {
      seed: def.seed,
      name: document.getElementById('pi-name-'+s.key)?.value.trim() || def.name,
      logo: document.getElementById('pi-emoji-'+s.key)?.value.trim() || def.logo,
    };
  });
  S.playinTeams = pi;
  await fbSaveState(); renderPlayinTeamEditor();
  toast('✅ Times do Play-In salvos!');
};

window.resetPlayinTeams = async function() {
  if (!confirm('Restaurar times do Play-In para o padrão?')) return;
  S.playinTeams = null; await fbSaveState(); renderPlayinTeamEditor();
  toast('↺ Times do Play-In restaurados.');
};

// ═══════════════════════════════════════
//  TIMES BRACKET
// ═══════════════════════════════════════
function renderBracketEditor() {
  const tw = getTW(), te = getTE();
  function rows(conf, teams, prefix) {
    return teams.map((t, i) => {
      const def = (conf==='west' ? DEFAULT_TW : DEFAULT_TE)[i];
      return `<div class="te-row">
        <input class="te-seed-inp" id="${prefix}-seed-${i}" value="${t.seed}" maxlength="3">
        <input class="te-emoji-inp" id="${prefix}-logo-${i}" value="${t.logo}" maxlength="4">
        <div style="flex:1;">
          <input class="te-name-inp" id="${prefix}-name-${i}" value="${t.name}" placeholder="${def.name}">
          <div class="orig-hint">PADRÃO: ${def.name}</div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('bracket-editor').innerHTML = `
    <div class="te-conf-block">
      <div class="te-conf-head west"><span>CONFERÊNCIA OESTE</span><span style="font-size:10px;color:var(--muted);">SEED/EMOJI/NOME</span></div>
      ${rows('west',tw,'bw')}
    </div>
    <div class="te-conf-block">
      <div class="te-conf-head east"><span>CONFERÊNCIA LESTE</span><span style="font-size:10px;color:var(--muted);">SEED/EMOJI/NOME</span></div>
      ${rows('east',te,'be')}
    </div>`;
}

window.saveBracketTeams = async function() {
  const west = getTW().map((_, i) => ({
    seed: parseInt(document.getElementById('bw-seed-'+i)?.value) || i+1,
    logo: document.getElementById('bw-logo-'+i)?.value.trim() || '🏀',
    name: document.getElementById('bw-name-'+i)?.value.trim() || 'Time '+(i+1),
  }));
  const east = getTE().map((_, i) => ({
    seed: parseInt(document.getElementById('be-seed-'+i)?.value) || i+1,
    logo: document.getElementById('be-logo-'+i)?.value.trim() || '🏀',
    name: document.getElementById('be-name-'+i)?.value.trim() || 'Time '+(i+1),
  }));
  S.bracketTeams = {west, east};
  await fbSaveState(); renderBracketEditor();
  toast('✅ Times do bracket salvos! App atualizado em tempo real.');
};

window.resetBracketTeams = async function() {
  if (!confirm('Restaurar todos os times para o padrão?')) return;
  S.bracketTeams = null; await fbSaveState(); renderBracketEditor();
  toast('↺ Times restaurados.');
};

// ═══════════════════════════════════════
//  RESULTADOS PLAY-IN
// ═══════════════════════════════════════
function renderResPlayin() {
  const pi = getPI();
  const defs = [
    {mk:'w78', label:'OESTE — Jogo 1 (7º vs 8º)', teams:[pi.w7,pi.w8]},
    {mk:'w910',label:'OESTE — Jogo 2 (9º vs 10º)',teams:[pi.w9,pi.w10]},
    {mk:'w3',  label:'OESTE — Jogo Decisivo',      teams:[{name:'Venc. J2 Oeste',logo:'❓'},{name:'Perd. J1 Oeste',logo:'❓'}]},
    {mk:'e78', label:'LESTE — Jogo 1 (7º vs 8º)', teams:[pi.e7,pi.e8]},
    {mk:'e910',label:'LESTE — Jogo 2 (9º vs 10º)',teams:[pi.e9,pi.e10]},
    {mk:'e3',  label:'LESTE — Jogo Decisivo',      teams:[{name:'Venc. J2 Leste',logo:'❓'},{name:'Perd. J1 Leste',logo:'❓'}]},
  ];
  const r = S.results.playin || {};
  document.getElementById('res-playin-matches').innerHTML = defs.map(d => {
    const has = r[d.mk]!==undefined && r[d.mk]!==null;
    return `<div class="match-card">
      <div class="match-head">${d.label}</div>
      <div class="match-body">
        <div class="match-lbl">VENCEDOR</div>
        <div class="match-btns">
          ${d.teams.map((t,i) => `<button class="match-tbtn${r[d.mk]===i?' sel-g':''}" onclick="setResPI('${d.mk}',${i})">${t.logo} ${t.name}</button>`).join('')}
        </div>
        <div class="match-status">${has?'<span class="status-ok">✓ RESULTADO LANÇADO</span>':'<span class="status-pend">— AGUARDANDO</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

window.setResPI = function(mk, idx) {
  if (!S.results.playin) S.results.playin = {};
  S.results.playin[mk] = idx; renderResPlayin();
};

// ═══════════════════════════════════════
//  RESULTADOS PRÉ-PLAYOFFS
// ═══════════════════════════════════════
function renderResPre() {
  const rp  = S.results.pre || {};
  const tw  = getTW(), te = getTE(), all = allTeams();
  function singleBtns(field, teams) {
    return teams.map(t => `<button class="match-tbtn${rp[field]===t.name?' sel-g':''}" onclick="setResPre('${field}','${esc(t.name)}',true)">${t.logo} ${t.name}</button>`).join('');
  }
  function multiBtns(field, teams) {
    const vals = Array.isArray(rp[field]) ? rp[field] : [];
    return teams.map(t => `<button class="match-tbtn${vals.includes(t.name)?' sel-g':''}" onclick="setResPre('${field}','${esc(t.name)}',false)">${t.logo} ${t.name}</button>`).join('');
  }
  const defs = [
    {field:'cfW',   label:'FINALISTAS CONF OESTE (2 times)',multi:true, teams:tw},
    {field:'cfE',   label:'FINALISTAS CONF LESTE (2 times)',multi:true, teams:te},
    {field:'champW',label:'CAMPEÃO CONF OESTE',             multi:false,teams:tw},
    {field:'champE',label:'CAMPEÃO CONF LESTE',             multi:false,teams:te},
    {field:'champNBA',label:'CAMPEÃO NBA',                  multi:false,teams:all},
  ];
  document.getElementById('res-pre-matches').innerHTML = defs.map(d => {
    const val = rp[d.field];
    const has = d.multi ? (Array.isArray(val)&&val.length===2) : (!!val);
    return `<div class="match-card">
      <div class="match-head">${d.label}</div>
      <div class="match-body">
        <div class="match-btns" style="flex-wrap:wrap;">${d.multi?multiBtns(d.field,d.teams):singleBtns(d.field,d.teams)}</div>
        <div class="match-status">${has?`<span class="status-ok">✓ ${d.multi?(val||[]).join(' e '):val}</span>`:'<span class="status-pend">— AGUARDANDO</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

window.setResPre = function(field, name, single) {
  if (!S.results.pre) S.results.pre = {};
  if (single) {
    S.results.pre[field] = name;
  } else {
    let arr = Array.isArray(S.results.pre[field]) ? [...S.results.pre[field]] : [];
    const idx = arr.indexOf(name);
    if (idx >= 0) arr.splice(idx, 1);
    else if (arr.length < 2) arr.push(name);
    S.results.pre[field] = arr;
  }
  renderResPre();
};

// ═══════════════════════════════════════
//  RESULTADOS PLAYOFFS
// ═══════════════════════════════════════
const PO_ROUND_DEFS = [
  {label:'1ª RODADA',matches:[
    {mk:'wR1_0',conf:'west'},{mk:'wR1_1',conf:'west'},{mk:'wR1_2',conf:'west'},{mk:'wR1_3',conf:'west'},
    {mk:'eR1_0',conf:'east'},{mk:'eR1_1',conf:'east'},{mk:'eR1_2',conf:'east'},{mk:'eR1_3',conf:'east'},
  ]},
  {label:'SEMIFINAIS',matches:[
    {mk:'wR2_0',conf:'west'},{mk:'wR2_1',conf:'west'},{mk:'eR2_0',conf:'east'},{mk:'eR2_1',conf:'east'},
  ]},
  {label:'FINAIS DE CONFERÊNCIA',matches:[{mk:'wR3_0',conf:'west'},{mk:'eR3_0',conf:'east'}]},
  {label:'NBA FINALS',matches:[{mk:'finals',conf:'champ'}]},
];

function getMatchTeams(mk) {
  const tw = getTW(), te = getTE();
  const wR1 = r1p(tw), eR1 = r1p(te);
  function rr(k) { return (S.results.playoffs[k]||{}).winner || '?'; }
  const map = {
    'wR1_0':[wR1[0][0].name,wR1[0][1].name],'wR1_1':[wR1[1][0].name,wR1[1][1].name],
    'wR1_2':[wR1[2][0].name,wR1[2][1].name],'wR1_3':[wR1[3][0].name,wR1[3][1].name],
    'eR1_0':[eR1[0][0].name,eR1[0][1].name],'eR1_1':[eR1[1][0].name,eR1[1][1].name],
    'eR1_2':[eR1[2][0].name,eR1[2][1].name],'eR1_3':[eR1[3][0].name,eR1[3][1].name],
    'wR2_0':[rr('wR1_0'),rr('wR1_1')],'wR2_1':[rr('wR1_2'),rr('wR1_3')],
    'eR2_0':[rr('eR1_0'),rr('eR1_1')],'eR2_1':[rr('eR1_2'),rr('eR1_3')],
    'wR3_0':[rr('wR2_0'),rr('wR2_1')],'eR3_0':[rr('eR2_0'),rr('eR2_1')],
    'finals':[rr('wR3_0'),rr('eR3_0')],
  };
  return map[mk] || ['?','?'];
}

function renderResPlayoffs() {
  const r = S.results.playoffs || {};
  const confBorder = {west:'border-left:3px solid var(--red)',east:'border-left:3px solid var(--blue2)',champ:'border-left:3px solid var(--gold)'};
  let html = '';
  PO_ROUND_DEFS.forEach(rd => {
    html += `<div class="admin-card"><div class="ac-head"><div class="ac-title">${rd.label}</div></div><div class="ac-body"><div class="res-matches-grid">`;
    rd.matches.forEach(m => {
      const res   = r[m.mk] || {};
      const teams = getMatchTeams(m.mk);
      const isDone = !!res.winner && !!res.score;
      html += `<div class="match-card" style="${confBorder[m.conf]||''}">
        <div class="match-head">${teams[0]} vs ${teams[1]}</div>
        <div class="match-body">
          <div class="match-lbl">VENCEDOR</div>
          <div class="match-btns">
            ${teams.map(t => `<button class="match-tbtn${res.winner===t?' sel-g':''}" onclick="setResPOw('${m.mk}','${esc(t)}')">${teamByName(t).logo} ${t}</button>`).join('')}
          </div>
          <div class="match-lbl" style="margin-top:8px;">PLACAR DA SÉRIE</div>
          <div class="score-btns">
            ${SCORES.map(sc => `<button class="score-btn${res.score===sc?' sel-g':''}" onclick="setResPOs('${m.mk}','${sc}')">${sc}</button>`).join('')}
          </div>
          <div class="match-status">
            ${isDone?`<span class="status-ok">✓ ${res.winner} ${res.score}</span>`:res.winner?'<span class="status-warn">⚠ FALTA O PLACAR</span>':'<span class="status-pend">— AGUARDANDO</span>'}
          </div>
        </div>
      </div>`;
    });
    html += '</div></div></div>';
  });
  document.getElementById('res-playoffs-content').innerHTML = html;
}

window.setResPOw = function(mk, name) {
  if (!S.results.playoffs) S.results.playoffs = {};
  if (!S.results.playoffs[mk]) S.results.playoffs[mk] = {};
  S.results.playoffs[mk].winner = name; renderResPlayoffs();
};
window.setResPOs = function(mk, sc) {
  if (!S.results.playoffs) S.results.playoffs = {};
  if (!S.results.playoffs[mk]) S.results.playoffs[mk] = {};
  S.results.playoffs[mk].score = sc; renderResPlayoffs();
};
window.saveResults = async function() {
  await fbSaveState();
  toast('✅ Resultados salvos no Firebase! Placar atualizado para todos.');
};

// ═══════════════════════════════════════
//  SISTEMA
// ═══════════════════════════════════════
//  SISTEMA
// ═══════════════════════════════════════
function renderSistema() {
  const el = document.getElementById('info-body'); if (!el) return;
  const lk = S.locked||{};
  el.innerHTML = `
    Resultados Play-In: <b style="color:var(--text)">${Object.keys(S.results.playin||{}).length}/6</b><br>
    Resultados Playoffs: <b style="color:var(--text)">${Object.keys(S.results.playoffs||{}).length}/15</b><br>
    Times do bracket: <b style="color:var(--text)">${S.bracketTeams?'CUSTOMIZADOS':'PADRÃO'}</b><br>
    Times do Play-In: <b style="color:var(--text)">${S.playinTeams?'CUSTOMIZADOS':'PADRÃO'}</b>`;

  // Conta players reais
  getDocs(collection(db,'players')).then(snap=>{
    renderPlayersCount(snap.size);
  }).catch(()=>{});

  // Lock controls
  const lkEl = document.getElementById('lock-controls');
  if (!lkEl) return;
  [{id:'playin',label:'PLAY-IN'},{id:'pre',label:'PRÉ-PLAYOFFS'},{id:'playoffs',label:'PLAYOFFS'}].forEach(s=>{
    const isLocked = lk[s.id]||false;
    lkEl.innerHTML += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-family:'Bebas Neue';font-size:15px;letter-spacing:2px;color:var(--white);">${s.label}</div>
          <div style="font-family:'Barlow Condensed';font-size:11px;letter-spacing:2px;color:${isLocked?'var(--neg)':'var(--green)'};">
            ${isLocked?'🔒 ENCERRADO':'🟢 ABERTO PARA APOSTAS'}
          </div>
        </div>
        <button class="btn ${isLocked?'btn-outline':'btn-red'} btn-sm" onclick="toggleLock('${s.id}')">
          ${isLocked?'↺ REABRIR':'🔒 ENCERRAR'}
        </button>
      </div>`;
  });
}

function renderPlayersCount(n) {
  const el = document.getElementById('info-body'); if (!el) return;
  el.innerHTML = `Apostadores cadastrados: <b style="color:var(--text)">${n}</b><br>` + el.innerHTML;
}

window.toggleLock = async function(section) {
  if (!S.locked) S.locked = {playin:false,pre:false,playoffs:false};
  const current = S.locked[section]||false;
  const action  = current?'reabrir':'encerrar';
  if (!confirm(`${action.toUpperCase()} apostas de ${section.toUpperCase()}?`)) return;
  S.locked[section] = !current;
  await fbSaveState();
  document.getElementById('lock-controls').innerHTML='';
  renderSistema();
  toast(S.locked[section]?'🔒 Apostas encerradas!':'✅ Apostas reabertas!');
};

window.exportData = async function() {
  const playersSnap = await getDocs(collection(db,'players'));
  const players = {};
  playersSnap.forEach(d=>{ players[d.id]=d.data(); });
  const blob = new Blob([JSON.stringify({state:S,players},null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bolinha-nba-'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); toast('⬇ Exportado!');
};

window.importData = async function(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('Importar dados? Substitui tudo no Firebase.')) return;
      if (data.state) { S = data.state; await fbSaveState(); }
      if (data.players) {
        const batch = writeBatch(db);
        Object.entries(data.players).forEach(([pid,p]) => batch.set(doc(db,'players',pid),p));
        await batch.commit();
      }
      toast('✅ Dados importados!'); renderSistema();
    } catch(err) { toast('❌ Arquivo inválido!'); }
  };
  reader.readAsText(file);
};

window.resetResults = async function() {
  if (!confirm('Resetar todos os resultados? As apostas são mantidas.')) return;
  S.results = {pre:{},playin:{},playoffs:{}};
  await fbSaveState(); toast('🔄 Resultados resetados.');
  renderResPlayin(); renderResPre(); renderResPlayoffs();
};

window.resetAll = async function() {
  if (!confirm('ATENÇÃO: isso apaga TUDO do Firebase. Tem certeza?')) return;
  if (!confirm('Última chance — confirmar reset total?')) return;
  S = {players:[],results:{pre:{},playin:{},playoffs:{}},bracketTeams:null,playinTeams:null,locked:{playin:false,pre:false,playoffs:false}};
  await fbSaveState();
  const playersSnap = await getDocs(collection(db,'players'));
  const batch = writeBatch(db);
  playersSnap.forEach(d => batch.delete(d.ref));
  await batch.commit();
  toast('🔄 Tudo resetado.'); renderSistema();
};