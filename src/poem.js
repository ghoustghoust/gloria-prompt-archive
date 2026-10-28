import { POEM, language } from './i18n.js';

// The easter egg: the hero poem opens the whole poem, its translation and where it was first posted.
export function startPoem() {
  const trigger = document.querySelector('#hero-poem'), dialog = document.querySelector('#poem-dialog');
  const own = language() === 'en' ? 'en' : 'zh', other = own === 'en' ? 'zh' : 'en';
  const fill = (element, lang) => {
    element.lang = lang === 'en' ? 'en' : 'zh-CN';
    element.replaceChildren(...POEM[lang].map(line => Object.assign(document.createElement('p'), { textContent: line })));
  };
  fill(dialog.querySelector('#poem-text'), own);
  fill(dialog.querySelector('#poem-translation'), other);
  dialog.querySelector('#poem-source').href = POEM.source;
  const open = () => { if (!dialog.open) dialog.showModal(); };
  const close = () => { if (dialog.open) dialog.close(); trigger.focus({ preventScroll: true }); };
  trigger.addEventListener('click', open);
  trigger.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  dialog.querySelector('#close-poem').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
}
