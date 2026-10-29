import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseLibrary, search, workMarkdown, formatSearch, createServer, parseArgs, parseQuery, fetchMedia, TOOLS } from '../plugin/skills/gloria-prompts/scripts/gloria.mjs';

const root = new URL('../', import.meta.url);
const work = (id, fields) => ({ id: id.padEnd(14, '0'), title: '', kind: 'prompt', model: '即梦 / Seedance', method: '文生视频', tags: [], author: 'Artist', source: 'X / Twitter', status: '待测试', media: 'video', createdAt: '2026-10-01', prompt: '', ...fields });
const library = parseLibrary(JSON.stringify({ updatedAt: '2026-10-28T00:00:00Z', items: [
  work('a1', { title: 'Rainy Neon Tokyo Violinist', prompt: 'A violinist in a rainy neon alley at night.', tags: ['电影感', '人物'], createdAt: '2026-09-01' }),
  work('a2', { title: 'Coffee launch', prompt: 'Neon sign over a coffee bar, rain on the window. neon neon neon.', model: 'GPT Image 2.5', method: '图像生成', media: 'image', createdAt: '2026-10-20' }),
  work('a3', { title: '霓虹雨夜对话', prompt: '港风 night city', model: 'GPT Image 2', method: '图像生成', media: 'image', status: '待整理', tags: ['电影感'] }),
  work('a4', { title: 'Time freeze', kind: 'reference', prompt: '', description: '时间暂停的效果', model: '待确认', method: '待确认', tags: ['运镜'] }),
  work('a5', { title: 'Opus product film', prompt: 'Write a 15-second product ad in code ``` with fences ````', model: 'Claude Opus 5.5', method: '代码生成视频', tags: ['产品广告', '动态图形'] }),
] }));
const ids = result => result.results.map(row => row.item.id.slice(0, 2));

test('Every keyword must match, and title hits outrank prompt hits', () => {
  assert.deepEqual(ids(search(library, { query: 'neon rainy' })), ['a1']);
  assert.deepEqual(ids(search(library, { query: 'neon' })), ['a1', 'a2']);
  assert.deepEqual(ids(search(library, { query: 'NEON -violinist' })), ['a2']);
  assert.deepEqual(ids(search(library, { query: '"night city"' })), ['a3']);
});

test('A query no work fully matches falls back to labelled partial matches', () => {
  const result = search(library, { query: 'neon zzzz' });
  assert.equal(result.partial, true);
  assert.deepEqual(ids(result), ['a1', 'a2']);
  assert.match(formatSearch(library, result, { query: 'neon zzzz' }), /partial matches/);
  const single = search(library, { query: 'zzzz' });
  assert.equal(single.total, 0);
  assert.match(formatSearch(library, search(library, { query: '赛博朋克雨夜的城市' })), /Split it into words/);
});

test('Facet filters take exact names first and fragments otherwise', () => {
  assert.deepEqual(ids(search(library, { model: 'gpt image 2' })), ['a3']);
  assert.deepEqual(ids(search(library, { model: 'gpt image' })).sort(), ['a2', 'a3']);
  assert.deepEqual(ids(search(library, { model: 'seedance' })), ['a1']);
  assert.deepEqual(ids(search(library, { method: '代码生成视频', tags: ['产品广告', '动态图形'] })), ['a5']);
  assert.deepEqual(ids(search(library, { tags: ['电影感'], kind: 'prompt', media: 'image' })), ['a3']);
  assert.deepEqual(ids(search(library, { kind: 'reference' })), ['a4']);
  assert.equal(search(library, { model: 'kling' }).total, 0);
});

test('Browsing without keywords sorts newest first; random order is repeatable with a seed', () => {
  assert.equal(ids(search(library, {}))[0], 'a2');
  assert.deepEqual(ids(search(library, { sort: 'random', seed: 7, limit: 5 })), ids(search(library, { sort: 'random', seed: 7, limit: 5 })));
  const page = search(library, { limit: 2, offset: 2 });
  assert.equal(page.results.length, 2);
  assert.equal(page.total, 5);
  assert.throws(() => search(library, { sort: 'stars' }), /Unknown sort/);
});

test('Work pages keep prompts intact, label references and credit the author', () => {
  const opus = workMarkdown(library.byId.get('a5000000000000'));
  assert.ok(opus.includes('`````text\nWrite a 15-second product ad in code ``` with fences ````\n`````'));
  assert.match(opus, /Rights stay with Artist/);
  const reference = workMarkdown(library.byId.get('a4000000000000'));
  assert.match(reference, /No original prompt was published/);
  assert.ok(!/```/.test(reference));
});

test('Query and argument parsing', () => {
  assert.deepEqual(parseQuery('Neon "rainy night" -dog x-ray -'), { include: ['neon', 'rainy night', 'x-ray'], exclude: ['dog'] });
  assert.deepEqual(parseArgs(['search', 'neon', '--tag', '人物', '--tag=电影感', '--model=gpt image', '--json']), { _: ['search', 'neon'], tags: ['人物', '电影感'], model: 'gpt image', json: true });
  assert.throws(() => parseArgs(['--colour', 'red']), /Unknown option/);
  assert.throws(() => parseArgs(['--model']), /needs a value/);
});

test('MCP server answers the handshake, lists tools and reports tool errors in the result', async () => {
  const handle = createServer(async () => library);
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal((await handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).result.protocolVersion, '2025-11-25');
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const list = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map(tool => tool.name), TOOLS.map(tool => tool.name));
  const found = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_prompts', arguments: { query: 'violinist' } } });
  assert.match(found.result.content[0].text, /#work\/a1000000000000/);
  const full = await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_prompts', arguments: { ids: ['https://example.com/#work/a2000000000000'] } } });
  assert.match(full.result.content[0].text, /^# Coffee launch/);
  const bad = await handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'search_prompts', arguments: { sort: 'stars' } } });
  assert.equal(bad.result.isError, true);
  assert.equal((await handle({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'nope' } })).error.code, -32602);
  assert.equal((await handle({ jsonrpc: '2.0', id: 8, method: 'resources/list' })).error.code, -32601);
});

test('Build writes agent files from the published catalog without media links', () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'gloria-agent-'));
  fs.mkdirSync(path.join(dist, 'data'));
  fs.copyFileSync(new URL('public/data/catalog.json', root), path.join(dist, 'data/catalog.json'));
  execFileSync(process.execPath, ['scripts/build-agent-files.mjs', dist], { cwd: root, env: { ...process.env, SITE_URL: 'https://example.com/gallery' } });
  const catalog = JSON.parse(fs.readFileSync(path.join(dist, 'data/catalog.json'), 'utf8'));
  const text = fs.readFileSync(path.join(dist, 'agent/prompts.json'), 'utf8');
  const exported = parseLibrary(text);
  assert.equal(exported.items.length, catalog.count);
  assert.equal(text.split('\n').length, catalog.count + 3, 'one record per line');
  assert.ok(!/feishu|media\/[a-f0-9]{20}|"(cover|video|images|parameters)":/.test(text));
  assert.deepEqual(exported.items.map(item => item.prompt), catalog.items.map(item => item.prompt));
  assert.equal(fs.readdirSync(path.join(dist, 'agent/works')).length, catalog.count);
  assert.equal(fs.readdirSync(path.join(dist, 'agent/media')).length, catalog.count);
  const first = catalog.items.find(item => item.cover);
  const page = fs.readFileSync(path.join(dist, `agent/works/${first.id}.md`), 'utf8');
  assert.match(page, new RegExp(`https://example.com/gallery/#work/${first.id}`));
  const media = JSON.parse(fs.readFileSync(path.join(dist, `agent/media/${first.id}.json`), 'utf8'));
  assert.equal(media.cover, new URL(first.cover, 'https://example.com/gallery/').href);
  assert.ok(page.includes(`](${media.cover})`) && page.includes(`- image: ${media.cover}`));
  const llms = fs.readFileSync(path.join(dist, 'llms.txt'), 'utf8');
  assert.match(llms, /^# 光彩跃然/);
  assert.ok(llms.includes(`> ${catalog.count} AI video and image prompts`));
  assert.ok(llms.includes('https://example.com/gallery/agent/prompts.json'));
  for (const name of ['works', 'prompts', 'updated', 'works-en', 'prompts-en', 'updated-en']) assert.equal(JSON.parse(fs.readFileSync(path.join(dist, `agent/badges/${name}.json`), 'utf8')).schemaVersion, 1);
  assert.match(fs.readFileSync(path.join(dist, 'agent/stats.svg'), 'utf8'), /^<svg[^>]+role="img"[\s\S]*模型/);
  const english = fs.readFileSync(path.join(dist, 'agent/stats-en.svg'), 'utf8');
  assert.match(english, /^<svg[^>]+role="img"[\s\S]*Method/);
  assert.ok(!/[\u4e00-\u9fff]/.test(english.replace(/即梦/g, '')), 'English chart labels are translated');
  fs.rmSync(dist, { recursive: true, force: true });
});

test('Work pages lead with the cover image and say when media links have expired', () => {
  const item = library.byId.get('a1000000000000');
  const later = new Date(Date.now() + 3600e3).toISOString(), earlier = new Date(Date.now() - 3600e3).toISOString();
  const fresh = workMarkdown(item, 'https://example.com/', { cover: 'https://img.example/c.jpg', video: 'https://img.example/v.mp4', images: [], expiresAt: later });
  assert.ok(fresh.startsWith('# Rainy Neon Tokyo Violinist\n\n![Rainy Neon Tokyo Violinist](https://img.example/c.jpg)'));
  assert.match(fresh, /- video: https:\/\/img\.example\/v\.mp4/);
  assert.match(fresh, /work until .* UTC/);
  const stale = workMarkdown(item, 'https://example.com/', { cover: 'https://img.example/c.jpg', video: '', images: [], expiresAt: earlier });
  assert.ok(!stale.includes('img.example') && /have expired; use the gallery link/.test(stale));
  assert.match(workMarkdown(item, 'https://example.com/', { cover: 'https://img.example/c.jpg', images: [], generatedCover: true }), /made by this site/);
});

test('Media links come from per-work files next to the library and only web links are kept', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gloria-media-'));
  fs.mkdirSync(path.join(dir, 'media'));
  fs.writeFileSync(path.join(dir, 'media/a1000000000000.json'), JSON.stringify({ cover: 'https://img.example/c.jpg', video: 'javascript:alert(1)', images: ['https://img.example/c.jpg', 'file:///etc/passwd'] }));
  const local = parseLibrary(JSON.stringify({ items: [...library.items] }), path.join(dir, 'prompts.json'));
  const media = await fetchMedia(local, ['a1000000000000', 'a2000000000000']);
  assert.deepEqual(media.get('a1000000000000'), { cover: 'https://img.example/c.jpg', video: '', images: ['https://img.example/c.jpg'], generatedCover: false, expiresAt: null });
  assert.equal(media.get('a2000000000000'), null);
  assert.equal((await fetchMedia(library, ['a1000000000000'])).get('a1000000000000'), null, 'no media source, no network');
  fs.rmSync(dir, { recursive: true, force: true });
});
