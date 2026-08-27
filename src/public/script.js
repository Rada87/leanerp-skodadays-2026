const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dot')];
const video = document.querySelector('#presentation-video');
const settingsToggle = document.querySelector('.settings-toggle');
const settingsPanel = document.querySelector('.settings-panel');
const autoplayInput = document.querySelector('#autoplay-enabled');
const durationInput = document.querySelector('#slide-duration');
const durationOutput = document.querySelector('#slide-duration-value');
const playbackStorageKey = 'leanerp-skoda-playback-settings';
const defaultPlaybackSettings = { enabled: false, duration: 10 };
let current = 0;
let slideTimer;
let playbackSettings = loadPlaybackSettings();

// Local to this presentation screen only — players on the quiz tablets have
// no way to see or change it, so it can't be used to hide the mirror from
// whoever is watching the main screen.
const mirrorModeSelect = document.querySelector('#quiz-mirror-mode');
const mirrorModeStorageKey = 'leanerp-skoda-mirror-mode';
const defaultMirrorMode = 'full';

function loadMirrorMode() {
  const stored = localStorage.getItem(mirrorModeStorageKey);
  return stored === 'full' || stored === 'results' || stored === 'off' ? stored : defaultMirrorMode;
}

function saveMirrorMode(mode) {
  localStorage.setItem(mirrorModeStorageKey, mode);
}

let mirrorMode = loadMirrorMode();

const mirrorBadge = document.querySelector('#mirror-badge');
const mirrorModeLabels = { results: 'Mirror: results only', off: 'Mirror: off' };

function updateMirrorBadge() {
  if (!mirrorBadge) return;
  const label = mirrorModeLabels[mirrorMode];
  mirrorBadge.hidden = !label;
  if (label) mirrorBadge.textContent = label;
}

const leaderboardApiUrl = '/apps/leanerp-sd-quiz/api/leaderboard';
const leaderboardRefreshMs = 3000;
let leaderboardEntries = [];
let leaderboardRefreshTimer;
let leaderboardRenderKey = '';

const quizEventsUrl = '/apps/leanerp-sd-quiz/api/events';
const interruptOverlay = document.querySelector('#quiz-interrupt');
const interruptConfettiCanvas = document.querySelector('#quiz-interrupt-confetti');
const interruptName = document.querySelector('#quiz-interrupt-name');
const interruptScore = document.querySelector('#quiz-interrupt-score');
const interruptMaxScore = document.querySelector('#quiz-interrupt-maxscore');
const interruptAccuracy = document.querySelector('#quiz-interrupt-accuracy');
const interruptCorrect = document.querySelector('#quiz-interrupt-correct');
const interruptRank = document.querySelector('#quiz-interrupt-rank');
let isInterrupting = false;

const mirrorOverlay = document.querySelector('#quiz-mirror');
const mirrorName = document.querySelector('#quiz-mirror-name');
const mirrorProgress = document.querySelector('#quiz-mirror-progress');
const mirrorScore = document.querySelector('#quiz-mirror-score');
const mirrorPotential = document.querySelector('#quiz-mirror-potential');
const mirrorCategory = document.querySelector('#quiz-mirror-category');
const mirrorQuestion = document.querySelector('#quiz-mirror-question');
const mirrorOptions = document.querySelector('#quiz-mirror-options');
const mirrorTimerFill = document.querySelector('#quiz-mirror-timer');
const mirrorConfettiCanvas = document.querySelector('#quiz-mirror-confetti');
const mirrorFeedback = document.querySelector('#quiz-mirror-feedback');
const mirrorFeedbackTitle = document.querySelector('#quiz-mirror-feedback-title');
const mirrorFeedbackExplanation = document.querySelector('#quiz-mirror-feedback-explanation');
const mirrorQueue = document.querySelector('#quiz-mirror-queue');
let mirrorFeedbackKey = null;
let stopMirrorConfetti;
const MIRROR_STALE_MS = 90000;
const MIRROR_OPTION_LABELS = ['A', 'B', 'C', 'D'];
// Mirrors src/constants.ts + src/utils/scoring.ts in the quiz app — kept in
// sync manually since this is a separate, build-step-free static site.
const DEFAULT_QUESTION_TIME_SECONDS = 30;
const MAX_POINTS_PER_QUESTION = 100;
const MIN_POINTS_CORRECT = 10;
const SCORING_EXPONENT = 0.55;
let mirrorStaleTimer;
let mirrorActive = false;
let mirrorCountdownInterval;
let mirrorCountdownQuestionIndex = null;
let mirrorCountdownStart = null;
let mirrorCountdownDuration = DEFAULT_QUESTION_TIME_SECONDS;

// Ported from the quiz app's BackgroundPattern.tsx (Škoda emerald
// triangular-lattice animation) so the presentation's quiz takeover screens
// share the same animated background as the quiz on the tablet.
(function () {
  const canvas = document.querySelector('#quiz-bg-pattern');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const LINE_COLOR = [46, 169, 113];
  const FACET_COLOR = [14, 58, 47];
  const NODE_COLOR = [70, 200, 140];
  const PULSE_COLOR = [120, 250, 174];

  const STEP = 74;
  const STATIC_ALPHA = 0.16;
  const NODE_ALPHA = 0.22;
  const FACET_ALPHA = 0.16;
  const MAX_PULSES = 4;
  const SPAWN_MIN_MS = 1000;
  const SPAWN_MAX_MS = 2500;
  const DURATION_MIN_S = 4;
  const DURATION_MAX_S = 7;
  const SIN60 = Math.sqrt(3) / 2;
  const MOVES = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raf = 0;
  let running = false;
  let traces = [];
  let staticLayer = document.createElement('canvas');
  let pulses = [];
  let lastTime = 0;
  let lastSpawn = 0;
  let nextSpawnDelay = rand(SPAWN_MIN_MS, SPAWN_MAX_MS);
  let w = 0;
  let h = 0;
  let resizeTimer;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  function toPixel(i, j) { return { x: STEP * i + STEP * 0.5 * j, y: STEP * SIN60 * j }; }

  function generateLayout(width, height) {
    const cols = Math.ceil(width / STEP) + 2;
    const rows = Math.ceil(height / (STEP * SIN60)) + 2;
    const traceList = [];
    const nodes = [];
    const facets = [];
    const nodeKeys = new Set();
    const traceCount = Math.max(18, Math.floor((cols * rows) / 7));

    for (let n = 0; n < traceCount; n++) {
      let j = randInt(0, rows);
      let i = randInt(-Math.ceil(j / 2), cols);
      const latticePts = [[i, j]];
      let moveIdx = randInt(0, MOVES.length - 1);
      const bends = randInt(3, 7);
      const order = [4, 0, 2, 5, 1, 3];

      for (let b = 0; b < bends; b++) {
        const turn = Math.random() > 0.5 ? 1 : -1;
        const pos = order.indexOf(moveIdx);
        moveIdx = order[(pos + turn + order.length) % order.length];
        const steps = randInt(1, 4);
        const [di, dj] = MOVES[moveIdx];
        i += di * steps;
        j += dj * steps;
        latticePts.push([i, j]);
      }

      const pts = latticePts.map(([li, lj]) => toPixel(li, lj));
      let totalLength = 0;
      const segLens = [];
      for (let k = 1; k < pts.length; k++) {
        const l = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
        segLens.push(l);
        totalLength += l;
      }
      if (totalLength < STEP * 2) continue;

      traceList.push({ points: pts, totalLength, segmentLengths: segLens });

      for (let k = 0; k < pts.length; k++) {
        if (k === 0 || k === pts.length - 1 || Math.random() > 0.6) {
          const key = `${Math.round(pts[k].x)},${Math.round(pts[k].y)}`;
          if (!nodeKeys.has(key)) {
            nodeKeys.add(key);
            nodes.push({ x: pts[k].x, y: pts[k].y, size: rand(2.5, 4.5) });
          }
        }
      }
    }

    const facetCount = Math.floor(traceCount * 0.7);
    for (let n = 0; n < facetCount; n++) {
      const j = randInt(0, rows);
      const i = randInt(-Math.ceil(j / 2), cols);
      const scale = Math.random() > 0.7 ? randInt(2, 4) : 1;
      const order = [4, 0, 2, 5, 1, 3];
      const a = randInt(0, order.length - 1);
      const d1 = MOVES[order[a]];
      const d2 = MOVES[order[(a + 1) % order.length]];
      const p0 = toPixel(i, j);
      const p1 = toPixel(i + d1[0] * scale, j + d1[1] * scale);
      const p2 = toPixel(i + d2[0] * scale, j + d2[1] * scale);
      facets.push({ points: [p0, p1, p2] });
    }

    return { traces: traceList, nodes, facets };
  }

  function paintBackground(sctx, width, height) {
    const grad = sctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.max(width, height) * 0.75);
    grad.addColorStop(0, 'rgb(9,26,20)');
    grad.addColorStop(0.55, 'rgb(5,15,11)');
    grad.addColorStop(1, 'rgb(2,6,5)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, width, height);
  }

  function drawStaticLayer(sctx, width, height, traceList, nodes, facets) {
    paintBackground(sctx, width, height);

    for (const f of facets) {
      const [p0, p1, p2] = f.points;
      sctx.beginPath();
      sctx.moveTo(p0.x, p0.y);
      sctx.lineTo(p1.x, p1.y);
      sctx.lineTo(p2.x, p2.y);
      sctx.closePath();
      sctx.fillStyle = rgba(FACET_COLOR, FACET_ALPHA);
      sctx.fill();
      sctx.strokeStyle = rgba(LINE_COLOR, STATIC_ALPHA * 0.6);
      sctx.lineWidth = 0.75;
      sctx.stroke();
    }

    sctx.strokeStyle = rgba(LINE_COLOR, STATIC_ALPHA);
    sctx.lineWidth = 1;
    sctx.lineCap = 'round';
    sctx.lineJoin = 'miter';
    for (const tr of traceList) {
      sctx.beginPath();
      sctx.moveTo(tr.points[0].x, tr.points[0].y);
      for (let i = 1; i < tr.points.length; i++) sctx.lineTo(tr.points[i].x, tr.points[i].y);
      sctx.stroke();
    }

    sctx.fillStyle = rgba(NODE_COLOR, NODE_ALPHA);
    for (const node of nodes) {
      sctx.save();
      sctx.translate(node.x, node.y);
      sctx.rotate(Math.PI / 4);
      sctx.fillRect(-node.size / 2, -node.size / 2, node.size, node.size);
      sctx.restore();
    }
  }

  function drawTracePortion(dctx, trace, fromDist, toDist) {
    let acc = 0;
    let started = false;
    for (let i = 0; i < trace.segmentLengths.length; i++) {
      const sLen = trace.segmentLengths[i];
      const sStart = acc;
      const sEnd = acc + sLen;
      if (sEnd <= fromDist || sStart >= toDist) { acc += sLen; continue; }
      const cs = Math.max(fromDist, sStart);
      const ce = Math.min(toDist, sEnd);
      const t1 = sLen > 0 ? (cs - sStart) / sLen : 0;
      const t2 = sLen > 0 ? (ce - sStart) / sLen : 1;
      const p = trace.points;
      const x1 = p[i].x + (p[i + 1].x - p[i].x) * t1;
      const y1 = p[i].y + (p[i + 1].y - p[i].y) * t1;
      const x2 = p[i].x + (p[i + 1].x - p[i].x) * t2;
      const y2 = p[i].y + (p[i + 1].y - p[i].y) * t2;
      if (!started) { dctx.moveTo(x1, y1); started = true; } else { dctx.lineTo(x1, y1); }
      dctx.lineTo(x2, y2);
      acc += sLen;
    }
  }

  function setup() {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const layout = generateLayout(w, h);
    traces = layout.traces;
    pulses = [];

    staticLayer = document.createElement('canvas');
    staticLayer.width = w * dpr;
    staticLayer.height = h * dpr;
    const sctx = staticLayer.getContext('2d');
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStaticLayer(sctx, w, h, traces, layout.nodes, layout.facets);
  }

  function drawStaticFrame() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticLayer, 0, 0);
    ctx.restore();
  }

  function drawFrame(time) {
    if (!running) return;

    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;

    if (traces.length > 0 && time - lastSpawn > nextSpawnDelay && pulses.length < MAX_PULSES) {
      pulses.push({
        traceIndex: randInt(0, traces.length - 1),
        progress: 0,
        speed: 1 / rand(DURATION_MIN_S, DURATION_MAX_S),
        pulseLength: rand(70, 140),
      });
      lastSpawn = time;
      nextSpawnDelay = rand(SPAWN_MIN_MS, SPAWN_MAX_MS);
    }

    for (const p of pulses) p.progress += p.speed * dt;
    pulses = pulses.filter((p) => p.progress <= 1.2);

    drawStaticFrame();

    for (const pulse of pulses) {
      const trace = traces[pulse.traceIndex];
      const center = pulse.progress * trace.totalLength;
      const half = pulse.pulseLength / 2;
      let alpha = 1;
      if (pulse.progress < 0.1) alpha = pulse.progress / 0.1;
      else if (pulse.progress > 0.9) alpha = Math.max(0, (1.2 - pulse.progress) / 0.3);

      ctx.save();
      ctx.beginPath();
      drawTracePortion(ctx, trace, center - half, center + half);
      ctx.strokeStyle = rgba(PULSE_COLOR, 0.5 * alpha);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 16;
      ctx.shadowColor = rgba(PULSE_COLOR, 0.6 * alpha);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      drawTracePortion(ctx, trace, center - half * 0.35, center + half * 0.35);
      ctx.strokeStyle = rgba(PULSE_COLOR, 0.95 * alpha);
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 6;
      ctx.shadowColor = rgba(PULSE_COLOR, 0.85 * alpha);
      ctx.stroke();
      ctx.restore();
    }

    raf = requestAnimationFrame(drawFrame);
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      setup();
      if (reducedMotion) drawStaticFrame();
    }, 250);
  }

  window.startBgPattern = function startBgPattern() {
    if (running) return;
    running = true;
    canvas.hidden = false;
    setup();
    window.addEventListener('resize', onResize);
    if (reducedMotion) {
      drawStaticFrame();
    } else {
      lastTime = 0;
      raf = requestAnimationFrame(drawFrame);
    }
  };

  window.stopBgPattern = function stopBgPattern() {
    if (!running) return;
    running = false;
    canvas.hidden = true;
    window.removeEventListener('resize', onResize);
    window.clearTimeout(resizeTimer);
    if (raf) cancelAnimationFrame(raf);
  };
})();

function loadPlaybackSettings() {
  try {
    return { ...defaultPlaybackSettings, ...JSON.parse(localStorage.getItem(playbackStorageKey)) };
  } catch {
    return { ...defaultPlaybackSettings };
  }
}

function savePlaybackSettings() {
  localStorage.setItem(playbackStorageKey, JSON.stringify(playbackSettings));
}

function updatePlaybackControls() {
  autoplayInput.checked = playbackSettings.enabled;
  durationInput.value = playbackSettings.duration;
  durationOutput.textContent = `${playbackSettings.duration} s`;
}

function renderLeaderboard(entries) {
  const renderKey = JSON.stringify(entries);
  if (renderKey === leaderboardRenderKey) return;
  leaderboardRenderKey = renderKey;
  const list = document.querySelector('#leaderboard');
  list.classList.toggle('is-empty', !entries.length);
  if (!entries.length) {
    list.innerHTML = '<li class="leaderboard-empty">No quiz results yet.</li>';
    return;
  }
  list.innerHTML = entries.map((entry, index) => `
    <li class="leaderboard-item ${index === 0 ? 'leaderboard-item--winner' : ''}">
      <span class="rank">${index + 1}</span>
      <div>
        <div class="entry-name">${entry.name}</div>
        <div class="entry-meta">${entry.correct} · ${entry.date}</div>
      </div>
      <div>
        <div class="entry-score">${entry.score}</div>
        <div class="entry-percent">${entry.percent}</div>
      </div>
    </li>
  `).join('');
}

function formatLeaderboardDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

async function refreshLeaderboard() {
  try {
    const response = await fetch(leaderboardApiUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Leaderboard API returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.entries)) throw new Error('Leaderboard API returned an invalid payload');
    leaderboardEntries = payload.entries.slice(0, 10).map((entry) => ({
      name: entry.playerName,
      correct: `${entry.correctAnswers}/${entry.totalQuestions} correct`,
      date: formatLeaderboardDate(entry.createdAt),
      score: entry.score,
      percent: `${entry.percentage}%`,
    }));
    renderLeaderboard(leaderboardEntries);
  } catch (error) {
    console.warn('Could not refresh quiz leaderboard.', error);
    renderLeaderboard(leaderboardEntries);
  } finally {
    if (current === 2) {
      window.clearTimeout(leaderboardRefreshTimer);
      leaderboardRefreshTimer = window.setTimeout(refreshLeaderboard, leaderboardRefreshMs);
    }
  }
}

function startLeaderboardRefresh() {
  window.clearTimeout(leaderboardRefreshTimer);
  refreshLeaderboard();
}

function stopLeaderboardRefresh() {
  window.clearTimeout(leaderboardRefreshTimer);
}

function stopCurrentSlidePlayback() {
  window.clearTimeout(slideTimer);
  if (video && current === 1) {
    video.pause();
    video.currentTime = 0;
  }
}

function scheduleNextSlide() {
  window.clearTimeout(slideTimer);
  if (!playbackSettings.enabled) return;
  slideTimer = window.setTimeout(() => showSlide(current + 1), playbackSettings.duration * 1000);
}

function playVideoSlide() {
  if (!playbackSettings.enabled || !video) return;
  const playAttempt = video.play();
  if (playAttempt) {
    playAttempt.catch(() => scheduleNextSlide());
  }
}

function startCurrentSlidePlayback() {
  if (!playbackSettings.enabled) return;
  if (current === 1 && video?.querySelector('source')) {
    playVideoSlide();
  } else {
    scheduleNextSlide();
  }
}

function showSlide(nextIndex) {
  stopCurrentSlidePlayback();
  stopLeaderboardRefresh();
  current = (nextIndex + slides.length) % slides.length;
  slides.forEach((slide, index) => { slide.hidden = index !== current; });
  dots.forEach((dot, index) => {
    const active = index === current;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });
  if (current === 2) startLeaderboardRefresh();
  startCurrentSlidePlayback();
}

function launchConfetti(canvas, totalCount = 80, totalSpread = 500) {
  const c = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['#67f59d', '#2f6347', '#ffd700', '#ff6b9d', '#4dc9f6', '#ffffff', '#df6340'];
  const cx = w / 2;
  const cy = h * 0.35;

  function spawn(count, spread) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * spread * 0.04;
      out.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3 - Math.random() * 5,
        w: 4 + Math.random() * 8,
        h: 4 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
        decay: 0.003 + Math.random() * 0.004,
        gravity: 0.12 + Math.random() * 0.1,
      });
    }
    return out;
  }

  let particles = spawn(Math.ceil(totalCount * 0.7), totalSpread);
  const burst2 = window.setTimeout(() => { particles.push(...spawn(Math.ceil(totalCount * 0.3), totalSpread * 0.8)); }, 250);
  let raf;

  function animate() {
    c.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of particles) {
      if (p.opacity <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.rot += p.rotSpeed;
      p.opacity -= p.decay;
      if (p.opacity < 0) p.opacity = 0;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.globalAlpha = p.opacity;
      c.fillStyle = p.color;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    if (alive) raf = requestAnimationFrame(animate);
  }
  raf = requestAnimationFrame(animate);

  return () => {
    window.clearTimeout(burst2);
    if (raf) cancelAnimationFrame(raf);
    c.clearRect(0, 0, w, h);
  };
}

function animateScoreCountUp(target, onDone) {
  const duration = 2500;
  const steps = 60;
  let step = 0;
  const interval = window.setInterval(() => {
    step++;
    const t = step / steps;
    const eased = 1 - Math.pow(1 - t, 3);
    interruptScore.textContent = String(Math.min(Math.round(target * eased), target));
    if (step >= steps) {
      window.clearInterval(interval);
      onDone();
    }
  }, duration / steps);
}

function stopMirrorCountdown() {
  window.clearInterval(mirrorCountdownInterval);
}

function calculateMirrorPotential(remainingTime, totalTime) {
  if (remainingTime <= 0 || totalTime <= 0) return 0;
  const ratio = Math.min(remainingTime / totalTime, 1);
  const raw = Math.round(MAX_POINTS_PER_QUESTION * Math.pow(ratio, SCORING_EXPONENT));
  return Math.max(raw, MIN_POINTS_CORRECT);
}

function setMirrorTimerFill(ratio) {
  mirrorTimerFill.style.width = `${Math.max(ratio, 0) * 100}%`;
  mirrorTimerFill.classList.remove('quiz-mirror__timer-fill--mid', 'quiz-mirror__timer-fill--low');
  if (ratio < 0.25) mirrorTimerFill.classList.add('quiz-mirror__timer-fill--low');
  else if (ratio < 0.5) mirrorTimerFill.classList.add('quiz-mirror__timer-fill--mid');
}

function tickMirrorCountdown() {
  const elapsed = (performance.now() - mirrorCountdownStart) / 1000;
  const remaining = Math.max(mirrorCountdownDuration - elapsed, 0);
  setMirrorTimerFill(remaining / mirrorCountdownDuration);
  mirrorPotential.textContent = `+${calculateMirrorPotential(remaining, mirrorCountdownDuration)}`;
  if (remaining <= 0) stopMirrorCountdown();
}

function setQuizModeActive(active) {
  if (active) startBgPattern();
  else stopBgPattern();
}

function enterMirrorMode() {
  if (mirrorActive) return;
  mirrorActive = true;
  window.clearTimeout(slideTimer);
  stopCurrentSlidePlayback();
  stopLeaderboardRefresh();
  closeSettingsPanel();
  setQuizModeActive(true);
  mirrorOverlay.hidden = false;
}

function exitMirrorMode() {
  if (!mirrorActive) return;
  mirrorActive = false;
  window.clearTimeout(mirrorStaleTimer);
  stopMirrorCountdown();
  mirrorCountdownQuestionIndex = null;
  mirrorFeedbackKey = null;
  if (stopMirrorConfetti) {
    stopMirrorConfetti();
    stopMirrorConfetti = undefined;
  }
  mirrorOverlay.hidden = true;
  setQuizModeActive(false);
  startCurrentSlidePlayback();
}

function scheduleMirrorStale() {
  window.clearTimeout(mirrorStaleTimer);
  mirrorStaleTimer = window.setTimeout(exitMirrorMode, MIRROR_STALE_MS);
}

function renderMirrorQuestion(payload) {
  if (mirrorMode !== 'full') return; // live question mirror only shown in full-quiz mode
  if (isInterrupting) return; // a completion takeover is already in progress
  enterMirrorMode();
  scheduleMirrorStale();

  mirrorName.textContent = payload.playerName || 'Guest';
  mirrorProgress.textContent = `Question ${(payload.questionIndex ?? 0) + 1} / ${payload.totalQuestions ?? ''}`;
  mirrorScore.textContent = String(payload.score ?? 0);
  mirrorCategory.textContent = payload.category || '';
  mirrorQuestion.textContent = payload.question || '';

  const duration = payload.questionTimeSeconds || DEFAULT_QUESTION_TIME_SECONDS;
  if (payload.questionIndex !== mirrorCountdownQuestionIndex) {
    mirrorCountdownQuestionIndex = payload.questionIndex;
    mirrorCountdownDuration = duration;
    mirrorCountdownStart = performance.now();
    stopMirrorCountdown();
    setMirrorTimerFill(1);
    mirrorPotential.textContent = `+${calculateMirrorPotential(duration, duration)}`;
    mirrorCountdownInterval = window.setInterval(tickMirrorCountdown, 100);
  }
  if (payload.isAnswered) {
    stopMirrorCountdown();
    mirrorPotential.textContent = '+0';
  }

  const feedbackKey = `${payload.questionIndex}:${payload.isAnswered}`;
  const isFreshAnswer = payload.isAnswered && feedbackKey !== mirrorFeedbackKey;
  mirrorFeedbackKey = feedbackKey;

  const options = Array.isArray(payload.options) ? payload.options : [];
  mirrorOptions.innerHTML = '';
  options.forEach((opt, i) => {
    const el = document.createElement('div');
    el.className = 'quiz-mirror__option';
    const isSelected = payload.selectedAnswer === opt.id;
    const isCorrectOption = payload.correctOptionId === opt.id;
    if (payload.isAnswered && isCorrectOption) {
      el.classList.add('quiz-mirror__option--correct');
      if (isSelected && isFreshAnswer) el.classList.add('quiz-mirror__option--bounce');
    } else if (payload.isAnswered && isSelected) {
      el.classList.add('quiz-mirror__option--wrong');
      if (isFreshAnswer) el.classList.add('quiz-mirror__option--shake');
    } else if (!payload.isAnswered && isSelected) {
      el.classList.add('quiz-mirror__option--selected');
    }
    const labelEl = document.createElement('span');
    labelEl.className = 'quiz-mirror__option-label';
    labelEl.textContent = MIRROR_OPTION_LABELS[i] || '';
    const textEl = document.createElement('span');
    textEl.textContent = opt.text;
    el.appendChild(labelEl);
    el.appendChild(textEl);
    mirrorOptions.appendChild(el);
  });

  if (payload.isAnswered) {
    const isCorrect = payload.selectedAnswer === payload.correctOptionId;
    const isTimeout = payload.selectedAnswer === null || payload.selectedAnswer === undefined;
    mirrorFeedback.hidden = false;
    mirrorFeedback.classList.toggle('quiz-mirror__feedback--correct', isCorrect);
    mirrorFeedback.classList.toggle('quiz-mirror__feedback--wrong', !isCorrect);
    mirrorFeedbackTitle.textContent = isCorrect
      ? `Correct! +${payload.pointsEarned ?? 0} pts`
      : isTimeout
        ? "Time's up!"
        : 'Not quite!';
    mirrorFeedbackExplanation.textContent = payload.explanation || '';

    if (isCorrect && isFreshAnswer) {
      if (stopMirrorConfetti) stopMirrorConfetti();
      stopMirrorConfetti = launchConfetti(mirrorConfettiCanvas, 35, 280);
    }
  } else {
    mirrorFeedback.hidden = true;
    if (stopMirrorConfetti) {
      stopMirrorConfetti();
      stopMirrorConfetti = undefined;
    }
  }
}

function interruptWithQuizResult(payload) {
  if (mirrorMode === 'off') return;
  if (isInterrupting) return;
  isInterrupting = true;

  window.clearTimeout(slideTimer);
  window.clearTimeout(mirrorStaleTimer);
  stopMirrorCountdown();
  mirrorCountdownQuestionIndex = null;
  mirrorFeedbackKey = null;
  if (stopMirrorConfetti) {
    stopMirrorConfetti();
    stopMirrorConfetti = undefined;
  }
  mirrorActive = false;
  mirrorOverlay.hidden = true;
  stopCurrentSlidePlayback();
  stopLeaderboardRefresh();
  closeSettingsPanel();
  setQuizModeActive(true);

  interruptName.textContent = payload.playerName || 'Guest';
  interruptScore.textContent = '0';
  interruptMaxScore.textContent = String(payload.maxScore ?? '');
  interruptAccuracy.textContent = `${payload.percentage ?? 0}%`;
  interruptCorrect.textContent = `${payload.correctAnswers ?? 0}/${payload.totalQuestions ?? 0}`;
  if (payload.rank && payload.totalPlayers) {
    interruptRank.hidden = false;
    interruptRank.textContent = `Rank #${payload.rank} of ${payload.totalPlayers}`;
  } else {
    interruptRank.hidden = true;
  }

  interruptOverlay.hidden = false;
  const stopConfetti = launchConfetti(interruptConfettiCanvas);

  animateScoreCountUp(payload.score ?? 0, () => {
    const holdMs = Math.max(playbackSettings.duration, 5) * 1000;
    window.setTimeout(() => {
      stopConfetti();
      interruptOverlay.hidden = true;
      isInterrupting = false;
      setQuizModeActive(false);
      showSlide(2);
    }, holdMs);
  });
}

function connectQuizEvents() {
  const source = new EventSource(quizEventsUrl);
  source.addEventListener('quiz_completed', (event) => {
    try {
      interruptWithQuizResult(JSON.parse(event.data));
    } catch (error) {
      console.warn('Could not parse quiz_completed event.', error);
    }
  });
  source.addEventListener('queue_state', (event) => {
    if (!mirrorQueue) return;
    try {
      const count = JSON.parse(event.data).waitingCount ?? 0;
      mirrorQueue.hidden = count < 1;
      mirrorQueue.textContent = count === 1 ? '1 waiting' : `${count} waiting`;
    } catch (error) {
      console.warn('Could not parse queue_state event.', error);
    }
  });
  source.addEventListener('quiz_progress', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'question') renderMirrorQuestion(payload);
    } catch (error) {
      console.warn('Could not parse quiz_progress event.', error);
    }
  });
  source.onerror = (error) => {
    console.warn('Quiz events stream error (browser will retry automatically).', error);
  };
}

function closeSettingsPanel() {
  settingsToggle.setAttribute('aria-expanded', 'false');
  settingsPanel.hidden = true;
}

settingsToggle.addEventListener('click', () => {
  const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    closeSettingsPanel();
  } else {
    settingsToggle.setAttribute('aria-expanded', 'true');
    settingsPanel.hidden = false;
  }
});

document.addEventListener('click', (event) => {
  if (settingsPanel.hidden) return;
  if (event.target === settingsToggle || settingsPanel.contains(event.target) || settingsToggle.contains(event.target)) return;
  closeSettingsPanel();
});

autoplayInput.addEventListener('change', () => {
  playbackSettings.enabled = autoplayInput.checked;
  savePlaybackSettings();
  stopCurrentSlidePlayback();
  startCurrentSlidePlayback();
});

durationInput.addEventListener('input', () => {
  playbackSettings.duration = Number(durationInput.value);
  updatePlaybackControls();
  savePlaybackSettings();
  if (current !== 1) scheduleNextSlide();
});

// Optional-chained like the video handlers below: a browser holding a cached
// older index.html must still reach connectQuizEvents() at the end of this
// file, or quiz mirroring dies silently on that screen.
mirrorModeSelect?.addEventListener('change', () => {
  mirrorMode = mirrorModeSelect.value;
  saveMirrorMode(mirrorMode);
  updateMirrorBadge();
  if (mirrorMode === 'off' && mirrorActive) exitMirrorMode();
});

video?.addEventListener('ended', () => {
  if (playbackSettings.enabled && current === 1) showSlide(current + 1);
});

video?.addEventListener('error', () => {
  if (playbackSettings.enabled && current === 1) scheduleNextSlide();
});

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.action === 'next') showSlide(current + 1);
  if (target.dataset.action === 'previous') showSlide(current - 1);
  if (target.dataset.goTo) showSlide(Number(target.dataset.goTo));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'PageDown') showSlide(current + 1);
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') showSlide(current - 1);
  if (event.key === ' ') {
    event.preventDefault();
    playbackSettings.enabled = !playbackSettings.enabled;
    updatePlaybackControls();
    savePlaybackSettings();
    stopCurrentSlidePlayback();
    startCurrentSlidePlayback();
  }
});

renderLeaderboard(leaderboardEntries);
if (mirrorModeSelect) mirrorModeSelect.value = mirrorMode;
updateMirrorBadge();
updatePlaybackControls();
startCurrentSlidePlayback();
connectQuizEvents();
