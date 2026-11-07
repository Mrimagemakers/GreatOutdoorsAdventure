(() => {
 const $=id=>document.getElementById(id);
 const menu=document.createElement('section');menu.id='drive-menu';menu.className='card';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Adventure menu');
 menu.innerHTML='<div class="sethead"><b>ADVENTURE MENU</b><button class="btn" id="drive-close">Resume drive</button></div><p class="drive-tip">Slide your left thumb on the steering pad. Hold GAS to drive; hold BRAKE when stopped to reverse. Tap OUT when stopped to walk, hunt and fish. Settings › Touch lets you switch to arrow buttons or tilt steering, and change button size.</p><div id="drive-actions"></div><label class="drive-extra"><input type="checkbox" id="drive-extras"> Show Drift, Nitro & Ramp buttons</label>';
 document.body.append(menu);
 const bar=document.createElement('div');bar.id='drive-bar';bar.innerHTML='<button class="chip" id="drive-open" aria-expanded="false" aria-controls="drive-menu">☰ Menu</button><button class="chip" id="drive-map">Map</button><button class="chip" id="drive-reset">Reset car</button>';document.body.append(bar);
 function clear(){document.dispatchEvent(new Event('goa-clear-input'));document.querySelectorAll('.tb.on').forEach(el=>el.classList.remove('on'));}
 function open(value){menu.hidden=!value;$('drive-open').setAttribute('aria-expanded',String(value));document.body.classList.toggle('drive-menu-open',value);clear();if(value)$('drive-close').focus();else $('drive-open').focus();}
 window.GOADriveUI={isOpen:()=>!menu.hidden,close:()=>open(false)};
 $('drive-open').onclick=()=>open(menu.hidden);$('drive-close').onclick=()=>open(false);
 $('drive-map').onclick=()=>{open(false);$('mapbtn').click();};$('drive-reset').onclick=()=>{open(false);$('resetbtn').click();};
 const tools=$('tools');$('drive-actions').append(tools,$('condbtn'),$('cond'));
 tools.addEventListener('click',e=>{if(e.target.closest('button'))open(false);});
 $('drive-extras').onchange=e=>document.body.classList.toggle('drive-extras',e.target.checked);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopImmediatePropagation();open(false);}},true);
 for(const [id,label] of Object.entries({tLeft:'Steer left',tRight:'Steer right',tGas:'Accelerate',tBrake:'Brake / reverse',tDrift:'Drift',tNitro:'Nitro boost',tRamp:'Build ramp'})){$(id).setAttribute('role','button');$(id).setAttribute('aria-label',label);}
})();
