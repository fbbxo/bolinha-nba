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

// ── MAPEAMENTO DE LOGOS ──
// Coloque os arquivos na pasta /logos/ do repositório
const TEAM_LOGOS = {
  'OKC Thunder':          'logos/okc.png',
  'Houston Rockets':      'logos/rockets.png',
  'LA Clippers':          'logos/clippers.png',
  'Denver Nuggets':       'logos/denver.png',
  'Memphis Grizzlies':    'logos/memphis.png',
  'Minnesota Wolves':     'logos/wolves.png',
  'Golden State Warriors':'logos/warriors.png',
  'Dallas Mavericks':     'logos/dallas.png',
  'Cleveland Cavaliers':  'logos/cavaliers.png',
  'Boston Celtics':       'logos/boston.png',
  'New York Knicks':      'logos/knicks.png',
  'Milwaukee Bucks':      'logos/bucks.png',
  'Detroit Pistons':      'logos/pistons.png',
  'Indiana Pacers':       'logos/pacers.png',
  'Atlanta Hawks':        'logos/hawks.png',
  'Orlando Magic':        'logos/magic.png',
  'Miami Heat':           'logos/heat.png',
  'Phoenix Suns':         'logos/suns.png',
  'Chicago Bulls':        'logos/bulls.png',
  'Los Angeles Lakers':   'logos/lakers.png',
  'Sacramento Kings':     'logos/kings.png',
  'San Antonio Spurs':    'logos/spurs.png',
  'Utah Jazz':            'logos/jazz.png',
  'Washington Wizards':   'logos/wizards.png',
  'Portland Trail Blazers':'logos/blazers.png',
  'New Orleans Pelicans': 'logos/pelicans.png',
  'Minnesota Timberwolves':'logos/wolves.png',
  'Brooklyn Nets':        'logos/nets.png',
  'Toronto Raptors':      'logos/raptors.png',
  'Philadelphia 76ers':   'logos/sixers.png',
  'Charlotte Hornets':    'logos/hornets.png',
};

// Retorna o HTML do logo — imagem se disponível, emoji como fallback
function teamLogo(name, size=28) {
  const src = TEAM_LOGOS[name];
  if (src) {
    return `<img src="${src}" alt="${name}" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none';this.nextSibling.style.display='inline'">
            <span style="display:none;font-size:${Math.round(size*0.55)}px;">🏀</span>`;
  }
  return `<span style="font-size:${Math.round(size*0.55)}px;">🏀</span>`;
}

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
      S.locked       = d.locked       || {playin:false,pre:false};
      S.openRounds   = d.openRounds   || {r1:false,semi:false,cf:false,finals:false};
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
  
  renderPlayin();
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
  // Banner do play-in (estático no HTML)
  document.getElementById('pi-locked-banner')?.classList.toggle('hidden', !(lk.playin||false));
  // Os outros banners são gerenciados pela renderização dinâmica de cada seção
  document.getElementById('pre-locked-banner')?.classList.toggle('hidden', !(lk.pre||false));
  const preBtn = document.getElementById('pre-save-btn');
  if (preBtn) preBtn.disabled = lk.pre||false;
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
    S.locked       = d.locked       || {playin:false,pre:false};
      S.openRounds   = d.openRounds   || {r1:false,semi:false,cf:false,finals:false};
    S.players      = d.players      || [];
    if (ME) {
      renderPlayin();
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
    renderPlayin();
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
  if (id === 'playin')   renderPlayin();
  if (id === 'ranking')  calcAndRender();
  if (id === 'playoffs') renderBracket();
  if (id === 'pre')      renderPreCards();
};

// ═══════════════════════════════════════
//  PLAY-IN
// ═══════════════════════════════════════
//  PLAY-IN — RENDERIZAÇÃO DINÂMICA
// ═══════════════════════════════════════
// Lógica automática igual ao bracket:
// Jogo Decisivo só aparece quando os times são conhecidos
// (após o admin lançar resultados dos Jogos 1 e 2)

function getPlayinDecisiveTeams(conf) {
  // Times do jogo decisivo = Vencedor do J2 vs Perdedor do J1
  const rPI = S.results.playin || {};
  const pi  = getPI();
  const j1Key = conf==='west' ? 'w78'  : 'e78';
  const j2Key = conf==='west' ? 'w910' : 'e910';

  // Quem são os times do J1 e J2 desta conf
  const j1teams = conf==='west' ? [pi.w7, pi.w8]   : [pi.e7, pi.e8];
  const j2teams = conf==='west' ? [pi.w9, pi.w10]  : [pi.e9, pi.e10];

  const j1result = rPI[j1Key]; // 0 ou 1
  const j2result = rPI[j2Key]; // 0 ou 1

  // Só retorna times reais se ambos os resultados foram lançados
  if (j1result === undefined || j1result === null) return null;
  if (j2result === undefined || j2result === null) return null;

  const j1loser  = j1teams[1 - j1result]; // perdedor do J1
  const j2winner = j2teams[j2result];      // vencedor do J2
  return [j2winner, j1loser]; // [idx0, idx1] para o jogo decisivo
}

function renderPlayin() {
  const el = document.getElementById('playin-render'); if (!el) return;
  const locked = (S.locked||{}).playin || false;
  const rPI    = S.results.playin || {};
  const picks  = ME ? (ME.playin||{}) : {};
  const pi     = getPI();

  // Estrutura dos jogos
  const confs = [
    {
      id: 'west', label: 'CONFERÊNCIA OESTE', cls: 'west',
      games: [
        { mk:'w78',  label:'JOGO 1 — 7º vs 8º SEED',   pts:1, teams:[pi.w7, pi.w8],  known:true },
        { mk:'w910', label:'JOGO 2 — 9º vs 10º SEED',  pts:1, teams:[pi.w9, pi.w10], known:true },
        { mk:'w3',   label:'JOGO DECISIVO — 8º SEED',  pts:2, teams:null,             known:false },
      ]
    },
    {
      id: 'east', label: 'CONFERÊNCIA LESTE', cls: 'east',
      games: [
        { mk:'e78',  label:'JOGO 1 — 7º vs 8º SEED',   pts:1, teams:[pi.e7, pi.e8],  known:true },
        { mk:'e910', label:'JOGO 2 — 9º vs 10º SEED',  pts:1, teams:[pi.e9, pi.e10], known:true },
        { mk:'e3',   label:'JOGO DECISIVO — 8º SEED',  pts:2, teams:null,             known:false },
      ]
    },
  ];

  // Preenche times do jogo decisivo com base nos resultados
  confs[0].games[2].teams = getPlayinDecisiveTeams('west');
  confs[1].games[2].teams = getPlayinDecisiveTeams('east');

  let html = '<div class="pi-grid">';

  confs.forEach(conf => {
    html += `<div class="conf-block">
      <div class="conf-label ${conf.cls}">${conf.label}</div>`;

    conf.games.forEach(game => {
      const realResult = rPI[game.mk]; // 0 ou 1 ou undefined
      const hasPick    = picks[game.mk] !== undefined && picks[game.mk] !== null;
      const myPick     = picks[game.mk];
      const teamsKnown = Array.isArray(game.teams) && game.teams.length === 2;
      const isDone     = realResult !== undefined && realResult !== null;
      const isOpen     = !locked && teamsKnown && !isDone;
      const confBorder = conf.cls==='west' ? 'var(--red)' : 'var(--blue2)';

      // Não mostra o Jogo Decisivo se os times ainda não são conhecidos
      if (!teamsKnown) {
        html += `<div class="mc ${conf.cls}" style="margin-bottom:12px;opacity:.5;">
          <div class="mh">
            <span>${game.label}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="pb">${game.pts} PT${game.pts>1?'S':''}</span>
              <span style="font-family:'Barlow Condensed';font-size:9px;letter-spacing:2px;color:var(--muted);">🔒 AGUARDANDO</span>
            </div>
          </div>
          <div style="padding:16px 13px;font-family:'Barlow Condensed';font-size:12px;letter-spacing:2px;color:var(--muted);text-align:center;">
            Apostas abrem após os resultados dos Jogos 1 e 2
          </div>
        </div>`;
        return;
      }

      // Status
      let statusColor, statusText;
      if (isDone)       { statusColor='var(--muted)'; statusText='✅ ENCERRADO'; }
      else if (locked)  { statusColor='var(--neg)';   statusText='🔒 APOSTAS ENCERRADAS'; }
      else              { statusColor='var(--green)';  statusText='🟢 APOSTAR'; }

      html += `<div class="mc ${conf.cls}" style="margin-bottom:12px;">
        <div class="mh">
          <span>${game.label}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="pb">${game.pts} PT${game.pts>1?'S':''}</span>
            <span style="font-family:'Barlow Condensed';font-size:9px;letter-spacing:2px;color:${statusColor};">${statusText}</span>
          </div>
        </div>`;

      // Renderiza os dois times
      game.teams.forEach((team, idx) => {
        const isPicked  = myPick === idx;
        const isWinner  = realResult === idx;
        const isCorrect = isDone && isPicked && isWinner;
        const isWrong   = isDone && isPicked && !isWinner;

        let bg = 'transparent';
        if (isCorrect)                              bg = 'rgba(34,197,94,.15)';
        else if (isWrong)                           bg = 'rgba(239,68,68,.1)';
        else if (isPicked && conf.cls==='west')     bg = 'rgba(200,16,46,.14)';
        else if (isPicked && conf.cls==='east')     bg = 'rgba(29,66,138,.18)';

        const cursor   = isOpen ? 'pointer' : 'default';
        const dataAttr = isOpen ? `data-pi-mk="${game.mk}" data-pi-idx="${idx}" data-pi-conf="${conf.cls}"` : '';

        html += `<div ${dataAttr} style="display:flex;align-items:center;padding:11px 13px;
          gap:11px;cursor:${cursor};background:${bg};transition:background .15s;
          border-bottom:1px solid rgba(255,255,255,.04);">
          <span style="font-family:'Bebas Neue';font-size:20px;color:var(--muted);min-width:24px;text-align:center;">${team.seed}</span>
          <div style="width:34px;height:34px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${teamLogo(team.name,24)}</div>
          <div style="flex:1;font-family:'Barlow Condensed';font-weight:700;font-size:14px;">${team.name}</div>
          ${isPicked ? `<span style="font-size:14px;">${isDone?(isWinner?'✅':'❌'):'✓'}</span>` : ''}
          <div style="width:16px;height:16px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;
            ${isPicked?`background:var(--${conf.cls==='west'?'red':'blue2'});border-color:var(--${conf.cls==='west'?'red':'blue2'});`:''}"></div>
        </div>`;
      });

      // Resultado + pontuação
      if (isDone) {
        const winnerTeam = game.teams[realResult];
        const myPickTeam = hasPick ? game.teams[myPick] : null;
        const correct    = myPick === realResult;

        let ptColor, ptLabel;
        if (!hasPick)  { ptColor='var(--muted)';  ptLabel='SEM APOSTA'; }
        else if (correct) { ptColor='var(--green)'; ptLabel=`🎯 +${game.pts} PT${game.pts>1?'S':''} — ACERTOU!`; }
        else           { ptColor='var(--neg)';    ptLabel='✗ 0 PTS — ERROU'; }

        html += `<div style="border-top:1px solid var(--border);background:rgba(0,0,0,.2);">
          <div style="padding:5px 13px 3px;font-family:'Barlow Condensed';font-size:9px;
            letter-spacing:2px;color:${ptColor};">${ptLabel}</div>
          <div style="display:flex;gap:12px;padding:3px 13px 8px;flex-wrap:wrap;">
            ${myPickTeam ? `<div style="font-family:'Barlow Condensed';font-size:11px;
              display:flex;align-items:center;gap:4px;color:var(--muted2);">
              <span style="color:var(--muted);font-size:9px;letter-spacing:2px;">SEU PALPITE:</span>
              ${teamLogo(myPickTeam.name,13)}
              <span style="color:${correct?'var(--green)':'var(--neg)'};">${myPickTeam.name}</span>
            </div>` : ''}
            <div style="font-family:'Barlow Condensed';font-size:11px;
              display:flex;align-items:center;gap:4px;color:var(--muted2);">
              <span style="color:var(--muted);font-size:9px;letter-spacing:2px;">RESULTADO:</span>
              ${teamLogo(winnerTeam.name,13)}
              <span style="color:var(--white);">${winnerTeam.name}</span>
            </div>
          </div>
        </div>`;
      }

      // Botão salvar — só aparece se jogo aberto e pick feito
      if (isOpen && hasPick) {
        html += `<div style="padding:8px 13px;border-top:1px solid var(--border);text-align:right;">
          <button data-save-pi="true" class="btn btn-gold" style="font-size:11px;padding:5px 14px;">💾 SALVAR</button>
        </div>`;
      }

      html += `</div>`; // .mc
    });

    html += `</div>`; // .conf-block
  });

  html += '</div>'; // .pi-grid

  // Botão salvar global — aparece se há qualquer pick não salvo em jogo aberto
  const hasAnyOpenPick = confs.some(c =>
    c.games.some(g => {
      const rr = rPI[g.mk];
      const open = !locked && Array.isArray(g.teams) && (rr===undefined||rr===null);
      return open && (picks[g.mk]!==undefined && picks[g.mk]!==null);
    })
  );
  if (hasAnyOpenPick) {
    html += `<div style="text-align:center;margin-top:20px;">
      <button data-save-pi="true" class="btn btn-gold">💾 SALVAR APOSTAS DO PLAY-IN</button>
    </div>`;
  }

  el.innerHTML = html;

  // Delegação de eventos — picks
  el.querySelectorAll('[data-pi-mk]').forEach(row => {
    row.addEventListener('click', () => {
      if (!ME) return;
      if ((S.locked||{}).playin) { toast('🔒 Apostas encerradas!'); return; }
      if (!ME.playin) ME.playin = {};
      ME.playin[row.dataset.piMk] = parseInt(row.dataset.piIdx);
      renderPlayin();
    });
  });

  // Delegação para salvar
  el.querySelectorAll('[data-save-pi]').forEach(btn => {
    btn.addEventListener('click', () => savePicks('pi'));
  });
}

function loadPlayin() {
  renderPlayin();
}

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
        <span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;">${teamLogo(t.name,18)}</span>
        <span>${t.name}</span></button>`;
    }).join('');
  }
  function multiBtns(field, teams, cls) {
    return teams.map(t => {
      const vals = Array.isArray(picks[field])?picks[field]:[];
      const sel  = vals.includes(t.name);
      return `<button class="pre-tbtn${sel?' '+cls:''}"${locked?' disabled':''} onclick="prePick('${field}','${esc(t.name)}',true)">
        <span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;">${teamLogo(t.name,18)}</span>
        <span>${t.name}</span></button>`;
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
//  BRACKET — POR RODADA
// ═══════════════════════════════════════
const MATCH_ROUND = {
  wR1_0:'r1',wR1_1:'r1',wR1_2:'r1',wR1_3:'r1',
  eR1_0:'r1',eR1_1:'r1',eR1_2:'r1',eR1_3:'r1',
  wR2_0:'semi',wR2_1:'semi',eR2_0:'semi',eR2_1:'semi',
  wR3_0:'cf',eR3_0:'cf', finals:'finals',
};
const ROUND_ORDER = ['r1','semi','cf','finals'];

const ROUNDS_CONFIG = [
  { id:'r1', label:'1ª RODADA', series:[
    {mk:'wR1_0',conf:'west',label:'Oeste — 1v8'},{mk:'wR1_1',conf:'west',label:'Oeste — 2v7'},
    {mk:'wR1_2',conf:'west',label:'Oeste — 3v6'},{mk:'wR1_3',conf:'west',label:'Oeste — 4v5'},
    {mk:'eR1_0',conf:'east',label:'Leste — 1v8'},{mk:'eR1_1',conf:'east',label:'Leste — 2v7'},
    {mk:'eR1_2',conf:'east',label:'Leste — 3v6'},{mk:'eR1_3',conf:'east',label:'Leste — 4v5'},
  ]},
  { id:'semi', label:'SEMIFINAIS', series:[
    {mk:'wR2_0',conf:'west',label:'Oeste Semi 1'},{mk:'wR2_1',conf:'west',label:'Oeste Semi 2'},
    {mk:'eR2_0',conf:'east',label:'Leste Semi 1'},{mk:'eR2_1',conf:'east',label:'Leste Semi 2'},
  ]},
  { id:'cf', label:'FINAIS DE CONFERÊNCIA', series:[
    {mk:'wR3_0',conf:'west',label:'Final Conf Oeste'},
    {mk:'eR3_0',conf:'east',label:'Final Conf Leste'},
  ]},
  { id:'finals', label:'🏆 NBA FINALS', series:[
    {mk:'finals',conf:'champ',label:'NBA Finals'},
  ]},
];

function resolveWinnerReal(mk) {
  return (S.results.playoffs||{})[mk]?.winner || null;
}

function getSeriesTeams(mk) {
  const tw = getTW(), te = getTE();
  const wR1 = r1p(tw), eR1 = r1p(te);
  function rr(k){ const w=resolveWinnerReal(k); return w?teamByName(w):null; }
  const map = {
    wR1_0:[wR1[0][0],wR1[0][1]], wR1_1:[wR1[1][0],wR1[1][1]],
    wR1_2:[wR1[2][0],wR1[2][1]], wR1_3:[wR1[3][0],wR1[3][1]],
    eR1_0:[eR1[0][0],eR1[0][1]], eR1_1:[eR1[1][0],eR1[1][1]],
    eR1_2:[eR1[2][0],eR1[2][1]], eR1_3:[eR1[3][0],eR1[3][1]],
    wR2_0:[rr('wR1_0'),rr('wR1_1')], wR2_1:[rr('wR1_2'),rr('wR1_3')],
    eR2_0:[rr('eR1_0'),rr('eR1_1')], eR2_1:[rr('eR1_2'),rr('eR1_3')],
    wR3_0:[rr('wR2_0'),rr('wR2_1')], eR3_0:[rr('eR2_0'),rr('eR2_1')],
    finals:[rr('wR3_0'),rr('eR3_0')],
  };
  return (map[mk]||[null,null]).map(t=>t||{name:'?',seed:'?',logo:'❓'});
}

function renderBracket() {
  const outer = document.getElementById('bracket-outer');
  if (!outer) return;
  const picks       = ME ? (ME.playoffs||{}) : {};
  const resPlayoffs = S.results.playoffs || {};
  const globalLocked = (S.locked||{}).playoffs || false;

  // Uma série está ABERTA para apostar se:
  // 1. Os dois times dela são conhecidos (resultado das séries anteriores lançado)
  // 2. A série ainda não tem resultado lançado pelo admin
  // 3. As apostas globais não estão encerradas
  function isSeriesOpen(mk) {
    if (globalLocked) return false;
    if (resPlayoffs[mk]?.winner) return false; // série já terminou
    const teams = getSeriesTeams(mk);
    // Ambos os times precisam ser conhecidos (não '?')
    return teams.every(t => t && t.name !== '?');
  }

  // Verifica se pelo menos uma série da 1ª rodada tem times (playoffs começaram)
  const r1Teams = getSeriesTeams('wR1_0');
  const playoffsStarted = r1Teams.some(t => t && t.name !== '?');

  if (!playoffsStarted) {
    outer.innerHTML = `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:36px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">🏀</div>
      <div style="font-family:'Bebas Neue';font-size:22px;letter-spacing:3px;color:var(--white);margin-bottom:8px;">PLAYOFFS AINDA NÃO COMEÇARAM</div>
      <div style="font-family:'Barlow Condensed';font-size:13px;letter-spacing:2px;color:var(--muted);">
        As apostas abrirão automaticamente conforme os times dos playoffs forem definidos.
      </div>
    </div>`;
    return;
  }

  // Reorganiza em Oeste (esquerda) e Leste (direita) por rodada
  const WEST_SERIES = {
    r1:    ['wR1_0','wR1_1','wR1_2','wR1_3'],
    semi:  ['wR2_0','wR2_1'],
    cf:    ['wR3_0'],
  };
  const EAST_SERIES = {
    r1:    ['eR1_0','eR1_1','eR1_2','eR1_3'],
    semi:  ['eR2_0','eR2_1'],
    cf:    ['eR3_0'],
  };
  const ROUND_LABELS_MAP = { r1:'1ª RODADA', semi:'SEMIFINAIS', cf:'FINAL DE CONF' };

  // Função que renderiza um card de série
  function seriesCard(mk, conf) {
    const teams      = getSeriesTeams(mk);
    const pick       = picks[mk]||{};
    const realR      = resPlayoffs[mk]||{};
    const open       = isSeriesOpen(mk);
    const teamsKnown = teams.every(t => t && t.name !== '?');
    const confBorder = conf==='west'?'var(--red)':conf==='east'?'var(--blue2)':'var(--gold)';
    const seriesLabels = {
      wR1_0:'1v8',wR1_1:'2v7',wR1_2:'3v6',wR1_3:'4v5',
      eR1_0:'1v8',eR1_1:'2v7',eR1_2:'3v6',eR1_3:'4v5',
      wR2_0:'Semi 1',wR2_1:'Semi 2',eR2_0:'Semi 1',eR2_1:'Semi 2',
      wR3_0:'Final Conf',eR3_0:'Final Conf',finals:'NBA Finals',
    };

    let html = `<div style="background:var(--card);border:1px solid var(--border);
      border-left:3px solid ${confBorder};border-radius:10px;overflow:hidden;
      transition:transform .2s,box-shadow .2s;margin-bottom:10px;"
      ${open?`onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''"`:''}>
      <div style="padding:6px 12px;background:rgba(255,255,255,.025);border-bottom:1px solid var(--border);
        font-family:'Barlow Condensed';font-size:10px;letter-spacing:3px;color:var(--muted);
        display:flex;justify-content:space-between;align-items:center;">
        <span>${seriesLabels[mk]||mk}</span>
        <span style="color:${open?'var(--green)':realR.winner?'var(--muted)':'var(--muted)'};">
          ${open?'🟢 APOSTAR':realR.winner?'✅':'🔒'}
        </span>
      </div>`;

    if (!teamsKnown) {
      html += `<div style="padding:14px 12px;text-align:center;font-family:'Barlow Condensed';
        font-size:11px;letter-spacing:2px;color:var(--muted);">🔒 A definir</div>`;
    } else {
      teams.forEach(team => {
        const isPicked  = pick.winner===team.name;
        const isWinner  = realR.winner===team.name;
        const isCorrect = isPicked && isWinner;
        const isWrong   = isPicked && realR.winner && !isWinner;

        let bg = 'transparent', borderLeft = 'none';
        if (isCorrect)                        bg = 'rgba(34,197,94,.15)';
        else if (isWrong)                     bg = 'rgba(239,68,68,.1)';
        else if (isPicked && conf==='west')   { bg='rgba(200,16,46,.14)'; borderLeft='3px solid var(--red)'; }
        else if (isPicked && conf==='east')   { bg='rgba(29,66,138,.18)'; borderLeft='3px solid var(--blue2)'; }
        else if (isPicked)                    { bg='rgba(253,185,39,.14)'; borderLeft='3px solid var(--gold)'; }

        let dotStyle = 'border:2px solid var(--border);background:transparent;';
        if (isCorrect)                        dotStyle='border:2px solid var(--green);background:var(--green);';
        else if (isWrong)                     dotStyle='border:2px solid var(--neg);background:var(--neg);';
        else if (isPicked && conf==='west')   dotStyle='border:2px solid var(--red);background:var(--red);';
        else if (isPicked && conf==='east')   dotStyle='border:2px solid var(--blue2);background:var(--blue2);';
        else if (isPicked)                    dotStyle='border:2px solid var(--gold);background:var(--gold);';

        const clickFn = open ? `bPick('${mk}','${esc(team.name)}','${conf}')` : '';

        html += `<div ${clickFn?`onclick="${clickFn}"`:''}
          style="display:flex;align-items:center;gap:10px;padding:9px 12px;
          cursor:${open?'pointer':'default'};background:${bg};border-left:${borderLeft};
          transition:background .15s;border-bottom:1px solid rgba(255,255,255,.04);">
          <span style="font-family:'Bebas Neue';font-size:16px;color:var(--muted);min-width:18px;text-align:center;">${team.seed||'?'}</span>
          <div style="width:28px;height:28px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${teamLogo(team.name,20)}</div>
          <span style="font-family:'Barlow Condensed';font-weight:700;font-size:13px;flex:1;">${team.name}</span>
          ${isPicked?`<span style="font-size:11px;">${realR.winner?(isWinner?'✅':'❌'):'✓'}</span>`:''}
          <div style="width:13px;height:13px;border-radius:50%;flex-shrink:0;${dotStyle}"></div>
        </div>`;
      });

      // Placar picker
      if (pick.winner && open) {
        html += `<div style="padding:8px 12px;border-top:1px solid var(--border);background:var(--card2);">
          <div style="font-family:'Barlow Condensed';font-size:9px;letter-spacing:3px;color:var(--muted);margin-bottom:5px;">PLACAR</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${SCORES.map(sc=>`<button onclick="setPlacar('${mk}','${sc}')"
              style="font-family:'Bebas Neue';font-size:11px;padding:3px 9px;border-radius:4px;cursor:pointer;transition:all .15s;
              border:1px solid ${pick.score===sc?'var(--gold)':'var(--border2)'};
              background:${pick.score===sc?'var(--gold)':'transparent'};
              color:${pick.score===sc?'#000':'var(--muted2)'};">${sc}</button>`).join('')}
          </div>
        </div>`;
      }

      // Resultado
      if (realR.winner) {
        const correct = pick.winner===realR.winner;
        const exactOk = correct && pick.score===realR.score;
        const pts     = !pick.winner ? 0 : correct ? (exactOk ? 2 : 1) : 0;

        // Linha de pontuação
        let ptColor, ptLabel;
        if (!pick.winner)      { ptColor='var(--muted)';  ptLabel='SEM APOSTA'; }
        else if (exactOk)      { ptColor='var(--green)';  ptLabel='🎯 +2 PTS — VENCEDOR + PLACAR EXATO'; }
        else if (correct)      { ptColor='var(--gold)';   ptLabel='✓ +1 PT — SÓ O VENCEDOR'; }
        else                   { ptColor='var(--neg)';    ptLabel='✗ 0 PTS — ERROU O VENCEDOR'; }

        html += `<div style="border-top:1px solid var(--border);background:var(--card2);">
          <div style="padding:6px 12px 4px;font-family:'Barlow Condensed';font-size:9px;
            letter-spacing:2px;color:${ptColor};">${ptLabel}</div>
          <div style="display:flex;gap:8px;padding:4px 12px 8px;flex-wrap:wrap;">`;

        // Palpite do apostador
        if (pick.winner) {
          const pickCorrect = pick.winner===realR.winner;
          html += `<div style="font-family:'Barlow Condensed';font-size:11px;letter-spacing:1px;
            color:var(--muted2);display:flex;align-items:center;gap:4px;">
            <span style="color:var(--muted);font-size:9px;letter-spacing:2px;">SEU PALPITE:</span>
            ${teamLogo(pick.winner,13)}
            <span style="color:${pickCorrect?'var(--green)':'var(--neg)'};">${pick.winner}</span>
            ${pick.score?`<span style="color:${exactOk?'var(--green)':'var(--neg)'};font-weight:700;">${pick.score}</span>`:'<span style="color:var(--muted);font-size:9px;">SEM PLACAR</span>'}
          </div>`;
        }

        // Resultado real
        html += `<div style="font-family:'Barlow Condensed';font-size:11px;letter-spacing:1px;
          color:var(--muted2);display:flex;align-items:center;gap:4px;">
          <span style="color:var(--muted);font-size:9px;letter-spacing:2px;">RESULTADO:</span>
          ${teamLogo(realR.winner,13)}
          <span style="color:var(--white);">${realR.winner}</span>
          ${realR.score?`<span style="color:var(--muted2);font-weight:700;">${realR.score}</span>`:''}
        </div>`;

        html += `</div></div>`;

      } else if (pick.winner && !open) {
        // Série ainda em andamento — mostra só o palpite
        html += `<div style="padding:7px 12px;border-top:1px solid var(--border);
          font-family:'Barlow Condensed';font-size:11px;color:var(--muted);
          display:flex;align-items:center;gap:5px;">
          <span style="font-size:9px;letter-spacing:2px;">SEU PALPITE:</span>
          ${teamLogo(pick.winner,13)}
          <span>${pick.winner}</span>
          ${pick.score?`<span style="color:var(--muted2);font-weight:700;">${pick.score}</span>`:''}
        </div>`;
      }
    }

    html += `</div>`;
    return html;
  }

  let html = '';

  // ── LAYOUT: Oeste | Leste lado a lado por rodada ──
  const roundIds = ['r1','semi','cf'];
  const hasAnyRound = roundIds.some(rid =>
    [...(WEST_SERIES[rid]||[]),...(EAST_SERIES[rid]||[])].some(mk => {
      const t = getSeriesTeams(mk);
      return t.some(x => x && x.name !== '?');
    })
  );

  if (hasAnyRound) {
    roundIds.forEach(rid => {
      const westMks = WEST_SERIES[rid]||[];
      const eastMks = EAST_SERIES[rid]||[];
      const allMks  = [...westMks,...eastMks];
      const hasAny  = allMks.some(mk=>{ const t=getSeriesTeams(mk); return t.some(x=>x&&x.name!=='?'); });
      if (!hasAny) return;

      const allDone  = allMks.every(mk=>resPlayoffs[mk]?.winner);
      const anyOpen  = allMks.some(mk=>isSeriesOpen(mk));
      const statusColor = allDone?'var(--muted)':anyOpen?'var(--green)':'var(--muted)';
      const statusIcon  = allDone?'✅':anyOpen?'🟢':'🔒';
      const statusText  = allDone?'CONCLUÍDA':anyOpen?'ABERTA PARA APOSTAS':'AGUARDANDO RESULTADOS';

      html += `<div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div style="font-family:'Bebas Neue';font-size:20px;letter-spacing:3px;color:var(--white);">${ROUND_LABELS_MAP[rid]}</div>
          <div style="font-family:'Barlow Condensed';font-size:11px;letter-spacing:2px;color:${statusColor};">${statusIcon} ${statusText}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <div style="font-family:'Bebas Neue';font-size:13px;letter-spacing:4px;color:var(--red);margin-bottom:10px;text-shadow:0 0 10px var(--red-glow);">🏆 CONFERÊNCIA OESTE</div>
            ${westMks.map(mk=>seriesCard(mk,'west')).join('')}
          </div>
          <div>
            <div style="font-family:'Bebas Neue';font-size:13px;letter-spacing:4px;color:var(--blue2);margin-bottom:10px;text-shadow:0 0 10px var(--blue-glow);">🏆 CONFERÊNCIA LESTE</div>
            ${eastMks.map(mk=>seriesCard(mk,'east')).join('')}
          </div>
        </div>`;

      // Botão salvar da rodada
      const hasPending = allMks.some(mk=>isSeriesOpen(mk)&&picks[mk]?.winner);
      if (hasPending) {
        html += `<div style="text-align:right;margin-top:10px;">
          <button class="btn btn-gold" onclick="savePicks('po')" style="font-size:12px;padding:7px 18px;">
            💾 SALVAR APOSTAS — ${ROUND_LABELS_MAP[rid]}
          </button>
        </div>`;
      }
      html += `</div>`;
    });
  }

  // NBA Finals — centralizada
  const finalsTeams = getSeriesTeams('finals');
  const finalsHasTeams = finalsTeams.some(t=>t&&t.name!=='?');
  if (finalsHasTeams) {
    html += `<div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="font-family:'Bebas Neue';font-size:20px;letter-spacing:3px;color:var(--gold);text-shadow:0 0 10px var(--gold-glow);">🏆 NBA FINALS</div>
        <div style="font-family:'Barlow Condensed';font-size:11px;letter-spacing:2px;color:${isSeriesOpen('finals')?'var(--green)':resPlayoffs['finals']?.winner?'var(--muted)':'var(--muted)'};">
          ${isSeriesOpen('finals')?'🟢 ABERTA PARA APOSTAS':resPlayoffs['finals']?.winner?'✅ CONCLUÍDA':'🔒 AGUARDANDO'}
        </div>
      </div>
      <div style="max-width:400px;margin:0 auto;">
        ${seriesCard('finals','champ')}
      </div>`;
    const hasFinalsPending = isSeriesOpen('finals') && picks['finals']?.winner;
    if (hasFinalsPending) {
      html += `<div style="text-align:center;margin-top:10px;">
        <button class="btn btn-gold" onclick="savePicks('po')" style="font-size:12px;padding:7px 18px;">
          💾 SALVAR APOSTA — NBA FINALS
        </button>
      </div>`;
    }
    html += `</div>`;
  }

  if (!html) {
    html = `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:36px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">🏀</div>
      <div style="font-family:'Bebas Neue';font-size:22px;letter-spacing:3px;color:var(--white);margin-bottom:8px;">PLAYOFFS AINDA NÃO COMEÇARAM</div>
      <div style="font-family:'Barlow Condensed';font-size:13px;letter-spacing:2px;color:var(--muted);">
        As apostas abrirão automaticamente conforme os times dos playoffs forem definidos.
      </div>
    </div>`;
  }

  outer.innerHTML = html;
}

// ═══════════════════════════════════════
//  SALVAR
// ═══════════════════════════════════════
window.savePicks = async function(type) {
  if (!ME) { toast('⚠️ Faça login primeiro!'); return; }
  const locked = S.locked||{};
  if (type==='pi'  && locked.playin) { toast('🔒 Apostas encerradas!'); return; }
  if (type==='pre' && locked.pre)    { toast('🔒 Apostas encerradas!'); return; }
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
      S.locked       = d.locked       || {playin:false,pre:false};
      S.openRounds   = d.openRounds   || {r1:false,semi:false,cf:false,finals:false};
      console.log('[Bolinha] Resultados carregados:', JSON.stringify(S.results));
    } else {
      console.warn('[Bolinha] Documento bolinha/state não existe ainda no Firebase.');
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

    console.log('[Bolinha] hasAnyResult:', hasAnyResult);
    console.log('[Bolinha] results.playin:', JSON.stringify(S.results.playin));
    console.log('[Bolinha] results.playoffs:', JSON.stringify(S.results.playoffs));
    console.log('[Bolinha] players encontrados:', players.length);
    console.log('[Bolinha] primeiro player picks:', JSON.stringify(players[0]));

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

  // Campeão conf Oeste (+3)
  if (rp.champW && myPre.champW && myPre.champW===rp.champW) { d.pre+=3; total+=3; }
  // Campeão conf Leste (+3)
  if (rp.champE && myPre.champE && myPre.champE===rp.champE) { d.pre+=3; total+=3; }
  // Campeão NBA (+3 se acertar, -3 se errar — só aplica quando resultado existir)
  if (rp.champNBA && myPre.champNBA) {
    if (myPre.champNBA===rp.champNBA) { d.nba_champ=3; total+=3; }
    else { d.nba_champ_neg=-3; total-=3; }
  }

  // Play-In
  const piPicks = p.playin||{};
  Object.keys(PI_PTS).forEach(mk=>{
    const real=S.results.playin[mk];
    if (real===undefined||real===null) return;
    if (piPicks[mk]===real) { const pts=PI_PTS[mk]; total+=pts; d.pi+=pts; }
  });

  // Playoffs
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

  // Finalistas de Conf (+1 por cada acerto)
  // Admin salva como rp.cfW = ['Time A', 'Time B'] e rp.cfE = ['Time A', 'Time B']
  [{field:'cfW'},{field:'cfE'}].forEach(({field})=>{
    const myPicks = Array.isArray(myPre[field]) ? myPre[field] : [];
    const realFinalists = Array.isArray(rp[field]) ? rp[field] : [];
    if (realFinalists.length === 0) return;
    myPicks.forEach(pick=>{
      if (realFinalists.includes(pick)) { d.conf_bonus+=1; total+=1; }
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

// ─── Funções chamadas por onclick inline gerado no renderBracket ───────────

function bPick(mk, teamName, conf) {
  if (!ME) return;
  if (!ME.playoffs) ME.playoffs = {};
  const cur = ME.playoffs[mk]||{};
  ME.playoffs[mk] = { winner: teamName, score: cur.winner===teamName ? (cur.score||'') : '' };
  renderBracket();
}

function setPlacar(mk, sc) {
  if (!ME) return;
  if (!ME.playoffs) ME.playoffs = {};
  if (!ME.playoffs[mk]) ME.playoffs[mk] = {};
  ME.playoffs[mk].score = sc;
  renderBracket();
  toast('✅ Placar '+sc+' registrado!');
}

function lockedClick() { toast('🔒 Apostas encerradas!'); }

function loadPlayoffs() { renderBracket(); }

function loadPre() { renderPreCards(); }

function addPlayer() {
  // Não usado no app (auto-cadastro no login), mantido por compatibilidade
}

function removePlayer() {}

// Expõe TODAS as funções necessárias para onclick inline (obrigatório com type="module")
window.toast        = toast;
window.showTab      = window.showTab;      // já definido como window.showTab = function
window.piPick       = window.piPick;       // já definido como window.piPick = function
window.prePick      = window.prePick;      // já definido como window.prePick = function
window.bPick        = bPick;               // definido localmente acima
window.setPlacar    = setPlacar;           // definido localmente acima
window.savePicks    = window.savePicks;    // já definido como window.savePicks = async function
window.calcAndRender = window.calcAndRender; // já definido
window.doLogin      = window.doLogin;      // já definido
window.doLogout     = window.doLogout;     // já definido
window.loadPlayin   = loadPlayin;          // função local
window.loadPre      = loadPre;             // definido localmente acima
window.loadPlayoffs = loadPlayoffs;        // definido localmente acima
window.lockedClick  = lockedClick;         // definido localmente acima

// ── ARRANQUE ──
init();