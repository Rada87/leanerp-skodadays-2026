const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dot')];
const video = document.querySelector('#presentation-video');
const settingsToggle = document.querySelector('.settings-toggle');
const settingsPanel = document.querySelector('.settings-panel');
const autoplayInput = document.querySelector('#autoplay-enabled');
const durationInput = document.querySelector('#slide-duration');
const durationOutput = document.querySelector('#slide-duration-value');
const playbackStorageKey = 'leanerp-skoda-playback-settings';
const defaultPlaybackSettings = { enabled: true, duration: 10 };
let current = 0;
let slideTimer;
let playbackSettings = loadPlaybackSettings();

const leaderboardApiUrl = '/apps/leanerp-sd-quiz/api/leaderboard';
let leaderboardEntries = [];

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
  }
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
  current = (nextIndex + slides.length) % slides.length;
  slides.forEach((slide, index) => { slide.hidden = index !== current; });
  dots.forEach((dot, index) => {
    const active = index === current;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });
  if (current === 2) refreshLeaderboard();
  startCurrentSlidePlayback();
}

settingsToggle.addEventListener('click', () => {
  const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
  settingsToggle.setAttribute('aria-expanded', String(!expanded));
  settingsPanel.hidden = expanded;
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
refreshLeaderboard();
window.setInterval(refreshLeaderboard, 30000);
updatePlaybackControls();
startCurrentSlidePlayback();
