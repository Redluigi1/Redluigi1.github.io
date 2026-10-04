/* =========================================================
   Ayush Kumar · portfolio
   Vanilla JS + GSAP (ScrollTrigger, SplitText) + Lenis
   ========================================================= */

// Clip layered over the graduation still (generated with Kling 3.0).
// Set to null to fall back to the still image.
const MEDIA = {
  gradVideo: 'assets/video/convocation.mp4',
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => window.innerWidth <= 860;

/* ---------- Clock (works without GSAP) ---------- */
(function clock() {
  const el = $('[data-clock]');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 15000);
})();

/* ---------- Bail out gracefully if the CDN didn't load ---------- */
if (!window.gsap || !window.ScrollTrigger) {
  document.documentElement.classList.remove('js');
  document.documentElement.classList.add('no-anim');
  const l = $('.loader'); if (l) l.remove();
} else {
  init();
}

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  gsap.defaults({ ease: 'expo.out', duration: 1.1 });

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.095, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  const scrollTo = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else (typeof target === 'number' ? window.scrollTo(0, target) : target.scrollIntoView());
  };

  /* ---------- Menu ---------- */
  const burger = $('.nav__burger');
  const menu = $('#menu');
  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });

  // Anchor links go through Lenis
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (menu.classList.contains('is-open')) setMenu(false);
      scrollTo(target);
    });
  });

  /* ---------- Cursor ---------- */
  if (finePointer) {
    const cursor = $('.cursor');
    const label = $('.cursor__label');
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });

    document.addEventListener('pointerover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const hover = e.target.closest('a, button, [data-hover]');
      if (labelled) {
        label.textContent = labelled.classList.contains('is-open') ? 'Close' : labelled.dataset.cursor;
        cursor.classList.add('is-label');
        cursor.classList.remove('is-hover');
      } else if (hover) {
        cursor.classList.add('is-hover');
        cursor.classList.remove('is-label');
      } else {
        cursor.classList.remove('is-hover', 'is-label');
      }
    });
    document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.3 }));
    document.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1, duration: 0.3 }));

    // Magnetic buttons
    $$('[data-magnetic]').forEach((el) => {
      const inner = el.querySelector('span');
      const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      const ix = gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3' });
      const iy = gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        mx(dx * 0.25); my(dy * 0.35); ix(dx * 0.12); iy(dy * 0.18);
      });
      el.addEventListener('pointerleave', () => { mx(0); my(0); ix(0); iy(0); });
    });
  }

  /* ---------- Hero portrait: ASCII <-> photo ---------- */
  const portrait = createPortrait();

  /* ---------- Loader + intro ---------- */
  runLoader().then(() => {
    if (lenis) lenis.start();
    buildScrollScenes(lenis, portrait);
    ScrollTrigger.refresh();
  });

  /* ---------------------------------------------------------
     Loader
     --------------------------------------------------------- */
  function runLoader() {
    const loader = $('.loader');
    const countEl = $('[data-count]');
    const stream = $('[data-stream]');
    const heroImg = $('.hero__img');

    const assetsReady = Promise.race([new Promise((r) => setTimeout(r, 4000)), Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      heroImg.complete ? Promise.resolve() : new Promise((r) => { heroImg.addEventListener('load', r, { once: true }); heroImg.addEventListener('error', r, { once: true }); }),
      portrait.ready,
    ])]);

    // Prepare hero intro states before the curtain lifts
    const heroSplits = [];
    if (window.SplitText) {
      $$('.hero__line .split').forEach((el) => heroSplits.push(new SplitText(el, { type: 'chars', mask: 'chars' })));
    }
    const heroChars = heroSplits.flatMap((s) => s.chars);
    gsap.set(heroChars, { yPercent: 110 });
    gsap.set(['.hero__meta p', '.hero__intro', '.hero__foot', '.nav'], { autoAlpha: 0, y: 16 });

    const intro = () => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to(heroChars, { yPercent: 0, duration: 1.4, stagger: 0.045 }, 0)
        .add(() => portrait.playIntro(), 0.1)
        .to('.nav', { autoAlpha: 1, y: 0, duration: 1 }, 0.5)
        .to('.hero__meta p', { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08 }, 0.7)
        .to('.hero__intro', { autoAlpha: 1, y: 0, duration: 1.2 }, 0.85)
        .to('.hero__foot', { autoAlpha: 1, y: 0, duration: 1 }, 1.1)
        .add(() => heroSplits.forEach((s) => s.revert()));
      return tl;
    };

    if (reduceMotion) {
      return assetsReady.then(() => {
        loader.remove();
        gsap.set(heroChars, { yPercent: 0 });
        gsap.set(['.hero__meta p', '.hero__intro', '.hero__foot', '.nav'], { autoAlpha: 1, y: 0 });
        heroSplits.forEach((s) => s.revert());
        portrait.showPhoto();
      });
    }

    const lines = [
      '> boot  ayush.kumar/portfolio',
      '> loading policy anchors ......... ok',
      '> spawn agent  part=battery  sop=v14',
      '> spawn agent  part=motor    sop=v9',
      '> golden_set   412 / 412 passed',
      '> shadow_traffic 24h  Δfalse_approvals=0',
      '> tokenizing portrait.jpg ........ 10,240 tok',
      '> retrieve(context) top_k=8 rerank=on',
      '> planner: DAG(7 nodes) parallel=4',
      '> critic: looks good, ship it',
    ];
    let li = 0;
    const streamTimer = setInterval(() => {
      const row = document.createElement('div');
      const t = lines[li % lines.length];
      row.innerHTML = t.replace(/(ok|passed|ship it)$/, '<span class="hl">$1</span>');
      stream.appendChild(row);
      if (stream.children.length > 40) stream.firstChild.remove();
      li++;
    }, 110);

    const counter = { v: 0 };
    const minTime = new Promise((r) => setTimeout(r, 1500));
    const countTween = gsap.to(counter, {
      v: 86, duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => { countEl.textContent = String(Math.round(counter.v)).padStart(3, '0'); },
    });

    return Promise.all([assetsReady, minTime]).then(() => new Promise((resolve) => {
      countTween.kill();
      gsap.to(counter, {
        v: 100, duration: 0.5, ease: 'power2.out',
        onUpdate: () => { countEl.textContent = String(Math.round(counter.v)).padStart(3, '0'); },
        onComplete: () => {
          clearInterval(streamTimer);
          gsap.timeline({ onComplete: () => { loader.remove(); } })
            .to('.loader__count, .loader__label, .loader__stream', { yPercent: -30, autoAlpha: 0, duration: 0.6, ease: 'power3.in' })
            .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, 0.35)
            .add(() => { intro(); resolve(); }, 0.75);
        },
      });
    }));
  }

  /* ---------------------------------------------------------
     Portrait renderer
     --------------------------------------------------------- */
  function createPortrait() {
    const wrap = $('[data-portrait]');
    const canvas = $('.hero__canvas', wrap);
    const ctx = canvas.getContext('2d');
    const RAMP = ' .:-=+*#%@';
    const ACCENT = '#ff5a1f';

    const ascii = document.createElement('canvas');
    const actx = ascii.getContext('2d');
    const sample = document.createElement('canvas');
    const sctx = sample.getContext('2d', { willReadFrequently: true });

    // Separate bitmap for the canvas: srcset images report density-corrected sizes,
    // which breaks drawImage source rects in Chromium.
    const big = wrap.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2) > 800;
    const base = new Image();
    base.decoding = 'async';
    base.src = `assets/img/portrait-cut-${big ? 1200 : 700}.webp`;
    let source = base;

    let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, cw = 0, ch = 0, fs = 0;
    let lum = null, alp = null, seeds = null;
    const state = {
      reveal: reduceMotion ? 1 : 0, // 0 = all ascii, 1 = all photo (top to bottom)
      scramble: reduceMotion ? 0 : 1,
      lens: { x: 0, y: 0, r: 0, tr: 0, tx: 0, ty: 0 },
      dirty: true,
      visible: true,
    };

    const srcSize = () => [source.naturalWidth || source.width, source.naturalHeight || source.height];

    function cover(sw, sh, dw, dh) {
      const s = Math.max(dw / sw, dh / sh);
      const w = dw / s, h = dh / s;
      return [(sw - w) / 2, (sh - h) / 2, w, h];
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = ascii.width = W;
      canvas.height = ascii.height = H;
      fs = (isMobile() ? 6.5 : 8.5) * dpr;
      cw = fs * 0.62; ch = fs;
      cols = Math.floor(W / cw); rows = Math.floor(H / ch);
      sample.width = cols; sample.height = rows;
      seeds = new Float32Array(cols * rows).map(() => Math.random());
      sampleSource();
      renderAscii();
      draw();
    }

    function sampleSource() {
      const [sw, sh] = srcSize();
      if (!sw) return;
      const [sx, sy, w, h] = cover(sw, sh, W, H);
      sctx.drawImage(source, sx, sy, w, h, 0, 0, cols, rows);
      const d = sctx.getImageData(0, 0, cols, rows).data;
      lum = new Float32Array(cols * rows);
      alp = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        alp[i] = d[i * 4 + 3] / 255;
        const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
        lum[i] = clamp((l * 1.5 + 0.08) * (d[i * 4 + 3] / 255));
      }
    }

    function renderAscii() {
      if (!lum) return;
      actx.clearRect(0, 0, W, H);
      actx.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
      actx.textBaseline = 'top';
      actx.fillStyle = ACCENT;
      const n = RAMP.length - 1;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let b = lum[i];
          let c;
          if (seeds[i] < state.scramble) {
            if (alp[i] < 0.3) continue;
            c = RAMP[1 + ((Math.random() * n) | 0)];
            b = Math.max(b, 0.15);
          } else {
            if (b < 0.06) continue;
            c = RAMP[Math.round(b * n)];
          }
          actx.globalAlpha = 0.22 + 0.78 * b;
          actx.fillText(c, x * cw, y * ch);
        }
      }
      actx.globalAlpha = 1;
    }

    function draw() {
      const cut = state.reveal * H;
      ctx.clearRect(0, 0, W, H);
      const [sw, sh] = srcSize();

      // photo, top part
      if (cut > 0 && sw) {
        const [sx, sy, w, h] = cover(sw, sh, W, H);
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, cut); ctx.clip();
        ctx.drawImage(source, sx, sy, w, h, 0, 0, W, H);
        ctx.restore();
      }
      // ascii, bottom part
      if (cut < H) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, cut, W, H - cut); ctx.clip();
        ctx.drawImage(ascii, 0, 0);
        ctx.restore();
      }
      // scan line
      if (cut > 1 && cut < H - 1) {
        const g = ctx.createLinearGradient(0, cut - 40 * dpr, 0, cut);
        g.addColorStop(0, 'rgba(255,90,31,0)');
        g.addColorStop(1, 'rgba(255,90,31,0.28)');
        ctx.fillStyle = g;
        ctx.fillRect(0, cut - 40 * dpr, W, 40 * dpr);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(0, cut - dpr, W, 1.5 * dpr);
      }
      // lens
      const L = state.lens;
      if (L.r > 1) {
        ctx.save();
        ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); ctx.clip();
        ctx.clearRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
        ctx.drawImage(ascii, 0, 0);
        ctx.restore();
        ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,90,31,0.9)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.stroke();
      }
    }

    function loop() {
      requestAnimationFrame(loop);
      if (!state.visible || !W) return;
      const L = state.lens;
      const moving = Math.abs(L.tr - L.r) > 0.3 || Math.abs(L.tx - L.x) > 0.3 || Math.abs(L.ty - L.y) > 0.3;
      if (moving) {
        L.r = lerp(L.r, L.tr, 0.14);
        L.x = lerp(L.x, L.tx, 0.2);
        L.y = lerp(L.y, L.ty, 0.2);
        state.dirty = true;
      }
      if (state.scramble > 0 && state.scramble < 1) { renderAscii(); state.dirty = true; }
      if (state.dirty) { draw(); state.dirty = false; }
    }

    // Pointer lens
    const setLens = (cx, cy, on) => {
      const r = canvas.getBoundingClientRect();
      state.lens.tx = (cx - r.left) * dpr;
      state.lens.ty = (cy - r.top) * dpr;
      if (state.lens.r < 1) { state.lens.x = state.lens.tx; state.lens.y = state.lens.ty; }
      state.lens.tr = on ? Math.min(W, H) * (isMobile() ? 0.24 : 0.19) : 0;
      wrap.classList.toggle('is-lens', on);
    };
    if (finePointer) {
      wrap.addEventListener('pointermove', (e) => setLens(e.clientX, e.clientY, true));
      wrap.addEventListener('pointerleave', (e) => setLens(e.clientX, e.clientY, false));
    } else {
      let hideT;
      const onTouch = (e) => {
        const t = e.touches[0]; if (!t) return;
        clearTimeout(hideT);
        setLens(t.clientX, t.clientY, true);
      };
      wrap.addEventListener('touchstart', onTouch, { passive: true });
      wrap.addEventListener('touchmove', onTouch, { passive: true });
      wrap.addEventListener('touchend', () => { hideT = setTimeout(() => { state.lens.tr = 0; wrap.classList.remove('is-lens'); }, 700); }, { passive: true });
    }

    // Pause when off screen
    new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }).observe(wrap);

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

    const ready = (base.decode ? base.decode().catch(() => {}) : new Promise((r) => { base.onload = base.onerror = r; }))
      .then(() => (document.fonts ? document.fonts.load('500 10px "Geist Mono"').catch(() => {}) : null))
      .then(() => {
        if (!base.naturalWidth) return;
        source = gradePortrait(base);
        resize();
        wrap.classList.add('is-live');
        draw();
        requestAnimationFrame(loop);
      });

    return {
      ready,
      state,
      showPhoto() { state.reveal = 1; state.scramble = 0; renderAscii(); state.dirty = true; },
      playIntro() {
        gsap.timeline()
          .to(state, { scramble: 0, duration: 1.3, ease: 'power2.inOut', onUpdate: () => { state.dirty = true; }, onComplete: () => { renderAscii(); state.dirty = true; } })
          .to(state, { reveal: 1, duration: 1.5, ease: 'expo.inOut', onUpdate: () => { state.dirty = true; } }, 0.9);
      },
    };
  }

  /* ---------------------------------------------------------
     Scroll scenes
     --------------------------------------------------------- */
  function buildScrollScenes(lenis, portrait) {
    const mm = gsap.matchMedia();

    /* Marquee, speed follows scroll velocity */
    const track = $('.marquee__track');
    track.innerHTML += track.innerHTML;
    if (!reduceMotion) {
      const mq = gsap.to(track, { xPercent: -50, duration: 36, ease: 'none', repeat: -1 });
      let dir = 1;
      if (lenis) {
        lenis.on('scroll', ({ velocity }) => {
          if (velocity !== 0) dir = velocity > 0 ? 1 : -1;
          gsap.to(mq, { timeScale: dir * (1 + Math.min(Math.abs(velocity) * 0.25, 5)), duration: 0.3, overwrite: true });
          gsap.to(mq, { timeScale: dir, duration: 1.2, delay: 0.3 });
        });
      }
    }

    if (reduceMotion) { setupLoop(); setupProjects(); setupHonors(); setupWarRoom(); setupLadder(); setupNer(); return; }

    /* Display headings: line mask reveal */
    if (window.SplitText) {
      $$('.display, .contact__title').forEach((el) => {
        if (el.closest('.grad')) return;
        const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'ln' });
        gsap.from(split.lines, {
          yPercent: 105, duration: 1.3, stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          onComplete: () => split.revert(),
        });
      });

      /* Word-by-word brighten */
      $$('[data-words]').forEach((el) => {
        const split = new SplitText(el, { type: 'words', wordsClass: 'w' });
        gsap.fromTo(split.words, { opacity: 0.16 }, {
          opacity: 1, ease: 'none', stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: true },
        });
      });
    }

    /* Section labels and generic fades */
    gsap.utils.toArray('.section__label, .loop__sub, .case__sub, .about__facts li, .tools__group, .stat, .tl, .phase, .maps__list li, .case__metrics div, .early__list li').forEach((el) => {
      gsap.from(el, { y: 30, autoAlpha: 0, duration: 1.1, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    lazyVideo($('.grad__video'), MEDIA.gradVideo, '.grad');

    /* Counters */
    $$('[data-count-to]').forEach((el) => {
      const to = +el.dataset.countTo;
      if (to < 10) return;
      const o = { v: 0 };
      const fmt = (n) => (el.hasAttribute('data-format') ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
      el.textContent = fmt(0);
      gsap.to(o, {
        v: to, duration: 2.2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => { el.textContent = fmt(o.v); },
      });
    });

    setupLoop();
    setupProjects();
    setupHonors();
    setupWarRoom();
    setupLadder();
    setupNer();

    /* Graduation: a small framed print opens to a full-height portrait,
       while a blurred copy of the scene floods in around it */
    mm.add({ desk: '(min-width: 861px)', mob: '(max-width: 860px)' }, (c) => {
      const from = c.conditions.desk ? 'inset(16% 12% 16% 12% round 18px)' : 'inset(10% 10% 10% 10% round 14px)';
      const tl = gsap.timeline({ scrollTrigger: { trigger: '.grad', start: 'top top', end: 'bottom bottom', scrub: true } });
      tl.fromTo('.grad__media', { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', duration: 1 }, 0)
        .fromTo('.grad__media img, .grad__video', { scale: 1.12 }, { scale: 1, ease: 'none', duration: 1 }, 0)
        .fromTo('.grad__ambient', { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.8 }, 0.1)
        .from('.grad__text > *', { y: 60, autoAlpha: 0, stagger: 0.08, duration: 0.35, ease: 'power2.out' }, 0.55);
    });

    /* Contact */
    gsap.from('.contact__cta .btn', {
      y: 40, autoAlpha: 0, stagger: 0.1, duration: 1.2,
      scrollTrigger: { trigger: '.contact__cta', start: 'top 92%', once: true },
    });
    gsap.fromTo('.contact__giant', { yPercent: 60 }, {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  }

  /* ---------- Clips: load when near, play only while visible.
     Clips without `loop` play once and rest on their last frame. ---------- */
  function lazyVideo(v, src, trigger) {
    if (!v || !src) return;
    v.addEventListener('playing', () => v.classList.add('is-ready'), { once: true });
    ScrollTrigger.create({
      trigger, start: 'top 150%', end: 'bottom -50%',
      onToggle: (s) => {
        if (s.isActive) {
          if (!v.src) v.src = src;
          if (!v.ended) v.play().catch(() => {});
        } else v.pause();
      },
    });
  }

  /* ---------- The loop diagram ---------- */
  function setupLoop() {
    const svg = $('.loop__svg');
    const g = $('.loop__nodes', svg);
    const arc = $('.loop__arc', svg);
    const runner = $('.loop__runner', svg);
    const accEl = $('[data-acc]');
    const verEl = $('[data-ver]');
    const steps = $$('.step');
    const labels = ['Claim', 'Agent', 'Audit', 'Classify', 'Patch', 'Verify', 'Ship'];
    const N = labels.length;
    const R = 230, CX = 300, CY = 300;
    const C = 2 * Math.PI * R;
    svg.setAttribute('viewBox', '-90 -30 780 660');

    arc.style.strokeDasharray = `${C}`;
    arc.style.strokeDashoffset = `${C}`;

    const nodes = labels.map((lab, i) => {
      const a = (-90 + (360 / N) * i) * (Math.PI / 180);
      const x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
      const lx = CX + (R + 42) * Math.cos(a), ly = CY + (R + 42) * Math.sin(a);
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.setAttribute('class', 'loop__node');
      const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      node.innerHTML = `
        <circle class="ring" cx="${x}" cy="${y}" r="13"></circle>
        <circle class="core" cx="${x}" cy="${y}" r="4"></circle>
        <text x="${lx}" y="${ly + 4}" text-anchor="${anchor}">${String(i + 1).padStart(2, '0')} ${lab}</text>`;
      g.appendChild(node);
      return node;
    });

    const update = (p) => {
      arc.style.strokeDashoffset = `${C * (1 - p)}`;
      const a = (-90 + 360 * p) * (Math.PI / 180);
      runner.setAttribute('cx', CX + R * Math.cos(a));
      runner.setAttribute('cy', CY + R * Math.sin(a));
      const active = Math.min(N - 1, Math.floor(p * N + 0.0001));
      nodes.forEach((n, i) => {
        n.classList.toggle('is-active', i === active);
        n.classList.toggle('is-done', i < active);
      });
      steps.forEach((s, i) => s.classList.toggle('is-active', i === active));
      const acc = 86 + 4 * clamp((p - 0.55) / 0.4);
      accEl.textContent = acc.toFixed(1).replace(/\.0$/, '');
      verEl.textContent = `v1.${Math.round(p * 24)}`;
    };
    update(0);

    ScrollTrigger.create({
      trigger: '.loop__steps',
      start: () => (isMobile() ? 'top 62%' : 'top center'),
      end: () => (isMobile() ? 'bottom 62%' : 'bottom center'),
      scrub: reduceMotion ? false : 0.6,
      onUpdate: (s) => update(s.progress),
    });
  }

  /* ---------- Project accordion ---------- */
  function setupProjects() {
    const items = $$('.project');
    const toggle = (item, open) => {
      const body = $('.project__body', item);
      const btn = $('.project__row', item);
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      const label = $('.cursor__label');
      if (label && item.matches(':hover')) label.textContent = open ? 'Close' : item.dataset.cursor;
      gsap.to(body, {
        height: open ? 'auto' : 0,
        duration: reduceMotion ? 0 : open ? 1 : 0.7,
        ease: open ? 'expo.out' : 'expo.inOut',
        onComplete: () => ScrollTrigger.refresh(),
      });
      if (open && !reduceMotion) {
        gsap.from($$('.project__inner > *', item), { y: 24, autoAlpha: 0, stagger: 0.05, duration: 0.9, delay: 0.1 });
      }
    };
    items.forEach((item) => {
      $('.project__row', item).addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((o) => { if (o !== item && o.classList.contains('is-open')) toggle(o, false); });
        toggle(item, open);
      });
    });
    if (!reduceMotion) {
      gsap.from('.project', {
        y: 40, autoAlpha: 0, stagger: 0.08, duration: 1.2,
        scrollTrigger: { trigger: '.projects', start: 'top 85%', once: true },
      });
    }
  }

  /* ---------- Honours glow + reveal ---------- */
  function setupHonors() {
    $$('.honor').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
    if (!reduceMotion) {
      gsap.set('.honor > *', { y: 40, autoAlpha: 0 });
      ScrollTrigger.batch('.honor', {
        start: 'top 92%',
        once: true,
        onEnter: (els) => els.forEach((el, i) => gsap.to(el.children, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 1.2, delay: i * 0.08 })),
      });
    }
  }

  /* ---------- Case 02: ten-day bar, then the agent trace ---------- */
  function setupWarRoom() {
    const bars = $$('.sprint__bar li');
    const mods = $$('.sprint__mods li');
    const dayEl = $('[data-sprint-day]');
    const lines = $$('.term__lines li');
    const countEl = $('[data-war-count]');
    if (!bars.length || !lines.length) return;

    const setSprint = (p) => {
      const d = p * 10;
      bars.forEach((b, i) => b.style.setProperty('--fill', clamp(d - i).toFixed(3)));
      dayEl.textContent = String(Math.min(10, Math.floor(d + 0.001))).padStart(2, '0');
      mods.forEach((m, i) => m.classList.toggle('is-on', p >= (i + 1) / mods.length - 0.001));
    };
    const setTerm = (p) => {
      const n = Math.round(p * lines.length);
      lines.forEach((l, i) => l.classList.toggle('is-on', i < n));
      countEl.textContent = Math.round(3400 * clamp((p - 0.1) / 0.9)).toLocaleString('en-US');
    };

    if (reduceMotion) { setSprint(1); setTerm(1); return; }
    setSprint(0); setTerm(0);
    ScrollTrigger.create({ trigger: '.sprint', start: 'top 80%', end: 'bottom 30%', scrub: 0.5, onUpdate: (s) => setSprint(s.progress) });
    ScrollTrigger.create({ trigger: '.term', start: 'top 75%', end: 'bottom 50%', scrub: 0.5, onUpdate: (s) => setTerm(s.progress) });
  }

  /* ---------- Case 03: results ladder ---------- */
  function setupLadder() {
    const fig = $('[data-ladder]');
    if (!fig) return;
    // AAEC results from the B.Tech thesis. Rows 1-5 on GPT-OSS-20B, row 6 on GPT-5 Mini.
    const DATA = {
      aci: { tanl: 0.5928, denim: 0.6212, v: [0.2909, 0.4873, 0.5275, 0.5639, 0.5727, 0.6488] },
      acc: { tanl: 0.4119, denim: 0.4000, v: [0.2880, 0.2962, 0.3168, 0.3327, 0.3550, 0.4200] },
      ari: { tanl: 0.2982, denim: 0.3367, v: [0.1111, 0.1507, 0.1744, 0.2500, 0.2516, 0.3612] },
    };
    const ROWS = ['Static few-shot', 'Agentic pipeline', '+ random examples', '+ semantic RAG', '+ hybrid RAG', 'Hybrid RAG on GPT-5 Mini'];
    const list = $('.ladder__rows', fig);
    const tip = $('.ladder__tip', fig);
    const refs = { tanl: $('[data-ref="tanl"]', fig), denim: $('[data-ref="denim"]', fig) };
    list.innerHTML = ROWS.map((r, i) => `<li class="ladder__row${i === ROWS.length - 1 ? ' is-best' : ''}"><span class="ladder__label">${r}</span><span class="ladder__track"><span class="ladder__bar"></span><span class="ladder__val"></span></span></li>`).join('');
    const rows = $$('.ladder__row', list);
    rows.forEach((row, i) => {
      $('.ladder__bar', row).style.transition = `width 1.1s var(--ease) ${i * 0.07}s, background 0.3s`;
    });

    let metric = 'aci';
    let shown = reduceMotion;
    const render = () => {
      const d = DATA[metric];
      // Leave room past the longest bar for its value label
      const max = Math.max(...d.v, d.tanl, d.denim) / 0.82;
      rows.forEach((row, i) => {
        row.style.setProperty('--w', shown ? (d.v[i] / max).toFixed(4) : 0);
        $('.ladder__val', row).textContent = d.v[i].toFixed(3);
      });
      refs.tanl.style.setProperty('--x', (d.tanl / max).toFixed(4));
      refs.denim.style.setProperty('--x', (d.denim / max).toFixed(4));
      fig.classList.toggle('is-shown', shown);
    };
    render();

    $$('[data-metric]', fig).forEach((btn) => {
      btn.addEventListener('click', () => {
        metric = btn.dataset.metric;
        $$('[data-metric]', fig).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        tip.classList.remove('is-on');
        render();
      });
    });

    rows.forEach((row, i) => {
      row.addEventListener('pointerenter', () => {
        const d = DATA[metric];
        const diff = d.v[i] - d.denim;
        tip.textContent = `${i < 5 ? 'GPT-OSS-20B' : 'GPT-5 Mini'} · ${d.v[i].toFixed(3)} · ${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(3)} vs DENIM`;
        const fr = fig.getBoundingClientRect();
        const br = $('.ladder__bar', row).getBoundingClientRect();
        tip.style.left = `${Math.max(br.right - fr.left, 90)}px`;
        tip.style.top = `${br.top - fr.top - 4}px`;
        tip.classList.add('is-on');
      });
      row.addEventListener('pointerleave', () => tip.classList.remove('is-on'));
    });

    if (!reduceMotion) {
      ScrollTrigger.create({ trigger: fig, start: 'top 75%', once: true, onEnter: () => { shown = true; render(); } });
    }
  }

  /* ---------- Case 04: address NER demo ---------- */
  function setupNer() {
    const fig = $('[data-ner]');
    if (!fig) return;
    const q = $('[data-ner-query]', fig);
    const out = $('[data-ner-out]', fig);
    const EX = [
      [['flat 402', 'unit'], ['prestige shantiniketan', 'building'], ['near itpl', 'landmark'], ['whitefield', 'locality'], ['blr', 'city'], ['560048', 'pincode']],
      [['opp hanuman mandir', 'landmark'], ['3rd cross', 'street'], ['jayanagar 4th block', 'locality'], ['bangalore', 'city']],
      [['h no 12', 'unit'], ['sector 15', 'locality'], ['near huda city centre', 'landmark'], ['gurgaon', 'city']],
    ];
    let k = 0;
    let timers = [];
    let running = false;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const stop = () => { running = false; timers.forEach(clearTimeout); timers = []; };

    const show = (ex, instant) => {
      const full = ex.map((e) => e[0]).join(' ');
      out.innerHTML = ex.map(([t, l]) => `<span class="ner__tok">${t}<small>${l}</small></span>`).join('');
      const toks = $$('.ner__tok', out);
      if (instant) { q.textContent = full; toks.forEach((t) => t.classList.add('is-on')); return; }
      let i = 0;
      q.textContent = '';
      const type = () => {
        if (!running) return;
        q.textContent = full.slice(0, ++i);
        if (i < full.length) { later(type, 34 + Math.random() * 46); return; }
        later(() => {
          toks.forEach((t, j) => later(() => t.classList.add('is-on'), j * 140));
          later(() => {
            toks.forEach((t) => t.classList.remove('is-on'));
            k = (k + 1) % EX.length;
            later(() => show(EX[k]), 600);
          }, 4200);
        }, 280);
      };
      type();
    };

    if (reduceMotion) { show(EX[0], true); return; }
    show(EX[0], true);
    ScrollTrigger.create({
      trigger: fig, start: 'top 85%', end: 'bottom 10%',
      onToggle: (s) => { stop(); if (s.isActive) { running = true; show(EX[k]); } },
    });
  }
}

/* ---------- Hero grade: warm silver print with an ember rim light ----------
   Maps luminance through ink -> warm grey -> bone so the cut-out sits in the
   site's palette, then lights right- and top-facing edges in the accent. */
function gradePortrait(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  let id;
  try { id = g.getImageData(0, 0, w, h); } catch (e) { return img; }
  const d = id.data, n = w * h;
  const A = new Float32Array(n);
  for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3] / 255;

  const stops = [[0, [9, 9, 8]], [0.38, [62, 57, 50]], [0.72, [178, 170, 157]], [1, [250, 245, 236]]];
  const lut = new Float32Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let s = 0;
    while (s < stops.length - 2 && t > stops[s + 1][0]) s++;
    const [t0, c0] = stops[s], [t1, c1] = stops[s + 1];
    const u = (t - t0) / (t1 - t0);
    for (let k = 0; k < 3; k++) lut[v * 3 + k] = c0[k] + (c1[k] - c0[k]) * u;
  }

  const k1 = Math.max(2, Math.round(w * 0.006)), k2 = k1 * 2, k3 = k1 * 3;
  const EMBER = [255, 106, 43];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, a = A[i];
      if (!a) continue;
      const o = i * 4;
      let l = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
      l = clamp((l - 0.03) / 0.92);
      l = l * l * (3 - 2 * l) * 0.55 + l * 0.45;
      const v = (l * 255) | 0;
      let r = lut[v * 3], gr = lut[v * 3 + 1], b = lut[v * 3 + 2];
      const right = x + k3 < w ? (A[i + k1] + A[i + k2] + A[i + k3]) / 3 : 0;
      const up = y - k3 >= 0 ? (A[i - k1 * w] + A[i - k2 * w] + A[i - k3 * w]) / 3 : 0;
      const rim = clamp((a - right) * 1.2 + (a - up) * 0.6 * (x / w));
      const side = Math.pow(x / w, 2) * Math.pow(l, 1.4) * 0.55;
      const e = clamp(rim * 0.85 + side);
      d[o] = r + (EMBER[0] - r) * e;
      d[o + 1] = gr + (EMBER[1] - gr) * e;
      d[o + 2] = b + (EMBER[2] - b) * e;
    }
  }
  g.putImageData(id, 0, 0);
  return c;
}
