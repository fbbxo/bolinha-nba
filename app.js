import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
 
// ═══════════════════════════════
//  FIREBASE CONFIG
// ═══════════════════════════════
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
 
// ═══════════════════════════════
//  ESTADO LOCAL
// ═══════════════════════════════
let S = {
  players: [],
  playin: {},
  pre: {},
  playoffs: {},
  results: { pre: {}, playin: {}, playoffs: {} },
  bracketTeams: null,
  playinTeams: null
};
 
// ═══════════════════════════════
//  TIMES DEFAULT
// ═══════════════════════════════
const DEFAULT_TW = [
  {seed:1,name:'OKC Thunder',logo:'⚡'},
  {seed:2,name:'Houston Rockets',logo:'🚀'},
  {seed:3,name:'LA Clippers',logo:'💙'},
  {seed:4,name:'Denver Nuggets',logo:'⛏️'},
  {seed:5,name:'Memphis Grizzlies',logo:'🐻'},
  {seed:6,name:'Minnesota Wolves',logo:'🐺'},
  {seed:7,name:'Golden State Warriors',logo:'🌉'},
  {seed:8,name:'Dallas Mavericks',logo:'🤠'},
];
const DEFAULT_TE = [
  {seed:1,name:'Cleveland Cavaliers',logo:'🗡️'},
  {seed:2,name:'Boston Celtics',logo:'☘️'},
  {seed:3,name:'New York Knicks',logo:'🗽'},
  {seed:4,name:'Milwaukee Bucks',logo:'🦌'},
  {seed:5,name:'Detroit Pistons',logo:'🔧'},
  {seed:6,name:'Indiana Pacers',logo:'🏁'},
  {seed:7,name:'Atlanta Hawks',logo:'🦅'},
  {seed:8,name:'Orlando Magic',logo:'✨'},
];
const DEFAULT_PI = {
  w7:{seed:7,name:'OKC Thunder',logo:'⚡'},
  w8:{seed:8,name:'Golden State Warriors',logo:'🌉'},
  w9:{seed:9,name:'Memphis Grizzlies',logo:'🐻'},
  w10:{seed:10,name:'Phoenix Suns',logo:'🌵'},
  e7:{seed:7,name:'Indiana Pacers',logo:'🏁'},
  e8:{seed:8,name:'Miami Heat',logo:'🌊'},
  e9:{seed:9,name:'Chicago Bulls',logo:'🏁'},
  e10:{seed:10,name:'Atlanta Hawks',logo:'🦅'},
};
 
function getTW(){ return S.bracketTeams?.west || DEFAULT_TW; }
function getTE(){ return S.bracketTeams?.east || DEFAULT_TE; }
function getPI(){ return S.playinTeams || DEFAULT_PI; }
function allTeams(){ return [...getTW(),...getTE()]; }
function TW(){ return getTW(); }
function TE(){ return getTE(); }
 
const SCORES = ['4-0','4-1','4-2','4-3'];
const PI_PTS = {w78:1,w910:1,w3:2,e78:1,e910:1,e3:2};
const PO_KEYS = ['wR1_0','wR1_1','wR1_2','wR1_3','eR1_0','eR1_1','eR1_2','eR1_3',
                 'wR2_0','wR2_1','eR2_0','eR2_1','wR3_0','eR3_0','finals'];
const RD_MAP = {
  wR1_0:'r1',wR1_1:'r1',wR1_2:'r1',wR1_3:'r1',
  eR1_0:'r1',eR1_1:'r1',eR1_2:'r1',eR1_3:'r1',
  wR2_0:'semi',wR2_1:'semi',eR2_0:'semi',eR2_1:'semi',
  wR3_0:'cf',eR3_0:'cf',finals:'finals'
};
function r1p(t){ return [[t[0],t[7]],[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]]; }
function teamByName(n){ return allTeams().find(t=>t.name===n)||{name:n,seed:'?',logo:'❓'}; }
function esc(s){ return s.replace(/'/g,"\\'"); }
 
// ═══════════════════════════════
//  FIREBASE — LER / GRAVAR
// ═══════════════════════════════
const MAIN_DOC  = doc(db,'bolinha','state');
const PICKS_COL = collection(db,'picks');
 
// Carrega o estado completo do Firestore
async function fbLoad() {
  showLoading(true);
 
  // Timeout de segurança — mostra o app mesmo se Firebase demorar
  const timeout = setTimeout(() => {
    console.warn('Firebase timeout — carregando com dados vazios');
    showLoading(false);
    setOnline(false);
    initUI();
  }, 8000);
 
  try {
    // Estado global (times, resultados)
    const snap = await getDoc(MAIN_DOC);
    if (snap.exists()) {
      const d = snap.data();
      S.players      = d.players      || [];
      S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
      S.bracketTeams = d.bracketTeams || null;
      S.playinTeams  = d.playinTeams  || null;
    }
    // Picks individuais de cada jogador
    const picksSnap = await getDocs(PICKS_COL);
    picksSnap.forEach(d => {
      const pid = d.id;
      const data = d.data();
      S.playin[pid]   = data.playin   || {};
      S.pre[pid]      = data.pre      || {};
      S.playoffs[pid] = data.playoffs || {};
    });
    clearTimeout(timeout);
    showLoading(false);
    initUI();
  } catch(e) {
    clearTimeout(timeout);
    console.error('Erro ao carregar Firebase:', e);
    showLoading(false);
    setOnline(false);
    initUI();
    toast('⚠️ Sem conexão com Firebase. Verifique as regras do Firestore.');
  }
}
 
// Salva estado global (sem picks individuais)
async function fbSaveState() {
  syncBar(true);
  try {
    await setDoc(MAIN_DOC, {
      players:      S.players,
      results:      S.results,
      bracketTeams: S.bracketTeams || null,
      playinTeams:  S.playinTeams  || null,
    });
  } catch(e) { toast('❌ Erro ao salvar!'); console.error(e); }
  syncBar(false);
}
 
// Salva picks de um apostador específico
async function fbSavePicks(pid) {
  syncBar(true);
  try {
    await setDoc(doc(db,'picks',pid), {
      playin:   S.playin[pid]   || {},
      pre:      S.pre[pid]      || {},
      playoffs: S.playoffs[pid] || {},
    });
  } catch(e) { toast('❌ Erro ao salvar!'); console.error(e); }
  syncBar(false);
}
 
// Listener em tempo real para estado global
function fbListen() {
  onSnapshot(MAIN_DOC, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    S.players      = d.players      || [];
    S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
    S.bracketTeams = d.bracketTeams || null;
    S.playinTeams  = d.playinTeams  || null;
    // Re-render silencioso
    updateSelectors();
    renderConfig();
    updatePlayinTeamLabels();
    renderBracket();
    renderPreCards();
    const activeSection = document.querySelector('.section.active')?.id;
    if(activeSection === 'ranking') calcAndRender();
  });
  // Listener nos picks
  onSnapshot(PICKS_COL, snap => {
    snap.forEach(d => {
      const pid = d.id, data = d.data();
      S.playin[pid]   = data.playin   || {};
      S.pre[pid]      = data.pre      || {};
      S.playoffs[pid] = data.playoffs || {};
    });
    const activeSection = document.querySelector('.section.active')?.id;
    if(activeSection === 'ranking') calcAndRender();
  });
}
 
// ═══════════════════════════════
//  UI HELPERS
// ═══════════════════════════════
function showLoading(v) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !v);
}
function syncBar(active) {
  const b = document.getElementById('sync-bar');
  b.classList.toggle('active', active);
  b.classList.toggle('done', !active);
  if(!active) setTimeout(()=>b.classList.remove('done'),600);
}
function setOnline(v) {
  document.getElementById('conn-dot').className = v ? '' : 'offline';
  document.getElementById('conn-label').textContent = v ? 'ONLINE' : 'OFFLINE';
}
 
let tt;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(()=>el.classList.remove('show'), 2800);
}
 
// ═══════════════════════════════
//  INIT
// ═══════════════════════════════
function initUI() {
  updateSelectors();
  renderConfig();
  updatePlayinTeamLabels();
  renderPreCards();
  renderBracket();
  setOnline(true);
  fbListen(); // escuta mudanças em tempo real
}
 
window.addEventListener('online',  ()=>setOnline(true));
window.addEventListener('offline', ()=>setOnline(false));
 
fbLoad(); // arranca tudo
 
// ═══════════════════════════════
//  TABS
// ═══════════════════════════════
window.showTab = function(id, btn) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(id).classList.add('active');
  if(id==='ranking')  calcAndRender();
  if(id==='playoffs') renderBracket();
  if(id==='pre')      renderPreCards();
};
 
// ═══════════════════════════════
//  APOSTADORES
// ═══════════════════════════════
window.addPlayer = async function() {
  const inp = document.getElementById('new-name');
  const n = inp.value.trim(); if(!n) return;
  const id = 'p' + Date.now();
  S.players.push({id, name:n});
  S.playin[id]={}; S.pre[id]={}; S.playoffs[id]={};
  inp.value='';
  await fbSaveState();
  await fbSavePicks(id);
  updateSelectors(); renderConfig();
  toast('🏀 '+n+' adicionado!');
};
 
window.removePlayer = async function(id) {
  if(!confirm('Remover este apostador?')) return;
  S.players = S.players.filter(p=>p.id!==id);
  delete S.playin[id]; delete S.pre[id]; delete S.playoffs[id];
  await fbSaveState();
  // Remove picks doc
  try { await setDoc(doc(db,'picks',id),{}); } catch(e){}
  updateSelectors(); renderConfig();
  toast('🗑 Apostador removido.');
};
 
function updateSelectors() {
  ['pi-sel','pre-sel','po-sel'].forEach(sid => {
    const sel = document.getElementById(sid); if(!sel) return;
    const v = sel.value;
    sel.innerHTML = '<option value="">— selecione —</option>';
    S.players.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name; sel.appendChild(o);
    });
    if(v) sel.value = v;
  });
}
 
function renderConfig() {
  const el = document.getElementById('cfg-list');
  if(!S.players.length) {
    el.innerHTML = '<div style="color:var(--muted);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;">NENHUM APOSTADOR AINDA</div>';
    return;
  }
  el.innerHTML = S.players.map((p,i) => `
    <div class="rk-card">
      <div class="rk-avatar">${p.name[0].toUpperCase()}</div>
      <div class="rk-info"><div class="rk-name">${p.name}</div><div class="rk-detail">Apostador #${i+1}</div></div>
      <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;color:var(--red);border-color:var(--red);" onclick="removePlayer('${p.id}')">✕</button>
    </div>`).join('');
}
 
// ═══════════════════════════════
//  PLAY-IN — LABELS DINÂMICOS
// ═══════════════════════════════
function updatePlayinTeamLabels() {
  const pi = getPI();
  const map = {
    'pi-w7':pi.w7, 'pi-w8':pi.w8, 'pi-w9':pi.w9, 'pi-w10':pi.w10,
    'pi-e7':pi.e7, 'pi-e8':pi.e8, 'pi-e9':pi.e9, 'pi-e10':pi.e10,
  };
  Object.entries(map).forEach(([prefix, t]) => {
    const sd = document.getElementById(prefix+'-seed');
    const lg = document.getElementById(prefix+'-logo');
    const nm = document.getElementById(prefix+'-name');
    if(sd) sd.textContent = t.seed;
    if(lg) lg.textContent = t.logo;
    if(nm) nm.textContent = t.name;
  });
}
 
window.loadPlayin = function() {
  const pid = document.getElementById('pi-sel').value;
  document.querySelectorAll('#playin .tr').forEach(r=>r.classList.remove('sw','se'));
  if(!pid) return;
  const picks = S.playin[pid]||{};
  Object.keys(picks).forEach(mk => {
    document.querySelectorAll(`[data-pi="${mk}"]`).forEach((r,i) => {
      if(i===picks[mk]) r.classList.add(r.dataset.conf==='west'?'sw':'se');
    });
  });
};
 
window.piPick = function(row) {
  const pid = document.getElementById('pi-sel').value;
  if(!pid){ toast('⚠️ Selecione um apostador!'); return; }
  const mk = row.dataset.pi, idx = parseInt(row.dataset.idx), conf = row.dataset.conf;
  document.querySelectorAll(`[data-pi="${mk}"]`).forEach(r=>r.classList.remove('sw','se'));
  row.classList.add(conf==='west'?'sw':'se');
  if(!S.playin[pid]) S.playin[pid]={};
  S.playin[pid][mk] = idx;
};
 
// ═══════════════════════════════
//  PRÉ-PLAYOFFS
// ═══════════════════════════════
function renderPreCards() {
  const pid = document.getElementById('pre-sel')?.value||'';
  const picks = pid?(S.pre[pid]||{}):{};
  const el = document.getElementById('pre-cards');
  const tw = getTW(), te = getTE(), all = allTeams();
 
  function singleBtns(field, teams, cls) {
    return teams.map(t => {
      const sel = picks[field]===t.name;
      return `<button class="pre-tbtn${sel?' '+cls:''}" onclick="prePick('${field}','${esc(t.name)}',false)"><span>${t.logo}</span><span>${t.name}</span></button>`;
    }).join('');
  }
  function multiBtns(field, teams, cls) {
    return teams.map(t => {
      const vals = Array.isArray(picks[field])?picks[field]:[];
      const sel = vals.includes(t.name);
      return `<button class="pre-tbtn${sel?' '+cls:''}" onclick="prePick('${field}','${esc(t.name)}',true)"><span>${t.logo}</span><span>${t.name}</span></button>`;
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
  const pid = document.getElementById('pre-sel').value;
  if(!pid){ toast('⚠️ Selecione um apostador!'); return; }
  if(!S.pre[pid]) S.pre[pid]={};
  if(!multi) {
    S.pre[pid][field] = teamName;
  } else {
    let arr = Array.isArray(S.pre[pid][field])?[...S.pre[pid][field]]:[];
    const idx = arr.indexOf(teamName);
    if(idx>=0) arr.splice(idx,1);
    else if(arr.length<2) arr.push(teamName);
    else { toast('⚠️ Máximo 2 times!'); return; }
    S.pre[pid][field] = arr;
  }
  renderPreCards();
};
 
window.loadPre = function() { renderPreCards(); };
 
// ═══════════════════════════════
//  BRACKET
// ═══════════════════════════════
let openPicker = null;
 
window.loadPlayoffs = function() {
  const pid = document.getElementById('po-sel').value;
  if(pid && !S.playoffs[pid]) S.playoffs[pid]={};
  openPicker = null;
  renderBracket();
};
 
function resolveW(picks, mk, t1, t2) {
  const p = picks[mk];
  if(!p||!p.winner) return {name:'?',seed:'?',logo:'❓'};
  if(p.winner===t1.name) return t1;
  if(p.winner===t2.name) return t2;
  return {name:'?',seed:'?',logo:'❓'};
}
 
function renderBracket() {
  const outer = document.getElementById('bracket-outer');
  const pid = document.getElementById('po-sel')?.value||'';
  const picks = pid?(S.playoffs[pid]||{}):{};
  const tw = getTW(), te = getTE();
  const wR1 = r1p(tw), eR1 = r1p(te);
 
  function rw(mk,t1,t2){ return resolveW(picks,mk,t1,t2); }
  const wR2 = [[rw('wR1_0',wR1[0][0],wR1[0][1]),rw('wR1_1',wR1[1][0],wR1[1][1])],
               [rw('wR1_2',wR1[2][0],wR1[2][1]),rw('wR1_3',wR1[3][0],wR1[3][1])]];
  const wR3 = [rw('wR2_0',wR2[0][0],wR2[0][1]),rw('wR2_1',wR2[1][0],wR2[1][1])];
  const wC  = rw('wR3_0',wR3[0],wR3[1]);
  const eR2 = [[rw('eR1_0',eR1[0][0],eR1[0][1]),rw('eR1_1',eR1[1][0],eR1[1][1])],
               [rw('eR1_2',eR1[2][0],eR1[2][1]),rw('eR1_3',eR1[3][0],eR1[3][1])]];
  const eR3 = [rw('eR2_0',eR2[0][0],eR2[0][1]),rw('eR2_1',eR2[1][0],eR2[1][1])];
  const eC  = rw('eR3_0',eR3[0],eR3[1]);
  const champ = rw('finals',wC,eC);
 
  function tBtn(mk,team,conf) {
    const p=picks[mk]; const isW=p&&p.winner===team.name;
    const wc=conf==='west'?'ww':conf==='east'?'we':'wc';
    const sc=isW&&p.score?`<span class="bsc">${p.score}</span>`:'';
    return `<div class="bt${isW?' '+wc:''}" onclick="bPick('${mk}','${esc(team.name)}','${conf}')">
      <span>${team.logo}</span><span class="bsd">${team.seed||'?'}</span>
      <span class="bname">${team.name}${sc}</span></div>`;
  }
  function sBox(mk,t1,t2,conf) {
    const p=picks[mk];
    const isOpen=(openPicker===mk&&pid&&p&&p.winner&&p.winner!=='?');
    return `<div class="sb ${conf}">${tBtn(mk,t1,conf)}${tBtn(mk,t2,conf)}
      <div class="sp${isOpen?' open':''}">
        <div class="sp-lbl">PLACAR DA SÉRIE</div>
        <div class="sp-btns">${SCORES.map(sc=>`<button class="spb${p&&p.score===sc?' asc':''}" onclick="setPlacar('${mk}','${sc}')">${sc}</button>`).join('')}</div>
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
  outer.innerHTML = h;
}
 
window.bPick = function(mk, teamName, conf) {
  const pid = document.getElementById('po-sel').value;
  if(!pid){ toast('⚠️ Selecione um apostador!'); return; }
  if(!S.playoffs[pid]) S.playoffs[pid]={};
  const cur = S.playoffs[pid][mk]||{};
  if(cur.winner===teamName) openPicker=(openPicker===mk)?null:mk;
  else { S.playoffs[pid][mk]={winner:teamName,score:''}; openPicker=mk; }
  renderBracket();
};
 
window.setPlacar = function(mk, sc) {
  const pid = document.getElementById('po-sel').value; if(!pid) return;
  if(!S.playoffs[pid][mk]) S.playoffs[pid][mk]={};
  S.playoffs[pid][mk].score = sc; openPicker=null;
  renderBracket(); toast('✅ Placar '+sc+' registrado!');
};
 
// ═══════════════════════════════
//  SALVAR PICKS
// ═══════════════════════════════
window.savePicks = async function(type) {
  const ids = {pi:'pi-sel', pre:'pre-sel', po:'po-sel'};
  const pid = document.getElementById(ids[type]).value;
  if(!pid){ toast('⚠️ Selecione um apostador!'); return; }
  await fbSavePicks(pid);
  toast('✅ Apostas salvas!');
};
 
// ═══════════════════════════════
//  PONTUAÇÃO
// ═══════════════════════════════
function calcScore(pid) {
  let total=0, exact=0;
  const d={pre:0,pi:0,r1:0,semi:0,cf:0,finals:0,conf_bonus:0,nba_champ:0,nba_champ_neg:0};
  const rp = S.results.pre||{};
  const myPre = S.pre[pid]||{};
 
  if(rp.champW && myPre.champW && myPre.champW===rp.champW){ d.pre+=3; total+=3; }
  if(rp.champE && myPre.champE && myPre.champE===rp.champE){ d.pre+=3; total+=3; }
  if(rp.champNBA && myPre.champNBA){
    if(myPre.champNBA===rp.champNBA){ d.nba_champ=3; total+=3; }
    else { d.nba_champ_neg=-3; total-=3; }
  }
 
  const piPicks = S.playin[pid]||{};
  Object.keys(PI_PTS).forEach(mk => {
    const real = S.results.playin[mk];
    if(real===undefined||real===null) return;
    if(piPicks[mk]===real){ const pts=PI_PTS[mk]; total+=pts; d.pi+=pts; }
  });
 
  const poPicks = S.playoffs[pid]||{};
  PO_KEYS.forEach(mk => {
    const real=S.results.playoffs[mk]; if(!real||!real.winner) return;
    const pick=poPicks[mk]; if(!pick||!pick.winner) return;
    if(pick.winner===real.winner){
      const pts=(pick.score&&pick.score===real.score)?2:1;
      if(pts===2) exact++;
      total+=pts;
      d[RD_MAP[mk]]=(d[RD_MAP[mk]]||0)+pts;
    }
  });
 
  // Bônus finalistas conf
  [{field:'cfW',rA:'cfWA',rB:'cfWB'},{field:'cfE',rA:'cfEA',rB:'cfEB'}].forEach(({field,rA,rB})=>{
    const myPicks=Array.isArray(myPre[field])?myPre[field]:[];
    const realFA=rp[rA]||null, realFB=rp[rB]||null;
    myPicks.forEach(pick=>{
      if((realFA&&pick===realFA)||(realFB&&pick===realFB)){ d.conf_bonus+=1; total+=1; }
    });
  });
 
  return {total,exact,d};
}
 
window.calcAndRender = function() {
  const el = document.getElementById('rank-list');
  if(!S.players.length){
    el.innerHTML='<div style="color:var(--muted);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;">NENHUM APOSTADOR AINDA</div>';
    return;
  }
  const scored = S.players.map(p=>({...p,...calcScore(p.id)}))
    .sort((a,b)=> b.total!==a.total?b.total-a.total:b.exact-a.exact);
  const medals = ['gold','silver','bronze'];
  function isTied(i){ return i>0&&scored[i].total===scored[i-1].total&&scored[i].exact===scored[i-1].exact; }
 
  el.innerHTML = scored.map((p,i)=>{
    const tie = isTied(i)?`<span class="tie-badge">EMPATE</span>`:'';
    const nbaChampPts = p.d.nba_champ>0
      ?`<span style="color:var(--gold);">+${p.d.nba_champ} campeão NBA</span>`
      :p.d.nba_champ_neg<0?`<span class="neg-pts">-3 campeão NBA errado</span>`:'';
    return `<div class="rk-card">
      <div class="rk-num ${medals[i]||''}">${i+1}</div>
      <div class="rk-avatar">${p.name[0].toUpperCase()}</div>
      <div class="rk-info">
        <div class="rk-name">${p.name}${tie}</div>
        <div class="rk-detail">
          PI:<span>${p.d.pi}</span> R1:<span>${p.d.r1}</span> Semi:<span>${p.d.semi}</span>
          CF:<span>${p.d.cf}</span> Finals:<span>${p.d.finals}</span><br>
          Conf+:<span>${p.d.conf_bonus}</span> Pré-PO:<span>${p.d.pre}</span> ${nbaChampPts}
        </div>
      </div>
      <div class="rk-right">
        <div class="rk-score">${p.total}</div>
        <div class="rk-exact">${p.exact} EXATOS</div>
      </div>
    </div>`;
  }).join('');
};