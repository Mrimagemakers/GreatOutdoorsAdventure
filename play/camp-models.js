(function(){
 'use strict';
 window.GOACamp={create(T,ids){
  const root=new T.Group();root.name='Expedition campsite';
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.8});
  const red=mat('#9b3028'),blue=mat('#244f92'),green=mat('#53633c'),metal=mat('#88928a'),wood=mat('#a88657'),black=mat('#242a26'),tan=mat('#c6b894');
  function box(parent,x,y,z,w,h,d,m){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function cyl(parent,x,y,z,r,h,m){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,20),m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
  for(const id of ids){const g=new T.Group();g.name=id;
   if(id==='tent'){
    // Open-front pitched shelter: independent cloth panels leave a visible entrance.
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-1.3,0,1.4,0,1.8,1.4,-1.3,0,-1.4,0,1.8,1.4,0,1.8,-1.4,-1.3,0,-1.4,1.3,0,1.4,1.3,0,-1.4,0,1.8,1.4,0,1.8,1.4,1.3,0,-1.4,0,1.8,-1.4,-1.3,0,-1.4,0,1.8,-1.4,1.3,0,-1.4],3));geo.computeVertexNormals();const cloth=red.clone();cloth.side=T.DoubleSide;const mesh=new T.Mesh(geo,cloth);mesh.castShadow=true;g.add(mesh);box(g,0,.025,0,2.6,.05,2.8,black);g.position.set(-2.6,0,-1);
   }else if(id==='table'){
    box(g,0,.75,0,1.5,.07,.85,wood);for(const x of [-.6,.6])for(const z of [-.3,.3])box(g,x,.36,z,.045,.72,.045,metal);
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#e9e4d5';ctx.fillRect(0,0,64,64);ctx.fillStyle='#b92e2d';for(let x=0;x<8;x++)for(let y=0;y<8;y++)if((x+y)%2===0)ctx.fillRect(x*8,y*8,8,8);const texture=new T.CanvasTexture(c);box(g,-.15,.795,0,.8,.012,.86,new T.MeshStandardMaterial({map:texture,roughness:1}));g.position.set(.2,0,0);
   }else if(id==='chair'){
    box(g,0,.46,0,.6,.05,.55,blue);box(g,0,.84,-.25,.6,.7,.04,blue);for(const x of [-.3,.3]){box(g,x,.3,0,.035,.6,.5,metal);box(g,x,.7,0,.045,.035,.6,wood);}g.position.set(1.9,0,1);g.rotation.y=-.6;
   }else if(id==='stove'){
    cyl(g,0,.13,0,.13,.26,black);cyl(g,0,.32,0,.22,.08,metal);cyl(g,0,.51,0,.2,.29,metal);cyl(g,0,.66,0,.23,.025,black);g.position.set(.5,0,2);
   }else if(id==='pack'){
    box(g,0,.43,0,.48,.85,.3,green);box(g,0,.35,.2,.38,.35,.12,green);for(const x of [-.16,.16])box(g,x,.43,.165,.055,.85,.03,wood);g.position.set(-1,0,1.7);
   }else if(id==='bedroll'){
    const roll=cyl(g,0,.2,0,.2,.7,tan);roll.rotation.z=Math.PI/2;g.position.set(-2,0,1.8);
   }else if(id==='lantern'){
    cyl(g,0,.06,0,.15,.12,green);cyl(g,0,.35,0,.13,.06,green);const glow=new T.MeshStandardMaterial({color:'#f2d287',emissive:'#f2b349',emissiveIntensity:.5,transparent:true,opacity:.8});cyl(g,0,.21,0,.1,.26,glow);for(const x of [-.12,.12])box(g,x,.22,0,.025,.32,.025,metal);g.position.set(1.3,0,-1.1);const light=new T.PointLight('#ffcf83',2,5);light.position.y=.3;g.add(light);
   }else if(id==='thermos'){
    cyl(g,0,.22,0,.09,.44,wood);cyl(g,0,.47,0,.095,.06,metal);g.position.set(-.6,0,1.2);
   }else if(id==='container'){
    box(g,0,.18,0,.45,.36,.4,green);box(g,0,.37,0,.49,.04,.44,green);g.position.set(.9,0,1.1);
   }
   root.add(g);
  }
  return root;
 },dispose(group){group.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){m?.map?.dispose();m?.dispose();}});}};
})();
