// README chart: what the library holds, by model, method and style tag. One series per panel,
// value labels at the bar ends; light and dark steps follow the viewer's colour scheme.
import { ENGLISH_NAMES } from '../src/i18n.js';

const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => new Intl.NumberFormat('en-US').format(value);

const TEXT = {
  zh: {
    title: '光彩跃然 · 影像灵感库收录统计', label: 112, model: '模型', method: '生成方式', tags: '风格标签 · 前 10', other: '其他',
    headline: (total, prompts) => `${number(total)} 条收录 · ${number(prompts)} 条带完整提示词`,
    synced: date => `每六小时从飞书同步一次 · 最近 ${date}`,
    note: '一条作品可以有多个风格标签；模型和方式标「待确认」的是原帖没写清楚的。',
    desc: (total, prompts, date) => `${number(total)} 条收录，${number(prompts)} 条带完整提示词。按模型、生成方式和风格标签统计，${date} 同步。`,
    names: {},
  },
  en: {
    title: 'GLORIA prompt archive in numbers', label: 136, model: 'Model', method: 'Method', tags: 'Style tags · top 10', other: 'Other',
    headline: (total, prompts) => `${number(total)} works · ${number(prompts)} with the full prompt`,
    synced: date => `Synced from Feishu every six hours · last ${date}`,
    note: 'A work can have several tags. "Unconfirmed" means the original post didn\'t say.',
    desc: (total, prompts, date) => `${number(total)} works, ${number(prompts)} with the full prompt, by model, method and style tag. Synced ${date}.`,
    names: ENGLISH_NAMES,
  },
};

function fold(counts, keep, other) {
  const rows = [...counts].filter(([name]) => name !== '其他');
  const rest = rows.slice(keep).reduce((sum, [, count]) => sum + count, counts.get('其他') || 0);
  return [...rows.slice(0, keep), ...(rest ? [[other, rest]] : [])];
}

function panel({ x, y, width, label, title, rows, max = Math.max(...rows.map(([, count]) => count)) }) {
  const value = 52, bar = width - label - value, row = 26;
  const parts = title ? [`<text class="title" x="${x}" y="${y}">${xml(title)}</text>`] : [];
  rows.forEach(([name, count], index) => {
    const top = y + 18 + index * row, length = Math.max(3, Math.round(count / max * bar));
    parts.push(
      `<text class="label" x="${x + label - 10}" y="${top + 10}" text-anchor="end">${xml(name)}</text>`,
      `<path class="bar" d="M${x + label} ${top + 2}h${length - 4}a4 4 0 0 1 4 4v4a4 4 0 0 1 -4 4h${4 - length}z"><title>${xml(name)}: ${number(count)}</title></path>`,
      `<text class="value" x="${x + label + length + 6}" y="${top + 10}">${number(count)}</text>`);
  });
  return { svg: parts.join(''), bottom: y + 18 + rows.length * row };
}

export function statsSVG(library, lang = 'zh') {
  const t = TEXT[lang], rename = rows => rows.map(([name, count]) => [t.names[name] || name, count]);
  const width = 880, pad = 28, column = (width - pad * 3) / 2, total = library.items.length;
  const prompts = library.items.filter(item => item.kind === 'prompt').length;
  const tags = rename([...library.facets.tags].slice(0, 10));
  const tagMax = tags[0]?.[1] || 1;
  const top = 92, common = { width: column, label: t.label };
  const models = panel({ ...common, x: pad, y: top, title: t.model, rows: rename(fold(library.facets.model, 6, t.other)) });
  const methods = panel({ ...common, x: pad * 2 + column, y: top, title: t.method, rows: rename(fold(library.facets.method, 5, t.other)) });
  const second = Math.max(models.bottom, methods.bottom) + 40;
  const tagsLeft = panel({ ...common, x: pad, y: second, title: t.tags, rows: tags.slice(0, 5), max: tagMax });
  const tagsRight = panel({ ...common, x: pad * 2 + column, y: second, title: ' ', rows: tags.slice(5), max: tagMax });
  const height = Math.max(tagsLeft.bottom, tagsRight.bottom) + 44;
  const synced = String(library.updatedAt).slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
<title id="t">${xml(t.title)}</title>
<desc id="d">${xml(t.desc(total, prompts, synced))}</desc>
<style>
svg{--surface:#fcfcfb;--border:#e4e3df;--ink:#0b0b0b;--ink-2:#52514e;--ink-3:#7a7974;--series:#2a78d6}
@media (prefers-color-scheme:dark){svg{--surface:#161b22;--border:#30363d;--ink:#f0efec;--ink-2:#c3c2b7;--ink-3:#8b8a82;--series:#3987e5}}
text{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Segoe UI",sans-serif;fill:var(--ink-2);font-size:13px}
.card{fill:var(--surface);stroke:var(--border)}.bar{fill:var(--series)}
.headline{fill:var(--ink);font-size:22px;font-weight:600}.sub{fill:var(--ink-3);font-size:13px}
.title{fill:var(--ink);font-size:14px;font-weight:600}.value{fill:var(--ink);font-variant-numeric:tabular-nums}
</style>
<rect class="card" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12"/>
<text class="headline" x="${pad}" y="46">${xml(t.headline(total, prompts))}</text>
<text class="sub" x="${pad}" y="68">${xml(t.synced(synced))}</text>
${models.svg}${methods.svg}${tagsLeft.svg}${tagsRight.svg}
<text class="sub" x="${pad}" y="${height - 18}">${xml(t.note)}</text>
</svg>
`;
}
