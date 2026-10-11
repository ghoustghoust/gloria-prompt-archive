import { icon } from './icons.js';

export function createSortControl(parent, onChange) {
  const root = document.createElement('div');
  root.className = 'sort-control';
  root.innerHTML = `<button id="sort-order" class="sort-trigger" type="button" aria-label="作品排序：最近收录" aria-haspopup="listbox" aria-expanded="false" aria-controls="sort-options"><span>最近收录</span>${icon('chevron')}</button><div id="sort-options" class="sort-options" role="listbox" aria-label="作品排序" hidden><button type="button" role="option" data-sort="recent" aria-selected="true"><span>最近收录</span><span class="sort-check" aria-hidden="true">✓</span></button><button type="button" role="option" data-sort="popular" aria-selected="false"><span>最多点赞</span><span class="sort-check" aria-hidden="true">✓</span></button></div>`;
  parent.append(root);
  const trigger = root.querySelector('.sort-trigger'), menu = root.querySelector('.sort-options');
  const options = [...menu.querySelectorAll('[data-sort]')];
  let value = 'recent';
  function close(focus = false) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focus) trigger.focus({preventScroll:true}); }
  function open() { menu.hidden = false; trigger.setAttribute('aria-expanded','true'); options.find(option => option.dataset.sort === value).focus({preventScroll:true}); }
  function setValue(next) {
    value = next;
    for (const option of options) option.setAttribute('aria-selected', String(option.dataset.sort === value));
    const label = options.find(option => option.dataset.sort === value).querySelector('span').textContent;
    trigger.querySelector('span').textContent = label;
    trigger.setAttribute('aria-label', '作品排序：' + label);
    trigger.dataset.value = value;
  }
  trigger.addEventListener('click', () => menu.hidden ? open() : close(true));
  trigger.addEventListener('keydown', event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); open(); } });
  menu.addEventListener('click', event => { const option = event.target.closest('[data-sort]'); if (!option) return; const next = option.dataset.sort, changed = next !== value; setValue(next); close(true); if (changed) onChange(next); });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus({preventScroll:true});
    }
  });
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
  setValue(value);
  return {get value() {return value;},set value(next) {setValue(next);},set busy(busy) {trigger.disabled = busy; trigger.setAttribute('aria-busy',String(busy));}};
}
