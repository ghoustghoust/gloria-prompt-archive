import { t } from './i18n.js';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filterItems(items, filters, favorites = new Set()) {
  const terms = (filters.query || '').normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (filters.kind === 'favorites' && !favorites.has(item.id)) return false;
    if (filters.kind && !['all', 'favorites'].includes(filters.kind) && item.kind !== filters.kind) return false;
    for (const name of ['source', 'model', 'method']) if (filters[name] && item[name] !== filters[name]) return false;
    if (filters.tag && !item.tags.includes(filters.tag)) return false;
    const text = [item.title, item.prompt, item.description, item.usage, item.source, item.author, item.model, item.modelVersion, item.method, ...item.tags, item.searchAlias].join(' ').normalize('NFKC').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
export const summaryFor = item => item.prompt || (item.description ? t('summary.effect', { text: item.description }) : t('summary.none'));
export function safeURL(value) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; } }
