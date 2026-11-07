(function(){
 'use strict';
 let api,T,mode='none',session=null,pending=false,snapshot=null,rig=null,menu=null,arScene=null,stage=null,model=null,reticle=null,hitSource=null,viewerSpace=null,localSpace=null,previewCamera=null,placed=false,hitReady=false,floorSpace=true,snapHeld=false;
 let supported={vr:false,ar:false},scale=.006,turn=0,dragX=null;
 // VR play and AR hunting state
 let comfort={smooth:false,vignette:true};try{Object.assign(comfort,JSON.parse(localStorage.getItem('goa-vr-comfort-v1')||'{}'));}catch{}
 let vignette=null,turnRate=0;
 let vrPlay='look',prevBtn={},chaseYaw=0,rigYaw=0,seatOff=null,handWeapon=null,handItem='',wrist=null,wristT=0,driveIn=null,hunt=null;
 const controllers=[],clickable=[],$=id=>document.getElementById(id),point={x:0,y:0,z:0};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function message(text){$('xr-message').textContent=text;$('xr-overlay-message').textContent=text;}
 function dispose(object){object?.traverse(o=>{if(!o.userData.xrShared)o.geometry?.dispose();if(o.userData.xrOwned){for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(m?.userData?.xrOwnsMap)m.map?.dispose();m?.dispose();}}});}
 function own(mesh){mesh.userData.xrOwned=true;for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(m?.map?.isCanvasTexture)m.userData.xrOwnsMap=true;return mesh;}
 function panel(value){$('xr-panel').classList.toggle('open',value===undefined?!$('xr-panel').classList.contains('open'):value);if($('xr-panel').classList.contains('open')){api.clearInput();api.openSettings(false);window.GOALocations.close();window.GOAExtension.close();}}
 function save(){snapshot={parent:api.camera.parent,position:api.camera.position.clone(),quaternion:api.camera.quaternion.clone(),near:api.camera.near,far:api.camera.far,fov:api.camera.fov,clearColor:api.renderer.getClearColor(new T.Color()),clearAlpha:api.renderer.getClearAlpha()};api.clearInput();api.stop();api.openSettings(false);panel(false);document.body.classList.add('xr-active');$('xr-overlay').classList.add('active');}
 function restore(){
  try{hitSource?.cancel();}catch{}hitSource=null;viewerSpace=localSpace=null;hitReady=false;placed=false;
  if(vignette){api.camera.remove(vignette);dispose(vignette);vignette=null;}
  if(rig){rig.remove(api.camera);if(snapshot?.parent)snapshot.parent.add(api.camera);api.scene.remove(rig);for(const c of controllers)rig.remove(c);if(menu){rig.remove(menu);dispose(menu);}rig=null;menu=null;clickable.length=0;}
  if(arScene){if(model){stage?.remove(model);dispose(model);}arScene.remove(stage,reticle);dispose(reticle);arScene=null;stage=model=reticle=previewCamera=null;}
  if(snapshot){api.camera.position.copy(snapshot.position);api.camera.quaternion.copy(snapshot.quaternion);api.camera.near=snapshot.near;api.camera.far=snapshot.far;api.camera.fov=snapshot.fov;api.camera.updateProjectionMatrix();api.renderer.setClearColor(snapshot.clearColor,snapshot.clearAlpha);snapshot=null;}
  if(handWeapon){handWeapon.parent?.remove(handWeapon);handWeapon=null;handItem='';}if(wrist){wrist.parent?.remove(wrist);wrist=null;}if(hunt){$('xr-hunt').classList.remove('on');hunt=null;}
  vrPlay='look';driveIn=null;seatOff=null;prevBtn={};
  mode='none';session=null;pending=false;document.body.classList.remove('xr-active');$('xr-overlay').classList.remove('active');api.clearInput();api.restoreView();api.openSettings(true);probe();
 }
 async function end(){if(session){try{await session.end();}catch{restore();}}else restore();}
 async function probe(){
  supported={vr:false,ar:false};
  if(!window.isSecureContext){message('VR and AR need HTTPS or localhost. The tabletop preview is available below.');}
  else if(!navigator.xr){message('This browser does not expose WebXR. Use the tabletop preview, or open the game in a compatible headset or AR browser.');}
  else {const results=await Promise.allSettled([navigator.xr.isSessionSupported('immersive-vr'),navigator.xr.isSessionSupported('immersive-ar')]);supported.vr=results[0].status==='fulfilled'&&results[0].value;supported.ar=results[1].status==='fulfilled'&&results[1].value;message(supported.vr||supported.ar?'Supported modes are ready. Choose Enter VR or Enter AR.':'No immersive headset or AR session is available in this browser. You can still try the tabletop preview.');}
  $('xr-vr').disabled=!supported.vr||pending;$('xr-ar').disabled=!supported.ar||pending;$('xr-arhunt').disabled=!supported.ar||pending;$('xr-arhunt').textContent=supported.ar?'Hunt in AR':'AR unavailable';$('xr-vr').textContent=supported.vr?'Enter VR':'VR unavailable';$('xr-ar').textContent=supported.ar?'Enter AR':'AR unavailable';
 }
 function drawButton(c,text){const g=c.getContext('2d');g.fillStyle='#213b2d';g.fillRect(0,0,768,128);g.strokeStyle='#d8c493';g.lineWidth=8;g.strokeRect(4,4,760,120);g.fillStyle='#f0eddf';g.textAlign='center';g.textBaseline='middle';g.font='bold 37px sans-serif';g.fillText(text,384,64);}
 function button3D(text,y,action){const c=document.createElement('canvas');c.width=768;c.height=128;drawButton(c,text);const texture=new T.CanvasTexture(c),mesh=own(new T.Mesh(new T.PlaneGeometry(1.15,.19),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide})));mesh.position.set(0,y,-2);mesh.userData.action=action;mesh.userData.relabel=(t)=>{drawButton(c,t);texture.needsUpdate=true;};menu.add(mesh);clickable.push(mesh);return mesh;}
 const turnLabel=()=>'Turning: '+(comfort.smooth?'smooth':'snap 30°'),vigLabel=()=>'Comfort vignette: '+(comfort.vignette?'on':'off');
 function saveComfort(){try{localStorage.setItem('goa-vr-comfort-v1',JSON.stringify(comfort));}catch{}}
 function positionRig(){const s=api.S;rig.position.set(s.x+Math.cos(s.yaw)*5,api.groundY(s.x+Math.cos(s.yaw)*5,s.z-Math.sin(s.yaw)*5)+(floorSpace?0:1.65),s.z-Math.sin(s.yaw)*5);rig.rotation.y=s.yaw+Math.PI;api.camera.position.set(0,0,0);api.camera.quaternion.identity();}
 function viewpoint(id){if(mode!=='vr')return;api.travel(id);api.clearInput();positionRig();message('VR lookout: '+window.GOALocations.list().find(p=>p.id===id).name+'. Trigger selects menu buttons; grip exits.');}
 function buildVR(){
  rig=new T.Group();rig.name='VR viewer origin';api.scene.add(rig);rig.add(api.camera);api.camera.near=.05;api.camera.updateProjectionMatrix();positionRig();
  menu=new T.Group();rig.add(menu);
  button3D('Drive · chase view',2.2,()=>setVRPlay('drive-chase'));button3D('Drive · driver seat',1.98,()=>setVRPlay('drive-seat'));button3D('Walk & hunt on foot',1.76,()=>setVRPlay('walk'));button3D('Lookout (paused)',1.54,()=>setVRPlay('look'));
  const tb=button3D(turnLabel(),1.28,()=>{comfort.smooth=!comfort.smooth;saveComfort();tb.userData.relabel(turnLabel());});
  const vb=button3D(vigLabel(),1.06,()=>{comfort.vignette=!comfort.vignette;saveComfort();vb.userData.relabel(vigLabel());});
  button3D('River Valley',.84,()=>viewpoint('river-valley'));button3D('Snowy Mountain',.62,()=>viewpoint('snowy-mountain'));button3D('Exit VR',.40,end);
  vignette=own(new T.Mesh(new T.RingGeometry(.15,.9,48,1),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false})));vignette.position.z=-.3;vignette.renderOrder=999;vignette.visible=false;api.camera.add(vignette);
  wrist=makeWrist();
  for(const c of controllers){rig.add(c);c.visible=true;}
 }
 function ray(controller){controller.updateWorldMatrix(true,false);const origin=new T.Vector3().setFromMatrixPosition(controller.matrixWorld),rotation=new T.Matrix4().extractRotation(controller.matrixWorld),direction=new T.Vector3(0,0,-1).applyMatrix4(rotation),caster=new T.Raycaster(origin,direction,0,6);return caster.intersectObjects(clickable,false)[0];}
 function makeTabletop(){
  const s=api.S,half=64,segments=40,geometry=new T.PlaneGeometry(half*2,half*2,segments,segments);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position,uv=geometry.attributes.uv,colors=[],base=api.groundY(s.x,s.z),snow=api.snow()>.5;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),worldX=s.x+x,worldZ=s.z+z,y=api.groundY(worldX,worldZ);pos.setY(i,(y-base)*.5);uv.setXY(i,worldX/5,worldZ/5);const q=api.nearestRoad(worldX,worldZ,{}),onRoad=q.road>=0&&q.d<q.hw;const color=new T.Color(snow?(onRoad?'#c2d3dc':'#e6eeee'):(onRoad?(q.road===0?'#77766d':'#9e8b69'):'#688253'));colors.push(color.r,color.g,color.b);}
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const group=new T.Group();group.name='Current location tabletop';const material=new T.MeshStandardMaterial({map:snow?api.TX.snow:api.TX.gG,vertexColors:true,roughness:.95,side:T.DoubleSide});group.add(own(new T.Mesh(geometry,material)));
  for(const road of api.ROADS){const vertices=[];for(let i=0;i<road.pts.length-2;i+=2){const a=api.roadFrame(road,i),b=api.roadFrame(road,i+2);if(Math.abs(a.p.x-s.x)>half-6||Math.abs(a.p.z-s.z)>half-6||Math.abs(b.p.x-s.x)>half-6||Math.abs(b.p.z-s.z)>half-6)continue;const p=(f,side,index)=>[f.p.x-s.x+f.nx*road.hw*side,(road.y[index]-base)*.5+.15,f.p.z-s.z+f.nz*road.hw*side];vertices.push(...p(a,-1,i),...p(b,-1,i+2),...p(a,1,i),...p(a,1,i),...p(b,-1,i+2),...p(b,1,i+2));}if(vertices.length){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();group.add(own(new T.Mesh(geo,new T.MeshStandardMaterial({color:snow?'#d5dfe5':road.id===0?'#686b67':'#a58d65',roughness:.95,side:T.DoubleSide}))));}}
  // Separate local water tiles stay level while the terrain relief is compressed.
  const waterGeo=new T.BufferGeometry(),waterVertices=[];for(let x=-half;x<half;x+=4)for(let z=-half;z<half;z+=4){if(api.terrainH(s.x+x+2,s.z+z+2)>api.WATER)continue;const y=(api.WATER-base)*.5+.03;waterVertices.push(x,y,z,x,y,z+4,x+4,y,z,x+4,y,z,x,y,z+4,x+4,y,z+4);}if(waterVertices.length){waterGeo.setAttribute('position',new T.Float32BufferAttribute(waterVertices,3));waterGeo.computeVertexNormals();group.add(own(new T.Mesh(waterGeo,new T.MeshStandardMaterial({color:snow?'#a5c0cb':'#346d68',roughness:.28,metalness:.15,side:T.DoubleSide}))));}
  const md=api.treeModel();if(md){const spots=[];let seed=88;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let n=0;n<240&&spots.length<35;n++){const x=(random()-.5)*118,z=(random()-.5)*118,y=api.terrainH(s.x+x,s.z+z),q=api.nearestRoad(s.x+x,s.z+z,{});if(y<api.WATER+1||(q.road>=0&&q.d<q.hw+5))continue;spots.push({x,z,y:(y-base)*.5,h:10+random()*10,a:random()*6.28});}const grove=new T.InstancedMesh(md.geo,md.mat,spots.length),dummy=new T.Object3D();spots.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.a;dummy.scale.setScalar(p.h);dummy.updateMatrix();grove.setMatrixAt(i,dummy.matrix);});grove.userData.xrShared=true;group.add(grove);}
  const vehicle=api.vehicle();if(vehicle){const clone=vehicle.clone(true);clone.position.set(0,0,0);clone.rotation.y+=api.S.yaw;clone.traverse(o=>o.userData.xrShared=true);group.add(clone);}
  const items=window.GOAExtension.getLoadout()?.campingIds||[];const camp=window.GOACamp.create(T,items);camp.position.set(7,(api.groundY(s.x+7,s.z)-base)*.5,0);camp.traverse(o=>{if(o.isMesh)own(o);if(o.isLight){o.intensity*=scale*scale;o.distance*=scale;}});group.add(camp);
  group.scale.setScalar(scale);group.rotation.y=turn;return group;
 }
 function buildAR(preview=false){
  arScene=new T.Scene();if(preview)arScene.background=new T.Color('#17271d');arScene.add(new T.HemisphereLight('#e8f2ee','#51683c',1.5));const light=new T.DirectionalLight('#fff0e0',1.8);light.position.set(2,4,1);arScene.add(light);
  stage=new T.Group();stage.matrixAutoUpdate=false;stage.visible=preview;arScene.add(stage);model=makeTabletop();stage.add(model);placed=preview;
  reticle=own(new T.Mesh(new T.RingGeometry(.065,.085,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#dbc48b',side:T.DoubleSide})));reticle.matrixAutoUpdate=false;reticle.visible=false;arScene.add(reticle);
  previewCamera=new T.PerspectiveCamera(45,innerWidth/innerHeight,.01,20);previewCamera.position.set(.6,.65,.95);previewCamera.lookAt(0,.05,0);
  if(!preview){api.camera.near=.01;api.camera.far=40;api.camera.position.set(0,0,0);api.camera.quaternion.identity();api.camera.updateProjectionMatrix();api.renderer.setClearColor(0x000000,0);}
 }
 function place(forceAhead=false){if(mode!=='ar'||!stage)return;if(hitReady){stage.matrix.copy(reticle.matrix);}else if((forceAhead||!hitSource)&&localSpace&&session){const xrCamera=api.renderer.xr.getCamera();const position=new T.Vector3(),direction=new T.Vector3();xrCamera.getWorldPosition(position);xrCamera.getWorldDirection(direction);direction.y=0;direction.normalize();position.addScaledVector(direction,.8);position.y-=.45;stage.matrix.compose(position,new T.Quaternion(),new T.Vector3(1,1,1));}else {message('Move the device slowly until the gold placement ring appears, or use Place ahead.');return;}stage.visible=true;placed=true;message('Tabletop placed. Rotate or resize it below. Tap another surface to reposition.');}
 async function start(kind){
  if(pending||mode!=='none')return;pending=true;$('xr-vr').disabled=$('xr-ar').disabled=true;
  try{
   if(kind==='preview'){save();mode='preview';$('xr-overlay').dataset.mode=mode;buildAR(true);message('Tabletop preview: drag to rotate, or use the scale and rotation controls.');pending=false;return;}
   // Request occurs directly in the user click handler, before any other awaited operation.
   const acquired=await navigator.xr.requestSession(kind==='vr'?'immersive-vr':'immersive-ar',{optionalFeatures:kind==='vr'?['local-floor']:['local-floor','hit-test','dom-overlay'],...(kind!=='vr'?{domOverlay:{root:$('xr-overlay')}}:{})});session=acquired;
   session.addEventListener('end',restore,{once:true});save();mode='starting';$('xr-overlay').dataset.mode=kind;
   floorSpace=true;try{localSpace=await session.requestReferenceSpace('local-floor');}catch{floorSpace=false;localSpace=await session.requestReferenceSpace('local');}
   if(session!==acquired)return;
   api.renderer.xr.setReferenceSpaceType(floorSpace?'local-floor':'local');
   if(kind==='vr')buildVR();else if(kind==='arhunt')buildHunt();else buildAR(false);
   await api.renderer.xr.setSession(session);if(session!==acquired)return;mode=kind;
   if(kind==='arhunt'){try{viewerSpace=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:viewerSpace});message('Hunt in AR: move slowly until the gold ring appears on the floor, then tap to release the animals.');}catch{hitSource=null;message('Surface detection is unavailable. Tap to release the animals a few steps ahead.');}session.addEventListener('select',huntSelect);}
   else if(kind==='vr'){setVRPlay('look');}
   if(kind==='ar'){try{viewerSpace=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:viewerSpace});message('Move your device slowly. Tap when a gold ring appears to place the tabletop.');}catch{hitSource=null;message('Surface detection is unavailable. Tap Place ahead to position the tabletop in front of you.');}session.addEventListener('select',()=>place(false));}
   if(kind==='vr')message('VR: point at the menu and pull the trigger. Choose Drive or Walk & hunt. B/Y shows or hides the menu.');
  }catch(error){const failed=session;if(failed){try{await failed.end();}catch{}}if(snapshot)restore();else{session=null;mode='none';pending=false;}await probe();message(error?.name==='NotAllowedError'?'XR permission was declined. You can try again or use the tabletop preview.':'Could not start this XR mode. Check the headset/browser connection or use the tabletop preview.');}
  finally{pending=false;}
 }
 function frame(dt,time,xrFrame){
  if(mode==='vr'&&vrPlay!=='look'){playFrame(dt,time);api.renderer.render(api.scene,api.camera);return;}
  if(mode==='arhunt'){huntFrame(dt,time,xrFrame);api.renderer.render(arScene,api.camera);return;}
  if(mode==='vr'){
   const inp=readXR();if(edge('menuR',inp.right.b)){menu.visible=!menu.visible;}
   api.tickVR(dt,time);let axis=0;for(const source of session?.inputSources||[]){const axes=source.gamepad?.axes;if(!axes)continue;const x=axes.length>2?axes[2]:axes[0];if(Math.abs(x)>Math.abs(axis))axis=x;}
   if(Math.abs(axis)>.65&&!snapHeld){rig.rotation.y-=Math.sign(axis)*Math.PI/6;snapHeld=true;}else if(Math.abs(axis)<.25)snapHeld=false;
   api.renderer.render(api.scene,api.camera);return;
  }
  if(mode==='ar'){
   if(hitSource&&xrFrame){const results=xrFrame.getHitTestResults(hitSource),pose=results[0]?.getPose(api.renderer.xr.getReferenceSpace());hitReady=!!pose;reticle.visible=!!pose;if(pose)reticle.matrix.fromArray(pose.transform.matrix);}
   api.renderer.render(arScene,api.camera);return;
  }
  if(mode==='preview'){previewCamera.aspect=innerWidth/innerHeight;previewCamera.updateProjectionMatrix();api.renderer.render(arScene,previewCamera);}
 }
 function init(hooks){api=hooks;T=window.THREE;api.renderer.xr.enabled=true;api.renderer.xr.setFoveation(1);
  const chip=document.createElement('button');chip.className='chip';chip.textContent='VR / AR';chip.onclick=()=>panel();$('tools').prepend(chip);
  const pauseButton=document.createElement('button');pauseButton.className='btn';pauseButton.textContent='VR / AR';pauseButton.onclick=()=>panel(true);$('settings').querySelector('.sethead').insertBefore(pauseButton,$('setclose'));
  const el=document.createElement('section');el.id='xr-panel';el.className='sheet card';el.setAttribute('role','dialog');el.setAttribute('aria-label','VR and AR modes');el.innerHTML='<div class="sethead"><b>STEP INTO THE OUTDOORS</b><button id="xr-close" class="btn">Close</button></div><div class="xr-content"><h3>Virtual reality: drive, walk and hunt</h3><p>Drive with your controllers (right trigger gas, left trigger brake, left stick steer, right grip handbrake, A nitro, X reset) from a chase view or the driver’s seat. Or step out and walk the valley: left stick moves, right stick snap-turns, right trigger fires or casts, A interacts, X reloads, Y switches item. B shows the menu.</p><button class="btn dark" id="xr-vr" disabled>Checking VR…</button><h3>Hunt in augmented reality</h3><p>Deer, elk, foxes, hares, coyotes and bears roam your real floor through your phone or headset. Tap the screen (or pull the trigger) to fire at the crosshair with your outfitter weapon.</p><button class="btn dark" id="xr-arhunt" disabled>Checking AR…</button><h3>Augmented reality tabletop</h3><p>Place a miniature of your current location, vehicle, forest and packed camp items on a real surface. AR uses camera passthrough provided by a compatible device and browser.</p><button class="btn dark" id="xr-ar" disabled>Checking AR…</button><h3>Try the tabletop without a headset</h3><p>The desktop preview uses the same miniature scene. Drag to rotate, or use the screen controls.</p><button class="btn" id="xr-preview">Preview tabletop</button><button class="btn" id="xr-check">Check devices again</button><p id="xr-message" role="status">Checking XR support…</p><small>Immersive modes require HTTPS, browser permission and compatible hardware. The game does not record or upload camera video. Use your device’s system exit control at any time.</small></div>';
  document.body.append(el);const overlay=document.createElement('div');overlay.id='xr-overlay';overlay.innerHTML='<div id="xr-hunt"><i></i><b id="xr-hunt-score"></b><div><button id="xr-hunt-small">Smaller</button><button id="xr-hunt-big">Larger</button><button id="xr-hunt-life">Life size</button></div></div><div id="xr-overlay-message" role="status"></div><div class="xr-controls"><button id="xr-place">Place ahead / reposition</button><button id="xr-turn-left">↶ Rotate</button><button id="xr-turn-right">Rotate ↷</button><label>Size <input id="xr-scale" type="range" min="0.003" max="0.012" step="0.001" value="0.006"></label><button id="xr-exit">Exit XR / preview</button></div>';document.body.append(overlay);
  overlay.addEventListener('beforexrselect',event=>{if(event.target.closest('button,input,label'))event.preventDefault();});
  $('xr-close').onclick=()=>panel(false);$('xr-vr').onclick=()=>start('vr');$('xr-ar').onclick=()=>start('ar');$('xr-arhunt').onclick=()=>start('arhunt');$('xr-preview').onclick=()=>start('preview');$('xr-check').onclick=probe;$('xr-hunt-small').onclick=()=>huntScale(.7);$('xr-hunt-big').onclick=()=>huntScale(1.4);$('xr-hunt-life').onclick=()=>huntScale(0);$('xr-exit').onclick=end;$('xr-place').onclick=()=>place(true);
  function rotate(angle){turn+=angle;if(model)model.rotation.y=turn;}
  $('xr-turn-left').onclick=()=>rotate(Math.PI/6);$('xr-turn-right').onclick=()=>rotate(-Math.PI/6);$('xr-scale').oninput=event=>{scale=Number(event.target.value);model?.scale.setScalar(scale);};
  api.renderer.domElement.addEventListener('pointerdown',event=>{if(mode==='preview'){dragX=event.clientX;api.renderer.domElement.setPointerCapture(event.pointerId);}});api.renderer.domElement.addEventListener('pointermove',event=>{if(mode==='preview'&&dragX!==null){rotate((event.clientX-dragX)*.008);dragX=event.clientX;}});api.renderer.domElement.addEventListener('pointerup',()=>dragX=null);api.renderer.domElement.addEventListener('pointercancel',()=>dragX=null);
  for(let i=0;i<2;i++){const controller=api.renderer.xr.getController(i),line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-5)]),new T.LineBasicMaterial({color:'#e3cc93'}));controller.add(line);controller.addEventListener('selectstart',()=>{if(mode==='vr'&&menu?.visible)ray(controller)?.object.userData.action?.();});controller.addEventListener('squeezestart',()=>{if(mode==='ar'||mode==='arhunt')end();});controller.addEventListener('connected',e=>{controller.userData.hand=e.data?.handedness||'';});controller.addEventListener('disconnected',()=>{controller.userData.hand='';});controllers.push(controller);}
  addEventListener('keydown',event=>{if(event.code==='Escape'&&mode==='preview'){event.preventDefault();end();}});navigator.xr?.addEventListener('devicechange',probe);probe();
 }

 // ---------------------------------------------------------------- VR play: driving and walking
 function readXR(){const out={left:{x:0,y:0,trig:0,grip:0,a:false,b:false,stick:false},right:{x:0,y:0,trig:0,grip:0,a:false,b:false,stick:false}};
  for(const src of session?.inputSources||[]){const g=src.gamepad;if(!g)continue;const h=src.handedness==='left'?'left':'right',ax=g.axes||[],dz=v=>Math.abs(v||0)<.15?0:v;
   out[h]={x:dz(ax.length>2?ax[2]:ax[0]),y:dz(ax.length>2?ax[3]:ax[1]),trig:g.buttons[0]?.value||0,grip:g.buttons[1]?.value||0,stick:!!g.buttons[3]?.pressed,a:!!g.buttons[4]?.pressed,b:!!g.buttons[5]?.pressed};}
  return out;}
 function edge(key,val){const was=!!prevBtn[key];prevBtn[key]=!!val;return !!val&&!was;}
 function hand(name){return controllers.find(c=>c.userData.hand===name)||controllers[name==='left'?0:1];}
 function setVRPlay(m){
  const P=api.player?.();vrPlay=m;menu.visible=m==='look';seatOff=null;
  if(m.startsWith('drive')){if(P?.onFoot())P.enterVehicle(true);if(window.GOASurvival?.noVehicle?.()){vrPlay='walk';message('Survival: the truck will not start. Walking instead.');return setVRPlay('walk');}chaseYaw=api.S.yaw;api.S.ctrl=true;message((m==='drive-seat'?'Driver seat. Right stick click recentres your view. ':'Chase view. ')+'Right trigger gas, left trigger brake, either stick steers. Y steps out, B shows the menu.');}
  else if(m==='walk'){if(!P?.onFoot()){api.S.vx=api.S.vz=0;api.S.air=false;P?.exitVehicle();}rigYaw=P?.state.camYaw??api.S.yaw;message('On foot. Left stick walks (click it to sprint), right stick turns, right trigger fires, A interacts or gets in the truck, B opens the menu.');}
  else positionRig();
  updateHandItem(true);
 }
 function headYaw(){const d=new T.Vector3();api.camera.getWorldDirection(d);return Math.atan2(d.x,d.z);}
 function playFrame(dt,time){
  const inp=readXR(),S=api.S,P=api.player?.();
  if(edge('menuR',inp.right.b))menu.visible=!menu.visible;
  const headH=floorSpace?1.35:0;
  if(vrPlay.startsWith('drive')){
   const st=Math.abs(inp.left.x)>=Math.abs(inp.right.x)?inp.left.x:inp.right.x;
   driveIn=menu.visible?{throttle:0,brake:.5,steer:0,handbrake:0,nitro:0}:{throttle:Math.max(inp.right.trig,-Math.min(0,inp.right.y)),brake:Math.max(inp.left.trig,Math.max(0,inp.right.y)),steer:clamp(st,-1,1),handbrake:inp.right.grip>.55?1:0,nitro:inp.right.a?1:0};
   if(edge('outY',inp.left.b)&&!menu.visible){if(Math.hypot(S.vx,S.vz)>1.5)message('Stop the vehicle to step out.');else return setVRPlay('walk');}
   api.physicsStep(dt);driveIn=null;
   if(edge('resetX',inp.left.a))api.resetCar?.();
   if(vrPlay==='drive-chase'){
    let d=S.yaw-chaseYaw;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;chaseYaw+=d*Math.min(1,dt*2.4);
    const bx=S.x-Math.sin(chaseYaw)*7.5,bz=S.z-Math.cos(chaseYaw)*7.5;
    rig.position.set(bx,Math.max(S.y+2.7,api.groundY(bx,bz)+1.2)-headH,bz);rig.rotation.y=chaseYaw+Math.PI;
   }else{
    if(!seatOff||edge('recentre',inp.right.stick))seatOff={x:api.camera.position.x,z:api.camera.position.z};
    const fx=Math.sin(S.yaw),fz=Math.cos(S.yaw),rx=-Math.cos(S.yaw),rz=Math.sin(S.yaw),side=-0.38,fwd=0.1;
    rig.rotation.y=S.yaw+Math.PI;
    const c=Math.cos(rig.rotation.y),sn=Math.sin(rig.rotation.y),ox=seatOff.x*c+seatOff.z*sn,oz=-seatOff.x*sn+seatOff.z*c;
    rig.position.set(S.x+rx*side+fx*fwd-ox,S.y+1.3-headH,S.z+rz*side+fz*fwd-oz);
   }
  }else if(vrPlay==='walk'&&P){
   if(!P.onFoot()){setVRPlay('drive-seat');return;} // A on the "Drive" prompt put you in the truck
   turnRate=0;
   if(comfort.smooth){if(Math.abs(inp.right.x)>.2){turnRate=inp.right.x*2.2;rigYaw-=turnRate*dt;}}
   else if(Math.abs(inp.right.x)>.65&&!prevBtn.snap){rigYaw-=Math.sign(inp.right.x)*Math.PI/6;prevBtn.snap=true;}else if(Math.abs(inp.right.x)<.25)prevBtn.snap=false;
   if(edge('sprint',inp.left.stick))prevBtn.sprintOn=!prevBtn.sprintOn;if(Math.hypot(inp.left.x,inp.left.y)<.2)prevBtn.sprintOn=false;
   const rc=hand('right'),o=new T.Vector3(),d=new T.Vector3(0,0,-1);rc.updateWorldMatrix(true,false);o.setFromMatrixPosition(rc.matrixWorld);d.applyMatrix4(new T.Matrix4().extractRotation(rc.matrixWorld));
   P.updateXR(dt,{mx:inp.left.x,mz:-inp.left.y,run:!!prevBtn.sprintOn,yaw:headYaw(),fire:!menu.visible&&edge('fire',inp.right.trig>.6),fireHeld:inp.right.trig>.5,interact:edge('interact',inp.right.a),reload:edge('reload',inp.left.a),cycle:edge('cycle',inp.left.b),rayO:o,rayD:d});
   const ps=P.position();rig.position.set(ps.x,ps.y+(floorSpace?0:1.6),ps.z);rig.rotation.y=rigYaw;
   updateHandItem(false);
  }
  if(vignette){const sp=vrPlay==='walk'&&P?Math.min(1,P.state.speed/3)+Math.min(1,Math.abs(turnRate)/2):vrPlay==='drive-seat'?Math.min(1,Math.abs(S.w||0)*.8):0;const target=comfort.vignette?Math.min(.85,sp*.8):0;vignette.material.opacity+=(target-vignette.material.opacity)*Math.min(1,dt*6);vignette.visible=vignette.material.opacity>.02;}
  api.tickVR(dt,time);
  wristT-=dt;if(wristT<=0){wristT=.25;drawWrist();}
 }
 function updateHandItem(force){
  const P=api.player?.(),item=vrPlay==='walk'&&P?.onFoot()?P.current():'';
  if(!force&&item===handItem)return;handItem=item;
  if(handWeapon){handWeapon.parent?.remove(handWeapon);handWeapon=null;}
  if(!item)return;
  handWeapon=window.GOAWeapons?.STATS[item]?window.GOAWeapons.build(item):item==='rod'?window.GOAFishing?.rodModel?.():null;
  if(handWeapon){handWeapon.rotation.set(0,Math.PI,0);handWeapon.position.set(0,-.04,.12);hand('right').add(handWeapon);}
 }
 function makeWrist(){
  const c=document.createElement('canvas');c.width=512;c.height=256;const tex=new T.CanvasTexture(c);
  const m=own(new T.Mesh(new T.PlaneGeometry(.2,.1),new T.MeshBasicMaterial({map:tex,transparent:true})));m.position.set(0,.06,.05);m.rotation.x=-1.0;m.userData.canvas=c;m.userData.tex=tex;
  hand('left').add(m);return m;
 }
 function drawWrist(){
  if(!wrist)return;const c=wrist.userData.canvas,g=c.getContext('2d'),P=api.player?.();g.clearRect(0,0,512,256);
  g.fillStyle='rgba(24,34,26,.85)';g.fillRect(0,0,512,256);g.fillStyle='#f0eddf';g.font='bold 34px sans-serif';
  if(vrPlay.startsWith('drive')){g.fillText(`${Math.round(Math.hypot(api.S.vx,api.S.vz)*3.6)} km/h`,24,64);g.font='26px sans-serif';g.fillText('RT gas · LT brake · either stick steers',24,120);g.fillText('Grip handbrake · A nitro · X reset',24,160);g.fillText('Y step out · B menu',24,200);}
  else if(P){const id=P.current(),st=window.GOAWeapons?.STATS[id];g.fillText(st?(window.GOAExtension?.weaponName?.(id)||id):id==='rod'?'Fishing rod':'Hunting knife',24,56);
   g.font='28px sans-serif';g.fillText(st?`${P.inv.mags[id]||0}/${st.mag}  ·  ${P.inv.ammo[st.family]} spare`:id==='rod'?(window.GOAFishing?.status?.()||''):'',24,100);
   g.fillStyle='#e0644a';g.fillRect(24,122,P.state.health*4.4,14);
   const sv=window.GOASurvival?.state;if(window.GOASurvival?.active?.()){g.fillStyle='#d9b44a';g.fillRect(24,144,sv.hunger*4.4,10);g.fillStyle='#5fa8d8';g.fillRect(24,160,sv.thirst*4.4,10);g.fillStyle='#e08a4a';g.fillRect(24,176,sv.warmth*4.4,10);}
   g.fillStyle='#ffd28a';g.font='26px sans-serif';const f=P.focusLabel();if(f)g.fillText('A: '+f,24,226);}
  wrist.userData.tex.needsUpdate=true;
 }
 // ---------------------------------------------------------------- AR hunting
 const HUNT_KINDS=['deer','elk','fox','rabbit','coyote','bear'];
 function buildHunt(){
  arScene=new T.Scene();arScene.add(new T.HemisphereLight('#f4f1e8','#5b5242',2.2));const sun=new T.DirectionalLight('#fff3df',2.2);sun.position.set(1,3,2);arScene.add(sun);
  reticle=own(new T.Mesh(new T.RingGeometry(.12,.16,32).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#e8b53a'})));reticle.matrixAutoUpdate=false;reticle.visible=false;arScene.add(reticle);
  stage=new T.Group();arScene.add(stage);
  api.renderer.setClearColor(0x000000,0);
  hunt={anchor:null,k:.35,animals:[],score:0,shots:0,fireT:0,flash:null};
  hunt.flash=new T.PointLight('#ffcf8a',0,4,2);arScene.add(hunt.flash);
  $('xr-hunt').classList.add('on');huntHud();
 }
 function huntHud(){if(!hunt)return;$('xr-hunt-score').textContent=hunt.anchor?`Harvested ${hunt.score} · shots ${hunt.shots} · tap to fire at the crosshair`:'Point at the floor and tap to release the animals';}
 function huntSpawn(i){
  const kind=HUNT_KINDS[i%HUNT_KINDS.length],k=hunt.k===0?1:hunt.k,R=(hunt.k===0?6:2.4)*Math.max(.6,k/.35);
  const ang=Math.random()*Math.PI*2,r=R*(.4+Math.random()*.6),y=hunt.anchor.y;
  const m=window.GOAWildlife.makeAnimal(kind,{scale:k,ground:()=>y,x:hunt.anchor.x+Math.sin(ang)*r,z:hunt.anchor.z+Math.cos(ang)*r,yaw:Math.random()*6.28});
  m.R=R;m.animal.t=Math.random()*4;m.animal.hp=m.animal.spec.hp*.6; // quicker hunts in a roomarScene.add(m.animal.mesh);return m;
 }
 function huntScale(f){if(!hunt)return;hunt.k=f===0?(hunt.k===0?.35:0):Math.min(1,Math.max(.12,(hunt.k||.35)*f));if(hunt.anchor){for(const m of hunt.animals)arScene.remove(m.animal.mesh);hunt.animals=HUNT_KINDS.map((_,i)=>huntSpawn(i));}message(hunt.k===0?'Life size. Step back and look around.':`Animals at ${Math.round(hunt.k*100)}% size.`);}
 function huntSelect(event){
  if(!hunt)return;
  if(!hunt.anchor){
   const p=new T.Vector3();if(hitReady){p.setFromMatrixPosition(reticle.matrix);}else{const cam=api.renderer.xr.getCamera(),d=new T.Vector3();cam.getWorldPosition(p);cam.getWorldDirection(d);d.y=0;d.normalize();p.addScaledVector(d,1.6);p.y-=1.3;}
   hunt.anchor=p;reticle.visible=false;hunt.animals=HUNT_KINDS.map((_,i)=>huntSpawn(i));huntHud();message('The animals are out. Aim the crosshair and tap to fire. Squeeze or Exit to finish.');return;
  }
  if(hunt.fireT>0)return;
  const ref=api.renderer.xr.getReferenceSpace(),pose=event.frame?.getPose?.(event.inputSource.targetRaySpace,ref);
  const o=new T.Vector3(),d=new T.Vector3(0,0,-1);
  const src=event.inputSource,ctl=src?.targetRayMode==='tracked-pointer'?controllers.find(c=>c.userData.hand===src.handedness):null;
  if(ctl){ctl.updateWorldMatrix(true,false);o.setFromMatrixPosition(ctl.matrixWorld);d.applyMatrix4(new T.Matrix4().extractRotation(ctl.matrixWorld));} // headset controllers: the tracked ray
  else if(pose){const m=new T.Matrix4().fromArray(pose.transform.matrix);o.setFromMatrixPosition(m);d.applyMatrix4(new T.Matrix4().extractRotation(m));} // phone: through the tap
  else{const cam=api.renderer.xr.getCamera();cam.getWorldPosition(o);cam.getWorldDirection(d);}
  const lo=window.GOAExtension?.getLoadout?.()||{},st=window.GOAWeapons.stats(lo.weaponId||'rifle-wood',lo.ammoId);
  hunt.fireT=Math.min(st.fire,.6);hunt.shots++;api.player?.()?.sound?.(st.family);hunt.flash.position.copy(o);hunt.flash.intensity=6;setTimeout(()=>{if(hunt)hunt.flash.intensity=0;},60);
  let best=null;const list=hunt.animals.map(m=>m.animal);
  for(let i=0;i<st.pellets;i++){const dd=d.clone();dd.x+=(Math.random()-.5)*st.spread*1.2;dd.y+=(Math.random()-.5)*st.spread*1.2;dd.z+=(Math.random()-.5)*st.spread*1.2;dd.normalize();
   const h=window.GOAWildlife.raycast(o.x,o.y,o.z,dd.x,dd.y,dd.z,40,list);if(h&&h.animal.state!=='down'){h.animal.hp-=st.damage*(h.zone==='vital'?1.7:1);best=h;}}
  for(const m of hunt.animals){const a=m.animal;if(a.state!=='down'&&Math.hypot(a.x-o.x,a.z-o.z)<m.R*2){a.state='flee';a.t=2+Math.random()*2;}}
  if(best){const a=best.animal;if(a.hp<=0){a.state='down';a.downT=0;a.roll=0;hunt.score++;message(`${a.spec.name} harvested. It will be replaced in a moment.`);}else message('Hit! It is wounded.');}
  huntHud();
 }
 function huntFrame(dt,time,xrFrame){
  if(hitSource&&xrFrame&&!hunt?.anchor){const results=xrFrame.getHitTestResults(hitSource),pose=results[0]?.getPose(api.renderer.xr.getReferenceSpace());hitReady=!!pose;reticle.visible=!!pose;if(pose)reticle.matrix.fromArray(pose.transform.matrix);}
  if(!hunt?.anchor)return;
  hunt.fireT=Math.max(0,hunt.fireT-dt);
  const cam=api.renderer.xr.getCamera(),cp=new T.Vector3();cam.getWorldPosition(cp);
  hunt.animals.forEach((m,i)=>{
   const a=m.animal,k=hunt.k===0?1:hunt.k;
   if(a.state==='down'){a.downT+=dt;if(a.downT>5){arScene.remove(a.mesh);hunt.animals[i]=huntSpawn(i);}m.pose(dt,time);return;}
   a.t-=dt;const dx=a.x-cp.x,dz=a.z-cp.z,dv=Math.hypot(dx,dz);
   if(a.state!=='flee'&&dv<.5+k)a.state='flee',a.t=2;
   if(a.state==='graze'){a.want=0;if(a.t<=0){const ang=Math.random()*6.28,r=m.R*Math.random();a.tx=hunt.anchor.x+Math.sin(ang)*r;a.tz=hunt.anchor.z+Math.cos(ang)*r;a.state='walk';a.t=8;}}
   else if(a.state==='walk'){a.want=a.spec.walk*k;if(Math.hypot(a.tx-a.x,a.tz-a.z)<.1*k+.05||a.t<=0){a.state='graze';a.t=2+Math.random()*5;}}
   else if(a.state==='flee'){a.want=a.spec.run*k*.5;const ang=Math.atan2(a.x-hunt.anchor.x,a.z-hunt.anchor.z)+Math.sin(time+i)*.8;a.tx=a.x+Math.sin(ang)*2;a.tz=a.z+Math.cos(ang)*2;
    if(Math.hypot(a.x-hunt.anchor.x,a.z-hunt.anchor.z)>m.R){const back=Math.atan2(hunt.anchor.x-a.x,hunt.anchor.z-a.z);a.tx=a.x+Math.sin(back)*2;a.tz=a.z+Math.cos(back)*2;}if(a.t<=0)a.state='graze',a.t=3;}
   a.speed+=(a.want-a.speed)*Math.min(1,dt*3);
   if(a.speed>.01){const goal=Math.atan2(a.tx-a.x,a.tz-a.z);let dy=goal-a.yaw;while(dy>Math.PI)dy-=6.283;while(dy<-Math.PI)dy+=6.283;a.yaw+=dy*Math.min(1,dt*4);a.x+=Math.sin(a.yaw)*a.speed*dt;a.z+=Math.cos(a.yaw)*a.speed*dt;}
   m.pose(dt,time);
  });
 }
 window.GOAXR={init,frame,setPlay(m){if(mode==='vr')setVRPlay(m);},comfort(){return {...comfort};},driveInput(){return driveIn;},huntState(){return hunt;},vrPlay(){return vrPlay;},active(){return mode!=='none';},previewActive(){return mode==='preview';},isOpen(){return !!$('xr-panel')?.classList.contains('open');},open:panel,close(){panel(false);},end,worldPosition(){if(mode==='vr')return api.camera.getWorldPosition(new T.Vector3());return null;},state(){return {mode,pending,supported:{...supported},placed,hitReady};}};
})();
