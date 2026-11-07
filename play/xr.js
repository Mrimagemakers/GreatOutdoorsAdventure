(function(){
 'use strict';
 let api,T,mode='none',session=null,pending=false,snapshot=null,rig=null,menu=null,arScene=null,stage=null,model=null,reticle=null,hitSource=null,viewerSpace=null,localSpace=null,previewCamera=null,placed=false,hitReady=false,floorSpace=true,snapHeld=false;
 let supported={vr:false,ar:false},scale=.006,turn=0,dragX=null;
 const controllers=[],clickable=[],$=id=>document.getElementById(id),point={x:0,y:0,z:0};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function message(text){$('xr-message').textContent=text;$('xr-overlay-message').textContent=text;}
 function dispose(object){object?.traverse(o=>{if(!o.userData.xrShared)o.geometry?.dispose();if(o.userData.xrOwned){for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(m?.userData?.xrOwnsMap)m.map?.dispose();m?.dispose();}}});}
 function own(mesh){mesh.userData.xrOwned=true;for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(m?.map?.isCanvasTexture)m.userData.xrOwnsMap=true;return mesh;}
 function panel(value){$('xr-panel').classList.toggle('open',value===undefined?!$('xr-panel').classList.contains('open'):value);if($('xr-panel').classList.contains('open')){api.clearInput();api.openSettings(false);window.GOALocations.close();window.GOAExtension.close();}}
 function save(){snapshot={parent:api.camera.parent,position:api.camera.position.clone(),quaternion:api.camera.quaternion.clone(),near:api.camera.near,far:api.camera.far,fov:api.camera.fov,clearColor:api.renderer.getClearColor(new T.Color()),clearAlpha:api.renderer.getClearAlpha()};api.clearInput();api.stop();api.openSettings(false);panel(false);document.body.classList.add('xr-active');$('xr-overlay').classList.add('active');}
 function restore(){
  try{hitSource?.cancel();}catch{}hitSource=null;viewerSpace=localSpace=null;hitReady=false;placed=false;
  if(rig){rig.remove(api.camera);if(snapshot?.parent)snapshot.parent.add(api.camera);api.scene.remove(rig);for(const c of controllers)rig.remove(c);if(menu){rig.remove(menu);dispose(menu);}rig=null;menu=null;clickable.length=0;}
  if(arScene){if(model){stage?.remove(model);dispose(model);}arScene.remove(stage,reticle);dispose(reticle);arScene=null;stage=model=reticle=previewCamera=null;}
  if(snapshot){api.camera.position.copy(snapshot.position);api.camera.quaternion.copy(snapshot.quaternion);api.camera.near=snapshot.near;api.camera.far=snapshot.far;api.camera.fov=snapshot.fov;api.camera.updateProjectionMatrix();api.renderer.setClearColor(snapshot.clearColor,snapshot.clearAlpha);snapshot=null;}
  mode='none';session=null;pending=false;document.body.classList.remove('xr-active');$('xr-overlay').classList.remove('active');api.clearInput();api.restoreView();api.openSettings(true);probe();
 }
 async function end(){if(session){try{await session.end();}catch{restore();}}else restore();}
 async function probe(){
  supported={vr:false,ar:false};
  if(!window.isSecureContext){message('VR and AR need HTTPS or localhost. The tabletop preview is available below.');}
  else if(!navigator.xr){message('This browser does not expose WebXR. Use the tabletop preview, or open the game in a compatible headset or AR browser.');}
  else {const results=await Promise.allSettled([navigator.xr.isSessionSupported('immersive-vr'),navigator.xr.isSessionSupported('immersive-ar')]);supported.vr=results[0].status==='fulfilled'&&results[0].value;supported.ar=results[1].status==='fulfilled'&&results[1].value;message(supported.vr||supported.ar?'Supported modes are ready. Choose Enter VR or Enter AR.':'No immersive headset or AR session is available in this browser. You can still try the tabletop preview.');}
  $('xr-vr').disabled=!supported.vr||pending;$('xr-ar').disabled=!supported.ar||pending;$('xr-vr').textContent=supported.vr?'Enter VR':'VR unavailable';$('xr-ar').textContent=supported.ar?'Enter AR':'AR unavailable';
 }
 function button3D(text,y,action){const c=document.createElement('canvas');c.width=768;c.height=128;const g=c.getContext('2d');g.fillStyle='#213b2d';g.fillRect(0,0,768,128);g.strokeStyle='#d8c493';g.lineWidth=8;g.strokeRect(4,4,760,120);g.fillStyle='#f0eddf';g.textAlign='center';g.textBaseline='middle';g.font='bold 37px sans-serif';g.fillText(text,384,64);const texture=new T.CanvasTexture(c),mesh=own(new T.Mesh(new T.PlaneGeometry(1.15,.19),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide})));mesh.position.set(0,y,-2);mesh.userData.action=action;menu.add(mesh);clickable.push(mesh);}
 function positionRig(){const s=api.S;rig.position.set(s.x+Math.cos(s.yaw)*5,api.groundY(s.x+Math.cos(s.yaw)*5,s.z-Math.sin(s.yaw)*5)+(floorSpace?0:1.65),s.z-Math.sin(s.yaw)*5);rig.rotation.y=s.yaw+Math.PI;api.camera.position.set(0,0,0);api.camera.quaternion.identity();}
 function viewpoint(id){if(mode!=='vr')return;api.travel(id);api.clearInput();positionRig();message('VR lookout: '+window.GOALocations.list().find(p=>p.id===id).name+'. Trigger selects menu buttons; grip exits.');}
 function buildVR(){
  rig=new T.Group();rig.name='VR viewer origin';api.scene.add(rig);rig.add(api.camera);api.camera.near=.05;api.camera.updateProjectionMatrix();positionRig();
  menu=new T.Group();rig.add(menu);button3D('River Valley',1.95,()=>viewpoint('river-valley'));button3D('Snowy Mountain',1.7,()=>viewpoint('snowy-mountain'));button3D('Turn left 30°',1.45,()=>rig.rotation.y+=Math.PI/6);button3D('Turn right 30°',1.2,()=>rig.rotation.y-=Math.PI/6);button3D('Exit VR',.95,end);
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
   const acquired=await navigator.xr.requestSession(kind==='vr'?'immersive-vr':'immersive-ar',{optionalFeatures:kind==='vr'?['local-floor']:['local-floor','hit-test','dom-overlay'],...(kind==='ar'?{domOverlay:{root:$('xr-overlay')}}:{})});session=acquired;
   session.addEventListener('end',restore,{once:true});save();mode='starting';$('xr-overlay').dataset.mode=kind;
   floorSpace=true;try{localSpace=await session.requestReferenceSpace('local-floor');}catch{floorSpace=false;localSpace=await session.requestReferenceSpace('local');}
   if(session!==acquired)return;
   api.renderer.xr.setReferenceSpaceType(floorSpace?'local-floor':'local');
   if(kind==='vr')buildVR();else buildAR(false);
   await api.renderer.xr.setSession(session);if(session!==acquired)return;mode=kind;
   if(kind==='ar'){try{viewerSpace=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:viewerSpace});message('Move your device slowly. Tap when a gold ring appears to place the tabletop.');}catch{hitSource=null;message('Surface detection is unavailable. Tap Place ahead to position the tabletop in front of you.');}session.addEventListener('select',()=>place(false));}
   else message('VR lookout: point a controller at a menu button and press its trigger. Stick left/right snap-turns; grip exits. Driving is paused.');
  }catch(error){const failed=session;if(failed){try{await failed.end();}catch{}}if(snapshot)restore();else{session=null;mode='none';pending=false;}await probe();message(error?.name==='NotAllowedError'?'XR permission was declined. You can try again or use the tabletop preview.':'Could not start this XR mode. Check the headset/browser connection or use the tabletop preview.');}
  finally{pending=false;}
 }
 function frame(dt,time,xrFrame){
  if(mode==='vr'){
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
  const el=document.createElement('section');el.id='xr-panel';el.className='sheet card';el.setAttribute('role','dialog');el.setAttribute('aria-label','VR and AR modes');el.innerHTML='<div class="sethead"><b>STEP INTO THE OUTDOORS</b><button id="xr-close" class="btn">Close</button></div><div class="xr-content"><h3>Virtual reality lookout</h3><p>Look around the full-size world with head tracking. Use controller rays to select River Valley, Snowy Mountain, snap turns, or Exit. Driving and lap timing are paused.</p><button class="btn dark" id="xr-vr" disabled>Checking VR…</button><h3>Augmented reality tabletop</h3><p>Place a miniature of your current location, vehicle, forest and packed camp items on a real surface. AR uses camera passthrough provided by a compatible device and browser.</p><button class="btn dark" id="xr-ar" disabled>Checking AR…</button><h3>Try the tabletop without a headset</h3><p>The desktop preview uses the same miniature scene. Drag to rotate, or use the screen controls.</p><button class="btn" id="xr-preview">Preview tabletop</button><button class="btn" id="xr-check">Check devices again</button><p id="xr-message" role="status">Checking XR support…</p><small>Immersive modes require HTTPS, browser permission and compatible hardware. The game does not record or upload camera video. Use your device’s system exit control at any time.</small></div>';
  document.body.append(el);const overlay=document.createElement('div');overlay.id='xr-overlay';overlay.innerHTML='<div id="xr-overlay-message" role="status"></div><div class="xr-controls"><button id="xr-place">Place ahead / reposition</button><button id="xr-turn-left">↶ Rotate</button><button id="xr-turn-right">Rotate ↷</button><label>Size <input id="xr-scale" type="range" min="0.003" max="0.012" step="0.001" value="0.006"></label><button id="xr-exit">Exit XR / preview</button></div>';document.body.append(overlay);
  overlay.addEventListener('beforexrselect',event=>{if(event.target.closest('button,input,label'))event.preventDefault();});
  $('xr-close').onclick=()=>panel(false);$('xr-vr').onclick=()=>start('vr');$('xr-ar').onclick=()=>start('ar');$('xr-preview').onclick=()=>start('preview');$('xr-check').onclick=probe;$('xr-exit').onclick=end;$('xr-place').onclick=()=>place(true);
  function rotate(angle){turn+=angle;if(model)model.rotation.y=turn;}
  $('xr-turn-left').onclick=()=>rotate(Math.PI/6);$('xr-turn-right').onclick=()=>rotate(-Math.PI/6);$('xr-scale').oninput=event=>{scale=Number(event.target.value);model?.scale.setScalar(scale);};
  api.renderer.domElement.addEventListener('pointerdown',event=>{if(mode==='preview'){dragX=event.clientX;api.renderer.domElement.setPointerCapture(event.pointerId);}});api.renderer.domElement.addEventListener('pointermove',event=>{if(mode==='preview'&&dragX!==null){rotate((event.clientX-dragX)*.008);dragX=event.clientX;}});api.renderer.domElement.addEventListener('pointerup',()=>dragX=null);api.renderer.domElement.addEventListener('pointercancel',()=>dragX=null);
  for(let i=0;i<2;i++){const controller=api.renderer.xr.getController(i),line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-5)]),new T.LineBasicMaterial({color:'#e3cc93'}));controller.add(line);controller.addEventListener('selectstart',()=>{if(mode==='vr')ray(controller)?.object.userData.action?.();});controller.addEventListener('squeezestart',()=>{if(mode==='vr'||mode==='ar')end();});controllers.push(controller);}
  addEventListener('keydown',event=>{if(event.code==='Escape'&&mode==='preview'){event.preventDefault();end();}});navigator.xr?.addEventListener('devicechange',probe);probe();
 }
 window.GOAXR={init,frame,active(){return mode!=='none';},previewActive(){return mode==='preview';},isOpen(){return !!$('xr-panel')?.classList.contains('open');},open:panel,close(){panel(false);},end,worldPosition(){if(mode==='vr')return api.camera.getWorldPosition(new T.Vector3());return null;},state(){return {mode,pending,supported:{...supported},placed,hitReady};}};
})();
