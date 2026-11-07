/* Standard browser Gamepad mapping shared by Xbox and PlayStation controllers. */
(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(n)?n:0));
 function axis(value,deadzone=.18){value=clamp(value,-1,1);return Math.abs(value)<=deadzone?0:Math.sign(value)*(Math.abs(value)-deadzone)/(1-deadzone);}
 function empty(){return {connected:false,id:'',index:-1,standard:false,steer:0,throttle:0,brake:0,handbrake:0,nitro:0,lookX:0,lookY:0,buttons:Array(17).fill(false),pressed:Array(17).fill(false)};}
 function sample(pad,previous=empty()){
  if(!pad||pad.connected===false)return empty();
  const standard=pad.mapping==='standard';
  const value=i=>clamp(pad.buttons?.[i]?.value??(pad.buttons?.[i]?.pressed?1:0),0,1);
  const buttons=Array.from({length:17},(_,i)=>!!pad.buttons?.[i]?.pressed||value(i)>.5);
  const same=previous.connected&&previous.index===pad.index&&previous.id===pad.id;
  const result={connected:true,id:pad.id||'Controller',index:pad.index,standard,steer:0,throttle:0,brake:0,handbrake:0,nitro:0,lookX:0,lookY:0,buttons,pressed:buttons.map((down,i)=>down&&!(same&&previous.buttons[i]))};
  if(!standard)return result;
  Object.assign(result,{steer:axis(pad.axes?.[0]),throttle:value(7),brake:value(6),handbrake:value(0),nitro:value(1),lookX:axis(pad.axes?.[2]),lookY:axis(pad.axes?.[3])});
  return result;
 }
 root.GOAControllerCore={axis,empty,sample};
 if(typeof module!=='undefined')module.exports=root.GOAControllerCore;
})(typeof window!=='undefined'?window:globalThis);
