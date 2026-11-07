(function(){
 'use strict';
 const storageKey='great-outdoors-loadout-v1';
 let api,data,state,allVehicles=[],camp=null;
 const $=id=>document.getElementById(id);
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));$('exp-save').textContent='Loadout saved on this device.';}catch{$('exp-save').textContent='Device storage unavailable. Export your loadout to keep it.';}}
 function option(select,value,text){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
 function refillAmmo(){const weapon=data.weapons.find(w=>w.id===state.weaponId);const choices=data.ammo[weapon.family];if(!choices.some(a=>a.id===state.ammoId))state.ammoId=choices[0].id;$('exp-ammo').replaceChildren();for(const a of choices)option($('exp-ammo'),a.id,a.name);$('exp-ammo').value=state.ammoId;}
 function status(){const w=data.weapons.find(w=>w.id===state.weaponId);$('exp-equipped').textContent=`${w.name} · ${state.campingIds.length} camp items · R3 / E: ${camp?'pack camp':'deploy camp'}`;}
 function packCamp(){if(!camp)return;window.GOACampLife?.onPack?.();api.scene.remove(camp);window.GOACamp.dispose(camp);camp=null;status();}
 function deployCamp(){
  if(camp){packCamp();api.toast('Camp packed');return;}
  if(!api.S.started){api.toast('Start your expedition first');return;}
  if(window.GOASurvival?.active?.()){api.toast('In Survival, pitch your own tent and build a fire');return;}
  const foot=window.GOAPlayer?.onFoot?.(),ref=foot?window.GOAPlayer.position():{x:api.S.x,z:api.S.z,yaw:api.S.yaw};
  if(!foot&&(Math.hypot(api.S.vx,api.S.vz)>1.5||api.S.air)){api.toast('Stop on the ground before setting camp');return;}
  if(!state.campingIds.length){api.toast('Pack camping items in the outfitter first');return;}
  camp=window.GOACamp.create(window.THREE,state.campingIds);
  const x=foot?ref.x+Math.sin(ref.yaw)*4:api.S.x+Math.cos(api.S.yaw)*7,z=foot?ref.z+Math.cos(ref.yaw)*4:api.S.z-Math.sin(api.S.yaw)*7;
  const h=api.groundY(x,z),samples=[api.groundY(x-4,z-3),api.groundY(x+4,z+3),api.groundY(x-4,z+3),api.groundY(x+4,z-3)];
  if(Math.max(...samples)-Math.min(...samples)>1.1){window.GOACamp.dispose(camp);camp=null;api.toast('Find flatter ground for camp');return;}
  camp.position.set(x,h+.04,z);camp.rotation.y=foot?ref.yaw+Math.PI:api.S.yaw;api.scene.add(camp);window.GOACampLife?.onDeploy?.(camp);status();api.toast('Camp deployed with a campfire · walk up (F to step out) and press E to cook, rest or restock');
 }
 function open(on){const show=on===undefined?!$('expedition').classList.contains('open'):on;$('expedition').classList.toggle('open',show);if(show){api.openSettings(false);api.openMap(false);for(const k in api.keys)api.keys[k]=0;$('exp-vehicle').value=api.P.vehicle;}}
 function buildUI(){
  const button=document.createElement('button');button.className='chip';button.id='expbtn';button.textContent='Outfitter';button.onclick=()=>open();$('tools').prepend(button);
  const pauseButton=document.createElement('button');pauseButton.className='btn';pauseButton.textContent='Expedition outfitter';pauseButton.onclick=()=>open(true);$('settings').querySelector('.sethead').insertBefore(pauseButton,$('setclose'));
  const panel=document.createElement('div');panel.id='expedition';panel.className='sheet card';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Expedition outfitter');
  panel.innerHTML=`<div class="sethead"><b>EXPEDITION OUTFITTER</b><button class="btn" id="exp-close">Close</button></div><div class="exp-content"><p>Vehicle, weapon and camp choices inspired by your supplied references. Named vehicles use the included truck or buggy models as stand-ins. Your weapon and ammunition are what you carry on foot (F to step out). Hunt, fish and set up camp anywhere.</p><label for="exp-vehicle">VEHICLE</label><select id="exp-vehicle"></select><img id="exp-vehicle-image" alt="Selected vehicle preview"><p id="exp-vehicle-info"></p><label for="exp-weapon">WEAPON</label><select id="exp-weapon"></select><label for="exp-ammo">AMMUNITION</label><select id="exp-ammo"></select><h4>CAMPING ITEMS</h4><div id="exp-items"></div><div class="exp-actions"><button id="exp-camp" class="btn dark">Deploy / pack camp (E / R3)</button><button id="exp-export" class="btn">Export loadout</button></div><p id="exp-save" role="status"></p><details><summary>Vehicle reference</summary><img src="references/vehicles.jpg" alt="Supplied vehicle reference artwork"></details><details><summary>Weapon reference</summary><img src="references/weapons.jpg" alt="Supplied weapon reference artwork"></details><details><summary>Camping reference</summary><img src="references/camping.jpg" alt="Supplied camping reference artwork"></details><p>Spreadsheet capacities and clearance are draft game settings. Camper and trailer choices use truck stand-ins; articulated towing, interiors and survival effects are not implemented.</p></div>`;
  document.body.append(panel);
  const equipped=document.createElement('div');equipped.id='exp-equipped';document.body.append(equipped);
  for(const id of ['rally','truck','sports','muscle','buggy'])option($('exp-vehicle'),id,api.VEHICLES[id].name+' · original');
  for(const v of allVehicles)option($('exp-vehicle'),v.id,v.name+' · '+v.type+' stand-in');
  for(const w of data.weapons)option($('exp-weapon'),w.id,w.name);
  $('exp-weapon').value=state.weaponId;refillAmmo();
  for(const c of data.camping){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=state.campingIds.includes(c.id);span.textContent=c.name;label.append(input,span);$('exp-items').append(label);input.onchange=()=>{state.campingIds=input.checked?[...state.campingIds,c.id]:state.campingIds.filter(id=>id!==c.id);packCamp();save();status();};}
  $('exp-weapon').onchange=()=>{state.weaponId=$('exp-weapon').value;refillAmmo();save();status();window.GOAPlayer?.setLoadout?.(state.weaponId,state.ammoId);};
  $('exp-ammo').onchange=()=>{state.ammoId=$('exp-ammo').value;save();window.GOAPlayer?.setLoadout?.(state.weaponId,state.ammoId);};
  function vehicleInfo(){const id=$('exp-vehicle').value;const model=api.VEHICLES[id];$('exp-vehicle-image').src=model.catalog?'assets/garage/catalog/'+id+'.webp':'assets/garage/'+id+'.webp';$('exp-vehicle-image').onerror=function(){this.onerror=null;this.src='assets/garage/'+(model.baseModel||id)+'.webp';};$('exp-vehicle-image').alt=model.name+(model.baseModel?' — prototype visual stand-in':'');const v=allVehicles.find(v=>v.id===$('exp-vehicle').value);$('exp-vehicle-info').textContent=v?`${v.role} · ${v.features}${v.passengers?` · ${v.passengers} seats · ${v.cargoLbs} lb cargo · ${v.clearanceIn} in clearance`:''} · visual stand-in`:'Original Long Valley vehicle.';}
  $('exp-vehicle').onchange=()=>{state.vehicleId=$('exp-vehicle').value;api.setPref('vehicle',state.vehicleId);vehicleInfo();save();};
  $('exp-close').onclick=()=>open(false);$('exp-camp').onclick=()=>{deployCamp();};
  $('exp-export').onclick=()=>{const blob=new Blob([JSON.stringify({...state,stage:'driving-and-camp-prototype',vehicle:allVehicles.find(v=>v.id===state.vehicleId)||{id:api.P.vehicle,name:api.VEHICLES[api.P.vehicle].name},weapon:data.weapons.find(w=>w.id===state.weaponId),camping:data.camping.filter(c=>state.campingIds.includes(c.id))},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='great-outdoors-loadout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('exp-vehicle').value=state.vehicleId;vehicleInfo();status();
  addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&!e.target.closest('input,select,textarea')&&api.S.started){e.preventDefault();deployCamp();}});
 }
 window.GOAExtension={
  async init(hooks){api=hooks;data=await import('./catalog-data.js');const response=await fetch('vehicles.json');if(!response.ok)throw new Error('Vehicle list failed to load');allVehicles=[...await response.json(),...data.referenceVehicles];
   for(const v of allVehicles){const base=v.type==='UTV'?'buggy':'truck';api.VEHICLES[v.id]={...api.VEHICLES[base],name:v.name,desc:`${v.role}. Visual stand-in: included ${base} model. ${v.features}`,catalog:v,baseModel:base};api.WHEEL_STYLE[v.id]=api.WHEEL_STYLE[base];}
   state={version:1,vehicleId:'vehicle-1',weaponId:'rifle-camo',ammoId:'rifle-standard',campingIds:['tent','chair','lantern']};try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.version===1)state={...state,...saved};}catch{}
   if(!api.VEHICLES[state.vehicleId])state.vehicleId='vehicle-1';if(!data.weapons.some(w=>w.id===state.weaponId))state.weaponId='rifle-camo';state.campingIds=Array.isArray(state.campingIds)?[...new Set(state.campingIds)].filter(id=>data.camping.some(c=>c.id===id)):[];
   api.P.vehicle=state.vehicleId;buildUI();
  },open,deployCamp,isOpen(){return !!$('expedition')?.classList.contains('open');},close(){open(false);},packCamp,
  vehicleChanged(id){if(state&&api.VEHICLES[id]){state.vehicleId=id;save();if($('exp-vehicle'))$('exp-vehicle').value=id;}},
  getLoadout(){return state?JSON.parse(JSON.stringify(state)):null;},
  weaponName(id){return data?.weapons.find(w=>w.id===id)?.name||id;}
 };
})();
