import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyBU1ig9r0v5qKZV-XIsCPqu_W1-AvVKg-M",
  authDomain: "bolinha-nba.firebaseapp.com",
  projectId: "bolinha-nba",
  storageBucket: "bolinha-nba.firebasestorage.app",
  messagingSenderId: "938649065840",
  appId: "1:938649065840:web:4ad9753785bfb899c617b5"
};
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ── ESTADO GLOBAL ──
let S = {
  players: [],
  results: { pre:{}, playin:{}, playoffs:{} },
  bracketTeams: null,
  playinTeams: null,
  locked: { playin: false, pre: false, playoffs: false }
};

// Apostador logado no momento
let ME = null; // { id, name, pin, playin:{}, pre:{}, playoffs:{} }

// ── TIMES DEFAULT ──
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

function getTW()    { return S.bracketTeams?.west || DEFAULT_TW; }
function getTE()    { return S.bracketTeams?.east || DEFAULT_TE; }
function getPI()    { return S.playinTeams || DEFAULT_PI; }
function allTeams() { return [...getTW(),...getTE()]; }
function r1p(t)     { return [[t[0],t[7]],[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]]; }
function esc(s)     { return s.replace(/'/g,"\\'"); }
function teamByName(n){ return allTeams().find(t=>t.name===n)||{name:n,seed:'?',logo:'❓'}; }

const SCORES  = ['4-0','4-1','4-2','4-3'];
const PI_PTS  = {w78:1,w910:1,w3:2,e78:1,e910:1,e3:2};
const PO_KEYS = ['wR1_0','wR1_1','wR1_2','wR1_3','eR1_0','eR1_1','eR1_2','eR1_3',
                 'wR2_0','wR2_1','eR2_0','eR2_1','wR3_0','eR3_0','finals'];
const RD_MAP  = {
  wR1_0:'r1',wR1_1:'r1',wR1_2:'r1',wR1_3:'r1',
  eR1_0:'r1',eR1_1:'r1',eR1_2:'r1',eR1_3:'r1',
  wR2_0:'semi',wR2_1:'semi',eR2_0:'semi',eR2_1:'semi',
  wR3_0:'cf',eR3_0:'cf',finals:'finals'
};

// ── FIREBASE REFS ──
const MAIN_DOC  = doc(db,'bolinha','state');
const PLAYERS_COL = collection(db,'players');

// ═══════════════════════════════════════
//  INIT — carrega estado global
// ═══════════════════════════════════════
async function init() {
  showLoading(true);

  const timeout = setTimeout(() => {
    showLoading(false);
    setOnline(false);
    showLogin();
  }, 8000);

  try {
    const snap = await getDoc(MAIN_DOC);
    if (snap.exists()) {
      const d = snap.data();
      S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
      S.bracketTeams = d.bracketTeams || null;
      S.playinTeams  = d.playinTeams  || null;
      S.locked       = d.locked       || {playin:false,pre:false,playoffs:false};
      S.players      = d.players      || [];
    }
    clearTimeout(timeout);
    setOnline(true);

    // Escuta mudanças globais em tempo real
    listenGlobal();

    // Verifica se há sessão salva
    const savedId  = localStorage.getItem('bolinha_pid');
    const savedPin = localStorage.getItem('bolinha_pin');
    if (savedId && savedPin) {
      const ok = await tryLoginById(savedId, savedPin);
      if (ok) { showLoading(false); showApp(); return; }
    }
    showLoading(false);
    showLogin();
  } catch(e) {
    clearTimeout(timeout);
    console.error(e);
    showLoading(false);
    setOnline(false);
    showLogin();
    toast('⚠️ Erro ao conectar. Verifique as regras do Firestore.');
  }
}

// ═══════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════
window.doLogin = async function() {
  const nameRaw = document.getElementById('login-name').value.trim();
  const pin     = document.getElementById('login-pin').value.trim();
  const errEl   = document.getElementById('login-error');
  const btn     = document.getElementById('login-btn');

  errEl.textContent = '';
  if (!nameRaw) { errEl.textContent = 'Digite seu nome.'; return; }
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'O PIN deve ter exatamente 4 números.'; return; }

  btn.disabled = true;
  btn.textContent = 'ENTRANDO...';

  const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
  const pid  = 'p_' + name.toLowerCase().replace(/\s+/g,'_');

  try {
    const playerRef  = doc(db, 'players', pid);
    const playerSnap = await getDoc(playerRef);

    if (playerSnap.exists()) {
      // Jogador já existe — valida PIN
      const data = playerSnap.data();
      if (data.pin !== pin) {
        errEl.textContent = '❌ PIN incorreto para este nome.';
        btn.disabled = false; btn.textContent = 'ENTRAR →';
        return;
      }
      ME = { id:pid, name:data.name, pin,
             playin:data.playin||{}, pre:data.pre||{}, playoffs:data.playoffs||{} };
    } else {
      // Jogador novo — cria
      ME = { id:pid, name, pin, playin:{}, pre:{}, playoffs:{} };
      await setDoc(playerRef, { name, pin, playin:{}, pre:{}, playoffs:{} });
      // Adiciona à lista de players do estado global
      if (!S.players.find(p=>p.id===pid)) {
        S.players.push({id:pid, name});
        await setDoc(MAIN_DOC, { ...await getMainState(), players: S.players }, {merge:true});
      }
    }

    // Salva sessão no dispositivo
    localStorage.setItem('bolinha_pid', pid);
    localStorage.setItem('bolinha_pin', pin);

    btn.disabled = false; btn.textContent = 'ENTRAR →';
    showApp();
    listenMyPicks();
  } catch(e) {
    console.error(e);
    errEl.textContent = '❌ Erro ao conectar. Tente novamente.';
    btn.disabled = false; btn.textContent = 'ENTRAR →';
  }
};

async function tryLoginById(pid, pin) {
  try {
    const snap = await getDoc(doc(db,'players',pid));
    if (!snap.exists()) return false;
    const data = snap.data();
    if (data.pin !== pin) return false;
    ME = { id:pid, name:data.name, pin,
           playin:data.playin||{}, pre:data.pre||{}, playoffs:data.playoffs||{} };
    listenMyPicks();
    return true;
  } catch(e) { return false; }
}

window.doLogout = function() {
  if (!confirm('Sair da sua conta? Suas apostas ficam salvas.')) return;
  localStorage.removeItem('bolinha_pid');
  localStorage.removeItem('bolinha_pin');
  ME = null;
  document.getElementById('login-name').value = '';
  document.getElementById('login-pin').value  = '';
  document.getElementById('login-error').textContent = '';
  showLogin();
};

// Enter no PIN faz login
document.getElementById('login-pin').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-pin').focus();
});

// ═══════════════════════════════════════
//  SHOW / HIDE SCREENS
// ═══════════════════════════════════════
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  updateHeaderUser();
  updatePlayinTeamLabels();
  loadPlayin();
  renderPreCards();
  renderBracket();
  updateLockState();
}
function showLoading(v) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !v);
}

function updateHeaderUser() {
  if (!ME) return;
  document.getElementById('hdr-avatar').textContent = ME.name[0].toUpperCase();
  document.getElementById('hdr-name').textContent   = ME.name;
  document.getElementById('pi-user-badge').textContent = ME.name;
}

function updateLockState() {
  const lk = S.locked || {};
  const sections = [{id:'playin',banner:'pi-locked-banner',btn:'pi-save-btn'},
                    {id:'pre',   banner:'pre-locked-banner',btn:'pre-save-btn'},
                    {id:'playoffs',banner:'po-locked-banner',btn:'po-save-btn'}];
  sections.forEach(({id, banner, btn}) => {
    const locked = lk[id] || false;
    document.getElementById(banner)?.classList.toggle('hidden', !locked);
    const b = document.getElementById(btn);
    if (b) b.disabled = locked;
    // Desabilita cliques nas linhas da seção
    document.querySelectorAll(`#${id} .tr`).forEach(r => {
      r.classList.toggle('locked-row', locked);
    });
    document.querySelectorAll(`#${id} .bt`).forEach(b => {
      b.classList.toggle('locked-bt', locked);
    });
    document.querySelectorAll(`#${id} .pre-tbtn`).forEach(b => {
      b.disabled = locked;
    });
    document.querySelectorAll(`#${id} .spb`).forEach(b => {
      b.disabled = locked;
    });
  });
}

// ═══════════════════════════════════════
//  LISTENERS FIREBASE
// ═══════════════════════════════════════
function listenGlobal() {
  onSnapshot(MAIN_DOC, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
    S.bracketTeams = d.bracketTeams || null;
    S.playinTeams  = d.playinTeams  || null;
    S.locked       = d.locked       || {playin:false,pre:false,playoffs:false};
    S.players      = d.players      || [];
    if (ME) {
      updatePlayinTeamLabels();
      renderBracket();
      renderPreCards();
      updateLockState();
    }
    const active = document.querySelector('.section.active')?.id;
    if (active === 'ranking') calcAndRender();
  });
}

function listenMyPicks() {
  if (!ME) return;
  onSnapshot(doc(db,'players',ME.id), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    ME.playin   = d.playin   || {};
    ME.pre      = d.pre      || {};
    ME.playoffs = d.playoffs || {};
    loadPlayin();
    renderPreCards();
    renderBracket();
  });
}

// ═══════════════════════════════════════
//  SALVAR PICKS DO APOSTADOR
// ═══════════════════════════════════════
async function fbSaveMyPicks() {
  if (!ME) return;
  syncBar(true);
  try {
    await setDoc(doc(db,'players',ME.id), {
      name:     ME.name,
      pin:      ME.pin,
      playin:   ME.playin   || {},
      pre:      ME.pre      || {},
      playoffs: ME.playoffs || {},
    }, { merge: true });
  } catch(e) { toast('❌ Erro ao salvar!'); console.error(e); }
  syncBar(false);
}

async function getMainState() {
  try {
    const snap = await getDoc(MAIN_DOC);
    return snap.exists() ? snap.data() : {};
  } catch(e) { return {}; }
}

// ═══════════════════════════════════════
//  TABS
// ═══════════════════════════════════════
window.showTab = function(id, btn) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(id).classList.add('active');
  if (id === 'ranking')  calcAndRender();
  if (id === 'playoffs') renderBracket();
  if (id === 'pre')      renderPreCards();
};

// ═══════════════════════════════════════
//  PLAY-IN
// ═══════════════════════════════════════
function updatePlayinTeamLabels() {
  const pi = getPI();
  const map = {
    'pi-w7':pi.w7,'pi-w8':pi.w8,'pi-w9':pi.w9,'pi-w10':pi.w10,
    'pi-e7':pi.e7,'pi-e8':pi.e8,'pi-e9':pi.e9,'pi-e10':pi.e10,
  };
  Object.entries(map).forEach(([prefix, t]) => {
    const sd = document.getElementById(prefix+'-seed');
    const lg = document.getElementById(prefix+'-logo');
    const nm = document.getElementById(prefix+'-name');
    if (sd) sd.textContent = t.seed;
    if (lg) lg.textContent = t.logo;
    if (nm) nm.textContent = t.name;
  });
}

function loadPlayin() {
  if (!ME) return;
  document.querySelectorAll('#playin .tr').forEach(r=>r.classList.remove('sw','se'));
  const picks = ME.playin || {};
  Object.keys(picks).forEach(mk => {
    document.querySelectorAll(`[data-pi="${mk}"]`).forEach((r,i)=>{
      if (i===picks[mk]) r.classList.add(r.dataset.conf==='west'?'sw':'se');
    });
  });
}

window.piPick = function(row) {
  if (!ME) return;
  if ((S.locked||{}).playin) { toast('🔒 Apostas encerradas!'); return; }
  const mk = row.dataset.pi, idx = parseInt(row.dataset.idx), conf = row.dataset.conf;
  document.querySelectorAll(`[data-pi="${mk}"]`).forEach(r=>r.classList.remove('sw','se'));
  row.classList.add(conf==='west'?'sw':'se');
  if (!ME.playin) ME.playin = {};
  ME.playin[mk] = idx;
};

// ═══════════════════════════════════════
//  PRÉ-PLAYOFFS
// ═══════════════════════════════════════
function renderPreCards() {
  const picks = ME ? (ME.pre||{}) : {};
  const locked = (S.locked||{}).pre || false;
  const el = document.getElementById('pre-cards');
  const tw = getTW(), te = getTE(), all = allTeams();

  function singleBtns(field, teams, cls) {
    return teams.map(t => {
      const sel = picks[field]===t.name;
      return `<button class="pre-tbtn${sel?' '+cls:''}"${locked?' disabled':''} onclick="prePick('${field}','${esc(t.name)}',false)">
        <span>${t.logo}</span><span>${t.name}</span></button>`;
    }).join('');
  }
  function multiBtns(field, teams, cls) {
    return teams.map(t => {
      const vals = Array.isArray(picks[field])?picks[field]:[];
      const sel  = vals.includes(t.name);
      return `<button class="pre-tbtn${sel?' '+cls:''}"${locked?' disabled':''} onclick="prePick('${field}','${esc(t.name)}',true)">
        <span>${t.logo}</span><span>${t.name}</span></button>`;
    }).join('');
  }
  function cfCount(field) {
    const v = Array.isArray(picks[field])?picks[field]:[];
    return v.length===2
      ? `<div style="font-family:'Barlow Condensed';font-size:11px;color:var(--gold);letter-spacing:1px;margin-top:8px;">${v.join(' vs ')} ✓</div>`
      : `<div style="font-family:'Barlow Condensed';font-size:11px;color:var(--muted);letter-spacing:2px;margin-top:8px;">SELECIONE ${v.length}/2 TIMES</div>`;
  }

  el.innerHTML = `
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>FINALISTAS CONF OESTE (escolha 2)</span><span class="bonus-tag pos">+1 PT CADA</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${multiBtns('cfW',tw,'sel-gold')}</div>${cfCount('cfW')}</div>
    </div>
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>FINALISTAS CONF LESTE (escolha 2)</span><span class="bonus-tag pos">+1 PT CADA</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${multiBtns('cfE',te,'sel-gold')}</div>${cfCount('cfE')}</div>
    </div>
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>CAMPEÃO CONF OESTE</span><span class="bonus-tag pos">+3 PTS</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${singleBtns('champW',tw,'sel-gold')}</div></div>
    </div>
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>CAMPEÃO CONF LESTE</span><span class="bonus-tag pos">+3 PTS</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${singleBtns('champE',te,'sel-gold')}</div></div>
    </div>
    <div class="pre-card purple-card" style="grid-column:1/-1;">
      <div class="pre-card-head"><span>CAMPEÃO DA NBA</span><span style="display:flex;gap:6px;align-items:center;"><span class="bonus-tag pos">+3 PTS</span><span class="bonus-tag neg-tag">-3 SE ERRAR</span></span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${singleBtns('champNBA',all,'sel-purple')}</div></div>
    </div>`;
}

window.prePick = function(field, teamName, multi) {
  if (!ME) return;
  if ((S.locked||{}).pre) { toast('🔒 Apostas encerradas!'); return; }
  if (!ME.pre) ME.pre = {};
  if (!multi) {
    ME.pre[field] = teamName;
  } else {
    let arr = Array.isArray(ME.pre[field])?[...ME.pre[field]]:[];
    const idx = arr.indexOf(teamName);
    if (idx>=0) arr.splice(idx,1);
    else if (arr.length<2) arr.push(teamName);
    else { toast('⚠️ Máximo 2 times!'); return; }
    ME.pre[field] = arr;
  }
  renderPreCards();
};

// ═══════════════════════════════════════
//  BRACKET
// ═══════════════════════════════════════
let openPicker = null;

function renderBracket() {
  const outer  = document.getElementById('bracket-outer');
  const picks  = ME ? (ME.playoffs||{}) : {};
  const locked = (S.locked||{}).playoffs || false;
  const tw = getTW(), te = getTE();
  const wR1 = r1p(tw), eR1 = r1p(te);

  function rw(mk,t1,t2) {
    const p=picks[mk];
    if(!p||!p.winner) return {name:'?',seed:'?',logo:'❓'};
    if(p.winner===t1.name) return t1;
    if(p.winner===t2.name) return t2;
    return {name:'?',seed:'?',logo:'❓'};
  }
  const wR2=[[rw('wR1_0',wR1[0][0],wR1[0][1]),rw('wR1_1',wR1[1][0],wR1[1][1])],
             [rw('wR1_2',wR1[2][0],wR1[2][1]),rw('wR1_3',wR1[3][0],wR1[3][1])]];
  const wR3=[rw('wR2_0',wR2[0][0],wR2[0][1]),rw('wR2_1',wR2[1][0],wR2[1][1])];
  const wC =rw('wR3_0',wR3[0],wR3[1]);
  const eR2=[[rw('eR1_0',eR1[0][0],eR1[0][1]),rw('eR1_1',eR1[1][0],eR1[1][1])],
             [rw('eR1_2',eR1[2][0],eR1[2][1]),rw('eR1_3',eR1[3][0],eR1[3][1])]];
  const eR3=[rw('eR2_0',eR2[0][0],eR2[0][1]),rw('eR2_1',eR2[1][0],eR2[1][1])];
  const eC =rw('eR3_0',eR3[0],eR3[1]);
  const champ=rw('finals',wC,eC);

  const lkAttr = locked ? ' onclick="lockedClick()"' : '';

  function tBtn(mk,team,conf) {
    const p=picks[mk]; const isW=p&&p.winner===team.name;
    const wc=conf==='west'?'ww':conf==='east'?'we':'wc';
    const sc=isW&&p.score?`<span class="bsc">${p.score}</span>`:'';
    const clickFn = locked ? `lockedClick()` : `bPick('${mk}','${esc(team.name)}','${conf}')`;
    return `<div class="bt${isW?' '+wc:''}${locked?' locked-bt':''}" onclick="${clickFn}">
      <span>${team.logo}</span><span class="bsd">${team.seed||'?'}</span>
      <span class="bname">${team.name}${sc}</span></div>`;
  }
  function sBox(mk,t1,t2,conf) {
    const p=picks[mk];
    const isOpen=(openPicker===mk&&!locked&&ME&&p&&p.winner&&p.winner!=='?');
    const spbClick = (sc) => locked ? `lockedClick()` : `setPlacar('${mk}','${sc}')`;
    return `<div class="sb ${conf}">${tBtn(mk,t1,conf)}${tBtn(mk,t2,conf)}
      <div class="sp${isOpen?' open':''}">
        <div class="sp-lbl">PLACAR DA SÉRIE</div>
        <div class="sp-btns">${SCORES.map(sc=>`<button class="spb${p&&p.score===sc?' asc':''}"${locked?' disabled':''} onclick="${spbClick(sc)}">${sc}</button>`).join('')}</div>
      </div></div>`;
  }
  function col(title,content){ return `<div class="b-col"><div class="b-rt">${title}</div>${content}</div>`; }

  let h='';
  h+=col('1ª RD OESTE', wR1.map((m,i)=>sBox('wR1_'+i,m[0],m[1],'west')).join(''));
  h+=col('SEMI OESTE',  wR2.map((m,i)=>sBox('wR2_'+i,m[0],m[1],'west')).join(''));
  h+=col('FINAL CONF O',sBox('wR3_0',wR3[0],wR3[1],'west'));
  h+=`<div class="b-col finals-center"><div class="b-rt">NBA FINALS</div>
    <div class="ftrophy">🏆</div><div class="flbl">CAMPEÃO</div>
    ${sBox('finals',wC,eC,'champ')}
    ${champ.name!=='?'?`<div class="champ-reveal">${champ.logo} ${champ.name}</div>`:''}</div>`;
  h+=col('FINAL CONF L',sBox('eR3_0',eR3[0],eR3[1],'east'));
  h+=col('SEMI LESTE',  eR2.map((m,i)=>sBox('eR2_'+i,m[0],m[1],'east')).join(''));
  h+=col('1ª RD LESTE', eR1.map((m,i)=>sBox('eR1_'+i,m[0],m[1],'east')).join(''));
  outer.innerHTML=h;
}

window.lockedClick = function() { toast('🔒 Apostas encerradas pelo admin!'); };

window.bPick = function(mk, teamName, conf) {
  if (!ME) return;
  if ((S.locked||{}).playoffs) { toast('🔒 Apostas encerradas!'); return; }
  if (!ME.playoffs) ME.playoffs={};
  const cur=ME.playoffs[mk]||{};
  if (cur.winner===teamName) openPicker=(openPicker===mk)?null:mk;
  else { ME.playoffs[mk]={winner:teamName,score:''}; openPicker=mk; }
  renderBracket();
};

window.setPlacar = function(mk, sc) {
  if (!ME) return;
  if ((S.locked||{}).playoffs) { toast('🔒 Apostas encerradas!'); return; }
  if (!ME.playoffs[mk]) ME.playoffs[mk]={};
  ME.playoffs[mk].score=sc; openPicker=null;
  renderBracket(); toast('✅ Placar '+sc+' salvo!');
};

// ═══════════════════════════════════════
//  SALVAR
// ═══════════════════════════════════════
window.savePicks = async function(type) {
  if (!ME) { toast('⚠️ Faça login primeiro!'); return; }
  const locked = S.locked||{};
  if (type==='pi'  && locked.playin)   { toast('🔒 Apostas encerradas!'); return; }
  if (type==='pre' && locked.pre)      { toast('🔒 Apostas encerradas!'); return; }
  if (type==='po'  && locked.playoffs) { toast('🔒 Apostas encerradas!'); return; }
  await fbSaveMyPicks();
  toast('✅ Apostas salvas!');
};

// ═══════════════════════════════════════
//  RANKING — lê tudo fresh do Firebase
// ═══════════════════════════════════════
window.calcAndRender = async function() {
  const el = document.getElementById('rank-list');
  el.innerHTML = '<div style="color:var(--muted);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;">⏳ CARREGANDO PLACAR...</div>';

  try {
    // Busca estado global mais recente (resultados)
    const stateSnap = await getDoc(MAIN_DOC);
    if (stateSnap.exists()) {
      const d = stateSnap.data();
      S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
      S.bracketTeams = d.bracketTeams || null;
      S.playinTeams  = d.playinTeams  || null;
      S.locked       = d.locked       || {playin:false,pre:false,playoffs:false};
    }

    // Busca todos os apostadores e suas picks
    const snap = await getDocs(PLAYERS_COL);
    const players = [];
    snap.forEach(d => {
      const data = d.data();
      players.push({
        id:       d.id,
        name:     data.name     || d.id,
        playin:   data.playin   || {},
        pre:      data.pre      || {},
        playoffs: data.playoffs || {},
      });
    });

    if (!players.length) {
      el.innerHTML = '<div style="color:var(--muted);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;">NENHUM APOSTADOR AINDA</div>';
      return;
    }

    const scored = players
      .map(p => ({...p, ...calcScore(p)}))
      .sort((a,b) => b.total !== a.total ? b.total - a.total : b.exact - a.exact);

    const medals = ['gold','silver','bronze'];
    function isTied(i){ return i>0 && scored[i].total===scored[i-1].total && scored[i].exact===scored[i-1].exact; }

    // Verifica se algum resultado foi lançado
    const hasAnyResult =
      Object.keys(S.results.playin||{}).length > 0 ||
      Object.keys(S.results.playoffs||{}).length > 0 ||
      Object.keys(S.results.pre||{}).length > 0;

    el.innerHTML = scored.map((p, i) => {
      const tie  = isTied(i) ? `<span class="tie-badge">EMPATE</span>` : '';
      const isMe = ME && p.id === ME.id;
      const meB  = isMe ? `<span class="me-badge">VOCÊ</span>` : '';
      const nbaChampPts = p.d.nba_champ > 0
        ? `<span style="color:var(--gold);">+${p.d.nba_champ} campeão NBA</span>`
        : p.d.nba_champ_neg < 0 ? `<span class="neg-pts">-3 campeão errado</span>` : '';

      // Mostra picks se ainda não há resultados (pontencial máximo)
      const piCount  = Object.keys(p.playin||{}).length;
      const preCount = Object.keys(p.pre||{}).length;
      const poCount  = Object.keys(p.playoffs||{}).length;

      const detailLine = hasAnyResult
        ? `PI:<span>${p.d.pi}</span> R1:<span>${p.d.r1}</span> Semi:<span>${p.d.semi}</span>
           CF:<span>${p.d.cf}</span> Finals:<span>${p.d.finals}</span><br>
           Conf+:<span>${p.d.conf_bonus}</span> Pré-PO:<span>${p.d.pre}</span> ${nbaChampPts}`
        : `${piCount} pick${piCount!==1?'s':''} play-in &nbsp;•&nbsp;
           ${preCount} pick${preCount!==1?'s':''} pré-playoffs &nbsp;•&nbsp;
           ${poCount} pick${poCount!==1?'s':''} playoffs`;

      return `<div class="rk-card${isMe?' rk-me':''}">
        <div class="rk-num ${medals[i]||''}">${i+1}</div>
        <div class="rk-avatar">${p.name[0].toUpperCase()}</div>
        <div class="rk-info">
          <div class="rk-name">${p.name}${meB}${tie}</div>
          <div class="rk-detail">${detailLine}</div>
        </div>
        <div class="rk-right">
          <div class="rk-score">${hasAnyResult ? p.total : '—'}</div>
          <div class="rk-exact">${hasAnyResult ? p.exact+' EXATOS' : 'SEM RESULTADOS'}</div>
        </div>
      </div>`;
    }).join('');

    // Nota se não há resultados ainda
    if (!hasAnyResult) {
      el.innerHTML += `<div style="color:var(--muted);text-align:center;grid-column:1/-1;
        padding:16px;font-family:'Barlow Condensed';font-size:12px;letter-spacing:2px;">
        ⏳ PONTUAÇÃO APARECE QUANDO O ADMIN LANÇAR OS RESULTADOS
      </div>`;
    }

  } catch(e) {
    console.error(e);
    el.innerHTML = '<div style="color:var(--neg);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;">ERRO AO CARREGAR PLACAR — VERIFIQUE SUA CONEXÃO</div>';
  }
};

function calcScore(p) {
  let total=0, exact=0;
  const d={pre:0,pi:0,r1:0,semi:0,cf:0,finals:0,conf_bonus:0,nba_champ:0,nba_champ_neg:0};
  const rp    = S.results.pre||{};
  const myPre = p.pre||{};

  if (rp.champW  && myPre.champW  && myPre.champW ===rp.champW)  { d.pre+=3; total+=3; }
  if (rp.champE  && myPre.champE  && myPre.champE ===rp.champE)  { d.pre+=3; total+=3; }
  if (rp.champNBA && myPre.champNBA) {
    if (myPre.champNBA===rp.champNBA) { d.nba_champ=3; total+=3; }
    else { d.nba_champ_neg=-3; total-=3; }
  }

  const piPicks = p.playin||{};
  Object.keys(PI_PTS).forEach(mk=>{
    const real=S.results.playin[mk];
    if (real===undefined||real===null) return;
    if (piPicks[mk]===real) { const pts=PI_PTS[mk]; total+=pts; d.pi+=pts; }
  });

  const poPicks = p.playoffs||{};
  PO_KEYS.forEach(mk=>{
    const real=S.results.playoffs[mk]; if(!real||!real.winner) return;
    const pick=poPicks[mk]; if(!pick||!pick.winner) return;
    if (pick.winner===real.winner) {
      const pts=(pick.score&&pick.score===real.score)?2:1;
      if (pts===2) exact++;
      total+=pts;
      d[RD_MAP[mk]]=(d[RD_MAP[mk]]||0)+pts;
    }
  });

  [{field:'cfW',rA:'cfWA',rB:'cfWB'},{field:'cfE',rA:'cfEA',rB:'cfEB'}].forEach(({field,rA,rB})=>{
    const myPicks=Array.isArray(myPre[field])?myPre[field]:[];
    const realFA=rp[rA]||null, realFB=rp[rB]||null;
    myPicks.forEach(pick=>{
      if((realFA&&pick===realFA)||(realFB&&pick===realFB)){d.conf_bonus+=1;total+=1;}
    });
  });

  return {total,exact,d};
}

// ═══════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════
function syncBar(active) {
  const b=document.getElementById('sync-bar');
  b.classList.toggle('active',active);
  b.classList.toggle('done',!active);
  if(!active) setTimeout(()=>b.classList.remove('done'),600);
}
function setOnline(v) {
  const dot=document.getElementById('conn-dot');
  const lbl=document.getElementById('conn-label');
  if(dot) dot.className=v?'':'offline';
  if(lbl) lbl.textContent=v?'ONLINE':'OFFLINE';
}
let toastTimer;
function toast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}

window.addEventListener('online',  ()=>setOnline(true));
window.addEventListener('offline', ()=>setOnline(false));

// ── ARRANQUE ──
init();