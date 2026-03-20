// ═══════════════════════════════════════
//  ESTADO COMPARTILHADO
// ═══════════════════════════════════════
const SK='nba_bolinha_v5';
let S={
  players:[],playin:{},pre:{},playoffs:{},
  results:{pre:{},playin:{},playoffs:{}},
  bracketTeams:null,playinTeams:null
};
function load(){try{const s=localStorage.getItem(SK);if(s)S=JSON.parse(s);}catch(e){}}
function save(){
  localStorage.setItem(SK,JSON.stringify(S));
  flashSync();
}
function saveAll(){ save(); toast('✅ Dados salvos com sucesso!'); }
load();

function flashSync(){
  const el=document.getElementById('sync-label');
  if(!el) return;
  el.textContent='SALVO ✓';
  el.style.color='var(--green)';
  setTimeout(()=>{el.textContent='SINCRONIZADO';el.style.color='';},2000);
}

// ═══════════════════════════════════════
//  TIMES DEFAULT
// ═══════════════════════════════════════
const DEFAULT_TW=[
  {seed:1,name:'OKC Thunder',logo:'⚡'},
  {seed:2,name:'Houston Rockets',logo:'🚀'},
  {seed:3,name:'LA Clippers',logo:'💙'},
  {seed:4,name:'Denver Nuggets',logo:'⛏️'},
  {seed:5,name:'Memphis Grizzlies',logo:'🐻'},
  {seed:6,name:'Minnesota Wolves',logo:'🐺'},
  {seed:7,name:'Golden State Warriors',logo:'🌉'},
  {seed:8,name:'Dallas Mavericks',logo:'🤠'},
];
const DEFAULT_TE=[
  {seed:1,name:'Cleveland Cavaliers',logo:'🗡️'},
  {seed:2,name:'Boston Celtics',logo:'☘️'},
  {seed:3,name:'New York Knicks',logo:'🗽'},
  {seed:4,name:'Milwaukee Bucks',logo:'🦌'},
  {seed:5,name:'Detroit Pistons',logo:'🔧'},
  {seed:6,name:'Indiana Pacers',logo:'🏁'},
  {seed:7,name:'Atlanta Hawks',logo:'🦅'},
  {seed:8,name:'Orlando Magic',logo:'✨'},
];
const DEFAULT_PI={
  w7:{seed:7,name:'OKC Thunder',logo:'⚡'},
  w8:{seed:8,name:'Golden State Warriors',logo:'🌉'},
  w9:{seed:9,name:'Memphis Grizzlies',logo:'🐻'},
  w10:{seed:10,name:'Phoenix Suns',logo:'🌵'},
  e7:{seed:7,name:'Indiana Pacers',logo:'🏁'},
  e8:{seed:8,name:'Miami Heat',logo:'🌊'},
  e9:{seed:9,name:'Chicago Bulls',logo:'🏁'},
  e10:{seed:10,name:'Atlanta Hawks',logo:'🦅'},
};

function getTW(){ return (S.bracketTeams&&S.bracketTeams.west)?S.bracketTeams.west:DEFAULT_TW; }
function getTE(){ return (S.bracketTeams&&S.bracketTeams.east)?S.bracketTeams.east:DEFAULT_TE; }
function getPI(){ return S.playinTeams||DEFAULT_PI; }
function allTeams(){ return[...getTW(),...getTE()]; }

const SCORES=['4-0','4-1','4-2','4-3'];
function r1p(t){return[[t[0],t[7]],[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]];}
function esc(s){return s.replace(/'/g,"\\'");}
function teamByName(n){return allTeams().find(t=>t.name===n)||{name:n,seed:'?',logo:'❓'};}

// ═══════════════════════════════════════
//  NAVEGAÇÃO
// ═══════════════════════════════════════
function showPage(id,btn){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-'+id).classList.add('active');
  const renders={
    'apostadores':renderPlayers,
    'playin-times':renderPlayinTeamEditor,
    'bracket-times':renderBracketEditor,
    'res-playin':renderResPlayin,
    'res-pre':renderResPre,
    'res-playoffs':renderResPlayoffs,
    'sistema':renderSistema,
  };
  if(renders[id]) renders[id]();
}

// ═══════════════════════════════════════
//  APOSTADORES
// ═══════════════════════════════════════
function renderPlayers(){
  const el=document.getElementById('player-list');
  const cnt=document.getElementById('player-count');
  if(cnt) cnt.textContent=S.players.length+' APOSTADORES';
  if(!S.players.length){
    el.innerHTML='<div style="color:var(--muted);font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;padding:10px;">NENHUM APOSTADOR CADASTRADO</div>';
    return;
  }
  el.innerHTML=S.players.map((p,i)=>`
    <div class="player-row">
      <div class="player-avatar">${p.name[0].toUpperCase()}</div>
      <div>
        <div class="player-name">${p.name}</div>
        <div class="player-idx">#${i+1}</div>
      </div>
      <button class="btn btn-outline btn-sm" style="margin-left:auto;color:var(--neg);border-color:var(--neg);"
        onclick="removePlayer('${p.id}')">✕ REMOVER</button>
    </div>`).join('');
}

function addPlayer(){
  const inp=document.getElementById('new-name');
  const n=inp.value.trim(); if(!n) return;
  const id='p'+Date.now();
  S.players.push({id,name:n});
  S.playin[id]={}; S.pre[id]={}; S.playoffs[id]={};
  save(); inp.value=''; renderPlayers();
  toast('🏀 '+n+' adicionado!');
}
function removePlayer(id){
  if(!confirm('Remover este apostador? As apostas dele serão perdidas.')) return;
  S.players=S.players.filter(p=>p.id!==id);
  delete S.playin[id]; delete S.pre[id]; delete S.playoffs[id];
  save(); renderPlayers();
  toast('🗑 Apostador removido.');
}

// ═══════════════════════════════════════
//  TIMES PLAY-IN
// ═══════════════════════════════════════
const PI_SLOTS=[
  {key:'w7', conf:'west', label:'OESTE — 7º SEED'},
  {key:'w8', conf:'west', label:'OESTE — 8º SEED'},
  {key:'w9', conf:'west', label:'OESTE — 9º SEED'},
  {key:'w10',conf:'west', label:'OESTE — 10º SEED'},
  {key:'e7', conf:'east', label:'LESTE — 7º SEED'},
  {key:'e8', conf:'east', label:'LESTE — 8º SEED'},
  {key:'e9', conf:'east', label:'LESTE — 9º SEED'},
  {key:'e10',conf:'east', label:'LESTE — 10º SEED'},
];

function renderPlayinTeamEditor(){
  const pi=getPI();
  const west=PI_SLOTS.filter(s=>s.conf==='west');
  const east=PI_SLOTS.filter(s=>s.conf==='east');

  function slotRows(slots){
    return slots.map(s=>{
      const t=pi[s.key]||DEFAULT_PI[s.key];
      const def=DEFAULT_PI[s.key];
      return `<div class="pi-team-row">
        <span class="pi-seed-lbl">${t.seed}</span>
        <input class="pi-emoji-inp" id="pi-emoji-${s.key}" value="${t.logo}" maxlength="4" title="Emoji">
        <div style="flex:1;">
          <input class="pi-name-inp" id="pi-name-${s.key}" value="${t.name}" placeholder="${def.name}" oninput="markChg(this)">
          <div class="orig-hint">PADRÃO: ${def.name}</div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('pi-teams-editor').innerHTML=`
    <div class="pi-game">
      <div class="pi-game-head"><span>CONFERÊNCIA OESTE</span></div>
      ${slotRows(west)}
    </div>
    <div class="pi-game">
      <div class="pi-game-head"><span>CONFERÊNCIA LESTE</span></div>
      ${slotRows(east)}
    </div>`;
}

function savePlayinTeams(){
  const pi={};
  PI_SLOTS.forEach(s=>{
    const def=DEFAULT_PI[s.key];
    pi[s.key]={
      seed:def.seed,
      name:document.getElementById('pi-name-'+s.key)?.value.trim()||def.name,
      logo:document.getElementById('pi-emoji-'+s.key)?.value.trim()||def.logo,
    };
  });
  S.playinTeams=pi;
  save(); renderPlayinTeamEditor();
  toast('✅ Times do Play-In salvos!');
}
function resetPlayinTeams(){
  if(!confirm('Restaurar times do Play-In para o padrão?')) return;
  S.playinTeams=null; save(); renderPlayinTeamEditor();
  toast('↺ Times do Play-In restaurados.');
}

// ═══════════════════════════════════════
//  TIMES BRACKET
// ═══════════════════════════════════════
function renderBracketEditor(){
  const tw=getTW(), te=getTE();

  function teamRows(conf, teams, prefix){
    return teams.map((t,i)=>{
      const def=(conf==='west'?DEFAULT_TW:DEFAULT_TE)[i];
      return `<div class="te-row">
        <input class="te-seed-inp" id="${prefix}-seed-${i}" value="${t.seed}" maxlength="3" title="Seed">
        <input class="te-emoji-inp" id="${prefix}-logo-${i}" value="${t.logo}" maxlength="4" title="Emoji">
        <div style="flex:1;">
          <input class="te-name-inp" id="${prefix}-name-${i}" value="${t.name}" placeholder="${def.name}" oninput="markChg(this)">
          <div class="orig-hint">PADRÃO: ${def.name}</div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('bracket-editor').innerHTML=`
    <div class="te-conf-block">
      <div class="te-conf-head west"><span>CONFERÊNCIA OESTE</span><span style="font-size:11px;color:var(--muted);">SEED / EMOJI / NOME</span></div>
      ${teamRows('west',tw,'bw')}
    </div>
    <div class="te-conf-block">
      <div class="te-conf-head east"><span>CONFERÊNCIA LESTE</span><span style="font-size:11px;color:var(--muted);">SEED / EMOJI / NOME</span></div>
      ${teamRows('east',te,'be')}
    </div>`;
}

function saveBracketTeams(){
  const west=getTW().map((_,i)=>({
    seed: parseInt(document.getElementById('bw-seed-'+i)?.value)||i+1,
    logo: document.getElementById('bw-logo-'+i)?.value.trim()||'🏀',
    name: document.getElementById('bw-name-'+i)?.value.trim()||'Time '+(i+1),
  }));
  const east=getTE().map((_,i)=>({
    seed: parseInt(document.getElementById('be-seed-'+i)?.value)||i+1,
    logo: document.getElementById('be-logo-'+i)?.value.trim()||'🏀',
    name: document.getElementById('be-name-'+i)?.value.trim()||'Time '+(i+1),
  }));
  S.bracketTeams={west,east};
  save(); renderBracketEditor();
  toast('✅ Times do bracket salvos! O app reflete imediatamente.');
}
function resetBracketTeams(){
  if(!confirm('Restaurar todos os times para o padrão?')) return;
  S.bracketTeams=null; save(); renderBracketEditor();
  toast('↺ Times do bracket restaurados.');
}
function markChg(el){ el.classList.add('te-changed'); }

// ═══════════════════════════════════════
//  RESULTADOS PLAY-IN
// ═══════════════════════════════════════
const PI_MATCH_DEFS=[
  {mk:'w78', label:'OESTE — Jogo 1 (7º vs 8º)', getTeams:()=>{const pi=getPI();return[pi.w7,pi.w8];}},
  {mk:'w910',label:'OESTE — Jogo 2 (9º vs 10º)',getTeams:()=>{const pi=getPI();return[pi.w9,pi.w10];}},
  {mk:'w3',  label:'OESTE — Jogo Decisivo (8º seed)',getTeams:()=>[{name:'Venc. Jogo 2',logo:'❓'},{name:'Perd. Jogo 1',logo:'❓'}]},
  {mk:'e78', label:'LESTE — Jogo 1 (7º vs 8º)',  getTeams:()=>{const pi=getPI();return[pi.e7,pi.e8];}},
  {mk:'e910',label:'LESTE — Jogo 2 (9º vs 10º)', getTeams:()=>{const pi=getPI();return[pi.e9,pi.e10];}},
  {mk:'e3',  label:'LESTE — Jogo Decisivo (8º seed)',getTeams:()=>[{name:'Venc. Jogo 2',logo:'❓'},{name:'Perd. Jogo 1',logo:'❓'}]},
];

function renderResPlayin(){
  const r=S.results.playin||{};
  document.getElementById('res-playin-matches').innerHTML=PI_MATCH_DEFS.map(d=>{
    const teams=d.getTeams();
    const hasResult=r[d.mk]!==undefined&&r[d.mk]!==null;
    return `<div class="match-card">
      <div class="match-head">${d.label}</div>
      <div class="match-body">
        <div class="match-lbl">VENCEDOR</div>
        <div class="match-btns">
          ${teams.map((t,i)=>`<button class="match-tbtn${r[d.mk]===i?' sel-g':''}" onclick="setResPI('${d.mk}',${i})">${t.logo} ${t.name}</button>`).join('')}
        </div>
        <div class="match-status">
          ${hasResult
            ?`<span class="status-ok">✓ RESULTADO LANÇADO</span>`
            :`<span class="status-pend">— AGUARDANDO</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
}
function setResPI(mk,idx){
  if(!S.results.playin)S.results.playin={};
  S.results.playin[mk]=idx; renderResPlayin();
}

// ═══════════════════════════════════════
//  RESULTADOS PRÉ-PLAYOFFS
// ═══════════════════════════════════════
function renderResPre(){
  const rp=S.results.pre||{};
  const TW=getTW(), TE=getTE();
  const ALL=allTeams();

  function confBtns(field, teams, isSingle){
    if(isSingle){
      return teams.map(t=>`<button class="match-tbtn${rp[field]===t.name?' sel-g':''}" onclick="setResPre('${field}','${esc(t.name)}',true)">${t.logo} ${t.name}</button>`).join('');
    }
    // multi (finalists)
    const vals=Array.isArray(rp[field])?rp[field]:[];
    return teams.map(t=>`<button class="match-tbtn${vals.includes(t.name)?' sel-g':''}" onclick="setResPre('${field}','${esc(t.name)}',false)">${t.logo} ${t.name}</button>`).join('');
  }

  const defs=[
    {field:'cfW',  label:'FINALISTAS CONF OESTE (2 times)',teams:TW, single:false},
    {field:'cfE',  label:'FINALISTAS CONF LESTE (2 times)',teams:TE, single:false},
    {field:'champW',label:'CAMPEÃO CONF OESTE',teams:TW,single:true},
    {field:'champE',label:'CAMPEÃO CONF LESTE',teams:TE,single:true},
    {field:'champNBA',label:'CAMPEÃO NBA',teams:ALL,single:true},
  ];

  document.getElementById('res-pre-matches').innerHTML=defs.map(d=>{
    const val=rp[d.field];
    const hasResult=d.single?(!!val):(Array.isArray(val)&&val.length===2);
    return `<div class="match-card">
      <div class="match-head">${d.label}</div>
      <div class="match-body">
        <div class="match-btns" style="flex-wrap:wrap;">${confBtns(d.field,d.teams,d.single)}</div>
        <div class="match-status">
          ${hasResult
            ?`<span class="status-ok">✓ ${d.single?val:(val||[]).join(' e ')}</span>`
            :`<span class="status-pend">— AGUARDANDO</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function setResPre(field, name, single){
  if(!S.results.pre)S.results.pre={};
  if(single){
    S.results.pre[field]=name;
  } else {
    let arr=Array.isArray(S.results.pre[field])?[...S.results.pre[field]]:[];
    const idx=arr.indexOf(name);
    if(idx>=0) arr.splice(idx,1);
    else if(arr.length<2) arr.push(name);
    S.results.pre[field]=arr;
  }
  renderResPre();
}

// ═══════════════════════════════════════
//  RESULTADOS PLAYOFFS
// ═══════════════════════════════════════
const PO_ROUND_DEFS=[
  {
    id:'r1', label:'1ª RODADA',
    matches:[
      {mk:'wR1_0',conf:'west'},
      {mk:'wR1_1',conf:'west'},
      {mk:'wR1_2',conf:'west'},
      {mk:'wR1_3',conf:'west'},
      {mk:'eR1_0',conf:'east'},
      {mk:'eR1_1',conf:'east'},
      {mk:'eR1_2',conf:'east'},
      {mk:'eR1_3',conf:'east'},
    ]
  },
  {
    id:'r2',label:'SEMIFINAIS',
    matches:[
      {mk:'wR2_0',conf:'west'},
      {mk:'wR2_1',conf:'west'},
      {mk:'eR2_0',conf:'east'},
      {mk:'eR2_1',conf:'east'},
    ]
  },
  {
    id:'r3',label:'FINAIS DE CONFERÊNCIA',
    matches:[
      {mk:'wR3_0',conf:'west'},
      {mk:'eR3_0',conf:'east'},
    ]
  },
  {
    id:'finals',label:'NBA FINALS',
    matches:[{mk:'finals',conf:'champ'}]
  },
];

function getMatchTeams(mk){
  const TW=getTW(),TE=getTE();
  const wR1=r1p(TW),eR1=r1p(TE);
  function rr(k){return(S.results.playoffs[k]||{}).winner||'?';}
  const map={
    'wR1_0':[wR1[0][0].name,wR1[0][1].name],
    'wR1_1':[wR1[1][0].name,wR1[1][1].name],
    'wR1_2':[wR1[2][0].name,wR1[2][1].name],
    'wR1_3':[wR1[3][0].name,wR1[3][1].name],
    'eR1_0':[eR1[0][0].name,eR1[0][1].name],
    'eR1_1':[eR1[1][0].name,eR1[1][1].name],
    'eR1_2':[eR1[2][0].name,eR1[2][1].name],
    'eR1_3':[eR1[3][0].name,eR1[3][1].name],
    'wR2_0':[rr('wR1_0'),rr('wR1_1')],
    'wR2_1':[rr('wR1_2'),rr('wR1_3')],
    'eR2_0':[rr('eR1_0'),rr('eR1_1')],
    'eR2_1':[rr('eR1_2'),rr('eR1_3')],
    'wR3_0':[rr('wR2_0'),rr('wR2_1')],
    'eR3_0':[rr('eR2_0'),rr('eR2_1')],
    'finals':[rr('wR3_0'),rr('eR3_0')],
  };
  return map[mk]||['?','?'];
}

function renderResPlayoffs(){
  const r=S.results.playoffs||{};
  let html='';

  PO_ROUND_DEFS.forEach(rd=>{
    const confLabel={west:'OESTE',east:'LESTE',champ:'FINALS'};
    const confCls={west:'sel-w',east:'sel-e',champ:'sel-g'};
    html+=`<div class="admin-card">
      <div class="ac-head"><div class="ac-title">${rd.label}</div></div>
      <div class="ac-body"><div class="res-matches-grid">`;

    rd.matches.forEach(m=>{
      const res=r[m.mk]||{};
      const teams=getMatchTeams(m.mk);
      const cls=confCls[m.conf]||'sel-g';
      const isDone=!!res.winner&&!!res.score;
      const conf=m.conf;

      html+=`<div class="match-card" style="${m.conf==='west'?'border-left:3px solid var(--red)':m.conf==='east'?'border-left:3px solid var(--blue2)':'border-left:3px solid var(--gold)'}">
        <div class="match-head">${confLabel[conf]||''}${conf!=='champ'?' — ':' '}${teams[0]} vs ${teams[1]}</div>
        <div class="match-body">
          <div class="match-lbl">VENCEDOR</div>
          <div class="match-btns">
            ${teams.map(t=>`<button class="match-tbtn${res.winner===t?' '+cls:''}" onclick="setResPOw('${m.mk}','${esc(t)}')">${teamByName(t).logo} ${t}</button>`).join('')}
          </div>
          <div class="match-lbl" style="margin-top:8px;">PLACAR DA SÉRIE</div>
          <div class="score-btns">
            ${['4-0','4-1','4-2','4-3'].map(sc=>`<button class="score-btn${res.score===sc?' sel-g':''}" onclick="setResPOs('${m.mk}','${sc}')">${sc}</button>`).join('')}
          </div>
          <div class="match-status">
            ${isDone
              ?`<span class="status-ok">✓ ${res.winner} ${res.score}</span>`
              :res.winner
                ?`<span style="color:var(--orange);">⚠ FALTA O PLACAR</span>`
                :`<span class="status-pend">— AGUARDANDO</span>`}
          </div>
        </div>
      </div>`;
    });
    html+='</div></div></div>';
  });

  document.getElementById('res-playoffs-content').innerHTML=html;
}

function setResPOw(mk,name){
  if(!S.results.playoffs)S.results.playoffs={};
  if(!S.results.playoffs[mk])S.results.playoffs[mk]={};
  S.results.playoffs[mk].winner=name; renderResPlayoffs();
}
function setResPOs(mk,sc){
  if(!S.results.playoffs)S.results.playoffs={};
  if(!S.results.playoffs[mk])S.results.playoffs[mk]={};
  S.results.playoffs[mk].score=sc; renderResPlayoffs();
}

// ═══════════════════════════════════════
//  SISTEMA
// ═══════════════════════════════════════
function renderSistema(){
  const el=document.getElementById('info-body');
  const pLen=S.players.length;
  const poResults=Object.keys(S.results.playoffs||{}).length;
  const piResults=Object.keys(S.results.playin||{}).length;
  el.innerHTML=`
    Apostadores: <b style="color:var(--text)">${pLen}</b><br>
    Resultados Play-In lançados: <b style="color:var(--text)">${piResults}/6</b><br>
    Resultados Playoffs lançados: <b style="color:var(--text)">${poResults}/15</b><br>
    Times do bracket: <b style="color:var(--text)">${S.bracketTeams?'CUSTOMIZADOS':'PADRÃO'}</b><br>
    Times do Play-In: <b style="color:var(--text)">${S.playinTeams?'CUSTOMIZADOS':'PADRÃO'}</b><br>
    Tamanho dos dados: <b style="color:var(--text)">${(JSON.stringify(S).length/1024).toFixed(1)} KB</b>
  `;
}

function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bolinha-nba-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  toast('⬇ Arquivo exportado!');
}
function importData(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!confirm('Importar dados? Isso substituirá tudo que está salvo atualmente.')) return;
      S=data; save(); renderSistema();
      toast('✅ Dados importados com sucesso!');
    }catch(err){ toast('❌ Arquivo inválido!'); }
  };
  reader.readAsText(file);
}
function resetResults(){
  if(!confirm('Resetar todos os resultados? As apostas serão mantidas.')) return;
  S.results={pre:{},playin:{},playoffs:{}};
  save(); toast('🔄 Resultados resetados.');
}
function resetAll(){
  if(!confirm('ATENÇÃO: isso apagará TODOS os dados. Tem certeza?')) return;
  if(!confirm('Última chance — confirmar reset total?')) return;
  localStorage.removeItem(SK);
  location.reload();
}

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
renderPlayers();

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
let tt;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(tt); tt=setTimeout(()=>el.classList.remove('show'),2800);
}