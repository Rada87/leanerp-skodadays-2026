const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dot')];
let current = 0;

function showSlide(nextIndex) {
  current = (nextIndex + slides.length) % slides.length;
  slides.forEach((slide, index) => {
    const active = index === current;
    slide.hidden = !active;
    slide.classList.toggle('is-active', active);
  });
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
