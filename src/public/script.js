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

// Replace this array with a REST API response in the next development phase.
const leaderboardEntries = [
  { name: 'Koudy', correct: '10/12 correct', date: '24 Jun 2026, 10:29', score: 913, percent: '76%' },
  { name: 'Test User2', correct: '7/10 correct', date: '24 Jun 2026, 10:09', score: 420, percent: '84%' },
  { name: 'Guest', correct: '1/5 correct', date: '24 Jun 2026, 14:59', score: 95, percent: '19%' },
  { name: 'Karel', correct: '1/12 correct', date: '24 Jun 2026, 10:29', score: 55, percent: '5%' },
  { name: 'Rada', correct: '0/5 correct', date: '20 Jul 2026, 13:29', score: 0, percent: '0%' },
  { name: 'Anna', correct: '8/12 correct', date: '21 Jul 2026, 09:12', score: 0, percent: '67%' },
  { name: 'Petr', correct: '6/12 correct', date: '21 Jul 2026, 10:48', score: 0, percent: '50%' },
  { name: 'Marek', correct: '5/12 correct', date: '22 Jul 2026, 08:34', score: 0, percent: '42%' },
  { name: 'Eva', correct: '4/12 correct', date: '22 Jul 2026, 11:05', score: 0, percent: '33%' },
  { name: 'Tomáš', correct: '3/12 correct', date: '22 Jul 2026, 15:21', score: 0, percent: '25%' },
];

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
updatePlaybackControls();
startCurrentSlidePlayback();
