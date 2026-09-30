/* Kerry's Mod — Comprehensive Gamemode Suite
 * Modular rules layer for the existing Three.js/Cannon/WebSocket client.
 * Keeps the legacy game loop intact while exposing a clean gamemode API.
 */
(() => {
  'use strict';

  const W = window;
  const THREE = W.THREE;
  const now = () => performance.now();
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const dist2 = (a,b) => { const x=a.x-b.x, z=a.z-b.z; return x*x+z*z; };

  const CORE_MAPS = [
    {id:'km_gm_construct', name:"Kerry's Construct", family:'sandbox', legacy:0},
    {id:'km_gm_flatgrass', name:'Flatgrass Plains', family:'sandbox', legacy:1},
    {id:'km_ph_office', name:'Office', family:'prophunt', legacy:2},
    {id:'km_ph_warehouse', name:'Warehouse', family:'prophunt', legacy:3},
    {id:'km_ph_mansion', name:'Mansion', family:'prophunt', legacy:4},
    {id:'km_pvp_docks', name:'Docks', family:'pvp', legacy:5},
    {id:'km_pvp_bunker', name:'Bunker', family:'pvp', legacy:6},
    {id:'km_pvp_rooftops', name:'Rooftops', family:'pvp', legacy:3},
    {id:'km_nextbot_backrooms', name:'Backrooms', family:'nextbots', legacy:8},
    {id:'km_nextbot_mall', name:'Mall', family:'nextbots', legacy:9},
    {id:'km_nextbot_asylum', name:'Asylum', family:'nextbots', legacy:10},
    {id:'km_has_school', name:'School', family:'hideseek', legacy:11},
    {id:'km_has_suburbia', name:'Suburbia', family:'hideseek', legacy:12},
    {id:'km_has_forest', name:'Forest', family:'hideseek', legacy:13},
    {id:'km_desert_outpost', name:'Desert Outpost', family:'all', legacy:4}
  ];
  const SANDBOX_MAPS = CORE_MAPS.map(m => ({
    id:'sb_'+m.id, base:m.id, name:'Sandbox — '+m.name, family:'sandbox', legacy:m.legacy
  }));

  class EventBus {
    constructor(){ this.h = new Map(); }
    on(t,f){ const a=this.h.get(t)||[]; a.push(f); this.h.set(t,a); return ()=>this.off(t,f); }
    off(t,f){ const a=this.h.get(t)||[]; this.h.set(t,a.filter(x=>x!==f)); }
    emit(t,d){ (this.h.get(t)||[]).slice().forEach(f=>{ try{f(d)}catch(e){console.error('[GamemodeSuite]',t,e)} }); }
  }

  class Gamemode {
    constructor(ctx){ this.ctx=ctx; this.id='base'; this.title='Base Gamemode'; this.running=false; }
    start(){ this.running=true; }
    stop(){ this.running=false; }
    tick(){}
    onPlayerJoin(){}
    onPlayerLeave(){}
    onPlayerDeath(){}
    onRoundEnd(){}
    getHud(){ return null; }
  }

  class Sandbox extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_sandbox'; this.title='Sandbox'; this.saves=new Map(); this.noclip=false; this.godmode=false; }
    start(){
      super.start();
      this.ctx.setLegacyGM('sb');
      this.ctx.setRoundTimer(null);
      this.ctx.setVoting(false);
      this.restoreLocalSave();
      this.ctx.log('SANDBOX: unrestricted building enabled');
    }
    toggleNoclip(){ this.noclip=!this.noclip; if(W.vfly!==undefined) W.vfly=this.noclip; return this.noclip; }
    toggleGodmode(){ this.godmode=!this.godmode; if(W.GODMODE!==undefined) W.GODMODE=this.godmode; return this.godmode; }
    spawnProp(type='crate'){
      if(typeof W.spawnProp==='function') return W.spawnProp(type);
      return null;
    }
    spawnVehicle(type='car'){
      if(typeof W.spawnVehicle==='function') return W.spawnVehicle(type);
      return null;
    }
    saveState(name='autosave'){
      const props=[];
      const list=W.props || [];
      for(const o of list){
        const b=o.body || o.b;
        if(!b) continue;
        props.push({type:o.type||o.kind||'crate',x:b.position.x,y:b.position.y,z:b.position.z,q:[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w]});
      }
      const state={version:1,map:this.ctx.currentMapId,props,at:new Date().toISOString()};
      this.saves.set(name,state);
      try{localStorage.setItem('kerrys.sandbox.'+name,JSON.stringify(state))}catch{}
      this.ctx.log('Sandbox saved: '+name);
      return state;
    }
    restoreLocalSave(name='autosave'){
      let state=this.saves.get(name);
      if(!state) try{state=JSON.parse(localStorage.getItem('kerrys.sandbox.'+name)||'null')}catch{}
      if(!state || state.map!==this.ctx.currentMapId) return false;
      if(typeof W.clearProps==='function') W.clearProps();
      for(const p of state.props){
        if(typeof W.spawnProp!=='function') break;
        const o=W.spawnProp(p.type,{x:p.x,y:p.y,z:p.z});
        if(o?.body && p.q) o.body.quaternion.set(...p.q);
      }
      return true;
    }
  }

  class PVP extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_pvp'; this.title='PVP'; this.round=0; this.limit=15; this.scores=new Map(); this.teamMode=false; this.loadout='rifle'; this.alive=new Set(); }
    start(){
      super.start(); this.ctx.setLegacyGM('pvp'); this.ctx.setRoundTimer(300); this.round++;
      this.scores.clear(); this.alive.clear(); this.ctx.log('PVP round '+this.round+' started');
    }
    setLoadout(v){ if(['pistol','shotgun','rifle','explosives'].includes(v)) this.loadout=v; }
    setTeamMode(v){ this.teamMode=!!v; }
    addKill(killer,victim){ const n=(this.scores.get(killer)||0)+1; this.scores.set(killer,n); this.ctx.emit('pvp:kill',{killer,victim,score:n}); if(n>=this.limit) this.endRound(killer); }
    endRound(winner){ this.running=false; this.ctx.roundEnd({mode:this.id,winner,scores:Object.fromEntries(this.scores)}); }
    scoreboard(){ return [...this.scores.entries()].sort((a,b)=>b[1]-a[1]).map(([player,score])=>({player,score})); }
  }

  class PropHunt extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_prophunt'; this.title='Prop Hunt'; this.phase='setup'; this.hiders=new Set(); this.seekers=new Set(); this.duration=300; this.speedBySize=true; this.tauntCooldown=12; }
    start(){
      super.start(); this.ctx.setLegacyGM('ph'); this.phase='hiding'; this.assignTeams(); this.ctx.setRoundTimer(300);
      this.ctx.log('PROP HUNT: Hiders disguise while Seekers prepare');
      setTimeout(()=>{if(this.running)this.phase='hunting'},12000);
    }
    assignTeams(){
      const players=this.ctx.players(); this.hiders.clear(); this.seekers.clear();
      players.forEach((p,i)=>(i%4===0?this.seekers:this.hiders).add(p));
    }
    disguise(prop){ if(!prop) return; prop.locked=true; prop.disguise=true; }
    taunt(player,audio){ this.ctx.emit('prophunt:taunt',{player,audio:audio||null}); }
    hitEnvironment(seeker){ this.ctx.emit('prophunt:penalty',{seeker,amount:10}); }
    getMovementMultiplier(size){ return this.speedBySize ? clamp(1.35/(Math.max(.35,size)),.55,1.55) : 1; }
    endRound(winner){ this.running=false; this.ctx.roundEnd({mode:this.id,winner,phase:this.phase}); }
  }

  class Nextbots extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_nextbots'; this.title='Nextbots'; this.bots=[]; this.survival=180; this.nav=null; this.spawned=0; }
    start(){
      super.start(); this.ctx.setRoundTimer(this.survival); this.nav=W.NG||null;
      this.spawned=0; this.bots=[];
      for(let i=0;i<Math.min(6,Math.max(2,this.ctx.players().length+1));i++) this.spawnBot();
      this.ctx.log('NEXTBOTS: survive '+this.survival+' seconds');
    }
    spawnBot(){
      const scene=W.sc, THREE_=W.THREE;
      if(!scene||!THREE_) return null;
      const img=pick(['/assets/nextbots/nextbot.png','/assets/nextbots/angry_munci.png','/assets/nextbots/chilly.png']);
      const tex=new THREE_.TextureLoader().load(img);
      const mat=new THREE_.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
      const sprite=new THREE_.Sprite(mat); sprite.scale.set(4,4,1);
      const a=Math.random()*Math.PI*2,r=35+Math.random()*30;
      sprite.position.set(Math.cos(a)*r,3,Math.sin(a)*r); scene.add(sprite);
      const bot={id:'nb'+(++this.spawned),sprite,speed:4+Math.random()*2,path:[],pathAt:0};
      this.bots.push(bot); return bot;
    }
    findPath(start,end){
      const N=this.nav?.n,H=this.nav?.H;
      if(!N||!H) return [end];
      const cell=p=>[clamp(Math.round((p.x+83)/2),0,N-1),clamp(Math.round((p.z+83)/2),0,N-1)];
      const s=cell(start),g=cell(end), key=(x,z)=>x+','+z, q=[s], prev=new Map([[key(...s),null]]), dirs=[[1,0],[-1,0],[0,1],[0,-1]];
      while(q.length){
        const [x,z]=q.shift(); if(x===g[0]&&z===g[1]) break;
        for(const [dx,dz] of dirs){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=N||nz>=N||H[nx*N+nz]<-90)continue;const k=key(nx,nz);if(prev.has(k))continue;prev.set(k,[x,z]);q.push([nx,nz]);}
      }
      const out=[];let cur=g,guard=0;while(cur&&guard++<N*N){out.push({x:-83+cur[0]*2,z:-83+cur[1]*2,y:H[cur[0]*N+cur[1]]+2});cur=prev.get(key(...cur))} return out.reverse();
    }
    tick(dt){
      if(!this.running) return;
      const p=W.pb?.position; if(!p) return;
      for(const b of this.bots){
        if(now()-b.pathAt>800){b.path=this.findPath(b.sprite.position,p);b.pathAt=now()}
        const target=b.path[1]||{x:p.x,y:p.y,z:p.z},dx=target.x-b.sprite.position.x,dz=target.z-b.sprite.position.z,len=Math.hypot(dx,dz)||1;
        b.sprite.position.x+=dx/len*b.speed*dt;b.sprite.position.z+=dz/len*b.speed*dt;
        b.sprite.position.y=target.y;
        const d=Math.hypot(b.sprite.position.x-p.x,b.sprite.position.z-p.z);
        if(d<2.4){this.ctx.emit('nextbot:contact',{bot:b.id});this.ctx.scare();b.sprite.position.set((Math.random()*2-1)*50,3,(Math.random()*2-1)*50)}
      }
    }
    stop(){this.bots.forEach(b=>{try{b.sprite.parent?.remove(b.sprite)}catch{}});this.bots=[];super.stop()}
  }

  class HideSeek extends Gamemode {
    constructor(ctx){ super(ctx); this.id='gm_hideseek'; this.title='Hide & Seek'; this.phase='blind'; this.seekers=new Set(); this.hiders=new Set(); this.points=new Map(); this.duration=240; }
    start(){
      super.start(); this.phase='blind'; this.ctx.setRoundTimer(this.duration); this.assign();
      this.ctx.log('HIDE & SEEK: Seekers frozen for 20 seconds');
      setTimeout(()=>{if(this.running)this.phase='seek'},20000);
    }
    assign(){ const p=this.ctx.players();this.seekers.clear();this.hiders.clear();p.forEach((x,i)=>(i%4===0?this.seekers:this.hiders).add(x)); }
    ping(radius=18){ const p=W.pb?.position;if(!p)return;this.ctx.emit('hideseek:radar',{x:p.x,z:p.z,radius,phase:this.phase}); }
    addPoints(player,n=1){this.points.set(player,(this.points.get(player)||0)+n)}
    endRound(winner){this.running=false;this.ctx.roundEnd({mode:this.id,winner,points:Object.fromEntries(this.points)});}
  }

  class MapVoting {
    constructor(ctx){this.ctx=ctx;this.active=false;this.options=[];this.votes=new Map();this.endsAt=0;this.timer=0;this.overlay=null;}
    eligible(){return this.ctx.modeId!=='gm_sandbox'}
    start(){
      if(!this.eligible()) return;
      const current=this.ctx.currentMapId;
      const pool=CORE_MAPS.filter(m=>m.id!==current);
      this.options=pool.sort(()=>Math.random()-.5).slice(0,3);
      this.votes.clear();this.active=true;this.endsAt=now()+20000;this.render();this.ctx.emit('mapvote:start',{options:this.options});
      clearInterval(this.timer);this.timer=setInterval(()=>{if(now()>=this.endsAt)this.finish();else this.render()},250);
    }
    vote(player,mapId){if(!this.active||!this.options.some(m=>m.id===mapId))return;this.votes.set(player,mapId);this.ctx.emit('mapvote:vote',{player,mapId})}
    finish(){
      if(!this.active)return;this.active=false;clearInterval(this.timer);this.render();
      const counts=new Map(this.options.map(o=>[o.id,0]));for(const m of this.votes.values())counts.set(m,(counts.get(m)||0)+1);
      const max=Math.max(...counts.values());const tied=this.options.filter(o=>counts.get(o.id)===max);const winner=pick(tied);
      this.ctx.loadMap(winner.id);this.ctx.emit('mapvote:end',{winner:winner.id,counts:Object.fromEntries(counts)});
    }
    render(){
      if(!document.body)return;
      if(!this.overlay){this.overlay=document.createElement('div');this.overlay.id='gmMapVote';Object.assign(this.overlay.style,{position:'fixed',inset:'0',display:'none',alignItems:'center',justifyContent:'center',zIndex:9998,pointerEvents:'auto',background:'rgba(3,7,12,.82)',fontFamily:'system-ui'});document.body.appendChild(this.overlay)}
      if(!this.active){this.overlay.style.display='none';return}
      this.overlay.style.display='flex';
      const left=Math.max(0,Math.ceil((this.endsAt-now())/1000));
      const total=Math.max(1,this.votes.size);
      this.overlay.innerHTML='<div style="width:min(960px,94vw);padding:24px;background:#101822;border:1px solid #ffffff25;border-radius:14px;color:#fff"><div style="font-size:28px;font-weight:800;margin-bottom:4px">VOTE NEXT MAP</div><div style="opacity:.7;margin-bottom:16px">'+left+'s remaining · '+total+' vote'+(total===1?'':'s')+'</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'+this.options.map(o=>{const n=[...this.votes.values()].filter(v=>v===o.id).length,p=Math.round(n/total*100);return '<button data-map="'+o.id+'" style="min-height:150px;padding:18px;border-radius:10px;border:1px solid #ffffff25;background:#182431;color:#fff;text-align:left;cursor:pointer"><div style="font-size:18px;font-weight:800">'+o.name+'</div><div style="margin-top:36px;font-size:30px">'+n+'</div><div style="opacity:.65">'+p+'%</div></button>'}).join('')+'</div></div>';
      this.overlay.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>this.vote(this.ctx.localPlayer(),b.dataset.map));
    }
  }

  class Suite {
    constructor(){
      this.events=new EventBus();
      this.currentMapId=CORE_MAPS[0].id;
      this.modeId='gm_sandbox';
      this.roundTimer=null;this.roundEndsAt=0;
      this.modes=new Map();
      const ctx={
        events:this.events, players:()=>this.players(), localPlayer:()=>this.localPlayer(),
        emit:(t,d)=>this.emit(t,d), log:m=>this.log(m), scare:()=>this.scare(),
        setLegacyGM:v=>{try{W.GM=v}catch{}},setRoundTimer:s=>this.setRoundTimer(s),
        setVoting:v=>{if(!v)this.voting.active=false}, roundEnd:d=>this.roundEnd(d),
        loadMap:id=>this.loadMap(id), modeId:()=>this.modeId, get mode(){return this.modeId}
      };
      this.modes.set('gm_sandbox',new Sandbox(ctx));
      this.modes.set('gm_pvp',new PVP(ctx));
      this.modes.set('gm_prophunt',new PropHunt(ctx));
      this.modes.set('gm_nextbots',new Nextbots(ctx));
      this.modes.set('gm_hideseek',new HideSeek(ctx));
      this.voting=new MapVoting(ctx);
      this.ctx=ctx;
      this.install();
    }
    install(){
      W.KerrysGamemodeSuite=this;
      W.KM_GAMEMODES={Sandbox, PVP, PropHunt, Nextbots, HideSeek, Gamemode, CORE_MAPS, SANDBOX_MAPS};
      const boot=()=>{
        this.patchMenu();
        this.patchLegacyEvents();
        if(!this._tick){this._tick=true;let last=now();const loop=()=>{const t=now(),dt=Math.min(.05,(t-last)/1000);last=t;this.tick(dt);requestAnimationFrame(loop)};requestAnimationFrame(loop)}
      };
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
    }
    patchMenu(){
      const sel=document.getElementById('gm'); if(!sel)return;
      if(!sel.dataset.kmSuite){
        sel.dataset.kmSuite='1';
        sel.innerHTML='';
        [['gm_sandbox','Sandbox'],['gm_pvp','PVP — Deathmatch'],['gm_prophunt','Prop Hunt'],['gm_nextbots','Nextbots'],['gm_hideseek','Hide & Seek']].forEach(([v,n])=>{const o=document.createElement('option');o.value=v;o.textContent=n;sel.appendChild(o)});
        sel.value=this.modeId;
        sel.addEventListener('change',()=>this.setMode(sel.value));
      }
      const map=document.getElementById('mp');
      if(map && !map.dataset.kmSuite){
        map.dataset.kmSuite='1';map.innerHTML='';
        CORE_MAPS.concat(SANDBOX_MAPS).forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.name;map.appendChild(o)});
        map.addEventListener('change',()=>this.loadMap(map.value));
      }
    }
    patchLegacyEvents(){
      this.events.on('mapvote:start',()=>{});
      const oldLoad=W.loadMap;
      if(oldLoad && !oldLoad.__kmSuite){
        const suite=this;
        const wrapped=function(i){ if(typeof i==='string') return suite.loadMap(i); return oldLoad.call(this,i); };
        wrapped.__kmSuite=true;W.loadMap=wrapped;
      }
    }
    setMode(id){
      if(!this.modes.has(id))return;
      this.modes.get(this.modeId)?.stop();
      this.modeId=id;this.modes.get(id).start();
      const m=document.getElementById('gm');if(m)m.value=id;
      this.emit('mode:change',{mode:id});
    }
    loadMap(id){
      const m=CORE_MAPS.concat(SANDBOX_MAPS).find(x=>x.id===id)||CORE_MAPS[0];
      this.currentMapId=id;
      const base=m.base?CORE_MAPS.find(x=>x.id===m.base):m;
      try{
        if(typeof W.loadMap==='function' && W.loadMap!==this.loadMap) W.loadMap(base.legacy);
      }catch(e){console.warn('[GamemodeSuite] legacy map load failed',e)}
      if(this.modeId==='gm_sandbox')this.log('Loaded '+m.name);
      this.emit('map:change',m);
    }
    setRoundTimer(seconds){
      this.roundTimer=seconds==null?null:seconds;this.roundEndsAt=seconds==null?0:now()+seconds*1000;
    }
    roundEnd(data){
      this.emit('round:end',data);
      if(this.modeId!=='gm_sandbox')setTimeout(()=>this.voting.start(),350);
    }
    players(){
      const list=[];if(W.myPeer||W.myId)list.push(W.myPeer||W.myId);
      if(W.room?.onPeers)return list;
      return list;
    }
    localPlayer(){return W.myPeer||W.myId||'local'}
    tick(dt){
      const mode=this.modes.get(this.modeId);mode?.tick(dt);
      if(this.roundTimer!=null&&now()>=this.roundEndsAt){this.roundTimer=null;mode?.onRoundEnd();this.roundEnd({mode:this.modeId,reason:'timer'})}
      this.updateHud();
    }
    updateHud(){
      const m=this.modes.get(this.modeId);const el=document.getElementById('gs');if(!el)return;
      const time=this.roundTimer==null?'':Math.ceil(Math.max(0,this.roundEndsAt-now())/1000)+'s';
      el.textContent=m?.title+(time?' · '+time:'');
    }
    emit(topic,data){
      this.events.emit(topic,data);
      if(W.room&&typeof W.room.emit==='function')W.room.emit(topic,data).catch?.(()=>{});
    }
    log(msg){this.events.emit('log',msg);const l=document.getElementById('log');if(l){const e=document.createElement('div');e.className='entry tag';e.innerHTML='<span class="kind">MODE</span><span class="message"></span>';e.querySelector('.message').textContent=msg;l.prepend(e);setTimeout(()=>e.remove(),5000)}}
    scare(){const s=document.getElementById('scare');if(s){s.classList.add('on');setTimeout(()=>s.classList.remove('on'),550)}}
    setVoting(v){if(!v)this.voting.active=false}
  }

  let attempts=0;
  const boot=()=>{ if(W.KerrysGamemodeSuite)return; if(!W.THREE || !document.getElementById('gm')){if(attempts++<120)setTimeout(boot,250);return} new Suite(); };
  boot();
})();
