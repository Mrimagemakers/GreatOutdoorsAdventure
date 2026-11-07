/* Gamepad input shared by Xbox and PlayStation controllers.
   Browsers usually report both in the "standard" layout. Some (Firefox, older Safari, Bluetooth PlayStation pads on
   Windows, Xbox pads on Linux) report a raw layout instead; normalize() rewrites those into the standard order so every
   other module can use one set of button numbers:
   0 A/✕  1 B/○  2 X/□  3 Y/△  4 LB/L1  5 RB/R1  6 LT/L2  7 RT/R2  8 View/Share  9 Menu/Options  10 L3  11 R3
   12-15 D-pad up, down, left, right  16 Xbox/PS button.  Axes: 0,1 left stick, 2,3 right stick. */
(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(n)?n:0));
 function axis(value,deadzone=.18){value=clamp(value,-1,1);return Math.abs(value)<=deadzone?0:Math.sign(value)*(Math.abs(value)-deadzone)/(1-deadzone);}
 function empty(){return {connected:false,id:'',index:-1,standard:false,family:'',steer:0,throttle:0,brake:0,handbrake:0,nitro:0,lookX:0,lookY:0,buttons:Array(17).fill(false),pressed:Array(17).fill(false)};}
 function familyOf(id){id=String(id||'').toLowerCase();if(/xbox|045e|xinput|x-box|microsoft/.test(id))return 'xbox';if(/054c|sony|playstation|dualshock|dualsense|wireless controller|ps4|ps5/.test(id))return 'ps';return 'generic';}
 const triggerSeen=new Map();
 function trig(index,ai,v){ // raw trigger axes rest at -1 once moved; some browsers report 0 until the first pull
  const key=index+':'+ai;if(v<-.5)triggerSeen.set(key,true);return clamp(triggerSeen.get(key)?(v+1)/2:Math.max(0,v),0,1);
 }
 function hat(v){ // DirectInput POV hat packed in one axis: up -1, right -0.43, down 0.14, left 0.71, idle > 1
  if(!Number.isFinite(v)||Math.abs(v)>1.05)return [false,false,false,false];
  const dirs=[[-1,'u'],[-.714,'ur'],[-.428,'r'],[-.143,'dr'],[.143,'d'],[.428,'dl'],[.714,'l'],[1,'ul']];
  let best=dirs[0],bd=9;for(const d of dirs){const e=Math.abs(d[0]-v);if(e<bd){bd=e;best=d;}}
  const s=best[1];return [s.includes('u'),s.includes('d'),s.includes('l'),s.includes('r')];
 }
 const B=(pressed,value)=>({pressed:!!pressed,value:clamp(value??(pressed?1:0),0,1)});
 /** A standard-layout view of any connected pad. */
 function normalize(pad){
  if(!pad||pad.mapping==='standard')return pad;
  const fam=familyOf(pad.id),rb=i=>pad.buttons?.[i],ax=i=>pad.axes?.[i]??0,pr=i=>!!(rb(i)?.pressed||(rb(i)?.value||0)>.5);
  const btn=Array.from({length:17},()=>B(false,0));let axes=[ax(0),ax(1),ax(2),ax(3)];
  if(fam==='ps'){
   // raw: 0 □ 1 ✕ 2 ○ 3 △ 4 L1 5 R1 6 L2 7 R2 8 Share 9 Options 10 L3 11 R3 12 PS 13 Touchpad; sticks 0,1 and 2,5; triggers 3,4
   const map={0:1,1:2,2:0,3:3,4:4,5:5,8:8,9:9,10:10,11:11,16:12};for(const [s,r] of Object.entries(map))btn[s]=B(pr(r),rb(r)?.value);
   const l2=Math.max(rb(6)?.value||0,pad.axes.length>4?trig(pad.index,3,ax(3)):0),r2=Math.max(rb(7)?.value||0,pad.axes.length>4?trig(pad.index,4,ax(4)):0);
   btn[6]=B(l2>.3||pr(6),l2);btn[7]=B(r2>.3||pr(7),r2);
   axes=[ax(0),ax(1),ax(2),pad.axes.length>5?ax(5):ax(3)];
   const h=pad.axes.length>9?hat(ax(9)):[pr(14),pr(15),pr(16),pr(17)];[12,13,14,15].forEach((s,i)=>{btn[s]=B(h[i]);});
  }else if(fam==='xbox'){
   // raw (Linux xpad, Firefox): 0 A 1 B 2 X 3 Y 4 LB 5 RB 6 View 7 Menu 8 Guide 9 LS 10 RS; axes 0,1 left, 2 LT, 3,4 right, 5 RT, 6,7 D-pad
   const map={0:0,1:1,2:2,3:3,4:4,5:5,8:6,9:7,10:9,11:10,16:8};for(const [s,r] of Object.entries(map))btn[s]=B(pr(r),rb(r)?.value);
   const lt=pad.axes.length>5?trig(pad.index,2,ax(2)):0,rt=pad.axes.length>5?trig(pad.index,5,ax(5)):0;btn[6]=B(lt>.3,lt);btn[7]=B(rt>.3,rt);
   axes=pad.axes.length>5?[ax(0),ax(1),ax(3),ax(4)]:axes;
   if(pad.axes.length>7){btn[12]=B(ax(7)<-.5);btn[13]=B(ax(7)>.5);btn[14]=B(ax(6)<-.5);btn[15]=B(ax(6)>.5);}
  }else{
   for(let i=0;i<17;i++)btn[i]=B(pr(i),rb(i)?.value);
  }
  return {id:pad.id,index:pad.index,connected:pad.connected!==false,mapping:'standard',raw:pad,buttons:btn,axes,timestamp:pad.timestamp};
 }
 function sample(raw,previous=empty()){
  if(!raw||raw.connected===false)return empty();
  const pad=normalize(raw),standard=pad.mapping==='standard';
  const value=i=>clamp(pad.buttons?.[i]?.value??(pad.buttons?.[i]?.pressed?1:0),0,1);
  const buttons=Array.from({length:17},(_,i)=>!!pad.buttons?.[i]?.pressed||value(i)>.5);
  const same=previous.connected&&previous.index===pad.index&&previous.id===pad.id;
  const result={connected:true,id:pad.id||'Controller',index:pad.index,standard,family:familyOf(pad.id),steer:0,throttle:0,brake:0,handbrake:0,nitro:0,lookX:0,lookY:0,buttons,pressed:buttons.map((down,i)=>down&&!(same&&previous.buttons[i]))};
  if(!standard)return result;
  Object.assign(result,{steer:axis(pad.axes?.[0]),throttle:value(7),brake:value(6),handbrake:value(0),nitro:value(1),lookX:axis(pad.axes?.[2]),lookY:axis(pad.axes?.[3])});
  return result;
 }
 root.GOAControllerCore={axis,empty,sample,normalize,familyOf};
 if(typeof module!=='undefined')module.exports=root.GOAControllerCore;
})(typeof window!=='undefined'?window:globalThis);
