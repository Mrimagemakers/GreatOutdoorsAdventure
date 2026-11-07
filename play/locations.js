(function(){
 'use strict';
 let api,places=[],current='long-valley',groveAdded=false;
 const $=id=>document.getElementById(id);
 function isOpen(){return !!$('destinations')?.classList.contains('open');}
 function open(value){const show=value===undefined?!isOpen():value;$('destinations').classList.toggle('open',show);if(show){api.openSettings(false);api.openMap(false);window.GOAExtension.close();for(const key in api.keys)api.keys[key]=0;}}
 function travel(id){const place=places.find(p=>p.id===id);if(!place)return;
  window.GOAExtension.packCamp();api.clearInput();
  Object.assign(api.S,{x:place.x,z:place.z,y:api.groundY(place.x,place.z),yaw:place.yaw,vx:0,vz:0,w:0,steer:0,vy:0,vyS:0,air:false,crash:0,ap:0,ar:0,apv:0,arv:0,nitroOn:false,nitroFx:0,cps:0,lapT:0,lapMod:true,splits:[]});
  api.setSeason(place.season,true);api.setWeather(place.weather,true);api.setPref('tod',place.tod);api.snapConditions();
  current=id;open(false);api.openMap(false);api.openSettings(false);api.updateCamera(0,true);api.setMarker(null);api.saveSettings();
  $('location-current').textContent=place.name;document.querySelectorAll('[data-destination]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.destination===id)));
  api.toast(place.name+' · '+place.description,4);
 }
 function mesh(T,group,geometry,material,x,y,z){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
 function cabin(x,z,snow=false,angle=0){
  const T=window.THREE,g=new T.Group(),wood=new T.MeshStandardMaterial({color:'#654f38',roughness:1}),roof=new T.MeshStandardMaterial({color:snow?'#e1e8e5':'#797d6d',roughness:.9}),dark=new T.MeshStandardMaterial({color:'#263530',roughness:.9}),glass=new T.MeshStandardMaterial({color:'#9ec3be',metalness:.3,roughness:.2});
  const floor=api.groundY(x,z)+.35;
  for(const dx of [-2.3,2.3])for(const dz of [-2,2]){const y=api.groundY(x+dx,z+dz);mesh(T,g,new T.CylinderGeometry(.17,.21,Math.max(.2,floor-y+.2),8),wood,dx,-(floor-y)/2,dz);}
  mesh(T,g,new T.BoxGeometry(5,3.2,4.5),wood,0,1.6,0);mesh(T,g,new T.BoxGeometry(5.3,.18,4.8),wood,0,.04,0);
  for(const side of [-1,1]){const panel=mesh(T,g,new T.BoxGeometry(3.1,.15,5.3),roof,side*1.34,3.75,0);panel.rotation.z=-side*.52;}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-2.5,3.2,2.26,2.5,3.2,2.26,0,4.5,2.26,2.5,3.2,-2.26,-2.5,3.2,-2.26,0,4.5,-2.26],3));geo.computeVertexNormals();mesh(T,g,geo,wood,0,0,0);
  mesh(T,g,new T.BoxGeometry(1.05,2.2,.08),dark,0,1.15,2.3);
  for(const dx of [-1.65,1.65]){mesh(T,g,new T.BoxGeometry(.95,.95,.09),dark,dx,1.9,2.31);mesh(T,g,new T.BoxGeometry(.72,.72,.1),glass,dx,1.9,2.37);}
  for(let i=1;i<13;i++)mesh(T,g,new T.BoxGeometry(5.04,.045,4.54),dark,0,i*.25,0);
  mesh(T,g,new T.BoxGeometry(1.8,.18,1),wood,0,.12,2.8);g.position.set(x,floor,z);g.rotation.y=angle;api.scene.add(g);
 }
 function sign(place){const T=window.THREE,c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#233b2c';ctx.fillRect(0,0,512,192);ctx.strokeStyle='#d9c99a';ctx.lineWidth=9;ctx.strokeRect(10,10,492,172);ctx.fillStyle='#f2ecd8';ctx.textAlign='center';ctx.font='bold 34px sans-serif';ctx.fillText(place.name,256,82);ctx.font='19px sans-serif';ctx.fillText(place.id==='river-valley'?'RIVERSIDE CABIN DISTRICT':'ALPINE LOOKOUT',256,132);const tex=new T.CanvasTexture(c),g=new T.Group(),wood=new T.MeshStandardMaterial({color:'#514534'}),board=new T.MeshStandardMaterial({map:tex,roughness:.9,side:T.DoubleSide});mesh(T,g,new T.BoxGeometry(.16,2.9,.16),wood,-1.3,1.45,0);mesh(T,g,new T.BoxGeometry(.16,2.9,.16),wood,1.3,1.45,0);mesh(T,g,new T.PlaneGeometry(3.2,1.2),board,0,2.2,.1);g.position.set(place.signX,api.groundY(place.signX,place.signZ),place.signZ);g.rotation.y=place.yaw+Math.PI;api.scene.add(g);}
 function addForest(){
  if(groveAdded||!api||!places.length||!api.near3d.models.pine)return;
  const T=window.THREE,md=api.near3d.models.pine,arrival=places.find(p=>p.id==='river-valley'),positions=[];
  let seed=731;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let attempt=0;attempt<600&&positions.length<48;attempt++){
   const angle=random()*Math.PI*2,radius=22+random()*85,x=arrival.x+Math.cos(angle)*radius,z=arrival.z+Math.sin(angle)*radius,y=api.terrainH(x,z),road=api.nearestRoad(x,z,{});
   if(road.road>=0&&road.d<road.hw+6)continue;if(y<api.WATER+2||Math.abs(api.terrainH(x+3,z)-y)>3||Math.abs(api.terrainH(x,z+3)-y)>3)continue;
   positions.push({x,y,z,h:13+random()*11,angle:random()*6.283});
  }
  const grove=new T.InstancedMesh(md.geo,md.mat,positions.length),dummy=new T.Object3D();
  positions.forEach((p,i)=>{dummy.position.set(p.x,p.y-.15,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.h);dummy.updateMatrix();grove.setMatrixAt(i,dummy.matrix);});
  grove.castShadow=grove.receiveShadow=true;grove.computeBoundingSphere();grove.name='Sketchfab riverside pine grove';api.scene.add(grove);groveAdded=true;console.info('Riverside pine grove ready:',positions.length);
 }
 function init(hooks){api=hooks;
  const main=api.ROADS[0],trail=api.ROADS[1];let riverIndex=0,riverDistance=Infinity,snowIndex=20;
  // Find real road arrivals: the paved river crossing and the highest part of the ridge track.
  main.pts.forEach((p,i)=>{const distance=Math.hypot(p.x-(80+Math.sin((p.z+130)*.012)*45),p.z+410);if(distance<riverDistance){riverDistance=distance;riverIndex=i;}});
  for(let i=20;i<trail.pts.length-20;i++)if(trail.y[i]>trail.y[snowIndex])snowIndex=i;
  function arrival(road,index){const f=api.roadFrame(road,index),off=Math.min(2,road.hw*.35);return {x:f.p.x+f.nx*off,z:f.p.z+f.nz*off,yaw:Math.atan2(f.tx,f.tz),signX:f.p.x-f.nx*(road.hw+3),signZ:f.p.z-f.nz*(road.hw+3)};}
  places=[{id:'long-valley',name:'Long Valley',...arrival(main,0),season:'dust',weather:'clear',tod:'season',description:'Original cross-country driving valley.'},
   {id:'river-valley',name:'River Valley',...arrival(main,riverIndex),season:'green',weather:'clear',tod:'morning',image:'locations/river-valley.webp',description:'A forest river, cabin outpost and green valley roads.'},
   {id:'snowy-mountain',name:'Snowy Mountain',...arrival(trail,snowIndex),season:'snow',weather:'clear',tod:'midday',image:'locations/snowy-mountain.webp',description:'Snow-covered ridge track and alpine lookout above the valley.'}];
  const T=window.THREE,riverGeo=new T.BufferGeometry(),vertices=[];for(let z=-530;z<-80;z+=5){const x=80+Math.sin((z+130)*.012)*45,next=80+Math.sin((z+5+130)*.012)*45;vertices.push(x-20,api.WATER+.015,z,x+20,api.WATER+.015,z,next-20,api.WATER+.015,z+5,x+20,api.WATER+.015,z,next+20,api.WATER+.015,z+5,next-20,api.WATER+.015,z+5);}riverGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));riverGeo.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((v,i)=>i%3===0?[v/600+.5,vertices[i+2]/600+.5]:[]),2));riverGeo.setIndex(Array.from({length:vertices.length/3},(_,i)=>Math.floor(i/3)*3+(i%3===1?2:i%3===2?1:0)));riverGeo.computeVertexNormals();const river=new T.Mesh(riverGeo,api.waterMat);river.receiveShadow=true;api.scene.add(river);
  // Cabins are scenic exteriors with stilt foundations fitted to the existing terrain.
  for(const [x,z,a] of [[160,-275,.2],[182,-300,-.2],[151,-321,.4]])if(api.groundY(x,z)>api.WATER+.5)cabin(x,z,false,a);
  const snow=places[2];cabin(snow.signX+Math.cos(snow.yaw)*9,snow.signZ-Math.sin(snow.yaw)*9,true,snow.yaw);
  sign(places[1]);sign(snow);
  const chip=document.createElement('button');chip.className='chip';chip.id='locationsbtn';chip.textContent='Locations';chip.onclick=()=>open();$('tools').prepend(chip);
  const pauseButton=document.createElement('button');pauseButton.className='btn';pauseButton.textContent='Locations';pauseButton.onclick=()=>open(true);$('settings').querySelector('.sethead').insertBefore(pauseButton,$('setclose'));
  const panel=document.createElement('div');panel.id='destinations';panel.className='sheet card';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Choose a location');panel.innerHTML='<div class="sethead"><b>CHOOSE YOUR NEXT DESTINATION</b><button id="locations-close" class="btn">Close</button></div><div class="locations-content"><p>Explore two new destination areas in the Long Valley world, inspired by your reference images. Travel changes the season and lighting, moves you to a safe roadside arrival, packs your camp, and restarts the current lap without leaderboard eligibility.</p><p>Current destination: <strong id="location-current">Long Valley</strong></p><div id="location-cards"></div><p class="locations-note">Images show visual references. Playable environments use the game terrain with new river, cabin and lookout props; they are not exact recreations. Cabins are exterior scenery.</p></div>';
  document.body.append(panel);$('locations-close').onclick=()=>open(false);
  for(const place of places){const card=document.createElement('article');if(place.image){const image=document.createElement('img');image.src=place.image;image.alt=place.name+' supplied visual reference';card.append(image);}const body=document.createElement('div'),heading=document.createElement('h3'),description=document.createElement('p'),travelButton=document.createElement('button'),waypoint=document.createElement('button');heading.textContent=place.name;description.textContent=place.description;travelButton.className='btn dark';travelButton.textContent='Travel to '+place.name;travelButton.dataset.destination=place.id;travelButton.setAttribute('aria-pressed',String(place.id===current));travelButton.onclick=()=>travel(place.id);waypoint.className='btn';waypoint.textContent='Mark on map';waypoint.onclick=()=>{api.setMarker(place.x,place.z);open(false);api.openMap(true);};body.append(heading,description,travelButton,waypoint);card.append(body);$('location-cards').append(card);}
  addForest();
  addEventListener('keydown',e=>{if(e.code==='KeyL'&&!e.repeat&&!e.target.closest('input,select,textarea')){e.preventDefault();open();}});
 }
 window.GOALocations={init,open,isOpen,addForest,close(){open(false);},travel,list(){return places.map(p=>({...p}));}};
})();



