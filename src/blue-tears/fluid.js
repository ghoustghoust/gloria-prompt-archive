import * as THREE from 'three';
import * as S from './shaders.js';

/** A blue fluid with independently settling mica and rising light plumes. */
export class BlueTears {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!this.renderer.extensions.has('EXT_color_buffer_float')) {
      this.renderer.dispose();
      throw new Error('当前设备不支持浮点流体计算，请在开启硬件加速的新版 Chrome、Edge 或 Safari 中打开。');
    }
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      const details = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].join('\n');
      console.error('Blue Tears shader error:', details);
      this.shaderError = details;
    };
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0], 3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,2,0,0,2], 2));
    this.mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial());
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.materials = {};
    this.targets = [];
    this.time = 0;
    this.seedValue = 2.731;
    this.frameCount = 0;
    this.splatCount = 0;
    this.fps = 0;
    this.params = { speed: .8, shimmer: .85, swell: .55, auto: true, palette: 0, paused: false };
    this.tilt = new THREE.Vector2();
    this.targetTilt = new THREE.Vector2();
    this.tiltVelocity = new THREE.Vector2();
    this.effectiveTilt = new THREE.Vector2();
    this.detail = 0; this.targetDetail = 0; this.autoStrength = 1;
    this.pendingSplats = [];
    this.makeMaterials();
    this.makeParticles();
    this.resize();
  }

  material(fragmentShader, values = {}, vertexShader = S.vertex) {
    const uniforms = {};
    for (const [key, value] of Object.entries(values)) uniforms[key] = { value };
    return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthWrite: false, depthTest: false, blending: THREE.NoBlending });
  }

  makeMaterials() {
    const texel = new THREE.Vector2();
    this.texel = texel;
    const m = this.materials;
    m.seed = this.material(S.seed, { uAspect: 1, uSeed: this.seedValue, uVelocity: 0 });
    m.advection = this.material(S.advection, { uVelocity: null, uSource: null, uTexel: texel, uDt: 0, uDecay: 0 });
    m.forces = this.material(S.forces, { uVelocity: null, uLayers: null, uTexel: texel, uDt: 0 });
    m.divergence = this.material(S.divergence, { uVelocity: null, uTexel: texel });
    m.pressure = this.material(S.pressure, { uPressure: null, uDivergence: null, uTexel: texel });
    m.project = this.material(S.project, { uPressure: null, uVelocity: null, uTexel: texel });
    m.splat = this.material(S.splat, { uSource: null, uPoint: new THREE.Vector2(), uForce: new THREE.Vector2(), uRadius: .002, uAspect: 1, uDye: 0, uTime: 0 });
    m.refresh = this.material(S.refresh, { uSource: null, uAspect: 1, uSeed: this.seedValue, uTime: 0, uDt: 0, uAuto: 1 });
    m.surface = this.material(S.surface, { uDye: null, uVelocity: null, uLayers: null, uSuspension:null, uTexel: new THREE.Vector2(), uResolution: new THREE.Vector2(), uTilt: this.effectiveTilt, uTime: 0, uAspect: 1, uShimmer: .85, uPalette: 0, uSeed: this.seedValue, uSwell: .55, uAuto: 1, uDetail: 0 });
    m.layerSplat = this.material(S.layerSplat, {uSource:null,uPoint:new THREE.Vector2(),uAspect:1,uRadius:.015,uAmount:0,uDirection:-1});
    m.layerUpdate = this.material(S.layerUpdate, {uSource:null,uVelocity:null,uTexel:texel,uDt:0});
    m.particleMotion = this.material(S.particleMotion, {uPositions:null,uMotion:null,uVelocity:null,uLayers:null,uTexel:texel,uDt:0,uTime:0,uAuto:1,uAspect:1});
    m.particleUpdate = this.material(S.settlingUpdate, {uPositions:null,uMotion:null,uLayers:null,uDt:0,uAspect:1});
    m.copy = this.material('varying vec2 vUv; uniform sampler2D uSource; void main(){gl_FragColor=texture2D(uSource,vUv);}', { uSource: null });
  }

  target(w, h, type = THREE.HalfFloatType, filter = THREE.LinearFilter) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    this.targets.push(rt);
    return rt;
  }

  pair(w, h, type, filter) {
    return { read: this.target(w,h,type,filter), write: this.target(w,h,type,filter), swap() { [this.read,this.write] = [this.write,this.read]; } };
  }

  pass(material, target, values) {
    if (values) for (const [key, value] of Object.entries(values)) material.uniforms[key].value = value;
    this.mesh.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  makeParticles() {
    const side = window.innerWidth<700?448:640;
    this.particleSide = side;
    const count = side * side;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i=0; i<count; i++) {
      uvs[i*2] = ((i % side) + .5) / side;
      uvs[i*2+1] = (Math.floor(i / side) + .5) / side;
    }
    const seeds=new Float32Array(count*2);
    for(let i=0;i<seeds.length;i++)seeds[i]=Math.random();
    geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,2));
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs,2));
    this.particleMaterial = this.material(S.particleFragment, { uPositions: null, uDye: null, uVelocity: null, uTime: 0, uPixelRatio: 1, uShimmer: .85, uPalette: 0, uTilt: this.effectiveTilt, uAspect: 1, uSwell: .55, uAuto: 1, uSeed: this.seedValue, uDetail: 0 }, S.particleVertex);
    this.particleMaterial.transparent = true;
    this.particleMaterial.blending = THREE.NormalBlending;
    this.particleScene = new THREE.Scene();
    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.particles.frustumCulled = false;
    this.particleScene.add(this.particles);
    // A quarter of the grains is sufficient for a smooth concentration field.
    const densityCount=Math.ceil(count/4),densityUvs=new Float32Array(densityCount*2),densitySeeds=new Float32Array(densityCount*2);
    for(let i=0;i<densityCount;i++){
      densityUvs.set(uvs.subarray(i*8,i*8+2),i*2);densitySeeds.set(seeds.subarray(i*8,i*8+2),i*2);
    }
    const densityGeometry=new THREE.BufferGeometry();
    densityGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(densityCount*3),3));
    densityGeometry.setAttribute('uv',new THREE.BufferAttribute(densityUvs,2));
    densityGeometry.setAttribute('aSeed',new THREE.BufferAttribute(densitySeeds,2));
    this.densityMaterial=this.material(S.densityFragment,{uPositions:null,uTime:0,uAspect:1,uSwell:.55,uAuto:1,uTilt:this.effectiveTilt},S.densityVertex);
    this.densityMaterial.blending=THREE.AdditiveBlending;
    this.densityMaterial.transparent=true;
    this.densityPoints=new THREE.Points(densityGeometry,this.densityMaterial);this.densityPoints.frustumCulled=false;
    this.densityScene=new THREE.Scene();this.densityScene.add(this.densityPoints);
    const bubbleGeometry=new THREE.BufferGeometry();
    const bubbleSeeds=new Float32Array(160*3);
    for(let i=0;i<bubbleSeeds.length;i++)bubbleSeeds[i]=Math.random();
    bubbleGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(160*3),3));
    bubbleGeometry.setAttribute('aSeed',new THREE.BufferAttribute(bubbleSeeds,3));
    this.bubbleMaterial=this.material(S.bubbleFragment,{uLayers:null,uTime:0,uPixelRatio:1},S.bubbleVertex);
    this.bubbleMaterial.transparent=true;this.bubbleMaterial.blending=THREE.AdditiveBlending;
    this.bubbles=new THREE.Points(bubbleGeometry,this.bubbleMaterial);
    this.bubbles.frustumCulled=false;
    this.particleScene.add(this.bubbles);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w; this.height = h; this.aspect = w/h;
    // Pixel and simulation budgets are independent of high-DPI phone displays.
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, w<700 ? 1.25 : 1);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w,h,false);
    const simShort = w<700 ? 176 : 224;
    const simW = this.aspect>=1 ? Math.round(simShort*this.aspect) : simShort;
    const simH = this.aspect>=1 ? simShort : Math.round(simShort/this.aspect);
    const dyeLong = w<700 ? 1024 : 1408;
    const dyeW = this.aspect>=1 ? dyeLong : Math.round(dyeLong*this.aspect);
    const dyeH = this.aspect>=1 ? Math.round(dyeLong/this.aspect) : dyeLong;
    this.targets.forEach(t=>t.dispose()); this.targets=[];
    this.velocity = this.pair(simW,simH);
    // Full precision keeps slow pigment relaxation free from quantized ridges.
    const dyeType=this.renderer.extensions.has('OES_texture_float_linear')?THREE.FloatType:THREE.HalfFloatType;
    this.dye = this.pair(dyeW,dyeH,dyeType);
    this.layers = this.pair(simW,simH,dyeType);
    this.suspension = this.target(simW,simH,THREE.HalfFloatType);
    this.pressure = this.pair(simW,simH,THREE.HalfFloatType,THREE.NearestFilter);
    this.divergence = this.target(simW,simH,THREE.HalfFloatType,THREE.NearestFilter);
    this.particleState = this.pair(this.particleSide,this.particleSide,THREE.FloatType,THREE.NearestFilter);
    this.particleMotionState = this.pair(this.particleSide,this.particleSide,THREE.FloatType,THREE.NearestFilter);
    this.texel.set(1/simW,1/simH);
    this.materials.surface.uniforms.uTexel.value.set(1/dyeW,1/dyeH);
    this.materials.surface.uniforms.uResolution.value.set(w*this.pixelRatio,h*this.pixelRatio);
    for (const m of Object.values(this.materials)) if(m.uniforms.uAspect) m.uniforms.uAspect.value = this.aspect;
    this.reset(false);
  }

  reset(newSeed = true) {
    if(newSeed) this.seedValue = Math.random()*30;
    this.time=0;this.detail=0;this.targetDetail=0;this.tiltVelocity.set(0,0);this.effectiveTilt.set(0,0);
    this.pendingSplats.length=0;
    this.targetTilt.set(0,0); this.tilt.set(0,0);
    for (const m of Object.values(this.materials)) if(m.uniforms.uSeed) m.uniforms.uSeed.value = this.seedValue;
    this.pass(this.materials.seed,this.dye.read,{uVelocity:0});
    this.pass(this.materials.seed,this.velocity.read,{uVelocity:1});
    for(const target of [this.pressure.read,this.pressure.write,this.layers.read,this.layers.write,this.particleMotionState.read,this.particleMotionState.write]){
      this.renderer.setRenderTarget(target); this.renderer.clear();
    }
    const data = new Float32Array(this.particleSide*this.particleSide*4);
    for(let i=0;i<data.length;i+=4){data[i]=Math.random()*1.2-.1;data[i+1]=Math.random()*1.2-.1;data[i+2]=0;data[i+3]=Math.random()*Math.PI*2;}
    const texture = new THREE.DataTexture(data,this.particleSide,this.particleSide,THREE.RGBAFormat,THREE.FloatType);
    texture.needsUpdate=true;
    this.pass(this.materials.copy,this.particleState.read,{uSource:texture});
    texture.dispose();
    this.render();
  }

  disturb(x,y,dx,dy,force=1) {
    if(this.params.paused) return;
    // Bounded queue avoids unbounded work when pointer events outpace rendering.
    if(this.pendingSplats.length>=8) this.pendingSplats.shift();
    const point=this.materialPoint(x,y);
    const previous=this.materialPoint(x-dx,y-dy);
    this.pendingSplats.push({x:point.x,y:point.y,dx:point.x-previous.x,dy:point.y-previous.y,force});
  }

  materialPoint(x,y) {
    // Invert the same bounded sheet deformation used by the surface shader.
    const sx=(x-.5)*this.aspect,sy=y-.5;
    let px=sx,py=sy;
    const a=(.6+this.params.swell*.95)*this.autoStrength,t=this.time;
    for(let i=0;i<4;i++) {
      const ox=(Math.sin(py*2.5+px*.55-t*.67)*.070+Math.sin(py*1.15-px*.7+t*.37+1.7)*.018)*a+this.effectiveTilt.x*(.11+.035*py);
      const oy=(Math.sin(px*2-py*.40+t*.53+1.2)*.052+Math.cos(py*1.5+px*.60-t*.36)*.016)*a+this.effectiveTilt.y*(.085+.024*px);
      px=sx-ox;py=sy-oy;
    }
    return {x:THREE.MathUtils.clamp(px/this.aspect+.5,.001,.999),y:THREE.MathUtils.clamp(py+.5,.001,.999)};
  }

  applySplat(s) {
    const m=this.materials.splat;
    const gain=720*s.force;
    const maxForce=34;
    m.uniforms.uPoint.value.set(s.x,s.y);
    m.uniforms.uForce.value.set(THREE.MathUtils.clamp(s.dx*gain,-maxForce,maxForce),THREE.MathUtils.clamp(s.dy*gain,-maxForce,maxForce));
    const radius=.012+this.params.swell*.009;
    this.pass(m,this.velocity.write,{uSource:this.velocity.read.texture,uRadius:radius,uDye:0,uTime:this.time});this.velocity.swap();
    this.pass(m,this.dye.write,{uSource:this.dye.read.texture,uDye:1});this.dye.swap();
    const layer=this.materials.layerSplat;
    layer.uniforms.uPoint.value.copy(m.uniforms.uPoint.value);
    const amount=Math.min(.40,.075+Math.hypot(s.dx*this.aspect,s.dy)*10)*s.force;
    this.pass(layer,this.layers.write,{uSource:this.layers.read.texture,uRadius:radius,uAmount:amount,uDirection:s.dy/(Math.hypot(s.dx*this.aspect,s.dy)+.0001)});this.layers.swap();
    this.splatCount++;
  }

  step(dt) {
    if(this.params.paused) return;
    dt=Math.min(dt,1/30)*this.params.speed;
    this.time+=dt;
    this.tiltVelocity.x+=(this.targetTilt.x-this.tilt.x)*5.5*dt;
    this.tiltVelocity.y+=(this.targetTilt.y-this.tilt.y)*5.5*dt;
    this.tiltVelocity.multiplyScalar(Math.exp(-3.6*dt));
    this.tilt.addScaledVector(this.tiltVelocity,dt);
    this.detail=THREE.MathUtils.damp(this.detail,this.targetDetail,this.targetDetail>this.detail?5.:.85,dt);
    this.autoStrength=THREE.MathUtils.damp(this.autoStrength,this.params.auto?1:0,2,dt);
    const rock=this.autoStrength*(.10+this.params.swell*.13);
    this.effectiveTilt.set(this.tilt.x+Math.sin(this.time*.31)*rock,this.tilt.y+Math.sin(this.time*.23+1.8)*rock*.72);
    const m=this.materials;
    this.pass(m.advection,this.velocity.write,{uSource:this.velocity.read.texture,uVelocity:this.velocity.read.texture,uDt:dt,uDecay:.85});this.velocity.swap();
    while(this.pendingSplats.length) this.applySplat(this.pendingSplats.shift());
    this.pass(m.layerUpdate,this.layers.write,{uSource:this.layers.read.texture,uVelocity:this.velocity.read.texture,uDt:dt});this.layers.swap();
    this.pass(m.forces,this.velocity.write,{uVelocity:this.velocity.read.texture,uLayers:this.layers.read.texture,uDt:dt});this.velocity.swap();
    this.pass(m.divergence,this.divergence,{uVelocity:this.velocity.read.texture});
    // Reuse the previous pressure as the Jacobi initial guess.
    for(let i=0;i<14;i++){
      this.pass(m.pressure,this.pressure.write,{uPressure:this.pressure.read.texture,uDivergence:this.divergence.texture});this.pressure.swap();
    }
    this.pass(m.project,this.velocity.write,{uPressure:this.pressure.read.texture,uVelocity:this.velocity.read.texture});this.velocity.swap();
    this.pass(m.advection,this.dye.write,{uSource:this.dye.read.texture,uVelocity:this.velocity.read.texture,uDt:dt,uDecay:0});this.dye.swap();
    this.pass(m.refresh,this.dye.write,{uSource:this.dye.read.texture,uTime:this.time,uDt:dt,uAuto:this.params.auto?1:0});this.dye.swap();
    this.pass(m.particleMotion,this.particleMotionState.write,{uPositions:this.particleState.read.texture,uMotion:this.particleMotionState.read.texture,uVelocity:this.velocity.read.texture,uLayers:this.layers.read.texture,uDt:dt,uTime:this.time,uAuto:this.autoStrength});this.particleMotionState.swap();
    this.pass(m.particleUpdate,this.particleState.write,{uPositions:this.particleState.read.texture,uMotion:this.particleMotionState.read.texture,uLayers:this.layers.read.texture,uDt:dt});this.particleState.swap();
  }

  render() {
    const density=this.densityMaterial.uniforms;
    density.uPositions.value=this.particleState.read.texture;density.uTime.value=this.time;density.uAspect.value=this.aspect;
    density.uSwell.value=this.params.swell;density.uAuto.value=this.autoStrength;
    this.renderer.setRenderTarget(this.suspension);this.renderer.render(this.densityScene,this.camera);
    this.pass(this.materials.surface,null,{uDye:this.dye.read.texture,uVelocity:this.velocity.read.texture,uLayers:this.layers.read.texture,uSuspension:this.suspension.texture,uTime:this.time,uShimmer:this.params.shimmer,uPalette:this.params.palette,uSwell:this.params.swell,uAuto:this.autoStrength,uDetail:this.detail});
    const u=this.particleMaterial.uniforms;
    u.uPositions.value=this.particleState.read.texture;u.uDye.value=this.dye.read.texture;u.uVelocity.value=this.velocity.read.texture;u.uPalette.value=this.params.palette;
    u.uTime.value=this.time;u.uPixelRatio.value=this.pixelRatio;u.uShimmer.value=this.params.shimmer;u.uAspect.value=this.aspect;u.uSwell.value=this.params.swell;u.uAuto.value=this.autoStrength;u.uSeed.value=this.seedValue;u.uDetail.value=this.detail;
    this.bubbleMaterial.uniforms.uLayers.value=this.layers.read.texture;
    this.bubbleMaterial.uniforms.uTime.value=this.time;
    this.bubbleMaterial.uniforms.uPixelRatio.value=this.pixelRatio;
    this.renderer.autoClear=false;
    this.renderer.render(this.particleScene,this.camera);
    this.renderer.autoClear=true;
    this.frameCount++;
  }

  get stats() {
    return {appearanceVersion:6,motion:'dense iridescent suspension + reversible lift',detail:Math.round(this.detail*100)/100,targetDetail:this.targetDetail,time:Math.round(this.time*100)/100,frames:this.frameCount,fps:this.fps,splats:this.splatCount,paused:this.params.paused,auto:this.params.auto,palette:this.params.palette,shimmer:this.params.shimmer,swell:this.params.swell,tilt:this.tilt.toArray(),simulation:[this.velocity.read.width,this.velocity.read.height],pigment:[this.dye.read.width,this.dye.read.height],particles:this.particleSide**2,pixelRatio:this.pixelRatio,shaderError:this.shaderError||null,textures:this.renderer.info.memory.textures};
  }

  inspectParticles() {
    const buffer=new Float32Array(this.particleSide*this.particleSide*4);
    this.renderer.readRenderTargetPixels(this.particleState.read,0,0,this.particleSide,this.particleSide,buffer);
    const samples=[];
    for(let i=0;i<this.particleSide*this.particleSide;i+=257){
      samples.push({id:i,x:buffer[i*4],y:buffer[i*4+1],settling:buffer[i*4+2],pitch:buffer[i*4+3]});
    }
    return {time:this.time,samples};
  }

  inspectLayers() {
    const target=this.layers.read;
    const half=target.texture.type===THREE.HalfFloatType;
    const data=half?new Uint16Array(target.width*target.height*4):new Float32Array(target.width*target.height*4);
    this.renderer.readRenderTargetPixels(target,0,0,target.width,target.height,data);
    const totals=[{mass:0,y:0},{mass:0,y:0},{mass:0,y:0}];
    for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++)for(let c=0;c<3;c++){
      const raw=data[(y*target.width+x)*4+c],value=half?THREE.DataUtils.fromHalfFloat(raw):raw;
      totals[c].mass+=value;totals[c].y+=value*(y+.5)/target.height;
    }
    return {time:this.time,down:totals[0].mass?totals[0].y/totals[0].mass:null,up:totals[1].mass?totals[1].y/totals[1].mass:null,lift:totals[2].mass?totals[2].y/totals[2].mass:null,mass:totals.map(t=>t.mass)};
  }

  dispose() {
    this.targets.forEach(t=>t.dispose());
    Object.values(this.materials).forEach(m=>m.dispose());
    this.geometry.dispose();this.particleMaterial.dispose();this.particles.geometry.dispose();
    this.bubbleMaterial.dispose();this.bubbles.geometry.dispose();
    this.densityMaterial.dispose();this.densityPoints.geometry.dispose();
    this.renderer.dispose();
  }
}
