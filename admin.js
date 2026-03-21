// ═══════════════════════════════════════
//  FIREBASE
// ═══════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  collection,
  deleteDoc,
  doc, getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

// ═══════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════
let S = {
  players:[], results:{pre:{},playin:{},playoffs:{}},
  bracketTeams:null, playinTeams:null,
  locked:{playin:false,pre:false}, openRounds:{}
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
  w7:{seed:7,name:'OKC Thunder',logo:'⚡'},     w8:{seed:8,name:'Golden State Warriors',logo:'🌉'},
  w9:{seed:9,name:'Memphis Grizzlies',logo:'🐻'},w10:{seed:10,name:'Phoenix Suns',logo:'🌵'},
  e7:{seed:7,name:'Indiana Pacers',logo:'🏁'},  e8:{seed:8,name:'Miami Heat',logo:'🌊'},
  e9:{seed:9,name:'Chicago Bulls',logo:'🏁'},   e10:{seed:10,name:'Atlanta Hawks',logo:'🦅'},
};
const PI_SLOTS = [
  {key:'w7',conf:'west'},{key:'w8',conf:'west'},{key:'w9',conf:'west'},{key:'w10',conf:'west'},
  {key:'e7',conf:'east'},{key:'e8',conf:'east'},{key:'e9',conf:'east'},{key:'e10',conf:'east'},
];
const SCORES = ['4-0','4-1','4-2','4-3'];

function getTW()    { return S.bracketTeams?.west || DEFAULT_TW; }
function getTE()    { return S.bracketTeams?.east || DEFAULT_TE; }
function getPI()    { return S.playinTeams || DEFAULT_PI; }
function allTeams() { return [...getTW(),...getTE()]; }
function r1p(t)     { return [[t[0],t[7]],[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]]; }
function esc(s)     { return s.replace(/'/g,"\\'"); }
function teamByName(n){ return allTeams().find(t=>t.name===n)||{name:n,seed:'?',logo:'❓'}; }

// ═══════════════════════════════════════
//  FIREBASE HELPERS
// ═══════════════════════════════════════
const MAIN_DOC    = doc(db,'bolinha','state');
const PLAYERS_COL = collection(db,'players');

async function fbLoad() {
  try {
    const snap = await getDoc(MAIN_DOC);
    if (snap.exists()) {
      const d = snap.data();
      S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
      S.bracketTeams = d.bracketTeams || null;
      S.playinTeams  = d.playinTeams  || null;
      S.locked       = d.locked       || {playin:false,pre:false};
      S.openRounds   = d.openRounds   || {};
      S.players      = d.players      || [];
    }
  } catch(e) { console.error('Erro Firebase:', e); toast('⚠️ Erro ao conectar.'); }
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
      locked:       S.locked       || {playin:false,pre:false},
      openRounds:   S.openRounds   || {},
    }, { merge: true });
  } catch(e) { toast('❌ Erro ao salvar!'); console.error(e); }
  syncBar(false);
}

function fbListen() {
  onSnapshot(MAIN_DOC, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    S.results      = d.results      || {pre:{},playin:{},playoffs:{}};
    S.bracketTeams = d.bracketTeams || null;
    S.playinTeams  = d.playinTeams  || null;
    S.locked       = d.locked       || {playin:false,pre:false};
    S.openRounds   = d.openRounds   || {};
    S.players      = d.players      || [];
    const lkEl = document.getElementById('lock-controls');
    if (lkEl) lkEl.innerHTML = '';
    renderSistema();
  });
}

// ═══════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════
function syncBar(active) {
  const b = document.getElementById('sync-bar'); if (!b) return;
  b.classList.toggle('active', active);
  b.classList.toggle('done', !active);
  if (!active) setTimeout(() => b.classList.remove('done'), 600);
}
function setOnline(v) {
  const lbl = document.getElementById('sync-label');
  if (lbl) lbl.textContent = v ? 'SINCRONIZADO' : 'OFFLINE';
}
let _tt;
function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(() => el.classList.remove('show'), 2800);
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
//  EVENT DELEGATION
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', e => {
    // Sidebar navigation
    const navBtn = e.target.closest('[data-page]');
    if (navBtn) { showPage(navBtn.dataset.page, navBtn); return; }
    // Static action buttons
    const actBtn = e.target.closest('[data-action]');
    if (actBtn) {
      ({
        addPlayer, savePlayinTeams, resetPlayinTeams,
        saveBracketTeams, resetBracketTeams,
        saveResults, exportData, resetResults, resetAll,
        triggerImport: () => document.getElementById('import-file').click(),
      })[actBtn.dataset.action]?.();
    }
  });
  // Enter no input nome
  document.addEventListener('keydown', e => {
    if (e.key==='Enter' && e.target.closest('[data-enter="addPlayer"]')) addPlayer();
  });
});
window.addEventListener('online',  () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

// Expõe importData para o onchange do input file
window.importData = importData;

fbLoad();

// ═══════════════════════════════════════
//  NAVEGAÇÃO
// ═══════════════════════════════════════
function showPage(id, btn) {
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const pg = document.getElementById('page-'+id);
  if (pg) pg.classList.add('active');
  ({
    apostadores:     renderPlayers,
    'playin-times':  renderPlayinTeamEditor,
    'bracket-times': renderBracketEditor,
    'res-playin':    renderResPlayin,
    'res-pre':       renderResPre,
    'res-playoffs':  renderResPlayoffs,
    sistema:         renderSistema,
  })[id]?.();
}
window.showPage = showPage;

// ═══════════════════════════════════════
//  APOSTADORES
// ═══════════════════════════════════════
function renderPlayers() {
  const el=document.getElementById('player-list'), cnt=document.getElementById('player-count');
  if (!el) return;
  getDocs(PLAYERS_COL).then(snap => {
    if (cnt) cnt.textContent = snap.size+' APOSTADORES';
    if (!snap.size) {
      el.innerHTML='<div style="color:var(--muted);font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;padding:10px;">NENHUM APOSTADOR CADASTRADO</div>';
      return;
    }
    const players=[];
    snap.forEach(d=>players.push({id:d.id,...d.data()}));
    players.sort((a,b)=>a.name.localeCompare(b.name));
    window._pids={};
    players.forEach((p,i)=>{ window._pids['p'+i]=p.id; });
    el.innerHTML=players.map((p,i)=>{
      const piC=Object.keys(p.playin||{}).length, preC=Object.keys(p.pre||{}).length, poC=Object.keys(p.playoffs||{}).length;
      return `<div class="player-row">
        <div class="player-avatar">${p.name[0].toUpperCase()}</div>
        <div style="flex:1;"><div class="player-name">${p.name}</div>
          <div class="player-idx">${piC} play-in · ${preC} pré-po · ${poC} playoffs</div></div>
        <button class="btn btn-outline btn-sm" style="color:var(--neg);border-color:var(--neg);"
          data-remove="p${i}">✕ REMOVER</button>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-remove]').forEach(btn=>{
      btn.addEventListener('click',()=>{ const id=(window._pids||{})[btn.dataset.remove]; if(id) removePlayer(id); });
    });
  }).catch(e=>{ console.error(e); });
}

async function addPlayer() {
  const inp=document.getElementById('new-name');
  const n=inp.value.trim(); if(!n) return;
  const id='p_'+n.toLowerCase().replace(/\s+/g,'_')+'_'+Date.now();
  inp.value='';
  try {
    await setDoc(doc(db,'players',id),{name:n,pin:'0000',playin:{},pre:{},playoffs:{}});
    renderPlayers(); toast('🏀 '+n+' adicionado! PIN padrão: 0000');
  } catch(e){ toast('❌ Erro ao adicionar!'); console.error(e); }
}

async function removePlayer(id) {
  if(!confirm('Remover este apostador e todas as apostas dele?')) return;
  try {
    await deleteDoc(doc(db,'players',id));
    toast('🗑 Apostador removido.'); renderPlayers();
  } catch(e){ toast('❌ Erro ao remover!'); console.error(e); }
}

// ═══════════════════════════════════════
//  TIMES PLAY-IN
// ═══════════════════════════════════════
function renderPlayinTeamEditor() {
  const pi=getPI(), west=PI_SLOTS.filter(s=>s.conf==='west'), east=PI_SLOTS.filter(s=>s.conf==='east');
  function rows(slots) {
    return slots.map(s=>{
      const t=pi[s.key]||DEFAULT_PI[s.key], def=DEFAULT_PI[s.key];
      return `<div class="pi-team-row">
        <span class="pi-seed-lbl">${t.seed}</span>
        <input class="pi-emoji-inp" id="pi-emoji-${s.key}" value="${t.logo}" maxlength="4">
        <div style="flex:1;">
          <input class="pi-name-inp" id="pi-name-${s.key}" value="${t.name}" placeholder="${def.name}">
          <div class="orig-hint">PADRÃO: ${def.name}</div>
        </div></div>`;
    }).join('');
  }
  const el=document.getElementById('pi-teams-editor'); if(!el) return;
  el.innerHTML=`
    <div class="pi-game"><div class="pi-game-head">CONFERÊNCIA OESTE</div>${rows(west)}</div>
    <div class="pi-game"><div class="pi-game-head">CONFERÊNCIA LESTE</div>${rows(east)}</div>`;
}

async function savePlayinTeams() {
  const pi={};
  PI_SLOTS.forEach(s=>{
    const def=DEFAULT_PI[s.key];
    pi[s.key]={seed:def.seed,
      name:document.getElementById('pi-name-'+s.key)?.value.trim()||def.name,
      logo:document.getElementById('pi-emoji-'+s.key)?.value.trim()||def.logo};
  });
  S.playinTeams=pi; await fbSaveState(); renderPlayinTeamEditor();
  toast('✅ Times do Play-In salvos!');
}

async function resetPlayinTeams() {
  if(!confirm('Restaurar times do Play-In para o padrão?')) return;
  S.playinTeams=null; await fbSaveState(); renderPlayinTeamEditor();
  toast('↺ Times restaurados.');
}

// ═══════════════════════════════════════
//  TIMES BRACKET
// ═══════════════════════════════════════
function renderBracketEditor() {
  const tw=getTW(),te=getTE();
  function rows(conf,teams,prefix) {
    return teams.map((t,i)=>{
      const def=(conf==='west'?DEFAULT_TW:DEFAULT_TE)[i];
      return `<div class="te-row">
        <input class="te-seed-inp" id="${prefix}-seed-${i}" value="${t.seed}" maxlength="3">
        <input class="te-emoji-inp" id="${prefix}-logo-${i}" value="${t.logo}" maxlength="4">
        <div style="flex:1;">
          <input class="te-name-inp" id="${prefix}-name-${i}" value="${t.name}" placeholder="${def.name}">
          <div class="orig-hint">PADRÃO: ${def.name}</div>
        </div></div>`;
    }).join('');
  }
  const el=document.getElementById('bracket-editor'); if(!el) return;
  el.innerHTML=`
    <div class="te-conf-block"><div class="te-conf-head west"><span>CONFERÊNCIA OESTE</span></div>${rows('west',tw,'bw')}</div>
    <div class="te-conf-block"><div class="te-conf-head east"><span>CONFERÊNCIA LESTE</span></div>${rows('east',te,'be')}</div>`;
}

async function saveBracketTeams() {
  const west=getTW().map((_,i)=>({
    seed:parseInt(document.getElementById('bw-seed-'+i)?.value)||i+1,
    logo:document.getElementById('bw-logo-'+i)?.value.trim()||'🏀',
    name:document.getElementById('bw-name-'+i)?.value.trim()||'Time '+(i+1),
  }));
  const east=getTE().map((_,i)=>({
    seed:parseInt(document.getElementById('be-seed-'+i)?.value)||i+1,
    logo:document.getElementById('be-logo-'+i)?.value.trim()||'🏀',
    name:document.getElementById('be-name-'+i)?.value.trim()||'Time '+(i+1),
  }));
  S.bracketTeams={west,east}; await fbSaveState(); renderBracketEditor();
  toast('✅ Times do bracket salvos!');
}

async function resetBracketTeams() {
  if(!confirm('Restaurar todos os times para o padrão?')) return;
  S.bracketTeams=null; await fbSaveState(); renderBracketEditor();
  toast('↺ Times restaurados.');
}

// ═══════════════════════════════════════
//  RESULTADOS PLAY-IN
// ═══════════════════════════════════════
function renderResPlayin() {
  const pi = getPI(), r = S.results.playin||{};

  function decisiveTeams(conf) {
    const j1k=conf==='west'?'w78':'e78', j2k=conf==='west'?'w910':'e910';
    const j1t=conf==='west'?[pi.w7,pi.w8]:[pi.e7,pi.e8];
    const j2t=conf==='west'?[pi.w9,pi.w10]:[pi.e9,pi.e10];
    const r1=r[j1k], r2=r[j2k];
    if (r1===undefined||r1===null||r2===undefined||r2===null)
      return [{name:'Venc. J2',logo:'❓'},{name:'Perd. J1',logo:'❓'}];
    return [j2t[r2], j1t[1-r1]];
  }

  // Rodadas separadas, igual ao visual dos playoffs
  const rounds = [
    {
      label: 'JOGOS CLASSIFICATÓRIOS',
      sub:   'JOGO 1 E JOGO 2 — ABERTOS PARA APOSTAS IMEDIATAMENTE',
      matches: [
        {mk:'w78',  label:'OESTE — Jogo 1 (7º vs 8º)', conf:'west', teams:[pi.w7,pi.w8]},
        {mk:'e78',  label:'LESTE — Jogo 1 (7º vs 8º)', conf:'east', teams:[pi.e7,pi.e8]},
        {mk:'w910', label:'OESTE — Jogo 2 (9º vs 10º)',conf:'west', teams:[pi.w9,pi.w10]},
        {mk:'e910', label:'LESTE — Jogo 2 (9º vs 10º)',conf:'east', teams:[pi.e9,pi.e10]},
      ]
    },
    {
      label: 'JOGO DECISIVO',
      sub:   'APOSTAS LIBERADAS AUTOMATICAMENTE APÓS OS RESULTADOS DOS JOGOS 1 E 2',
      matches: [
        {mk:'w3', label:'OESTE — Decisivo (8º seed)', conf:'west', teams:decisiveTeams('west')},
        {mk:'e3', label:'LESTE — Decisivo (8º seed)', conf:'east', teams:decisiveTeams('east')},
      ]
    },
  ];

  const el = document.getElementById('res-playin-matches'); if (!el) return;
  const confBorder = {west:'border-left:3px solid var(--red)', east:'border-left:3px solid var(--blue2)'};

  let html = '';
  rounds.forEach(round => {
    const allDone = round.matches.every(m => r[m.mk]!==undefined && r[m.mk]!==null);
    html += `
      <div style="margin-bottom:24px;">
        <div style="margin-bottom:12px;">
          <div style="font-family:'Bebas Neue';font-size:16px;letter-spacing:3px;color:var(--white);">${round.label}</div>
          <div style="font-family:'Barlow Condensed';font-size:10px;letter-spacing:2px;color:var(--muted);margin-top:2px;">${round.sub}</div>
        </div>
        <div class="res-matches-grid">`;

    round.matches.forEach(m => {
      const has = r[m.mk]!==undefined && r[m.mk]!==null;
      html += `<div class="match-card" style="${confBorder[m.conf]||''}">
        <div class="match-head" style="display:flex;justify-content:space-between;align-items:center;">
          <span>${m.label}</span>
          ${has?`<button class="btn btn-outline btn-sm" style="font-size:9px;padding:2px 8px;color:var(--muted);border-color:var(--border2);" data-clear-pi="${m.mk}">✕ LIMPAR</button>`:''}
        </div>
        <div class="match-body">
          <div class="match-lbl">VENCEDOR</div>
          <div class="match-btns">
            ${m.teams.map((t,i)=>`<button class="match-tbtn${r[m.mk]===i?' sel-g':''}"
              data-pi-mk="${m.mk}" data-pi-idx="${i}">${t.logo} ${t.name}</button>`).join('')}
          </div>
          <div class="match-status">${has?'<span class="status-ok">✓ LANÇADO</span>':'<span class="status-pend">— AGUARDANDO</span>'}</div>
        </div>
      </div>`;
    });

    html += `</div></div>`; // .res-matches-grid + round div
  });

  el.innerHTML = html;

  el.querySelectorAll('[data-pi-mk]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!S.results.playin) S.results.playin = {};
      S.results.playin[btn.dataset.piMk] = parseInt(btn.dataset.piIdx);
      renderResPlayin();
    });
  });
  el.querySelectorAll('[data-clear-pi]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remover este resultado do Play-In?')) return;
      if (S.results.playin) delete S.results.playin[btn.dataset.clearPi];
      renderResPlayin();
      toast('🗑 Resultado removido. Clique em SALVAR para confirmar.');
    });
  });
}
// ═══════════════════════════════════════
//  RESULTADOS PRÉ-PLAYOFFS
// ═══════════════════════════════════════
function renderResPre() {
  const rp=S.results.pre||{}, tw=getTW(), te=getTE(), all=allTeams();
  function singleBtns(field,teams) {
    return teams.map(t=>`<button class="match-tbtn${rp[field]===t.name?' sel-g':''}"
      data-pre-field="${field}" data-pre-name="${esc(t.name)}" data-pre-single="1">${t.logo} ${t.name}</button>`).join('');
  }
  function multiBtns(field,teams) {
    const vals=Array.isArray(rp[field])?rp[field]:[];
    return teams.map(t=>`<button class="match-tbtn${vals.includes(t.name)?' sel-g':''}"
      data-pre-field="${field}" data-pre-name="${esc(t.name)}" data-pre-single="0">${t.logo} ${t.name}</button>`).join('');
  }
  const defs=[
    {field:'cfW',   label:'FINALISTAS CONF OESTE (2 times)',multi:true, teams:tw},
    {field:'cfE',   label:'FINALISTAS CONF LESTE (2 times)',multi:true, teams:te},
    {field:'champW',label:'CAMPEÃO CONF OESTE',             multi:false,teams:tw},
    {field:'champE',label:'CAMPEÃO CONF LESTE',             multi:false,teams:te},
    {field:'champNBA',label:'CAMPEÃO NBA',                  multi:false,teams:all},
  ];
  const el=document.getElementById('res-pre-matches'); if(!el) return;
  el.innerHTML=defs.map(d=>{
    const val=rp[d.field], has=d.multi?(Array.isArray(val)&&val.length>0):(!!val);
    return `<div class="match-card">
      <div class="match-head" style="display:flex;justify-content:space-between;align-items:center;">
        <span>${d.label}</span>
        ${has?`<button class="btn btn-outline btn-sm" style="font-size:9px;padding:2px 8px;color:var(--muted);border-color:var(--border2);" data-clear-pre="${d.field}">✕ LIMPAR</button>`:''}
      </div>
      <div class="match-body">
        <div class="match-btns" style="flex-wrap:wrap;">${d.multi?multiBtns(d.field,d.teams):singleBtns(d.field,d.teams)}</div>
        <div class="match-status">${has?`<span class="status-ok">✓ ${d.multi?(val||[]).join(' e '):val}</span>`:'<span class="status-pend">— AGUARDANDO</span>'}</div>
      </div></div>`;
  }).join('');
  el.querySelectorAll('[data-pre-field]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const field=btn.dataset.preField, name=btn.dataset.preName, single=btn.dataset.preSingle==='1';
      if(!S.results.pre) S.results.pre={};
      if(single){ S.results.pre[field]=name; }
      else {
        let arr=Array.isArray(S.results.pre[field])?[...S.results.pre[field]]:[];
        const idx=arr.indexOf(name);
        if(idx>=0) arr.splice(idx,1); else if(arr.length<2) arr.push(name);
        S.results.pre[field]=arr;
      }
      renderResPre();
    });
  });
  el.querySelectorAll('[data-clear-pre]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const field=btn.dataset.clearPre;
      if(!confirm(`Remover resultado de "${field}"?`)) return;
      if(S.results.pre) delete S.results.pre[field];
      renderResPre();
      toast('🗑 Resultado removido. Clique em SALVAR para confirmar.');
    });
  });
}

// ═══════════════════════════════════════
//  RESULTADOS PLAYOFFS
// ═══════════════════════════════════════
const PO_ROUNDS = [
  {label:'1ª RODADA — OESTE',  conf:'west', matches:['wR1_0','wR1_1','wR1_2','wR1_3']},
  {label:'1ª RODADA — LESTE',  conf:'east', matches:['eR1_0','eR1_1','eR1_2','eR1_3']},
  {label:'SEMIFINAIS — OESTE', conf:'west', matches:['wR2_0','wR2_1']},
  {label:'SEMIFINAIS — LESTE', conf:'east', matches:['eR2_0','eR2_1']},
  {label:'FINAL CONF — OESTE', conf:'west', matches:['wR3_0']},
  {label:'FINAL CONF — LESTE', conf:'east', matches:['eR3_0']},
  {label:'🏆 NBA FINALS',       conf:'champ',matches:['finals']},
];

function getMatchTeams(mk) {
  const tw=getTW(),te=getTE(),wR1=r1p(tw),eR1=r1p(te);
  function rr(k){ return (S.results.playoffs[k]||{}).winner||'?'; }
  const map={
    wR1_0:[wR1[0][0].name,wR1[0][1].name],wR1_1:[wR1[1][0].name,wR1[1][1].name],
    wR1_2:[wR1[2][0].name,wR1[2][1].name],wR1_3:[wR1[3][0].name,wR1[3][1].name],
    eR1_0:[eR1[0][0].name,eR1[0][1].name],eR1_1:[eR1[1][0].name,eR1[1][1].name],
    eR1_2:[eR1[2][0].name,eR1[2][1].name],eR1_3:[eR1[3][0].name,eR1[3][1].name],
    wR2_0:[rr('wR1_0'),rr('wR1_1')],wR2_1:[rr('wR1_2'),rr('wR1_3')],
    eR2_0:[rr('eR1_0'),rr('eR1_1')],eR2_1:[rr('eR1_2'),rr('eR1_3')],
    wR3_0:[rr('wR2_0'),rr('wR2_1')],eR3_0:[rr('eR2_0'),rr('eR2_1')],
    finals:[rr('wR3_0'),rr('eR3_0')],
  };
  return map[mk]||['?','?'];
}

function renderResPlayoffs() {
  const r=S.results.playoffs||{};
  const el=document.getElementById('res-playoffs-content'); if(!el) return;
  const border={west:'border-left:3px solid var(--red)',east:'border-left:3px solid var(--blue2)',champ:'border-left:3px solid var(--gold)'};
  let html='';
  PO_ROUNDS.forEach(rd=>{
    html+=`<div class="admin-card"><div class="ac-head"><div class="ac-title">${rd.label}</div></div><div class="ac-body"><div class="res-matches-grid">`;
    rd.matches.forEach(mk=>{
      const res=r[mk]||{}, teams=getMatchTeams(mk);
      const isDone=!!res.winner&&!!res.score;
      const hasAny=!!res.winner||!!res.score;
      html+=`<div class="match-card" style="${border[rd.conf]||''}">
        <div class="match-head" style="display:flex;justify-content:space-between;align-items:center;">
          <span>${teams[0]} vs ${teams[1]}</span>
          ${hasAny?`<button class="btn btn-outline btn-sm" style="font-size:9px;padding:2px 8px;color:var(--muted);border-color:var(--border2);" data-clear-po="${mk}">✕ LIMPAR</button>`:''}
        </div>
        <div class="match-body">
          <div class="match-lbl">VENCEDOR</div>
          <div class="match-btns">${teams.map(t=>`<button class="match-tbtn${res.winner===t?' sel-g':''}"
            data-pow-mk="${mk}" data-pow-name="${esc(t)}">${teamByName(t).logo} ${t}</button>`).join('')}</div>
          <div class="match-lbl" style="margin-top:8px;">PLACAR</div>
          <div class="score-btns">${SCORES.map(sc=>`<button class="score-btn${res.score===sc?' sel-g':''}"
            data-pos-mk="${mk}" data-pos-sc="${sc}">${sc}</button>`).join('')}</div>
          <div class="match-status">${isDone?`<span class="status-ok">✓ ${res.winner} ${res.score}</span>`:res.winner?'<span style="color:var(--orange)">⚠ FALTA PLACAR</span>':'<span class="status-pend">— AGUARDANDO</span>'}</div>
        </div></div>`;
    });
    html+='</div></div></div>';
  });
  el.innerHTML=html;
  el.querySelectorAll('[data-pow-mk]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const mk=btn.dataset.powMk, name=btn.dataset.powName;
      if(!S.results.playoffs) S.results.playoffs={};
      if(!S.results.playoffs[mk]) S.results.playoffs[mk]={};
      S.results.playoffs[mk].winner=name; renderResPlayoffs();
    });
  });
  el.querySelectorAll('[data-pos-mk]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const mk=btn.dataset.posMk, sc=btn.dataset.posSc;
      if(!S.results.playoffs) S.results.playoffs={};
      if(!S.results.playoffs[mk]) S.results.playoffs[mk]={};
      S.results.playoffs[mk].score=sc; renderResPlayoffs();
    });
  });
  el.querySelectorAll('[data-clear-po]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('Remover vencedor e placar desta série?')) return;
      if(S.results.playoffs) delete S.results.playoffs[btn.dataset.clearPo];
      renderResPlayoffs();
      toast('🗑 Resultado removido. Clique em SALVAR para confirmar.');
    });
  });
}

async function saveResults() {
  await fbSaveState();
  toast('✅ Resultados salvos! Placar atualizado para todos.');
}

// ═══════════════════════════════════════
//  SISTEMA
// ═══════════════════════════════════════
function renderSistema() {
  const el=document.getElementById('info-body'); if(!el) return;
  el.innerHTML=`
    Resultados Play-In: <b style="color:var(--text)">${Object.keys(S.results.playin||{}).length}/6</b><br>
    Resultados Playoffs: <b style="color:var(--text)">${Object.keys(S.results.playoffs||{}).length}/15</b><br>
    Times bracket: <b style="color:var(--text)">${S.bracketTeams?'CUSTOMIZADOS':'PADRÃO'}</b><br>
    Times Play-In: <b style="color:var(--text)">${S.playinTeams?'CUSTOMIZADOS':'PADRÃO'}</b>`;
  getDocs(PLAYERS_COL).then(snap=>{
    el.innerHTML=`Apostadores: <b style="color:var(--text)">${snap.size}</b><br>`+el.innerHTML;
  }).catch(()=>{});

  const lkEl=document.getElementById('lock-controls'); if(!lkEl) return;
  lkEl.innerHTML='';
  const lk=S.locked||{};
  [{id:'playin',label:'PLAY-IN'},{id:'pre',label:'PRÉ-PLAYOFFS'}].forEach(s=>{
    const locked=lk[s.id]||false;
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);';
    row.innerHTML=`
      <div>
        <div style="font-family:'Bebas Neue';font-size:15px;letter-spacing:2px;color:var(--white);">${s.label}</div>
        <div style="font-family:'Barlow Condensed';font-size:11px;letter-spacing:2px;color:${locked?'var(--neg)':'var(--green)'};">
          ${locked?'🔒 ENCERRADO':'🟢 ABERTO PARA APOSTAS'}</div>
      </div>
      <button class="btn ${locked?'btn-outline':'btn-red'} btn-sm">${locked?'↺ REABRIR':'🔒 ENCERRAR'}</button>`;
    row.querySelector('button').addEventListener('click',()=>toggleLock(s.id));
    lkEl.appendChild(row);
  });
  const note=document.createElement('div');
  note.style.cssText='font-family:Barlow Condensed;font-size:11px;letter-spacing:2px;color:var(--muted);padding:10px 0;';
  note.textContent='ℹ️ PLAYOFFS: apostas abrem automaticamente conforme resultados forem lançados em Playoffs / Séries';
  lkEl.appendChild(note);
}

async function toggleLock(section) {
  if(!S.locked) S.locked={};
  S.locked[section]=!(S.locked[section]||false);
  await fbSaveState();
  const lkEl=document.getElementById('lock-controls');
  if(lkEl) lkEl.innerHTML='';
  renderSistema();
  toast(S.locked[section]?'🔒 Apostas encerradas!':'✅ Apostas reabertas!');
}

async function exportData() {
  const snap=await getDocs(PLAYERS_COL);
  const players={};
  snap.forEach(d=>{ players[d.id]=d.data(); });
  const blob=new Blob([JSON.stringify({state:S,players},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='bolinha-nba-'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); toast('⬇ Exportado!');
}

async function importData(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try {
      const data=JSON.parse(e.target.result);
      if(!confirm('Importar dados? Substitui tudo no Firebase.')) return;
      if(data.state){ S=data.state; await fbSaveState(); }
      if(data.players){
        const batch=writeBatch(db);
        Object.entries(data.players).forEach(([pid,p])=>batch.set(doc(db,'players',pid),p));
        await batch.commit();
      }
      toast('✅ Dados importados!'); renderSistema();
    } catch(err){ toast('❌ Arquivo inválido!'); }
  };
  reader.readAsText(file);
}

async function resetResults() {
  if(!confirm('Resetar todos os resultados? As apostas são mantidas.')) return;
  S.results={pre:{},playin:{},playoffs:{}};
  await fbSaveState(); toast('🔄 Resultados resetados.');
  renderResPlayin(); renderResPre(); renderResPlayoffs();
}

async function resetAll() {
  if(!confirm('ATENÇÃO: apaga TUDO do Firebase. Tem certeza?')) return;
  if(!confirm('Última chance — confirmar reset total?')) return;
  S={players:[],results:{pre:{},playin:{},playoffs:{}},bracketTeams:null,playinTeams:null,locked:{playin:false,pre:false},openRounds:{}};
  await fbSaveState();
  const snap=await getDocs(PLAYERS_COL);
  const batch=writeBatch(db);
  snap.forEach(d=>batch.delete(d.ref));
  await batch.commit();
  toast('🔄 Tudo resetado.'); renderPlayers(); renderSistema();
}