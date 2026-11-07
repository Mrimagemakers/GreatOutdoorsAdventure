import {referenceVehicles,weapons,ammo,camping} from './catalog-data.js';
export {referenceVehicles,weapons,ammo,camping} from './catalog-data.js';
export let vehicles=[];
const key='great-outdoors-loadout-v1';
let state={version:1,vehicleId:'vehicle-1',weaponId:'rifle-camo',ammoId:'rifle-standard',campingIds:['tent','chair','lantern']};
let storageAvailable=true;
try{const stored=JSON.parse(localStorage.getItem(key));if(stored&&stored.version===1)state={...state,...stored};}catch{storageAvailable=false;}
export function getLoadout(){return structuredClone(state);}
function normalize(){
 if(!vehicles.some(v=>v.id===state.vehicleId))state.vehicleId='vehicle-1';
 if(!weapons.some(w=>w.id===state.weaponId))state.weaponId=weapons[0].id;
 const w=weapons.find(w=>w.id===state.weaponId);if(!ammo[w.family].some(a=>a.id===state.ammoId))state.ammoId=ammo[w.family][0].id;
 state.campingIds=Array.isArray(state.campingIds)?[...new Set(state.campingIds)].filter(id=>camping.some(c=>c.id===id)):[];
 state={version:1,vehicleId:state.vehicleId,weaponId:state.weaponId,ammoId:state.ammoId,campingIds:state.campingIds};
}
function announce(text){document.querySelector('#loadout-status').textContent=text;}
function update(message){normalize();try{localStorage.setItem(key,JSON.stringify(state));}catch{storageAvailable=false;}renderSummary();window.dispatchEvent(new CustomEvent('loadoutchange',{detail:getLoadout()}));announce(message+(storageAvailable?' Saved on this device.':' Storage is unavailable; export to keep your choices.'));}
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function renderSummary(){
 const vehicle=vehicles.find(v=>v.id===state.vehicleId),weapon=weapons.find(w=>w.id===state.weaponId);
 document.querySelector('#chosen-vehicle').textContent=vehicle.name;
 document.querySelector('#chosen-weapon').textContent=weapon.name;
 document.querySelector('#chosen-ammo').textContent=ammo[weapon.family].find(a=>a.id===state.ammoId).name;
 document.querySelector('#chosen-camp').textContent=state.campingIds.length?state.campingIds.map(id=>camping.find(c=>c.id===id).name).join(' · '):'No camping items packed';
 document.querySelectorAll('[data-vehicle]').forEach(b=>{const selected=b.dataset.vehicle===state.vehicleId;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('selected',selected);b.querySelector('.select-label').textContent=selected?'Selected ✓':'Choose vehicle ↗';});
 document.querySelectorAll('[data-weapon]').forEach(b=>{const selected=b.dataset.weapon===state.weaponId;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('selected',selected);});
 const select=document.querySelector('#ammo-choice');select.replaceChildren();for(const option of ammo[weapon.family]){const o=node('option',null,option.name);o.value=option.id;select.append(o);}select.value=state.ammoId;
 document.querySelectorAll('[data-camp]').forEach(input=>input.checked=state.campingIds.includes(input.dataset.camp));
}
function renderVehicles(filter='All'){
 const grid=document.querySelector('#vehicle-grid');grid.replaceChildren();
 for(const vehicle of vehicles.filter(v=>filter==='All'||v.type===filter)){
  const button=node('button','vehicle-card');button.type='button';button.dataset.vehicle=vehicle.id;
  const picture=node('img','vehicle-picture');picture.src='play/assets/garage/'+(vehicle.type==='UTV'?'buggy':'truck')+'.webp';picture.alt=vehicle.name+' — prototype visual stand-in';picture.loading='lazy';button.append(picture,node('small',null,'Prototype visual stand-in'));
  button.append(node('span','vehicle-category',vehicle.type+' / '+vehicle.role),node('h4',null,vehicle.name),node('p',null,vehicle.features));
  const stats=node('div','vehicle-stats');
  stats.append(node('span',null,vehicle.passengers===undefined?'Capacity: TBD':vehicle.passengers+' seats'),node('span',null,vehicle.cargoLbs===undefined?'Cargo: TBD':vehicle.cargoLbs.toLocaleString()+' lb cargo'),node('span',null,vehicle.clearanceIn===undefined?'Clearance: TBD':vehicle.clearanceIn+' in clearance'));
  button.append(stats,node('small',null,vehicle.drivetrain||'Draft configuration'),node('strong','select-label','Choose vehicle ↗'));
  button.onclick=()=>{state.vehicleId=vehicle.id;update(vehicle.name+' selected.');};grid.append(button);
 }
 renderSummary();
}
export const ready=(async()=>{
 const response=await fetch('vehicles.json');if(!response.ok)throw new Error('Vehicle catalog unavailable');
 vehicles=[...await response.json(),...referenceVehicles];normalize();
 renderVehicles();
 for(const weapon of weapons){const b=node('button','weapon-choice');b.type='button';b.dataset.weapon=weapon.id;b.append(node('strong',null,weapon.name),node('span',null,weapon.description));b.onclick=()=>{state.weaponId=weapon.id;update(weapon.name+' equipped.');};document.querySelector('#weapon-grid').append(b);}
 for(const item of camping){const label=node('label','camp-choice'),input=node('input');input.type='checkbox';input.dataset.camp=item.id;const text=node('span');text.append(node('strong',null,item.name),node('small',null,item.description));label.append(input,text);input.onchange=()=>{state.campingIds=input.checked?[...state.campingIds,item.id]:state.campingIds.filter(id=>id!==item.id);update(item.name+(input.checked?' packed.':' removed.'));};document.querySelector('#camp-grid').append(label);}
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));renderVehicles(b.dataset.filter);});
 document.querySelector('#ammo-choice').onchange=event=>{state.ammoId=event.target.value;update('Ammunition updated.');};
 document.querySelector('#export-loadout').onclick=()=>{const data={...getLoadout(),game:'Great Outdoors Adventure',stage:'prototype',vehicle:vehicles.find(v=>v.id===state.vehicleId),weapon:weapons.find(w=>w.id===state.weaponId),ammo:ammo[weapons.find(w=>w.id===state.weaponId).family].find(a=>a.id===state.ammoId),camping:camping.filter(c=>state.campingIds.includes(c.id))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='great-outdoors-loadout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Loadout exported for the game integration.');};
 document.querySelector('#reset-loadout').onclick=()=>{state={version:1,vehicleId:'vehicle-1',weaponId:'rifle-camo',ammoId:'rifle-standard',campingIds:['tent','chair','lantern']};update('Default loadout restored.');};
 renderSummary();announce('Your expedition loadout is ready. Launch the game to use your selections.');window.dispatchEvent(new CustomEvent('loadoutchange',{detail:getLoadout()}));
 return getLoadout();
})();
ready.catch(()=>{document.querySelector('#loadout-status').textContent='The catalog could not load. Open this site through a web server, then reload.';});

