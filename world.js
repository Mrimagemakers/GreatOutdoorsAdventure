import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const status = document.querySelector('#render-status');
const vrButton = document.querySelector('#vr');
const descriptions = {
 Deer: 'A classic woodland encounter. Deer are part of the planned wildlife roster for the hunting expansion.',
 Elk: 'A striking presence in the open country. Elk are planned for the hunting expansion; this site’s banner is concept artwork.',
 Bear: 'A powerful wilderness encounter. Bears are on the planned roster, with behavior and balancing to be defined in the game build.',
 Fox: 'A smaller quarry for a different kind of expedition. Foxes are included in the proposed wildlife roster.',
 Rabbit: 'Watch the undergrowth. Rabbits bring small-game variety to the planned hunting experience.',
 Coyote: 'Another reason to explore beyond the road. Coyotes complete the initial proposed wildlife lineup.'
};
document.querySelectorAll('[data-species]').forEach((button, index) => {
 button.setAttribute('aria-pressed', String(index === 0));
 button.addEventListener('click', () => {
  document.querySelectorAll('[data-species]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
  button.classList.add('active'); button.setAttribute('aria-pressed','true');
  document.querySelector('#species-title').textContent = button.dataset.species;
  document.querySelector('#species-copy').textContent = descriptions[button.dataset.species];
  document.querySelector('#species-index').textContent = `0${index + 1} / 06`;
 });
});

try {
 const canvas = document.querySelector('#world');
 const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
 renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
 renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
 renderer.xr.enabled=true;
 const scene=new THREE.Scene(); scene.background=new THREE.Color('#c0c9bb'); scene.fog=new THREE.FogExp2('#c0c9bb',.008);
 const camera=new THREE.PerspectiveCamera(55,1,.1,900); camera.position.set(18,13,31);
 const rig=new THREE.Group(); rig.add(camera); scene.add(rig);
 const controls=new OrbitControls(camera,canvas); controls.target.set(0,4,-22); controls.enableDamping=true;
 controls.minDistance=14; controls.maxDistance=90; controls.maxPolarAngle=Math.PI*.47; controls.update();
 const ambient=new THREE.HemisphereLight('#e4eddf','#374b2e',2.1); scene.add(ambient);
 const sun=new THREE.DirectionalLight('#ffda99',3.6); sun.position.set(-40,65,-60); sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,far:200}); sun.shadow.normalBias=.08; scene.add(sun);
 let seed=971; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const height=(x,z)=> Math.sin(x*.045)*2.5+Math.sin(z*.037)*2+Math.cos((x+z)*.055)*1.5;
 const terrainGeo=new THREE.PlaneGeometry(420,420,150,150); terrainGeo.rotateX(-Math.PI/2);
 const pos=terrainGeo.attributes.position; const colors=[]; const green=new THREE.Color();
 for(let i=0;i<pos.count;i++){let x=pos.getX(i),z=pos.getZ(i),y=height(x,z);pos.setY(i,y);green.setHSL(.22+rand()*.025,.2+rand()*.15,.17+y*.013+rand()*.035); colors.push(green.r,green.g,green.b);}
 terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeo.computeVertexNormals();
 const ground=new THREE.Mesh(terrainGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;scene.add(ground);
 const lake=new THREE.Mesh(new THREE.CircleGeometry(33,96),new THREE.MeshStandardMaterial({color:'#658c87',metalness:.55,roughness:.22,transparent:true,opacity:.9}));lake.rotation.x=-Math.PI/2; lake.scale.set(1,2.3,1);lake.position.set(4,.3,-90);scene.add(lake);
 const mountains=new THREE.Group();scene.add(mountains);
 for(let i=0;i<20;i++){
  const x=(i-10)*28,z=-185-rand()*60,h=45+rand()*58;
  const geo=new THREE.ConeGeometry(28+rand()*20,h,6+Math.floor(rand()*3),5);const p=geo.attributes.position;
  const cols=[];for(let j=0;j<p.count;j++){let y=p.getY(j);if(y<h*.35){p.setX(j,p.getX(j)+(rand()-.5)*7);p.setZ(j,p.getZ(j)+(rand()-.5)*7);}const c=new THREE.Color(y>h*.19?'#d6d8ce':'#697b72');c.multiplyScalar(.8+rand()*.28);cols.push(c.r,c.g,c.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));geo.computeVertexNormals();
  const mountain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));mountain.position.set(x,h/2-5,z);mountains.add(mountain);
 }
 const bark=new THREE.MeshStandardMaterial({color:'#443f2b',roughness:1});
 const needles=new THREE.MeshStandardMaterial({color:'#243e2b',roughness:1});
 const trunkGeo=new THREE.CylinderGeometry(.13,.23,3,5);const crownGeo=new THREE.ConeGeometry(1.6,4.8,7);
 const count=650;const trunks=new THREE.InstancedMesh(trunkGeo,bark,count);const crowns=new THREE.InstancedMesh(crownGeo,needles,count*2);
 const dummy=new THREE.Object3D();let n=0;
 while(n<count){const x=(rand()-.5)*290,z=(rand()-.5)*260-50;if((Math.abs(x-4)<35&&z<-34&&z>-160)||(Math.abs(x+12)<8&&z>0))continue;const scale=.65+rand()*1.7,y=height(x,z);dummy.position.set(x,y+1.5*scale,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.setScalar(scale);dummy.updateMatrix();trunks.setMatrixAt(n,dummy.matrix);for(let k=0;k<2;k++){dummy.position.y=y+(4+k*1.6)*scale;dummy.scale.set(scale*(1-k*.23),scale,scale*(1-k*.23));dummy.updateMatrix();crowns.setMatrixAt(n*2+k,dummy.matrix);}n++;}
 trunks.castShadow=true;crowns.castShadow=true;crowns.receiveShadow=true;scene.add(trunks,crowns);
 const rockMat=new THREE.MeshStandardMaterial({color:'#777c68',roughness:1,flatShading:true});
 for(let i=0;i<65;i++){let x=(rand()-.5)*140,z=(rand()-.5)*100;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.4+rand()*1.1,0),rockMat);rock.position.set(x,height(x,z),z);rock.scale.set(1.5,.7,1);rock.rotation.set(rand(),rand()*4,rand());rock.castShadow=true;scene.add(rock);}
 const pathPoints=[];for(let z=75;z>-30;z-=2){let x=-12+Math.sin(z*.035)*5;pathPoints.push(new THREE.Vector3(x,height(x,z)+.12,z));}
 const roadGeo=new THREE.BufferGeometry();const roadPos=[];for(let i=0;i<pathPoints.length-1;i++){const a=pathPoints[i],b=pathPoints[i+1];roadPos.push(a.x-2,a.y,a.z,a.x+2,a.y,a.z,b.x-2,b.y,b.z,a.x+2,a.y,a.z,b.x+2,b.y,b.z,b.x-2,b.y,b.z);}roadGeo.setAttribute('position',new THREE.Float32BufferAttribute(roadPos,3));roadGeo.computeVertexNormals();scene.add(new THREE.Mesh(roadGeo,new THREE.MeshStandardMaterial({color:'#8b8062',roughness:1,side:THREE.DoubleSide})));
 const fireflies=new THREE.BufferGeometry(),points=[];for(let i=0;i<100;i++)points.push((rand()-.5)*90,3+rand()*16,(rand()-.5)*100);fireflies.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const dust=new THREE.Points(fireflies,new THREE.PointsMaterial({color:'#ffe1a0',size:.09,transparent:true,opacity:.5}));scene.add(dust);
 let blue=false;
 function setTime(value){blue=value;scene.background.set(blue?'#354f6b':'#c0c9bb');scene.fog.color.copy(scene.background);sun.color.set(blue?'#a0c1ef':'#ffda99');sun.intensity=blue?.8:3.6;ambient.intensity=blue?1:2.1;renderer.toneMappingExposure=blue?.85:1.15;document.querySelector('#time-label').textContent=blue?'BLUE HOUR':'GOLDEN HOUR';document.querySelector('#sunrise').setAttribute('aria-pressed',String(!blue));document.querySelector('#twilight').setAttribute('aria-pressed',String(blue));}
 document.querySelector('#sunrise').onclick=()=>setTime(false);document.querySelector('#twilight').onclick=()=>setTime(true);
 document.querySelector('#reset').onclick=()=>{camera.position.set(18,13,31);controls.target.set(0,4,-22);controls.update();};
 const resize=new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(canvas);
 status.hidden=true;
 let session=null; let supported=false;
 if(navigator.xr){try{supported=await navigator.xr.isSessionSupported('immersive-vr');}catch{}}
 vrButton.textContent=supported?'Enter VR ↗':'VR unavailable';vrButton.disabled=!supported;
 if(!supported) document.querySelector('#xr-note').textContent='VR is unavailable in this browser or device. You can explore with drag and zoom. A compatible WebXR headset and secure connection are required for immersive VR.';
 vrButton.onclick=async()=>{try{if(session){await session.end();return;}session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});session.addEventListener('end',()=>{session=null;rig.position.set(0,0,0);controls.enabled=true;vrButton.textContent='Enter VR ↗';});controls.enabled=false;rig.position.set(18,8,31);await renderer.xr.setSession(session);vrButton.textContent='Exit VR';}catch(error){session=null;controls.enabled=true;document.querySelector('#xr-note').textContent='VR could not start. Check headset connection and browser permissions, then try again.';}};
 let visible=true;new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(canvas);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 renderer.setAnimationLoop(t=>{if(!visible&&!renderer.xr.isPresenting)return;if(!renderer.xr.isPresenting)controls.update();if(!reduce)dust.rotation.y=t*.000008;renderer.render(scene,camera);});
 canvas.addEventListener('webglcontextlost',()=>{status.hidden=false;status.textContent='The 3D view was interrupted. Reload the page to restore it.';});
}catch(error){status.hidden=false;status.textContent='The 3D preview needs WebGL. Try a browser with hardware graphics enabled.';vrButton.disabled=true;vrButton.textContent='3D unavailable';}
