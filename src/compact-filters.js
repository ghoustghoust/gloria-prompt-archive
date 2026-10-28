import { t, label } from './i18n.js';
const names = ['source', 'model', 'method', 'tag'];
const kindLabels = { prompt: 'kind.prompt', reference: 'kind.reference' };
export function startCompactFilters({ getFilters, apply }) {
  const panel = document.querySelector('#filter-dialog');
  const trigger = document.querySelector('#open-filters');
  const tags = document.querySelector('#tag-filters');
  const badge = document.querySelector('#filter-count');
  let draft = {};
  const showTags = () => tags.querySelectorAll('[data-tag]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.tag === draft.tag));
  });
  const showKinds = () => panel.querySelectorAll('[data-kind]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.kind === draft.kind));
  });
  panel.querySelector('.kind-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-kind]');
    if (button) { draft.kind = button.dataset.kind; showKinds(); }
  });
  const close = () => {
    if (panel.open) panel.close();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({ preventScroll: true });
  };
  trigger.addEventListener('click', () => {
    draft = { kind: getFilters().kind, ...Object.fromEntries(names.map(name => [name, getFilters()[name] || ''])) };
    showKinds();
    for (const name of names.slice(0, 3)) document.querySelector(`#${name}-filter`).value = draft[name];
    showTags();
    panel.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    panel.querySelector('.filter-sheet-body').scrollTop = 0;
  });
  for (const name of names.slice(0, 3)) document.querySelector(`#${name}-filter`).addEventListener('change', event => { draft[name] = event.target.value; });
  tags.addEventListener('click', event => {
    const button = event.target.closest('[data-tag]');
    if (!button) return;
    draft.tag = draft.tag === button.dataset.tag ? '' : button.dataset.tag;
    showTags();
  });
  document.querySelector('#apply-filters').addEventListener('click', () => { apply(draft); close(); });
  document.querySelector('#reset-filter-draft').addEventListener('click', () => {
    draft = { kind: 'all', ...Object.fromEntries(names.map(name => [name, ''])) };
    showKinds();
    for (const name of names.slice(0, 3)) document.querySelector(`#${name}-filter`).value = '';
    showTags();
  });
  document.querySelector('#close-filters').addEventListener('click', close);
  panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
  panel.addEventListener('click', event => {
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  return { sync() {
    const filters = getFilters();
    const chosen = [kindLabels[filters.kind] && t(kindLabels[filters.kind]), ...names.map(name => filters[name] && label(filters[name]))].filter(Boolean);
    badge.textContent = chosen.length;
    badge.hidden = !chosen.length;
    trigger.classList.toggle('has-filters', !!chosen.length);
    const summary = document.querySelector('#active-filters');
    summary.textContent = chosen.join(' · ');
    summary.title = chosen.join(' · ');
    summary.hidden = !chosen.length;
  } };
}
