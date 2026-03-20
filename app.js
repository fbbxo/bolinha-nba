// ═══════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════
const SK='nba_bolinha_v5';
let S={
  players:[],
  playin:{},
  pre:{},
  playoffs:{},
  results:{
    pre:{},
    playin:{},
    playoffs:{}
  },
  bracketTeams: null  // null = usa default
};
function load(){try{const s=localStorage.getItem(SK);if(s)S=JSON.parse(s);}catch(e){}}
function save(){localStorage.setItem(SK,JSON.stringify(S));}
load();

// ═══════════════════════════════════════
//  DADOS — DEFAULT TEAMS
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

function getTW(){ return (S.bracketTeams&&S.bracketTeams.west) ? S.bracketTeams.west : DEFAULT_TW; }
function getTE(){ return (S.bracketTeams&&S.bracketTeams.east) ? S.bracketTeams.east : DEFAULT_TE; }
// Convenience getters used throughout (replaces old TW/TE constants)
Object.defineProperty(window,'TW',{get:getTW});
Object.defineProperty(window,'TE',{get:getTE});
const ALL_TEAMS=[...TW,...TE];
const SCORES=['4-0','4-1','4-2','4-3'];
const PI_PTS={w78:1,w910:1,w3:2,e78:1,e910:1,e3:2};
const PO_KEYS=['wR1_0','wR1_1','wR1_2','wR1_3','eR1_0','eR1_1','eR1_2','eR1_3',
               'wR2_0','wR2_1','eR2_0','eR2_1','wR3_0','eR3_0','finals'];
const RD_MAP={wR1_0:'r1',wR1_1:'r1',wR1_2:'r1',wR1_3:'r1',
              eR1_0:'r1',eR1_1:'r1',eR1_2:'r1',eR1_3:'r1',
              wR2_0:'semi',wR2_1:'semi',eR2_0:'semi',eR2_1:'semi',
              wR3_0:'cf',eR3_0:'cf',finals:'finals'};
Object.defineProperty(window,'ALL_TEAMS',{get:()=>[...TW,...TE]});
function r1p(t){return[[t[0],t[7]],[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]];}
function teamByName(n){return ALL_TEAMS.find(t=>t.name===n)||{name:n,seed:'?',logo:'❓'};}

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
updateSelectors(); renderPreCards(); renderBracket(); renderResultados(); renderConfig(); renderBracketEditor();

// ═══════════════════════════════════════
//  TABS
// ═══════════════════════════════════════
function showTab(id,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(id).classList.add('active');
  if(id==='ranking') calcAndRender();
  if(id==='playoffs') renderBracket();
  if(id==='resultados') renderResultados();
  if(id==='pre') renderPreCards();
  if(id==='config') renderBracketEditor();
}

// ═══════════════════════════════════════
//  PLAYERS
// ═══════════════════════════════════════
function addPlayer(){
  const inp=document.getElementById('new-name');
  const n=inp.value.trim(); if(!n) return;
  const id='p'+Date.now();
  S.players.push({id,name:n});
  S.playin[id]={}; S.pre[id]={}; S.playoffs[id]={};
  save(); inp.value=''; updateSelectors(); renderConfig();
  toast('🏀 '+n+' adicionado!');
}
function removePlayer(id){
  S.players=S.players.filter(p=>p.id!==id);
  delete S.playin[id]; delete S.pre[id]; delete S.playoffs[id];
  save(); updateSelectors(); renderConfig(); calcAndRender();
}
function updateSelectors(){
  ['pi-sel','pre-sel','po-sel'].forEach(sid=>{
    const sel=document.getElementById(sid); if(!sel) return;
    const v=sel.value;
    sel.innerHTML='<option value="">— selecione —</option>';
    S.players.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o);});
    if(v) sel.value=v;
  });
}
function renderConfig(){
  const el=document.getElementById('cfg-list');
  if(!S.players.length){
    el.innerHTML='<div style="color:var(--muted);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;">NENHUM APOSTADOR AINDA</div>';
    return;
  }
  el.innerHTML=S.players.map((p,i)=>`
    <div class="rk-card">
      <div class="rk-avatar">${p.name[0].toUpperCase()}</div>
      <div class="rk-info"><div class="rk-name">${p.name}</div><div class="rk-detail">Apostador #${i+1}</div></div>
      <button class="btn btn-outline" style="padding:4px 10px;font-size:10px;color:var(--red);border-color:var(--red);" onclick="removePlayer('${p.id}')">✕</button>
    </div>`).join('');
}

// ═══════════════════════════════════════
//  PLAY-IN
// ═══════════════════════════════════════
function loadPlayin(){
  const pid=document.getElementById('pi-sel').value;
  document.querySelectorAll('#playin .tr').forEach(r=>r.classList.remove('sw','se'));
  if(!pid) return;
  const picks=S.playin[pid]||{};
  Object.keys(picks).forEach(mk=>{
    document.querySelectorAll('[data-pi="'+mk+'"]').forEach((r,i)=>{
      if(i===picks[mk]) r.classList.add(r.dataset.conf==='west'?'sw':'se');
    });
  });
}
function piPick(row){
  const pid=document.getElementById('pi-sel').value;
  if(!pid){toast('⚠️ Selecione um apostador!');return;}
  const mk=row.dataset.pi,idx=parseInt(row.dataset.idx),conf=row.dataset.conf;
  document.querySelectorAll('[data-pi="'+mk+'"]').forEach(r=>r.classList.remove('sw','se'));
  row.classList.add(conf==='west'?'sw':'se');
  if(!S.playin[pid])S.playin[pid]={};
  S.playin[pid][mk]=idx;
}

// ═══════════════════════════════════════
//  PRÉ-PLAYOFFS
// ═══════════════════════════════════════
function renderPreCards(){
  const pid=document.getElementById('pre-sel')?.value||'';
  const picks=pid?(S.pre[pid]||{}):{};
  const el=document.getElementById('pre-cards');

  // single-pick buttons
  function singleBtns(field,teams,cls){
    return teams.map(t=>{
      const sel=picks[field]===t.name;
      return `<button class="pre-tbtn${sel?' '+cls:''}" onclick="prePick('${field}','${t.name.replace(/'/g,"\\'")}',false)"><span>${t.logo}</span><span>${t.name}</span></button>`;
    }).join('');
  }
  // multi-pick buttons (max 2)
  function multiBtns(field,teams,cls){
    return teams.map(t=>{
      const vals=Array.isArray(picks[field])?picks[field]:[];
      const sel=vals.includes(t.name);
      return `<button class="pre-tbtn${sel?' '+cls:''}" onclick="prePick('${field}','${t.name.replace(/'/g,"\\'")}',true)"><span>${t.logo}</span><span>${t.name}</span></button>`;
    }).join('');
  }
  function cfCount(field){
    const v=Array.isArray(picks[field])?picks[field]:[];
    return v.length===2
      ?`<div style="font-family:'Barlow Condensed';font-size:11px;color:var(--gold);letter-spacing:1px;margin-top:8px;">${v.join(' vs ')} ✓</div>`
      :`<div style="font-family:'Barlow Condensed';font-size:11px;color:var(--muted);letter-spacing:2px;margin-top:8px;">SELECIONE ${v.length}/2 TIMES</div>`;
  }

  el.innerHTML=`
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>FINALISTAS CONF OESTE (escolha 2)</span><span class="bonus-tag pos">+1 PT CADA</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${multiBtns('cfW',TW,'sel-gold')}</div>${cfCount('cfW')}</div>
    </div>
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>FINALISTAS CONF LESTE (escolha 2)</span><span class="bonus-tag pos">+1 PT CADA</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${multiBtns('cfE',TE,'sel-gold')}</div>${cfCount('cfE')}</div>
    </div>
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>CAMPEÃO CONF OESTE</span><span class="bonus-tag pos">+3 PTS</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${singleBtns('champW',TW,'sel-gold')}</div></div>
    </div>
    <div class="pre-card gold-card">
      <div class="pre-card-head"><span>CAMPEÃO CONF LESTE</span><span class="bonus-tag pos">+3 PTS</span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${singleBtns('champE',TE,'sel-gold')}</div></div>
    </div>
    <div class="pre-card purple-card" style="grid-column:1/-1;">
      <div class="pre-card-head"><span>CAMPEÃO DA NBA</span><span style="display:flex;gap:6px;align-items:center;"><span class="bonus-tag pos">+3 PTS</span><span class="bonus-tag neg-tag">-3 SE ERRAR</span></span></div>
      <div class="pre-card-body"><div class="pre-team-grid">${singleBtns('champNBA',ALL_TEAMS,'sel-purple')}</div></div>
    </div>`;
}

function prePick(field, teamName, multi){
  const pid=document.getElementById('pre-sel').value;
  if(!pid){toast('⚠️ Selecione um apostador!');return;}
  if(!S.pre[pid])S.pre[pid]={};
  if(!multi){
    S.pre[pid][field]=teamName;
  } else {
    let arr=Array.isArray(S.pre[pid][field])?[...S.pre[pid][field]]:[];
    const idx=arr.indexOf(teamName);
    if(idx>=0){ arr.splice(idx,1); } // deselect
    else if(arr.length<2){ arr.push(teamName); } // add (max 2)
    else { toast('⚠️ Máximo 2 times por conferência!'); return; }
    S.pre[pid][field]=arr;
  }
  renderPreCards();
  if(!multi||Array.isArray(S.pre[pid][field])&&S.pre[pid][field].includes(teamName))
    toast('✅ '+teamName+' selecionado!');
}
function loadPre(){
  renderPreCards();
}

// ═══════════════════════════════════════
//  BRACKET
// ═══════════════════════════════════════
let openPicker=null;

function loadPlayoffs(){
  const pid=document.getElementById('po-sel').value;
  if(pid&&!S.playoffs[pid])S.playoffs[pid]={};
  openPicker=null;
  renderBracket();
}

function resolveW(picks,mk,t1,t2){
  const p=picks[mk];
  if(!p||!p.winner) return {name:'?',seed:'?',logo:'❓'};
  if(p.winner===t1.name) return t1;
  if(p.winner===t2.name) return t2;
  return {name:'?',seed:'?',logo:'❓'};
}

function renderBracket(){
  const outer=document.getElementById('bracket-outer');
  const pid=document.getElementById('po-sel')?.value||'';
  const picks=pid?(S.playoffs[pid]||{}):{};
  const wR1=r1p(TW),eR1=r1p(TE);

  function rw(mk,t1,t2){return resolveW(picks,mk,t1,t2);}
  const wR2=[[rw('wR1_0',wR1[0][0],wR1[0][1]),rw('wR1_1',wR1[1][0],wR1[1][1])],
             [rw('wR1_2',wR1[2][0],wR1[2][1]),rw('wR1_3',wR1[3][0],wR1[3][1])]];
  const wR3=[rw('wR2_0',wR2[0][0],wR2[0][1]),rw('wR2_1',wR2[1][0],wR2[1][1])];
  const wC=rw('wR3_0',wR3[0],wR3[1]);
  const eR2=[[rw('eR1_0',eR1[0][0],eR1[0][1]),rw('eR1_1',eR1[1][0],eR1[1][1])],
             [rw('eR1_2',eR1[2][0],eR1[2][1]),rw('eR1_3',eR1[3][0],eR1[3][1])]];
  const eR3=[rw('eR2_0',eR2[0][0],eR2[0][1]),rw('eR2_1',eR2[1][0],eR2[1][1])];
  const eC=rw('eR3_0',eR3[0],eR3[1]);
  const champ=rw('finals',wC,eC);

  function tBtn(mk,team,conf){
    const p=picks[mk]; const isW=p&&p.winner===team.name;
    const wc=conf==='west'?'ww':conf==='east'?'we':'wc';
    const sc=isW&&p.score?`<span class="bsc">${p.score}</span>`:'';
    return `<div class="bt${isW?' '+wc:''}" onclick="bPick('${mk}','${team.name.replace(/'/g,"\\'")}','${conf}')">
      <span>${team.logo}</span><span class="bsd">${team.seed||'?'}</span>
      <span class="bname">${team.name}${sc}</span>
    </div>`;
  }

  function sBox(mk,t1,t2,conf){
    const p=picks[mk];
    const isOpen=(openPicker===mk&&pid&&p&&p.winner&&p.winner!=='?');
    return `<div class="sb ${conf}">
      ${tBtn(mk,t1,conf)}${tBtn(mk,t2,conf)}
      <div class="sp${isOpen?' open':''}">
        <div class="sp-lbl">PLACAR DA SÉRIE</div>
        <div class="sp-btns">${SCORES.map(sc=>`<button class="spb${p&&p.score===sc?' asc':''}" onclick="setPlacar('${mk}','${sc}')">${sc}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  function col(title,content){return `<div class="b-col"><div class="b-rt">${title}</div>${content}</div>`;}

  let h='';
  h+=col('1ª RD OESTE', wR1.map((m,i)=>sBox('wR1_'+i,m[0],m[1],'west')).join(''));
  h+=col('SEMI OESTE',  wR2.map((m,i)=>sBox('wR2_'+i,m[0],m[1],'west')).join(''));
  h+=col('FINAL CONF O',sBox('wR3_0',wR3[0],wR3[1],'west'));
  h+=`<div class="b-col finals-center">
    <div class="b-rt">NBA FINALS</div>
    <div class="ftrophy">🏆</div><div class="flbl">CAMPEÃO</div>
    ${sBox('finals',wC,eC,'champ')}
    ${champ.name!=='?'?`<div class="champ-reveal">${champ.logo} ${champ.name}</div>`:''}
  </div>`;
  h+=col('FINAL CONF L',sBox('eR3_0',eR3[0],eR3[1],'east'));
  h+=col('SEMI LESTE',  eR2.map((m,i)=>sBox('eR2_'+i,m[0],m[1],'east')).join(''));
  h+=col('1ª RD LESTE', eR1.map((m,i)=>sBox('eR1_'+i,m[0],m[1],'east')).join(''));
  outer.innerHTML=h;
}

function bPick(mk,teamName,conf){
  const pid=document.getElementById('po-sel').value;
  if(!pid){toast('⚠️ Selecione um apostador!');return;}
  if(!S.playoffs[pid])S.playoffs[pid]={};
  const cur=S.playoffs[pid][mk]||{};
  if(cur.winner===teamName){openPicker=(openPicker===mk)?null:mk;}
  else{S.playoffs[pid][mk]={winner:teamName,score:''};openPicker=mk;}
  renderBracket();
}
function setPlacar(mk,sc){
  const pid=document.getElementById('po-sel').value; if(!pid) return;
  if(!S.playoffs[pid][mk])S.playoffs[pid][mk]={};
  S.playoffs[pid][mk].score=sc; openPicker=null;
  renderBracket(); toast('✅ Placar '+sc+' salvo!');
}

function savePicks(type){
  const ids={pi:'pi-sel',pre:'pre-sel',po:'po-sel'};
  const pid=document.getElementById(ids[type]).value;
  if(!pid){toast('⚠️ Selecione um apostador!');return;}
  save(); toast('✅ Apostas salvas!');
}

// ═══════════════════════════════════════
//  RESULTADOS
// ═══════════════════════════════════════
const PI_RES=[
  {mk:'w78', label:'OESTE — Jogo 1 (7º vs 8º)', teams:['OKC Thunder','Golden State Warriors']},
  {mk:'w910',label:'OESTE — Jogo 2 (9º vs 10º)',teams:['Memphis Grizzlies','Phoenix Suns']},
  {mk:'w3',  label:'OESTE — Jogo Decisivo',      teams:['Vencedor J2 Oeste','Perdedor J1 Oeste']},
  {mk:'e78', label:'LESTE — Jogo 1 (7º vs 8º)', teams:['Indiana Pacers','Miami Heat']},
  {mk:'e910',label:'LESTE — Jogo 2 (9º vs 10º)',teams:['Chicago Bulls','Atlanta Hawks']},
  {mk:'e3',  label:'LESTE — Jogo Decisivo',      teams:['Vencedor J2 Leste','Perdedor J1 Leste']},
];

function buildPoDefs(){
  const wR1=r1p(TW),eR1=r1p(TE);
  function rr(mk){return(S.results.playoffs[mk]||{}).winner||'?';}
  return[
    ...wR1.map((m,i)=>({mk:'wR1_'+i,label:`OESTE R1 — ${m[0].name} vs ${m[1].name}`,teams:[m[0].name,m[1].name]})),
    ...eR1.map((m,i)=>({mk:'eR1_'+i,label:`LESTE R1 — ${m[0].name} vs ${m[1].name}`,teams:[m[0].name,m[1].name]})),
    {mk:'wR2_0',label:'OESTE SEMI 1',teams:[rr('wR1_0'),rr('wR1_1')]},
    {mk:'wR2_1',label:'OESTE SEMI 2',teams:[rr('wR1_2'),rr('wR1_3')]},
    {mk:'eR2_0',label:'LESTE SEMI 1',teams:[rr('eR1_0'),rr('eR1_1')]},
    {mk:'eR2_1',label:'LESTE SEMI 2',teams:[rr('eR1_2'),rr('eR1_3')]},
    {mk:'wR3_0',label:'FINAL CONF OESTE',teams:[rr('wR2_0'),rr('wR2_1')]},
    {mk:'eR3_0',label:'FINAL CONF LESTE',teams:[rr('eR2_0'),rr('eR2_1')]},
    {mk:'finals',label:'NBA FINALS',teams:[rr('wR3_0'),rr('eR3_0')]},
  ];
}

function renderResultados(){
  const rp=S.results.pre||{};
  document.getElementById('res-pre-grid').innerHTML=`
    <div class="rc">
      <div class="rch">FINALISTAS CONF OESTE</div>
      <div class="rcb">
        <div class="rlbl">TIME 1</div>
        <div class="rbtns">${TW.map(t=>`<button class="rbtn${rp.cfWA===t.name?' ar':''}" onclick="setResPre('cfWA','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
        <div class="rlbl" style="margin-top:7px;">TIME 2</div>
        <div class="rbtns">${TW.map(t=>`<button class="rbtn${rp.cfWB===t.name?' ar':''}" onclick="setResPre('cfWB','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
      </div>
    </div>
    <div class="rc">
      <div class="rch">FINALISTAS CONF LESTE</div>
      <div class="rcb">
        <div class="rlbl">TIME 1</div>
        <div class="rbtns">${TE.map(t=>`<button class="rbtn${rp.cfEA===t.name?' ar':''}" onclick="setResPre('cfEA','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
        <div class="rlbl" style="margin-top:7px;">TIME 2</div>
        <div class="rbtns">${TE.map(t=>`<button class="rbtn${rp.cfEB===t.name?' ar':''}" onclick="setResPre('cfEB','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
      </div>
    </div>
    <div class="rc">
      <div class="rch">CAMPEÃO CONF OESTE</div>
      <div class="rcb">
        <div class="rlbl">VENCEDOR</div>
        <div class="rbtns">${TW.map(t=>`<button class="rbtn${rp.champW===t.name?' ar':''}" onclick="setResPre('champW','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
      </div>
    </div>
    <div class="rc">
      <div class="rch">CAMPEÃO CONF LESTE</div>
      <div class="rcb">
        <div class="rlbl">VENCEDOR</div>
        <div class="rbtns">${TE.map(t=>`<button class="rbtn${rp.champE===t.name?' ar':''}" onclick="setResPre('champE','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
      </div>
    </div>
    <div class="rc">
      <div class="rch">CAMPEÃO NBA</div>
      <div class="rcb">
        <div class="rlbl">VENCEDOR</div>
        <div class="rbtns">${ALL_TEAMS.map(t=>`<button class="rbtn${rp.champNBA===t.name?' ar':''}" onclick="setResPre('champNBA','${t.name.replace(/'/g,"\\'")}')"> ${t.logo} ${t.name}</button>`).join('')}</div>
      </div>
    </div>`;

  // Play-in
  document.getElementById('res-pi-grid').innerHTML=PI_RES.map(d=>{
    const r=S.results.playin[d.mk];
    return `<div class="rc"><div class="rch">${d.label}</div><div class="rcb">
      <div class="rlbl">VENCEDOR</div>
      <div class="rbtns">${d.teams.map((t,i)=>`<button class="rbtn${r===i?' ar':''}" onclick="setResPI('${d.mk}',${i})">${t}</button>`).join('')}</div>
    </div></div>`;
  }).join('');

  // Playoffs
  document.getElementById('res-po-grid').innerHTML=buildPoDefs().map(d=>{
    const r=S.results.playoffs[d.mk]||{};
    return `<div class="rc"><div class="rch">${d.label}</div><div class="rcb">
      <div class="rlbl">VENCEDOR</div>
      <div class="rbtns">${d.teams.map(t=>`<button class="rbtn${r.winner===t?' ar':''}" onclick="setResPOw('${d.mk}','${t.replace(/'/g,"\\'")}')"> ${teamByName(t).logo} ${t}</button>`).join('')}</div>
      <div class="rlbl" style="margin-top:7px;">PLACAR DA SÉRIE</div>
      <div class="rbtns">${SCORES.map(sc=>`<button class="rsbtn${r.score===sc?' ar':''}" onclick="setResPOs('${d.mk}','${sc}')">${sc}</button>`).join('')}</div>
    </div></div>`;
  }).join('');
}

function setResPre(f,v){if(!S.results.pre)S.results.pre={};S.results.pre[f]=v;renderResultados();}
function setResPI(mk,idx){S.results.playin[mk]=idx;renderResultados();}
function setResPOw(mk,name){if(!S.results.playoffs[mk])S.results.playoffs[mk]={};S.results.playoffs[mk].winner=name;renderResultados();}
function setResPOs(mk,sc){if(!S.results.playoffs[mk])S.results.playoffs[mk]={};S.results.playoffs[mk].score=sc;renderResultados();}
function saveResults(){save();toast('✅ Resultados salvos!');}

// ═══════════════════════════════════════
//  PONTUAÇÃO COMPLETA
// ═══════════════════════════════════════
function calcScore(pid){
  let total=0, exact=0;
  const d={pre:0,pi:0,r1:0,semi:0,cf:0,finals:0,conf_bonus:0,nba_champ:0,nba_champ_neg:0};
  const rp=S.results.pre||{};

  // ── PRÉ-PLAYOFFS: campeão conf oeste ──
  const myPre=S.pre[pid]||{};
  if(rp.champW && myPre.champW){
    if(myPre.champW===rp.champW){d.pre+=3;total+=3;}
  }
  // ── PRÉ-PLAYOFFS: campeão conf leste ──
  if(rp.champE && myPre.champE){
    if(myPre.champE===rp.champE){d.pre+=3;total+=3;}
  }
  // ── PRÉ-PLAYOFFS: campeão NBA (+3 / -3) ──
  if(rp.champNBA && myPre.champNBA){
    if(myPre.champNBA===rp.champNBA){d.nba_champ=3;total+=3;}
    else{d.nba_champ_neg=-3;total-=3;}
  }

  // ── PLAY-IN ──
  const piPicks=S.playin[pid]||{};
  Object.keys(PI_PTS).forEach(mk=>{
    const real=S.results.playin[mk];
    if(real===undefined||real===null)return;
    if(piPicks[mk]===real){const pts=PI_PTS[mk];total+=pts;d.pi+=pts;}
  });

  // ── PLAYOFFS ──
  const poPicks=S.playoffs[pid]||{};
  PO_KEYS.forEach(mk=>{
    const real=S.results.playoffs[mk]; if(!real||!real.winner) return;
    const pick=poPicks[mk]; if(!pick||!pick.winner) return;
    if(pick.winner===real.winner){
      const pts=(pick.score&&pick.score===real.score)?2:1;
      if(pts===2) exact++;
      total+=pts;
      d[RD_MAP[mk]]=(d[RD_MAP[mk]]||0)+pts;
    }
  });

  // ── BÔNUS FINALISTAS DE CONF: apostas pré-playoffs (cfW, cfE) ──
  // +1 por cada time que chegou de verdade à Final de Conf
  const cfCheck=[
    {field:'cfW', realA:'cfWA', realB:'cfWB'},
    {field:'cfE', realA:'cfEA', realB:'cfEB'},
  ];
  cfCheck.forEach(({field,realA,realB})=>{
    const myPicks=Array.isArray(myPre[field])?myPre[field]:[];
    if(!myPicks.length) return;
    const realFA=rp[realA]||null;
    const realFB=rp[realB]||null;
    myPicks.forEach(pick=>{
      if((realFA&&pick===realFA)||(realFB&&pick===realFB)){d.conf_bonus+=1;total+=1;}
    });
  });

  return {total,exact,d};
}

// ═══════════════════════════════════════
//  RANKING
// ═══════════════════════════════════════
function calcAndRender(){
  const el=document.getElementById('rank-list');
  if(!S.players.length){
    el.innerHTML='<div style="color:var(--muted);text-align:center;grid-column:1/-1;padding:36px;font-family:\'Barlow Condensed\';font-size:14px;letter-spacing:2px;">NENHUM APOSTADOR AINDA</div>';
    return;
  }
  const scored=S.players.map(p=>({...p,...calcScore(p.id)}))
    .sort((a,b)=> b.total!==a.total ? b.total-a.total : b.exact-a.exact);

  const medals=['gold','silver','bronze'];
  // Detectar empates
  function isTied(i){
    if(i===0) return false;
    return scored[i].total===scored[i-1].total && scored[i].exact===scored[i-1].exact;
  }

  el.innerHTML=scored.map((p,i)=>{
    const tie=isTied(i)?`<span class="tie-badge">EMPATE</span>`:'';
    const nbaChampPts=p.d.nba_champ>0
      ?`<span style="color:var(--gold);">+${p.d.nba_champ} campeão NBA</span>`
      :p.d.nba_champ_neg<0
        ?`<span class="neg-pts">-3 campeão NBA errado</span>`:'';
    return `<div class="rk-card">
      <div class="rk-num ${medals[i]||''}">${i+1}</div>
      <div class="rk-avatar">${p.name[0].toUpperCase()}</div>
      <div class="rk-info">
        <div class="rk-name">${p.name}${tie}</div>
        <div class="rk-detail">
          PI: <span>${p.d.pi}</span> &nbsp;
          R1: <span>${p.d.r1}</span> &nbsp;
          Semi: <span>${p.d.semi}</span> &nbsp;
          CF: <span>${p.d.cf}</span> &nbsp;
          Finals: <span>${p.d.finals}</span><br>
          Conf bonus: <span>${p.d.conf_bonus}</span> &nbsp;
          Pré-PO: <span>${p.d.pre}</span> &nbsp;
          ${nbaChampPts}
        </div>
      </div>
      <div class="rk-right">
        <div class="rk-score">${p.total}</div>
        <div class="rk-exact">${p.exact} EXATOS</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
//  BRACKET EDITOR
// ═══════════════════════════════════════
function renderBracketEditor(){
  function rows(conf, teams, elId){
    const el=document.getElementById(elId); if(!el) return;
    el.innerHTML=teams.map(t=>`
      <div class="be-row">
        <span class="be-seed">${t.seed}</span>
        <input class="be-emoji-inp" id="be-${conf}-logo-${t.seed}" value="${t.logo}" maxlength="4" title="Emoji do time">
        <input class="be-name-inp" id="be-${conf}-name-${t.seed}" value="${t.name}" placeholder="Nome do time"
          oninput="markChanged(this)">
      </div>`).join('');
  }
  rows('w', TW, 'be-west');
  rows('e', TE, 'be-east');
}

function markChanged(el){ el.classList.add('be-changed'); }

function saveBracketTeams(){
  const west=DEFAULT_TW.map(t=>({
    seed:t.seed,
    name:document.getElementById('be-w-name-'+t.seed)?.value.trim()||t.name,
    logo:document.getElementById('be-w-logo-'+t.seed)?.value.trim()||t.logo,
  }));
  const east=DEFAULT_TE.map(t=>({
    seed:t.seed,
    name:document.getElementById('be-e-name-'+t.seed)?.value.trim()||t.name,
    logo:document.getElementById('be-e-logo-'+t.seed)?.value.trim()||t.logo,
  }));
  S.bracketTeams={west,east};
  save();
  // Remove changed highlights
  document.querySelectorAll('.be-changed').forEach(el=>el.classList.remove('be-changed'));
  toast('✅ Times do bracket salvos! Bracket e apostas atualizados.');
  renderBracket();
}

function resetBracketTeams(){
  if(!confirm('Restaurar todos os times para o padrão original?')) return;
  S.bracketTeams=null;
  save();
  renderBracketEditor();
  renderBracket();
  toast('↺ Times restaurados para o padrão.');
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
let tt;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),2800);}
