import * as THREE from './assets/three.module.min.js';

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 720px)');
const mouse = matchMedia('(hover: hover) and (pointer: fine)');

export function mountScene(surface, start) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  surface.append(renderer.domElement);

  const world = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  const material = (color, metalness = .12, roughness = .76) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const plinth = material(0x33445a), edge = material(0x243449);
  const road = material(0x172436, .13, .87), walk = material(0x52667a);
  const curb = material(0x758598), seams = material(0x34475b);
  const metal = material(0x415365, .49, .39), dark = material(0x182632, .35, .55);
  const steel = material(0x8fa9bd, .34, .47), panel = material(0x9cb2c3, .32, .52);
  const print = material(0xbac4c5);
  const emitter = new THREE.MeshStandardMaterial({ color: 0x745a37, emissive: 0xffbe61, emissiveIntensity: 0 });

  function mesh(geometry, mat, x, y, z, shadow = false) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = shadow;
    object.receiveShadow = true;
    world.add(object);
    return object;
  }
  function box(w, h, d, x, y, z, mat, shadow = false) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, shadow);
  }
  function cylinder(top, bottom, h, x, y, z, mat, shadow = false) {
    return mesh(new THREE.CylinderGeometry(top, bottom, h, 14), mat, x, y, z, shadow);
  }

  box(7.6,.31,5.3,0,-.24,0,plinth);
  box(7.69,.065,5.39,0,-.12,0,edge);
  box(7.59,.11,5.29,0,-.055,0,road);
  box(7.61,.16,2.38,0,.08,-1.45,walk);
  box(7.61,.18,.15,0,.09,-.23,curb);
  box(7.6,.019,.028,0,.012,-.046,seams);

  for (let x = -3.28; x < 3.7; x += .93) {
    box(.013,.002,2.22,x,.162,-1.47,seams);
    box(.015,.002,.15,x,.181,-.23,seams);
  }
  box(7.59,.002,.012,0,.162,-1.42,seams);
  const paint = material(0x7f7661);
  for (const x of [-2.65,-.89,.88,2.66]) box(.87,.003,.046,x,.003,1.49,paint);
  box(7.26,.003,.022,0,.003,2.28,material(0x38465a));

  const grate = material(0x192636);
  box(.58,.008,.24,2.68,.008,.085,grate);
  for (let x = 2.45; x <= 2.91; x += .066) box(.022,.005,.203,x,.013,.085,seams);

  cylinder(.27,.31,.105,-1.52,.215,-.91,dark,true);
  cylinder(.19,.22,.19,-1.52,.35,-.91,metal,true);
  cylinder(.087,.115,3.68,-1.52,2.20,-.91,metal,true);
  const armPath = new THREE.Path().moveTo(-1.52,3.96)
    .quadraticCurveTo(-1.52,4.65,-.82,4.65).lineTo(.93,4.65);
  const arm = new THREE.CatmullRomCurve3(
    armPath.getPoints(14).map(p => new THREE.Vector3(p.x, p.y, -.91))
  );
  mesh(new THREE.TubeGeometry(arm, 36, .084, 10, false), metal, 0,0,0,true);
  box(1.2,.13,.45,.81,4.69,-.91,metal,true);
  box(1.05,.052,.36,.85,4.61,-.91,dark);
  box(.92,.026,.285,.87,4.579,-.91,emitter);
  box(.29,.045,.44,.29,4.765,-.91,steel);
  box(.19,.37,.029,-1.52,.68,-.811,dark);
  box(.065,.034,.031,-1.52,.6,-.79,steel);

  const cx = 1.55, cz = -.87;
  box(1.38,.10,.92,cx,.21,cz,dark,true);
  box(1.24,1.31,.73,cx,.905,cz,steel,true);
  box(1.32,.09,.8,cx,1.59,cz,panel,true);
  box(1.13,1.17,.028,cx,.899,cz+.38,dark);
  box(1.08,1.11,.035,cx,.899,cz+.404,panel,true);
  box(.089,.23,.054,cx+.38,.94,cz+.432,dark);
  box(.04,.104,.024,cx+.38,.965,cz+.466,steel);
  box(.26,.093,.013,cx-.27,1.28,cz+.428,dark);
  for (let i = 0; i < 2; ++i) {
    const light = new THREE.MeshStandardMaterial({
      color: i ? 0x39836e : 0xffcd6c,
      emissive: i ? 0x74d6ae : 0xffb752, emissiveIntensity: .65
    });
    cylinder(.021,.021,.012,cx-.327+i*.095,1.28,cz+.441,light).rotation.x = Math.PI/2;
  }
  for (let i = 0; i < 4; ++i) box(.44,.011,.012,cx-.21,.555+i*.052,cz+.43,seams);
  box(.216,.124,.008,cx-.22,1.048,cz+.426,print);
  for (let i = 0; i < 2; ++i) box(.133,.008,.009,cx-.22,1.03+i*.034,cz+.432,dark);
  for (let i = 0; i < 5; ++i) box(.009,.023,.31,cx+.626,1.32-i*.055,cz,seams);

  const ambient = new THREE.HemisphereLight(0xaac9fa,0x3e5069,1.72);
  world.add(ambient);
  const fill = new THREE.DirectionalLight(0x94aee4,1.08);
  fill.position.set(-5,4,-5);
  world.add(fill);

  const reflected = new THREE.PointLight(0xffa746,0,3.8,2);
  reflected.position.set(.72,.53,.48);
  world.add(reflected);

  const spot = new THREE.SpotLight(0xffc17b,0,13,.83,.78,1.65);
  spot.position.set(.87,4.54,-.91);
  spot.target.position.set(.97,0,.34);
  spot.castShadow = true;
  const shadowSize = narrow.matches ? 512 : 1024;
  spot.shadow.mapSize.set(shadowSize,shadowSize);
  spot.shadow.camera.near = .35;
  spot.shadow.camera.far = 10;
  spot.shadow.bias = -.00025;
  spot.shadow.normalBias = .022;
  world.add(spot,spot.target);

  function glowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,210,120,1)');
    gradient.addColorStop(.24,'rgba(255,190,95,.65)');
    gradient.addColorStop(.58,'rgba(255,176,86,.14)');
    gradient.addColorStop(1,'rgba(255,169,67,0)');
    context.fillStyle = gradient;
    context.fillRect(0,0,128,128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map:glowTexture(), transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  halo.position.set(.87,4.56,-.71);
  halo.scale.set(2.32,1.04,1);
  world.add(halo);

  let frame = 0;
  let begin;
  let active = true;
  let hovered = false;
  let x = 0, y = 0, targetX = 0, targetY = 0, boost = 0;
  let width = 1, height = 1;

  function draw(timestamp) {
    frame = 0;
    if (!active || document.hidden) return;
    begin ??= timestamp;
    const progress = motion.matches ? 1 : THREE.MathUtils.clamp((timestamp-begin-110)/1200,0,1);
    const lit = progress * progress * (3 - 2 * progress);
    const move = !narrow.matches && !motion.matches;
    x = THREE.MathUtils.lerp(x, move ? targetX : 0, .13);
    y = THREE.MathUtils.lerp(y, move ? targetY : 0, .13);
    const nextBoost = hovered && move ? 1 : 0;
    boost = THREE.MathUtils.lerp(boost, nextBoost, .14);
    spot.intensity = lit * (72 + boost * 8);
    reflected.intensity = lit * (4.2 + boost * .35);
    emitter.emissiveIntensity = lit * (4.4 + boost * .3);
    halo.material.opacity = lit * (.54 + boost * .07);

    const aspect = width / height;
    const span = narrow.matches ? Math.max(6.85,9.75/aspect) : Math.max(7.1,10.1/aspect);
    camera.left = -span*aspect/2;
    camera.right = span*aspect/2;
    camera.top = span/2;
    camera.bottom = -span/2;
    camera.position.set((narrow.matches ? 5.7 : 7.1)+x*.52,(narrow.matches ? 4.6 : 5.1)+y*.28,10.6);
    camera.lookAt(0,narrow.matches ? 2.08 : 2.15,0);
    camera.updateProjectionMatrix();
    if (lit > 0 && !shadowReady) {
      renderer.shadowMap.needsUpdate = true;
      shadowReady = true;
    }
    renderer.render(world,camera);
    surface.parentElement.classList.add('live');
    if (progress < 1 || Math.abs(nextBoost-boost) > .002 ||
      (move && (Math.abs(x-targetX) + Math.abs(y-targetY) > .003))) invalidate();
  }

  let shadowReady = false;
  function invalidate() {
    if (active && !document.hidden && !frame) frame = requestAnimationFrame(draw);
  }
  new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (width && height) {
      renderer.setSize(width,height,false);
      invalidate();
    }
  }).observe(surface);
  window.addEventListener('pointermove',event => {
    if (!active || narrow.matches || motion.matches || !mouse.matches) return;
    targetX = 2*event.clientX/innerWidth-1;
    targetY = 2*event.clientY/innerHeight-1;
    invalidate();
  }, { passive:true });
  document.documentElement.addEventListener('pointerleave',() => {
    targetX = targetY = 0;
    invalidate();
  });
  start.addEventListener('pointerenter',() => {
    hovered = mouse.matches && !start.disabled;
    invalidate();
  });
  start.addEventListener('pointerleave',() => {
    hovered = false;
    invalidate();
  });
  motion.addEventListener('change',invalidate);
  document.addEventListener('visibilitychange',invalidate);
  renderer.domElement.addEventListener('webglcontextlost',event => {
    event.preventDefault();
    surface.parentElement.classList.remove('live');
    renderer.domElement.hidden = true;
    active = false;
  });
  return visible => {
    active = visible && !renderer.domElement.hidden;
    if (!active && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (active) invalidate();
  };
}
