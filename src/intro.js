import Typed from 'typed.js';
import triangle from './assets/seasnake-logo-triangle.svg?raw';
import { POEM, language } from './i18n.js';

export function startIntro() {
  document.querySelectorAll('[data-logo]').forEach(el => {
    const suffix = el.dataset.logo;
    el.innerHTML = triangle.replaceAll('seasnake-logo-triangle', `seasnake-logo-triangle-${suffix}`).replaceAll('id="title"', `id="title-${suffix}"`).replaceAll('id="desc"', `id="desc-${suffix}"`).replace('aria-labelledby="title desc"', `aria-labelledby="title-${suffix} desc-${suffix}"`);
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const writers = [];
  // Every page is laid out invisibly in the same grid cell, so the block keeps the tallest page's height.
  function type(element, pages, options) {
    if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', element.textContent);
    element.classList.add('typewriter');
    element.innerHTML = pages.map(page => `<span class="typewriter-reserve" aria-hidden="true">${page}</span>`).join('') + '<span class="typewriter-output" aria-hidden="true"></span>';
    const output = element.querySelector('.typewriter-output');
    const writer = { output, html: pages[0], instance: null, started: false }; writers.push(writer);
    return () => {
      if (writer.started) return; writer.started = true;
      if (reduced.matches) output.innerHTML = writer.html;
      else writer.instance = new Typed(output, { strings: options.strings || pages, showCursor: false, ...options });
    };
  }
  type(document.querySelector('#hero-title'), ['光彩跃然'], { typeSpeed: 200 })();
  // The poem behind the page: three pages typed, held, erased and typed again.
  const english = language() === 'en';
  const pages = POEM.pages[language()].map(lines => lines.join('<br>'));
  type(document.querySelector('#hero-poem'), pages, {
    // Pause after the tag: Typed.js only skips a whole tag before handling a pause, so "^500<br>" flashes a "<".
    strings: pages.map(page => page.replaceAll('<br>', '<br>^500')),
    typeSpeed: english ? 45 : 100, backSpeed: english ? 12 : 30, backDelay: 4200, startDelay: 300, loop: true,
  })();
  reduced.addEventListener('change', event => { if (event.matches) writers.forEach(w => { w.instance?.destroy(); w.instance = null; w.output.innerHTML = w.html; }); });
  const observer = new IntersectionObserver(([entry]) => {
    document.querySelector('.site-header').classList.toggle('scrolled', !entry.isIntersecting);
    document.documentElement.classList.toggle('in-gallery', !entry.isIntersecting);
  }, { rootMargin: '-110px 0px 0px 0px' });
  observer.observe(document.querySelector('.hero'));
  window.addEventListener('pagehide', event => { if (!event.persisted) { observer.disconnect(); writers.forEach(w => w.instance?.destroy()); } });
}
