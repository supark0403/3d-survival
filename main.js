/* ============================================================
   3D SURVIVAL — a Vampire Survivors tribute (three.js)
   Models & SFX: Kenney.nl (CC0) — graveyard kit, mini-dungeon, sci-fi/impact/rpg audio
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* ---------------- error surface ---------------- */
const errEl = document.getElementById('err');
function showErr(e){ errEl.style.display='block'; errEl.textContent='ERR: '+(e.message||e); console.error(e); }
window.addEventListener('error', e=>showErr(e));
window.addEventListener('unhandledrejection', e=>showErr(e.reason));

/* ---------------- dom ---------------- */
const $ = id=>document.getElementById(id);
const hud=$('hud'), xpbar=$('xpbar'), lvlEl=$('lvl'), hpbar=$('hpbar'), hptext=$('hptext'),
      timerEl=$('timer'), killsEl=$('kills'), weaponsEl=$('weapons'), hintEl=$('hint'),
      menuEl=$('menu'), luEl=$('levelup'), luCards=$('lu-cards'), pauseEl=$('pause'),
      goEl=$('gameover'), flashEl=$('flash');

/* ---------------- renderer / scene ---------------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas:$('c'), antialias:true, powerPreference:'high-performance'});
} catch(e){ showErr(new Error('WebGL not available: '+e.message)); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d16);
scene.fog = new THREE.FogExp2(0x0a0d16, 0.010);

const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 500);
addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

/* lights — brighter fill so pale character models read against the night */
scene.add(new THREE.AmbientLight(0x4a5878, 1.9));
const moon = new THREE.DirectionalLight(0xcfe0ff, 2.4);
moon.position.set(-30, 50, -20);
moon.castShadow = true;
moon.shadow.mapSize.set(2048,2048);
moon.shadow.camera.left=-35; moon.shadow.camera.right=35;
moon.shadow.camera.top=35; moon.shadow.camera.bottom=-35;
moon.shadow.camera.far=140;
scene.add(moon); scene.add(moon.target);
const hemi = new THREE.HemisphereLight(0x3a4a86, 0x141821, 1.1); scene.add(hemi);

/* sky decor: moon disc + stars */
{
  const mdisc = new THREE.Mesh(new THREE.SphereGeometry(9,24,24),
    new THREE.MeshBasicMaterial({color:0xdfe8ff, fog:false}));
  mdisc.position.set(-160,150,-220); scene.add(mdisc);
  const n=700, pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, e=Math.random()*Math.PI*0.48+0.15, r=380;
    pos[i*3]=r*Math.cos(e)*Math.cos(a); pos[i*3+1]=r*Math.sin(e); pos[i*3+2]=r*Math.cos(e)*Math.sin(a);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:0x9fb4ff,size:1.6,fog:false})));
}

/* ---------------- loaders / models ---------------- */
const loader = new GLTFLoader();
function loadModel(url){
  return new Promise(res=>{
    loader.load(url, g=>res(g.scene), undefined, ()=>res(null));
  });
}
const M = {}; // model cache
async function prepModels(){
  const map = {
    player:'assets/models/player.glb', sword:'assets/models/sword.glb', gem:'assets/models/gem.glb',
    zombie:'assets/models/character-zombie.glb', skeleton:'assets/models/character-skeleton.glb',
    ghost:'assets/models/character-ghost.glb', vampire:'assets/models/character-vampire.glb',
    gravestone:'assets/models/gravestone-cross.glb', pine:'assets/models/pine.glb', rocks:'assets/models/rocks.glb',
    lantern:'assets/models/lantern-glass.glb', crypt:'assets/models/crypt.glb',
    coffin:'assets/models/coffin.glb', fence:'assets/models/fence.glb'
  };
  for(const k in map){
    const s = await loadModel(map[k]);
    if(s){ s.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; } }); M[k]=s; }
  }
}

/* procedural fallback (if a model fails to load) */
function fallbackMesh(kind){
  const g = new THREE.Group();
  const c = {zombie:0x5a8f4e, skeleton:0xcfc8b8, ghost:0xbfd9ff, vampire:0x7a2030, player:0xd9c9a8, sword:0xcfd6e6, gem:0x4cc9f0}[kind] ?? 0xffffff;
  if(kind==='gem'){ g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.2}))); return g; }
  const m = new THREE.MeshStandardMaterial({color:c, roughness:.9});
  if(kind==='sword'){ g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.4,0.3),m)); return g; }
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.45,0.7,4,8),m); body.position.y=1.0; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,12),m); head.position.y=1.95; g.add(head);
  return g;
}

/* flatten a glTF scene (multi-mesh group) into one geometry + material array, ready for InstancedMesh */
const _flatCache=new Map();
function flattenModel(root){
  if(_flatCache.has(root)) return _flatCache.get(root);
  root.updateMatrixWorld(true);
  const geos=[], mats=[];
  root.traverse(o=>{
    if(!o.isMesh) return;
    let g=o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if(g.index) g=g.toNonIndexed();
    geos.push(g); mats.push(o.material);
  });
  let res=null;
  if(geos.length){
    const merged = mergeGeometries(geos, true);
    if(merged) res={geo:merged, mats};
    else res={geo:geos[0], mats:[mats[0]]}; // attribute mismatch fallback
  }
  _flatCache.set(root,res);
  return res;
}

/* ---------------- environment ---------------- */
const WORLD_R = 85;
function scatter(inst, count, rMin, rMax, sMin, sMax){
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), p=new THREE.Vector3(), sc=new THREE.Vector3();
  let placed=0, guard=0;
  while(placed<count && guard++<count*20){
    const a=Math.random()*Math.PI*2, r=rMin+Math.random()*(rMax-rMin);
    p.set(Math.cos(a)*r, 0, Math.sin(a)*r);
    e.set(0, Math.random()*Math.PI*2, 0); q.setFromEuler(e);
    const s=sMin+Math.random()*(sMax-sMin); sc.set(s,s,s);
    m4.compose(p,q,sc); inst.setMatrixAt(placed++, m4);
  }
  inst.count=placed; inst.instanceMatrix.needsUpdate=true; return placed;
}
function buildEnv(){
  const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD_R+15, 64),
    new THREE.MeshStandardMaterial({color:0x18231c, roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

  const mk = (model)=>{ if(!model) return null;
    const f=flattenModel(model); if(!f) return null;
    const im=new THREE.InstancedMesh(f.geo, Array.isArray(f.mats)?f.mats:f.mats.clone(), 400);
    im.castShadow=true; im.frustumCulled=false; scene.add(im); return im; };

  scatter(mk(M.gravestone), 70, 8, WORLD_R, .8, 1.5);
  scatter(mk(M.pine), 46, 12, WORLD_R, .9, 1.7);
  scatter(mk(M.rocks), 55, 6, WORLD_R, .5, 1.3);
  scatter(mk(M.crypt), 10, 30, WORLD_R, .8, 1.2);
  scatter(mk(M.coffin), 14, 10, WORLD_R, .9, 1.2);
  const fence = mk(M.fence); if(fence) scatter(fence, 64, WORLD_R-2, WORLD_R+1, 1, 1.15);

  // lanterns with flickering point lights
  window._lanternLights=[];
  const lant = mk(M.lantern);
  if(lant){
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2+0.3, r=26+i%3*14;
      const p=new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r);
      const m4=new THREE.Matrix4().compose(p,new THREE.Quaternion(),new THREE.Vector3(1.2,1.2,1.2));
      lant.setMatrixAt(i,m4);
      const pl=new THREE.PointLight(0xffb45e, 26, 22, 2); pl.position.copy(p).setY(2.4);
      scene.add(pl); window._lanternLights.push({l:pl, base:26, ph:Math.random()*9});
    }
    lant.count=8; lant.instanceMatrix.needsUpdate=true;
  }
}

/* ---------------- audio ---------------- */
const AudioSys = {
  ctx:null, master:null, buffers:{}, musicOn:false,
  async init(){
    if(this.ctx) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value=(typeof Settings!=='undefined')?Settings.vol:0.9; this.master.connect(this.ctx.destination);
    const files = {shoot:'laserSmall_000',hit:'impactMetal_000',die:'explosionCrunch_000',gem:'slime_000',
                   levelup:'forceField_000',boss:'lowFrequency_explosion_000',hurt:'impactPunch_medium_000',
                   zap:'laserRetro_000',boom:'explosionCrunch_001',ui:'ui'};
    for(const k in files){
      try{
        const r = await fetch('assets/sfx/'+files[k]+'.ogg');
        this.buffers[k] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      }catch(e){ /* optional */ }
    }
  },
  play(name, vol=0.5, rate=1){
    const b=this.buffers[name]; if(!b||!this.ctx) return;
    const s=this.ctx.createBufferSource(); s.buffer=b;
    s.playbackRate.value = rate*(0.92+Math.random()*0.16);
    const g=this.ctx.createGain(); g.gain.value=vol;
    s.connect(g); g.connect(this.master); s.start();
  },
  startMusic(){
    if(this.musicOn||!this.ctx) return; this.musicOn=true;
    const t=this.ctx.currentTime;
    const mk=(f,type,vol)=>{ const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type=type;o.frequency.value=f;g.gain.value=0;o.connect(g);g.connect(this.master);o.start(t);return {o,g}; };
    this.mA=mk(55,'sine',0); this.mB=mk(82.4,'triangle',0); this.mC=mk(110,'sine',0);
    const lfo=this.ctx.createOscillator(), lg=this.ctx.createGain();
    lfo.frequency.value=0.13; lg.gain.value=0.015; lfo.connect(lg);
    lg.connect(this.mA.g.gain); lg.connect(this.mB.g.gain); lfo.start(t);
    this.mA.g.gain.setValueAtTime(0,t); this.mA.g.gain.linearRampToValueAtTime(0.05,t+4);
    this.mB.g.gain.setValueAtTime(0,t); this.mB.g.gain.linearRampToValueAtTime(0.028,t+4);
    this.mC.g.gain.setValueAtTime(0,t); this.mC.g.gain.linearRampToValueAtTime(0.016,t+7);
  },
  stopMusic(){
    if(!this.musicOn) return; this.musicOn=false;
    const t=this.ctx.currentTime;
    for(const m of [this.mA,this.mB,this.mC]){ m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(m.g.gain.value,t); m.g.gain.linearRampToValueAtTime(0,t+1.2); }
  }
};

/* ---------------- input ---------------- */
const keys = {};
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='Space') e.preventDefault();
  if(e.code==='KeyR' && state==='over') restart();
  if(state==='levelup'){
    const i={'Digit1':0,'Digit2':1,'Digit3':2}[e.code];
    if(i!==undefined) pickUpgrade(i);
  }
});
addEventListener('keyup', e=>keys[e.code]=false);

let yaw=0, pitch=0.42;
const canvas=$('c');
function resumeGame(){
  if(state!=='pause') return;
  state='playing'; pauseEl.classList.add('hidden'); try{canvas.requestPointerLock().catch(()=>{})}catch(e){};
}
canvas.addEventListener('click', ()=>{
  if(state==='playing'){ if(document.pointerLockElement!==canvas) try{canvas.requestPointerLock().catch(()=>{})}catch(e){}; }
  else resumeGame();
});
pauseEl.addEventListener('click', resumeGame);
document.addEventListener('pointerlockchange', ()=>{
  if(document.pointerLockElement===canvas){
    if(state==='pause'){ state='playing'; pauseEl.classList.add('hidden'); }
  } else {
    if(state==='playing' && !luOpen){ state='pause'; pauseEl.classList.remove('hidden'); }
  }
});
document.addEventListener('mousemove', e=>{
  if(document.pointerLockElement===canvas && state==='playing'){
    yaw   -= e.movementX*0.0022*Settings.sens;
    pitch += e.movementY*0.0018*Settings.sens;
    pitch = Math.max(0.12, Math.min(1.25, pitch));
  }
});

/* ---------------- settings UI wiring (mouse sensitivity + volume) ---------------- */
{
  const sensS=$('sens-slider'), volS=$('vol-slider');
  sensS.addEventListener('input', ()=>{ Settings.sens=parseFloat(sensS.value); $('sens-val').textContent=Settings.sens.toFixed(2)+'x'; });
  volS.addEventListener('input', ()=>{ Settings.vol=parseInt(volS.value,10)/100; $('vol-val').textContent=Math.round(Settings.vol*100)+'%'; if(AudioSys.master) AudioSys.master.gain.value=Settings.vol; });
  $('sens-reset').addEventListener('click', ()=>{ sensS.value=1; sensS.dispatchEvent(new Event('input')); });
  $('vol-reset').addEventListener('click', ()=>{ volS.value=90; volS.dispatchEvent(new Event('input')); });
  $('settings-close').addEventListener('click', closeSettings);
  // stop clicks inside the settings panel from falling through to the pause "resume" handler
  $('settings').addEventListener('click', e=>e.stopPropagation());
}

/* ---------------- game state ---------------- */
let state='menu';           // menu | playing | levelup | pause | over
let luOpen=false;
/* ---------------- settings (mouse sensitivity + volume) ---------------- */
const Settings = { sens:1, vol:0.9 };
try{ const s=JSON.parse(localStorage.getItem('ds3_settings')||'{}'); if(typeof s.sens==='number') Settings.sens=s.sens; if(typeof s.vol==='number') Settings.vol=s.vol; }catch(e){}
let settingsOpen=false;
function openSettings(){ settingsOpen=true; $('settings').classList.remove('hidden'); $('sens-slider').value=Settings.sens; $('vol-slider').value=Math.round(Settings.vol*100); $('sens-val').textContent=Settings.sens.toFixed(2)+'x'; $('vol-val').textContent=Math.round(Settings.vol*100)+'%'; }
function closeSettings(){ settingsOpen=false; $('settings').classList.add('hidden'); try{localStorage.setItem('ds3_settings',JSON.stringify({sens:Settings.sens,vol:Settings.vol}));}catch(e){}
  // if we opened settings from pause, resume play and re-lock the pointer
  if(state==='pause'){ state='playing'; pauseEl.classList.add('hidden'); try{canvas.requestPointerLock().catch(()=>{})}catch(e){} } }
window._dbg = ()=>({state, luOpen, pendingLus, hp:P.hp, maxHp:P.maxHp, lvl:P.level, xp:P.xp,
  gameTime, kills, enemiesAlive:enemies.filter(e=>e.alive).length,
  pauseVisible:!pauseEl.classList.contains('hidden'), luVisible:!luEl.classList.contains('hidden')});
let gameTime=0, kills=0, nextBossAt=90;
const P = { pos:new THREE.Vector3(0,0,0), velY:0, onGround:true, hp:100, maxHp:100,
            level:1, xp:0, inv:0, yaw:0, speedBase:7 };

/* ---------------- player model ---------------- */
let playerG=null, playerBlob=null, playerRing=null;
function buildPlayer(){
  if(playerG){ scene.remove(playerG); playerG=null; }
  const g = M.player ? SkeletonUtils.clone(M.player) : fallbackMesh('player');
  g.scale.setScalar(1.25);
  // make the hero clearly readable: warm gold emissive tint + keep shadows
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true;
    const m=o.material; if(m && m.emissive!==undefined){ m.emissive=new THREE.Color(0xffc24d); m.emissiveIntensity=0.55; } }});
  scene.add(g); playerG=g;
  // ground shadow blob — child of g so x/z follows, but we pin y to the floor each frame (it must NOT jump)
  const blob=new THREE.Mesh(new THREE.CircleGeometry(0.7,24), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.38}));
  blob.rotation.x=-Math.PI/2; blob.position.y=0.02; g.add(blob); playerBlob=blob;
  // "you are here" glow ring (cyan) so the player is unmistakable against enemies
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.75,1.05,32), new THREE.MeshBasicMaterial({color:0x4cc9f0,transparent:true,opacity:0.85,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.03; g.add(ring); playerRing=ring;
}

/* ---------------- weapons ---------------- */
const WEAPONS = {
  whip:    {name:'Whip',        ko:'채찍',      icon:'🗡️', desc:'앞으로 휘두르는 광역 베기', cd:0.85, maxLvl:8},
  fireball:{name:'Fire Wand',   ko:'화염봉',    icon:'🔥', desc:'가장 가까운 적에게 화염구 발사 (관통)', cd:1.05, maxLvl:8},
  knife:   {name:'Orbit Knives',ko:'회전 단검', icon:'🌀', desc:'주위를 도는 단검이 적을 베고 돌아온다', cd:0.34, maxLvl:8},
  lightning:{name:'Lightning',  ko:'낙뢰',      icon:'⚡', desc:'랜덤한 적에게 벼락을 내린다', cd:1.7, maxLvl:8},
  aura:    {name:'Blade Aura',  ko:'검의 기운', icon:'🛡️', desc:'주변을 도는 검들의 방어막', cd:0.5, maxLvl:8},
};
const owned = {};          // id -> level
let dmgMul=1, atkSpdLvl=0;
function weaponCd(id){ return WEAPONS[id].cd * Math.pow(0.88, atkSpdLvl); }

/* instanced fx meshes */
let whipIM=null, knifeIM=null, auraIM=null, fireIM=null, beamIM=null, sparkIM=null, puffIM=null;
const FIRE_MAX=120, BEAM_MAX=24, SPARK_MAX=80, PUFF_MAX=60;
function buildWeaponFx(){
  if(!M.sword) return;
  const f=flattenModel(M.sword);
  const baseMat = Array.isArray(f.mats)?f.mats:f.mats;
  const mkSword=(emissive,emI)=>{
    const mats = baseMat.map(m=>{ const c=m.clone(); c.emissive=new THREE.Color(emissive); c.emissiveIntensity=emI; return c; });
    return Array.isArray(baseMat)?mats:mats[0];
  };
  whipIM = new THREE.InstancedMesh(f.geo, mkSword(0x3355ff,0.5), 1); whipIM.count=0; whipIM.frustumCulled=false; scene.add(whipIM);
  knifeIM = new THREE.InstancedMesh(f.geo, mkSword(0x22ccff,0.7), 5); knifeIM.count=0; knifeIM.frustumCulled=false; scene.add(knifeIM);
  auraIM = new THREE.InstancedMesh(f.geo, mkSword(0xffaa22,0.6), 8); auraIM.count=0; auraIM.frustumCulled=false; scene.add(auraIM);

  fireIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34,10,10),
    new THREE.MeshBasicMaterial({color:0xff7b2d, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false}), FIRE_MAX);
  fireIM.count=0; fireIM.frustumCulled=false; scene.add(fireIM);

  beamIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14,0.22,1,8),
    new THREE.MeshBasicMaterial({color:0xcfe6ff, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false}), BEAM_MAX);
  beamIM.count=0; beamIM.frustumCulled=false; scene.add(beamIM);

  const sgeo=new THREE.PlaneGeometry(0.5,0.5);
  sparkIM = new THREE.InstancedMesh(sgeo, new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}), SPARK_MAX);
  sparkIM.count=0; sparkIM.frustumCulled=false; scene.add(sparkIM);

  puffIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5,10,10),
    new THREE.MeshBasicMaterial({color:0x2a2438, transparent:true, opacity:.7}), PUFF_MAX);
  puffIM.count=0; puffIM.frustumCulled=false; scene.add(puffIM);
}

/* weapon instance data */
const fireData=[];   // {active,x,y,z,vx,vy,vz,dmg,pierce,life}
const beamData=[];   // {active,x,y,z,h,life}
const sparkData=[];  // {active,x,y,z,life,s}
const puffData=[];   // {active,x,y,z,life,s}
let whipAnim=0, whipAimYaw=0, knifeAng=0, auraAng=0;

function fireFireball(dir){
  let slot=-1; for(let i=0;i<fireData.length;i++) if(!fireData[i].active){slot=i;break;}
  if(slot<0) return;
  const lvl=owned.fireball;
  fireData[slot]={active:true,x:P.pos.x,y:1.5,z:P.pos.z,
    vx:dir.x*24,vy:0,vz:dir.z*24,dmg:(6+3*lvl)*dmgMul,pierce:1+Math.floor(lvl/3),life:2.2};
}
function strikeLightning(){
  const cands=enemies.filter(e=>e.alive && e.type!=='boss');
  if(!cands.length) return;
  const lvl=owned.lightning, n=Math.min(1+Math.floor(lvl/3),4);
  for(let i=0;i<n;i++){
    const t=cands[(Math.random()*cands.length)|0];
    dealDamage(t,(16+8*lvl)*dmgMul, new THREE.Vector3());
    spawnBeam(t.x,t.y,t.z);
  }
  AudioSys.play('zap',0.5);
}
function spawnBeam(x,y,z){
  let slot=-1; for(let i=0;i<beamData.length;i++) if(!beamData[i].active){slot=i;break;}
  if(slot<0) return;
  beamData[slot]={active:true,x,y,z,h:26,life:0.16};
}
function spawnSparks(x,y,z,n=4){
  for(let i=0;i<n;i++){
    let slot=-1; for(let j=0;j<sparkData.length;j++) if(!sparkData[j].active){slot=j;break;}
    if(slot<0) return;
    sparkData[slot]={active:true,x,y,z,life:0.25,s:0.6+Math.random()*0.8};
  }
}
function spawnPuff(x,y,z){
  let slot=-1; for(let i=0;i<puffData.length;i++) if(!puffData[i].active){slot=i;break;}
  if(slot<0) return;
  puffData[slot]={active:true,x,y,z,life:0.5,s:1};
}

/* ---------------- enemies ---------------- */
const EDEF = {
  zombie:  {hp:26, dmg:8,  speed:2.3, xp:4,  y:0,   scale:1},
  skeleton:{hp:14, dmg:6,  speed:4.0, xp:5,  y:0,   scale:0.95},
  ghost:   {hp:20, dmg:10, speed:3.1, xp:7,  y:1.7, scale:1},
  vampire: {hp:85, dmg:16, speed:3.4, xp:15, y:0,   scale:1.15},
};
const MAXE = 340;
let enemies=[]; // per-instance state
let enemyIM={};
// per-type emissive tint so enemies read clearly in the night (hostile = saturated colors)
const ETINT = { zombie:0x7dff5e, skeleton:0xcfe0ff, ghost:0x6df2ff, vampire:0xff4d6d };
function buildEnemies(){
  for(const t in EDEF){
    const model = M[t] ? M[t].clone(true) : fallbackMesh(t);
    model.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    const f=flattenModel(model);
    const srcMats = Array.isArray(f.mats)?f.mats:[f.mats];
    // clone + tint: distinct glowing color per enemy type (clone so we don't leak into the shared cache)
    const mats = srcMats.map(m=>{ const c=m.clone(); if(c.emissive!==undefined){ c.emissive=new THREE.Color(ETINT[t]); c.emissiveIntensity=0.6; } return c; });
    const im=new THREE.InstancedMesh(f.geo, Array.isArray(srcMats)?mats:mats[0], MAXE);
    im.count=0; im.castShadow=true; im.frustumCulled=false;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXE*3).fill(1),3);
    scene.add(im); enemyIM[t]=im;
  }
  for(let i=0;i<MAXE;i++){
    enemies.push({alive:false,type:'',hp:1,maxHp:1,x:0,y:0,z:0,flash:0,kb:0,vx:0,vz:0,deadT:0,boss:false,phase:Math.random()*9});
  }
}
function spawnEnemy(type, boss=false){
  const slot = enemies.find(e=>!e.alive); if(!slot) return;
  const d=EDEF[type];
  const a=Math.random()*Math.PI*2, r=24+Math.random()*7;
  let x=P.pos.x+Math.cos(a)*r, z=P.pos.z+Math.sin(a)*r;
  const rr=Math.hypot(x,z); if(rr>WORLD_R-4){ x*= (WORLD_R-4)/rr; z*=(WORLD_R-4)/rr; }
  const t=gameTime;
  const hpMul = boss ? 1 : (1+t/70);
  slot.alive=true; slot.boss=boss; slot.type=type;
  slot.x=x; slot.z=z; slot.y=d.y;
  slot.maxHp = boss ? d.hp*(10+t*0.8) : d.hp*hpMul;
  slot.hp=slot.maxHp; slot.flash=0; slot.kb=0; slot.vx=0; slot.vz=0; slot.deadT=0;
  slot.dmg = boss ? d.dmg*1.6 : d.dmg*(1+t/240);
  slot.speed = boss ? d.speed*0.85 : d.speed*(1+Math.min(0.7,t/300));
  slot.scaleMul = boss ? 3.2 : d.scale;
}
let bossRef=null, bossBarEl=null;
function spawnBoss(){
  spawnEnemy('zombie', true);
  bossRef = enemies.find(e=>e.boss);
  AudioSys.play('boss',0.7); flash(0.5);
  if(!bossBarEl){
    bossBarEl=document.createElement('div');
    bossBarEl.style.cssText='position:absolute;top:26px;left:50%;transform:translateX(-50%);width:min(480px,60vw);z-index:7';
    const lab=document.createElement('div'); lab.textContent='👹 BOSS'; lab.style.cssText='font-size:13px;font-weight:800;color:#ff9f43;text-shadow:0 0 8px rgba(255,120,0,.7);text-align:center;margin-bottom:3px;letter-spacing:2px';
    const bg=document.createElement('div'); bg.style.cssText='height:12px;background:rgba(0,0,0,.6);border:1px solid rgba(255,159,67,.4);border-radius:6px;overflow:hidden';
    const fill=document.createElement('div'); fill.style.cssText='height:100%;width:100%;background:linear-gradient(90deg,#ff9f43,#e5484d)';
    bg.appendChild(fill); bossBarEl.append(lab,bg); hud.appendChild(bossBarEl);
    bossBarEl._fill=fill;
  }
  bossBarEl.style.display='block';
}

/* spatial hash */
const CELL=2.5; const grid=new Map();
function gkey(cx,cz){ return cx*100003+cz; }
function rebuildGrid(){
  grid.clear();
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i]; if(!e.alive) continue;
    const k=gkey(Math.floor(e.x/CELL),Math.floor(e.z/CELL));
    let arr=grid.get(k); if(!arr){arr=[];grid.set(k,arr);} arr.push(i);
  }
}
function forEachNear(x,z,r,fn){
  const c0x=Math.floor((x-r)/CELL), c1x=Math.floor((x+r)/CELL);
  const c0z=Math.floor((z-r)/CELL), c1z=Math.floor((z+r)/CELL);
  for(let cx=c0x;cx<=c1x;cx++) for(let cz=c0z;cz<=c1z;cz++){
    const arr=grid.get(gkey(cx,cz)); if(!arr) continue;
    for(const i of arr){ const e=enemies[i];
      if(e.alive && (e.x-x)*(e.x-x)+(e.z-z)*(e.z-z)<=r*r) fn(e); }
  }
}

function dealDamage(e, dmg, kbDir){
  if(!e.alive) return;
  e.hp-=dmg; e.flash=0.12;
  spawnSparks(e.x, e.y+1.1, e.z, e.boss?6:3);
  AudioSys.play('hit', e.boss?0.5:0.28, e.boss?0.7:1);
  if(kbDir && kbDir.lengthSq()>0){ e.kb=1; e.vx+=kbDir.x*6; e.vz+=kbDir.z*6; }
  if(e.hp<=0) killEnemy(e);
}
function killEnemy(e){
  e.alive=false; e.deadT=0.28;
  kills++;
  AudioSys.play('die', e.boss?0.8:0.4, e.boss?0.6:1);
  spawnPuff(e.x, e.y+1, e.z);
  const d=EDEF[e.type];
  if(e.boss){
    for(let i=0;i<50;i++) dropGem(e.x+(Math.random()-0.5)*4, e.z+(Math.random()-0.5)*4, 2);
    flash(0.7); AudioSys.play('boom',0.8,0.6);
    bossRef=null; if(bossBarEl) bossBarEl.style.display='none';
  } else {
    dropGem(e.x,e.z,d.xp);
    if(Math.random()<0.03) dropHeal(e.x,e.z);
  }
}

/* ---------------- gems & heals ---------------- */
const MAXG=260; let gems=[]; let gemIM=null, healIM=null;
let magnetBase=3.5;
function buildGems(){
  const gm = M.gem ? M.gem : fallbackMesh('gem');
  const f=flattenModel(gm);
  gemIM=new THREE.InstancedMesh(f.geo, Array.isArray(f.mats)?f.mats:f.mats.clone(), MAXG);
  gemIM.count=0; gemIM.frustumCulled=false;
  gemIM.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(MAXG*3).fill(1),3);
  scene.add(gemIM);
  for(let i=0;i<MAXG;i++) gems.push({active:false,x:0,y:0,z:0,val:1,ph:Math.random()*9,vx:0,vz:0});

  healIM=new THREE.InstancedMesh(new THREE.SphereGeometry(0.3,12,12),
    new THREE.MeshStandardMaterial({color:0x6dff8a,emissive:0x2f8f45,emissiveIntensity:1.4}), 24);
  healIM.count=0; healIM.frustumCulled=false; scene.add(healIM);
  for(let i=0;i<24;i++) gems.push({active:false,x:0,y:0,z:0,val:0,ph:Math.random()*9,vx:0,vz:0,heal:true});
}
function dropGem(x,z,val){
  const slot=gems.find(g=>!g.active && !g.heal); if(!slot) return;
  slot.active=true; slot.x=x+(Math.random()-0.5)*1.2; slot.z=z+(Math.random()-0.5)*1.2; slot.val=val;
}
function dropHeal(x,z){
  const slot=gems.find(g=>!g.active && g.heal); if(!slot) return;
  slot.active=true; slot.x=x; slot.z=z;
}

/* ---------------- XP / level up ---------------- */
const xpNeed = n => Math.floor(6 + (n-1)*7 + Math.pow(n-1,1.55));
let pendingLus=0;
function gainXp(v){
  P.xp+=v;
  while(P.xp>=xpNeed(P.level)){ P.xp-=xpNeed(P.level); P.level++; pendingLus++; }
}

const STATS = {
  dmg:   {name:'데미지',    icon:'⚔️', max:5, desc:l=>`모든 무기 데미지 +20% (Lv${l+1})`},
  atk:   {name:'공격 속도', icon:'⏩', max:5, desc:l=>`무기 쿨다운 -12% (Lv${l+1})`},
  move:  {name:'이동 속도', icon:'👟', max:5, desc:l=>`이동 속도 +8% (Lv${l+1})`},
  magnet:{name:'자석 범위', icon:'🧲', max:5, desc:l=>`경험치 흡수 거리 +40% (Lv${l+1})`},
  hp:    {name:'최대 체력', icon:'❤️', max:8, desc:l=>`최대 체력 +20 & 회복 (Lv${l+1})`},
  jump:  {name:'점프력',   icon:'🦘', max:3, desc:l=>`점프 높이 +25% (Lv${l+1})`},
};
const statLvl={dmg:0,atk:0,move:0,magnet:0,hp:0,jump:0};

function rollUpgrades(){
  const pool=[];
  for(const id in WEAPONS){
    const lvl=owned[id]||0;
    if(lvl>=WEAPONS[id].maxLvl) continue;
    pool.push({kind:'w',id,lvl,isNew:lvl===0});
  }
  for(const id in STATS){
    if(statLvl[id]>=STATS[id].max) continue;
    pool.push({kind:'s',id,lvl:statLvl[id]});
  }
  // shuffle & take 3 (guarantee variety: prefer new weapons first)
  for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,3);
}
let luChoices=[];
function openLevelUp(){
  state='levelup'; luOpen=true;
  if(document.pointerLockElement) document.exitPointerLock();
  AudioSys.play('levelup',0.6);
  luChoices=rollUpgrades();
  luCards.innerHTML='';
  luChoices.forEach((c,i)=>{
    const el=document.createElement('div');
    el.className='card'+(c.isNew?' new':'');
    let ico,nm,ds;
    if(c.kind==='w'){ const w=WEAPONS[c.id]; ico=w.icon; nm=w.ko+' (Lv'+(c.lvl+1)+')'; ds=w.desc; }
    else { const s=STATS[c.id]; ico=s.icon; nm=s.name+' Lv'+(c.lvl+1); ds=s.desc(c.lvl); }
    el.innerHTML=`${c.isNew?'<span class="tag">NEW</span>':''}
      <div class="ico">${ico}</div><div class="nm">${nm}</div><div class="ds">${ds}</div>
      <div class="key">[${i+1}]</div>`;
    el.onclick=()=>pickUpgrade(i);
    luCards.appendChild(el);
  });
  luEl.classList.remove('hidden');
}
function pickUpgrade(i){
  const c=luChoices[i]; if(!c) return;
  AudioSys.play('ui',0.5);
  if(c.kind==='w'){ owned[c.id]=(owned[c.id]||0)+1; refreshWeaponFx(); }
  else {
    statLvl[c.id]++;
    if(c.id==='hp'){ P.maxHp+=20; P.hp=Math.min(P.maxHp,P.hp+20); }
  }
  updateWeaponBadges();
  luEl.classList.add('hidden'); luOpen=false;
  pendingLus--;
  if(pendingLus>0){ openLevelUp(); return; }
  state='playing';
  try{canvas.requestPointerLock().catch(()=>{})}catch(e){};
}

/* ---------------- weapon fx refresh / badges ---------------- */
function refreshWeaponFx(){
  if(knifeIM) knifeIM.count = owned.knife?5:0;
  if(auraIM) auraIM.count = owned.aura?8:0;
}
function updateWeaponBadges(){
  weaponsEl.innerHTML='';
  for(const id in owned){
    const b=document.createElement('div'); b.className='wbadge';
    b.innerHTML=`${WEAPONS[id].icon} ${WEAPONS[id].ko} <b>Lv${owned[id]}</b>`;
    weaponsEl.appendChild(b);
  }
  for(const id in statLvl) if(statLvl[id]>0){
    const b=document.createElement('div'); b.className='wbadge';
    b.innerHTML=`${STATS[id].icon} ${STATS[id].name} <b>Lv${statLvl[id]}</b>`;
    weaponsEl.appendChild(b);
  }
}

/* ---------------- fx flash ---------------- */
let flashT=0;
function flash(a){ flashT=Math.max(flashT,a); }

/* ---------------- game reset / start ---------------- */
function resetGame(){
  gameTime=0; kills=0; nextBossAt=90; pendingLus=0;
  Object.keys(owned).forEach(k=>delete owned[k]);
  for(const k in statLvl) statLvl[k]=0;
  dmgMul=1; atkSpdLvl=0; magnetBase=3.5;
  P.pos.set(0,0,0); P.velY=0; P.onGround=true; P.hp=100; P.maxHp=100; P.inv=0; P.yaw=0;
  for(const e of enemies){ e.alive=false; e.boss=false; }
  bossRef=null; if(bossBarEl) bossBarEl.style.display='none';
  for(const g of gems) g.active=false;
  fireData.length=0; beamData.length=0; sparkData.length=0; puffData.length=0;
  whipAnim=0; knifeAng=0; auraAng=0;
  owned.whip=1; refreshWeaponFx(); updateWeaponBadges();
  if(bossBarEl) bossBarEl.style.display='none';
}
async function startGame(){
  await AudioSys.init();
  if(AudioSys.ctx.state==='suspended') AudioSys.ctx.resume();
  AudioSys.startMusic();
  resetGame();
  buildPlayer();
  state='playing';
  menuEl.classList.add('hidden'); goEl.classList.add('hidden'); pauseEl.classList.add('hidden');
  hud.style.display='block';
  try{canvas.requestPointerLock().catch(()=>{})}catch(e){};
}

/* ---------------- main loop ---------------- */
const clock=new THREE.Clock();
let spawnT=0, hintT=8;
let idleT=0;
renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),0.05);
  if(state==='playing') update(dt);
  else if(state==='menu'||state==='over'){
    // slow cinematic orbit for menu / game over
    idleT+=dt*0.12; yaw=idleT; pitch=0.42+Math.sin(idleT*0.5)*0.06;
    const camDist=13, cp=Math.cos(pitch), sp=Math.sin(pitch);
    camera.position.lerp(new THREE.Vector3(-Math.sin(yaw)*cp*camDist, 2+sp*camDist, -Math.cos(yaw)*cp*camDist), Math.min(1,dt*2));
    camera.lookAt(0,1.5,0);
    if(window._lanternLights) for(const L of window._lanternLights){ L.ph+=dt*7; L.l.intensity=L.base*(0.8+0.2*Math.sin(L.ph)+0.1*Math.sin(L.ph*3.7)); }
  }
  renderFx(dt);
  renderer.render(scene,camera);
});

function update(dt){
  gameTime+=dt; hintT-=dt;
  if(hintT<0) hintEl.style.opacity=0;

  /* --- player movement --- */
  let ix=(keys.KeyD?1:0)-(keys.KeyA?1:0), iz=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  const il=Math.hypot(ix,iz); if(il>0){ix/=il;iz/=il;}
  // camera-relative movement: forward=(sin yaw, cos yaw), right=(-cos yaw, sin yaw)
  const cy=Math.cos(yaw), sy=Math.sin(yaw);
  const wx = -ix*cy + iz*sy, wz = ix*sy + iz*cy;
  const spd = P.speedBase*(1+0.08*statLvl.move);
  P.pos.x += wx*spd*dt; P.pos.z += wz*spd*dt;
  const rr=Math.hypot(P.pos.x,P.pos.z);
  if(rr>WORLD_R-2){ P.pos.x*=(WORLD_R-2)/rr; P.pos.z*=(WORLD_R-2)/rr; }

  // jump / gravity
  if(keys.Space && P.onGround){ P.velY=9.5*(1+0.25*statLvl.jump); P.onGround=false; AudioSys.play('ui',0.2,1.6); }
  if(!P.onGround){ P.velY-=24*dt; P.pos.y+=P.velY*dt; if(P.pos.y<=0){P.pos.y=0;P.velY=0;P.onGround=true;} }

  // face movement
  if(il>0){ const target=Math.atan2(wx,wz); let d=target-P.yaw; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; P.yaw+=d*Math.min(1,dt*12); }

  if(playerG){
    playerG.position.copy(P.pos);
    playerG.rotation.y=P.yaw;
    // walk anim: swing child parts
    const t=gameTime*11, amp=il>0?0.55:0;
    for(const ch of playerG.children){
      if(ch===playerBlob||ch===playerRing) continue;
      const nm=(ch.name||'').toLowerCase();
      if(nm.includes('left')&&nm.includes('leg')) ch.rotation.x=Math.sin(t)*amp;
      else if(nm.includes('right')&&nm.includes('leg')) ch.rotation.x=-Math.sin(t)*amp;
      else if(nm.includes('left')&&nm.includes('arm')) ch.rotation.x=-Math.sin(t)*amp*0.8;
      else if(nm.includes('right')&&nm.includes('arm')) ch.rotation.x=Math.sin(t)*amp*0.8;
    }
    // #3 shadow: stays on the floor (never jumps) and shrinks + fades as the player rises
    // blob/ring are children of g whose y = jump height, so offset local y by -P.pos.y to pin them to the floor
    if(playerBlob){
      const h=P.pos.y, k=Math.max(0.32, 1 - h*0.16);
      playerBlob.position.set(0, -h + 0.02, 0);
      playerBlob.scale.setScalar(k);
      playerBlob.material.opacity = 0.38*Math.max(0.35, k);
    }
    if(playerRing){
      const h=P.pos.y;
      playerRing.position.set(0, -h + 0.03, 0);
      playerRing.scale.setScalar(Math.max(0.4, 1 - h*0.12));
      playerRing.material.opacity = 0.85*Math.max(0.3, 1 - h*0.14);
    }
  }

  /* --- camera (direct follow: no lerp, so mouse view turns are crisp with zero swing/acceleration) --- */
  const camDist=9, cp=Math.cos(pitch), sp=Math.sin(pitch);
  const cx=P.pos.x - Math.sin(yaw)*cp*camDist, cyy=P.pos.y+1.6+sp*camDist, cz=P.pos.z - Math.cos(yaw)*cp*camDist;
  camera.position.set(cx,cyy,cz);
  camera.lookAt(P.pos.x, P.pos.y+1.7, P.pos.z);

  // shadow follow
  moon.position.set(P.pos.x-30,50,P.pos.z-20); moon.target.position.copy(P.pos); moon.target.updateMatrixWorld();

  // lantern flicker
  if(window._lanternLights) for(const L of window._lanternLights){ L.ph+=dt*7; L.l.intensity=L.base*(0.8+0.2*Math.sin(L.ph)+0.1*Math.sin(L.ph*3.7)); }

  /* --- spawning (VS-style curve: calm start, slow ramp, wall of death late) --- */
  spawnT-=dt;
  if(spawnT<=0){
    const t=gameTime;
    if(t<5){ spawnT=1; }            // grace period: field is empty
    else{
      // interval eases from ~2.8s (t=5) down to ~0.35s (t=240+)
      const k=Math.min(1,(t-5)/235);
      spawnT = 2.8 - 2.45*k;
      // batch grows slowly: 1 early, up to 4 late
      let batch = 1 + Math.floor((t-5)/45) + ((Math.random()*2)|0)* (t>60?1:0);
      if(t<20) batch=1;
      for(let i=0;i<batch;i++){
        const r=Math.random();
        let type='zombie';
        if(t>30 && r<0.25) type='skeleton';
        else if(t>75 && r<0.14) type='ghost';
        else if(t>160 && r<0.08) type='vampire';
        spawnEnemy(type);
      }
    }
  }
  if(gameTime>=nextBossAt){ nextBossAt+=90; spawnBoss(); }

  /* --- enemies update --- */
  rebuildGrid();
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];
    if(!e.alive){
      if(e.deadT>0){ e.deadT-=dt; }
      continue;
    }
    // seek player (horizontal)
    let dx=P.pos.x-e.x, dz=P.pos.z-e.z; const dist=Math.hypot(dx,dz)||1;
    dx/=dist; dz/=dist;
    let s=e.speed; if(dist<7) s*=1.25;
    e.vx+=dx*s*dt*6; e.vz+=dz*s*dt*6;
    // separation
    forEachNear(e.x,e.z,1.6,(o)=>{
      if(o===e) return;
      const ox=e.x-o.x, oz=e.z-o.z, od=Math.hypot(ox,oz);
      if(od>0.001 && od<1.4){ e.vx+=ox/od*8*dt; e.vz+=oz/od*8*dt; }
    });
    // kb decay
    e.vx*=Math.pow(0.02,dt); e.vz*=Math.pow(0.02,dt);
    const vmax=s*1.6; const vm=Math.hypot(e.vx,e.vz); if(vm>vmax){e.vx*=vmax/vm;e.vz*=vmax/vm;}
    e.x+=e.vx*dt; e.z+=e.vz*dt;

    // contact damage
    if(P.inv<=0 && dist<1.3 && Math.abs(P.pos.y-e.y)<2.2){
      P.hp-=e.dmg; P.inv=0.7; flash(0.8); AudioSys.play('hurt',0.6);
      // knock player back a bit
      P.pos.x+=dx*0.8; P.pos.z+=dz*0.8;
      if(P.hp<=0){ gameOver(); return; }
    }
    // cull far
    if(dist>WORLD_R+12){ e.alive=false; }
  }
  P.inv-=dt;

  /* --- weapons --- */
  tickWeapon('whip', dt, ()=>{
    whipAnim=0.3;
    const lvl=owned.whip, dmg=(15+4*lvl)*dmgMul, range=4.8+0.4*lvl;
    // auto-aim: swing toward nearest enemy in reach (VS-style), else face direction
    let dirx=Math.sin(P.yaw), dirz=Math.cos(P.yaw);
    let bd=1e9,bx=0,bz=0,found=false;
    forEachNear(P.pos.x,P.pos.z,range*1.25,(e)=>{
      const d=(e.x-P.pos.x)**2+(e.z-P.pos.z)**2; if(d<bd){bd=d;bx=e.x-P.pos.x;bz=e.z-P.pos.z;found=true;} });
    if(found){ const L=Math.hypot(bx,bz)||1; dirx=bx/L; dirz=bz/L; }
    whipAimYaw=Math.atan2(dirx,dirz);
    forEachNear(P.pos.x, P.pos.z, range, (e)=>{
      const ex=e.x-P.pos.x, ez=e.z-P.pos.z, ed=Math.hypot(ex,ez)||1;
      const dot=(ex/ed)*dirx+(ez/ed)*dirz;
      if(dot>-0.2) dealDamage(e,dmg,new THREE.Vector3(ex/ed*0.7,0,ez/ed*0.7));
    });
  });
  tickWeapon('fireball', dt, ()=>{
    // nearest enemy
    let best=null,bd=1e9;
    forEachNear(P.pos.x,P.pos.z,60,(e)=>{ const d=(e.x-P.pos.x)**2+(e.z-P.pos.z)**2; if(d<bd){bd=d;best=e;} });
    if(!best) return;
    let dx=best.x-P.pos.x, dz=best.z-P.pos.z; const d=Math.hypot(dx,dz)||1;
    fireFireball(new THREE.Vector3(dx/d,0,dz/d));
    AudioSys.play('shoot',0.4);
  });
  tickWeapon('knife', dt, ()=>{
    const lvl=owned.knife, dmg=(5+2*lvl)*dmgMul;
    forEachNear(P.pos.x,P.pos.z,2.6,(e)=>{ if(e.y<1.2) dealDamage(e,dmg,new THREE.Vector3()); });
  });
  tickWeapon('lightning', dt, strikeLightning);
  tickWeapon('aura', dt, ()=>{
    const lvl=owned.aura, dmg=(4+2*lvl)*dmgMul;
    forEachNear(P.pos.x,P.pos.z,2.9,(e)=>dealDamage(e,dmg,new THREE.Vector3()));
  });

  /* --- fireballs update --- */
  for(const f of fireData){
    if(!f.active) continue;
    f.life-=dt; f.x+=f.vx*dt; f.z+=f.vz*dt;
    forEachNear(f.x,f.z,1.2,(e)=>{
      const ex=e.x-f.x, ez=e.z-f.z;
      if(ex*ex+ez*ez<1.3 && Math.abs(e.y+0.5-1.5)<1.6){
        dealDamage(e,f.dmg,new THREE.Vector3(f.vx,0,f.vz).normalize());
        f.pierce--; if(f.pierce<0) f.active=false;
      }
    });
    if(f.life<=0 || Math.hypot(f.x-P.pos.x,f.z-P.pos.z)>70) f.active=false;
  }

  /* --- gems update --- */
  const mag=magnetBase*(1+0.4*statLvl.magnet);
  for(const g of gems){
    if(!g.active) continue;
    const dx=P.pos.x-g.x, dz=P.pos.z-g.z, d=Math.hypot(dx,dz)||1;
    if(d<mag){ g.vx+=dx/d*30*dt; g.vz+=dz/d*30*dt; } else { g.vx*=Math.pow(0.05,dt); g.vz*=Math.pow(0.05,dt); }
    g.x+=g.vx*dt; g.z+=g.vz*dt;
    if(d<1.1){
      g.active=false;
      if(g.heal){ P.hp=Math.min(P.maxHp,P.hp+25); AudioSys.play('gem',0.5,1.4); }
      else { gainXp(g.val); AudioSys.play('gem',0.3,1.2+Math.random()*0.4); }
    }
  }

  /* --- level up / hud --- */
  if(pendingLus>0){ openLevelUp(); return; }
  updateHud();
}

const wcd={};
function tickWeapon(id,dt,fire){
  if(!owned[id]) return;
  wcd[id]=(wcd[id]||0)-dt;
  if(wcd[id]<=0){ fire(); wcd[id]=weaponCd(id); }
}

/* ---------------- render fx (runs in all states) ---------------- */
const _m4=new THREE.Matrix4(), _q=new THREE.Quaternion(), _p=new THREE.Vector3(), _s=new THREE.Vector3();
let built=false;
function renderFx(dt){
  if(!built) return;
  // enemies — re-index each type contiguously so InstancedMesh actually draws them
  const perType = {};
  for(const t in enemyIM) perType[t]=0;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];
    if(!e.alive && !(e.deadT>0)) continue; // fully dead: skip (no instance slot)
    const im=enemyIM[e.type]; if(!im) continue;
    let sc=e.alive?e.scaleMul: (e.deadT>0 ? e.scaleMul*(e.deadT/0.28) : 0);
    let y=e.y;
    if(e.alive){
      if(e.type==='ghost') y=e.y+Math.sin(gameTime*3+e.phase)*0.3;
      else y+=Math.abs(Math.sin(gameTime*8+e.phase))*0.06*(e.speed>2?1:0.5);
    }
    _p.set(e.x,y,e.z);
    const face=e.alive?Math.atan2(P.pos.x-e.x,P.pos.z-e.z):0;
    _q.setFromEuler(new THREE.Euler(0,face,0));
    _s.setScalar(Math.max(0.0001,sc));
    _m4.compose(_p,_q,_s); im.setMatrixAt(perType[e.type],_m4);
    if(e.flash>0){ e.flash-=dt; const f=Math.min(1,e.flash/0.12); im.setColorAt(perType[e.type],_c.setRGB(1+f*1.5, 0.3+0.7*f, 0.3+0.7*f)); }
    else im.setColorAt(perType[e.type],_c.setRGB(1,1,1));
    perType[e.type]++;
  }
  for(const t in enemyIM){ const im=enemyIM[t]; im.count=perType[t]; im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; }

  // gems
  let gi=0;
  for(let i=0;i<gems.length;i++){
    const g=gems[i]; if(!g.active) continue;
    _p.set(g.x, 0.5+Math.sin(gameTime*4+g.ph)*0.15, g.z);
    _q.setFromEuler(new THREE.Euler(0,gameTime*2+g.ph,0));
    _s.setScalar(g.heal?1: (g.val>=8?1.3:1));
    _m4.compose(_p,_q,_s); gemIM.setMatrixAt(gi++,_m4);
  }
  gemIM.count=gi; gemIM.instanceMatrix.needsUpdate=true;

  let hi=0;
  for(let i=0;i<gems.length;i++){
    const g=gems[i]; if(!g.active||!g.heal) continue;
    _p.set(g.x,0.6+Math.sin(gameTime*5+g.ph)*0.2,g.z); _q.identity(); _s.setScalar(1);
    _m4.compose(_p,_q,_s); healIM.setMatrixAt(hi++,_m4);
  }
  healIM.count=hi; healIM.instanceMatrix.needsUpdate=true;

  // fireballs
  let fi=0;
  for(const f of fireData){ if(!f.active) continue;
    _p.set(f.x,1.5,f.z); _q.identity(); _s.setScalar(1+Math.random()*0.3);
    _m4.compose(_p,_q,_s); fireIM.setMatrixAt(fi++,_m4);
  }
  fireIM.count=fi; fireIM.instanceMatrix.needsUpdate=true;

  // lightning beams
  let bi=0;
  for(const b of beamData){ if(!b.active) continue;
    b.life-=dt; if(b.life<=0){b.active=false;continue;}
    _p.set(b.x,b.h/2+0.5,b.z); _q.identity(); _s.set(1+Math.random()*0.6,b.h,1+Math.random()*0.6);
    _m4.compose(_p,_q,_s); beamIM.setMatrixAt(bi++,_m4);
  }
  beamIM.count=bi; if(beamIM){beamIM.instanceMatrix.needsUpdate=true;}

  // sparks (billboard)
  let si=0;
  for(const s of sparkData){ if(!s.active) continue;
    s.life-=dt; if(s.life<=0){s.active=false;continue;}
    _p.set(s.x,s.y+ (0.25-s.life)*3, s.z); _q.copy(camera.quaternion); _s.setScalar(s.s*(s.life/0.25));
    _m4.compose(_p,_q,_s); sparkIM.setMatrixAt(si++,_m4);
  }
  sparkIM.count=si; if(sparkIM){sparkIM.instanceMatrix.needsUpdate=true;}

  // death puffs
  let pi=0;
  for(const p of puffData){ if(!p.active) continue;
    p.life-=dt; if(p.life<=0){p.active=false;continue;}
    const k=1-p.life/0.5; _p.set(p.x,p.y+k*1.2,p.z); _q.identity(); _s.setScalar(p.s*(0.6+k*2.2));
    _m4.compose(_p,_q,_s); puffIM.setMatrixAt(pi++,_m4);
  }
  puffIM.count=pi; if(puffIM){puffIM.instanceMatrix.needsUpdate=true;}

  // whip swing
  if(whipIM){
    if(whipAnim>0){
      whipAnim-=dt;
      const k=1-whipAnim/0.3;
      _p.set(P.pos.x+Math.sin(whipAimYaw)*1.2, P.pos.y+1.4, P.pos.z+Math.cos(whipAimYaw)*1.2);
      _q.setFromEuler(new THREE.Euler(0,whipAimYaw - 2.2 + k*3.6, Math.sin(k*Math.PI)*0.9));
      const sc=1.6*(1-k*0.4); _s.setScalar(sc);
      _m4.compose(_p,_q,_s); whipIM.setMatrixAt(0,_m4); whipIM.count=1;
    } else whipIM.count=0;
    whipIM.instanceMatrix.needsUpdate=true;
  }

  // orbit knives
  if(knifeIM && knifeIM.count>0){
    knifeAng+=dt*5.2;
    for(let i=0;i<5;i++){
      const a=knifeAng+i/5*Math.PI*2, r=2.1;
      _p.set(P.pos.x+Math.sin(a)*r, P.pos.y+1.3, P.pos.z+Math.cos(a)*r);
      _q.setFromEuler(new THREE.Euler(0,a+Math.PI/2,0)); _s.setScalar(1.1);
      _m4.compose(_p,_q,_s); knifeIM.setMatrixAt(i,_m4);
    }
    knifeIM.instanceMatrix.needsUpdate=true;
  }

  // blade aura
  if(auraIM && auraIM.count>0){
    auraAng-=dt*2.6;
    for(let i=0;i<8;i++){
      const a=auraAng+i/8*Math.PI*2, r=2.5;
      _p.set(P.pos.x+Math.sin(a)*r, P.pos.y+1.2, P.pos.z+Math.cos(a)*r);
      _q.setFromEuler(new THREE.Euler(0,a-Math.PI/2,0)); _s.setScalar(1.25);
      _m4.compose(_p,_q,_s); auraIM.setMatrixAt(i,_m4);
    }
    auraIM.instanceMatrix.needsUpdate=true;
  }

  // damage flash
  if(flashT>0){ flashT-=dt*2.2; flashEl.style.opacity=Math.max(0,flashT); } else flashEl.style.opacity=0;

  // boss bar
  if(bossRef && bossRef.alive && bossBarEl) bossBarEl._fill.style.width=(100*bossRef.hp/bossRef.maxHp)+'%';
}
const _c=new THREE.Color(), _cw=new THREE.Color(1,1,1);

/* ---------------- HUD ---------------- */
function updateHud(){
  xpbar.style.width=Math.min(100,100*P.xp/xpNeed(P.level))+'%';
  lvlEl.textContent='LV '+P.level;
  hpbar.style.width=Math.max(0,100*P.hp/P.maxHp)+'%';
  hptext.textContent=Math.ceil(Math.max(0,P.hp))+' / '+P.maxHp;
  const m=(gameTime/60)|0, s=(gameTime%60)|0;
  timerEl.textContent=m+':'+String(s).padStart(2,'0');
  killsEl.textContent='☠ '+kills;
}

/* ---------------- game over / restart ---------------- */
function gameOver(){
  state='over';
  if(document.pointerLockElement) document.exitPointerLock();
  AudioSys.stopMusic(); AudioSys.play('boom',0.9,0.5);
  $('go-time').textContent=timerEl.textContent;
  $('go-lvl').textContent=P.level;
  $('go-kills').textContent=kills;
  goEl.classList.remove('hidden');
}
function restart(){
  goEl.classList.add('hidden');
  resetGame(); buildPlayer();
  state='playing'; hud.style.display='block';
  try{canvas.requestPointerLock().catch(()=>{})}catch(e){};
}

/* ---------------- boot ---------------- */
$('startbtn').onclick=()=>startGame();
$('restartbtn').onclick=()=>restart();
// settings buttons (menu + pause) — same panel, reachable from both
$('settings-btn-menu').addEventListener('click', e=>{ e.stopPropagation(); openSettings(); });
$('settings-btn-pause').addEventListener('click', e=>{ e.stopPropagation(); openSettings(); });
(async function boot(){
  await prepModels();
  buildEnv();
  buildEnemies();
  buildGems();
  buildWeaponFx();
  built=true;
  window._diag = ()=>({playerG, enemyIM, M_keys:Object.keys(M), scene});
})();
