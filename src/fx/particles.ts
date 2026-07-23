/* ===== PARTICLES & TOASTS ===== */

let particles: any[] = [];
let pCanvas: HTMLCanvasElement | null = null;
let pCtx: CanvasRenderingContext2D | null = null;
let canvasReady = false;
let isAnimating = false;
const MAX_PARTICLES = 300;
const particlePool: any[] = [];

/** Reduced-motion users get no particle animation (WCAG 2.3.3). */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Sync the canvas backing-store resolution with its CSS size (DPR-aware)
 *  so particles render crisply and at correct coordinates on any screen. */
function syncCanvasSize() {
  if (!pCanvas) return;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const rect = pCanvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  if (pCanvas.width !== cssW * dpr || pCanvas.height !== cssH * dpr) {
    pCanvas.width = cssW * dpr;
    pCanvas.height = cssH * dpr;
    pCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function ensureCanvas() {
  if (canvasReady) return;
  if (typeof document === 'undefined') return;
  pCanvas = document.getElementById('particleCanvas') as HTMLCanvasElement | null;
  if (pCanvas) {
    pCtx = pCanvas.getContext('2d') as CanvasRenderingContext2D | null;
    syncCanvasSize();
    // Keep the backing store in sync across resize / orientation change.
    window.addEventListener('resize', syncCanvasSize);
    window.addEventListener('orientationchange', syncCanvasSize);
  }
  canvasReady = true;
}

/** Canvas CSS-pixel dimensions (coordinate space used by spawn helpers). */
function canvasSize(): { w: number; h: number } {
  if (!pCanvas) return { w: 480, h: 900 };
  const r = pCanvas.getBoundingClientRect();
  return { w: r.width || 480, h: r.height || 900 };
}

function startAnimation() {
  if (isAnimating) return;
  isAnimating = true;
  animateParticles();
}

function acquireParticle() {
  return particlePool.pop() || {};
}

function releaseParticle(p: any) {
  if (particlePool.length < MAX_PARTICLES) particlePool.push(p);
}

export function spawnParticles(x: number, y: number, color: string, count: number, opts?: any) {
  ensureCanvas();
  opts = opts || {};
  // Respect OS reduced-motion: skip particle fx entirely (audio/toasts remain).
  if (prefersReducedMotion()) return;
  // 避免粒子风暴导致渲染卡顿：超过上限时拒绝新增
  if (particles.length >= MAX_PARTICLES) return;
  const addCount = Math.min(count, MAX_PARTICLES - particles.length);
  for (let i = 0; i < addCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 3) + Math.random() * 3;
    const p = acquireParticle();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp - (opts.upward || 0);
    p.color = color;
    p.life = 1.0;
    p.decay = 0.015 + Math.random() * 0.015;
    p.radius = (opts.minR || 3) + Math.random() * (opts.maxR || 3);
    p.gravity = opts.gravity !== undefined ? opts.gravity : 0.08;
    p.shape = opts.shape || 'circle';
    particles.push(p);
  }
  startAnimation();
}

export function spawnParticlesAtElement(el: Element | null, color: string, count: number, opts?: any) {
  if (!el || typeof document === 'undefined') return;
  ensureCanvas();
  const r = el.getBoundingClientRect();
  // Convert viewport coordinates to canvas-local CSS coordinates (the canvas
  // is centered on wide screens, so its left/top origin is not always 0).
  const cx = pCanvas ? pCanvas.getBoundingClientRect().left : 0;
  const cy = pCanvas ? pCanvas.getBoundingClientRect().top : 0;
  spawnParticles(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy, color, count, opts);
}

export function spawnCorrectParticles() {
  const { w } = canvasSize();
  for (let i = 0; i < 20; i++)
    spawnParticles(Math.random() * w, -10, '#7BC67E', 1, {
      speed: 1,
      gravity: 0.15,
      shape: 'star',
      minR: 4,
      maxR: 4,
    });
}

export function spawnComboParticles() {
  const colors = ['#FF8C42', '#E8587A', '#FFD166', '#7BC67E', '#7C6BFF', '#4ECDC4'];
  const { w, h } = canvasSize();
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 4;
    const r = 30 + i * 3;
    spawnParticles(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, colors[i % colors.length], 1, {
      speed: 2,
      gravity: 0.02,
      minR: 3,
      maxR: 4,
    });
  }
}

export function spawnConfetti() {
  const colors = ['#FF8C42', '#E8587A', '#FFD166', '#7BC67E', '#7C6BFF', '#4ECDC4'];
  const { w, h } = canvasSize();
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 4;
    spawnParticles(
      w / 2 + Math.cos(a) * 80,
      h * 0.45 + Math.sin(a) * 80,
      colors[Math.floor(Math.random() * colors.length)],
      1,
      { speed: sp, gravity: 0.1, minR: 3, maxR: 6 }
    );
  }
}

function drawParticle(p: any) {
  if (!pCtx) return;
  pCtx.globalAlpha = p.life;
  pCtx.fillStyle = p.color;
  if (p.shape === 'star') {
    pCtx.font = p.radius * 2 + 'px system-ui';
    pCtx.fillText('⭐', p.x, p.y);
  } else {
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    pCtx.fill();
  }
}

export function animateParticles() {
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;
  ensureCanvas();
  if (!pCtx || !pCanvas) {
    isAnimating = false;
    return;
  }
  const { w, h } = canvasSize();
  pCtx.clearRect(0, 0, w, h);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life -= p.decay;
    if (p.life <= 0) {
      const dead = particles.splice(i, 1)[0];
      releaseParticle(dead);
      continue;
    }
    drawParticle(p);
  }
  pCtx.globalAlpha = 1;
  if (particles.length > 0) {
    requestAnimationFrame(animateParticles);
  } else {
    isAnimating = false;
  }
}

// Start animation if in a browser environment (will stop itself if no particles)
if (typeof window !== 'undefined' && typeof requestAnimationFrame === 'function') {
  startAnimation();
}

export function showSuccessToast(msg: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('globalSuccessToast');
  if (!el) return;
  el.textContent = msg;
  (el as HTMLElement).style.display = 'block';
  setTimeout(() => {
    (el as HTMLElement).style.display = 'none';
  }, 2600);
}

export function showErrorToast(msg: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('globalErrorToast');
  if (!el) return;
  el.textContent = msg;
  (el as HTMLElement).style.display = 'block';
  setTimeout(() => {
    (el as HTMLElement).style.display = 'none';
  }, 2600);
}
/* ===== EXPOSE GLOBALS ===== */
Object.assign(window as any, {
  animateParticles: animateParticles,
  showErrorToast: showErrorToast,
  showSuccessToast: showSuccessToast,
  spawnComboParticles: spawnComboParticles,
  spawnConfetti: spawnConfetti,
  spawnCorrectParticles: spawnCorrectParticles,
  spawnParticles: spawnParticles,
  spawnParticlesAtElement: spawnParticlesAtElement,
});
