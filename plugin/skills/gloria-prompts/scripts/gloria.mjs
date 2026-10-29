#!/usr/bin/env node
// Search the 光彩跃然 · 影像灵感库 prompt library from a terminal, or serve it to agents over MCP (stdio).
// No dependencies, Node 18+. Data: https://seasnakes.github.io/gloria-prompt-archive/agent/prompts.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.1.0';
export const SITE = (process.env.GLORIA_SITE || 'https://seasnakes.github.io/gloria-prompt-archive/').replace(/\/*$/, '/');
const DATA = process.env.GLORIA_DATA || SITE + 'agent/prompts.json';
const TTL = 6 * 60 * 60 * 1000;
const MAX_LIMIT = 50;
const FACETS = ['model', 'method', 'source', 'tags', 'kind', 'status', 'media'];
const STATUS = { '待测试': 'nobody has re-run it here', '待整理': 'not checked yet: model, method or prompt may be off', '示例': 'example' };
const WEIGHTS = [['title', 10], ['tags', 6], ['facets', 4], ['notes', 3], ['author', 2], ['prompt', 1]];

const norm = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase();
const warn = message => process.stderr.write(`gloria: ${message}\n`);
const number = value => new Intl.NumberFormat('en-US').format(value);

// ---- data -------------------------------------------------------------------

function cacheDirs() {
  const home = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return [process.env.GLORIA_CACHE_DIR, path.join(home, 'gloria-prompts'), path.join(os.tmpdir(), 'gloria-prompts')].filter(Boolean);
}
function readCache(url) {
  let best = null;
  for (const dir of cacheDirs()) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
      if (meta.url !== url || (best && best.meta.fetchedAt >= meta.fetchedAt)) continue;
      best = { meta, text: fs.readFileSync(path.join(dir, 'prompts.json'), 'utf8') };
    } catch {}
  }
  return best;
}
function writeCache(url, text, meta) {
  // Sandboxed agents often cannot write to ~/.cache; fall back to the temp folder, then to memory only.
  for (const dir of cacheDirs()) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const temp = path.join(dir, `prompts.${process.pid}.tmp`);
      fs.writeFileSync(temp, text);
      fs.renameSync(temp, path.join(dir, 'prompts.json'));
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ ...meta, url }));
      return;
    } catch {}
  }
}

export function parseLibrary(text, source = '') {
  const data = JSON.parse(text);
  if (!Array.isArray(data.items) || !data.items.every(item => item && typeof item.id === 'string')) throw new Error('Not a Gloria prompt library file');
  const facets = Object.fromEntries(FACETS.map(key => [key, new Map()]));
  for (const item of data.items) {
    item.tags ||= [];
    for (const key of FACETS) for (const value of key === 'tags' ? item.tags : [item[key]]) if (value) facets[key].set(value, (facets[key].get(value) || 0) + 1);
  }
  for (const key of FACETS) facets[key] = new Map([...facets[key]].sort((a, b) => b[1] - a[1]));
  // Media links expire within a day, so they live in small per-work files published with every sync.
  const mediaBase = /prompts\.json$/.test(source) ? source.replace(/prompts\.json$/, 'media/') : null;
  return { updatedAt: data.updatedAt, site: data.site || SITE, items: data.items, byId: new Map(data.items.map(item => [item.id, item])), facets, mediaBase };
}

export async function fetchMedia(library, ids) {
  const read = async id => {
    if (!library.mediaBase) return null;
    try {
      const text = /^https?:\/\//.test(library.mediaBase)
        ? await fetch(new URL(`${id}.json`, library.mediaBase), { signal: AbortSignal.timeout(15_000) }).then(response => { if (!response.ok) throw new Error(); return response.text(); })
        : fs.readFileSync(path.join(library.mediaBase, `${id}.json`), 'utf8');
      const media = JSON.parse(text), web = value => typeof value === 'string' && /^https?:\/\//.test(value) ? value : '';
      return { cover: web(media.cover), video: web(media.video), images: (media.images || []).map(web).filter(Boolean), generatedCover: !!media.generatedCover, expiresAt: media.expiresAt || null };
    } catch { return null; }
  };
  return new Map(await Promise.all(ids.map(async id => [id, await read(id)])));
}
const expired = media => !!media?.expiresAt && Date.parse(media.expiresAt) < Date.now();

async function saveImages(media, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  for (const [id, links] of media) {
    if (!links?.cover || expired(links)) continue;
    try {
      const response = await fetch(links.cover, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get('content-type') || '';
      const file = path.join(dir, `${id}.${type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'}`);
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      saved.push(file);
    } catch (error) { warn(`could not save the image for ${id} (${error.message})`); }
  }
  return saved;
}

export async function loadLibrary({ source = DATA, refresh = false } = {}) {
  if (!/^https?:\/\//.test(source)) return parseLibrary(fs.readFileSync(source, 'utf8'), source);
  const cached = readCache(source);
  if (cached && !refresh && Date.now() - cached.meta.fetchedAt < TTL) return parseLibrary(cached.text, source);
  try {
    const headers = cached?.meta.etag && !refresh ? { 'if-none-match': cached.meta.etag } : {};
    const response = await fetch(source, { headers, signal: AbortSignal.timeout(90_000) });
    if (response.status === 304 && cached) {
      writeCache(source, cached.text, { ...cached.meta, fetchedAt: Date.now() });
      return parseLibrary(cached.text, source);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const library = parseLibrary(text, source);
    writeCache(source, text, { fetchedAt: Date.now(), etag: response.headers.get('etag') });
    return library;
  } catch (error) {
    if (cached) {
      warn(`could not refresh (${error.message}); using the copy downloaded ${new Date(cached.meta.fetchedAt).toISOString()}`);
      return parseLibrary(cached.text, source);
    }
    throw new Error(`Could not download the library from ${source} (${error.message}). The first run needs network access, about 8 MB.`);
  }
}

// ---- search -----------------------------------------------------------------

export function parseQuery(query) {
  const include = [], exclude = [];
  for (const match of norm(query).matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)) {
    const term = (match[2] ?? match[4]).trim();
    if (term && term !== '-') ((match[1] || match[3]) ? exclude : include).push(term);
  }
  return { include, exclude };
}

const fieldCache = new WeakMap();
function fieldsOf(item) {
  let fields = fieldCache.get(item);
  if (!fields) fieldCache.set(item, fields = {
    title: norm(item.title), tags: norm(item.tags.join(' ')), facets: norm([item.model, item.modelVersion, item.method, item.source].join(' ')),
    notes: norm([item.description, item.usage, item.negativePrompt].join(' ')), author: norm(item.author), prompt: norm(item.prompt),
  });
  return fields;
}
function termScore(fields, term) {
  let score = 0;
  for (const [key, weight] of WEIGHTS) {
    let at = fields[key].indexOf(term);
    if (at < 0) continue;
    score += weight;
    if (key !== 'prompt') continue;
    for (let extra = 0; extra < 4 && (at = fields.prompt.indexOf(term, at + term.length)) >= 0; extra++) score += 0.25;
  }
  return score;
}

// Exact facet names win; otherwise a fragment matches, so "seedance" finds "即梦 / Seedance".
function facetMatcher(counts, wanted) {
  if (!wanted) return null;
  const target = norm(wanted).trim(), names = [...counts.keys()];
  const exact = names.filter(name => norm(name) === target);
  const allowed = new Set(exact.length ? exact : names.filter(name => norm(name).includes(target)));
  return value => allowed.has(value);
}

function seeded(seed) {
  let state = [...String(seed)].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => ((state = Math.imul(state ^ (state >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);
}

function snippet(item, terms, size = 180) {
  const text = item.prompt || item.description || item.usage;
  if (!text) return '';
  const lower = norm(text), source = lower.length === text.length ? text : lower;
  const at = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 60);
  const clip = source.slice(start, start + size).replace(/\s+/g, ' ').trim();
  return (start ? '…' : '') + clip + (start + size < source.length ? '…' : '');
}

export function search(library, options = {}) {
  const { include, exclude } = parseQuery(options.query || '');
  const tags = [options.tags || []].flat().filter(Boolean).map(tag => facetMatcher(library.facets.tags, tag));
  const checks = ['model', 'method', 'source', 'kind', 'media'].map(key => [key, facetMatcher(library.facets[key], options[key])]).filter(([, test]) => test);
  const pool = library.items.filter(item =>
    checks.every(([key, test]) => test(item[key])) && tags.every(test => item.tags.some(test)) &&
    !exclude.some(term => Object.values(fieldsOf(item)).some(field => field.includes(term))));
  let rows = pool.map(item => {
    const fields = fieldsOf(item);
    let matched = 0, score = 0;
    for (const term of include) { const value = termScore(fields, term); if (value) { matched++; score += value; } }
    if (include.length && fields.title === include.join(' ')) score += 20;
    if (item.status === '待整理') score -= 2;
    return { item, matched, score };
  });
  let partial = false;
  if (include.length) {
    const complete = rows.filter(row => row.matched === include.length);
    partial = !complete.length && include.length > 1;
    rows = partial ? rows.filter(row => row.matched) : complete;
  }
  const sort = options.sort || (include.length ? 'relevance' : 'newest');
  if (sort === 'random') {
    const random = seeded(options.seed ?? Date.now());
    for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  } else if (sort === 'newest') rows.sort((a, b) => String(b.item.createdAt).localeCompare(String(a.item.createdAt)));
  else if (sort === 'relevance') rows.sort((a, b) => b.matched - a.matched || b.score - a.score);
  else throw new Error(`Unknown sort "${sort}": use relevance, newest or random`);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || 10)), offset = Math.max(0, Number(options.offset) || 0);
  return {
    total: rows.length, partial, sort, offset, limit, terms: include,
    results: rows.slice(offset, offset + limit).map(({ item, score }) => ({ item, score: Math.round(score * 100) / 100, snippet: snippet(item, include) })),
  };
}

// ---- output -----------------------------------------------------------------

export const workURL = (id, site = SITE) => `${site}#work/${id}`;
const mediaLine = item => item.media === 'none' ? '' : [item.media, item.width && `${item.width}×${item.height}`, item.duration && `${item.duration}s`].filter(Boolean).join(' ');
const header = library => `光彩跃然 · 影像灵感库 · ${number(library.items.length)} works · synced ${String(library.updatedAt).slice(0, 16).replace('T', ' ')} UTC`;

export function formatSearch(library, result, options = {}) {
  const asked = [options.query && `"${options.query}"`, ...['model', 'method', 'source', 'kind', 'media'].filter(key => options[key]).map(key => `${key}=${options[key]}`), ...[options.tags || []].flat().map(tag => `tag=${tag}`)].filter(Boolean).join(' · ') || 'everything';
  const lines = [header(library), `${asked}: ${number(result.total)} match${result.total === 1 ? '' : 'es'}${result.partial ? ' (no work has every keyword; showing partial matches)' : ''}, sorted by ${result.sort}`];
  if (!result.total) {
    lines.push('', 'Nothing found. Try fewer or shorter keywords, the other language (most prompts are English), or check filter names with `facets`.');
    const long = result.terms.find(term => /[\u3400-\u9fff]{5}/.test(term));
    if (long) lines.push(`Chinese has no spaces, so "${long}" is searched as one word. Split it into words separated by spaces.`);
    return lines.join('\n');
  }
  result.results.forEach(({ item, snippet }, index) => {
    lines.push('', `${result.offset + index + 1}. ${item.title}  [${item.id}]`);
    lines.push(`   ${[item.model, item.method, item.tags.length && `tags: ${item.tags.join(', ')}`, mediaLine(item)].filter(Boolean).join(' · ')}`);
    lines.push(`   by ${item.author || 'unknown'} on ${item.source}${item.status ? ` · ${item.status}` : ''}${item.kind === 'reference' ? ' · effect reference, no original prompt' : ''}`);
    if (snippet) lines.push(`   ${snippet}`);
    lines.push(`   ${workURL(item.id, library.site)}`);
  });
  const shown = result.offset + result.results.length;
  lines.push('', `Showing ${result.offset + 1}–${shown} of ${number(result.total)}.${shown < result.total ? ` Next page: offset ${shown}.` : ''} Full text: show <id>.`);
  return lines.join('\n');
}

export function formatFacets(library) {
  const { facets } = library;
  const list = (key, note = {}) => [...facets[key]].map(([name, count]) => `${name} (${number(count)}${note[name] ? `, ${note[name]}` : ''})`).join(' · ');
  return [header(library), '',
    `kind: ${list('kind', { prompt: 'has the original prompt', reference: 'effect only, no prompt' })}`,
    `model: ${list('model')}`, `method: ${list('method')}`, `source: ${list('source')}`, `tags: ${list('tags')}`,
    `media: ${list('media')}`, `status: ${list('status', STATUS)}`, '',
    'Filters accept an exact name or a fragment of one (model=seedance, method=图生视频). Most prompts are written in English; many titles are Chinese.',
  ].join('\n');
}

export function workMarkdown(item, site = SITE, media = null) {
  const longest = [...`${item.prompt || ''}${item.negativePrompt || ''}`.matchAll(/`+/g)].reduce((max, match) => Math.max(max, match[0].length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const block = text => [fence + 'text', text, fence].join('\n');
  const links = media && !expired(media) ? media : null;
  const head = [`# ${item.title}`, '', ...(links?.cover ? [`![${item.title.replace(/[[\]]/g, '')}](${links.cover})`, ''] : [])];
  const lines = [...head, ...[
    `- id: ${item.id}`,
    `- type: ${item.kind === 'prompt' ? 'prompt' : 'effect reference (the author did not publish a prompt)'}`,
    `- model: ${item.model}`,
    item.modelVersion ? `- model note: ${item.modelVersion}` : '',
    `- method: ${item.method}`,
    item.tags.length ? `- tags: ${item.tags.join(', ')}` : '',
    `- author: ${item.author || 'unknown'} · source: ${item.source}${item.sourceUrl ? ` · ${item.sourceUrl}` : ''}`,
    mediaLine(item) ? `- media: ${mediaLine(item)}` : '',
    item.status ? `- status: ${item.status}${STATUS[item.status] ? ` (${STATUS[item.status]})` : ''}` : '',
    item.createdAt ? `- added: ${item.createdAt}` : '',
    `- gallery: ${workURL(item.id, site)}`,
    links?.cover ? `- image: ${links.cover}${links.generatedCover ? ' (made by this site from the prompt, not the author\'s image)' : ''}` : '',
    links?.images?.length > 1 ? `- more images: ${links.images.slice(1, 4).join(' ')}` : '',
    links?.video ? `- video: ${links.video}` : '',
    links?.expiresAt ? `- image and video links work until ${links.expiresAt.slice(0, 16).replace('T', ' ')} UTC; after that use the gallery link` : '',
    media && !links ? '- image and video links have expired; use the gallery link' : '',
  ].filter(line => line !== '')];
  lines.push('', '## Prompt', '', item.prompt ? block(item.prompt) : 'No original prompt was published. Anything below describes the effect; it is not a prompt.');
  if (item.negativePrompt) lines.push('', '## Negative prompt', '', block(item.negativePrompt));
  if (item.description) lines.push('', '## Effect', '', item.description);
  if (item.usage) lines.push('', '## Usage notes', '', item.usage);
  lines.push('', `Rights stay with ${item.author || 'the original author'}. Credit and link the source when you reuse this prompt.`);
  return lines.join('\n') + '\n';
}

// ---- MCP --------------------------------------------------------------------

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const filterProperties = {
  model: { type: 'string', description: 'Model name or fragment, e.g. "seedance", "GPT Image 2.5", "Claude Opus 5.5", "minimax h3". See list_facets.' },
  method: { type: 'string', description: 'Generation method, e.g. 文生视频 (text to video), 图生视频 (image to video), 图像生成 (image), 代码生成视频 (video made in code).' },
  source: { type: 'string', description: 'Where it was collected, e.g. "X / Twitter", "LINUX DO", "Higgsfield".' },
  tags: { type: 'array', items: { type: 'string' }, description: 'Style tags that must all be present, e.g. ["电影感", "人物"]. See list_facets.' },
  kind: { type: 'string', enum: ['prompt', 'reference'], description: '"prompt" has the original prompt; "reference" is an effect example without one.' },
  media: { type: 'string', enum: ['video', 'image', 'none'] },
};
export const TOOLS = [
  {
    name: 'search_prompts', title: 'Search the GLORIA prompt library',
    description: 'Search 光彩跃然 · 影像灵感库, about 9,000 AI video and image prompts (Seedance, GPT Image, Claude Opus code-made video, MiniMax H3 and more), each credited to its author with a link to the original post. Most prompts are written in English and many titles in Chinese, so search with keywords in both languages. Keywords are space-separated and all must match; use "quoted phrases" and -exclusions. Returns ranked summaries with ids; call get_prompts for the full text before quoting or adapting a prompt.',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', description: 'Short keywords, e.g. "neon rain city" or "霓虹 雨夜". Leave empty to browse by filters.' },
      ...filterProperties,
      sort: { type: 'string', enum: ['relevance', 'newest', 'random'], description: 'Default: relevance with a query, newest without.' },
      limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Default 10.' },
      offset: { type: 'integer', minimum: 0, description: 'For the next page.' },
    } },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'get_prompts', title: 'Read full prompts',
    description: 'Full prompt text, credits and current image/video links for up to 10 works, by id (the 14-character id from search_prompts) or gallery link (…#work/<id>). Each work starts with a Markdown image of its cover. Image and video links are temporary (about a day); the gallery link is permanent.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 } }, required: ['ids'] },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'list_facets', title: 'List filter values',
    description: 'Every model, method, source, style tag and status in the library with counts. Use it to pick exact filter values.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

const idsFrom = values => [values].flat().map(value => /[a-f0-9]{14}/.exec(String(value))?.[0] || String(value));
export async function runTool(library, name, input = {}, media = null) {
  if (name === 'search_prompts') return formatSearch(library, search(library, input), input);
  if (name === 'list_facets') return formatFacets(library);
  if (name === 'get_prompts') {
    const ids = idsFrom(input.ids ?? []).slice(0, 10);
    if (!ids.length) throw new Error('Pass at least one id.');
    media ||= await fetchMedia(library, ids.filter(id => library.byId.has(id)));
    return ids.map(id => library.byId.has(id) ? workMarkdown(library.byId.get(id), library.site, media.get(id)) : `No work with id "${id}".`).join('\n---\n\n');
  }
  throw new Error(`Unknown tool: ${name}`);
}

export function createServer(getLibrary) {
  return async function handle(message) {
    const { id, method, params = {} } = message || {};
    const reply = result => ({ jsonrpc: '2.0', id, result });
    const fail = (code, text) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message: text } });
    if (!message || message.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid request');
    if (id === undefined) return null;
    if (method === 'initialize') return reply({
      protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'gloria-prompts', title: '光彩跃然 · 影像灵感库', version: VERSION },
      instructions: 'Use search_prompts to find AI video/image prompts by theme or by task, then get_prompts on about four picks for their full prompts and images. Search in English and Chinese. Show each pick with its image and prompt, give the gallery link and credit the author.',
    });
    if (method === 'ping') return reply({});
    if (method === 'tools/list') return reply({ tools: TOOLS });
    if (method === 'tools/call') {
      try {
        if (!TOOLS.some(tool => tool.name === params.name)) return fail(-32602, `Unknown tool: ${params.name}`);
        return reply({ content: [{ type: 'text', text: await runTool(await getLibrary(), params.name, params.arguments || {}) }] });
      } catch (error) {
        return reply({ content: [{ type: 'text', text: error.message }], isError: true });
      }
    }
    return fail(-32601, `Method not found: ${method}`);
  };
}

function serve(options) {
  let library = null, loadedAt = 0;
  const handle = createServer(async () => {
    if (!library || Date.now() - loadedAt > TTL) { library = await loadLibrary(options); loadedAt = Date.now(); }
    return library;
  });
  const pending = new Set();
  const lines = readline.createInterface({ input: process.stdin });
  lines.on('line', line => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { message = undefined; }
    const task = (message === undefined ? Promise.resolve({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) : handle(message))
      .then(response => { if (response) process.stdout.write(JSON.stringify(response) + '\n'); })
      .finally(() => pending.delete(task));
    pending.add(task);
  });
  lines.on('close', () => Promise.allSettled([...pending]).then(() => process.exit(0)));
}

// ---- CLI --------------------------------------------------------------------

const HELP = `光彩跃然 · 影像灵感库: search ~9,000 AI video and image prompts.

  node gloria.mjs search <keywords...> [filters]   ranked results with ids and links
  node gloria.mjs show <id|link> [...]              full prompt, credits, image and video links
  node gloria.mjs show <ids...> --save <dir>       also download the cover images into <dir>
  node gloria.mjs facets                            models, methods, sources, tags with counts
  node gloria.mjs mcp                               run as an MCP server over stdio

Filters: --model --method --source --tag (repeatable) --kind prompt|reference --media video|image
Paging:  --limit 10 --offset 0 --sort relevance|newest|random [--seed x]
Other:   --json  --refresh (ignore the 6-hour cache)  --data <file or URL>

Keywords are all required; "quoted phrase" keeps words together, -word excludes.
Most prompts are in English: try both languages (霓虹 neon, 雨夜 "rainy night").`;
const VALUES = new Set(['model', 'method', 'source', 'tag', 'kind', 'media', 'sort', 'seed', 'limit', 'offset', 'data', 'save']);
const FLAGS = new Set(['json', 'refresh', 'help']);

export function parseArgs(argv) {
  const args = { _: [], tags: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--') || arg === '--') { if (arg !== '--') args._.push(arg); continue; }
    const [key, inline] = arg.slice(2).split(/=(.*)/s, 2);
    if (FLAGS.has(key)) { args[key] = true; continue; }
    if (!VALUES.has(key)) throw new Error(`Unknown option --${key}. Run with --help.`);
    const value = inline ?? argv[++i];
    if (value === undefined) throw new Error(`--${key} needs a value`);
    if (key === 'tag') args.tags.push(value); else args[key] = value;
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const commands = ['search', 'show', 'facets', 'mcp', 'help'];
  const command = commands.includes(args._[0]) ? args._.shift() : (args._.length ? 'search' : 'help');
  if (args.help || command === 'help') return console.log(HELP);
  const options = { source: args.data || DATA, refresh: args.refresh };
  if (command === 'mcp') return serve(options);
  const library = await loadLibrary(options);
  if (command === 'facets') {
    return console.log(args.json ? JSON.stringify({ updatedAt: library.updatedAt, count: library.items.length, ...Object.fromEntries(Object.entries(library.facets).map(([key, map]) => [key, Object.fromEntries(map)])) }, null, 2) : formatFacets(library));
  }
  if (command === 'show') {
    const ids = idsFrom(args._);
    if (!ids.length) throw new Error('show needs at least one id');
    const media = await fetchMedia(library, ids.filter(id => library.byId.has(id)));
    if (args.json) console.log(JSON.stringify(ids.map(id => library.byId.has(id) ? { ...library.byId.get(id), links: media.get(id) } : { id, missing: true }), null, 2));
    else console.log(await runTool(library, 'get_prompts', { ids }, media));
    if (args.save) for (const file of await saveImages(media, args.save)) (args.json ? console.error : console.log)(`saved ${file}`);   // keep --json output parseable
    return;
  }
  const query = { ...args, query: args._.join(' ') };
  const result = search(library, query);
  if (args.json) return console.log(JSON.stringify({ ...result, results: result.results.map(({ item, score, snippet }) => ({ ...item, score, snippet, url: workURL(item.id, library.site) })) }, null, 2));
  console.log(formatSearch(library, result, query));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { warn(error.message); process.exit(1); });
}
