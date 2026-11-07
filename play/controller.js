(function(){
 'use strict';
 const core=window.GOAControllerCore;
 let lastSource='',rawPad=null,family='',previousAnnounced=false;
 let previous=core.empty(),state=core.empty(),activeIndex=-1,focused=true,blocked=true,navAt=0,navDirection='',hooks=null,scopeBefore=null;
 const status=document.createElement('div');status.id='controller-status';status.setAttribute('role','status');document.body.append(status);
 const clear=()=>{previous=core.empty();state=core.empty();blocked=true;};
 const visible=el=>el&&!el.disabled&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
 const items=scope=>[...scope.querySelectorAll('button,a[href],input,select,summary,[tabindex="0"]')].filter(visible);
 function focusItem(element){element?.focus({preventScroll:true});element?.scrollIntoView({block:'nearest',inline:'nearest'});}
 function navigate(scope,direction){
  const all=items(scope);if(!all.length)return;
  const current=document.activeElement,index=all.indexOf(current);
  if(index<0){focusItem(all[0]);return;}
  if(current.matches('input[type=range],select')&&(direction==='left'||direction==='right')){
   const sign=direction==='right'?1:-1;
   if(current.tagName==='SELECT')current.selectedIndex=Math.max(0,Math.min(current.options.length-1,current.selectedIndex+sign));
   else current.value=String(Math.min(Number(current.max||100),Math.max(Number(current.min||0),Number(current.value)+sign*Number(current.step||1))));
   current.dispatchEvent(new Event('input',{bubbles:true}));current.dispatchEvent(new Event('change',{bubbles:true}));return;
  }
  // Geometric navigation handles both horizontal tabs and vertical option lists.
  const r=current.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;
  let candidate=null,best=Infinity;
  for(const el of all){if(el===current)continue;const q=el.getBoundingClientRect(),dx=q.x+q.width/2-cx,dy=q.y+q.height/2-cy;const primary=direction==='right'?dx:direction==='left'?-dx:direction==='down'?dy:-dy;const cross=direction==='right'||direction==='left'?Math.abs(dy):Math.abs(dx);if(primary<=3)continue;const score=primary+cross*2.5;if(score<best){best=score;candidate=el;}}
  if(candidate)focusItem(candidate);else focusItem(all[(index+(direction==='up'||direction==='left'?-1:1)+all.length)%all.length]);
 }
 function accept(scope){let el=document.activeElement;if(!scope.contains(el)||!visible(el)){el=items(scope)[0];focusItem(el);}if(!el)return;if(el.id==='bigc'){hooks.mapPlace();return;}if(el.matches('button,a,summary,input[type=checkbox],input[type=radio]'))el.click();}
 function poll(dt){
  let pads=[];try{pads=navigator.getGamepads?Array.from(navigator.getGamepads()):[];}catch{}
  const usable=pads.filter(p=>p?.connected).map(core.normalize); // Xbox and PlayStation pads in any browser layout
  const operated=usable.find(p=>p.buttons.some(b=>b.pressed||b.value>.15)||p.axes.slice(0,4).some(a=>Math.abs(a)>.3));
  let pad=operated||usable.find(p=>p.index===activeIndex)||usable[0]||null;
  if(operated){lastSource='pad';rawPad=operated.raw||operated;}else if(pad&&!rawPad)rawPad=pad.raw||pad;
  if(!focused||document.hidden)pad=null;
  state=core.sample(pad,previous);
  if(state.connected&&state.index!==activeIndex){activeIndex=state.index;blocked=true;}
  if(previous.connected&&!state.connected){hooks?.pause();clear();activeIndex=-1;status.textContent='Controller disconnected · paused';return;}
  previous=state;
  family=state.connected?state.family:'';
  const text=state.connected?(family==='xbox'?'Xbox controller connected':family==='ps'?'PlayStation controller connected':'Controller connected'):'Controller ready · connect and press a button';
  if(text!==status.textContent){status.textContent=text;if(state.connected&&!previousAnnounced){previousAnnounced=true;hooks?.toast?.(text+' · '+(family==='ps'?'✕':'A')+' interacts, '+(family==='ps'?'△':'Y')+' gets in or out',3);}}
  if(!state.connected)previousAnnounced=false;
  if(!state.connected||!state.standard||!hooks)return;
  const scope=hooks.scope();
  if(scope!==scopeBefore){scopeBefore=scope;blocked=true;navDirection='';if(scope)focusItem(scope.id==='bigmap'?document.getElementById('bigc'):items(scope)[0]);}
  if(scope){
   blocked=true;
   if(state.pressed[9]||state.pressed[1]){hooks.back();return;}
   if(state.pressed[8]){hooks.map();return;}
   if(scope.id==='bigmap'&&document.activeElement?.id==='bigc')hooks.mapMove(core.axis(pad.axes?.[0]),core.axis(pad.axes?.[1]),dt);
   let direction=state.buttons[12]?'up':state.buttons[13]?'down':state.buttons[14]?'left':state.buttons[15]?'right':null;
   if(!direction&&!(scope.id==='bigmap'&&document.activeElement?.id==='bigc')){const x=pad.axes?.[0]||0,y=pad.axes?.[1]||0;if(Math.abs(x)>.55||Math.abs(y)>.55)direction=Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up');}
   const now=performance.now();if(direction&&(direction!==navDirection||now>navAt)){navigate(scope,direction);navAt=now+(direction!==navDirection?350:140);}navDirection=direction;
   if(state.pressed[0])accept(scope);
   return;
  }
  if(state.pressed[9]){hooks.pause();return;}if(state.pressed[8]){hooks.map();return;}
  if(hooks.onFoot?.()){hooks.footPad?.(state,pad);return;}
  if(state.pressed[14]||state.pressed[3]&&hooks.slow?.()){hooks.exitVehicle?.();return;}
  // Require neutral controls after reconnecting or closing a menu.
  if(blocked){if(state.throttle<.05&&state.brake<.05&&!state.buttons[0]&&!state.buttons[1]&&Math.abs(state.steer)<.05)blocked=false;else return;}
  if(state.pressed[2])hooks.reset();if(state.pressed[3]||state.pressed[15])hooks.camera();
  if(state.pressed[4])hooks.vehicle(-1);if(state.pressed[5])hooks.vehicle(1);
  if(state.pressed[12])hooks.ramp();if(state.pressed[13])hooks.rampKind();
  if(state.pressed[11])hooks.camp?.();
 }
 const LABELS={xbox:{interact:'A',fire:'RT',aim:'LT',reload:'X',drive:'Y',switch:'LB / RB',menu:'Menu',melee:'B'},ps:{interact:'✕',fire:'R2',aim:'L2',reload:'□',drive:'△',switch:'L1 / R1',menu:'Options',melee:'○'},
  generic:{interact:'A',fire:'RT',aim:'LT',reload:'X',drive:'Y',switch:'LB / RB',menu:'Start',melee:'B'},kb:{interact:'E',fire:'Left click',aim:'Right click',reload:'R',drive:'F',switch:'Tab',menu:'Esc',melee:'Left click'},
  touch:{interact:'USE',fire:'FIRE',aim:'AIM',reload:'⟳',drive:'CAR',switch:'⇄',menu:'Menu',melee:'FIRE'}};
 function source(){if(lastSource==='pad'&&state.connected)return family||'generic';if(lastSource==='touch'||(!lastSource&&document.body.classList.contains('touch')))return 'touch';return 'kb';}
 addEventListener('keydown',()=>{lastSource='kb';},true);addEventListener('mousedown',()=>{if(lastSource!=='touch')lastSource='kb';},true);
 addEventListener('pointerdown',e=>{if(e.pointerType==='touch')lastSource='touch';},true);
 function rumble(strength=.6,ms=120){try{const a=rawPad?.vibrationActuator;if(lastSource!=='pad'||!a)return;if(a.playEffect)a.playEffect('dual-rumble',{duration:ms,strongMagnitude:Math.min(1,strength),weakMagnitude:Math.min(1,strength*.7)}).catch(()=>{});else a.pulse?.(strength,ms);}catch{}}
 window.GOAController={setHooks(value){hooks=value;},poll,source,family:()=>family,label:(action)=>(LABELS[source()]||LABELS.kb)[action]||'',
  hint:(action)=>{const l=(LABELS[source()]||LABELS.kb)[action];return action==='drive'?`${l} to ${window.GOAPlayer?.onFoot?.()?'drive':'step out'}`:l;},rumble,input(){return blocked||!focused||!state.standard?core.empty():state;},diagnostics(){return {...state,blocked};}};
 addEventListener('blur',()=>{focused=false;clear();hooks?.pause();});addEventListener('focus',()=>{focused=true;clear();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();hooks?.pause();}});
 addEventListener('gamepaddisconnected',event=>{if(event.gamepad.index===activeIndex){clear();activeIndex=-1;hooks?.pause();status.textContent='Controller disconnected · paused';}});
})();
