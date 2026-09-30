/* Kerry's Mod — modular gamemode suite */
(() => {
  'use strict';
  const WIN = window;
  const now = () => performance.now();
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const pick = a => a[Math.floor(Math.random()*a.length)];

  const CORE_MAPS = [
    {id:'km_gm_construct', name:"Kerry's Construct", family:'sandbox', legacy:0, thumb:['#214b3b','#86b66a'], icon:'▦'},
    {id:'km_gm_flatgrass', name:'Flatgrass', family:'sandbox', legacy:1, thumb:['#316f3c','#9dcf80'], icon:'＋'},
    {id:'km_ph_office', name:'Office', family:'prophunt', legacy:2, thumb:['#1d2630','#8797a4'], icon:'▥'},
    {id:'km_ph_warehouse', name:'Warehouse', family:'prophunt', legacy:3, thumb:['#40392e','#b88a47'], icon:'▤'},
    {id:'km_ph_mansion', name:'Mansion', family:'prophunt', legacy:4, thumb:['#2d2231','#a66e8d'], icon:'⌂'},
    {id:'km_pvp_docks', name:'Docks', family:'pvp', legacy:5, thumb:['#173d57','#58a8c5'], icon:'⚓'},
    {id:'km_pvp_bunker', name:'Bunker', family:'pvp', legacy:6, thumb:['#25282b','#777f84'], icon:'▣'},
    {id:'km_pvp_rooftops', name:'Rooftops', family:'pvp', legacy:7, thumb:['#34456b','#ef8c61'], icon:'▱'},
    {id:'km_nextbot_backrooms', name:'Backrooms', family:'nextbots', legacy:8, thumb:['#5b563a','#d8cb6f'], icon:'∞'},
    {id:'km_nextbot_mall', name:'Mall', family:'nextbots', legacy:9, thumb:['#3d264b','#cf8ce8'], icon:'▥'},
    {id:'km_nextbot_asylum', name:'Asylum', family:'nextbots', legacy:10, thumb:['#334047','#a7c9c1'], icon:'✚'},
    {id:'km_has_school', name:'School', family:'hideseek', legacy:11, thumb:['#193d50','#6fb4d4'], icon:'⌘'},
    {id:'km_has_suburbia', name:'Suburbia', family:'hideseek', legacy:12, thumb:['#32512c','#b8d57a'], icon:'⌂'},
    {id:'km_has_forest', name:'Forest', family:'hideseek', legacy:13, thumb:['#173b2b','#5fa66b'], icon:'♣'},
    {id:'km_desert_outpost', name:'Desert Outpost', family:'all', legacy:14, thumb:['#7a4b28','#e1a058'], icon:'◇'}
  ];
  const SANDBOX_MAPS = CORE_MAPS.map(m => ({
    id:'sb_'+m.id, base:m.id, name:'Sandbox — '+m.name, family:'sandbox', legacy:m.legacy,
    thumb:[m.thumb[0],m.thumb[1]], icon:'▧'
  }));
  const ALL_MAPS = CORE_MAPS.concat(SANDBOX_MAPS);

  class EventBus {
    constructor(){ this.handlers=new Map(); }
    on(type,fn){ const a=this.handlers.get(type)||[]; a.push(fn); this.handlers.set(type,a); return ()=>this.off(type,fn); }
    off(type,fn){ this.handlers.set(type,(this.handlers.get(type)||[]).filter(x=>x!==fn)); }
    emit(type,data){ for(const fn of (this.handlers.get(type)||[]).slice()){ try{fn(data)}catch(e){console.warn('[GamemodeSuite]',type,e)} } }
  }

  class Gamemode {
    constructor(ctx){ this.ctx=ctx; this.id='base'; this.title='Base'; this.running=false; }
    start(){ this.running=true; }
    stop(){ this.running=false; }
    tick(){}
    endRound(reason='complete',winner=''){ this.running=false; this.ctx.finishRound({mode:this.id,reason,winner}); }
    scoreboard(){ return []; }
  }

  class Sandbox extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_sandbox'; this.title='Sandbox'; this.god=true; this.noclip=false; this.saveKey='autosave'; this.variant=false; this.padMeshes=[]; }
    start(){ super.start(); this.ctx.clearRoundTimer(); this.ctx.disableVoting(); this.ctx.setLegacy('sb'); this.variant=this.ctx.currentMapId.startsWith('sb_'); this.applyVariant(); this.ctx.log('SANDBOX · free build · no round timer'); }
    applyVariant(){
      this.removeVariant();
      if(!this.variant) return;
      try{
        if(typeof sbox==='function'){ sbox([0,.08,0],[168,.16,168],'concrete', [0,0,0],0x65727c); }
        for(let x=-72;x<=72;x+=12) if(typeof dbox==='function') dbox([x,.18,0],[.06,.04,150],'metal',0x9aa7ad);
        for(let z=-72;z<=72;z+=12) if(typeof dbox==='function') dbox([0,.18,z],[150,.04,.06],'metal',0x9aa7ad);
        this.spawnPads.forEach(p=>{
          const m=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,.05,32),new THREE.MeshBasicMaterial({color:0x55d9e3,transparent:true,opacity:.3}));
          m.position.set(p[0],.18,p[2]); sc.add(m); this.padMeshes.push(m);
        });
        if(typeof placePlayer==='function' && this.spawnPads[0]) placePlayer(...this.spawnPads[0]);
      }catch(e){ console.warn('[GamemodeSuite] sandbox variant',e); }
    }
    removeVariant(){ this.padMeshes.forEach(m=>{try{sc.remove(m)}catch{}}); this.padMeshes=[]; }
    get spawnPads(){ return [[-45,1.2,-45],[45,1.2,-45],[-45,1.2,45],[45,1.2,45],[0,1.2,0]]; }
    toggleNoclip(){ this.noclip=!this.noclip; if(typeof setNC==='function')setNC(this.noclip); this.ctx.log('Noclip '+(this.noclip?'ON':'OFF')); return this.noclip; }
    toggleGodmode(){ this.god=!this.god; this.ctx.log('Godmode '+(this.god?'ON':'OFF')); return this.god; }
    saveState(name=this.saveKey){
      const out={version:1,map:this.ctx.currentMapId,at:new Date().toISOString(),props:[]};
      for(const o of (props||[])){ const b=o?.b; if(!b)continue; out.props.push({type:o.t||'crate',x:b.position.x,y:b.position.y,z:b.position.z,q:[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w],col:o.col||'#ffffff',tx:o.tx||null}); }
      try{localStorage.setItem('kerrys.sandbox.'+name,JSON.stringify(out))}catch{}
      this.ctx.log('Sandbox save: '+name); return out;
    }
    restoreState(name=this.saveKey){
      let st=null; try{st=JSON.parse(localStorage.getItem('kerrys.sandbox.'+name)||'null')}catch{}
      if(!st||st.map!==this.ctx.currentMapId)return false;
      try{if(typeof clearProps==='function')clearProps()}catch{}
      for(const p of st.props){ try{ if(typeof spawnProp==='function')spawnProp(p.type,{x:p.x,y:p.y,z:p.z},p.col||'#ffffff',0,0) }catch{} }
      this.ctx.log('Sandbox restore: '+name); return true;
    }
  }

  class PVP extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_pvp'; this.title='PVP'; this.limit=15; this.teamMode=false; this.loadout='rifle'; this.startedAt=0; this.finalized=false; this.pickups=[]; this.pickupClock=0; this.armor=0; this.combatPatched=false; }
    start(){ super.start(); this.finalized=false; this.ctx.enableVoting(); this.startedAt=now(); this.ctx.setLegacy('pvp'); this.ctx.setRoundTimer(300); this.configureLoadout(); this.spawnPickups(); this.patchCombat(); this.ctx.log('PVP · '+(this.teamMode?'Team Deathmatch':'Deathmatch')+' · first to '+this.limit); }
    configureLoadout(){ const idx={pistol:2,shotgun:3,rifle:4,sniper:5,rpg:6}[this.loadout] ?? 4; if(typeof cw!=='undefined')cw=idx; if(typeof W!=='undefined'&&Array.isArray(W)&&W[idx]&&W[idx].a<=0)W[idx].a=W[idx].mag||W[idx].a; }
    setLoadout(v){ if(['pistol','shotgun','rifle','sniper','rpg'].includes(v))this.loadout=v; this.configureLoadout(); }
    setTeamMode(v){ this.teamMode=!!v; }
    spawnPickups(){
      this.clearPickups();
      const base=Array.isArray(SPAWN)?[SPAWN[0],SPAWN[2]]:[0,0];
      const spots=[[base[0]+22,base[1]],[base[0]-22,base[1]],[base[0],base[1]+22],[base[0],base[1]-22]];
      const types=['health','armor','ammo','health'];
      spots.forEach((p,i)=>{const type=types[i%types.length];const color=type==='health'?0x48e28d:type==='armor'?0x69a7ff:0xffca4d;const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.18,24),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.4,metalness:.25,roughness:.3}));mesh.position.set(p[0],.3,p[1]);mesh.castShadow=true;sc.add(mesh);this.pickups.push({type,mesh,available:true,respawnAt:0});});
    }
    clearPickups(){for(const p of this.pickups){try{sc.remove(p.mesh)}catch{}}this.pickups=[];}
    applyPickup(type){
      if(type==='health')hp=clamp((hp||0)+40,0,100);
      if(type==='armor')this.armor=clamp(this.armor+40,0,100);
      if(type==='ammo'){const wv=W[cw];if(wv&&wv.mag)wv.a=wv.mag;}
      this.ctx.log('PICKUP · '+type.toUpperCase());
    }
    patchCombat(){
      if(this.combatPatched)return; this.combatPatched=true;
      try{
        const oldHit=hitRemote;
        hitRemote=(id,d)=>{ if(this.teamMode){const teams=this.teams();if(teams[myPeer||myId]===teams[id])return;} return oldHit(id,d); };
      }catch{}
      try{
        const oldHurt=hurt2;
        hurt2=(d,k)=>{ if(this.armor>0){const blocked=Math.min(this.armor,d*.6);this.armor-=blocked;d-=blocked;flv=.35;} if(d>0)return oldHurt(d,k); };
      }catch{}
    }
    checkPickups(){
      for(const p of this.pickups){
        if(!p.available || p.respawnAt>now())continue;
        let target=null;
        const localX=pb.position.x,localZ=pb.position.z;
        if(this.ctx.isHost()){
          for(const q of this.ctx.players()){const info=q===myPeer?{x:localX,z:localZ}:((this.ctx.remotePlayers().find(x=>x.id===q))||{});if(Math.hypot((info.x||0)-p.mesh.position.x,(info.z||0)-p.mesh.position.z)<2){target=q;break;}}
        }
        if(!target)continue;
        p.available=false;p.mesh.visible=false;p.respawnAt=now()+10000;this.ctx.send('gm:pvp:pickup',{id:this.pickups.indexOf(p),type:p.type,target});
        if(target===myPeer||target===myId)this.applyPickup(p.type);
      }
      for(const p of this.pickups)if(!p.available&&p.respawnAt<=now()){p.available=true;p.mesh.visible=true;}
    }
    teams(){ const out={}; const list=this.ctx.players(); list.forEach((id,i)=>out[id]=i%2); return out; }
    scoreboard(){ const src=(typeof SCR!=='undefined')?SCR:{}; return Object.entries(src).sort((a,b)=>(b[1]?.k||0)-(a[1]?.k||0)).map(([id,s])=>({id,kills:s?.k||0,deaths:s?.d||0,team:this.teams()[id]??0})); }
    stop(){ this.clearPickups(); super.stop(); }
    tick(){
      if(!this.running)return;
      this.checkPickups();
      if(this.ctx.isHost()){
        const rows=this.scoreboard(), winner=rows.find(x=>x.kills>=this.limit);
        if(winner&&!this.finalized){ this.finalized=true; this.endRound('score',winner.id); }
      }
      this.ctx.renderScoreboard(this.title,this.scoreboard(),this.teamMode);
    }
  }

  class PropHunt extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_prophunt'; this.title='Prop Hunt'; this.finalized=false; this.tauntCooldown=0; this.assignAt=0; }
    start(){ super.start(); this.finalized=false; this.ctx.enableVoting(); this.assignAt=now(); this.ctx.setLegacy('ph'); this.ctx.setRoundTimer(null); this.ctx.log('PROP HUNT · Hiders disguise · Seekers hunt'); }
    tick(dt){
      if(!this.running)return;
      this.tauntCooldown=Math.max(0,this.tauntCooldown-dt);
      if(this.ctx.isHost() && typeof PH!=='undefined' && PH.ph==='end' && !this.finalized){this.finalized=true; this.endRound('phase',PH.w||'');}
      this.ctx.renderPropHud();
    }
    taunt(){
      if(this.tauntCooldown>0 || typeof PH==='undefined' || PH.ph!=='hide' || !PH.k || PH.k===myPeer)return;
      this.tauntCooldown=8;
      const size=(()=>{try{return PT[myDg]?.s?.[0]||PT[myDg]?.r||1}catch{return 1}})();
      const pitch=1.45-clamp(size,.4,3.5)*.14;
      try{tone(280*pitch,120,pitch>.95?.22:.16,'square',.12);tone(620*pitch,260,.12,'triangle',.08)}catch{}
      this.ctx.send('gm:ph:taunt',{player:myPeer,size:Math.round(size*100)/100});
      this.ctx.log('HIDER TAUNT · '+(myDg||'unknown prop'));
    }
  }

  class Nextbots extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_nextbots'; this.title='Nextbots'; this.duration=180; this.remaining=180; this.nextAudio=0; this.contactCooldown=0; this.spawned=[]; this.finalized=false; }
    start(){ super.start(); this.finalized=false; this.ctx.enableVoting(); this.remaining=this.duration; this.ctx.setLegacy('sb'); if(typeof nb!=='undefined')nb=1; if(this.ctx.isHost()){ try{ BOTS.slice().forEach(b=>killBot(b,true)); }catch{}; const count=Math.min(6,Math.max(2,this.ctx.players().length+1)); for(let i=0;i<count;i++){try{spawnBot(BLIB[i%Math.max(1,BLIB.length)])}catch{}} } this.ctx.log('NEXTBOTS · survive 3:00'); }
    tick(dt){
      if(!this.running)return;
      this.remaining=Math.max(0,this.remaining-dt);
      const p=typeof pb!=='undefined'?pb.position:null;
      let nearest=Infinity;
      for(const b of (typeof BOTS!=='undefined'?BOTS:[])){ const d=p?Math.hypot(b.b.position.x-p.x,b.b.position.z-p.z):999; nearest=Math.min(nearest,d); }
      if(nearest<25 && now()>this.nextAudio && typeof tone==='function'){ this.nextAudio=now()+Math.max(120,850-nearest*25); const v=clamp(1-nearest/25,.05,.45); tone(90+v*130,55,.14,'sawtooth',v*.18); }
      if(nearest<2.2 && now()>this.contactCooldown){ this.contactCooldown=now()+1200; this.ctx.emitLocal('nextbot:contact',{distance:nearest}); if(typeof scare==='function'){const bot=(BOTS||[]).find(x=>p&&Math.hypot(x.b.position.x-p.x,x.b.position.z-p.z)<2.2); if(bot) scare(bot);} }
      this.ctx.updateHud('NEXTBOTS · '+Math.ceil(this.remaining)+'s · closest '+(isFinite(nearest)?nearest.toFixed(1)+'m':'--'));
      if(this.remaining<=0&&!this.finalized&&this.ctx.isHost()){this.finalized=true;this.endRound('survived',myPeer||myId);}
    }
    stop(){try{BOTS.slice().forEach(b=>killBot(b,true))}catch{};super.stop();}
  }

  class HideSeek extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_hideseek'; this.title='Hide & Seek'; this.duration=240; this.hideTime=20; this.phase='blind'; this.remaining=240; this.role='hider'; this.points=0; this.eliminated=new Set(); this.finalized=false; this.lastPoint=0; }
    start(){ super.start(); this.finalized=false; this.ctx.enableVoting(); this.phase='blind'; this.remaining=this.duration; this.points=0; this.eliminated.clear(); const players=this.ctx.players(); const seeker=players[0]||myPeer||myId; this.role=(myPeer||myId)===seeker?'seeker':'hider'; if(!players.length||players.length===1)this.role='hider'; blind=this.role==='seeker'; this.ctx.setLegacy('sb'); this.ctx.log('HIDE & SEEK · '+(this.role==='seeker'?'SEEKER':'HIDER')+' · '+this.hideTime+'s hide phase'); }
    tick(dt){
      if(!this.running)return;
      if(this.phase==='blind'){ this.hideTime=Math.max(0,this.hideTime-dt); if(this.role==='seeker'){ keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false; if(typeof pb!=='undefined')pb.velocity.set(0,0,0); blind=true; } if(this.hideTime<=0){this.phase='seek';blind=false;} }
      else if(this.phase==='seek'){ this.remaining=Math.max(0,this.remaining-dt); if(this.role==='hider'&&!this.eliminated.has(myPeer||myId)){this.points+=dt*1.0;} this.checkTag(dt); }
      const endClock=Math.max(0,this.remaining);
      if(this.role==='seeker' && endClock<30) this.ctx.renderRadar(this.ctx.players(),18);
      this.ctx.updateHud('HIDE & SEEK · '+(this.phase==='blind'?'HIDERS DISPERSE':'SEEK · '+Math.ceil(endClock)+'s')+' · '+Math.floor(this.points)+' pts');
      if(this.remaining<=0&&!this.finalized&&this.ctx.isHost()){this.finalized=true;this.endRound('timer',this.eliminated.size?'Hiders':'Seekers');}
    }
    checkTag(){
      if(this.role!=='seeker'||!this.ctx.isHost())return;
      const p=typeof pb!=='undefined'?pb.position:null;if(!p)return;
      for(const info of this.ctx.remotePlayers()){
        if(!info.id||this.eliminated.has(info.id)||info.id===myPeer)continue;
        const d=Math.hypot((info.x||0)-p.x,(info.z||0)-p.z);
        if(d<2.0){this.eliminated.add(info.id);this.ctx.send('gm:hs:eliminate',{id:info.id});}
      }
      const alive=this.ctx.players().filter(id=>id!==this.ctx.seekerId()).filter(id=>!this.eliminated.has(id));
      if(!alive.length){this.remaining=0;}
    }
    stop(){blind=false;super.stop();}
  }

  class MapVoting {
    constructor(ctx){this.ctx=ctx;this.active=false;this.options=[];this.votes=new Map();this.endsAt=0;this.lastRender=0;this.token=0;this.overlay=null;}
    start(){
      if(this.active||!this.ctx.isHost()||this.ctx.modeId()==='gm_sandbox')return;
      const pool=CORE_MAPS.filter(m=>m.id!==this.ctx.currentMapId && !m.id.startsWith('sb_'));
      this.options=pool.sort(()=>Math.random()-.5).slice(0,3);
      if(this.options.length<3) this.options=CORE_MAPS.slice(0,3);
      this.votes.clear(); this.active=true; this.endsAt=now()+20000; const token=++this.token;
      this.ctx.send('gm:vote:start',{options:this.options.map(x=>x.id),current:this.ctx.currentMapId,endsAt:this.endsAt});
      this.render();
      const loop=()=>{if(!this.active||token!==this.token)return;this.render();if(now()>=this.endsAt)this.finish();else requestAnimationFrame(loop)};requestAnimationFrame(loop);
    }
    receiveStart(d){ this.options=(d.options||[]).map(id=>CORE_MAPS.find(x=>x.id===id)).filter(Boolean); this.votes.clear(); this.active=true; this.endsAt=Number(d.endsAt)||now()+20000; this.render(); }
    receiveVote(d){if(!this.active)return;const p=String(d.player||'');const id=String(d.mapId||'');if(!this.options.some(x=>x.id===id)||!p)return;this.votes.set(p,id);this.render();}
    vote(mapId){if(!this.active)return;this.ctx.send('gm:vote:cast',{player:myPeer||myId,mapId});if(this.ctx.isHost())this.receiveVote({player:myPeer||myId,mapId});}
    receiveEnd(d){ if(!this.active)return; this.active=false; this.render(); const winner=CORE_MAPS.find(x=>x.id===d.winner); this.ctx.log('MAP VOTE · '+(winner?.name||'next map')); if(winner)this.ctx.applyMap(winner.id,true); }
    finish(){
      if(!this.active||!this.ctx.isHost())return;
      const counts=new Map(this.options.map(o=>[o.id,0]));
      for(const id of this.votes.values())counts.set(id,(counts.get(id)||0)+1);
      const max=Math.max(...counts.values()); const tied=this.options.filter(o=>counts.get(o.id)===max);
      const winner=pick(tied);
      this.active=false; this.render();
      this.ctx.send('gm:vote:end',{winner:winner.id,counts:Object.fromEntries(counts)});
      this.ctx.applyMap(winner.id);
    }
    render(){
      if(!this.overlay){this.overlay=document.createElement('div');this.overlay.id='gmMapVote';document.body.appendChild(this.overlay);}
      if(!this.active){this.overlay.hidden=true;return;}
      this.overlay.hidden=false;
      const left=Math.max(0,Math.ceil((this.endsAt-now())/1000));
      const total=Math.max(1,this.votes.size);
      this.overlay.innerHTML='<div class="gmv-card"><div class="gmv-kicker">ROUND COMPLETE</div><div class="gmv-title">VOTE NEXT MAP</div><div class="gmv-time">'+left+'s <span>· '+this.votes.size+' votes</span></div><div class="gmv-grid">'+this.options.map(m=>{const n=[...this.votes.values()].filter(v=>v===m.id).length,p=Math.round(n/total*100);return '<button class="gmv-option" data-map="'+m.id+'"><div class="gmv-thumb" style="background:linear-gradient(145deg,'+m.thumb[0]+','+m.thumb[1]+')"><span>'+m.icon+'</span></div><div class="gmv-name">'+m.name+'</div><div class="gmv-meta">'+n+' votes · '+p+'%</div><div class="gmv-bar"><i style="width:'+p+'%"></i></div></button>'}).join('')+'</div><div class="gmv-note">Sandbox rounds bypass voting · ties are resolved randomly</div></div>';
      this.overlay.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>this.vote(b.dataset.map));
    }
  }

  class Suite {
    constructor(){
      this.events=new EventBus(); this.modeId='gm_sandbox'; this.currentMapId='km_gm_construct'; this.roundEndsAt=0; this.votingEnabled=true; this.finalized=false; this.loadout='rifle'; this.teamMode=false;
      const ctx={
        players:()=>this.players(), remotePlayers:()=>this.remotePlayers(), seekerId:()=>this.players()[0]||myPeer||myId,
        currentMapId:()=>this.currentMapId, modeId:()=>this.modeId, isHost:()=>!!host,
        setLegacy:v=>{GM=v;}, clearRoundTimer:()=>{this.roundEndsAt=0;},
        setRoundTimer:s=>{this.roundEndsAt=s==null?0:now()+s*1000;},
        disableVoting:()=>{this.votingEnabled=false; this.voting.active=false;}, enableVoting:()=>{this.votingEnabled=true;},
        log:m=>this.log(m), send:(t,d)=>this.send(t,d), emitLocal:(t,d)=>this.events.emit(t,d),
        finishRound:d=>this.finishRound(d), applyMap:id=>this.applyMap(id),
        updateHud:t=>this.updateHud(t), renderScoreboard:(t,r,team)=>this.renderScoreboard(t,r,team), renderPropHud:()=>this.renderPropHud(), renderRadar:(p,r)=>this.renderRadar(p,r),
        setSelectedMode:id=>this.setMode(id)
      };
      this.ctx=ctx;
      this.modes=new Map([
        ['gm_sandbox',new Sandbox(ctx)],['gm_pvp',new PVP(ctx)],['gm_prophunt',new PropHunt(ctx)],['gm_nextbots',new Nextbots(ctx)],['gm_hideseek',new HideSeek(ctx)]
      ]);
      this.voting=new MapVoting(ctx);
      this.boot();
    }
    boot(){
      WIN.KerrysGamemodeSuite=this; WIN.KM_GAMEMODES={Gamemode,Sandbox,PVP,PropHunt,Nextbots,HideSeek,MapVoting,CORE_MAPS,SANDBOX_MAPS};
      this.installStyles(); this.patchMenu(); this.patchNetworking(); this.patchStart(); this.patchInput(); this.startLoop(); this.waitForRoom();
      if(this.votingEnabled)this.modes.get(this.modeId).start();
    }
    installStyles(){
      if(document.getElementById('gmSuiteStyle'))return;
      const s=document.createElement('style');s.id='gmSuiteStyle';s.textContent=`
#gmMapVote{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,6,10,.82);backdrop-filter:blur(10px)}
#gmMapVote[hidden]{display:none}.gmv-card{width:min(1080px,96vw);padding:24px;border:1px solid #ffffff22;border-radius:18px;background:linear-gradient(145deg,#111c27f2,#080e15f2);box-shadow:0 30px 110px #000b}
.gmv-kicker{color:#78edf2;font:900 11px/1 system-ui;letter-spacing:.18em}.gmv-title{margin-top:6px;font:900 clamp(28px,5vw,48px)/1 system-ui;color:#ffd06a;letter-spacing:.04em}.gmv-time{margin:10px 0 18px;color:#fff;font-weight:800}.gmv-time span{opacity:.55;font-weight:600}.gmv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.gmv-option{margin:0;text-align:left;padding:12px;border-radius:14px;border:1px solid #ffffff18;background:#172431;color:#fff;transform:none;box-shadow:none}.gmv-option:hover{transform:translateY(-3px);border-color:#66e6ee55;box-shadow:0 16px 30px #0005}.gmv-thumb{height:135px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:54px;color:#ffffffaa;text-shadow:0 4px 15px #0006}.gmv-name{font-size:18px;font-weight:900;margin-top:10px}.gmv-meta{font-size:12px;color:#a9bbc8;margin-top:5px}.gmv-bar{height:5px;background:#ffffff0b;border-radius:99px;overflow:hidden;margin-top:10px}.gmv-bar i{display:block;height:100%;background:linear-gradient(90deg,#56d5d8,#ffbd45);border-radius:99px}.gmv-note{margin-top:14px;font-size:11px;color:#8ea0ad}@media(max-width:720px){.gmv-card{padding:15px}.gmv-grid{grid-template-columns:1fr}.gmv-thumb{height:92px}.gmv-name{font-size:16px}}
#gmScore{position:fixed;right:14px;top:76px;z-index:5;min-width:230px;padding:12px 14px;background:rgba(7,12,18,.72);border:1px solid #ffffff14;border-radius:12px;backdrop-filter:blur(10px);box-shadow:0 12px 28px #0003;pointer-events:none}
#gmScore .gms-title{font-size:11px;letter-spacing:.14em;color:#78edf2;text-transform:uppercase;font-weight:900;margin-bottom:7px}#gmScore table{width:100%;border-collapse:collapse;font-size:12px}#gmScore td{padding:2px 0}#gmScore .team0{color:#6dd8ff}#gmScore .team1{color:#ff9f9f;text-align:right}#gmScore .gms-me{font-weight:900;color:#ffd16c}#gmScore[hidden]{display:none}
#gmRadar{position:fixed;right:18px;bottom:110px;width:132px;height:132px;border:1px solid #66e6ee55;border-radius:50%;background:radial-gradient(circle,#11232d,#071017);z-index:5;pointer-events:none;box-shadow:0 0 30px #56d5d822 inset,0 0 24px #56d5d822}#gmRadar[hidden]{display:none}#gmRadar i{position:absolute;width:8px;height:8px;border-radius:50%;background:#ff6f6f;transform:translate(-50%,-50%);box-shadow:0 0 10px #ff6f6f}.gmRadar-sweep{position:absolute;inset:4px;border-radius:50%;border-top:2px solid #65e9ef;animation:gmSweep 1.8s linear infinite}@keyframes gmSweep{to{transform:rotate(1turn)}}
`;
      document.head.appendChild(s);
    }
    patchMenu(){
      const gmEl=$('gm'), mpEl=$('mp'); if(!gmEl||!mpEl)return;
      gmEl.innerHTML='';
      [['gm_sandbox','Sandbox'],['gm_pvp','PVP · Deathmatch / Team'],['gm_prophunt','Prop Hunt'],['gm_nextbots','Nextbots'],['gm_hideseek','Hide & Seek']].forEach(([v,n])=>gmEl.appendChild(new Option(n,v)));
      gmEl.value=this.modeId;
      gmEl.onchange=()=>{this.setMode(gmEl.value);};
      mpEl.innerHTML='';
      ALL_MAPS.forEach(m=>{const o=new Option(m.name,m.legacy);o.dataset.mapId=m.id;mpEl.appendChild(o);});
      mpEl.onchange=()=>{const o=mpEl.selectedOptions[0];this.currentMapId=o?.dataset.mapId||CORE_MAPS[Number(o?.value)||0].id;};
      const loadoutWrap=document.createElement('div');loadoutWrap.id='gmLoadoutWrap';loadoutWrap.innerHTML='<h3>Match Rules</h3><select id="gmLoadout"><option value="rifle">Rifle Loadout</option><option value="pistol">Pistol Loadout</option><option value="shotgun">Shotgun Loadout</option><option value="sniper">Sniper Loadout</option><option value="rpg">RPG Loadout</option></select><button id="gmTeamMode">Deathmatch</button>';
      mpEl.parentElement.appendChild(loadoutWrap);
      $('gmLoadout').onchange=e=>this.loadout=e.target.value;
      $('gmTeamMode').onclick=()=>{this.teamMode=!this.teamMode;$('gmTeamMode').textContent=this.teamMode?'Team Deathmatch':'Deathmatch';};
      this.setMode(this.modeId);
    }
    setMode(id){
      if(!this.modes.has(id))id='gm_sandbox';
      this.modeId=id;
      this.votingEnabled=id!=='gm_sandbox'; this.finalized=false;
      const legacy={gm_sandbox:'sb',gm_pvp:'pvp',gm_prophunt:'ph',gm_nextbots:'sb',gm_hideseek:'sb'}[id];
      const m=this.modes.get(id); if(m){m.stop(); if(m instanceof PVP){m.loadout=this.loadout;m.teamMode=this.teamMode;}}
      $('gm').value=id;
      if(state!=='play')this.updateHud(this.modes.get(id).title+(id==='gm_sandbox'?' · no timer':''));
    }
    patchStart(){
      const original=WIN.start || start;
      if(!original||original.__kmSuiteWrapped)return;
      const suite=this;
      const wrapped=function(c,h){
        let requested=suite.modeId, mapId=suite.currentMapId;
        if(!h&&c&&room){const q=peers.find(p=>p.presence?.code===c&&p.presence?.host);if(q){requested=String(q.presence.suiteMode||({'pvp':'gm_pvp','ph':'gm_prophunt','sb':'gm_sandbox'}[q.presence.gm]||'gm_sandbox'));mapId=q.presence.suiteMap||CORE_MAPS[+q.presence.map||0]?.id||'km_gm_construct';}}
        suite.modeId=requested;suite.currentMapId=mapId;
        const chosen=ALL_MAPS.find(m=>m.id===mapId)||CORE_MAPS[0];
        $('mp').value=String(chosen.legacy); $('gm').value=({gm_pvp:'pvp',gm_prophunt:'ph'}[requested]||'sb');
        original(c,h);
        suite.modeId=requested;suite.currentMapId=mapId;
        suite.postStart(requested,mapId);
      };
      wrapped.__kmSuiteWrapped=true; WIN.start=wrapped;
    }
    postStart(modeId,mapId){
      const m=this.modes.get(modeId); if(!m)return;
      for(const x of this.modes.values()) if(x!==m)x.stop();
      if(m instanceof PVP){m.loadout=this.loadout;m.teamMode=this.teamMode;}
      m.start();
      this.votingEnabled=modeId!=='gm_sandbox'; this.finalized=false;
      if(room&&code)room.presence({suiteMode:modeId,suiteMap:mapId,gm:({gm_sandbox:'sb',gm_pvp:'pvp',gm_prophunt:'ph'}[modeId]||'sb'),map:(ALL_MAPS.find(x=>x.id===mapId)||CORE_MAPS[0]).legacy}).catch(()=>{});
      this.updateHud(m.title+(modeId==='gm_sandbox'?' · no timer':''));
    }
    waitForRoom(){
      let tries=0; const timer=setInterval(()=>{ if(room){ clearInterval(timer); this.patchNetworking(); } else if(++tries>120){ clearInterval(timer); } },250);
    }
    patchNetworking(){
      if(!room)return;
      room.on('gm:vote:start',m=>{if(m.isMe)return;this.voting.receiveStart(m.data||{});});
      room.on('gm:vote:cast',m=>{if(!this.isHost())return;this.voting.receiveVote(m.data||{});this.send('gm:vote:update',{votes:[...this.voting.votes.entries()]});});
      room.on('gm:vote:update',m=>{if(m.isMe)return;const rows=Array.isArray(m.data?.votes)?m.data.votes:[];this.voting.votes=new Map(rows);this.voting.render();});
      room.on('gm:pvp:pickup',m=>{if(m.isMe)return;const d=m.data||{};if(this.modeId==='gm_pvp'&&d.target===myPeer)this.modes.get('gm_pvp').applyPickup(d.type);});
      room.on('gm:vote:end',m=>{if(m.isMe)return;this.voting.receiveEnd(m.data||{});});
      room.on('gm:hs:eliminate',m=>{const id=String(m.data?.id||'');if(id) this.events.emit('hs:eliminate',id);});
      room.on('gm:mode',m=>{if(m.isMe)return; const d=m.data||{};if(d.suiteMode)this.modeId=d.suiteMode;if(d.mapId)this.currentMapId=d.mapId;});
      room.on('gm:map',m=>{if(m.isMe)return;const d=m.data||{};if(d.id)this.applyMap(d.id,true);});
      room.on('gm:team',m=>{if(m.isMe)return;});
      room.on('gm:ph:taunt',m=>{if(!m.isMe) try{tone(220,110,.18,'square',.06)}catch{}});
    }
    patchInput(){
      addEventListener('keydown',e=>{
        if(e.repeat)return;
        if(e.code==='KeyH'&&this.modeId==='gm_prophunt'&&this.modes.get('gm_prophunt').running){this.modes.get('gm_prophunt').taunt();return;}
        if(e.code==='KeyN'&&this.modeId==='gm_sandbox'){this.modes.get('gm_sandbox').toggleNoclip();return;}
        if(e.code==='KeyF2'&&this.modeId==='gm_sandbox'){this.modes.get('gm_sandbox').saveState();return;}
        if(e.code==='KeyF3'&&this.modeId==='gm_sandbox'){this.modes.get('gm_sandbox').restoreState();return;}
      });
    }
    applyMap(id,remote=false){
      const m=ALL_MAPS.find(x=>x.id===id)||CORE_MAPS[0];this.currentMapId=m.id;
      if($('mp'))$('mp').value=String(m.legacy);
      const legacyLoad=WIN.loadMap||loadMap; legacyLoad(m.legacy);
      this.modes.get(this.modeId)?.stop();
      const current=this.modes.get(this.modeId); if(current){if(current instanceof Sandbox)current.variant=m.id.startsWith('sb_');current.start();}
      if(room&&code&&!remote){room.presence({suiteMap:m.id,map:m.legacy,gm:({gm_pvp:'pvp',gm_prophunt:'ph'}[this.modeId]||'sb')}).catch(()=>{});this.send('gm:map',{id:m.id});}
    }
    finishRound(data){
      if(this.modeId==='gm_sandbox'||!this.votingEnabled)return;
      this.finalized=true;this.log('ROUND COMPLETE · '+(data.reason||'complete'));
      if(this.isHost())setTimeout(()=>this.voting.start(),650);
    }
    send(topic,data){if(room&&code)room.emit(topic,{c:code,...data}).catch?.(()=>{});}
    isHost(){return !code||!!host;}
    players(){
      const ids=(peers||[]).map(p=>String(p.peer)).filter(Boolean);
      if(!ids.includes(String(myPeer||myId)))ids.unshift(String(myPeer||myId));
      return [...new Set(ids)];
    }
    remotePlayers(){
      return (peers||[]).filter(p=>p.peer!==myPeer).map(p=>({id:p.peer,x:Number(p.presence?.x)||0,z:Number(p.presence?.z)||0,y:Number(p.presence?.y)||0}));
    }
    renderScoreboard(title,rows,teamMode){
      let el=$('gmScore'); if(!el){el=document.createElement('div');el.id='gmScore';document.body.appendChild(el);}
      if(this.modeId!=='gm_pvp'){el.hidden=true;return;} el.hidden=false;
      el.innerHTML='<div class="gms-title">'+title+'</div><table>'+rows.slice(0,8).map(r=>'<tr><td class="'+(teamMode?'team'+r.team:'')+(r.id===myPeer?' gms-me':'')+'">'+this.safeName(r.id)+'</td><td>'+r.kills+'</td></tr>').join('')+'</table>';
    }
    renderPropHud(){this.hideEl('gmScore');}
    renderRadar(players,radius){
      let el=$('gmRadar'); if(!el){el=document.createElement('div');el.id='gmRadar';document.body.appendChild(el);el.innerHTML='<div class="gmRadar-sweep"></div>';}
      el.hidden=false;el.querySelectorAll('i').forEach(x=>x.remove());
      const me=peers?.find(p=>p.peer===myPeer),mx=Number(me?.presence?.x)||pb.position.x,mz=Number(me?.presence?.z)||pb.position.z;
      for(const p of (players||[])){if(p===myPeer)continue;const q=(peers||[]).find(x=>x.peer===p);if(!q)continue;const dx=(Number(q.presence?.x)||0)-mx,dz=(Number(q.presence?.z)||0)-mz,d=Math.hypot(dx,dz);if(d>radius)continue;const dot=document.createElement('i');dot.style.left=(50+dx/radius*50)+'%';dot.style.top=(50+dz/radius*50)+'%';el.appendChild(dot);}
      setTimeout(()=>{if(this.modeId!=='gm_hideseek')el.hidden=true},180);
    }
    updateHud(textValue){const el=$('gs');if(el)el.textContent=textValue; }
    log(msg){ if(typeof say==='function')say('MODE',String(msg),'tag'); else this.events.emit('log',msg); }
    safeName(id){const p=(peers||[]).find(x=>x.peer===id);return String(p?.presence?.name||id).slice(0,18);}
    hideEl(id){const e=$(id);if(e)e.hidden=true;}
    startLoop(){
      let last=now();
      const loop=()=>{const t=now(),dt=Math.min(.05,(t-last)/1000);last=t;
        const m=this.modes.get(this.modeId);
        if(m?.running&&state==='play')m.tick(dt);
        if(this.modeId!=='gm_sandbox'&&this.votingEnabled&&this.isHost()&&this.roundEndsAt&&now()>=this.roundEndsAt&&!this.finalized){this.finalized=true;m?.endRound('timer','');}
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  const boot=()=>{
    if(WIN.KerrysGamemodeSuite)return;
    if(!WIN.THREE || !document.getElementById('gm') || !WIN.start){ setTimeout(boot,200); return; }
    try{ new Suite(); }catch(e){ console.error('[GamemodeSuite] boot failed',e); }
  };
  boot();
})();