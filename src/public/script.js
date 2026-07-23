const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dot')];
let current = 0;

// Replace this array with a REST API response in the next development phase.
const leaderboardEntries = [
  { name: 'Koudy', correct: '10/12 correct', date: '24 Jun 2026, 10:29', score: 913, percent: '76%' },
  { name: 'Test User2', correct: '7/10 correct', date: '24 Jun 2026, 10:09', score: 420, percent: '84%' },
  { name: 'Guest', correct: '1/5 correct', date: '24 Jun 2026, 14:59', score: 95, percent: '19%' },
  { name: 'Karel', correct: '1/12 correct', date: '24 Jun 2026, 10:29', score: 55, percent: '5%' },
  { name: 'Rada', correct: '0/5 correct', date: '20 Jul 2026, 13:29', score: 0, percent: '0%' },
];

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

function showSlide(nextIndex) {
  current = (nextIndex + slides.length) % slides.length;
  slides.forEach((slide, index) => { slide.hidden = index !== current; });
  dots.forEach((dot, index) => {
    const active = index === current;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });
}

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
});

renderLeaderboard(leaderboardEntries);
