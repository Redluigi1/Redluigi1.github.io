/* =========================================================
   Latent scene: noise -> neural network -> point-cloud portrait.
   One THREE.Points cloud; every particle carries three target
   positions and the vertex shader blends between them by scroll.
   ========================================================= */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.min.js';

const section = document.querySelector('.latent');
const canvas = section && section.querySelector('.latent__canvas');
const caps = section ? [...section.querySelectorAll('.latent__cap')] : [];
const pctEl = section && section.querySelector('[data-latent-pct]');

if (section && canvas) {
  // Build lazily, shortly before the section scrolls into view
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { io.disconnect(); init().catch(() => fallback()); }
  }, { rootMargin: '800px 0px' });
  io.observe(section);
}

function fallback() {
  canvas.style.display = 'none';
  // Captions still follow scroll
  const tick = () => { setCaption(progress()); requestAnimationFrame(tick); };
  tick();
}

function progress() {
  const r = section.getBoundingClientRect();
  return Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
}

let activeCap = -1;
function setCaption(p) {
  const i = p < 0.27 ? 0 : p < 0.62 ? 1 : 2;
  if (i !== activeCap) {
    caps.forEach((c, k) => c.classList.toggle('is-active', k === i));
    activeCap = i;
  }
  if (pctEl) pctEl.textContent = String(Math.round(p * 100)).padStart(3, '0');
}

async function init() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.innerWidth <= 860;
  const COUNT = mobile ? 8000 : 16000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  /* ---------- Target A: noise ---------- */
  const A = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const r = 3 + Math.pow(Math.random(), 0.6) * 6;
    const s = Math.sqrt(1 - u * u);
    A[i * 3] = r * s * Math.cos(th) * 1.3;
    A[i * 3 + 1] = r * u * 0.75;
    A[i * 3 + 2] = r * s * Math.sin(th);
  }

  /* ---------- Target B: neural network ---------- */
  const LAYERS = [5, 10, 16, 16, 10, 4];
  const nodes = [];
  LAYERS.forEach((n, l) => {
    const x = (l - (LAYERS.length - 1) / 2) * 2.3;
    const rad = 0.42 + n * 0.12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + l * 0.4;
      nodes.push({ l, v: new THREE.Vector3(x, Math.cos(a) * rad, Math.sin(a) * rad) });
    }
  });
  const edges = [];
  for (let l = 0; l < LAYERS.length - 1; l++) {
    const cur = nodes.filter((n) => n.l === l);
    const nxt = nodes.filter((n) => n.l === l + 1);
    cur.forEach((n) => {
      const picks = [...nxt].sort(() => Math.random() - 0.5).slice(0, Math.min(4, nxt.length));
      picks.forEach((m) => edges.push([n.v, m.v]));
    });
  }
  const B = new Float32Array(COUNT * 3);
  const tmp = new THREE.Vector3();
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  for (let i = 0; i < COUNT; i++) {
    if (i % 10 < 3) {
      // node cluster
      const n = nodes[i % nodes.length].v;
      tmp.set(n.x + gauss() * 0.09, n.y + gauss() * 0.09, n.z + gauss() * 0.09);
    } else {
      // dotted edge
      const [p, q] = edges[(i * 7) % edges.length];
      tmp.lerpVectors(p, q, Math.random());
      tmp.x += gauss() * 0.015; tmp.y += gauss() * 0.015; tmp.z += gauss() * 0.015;
    }
    tmp.toArray(B, i * 3);
  }

  /* ---------- Target C: point-cloud portrait ---------- */
  const C = new Float32Array(COUNT * 3);
  const COL = new Float32Array(COUNT * 3);
  const img = await loadImage('assets/img/portrait-suit-cut-700.webp');
  const SW = 180, SH = Math.round(180 * img.naturalHeight / img.naturalWidth);
  const sc = document.createElement('canvas');
  sc.width = SW; sc.height = SH;
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0, SW, SH);
  const px = sctx.getImageData(0, 0, SW, SH).data;
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= SW || y >= SH ? 0 : px[(y * SW + x) * 4 + 3]);
  const opaque = [], edge = [];
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      if (alphaAt(x, y) <= 140) continue;
      const i = y * SW + x;
      opaque.push(i);
      if (alphaAt(x - 2, y) < 60 || alphaAt(x + 2, y) < 60 || alphaAt(x, y - 2) < 60 || alphaAt(x, Math.min(y + 2, SH - 1)) < 60) edge.push(i);
    }
  }
  const H = 6.6, W = H * SW / SH;
  for (let i = 0; i < COUNT; i++) {
    const onEdge = i % 100 < 16;
    let idx, r, g, b, lum;
    // Bias toward lit pixels so the face reads; outline particles trace the silhouette
    for (let tries = 0; tries < 8; tries++) {
      idx = onEdge ? edge[(Math.random() * edge.length) | 0] : opaque[(Math.random() * opaque.length) | 0];
      r = px[idx * 4] / 255; g = px[idx * 4 + 1] / 255; b = px[idx * 4 + 2] / 255;
      lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (onEdge || Math.random() < 0.35 + 0.65 * Math.pow(lum, 0.55)) break;
    }
    const u = (idx % SW + Math.random()) / SW, v = (((idx / SW) | 0) + Math.random()) / SH;
    C[i * 3] = (u - 0.5) * W;
    C[i * 3 + 1] = -(v - 0.5) * H - 0.05;
    C[i * 3 + 2] = Math.cos((u - 0.5) * Math.PI) * 1.1 + (lum - 0.4) * 0.9;
    if (onEdge) {
      COL[i * 3] = 1.0; COL[i * 3 + 1] = 0.55; COL[i * 3 + 2] = 0.3;
    } else {
      // Lift shadows so the face reads against the dark suit
      COL[i * 3] = Math.min(1, Math.pow(r, 0.72) * 1.45 + 0.05);
      COL[i * 3 + 1] = Math.min(1, Math.pow(g, 0.72) * 1.35 + 0.04);
      COL[i * 3 + 2] = Math.min(1, Math.pow(b, 0.72) * 1.25 + 0.04);
    }
  }

  const SEED = new Float32Array(COUNT).map(() => Math.random());

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(A, 3));
  geo.setAttribute('aB', new THREE.BufferAttribute(B, 3));
  geo.setAttribute('aC', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(COL, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(SEED, 1));

  const uniforms = {
    uP: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: mobile ? 4.2 : 4.6 },
    uPR: { value: renderer.getPixelRatio() },
    uPulse: { value: -8 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aB;
      attribute vec3 aC;
      attribute vec3 aCol;
      attribute float aSeed;
      uniform float uP, uTime, uSize, uPR, uPulse;
      varying vec3 vCol;

      float ease(float t) { return t * t * (3.0 - 2.0 * t); }
      vec3 drift(float s, float amp) {
        return amp * vec3(
          sin(uTime * 0.55 + s * 21.0),
          cos(uTime * 0.47 + s * 37.0),
          sin(uTime * 0.39 + s * 13.0));
      }

      void main() {
        float s = aSeed;
        float t1 = ease(clamp((uP - s * 0.35) / 0.65, 0.0, 1.0));
        float t2 = ease(clamp((uP - 1.0 - s * 0.35) / 0.65, 0.0, 1.0));

        vec3 a = position + drift(s, 0.35);
        vec3 b = aB + drift(s, 0.025);
        vec3 c = aC + drift(s, 0.012);
        vec3 p = mix(mix(a, b, t1), c, t2);

        // Particles swirl outward mid-transition instead of sliding in straight lines
        float mid = sin(t1 * 3.14159) + sin(t2 * 3.14159);
        p += normalize(position + 0.001) * mid * 0.8;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.55 + s * 0.9) * (10.0 / -mv.z);

        vec3 accent = vec3(1.0, 0.353, 0.122);
        vec3 bone = vec3(0.94, 0.92, 0.88);
        vec3 colA = mix(accent, bone, step(0.82, s)) * 0.85;
        float pulse = exp(-pow(aB.x - uPulse, 2.0) * 1.2);
        vec3 colB = mix(accent * 0.7, vec3(1.0, 0.82, 0.62) * 1.4, pulse);
        vec3 colC = aCol * 0.62;
        vCol = mix(mix(colA, colB, t1), colC, t2);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(vCol * a, a);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  /* ---------- Sizing ---------- */
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole scene in frame on tall phones
    camera.fov = camera.aspect < 0.8 ? 58 : 38;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  /* ---------- Pointer parallax ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ---------- Loop ---------- */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(section);

  const clock = new THREE.Clock();
  let smoothP = progress();
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const frame = () => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const target = progress();
    smoothP = reduce ? target : lerp(smoothP, target, 1 - Math.pow(0.0015, dt));
    const p = smoothP;
    setCaption(p);

    const uP = Math.min(2, Math.max(0, p * 2.35 - 0.05));
    uniforms.uP.value = uP;
    if (!reduce) uniforms.uTime.value += dt;
    uniforms.uPulse.value = ((uniforms.uTime.value * 4.5) % 18) - 9;

    mouse.x = lerp(mouse.x, mouse.tx, 0.05);
    mouse.y = lerp(mouse.y, mouse.ty, 0.05);

    // Camera: slow orbit through noise, sweeping view of the network, then face-on for the portrait
    const toNet = sstep(0, 1, uP);
    const toFace = sstep(1, 2, uP);
    const az = lerp(lerp(-0.35 + p * 0.6, 0.85, toNet), 0, toFace) + mouse.x * 0.12;
    const radius = lerp(lerp(15, 14, toNet), mobile ? 13.5 : 11, toFace);
    const el = lerp(lerp(1.6, 0.9, toNet), 0.2, toFace) - mouse.y * 0.5;
    camera.position.set(Math.sin(az) * radius, el, Math.cos(az) * radius);
    camera.lookAt(0, toFace * 0.3, 0);
    // Make room for the caption: portrait sits right on wide screens, higher on phones
    const wide = camera.aspect > 1.1;
    group.position.set(toFace * (wide ? 2.4 : 0), toFace * (wide ? 0 : 1.2), 0);

    // Portrait turns as you keep scrolling once it has formed
    const hold = sstep(1.55, 2, uP) * sstep(0.85, 1, p) ;
    group.rotation.y = toFace * (-0.45 + hold * 0.9 + sstep(1.55, 2, uP) * 0.2) + (1 - toFace) * uniforms.uTime.value * 0.05;

    renderer.render(scene, camera);
  };
  frame();
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
