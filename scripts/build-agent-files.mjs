import fs from 'node:fs';
import path from 'node:path';
import { parseLibrary, workMarkdown, formatFacets } from '../plugin/skills/gloria-prompts/scripts/gloria.mjs';
import { statsSVG } from './stats-svg.mjs';

// Plain-text copies of the published catalog for coding agents and README badges.
// Media links are signed Feishu URLs that expire within a day, so prompts.json (cached by agents for
// hours) leaves them out; small per-work media files and the Markdown pages carry this sync's links.
const site = (process.env.SITE_URL || 'https://seasnakes.github.io/gloria-prompt-archive/').replace(/\/*$/, '/');
const dist = process.argv[2] || 'dist';
const catalog = JSON.parse(fs.readFileSync(path.join(dist, 'data/catalog.json'), 'utf8'));
const day = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const optional = (key, value) => value ? { [key]: value } : {};

const agentRecord = item => ({
  id: item.id, title: item.title, kind: item.kind,
  model: item.model, ...optional('modelVersion', item.modelVersion), method: item.method, tags: item.tags,
  author: item.author, source: item.source, ...optional('sourceUrl', item.sourceUrl), status: item.status,
  media: item.video ? 'video' : (item.images?.length || item.cover) ? 'image' : 'none',
  ...(item.aspectKnown ? { width: item.width, height: item.height } : {}),
  ...(item.duration > 0 ? { duration: Math.round(item.duration * 10) / 10 } : {}),
  createdAt: day(item.createdAt),
  prompt: item.prompt, ...optional('negativePrompt', item.negativePrompt), ...optional('description', item.description), ...optional('usage', item.usage),
});

// One record per line keeps the file valid JSON (served gzipped) and still greppable.
const records = catalog.items.map(agentRecord);
const head = JSON.stringify({ schema: 'gloria-prompts/1', updatedAt: catalog.updatedAt, count: records.length, site, gallery: `${site}#work/{id}`, work: `${site}agent/works/{id}.md` });
const text = `${head.slice(0, -1)},"items":[\n${records.map(record => JSON.stringify(record)).join(',\n')}\n]}\n`;
const library = parseLibrary(text);
if (library.items.length !== catalog.count) throw new Error('Agent export lost records');

const out = path.join(dist, 'agent');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'works'), { recursive: true });
fs.mkdirSync(path.join(out, 'badges'), { recursive: true });
fs.mkdirSync(path.join(out, 'media'), { recursive: true });
fs.writeFileSync(path.join(out, 'prompts.json'), text);
const absolute = value => value ? new URL(value, site).href : '';
for (const item of catalog.items) {
  const media = { id: item.id, cover: absolute(item.cover), video: absolute(item.video), images: (item.images || []).map(absolute).filter(Boolean), generatedCover: !!item.generatedCover, expiresAt: catalog.mediaExpiresAt || null };
  fs.writeFileSync(path.join(out, 'media', `${item.id}.json`), JSON.stringify(media) + '\n');
  fs.writeFileSync(path.join(out, 'works', `${item.id}.md`), workMarkdown(library.byId.get(item.id), site, media));
}

const facets = Object.fromEntries(Object.entries(library.facets).map(([key, counts]) => [key, Object.fromEntries(counts)]));
fs.writeFileSync(path.join(out, 'facets.json'), JSON.stringify({ updatedAt: catalog.updatedAt, count: records.length, ...facets }, null, 2) + '\n');

const withPrompt = records.filter(record => record.kind === 'prompt').length;
const number = value => new Intl.NumberFormat('en-US').format(value);
const badge = (name, label, message) => fs.writeFileSync(path.join(out, 'badges', `${name}.json`), JSON.stringify({ schemaVersion: 1, label, message, color: '2f6bff', labelColor: '0b1a33' }) + '\n');
badge('works', '收录', `${number(records.length)} 条`);
badge('prompts', '完整提示词', `${number(withPrompt)} 条`);
badge('updated', '最近同步', day(catalog.updatedAt));
badge('works-en', 'works', number(records.length));
badge('prompts-en', 'full prompts', number(withPrompt));
badge('updated-en', 'last sync', day(catalog.updatedAt));
fs.writeFileSync(path.join(out, 'stats.svg'), statsSVG(library, 'zh'));
fs.writeFileSync(path.join(out, 'stats-en.svg'), statsSVG(library, 'en'));

const top = (key, limit = 99) => [...library.facets[key]].slice(0, limit).map(([name, count]) => `${name} (${number(count)})`).join(', ');
const mb = (Buffer.byteLength(text) / 1048576).toFixed(0);
fs.writeFileSync(path.join(dist, 'llms.txt'), `# 光彩跃然 · 影像灵感库 (GLORIA prompt archive)

> ${number(records.length)} AI video and image prompts collected by SEASNAKE from public posts on X, LINUX DO and other sites. ${number(withPrompt)} come with the author's full original prompt; ${number(records.length - withPrompt)} are effect references without one. Every work credits its author and links the original post. Last synced ${day(catalog.updatedAt)}; the site refreshes every six hours.

The gallery at ${site} is a JavaScript app. Agents should use the plain-text files below instead.

Most prompts are written in English and many titles in Chinese. Search with keywords in both languages (霓虹 / neon, 雨夜 / rainy night, 产品广告 / product ad).

## Data

- [prompts.json](${site}agent/prompts.json): every work with its full prompt, one record per line, about ${mb} MB (gzip on the wire). Fields: id, title, kind (prompt | reference), model, modelVersion, method, tags, author, source, sourceUrl, status, media, width, height, duration, createdAt, prompt, negativePrompt, description, usage.
- [facets.json](${site}agent/facets.json): every filter value with counts.
- One work as Markdown: ${site}agent/works/{id}.md (ids are 14 hex characters), with its cover image and video links.
- Current image and video links for one work: ${site}agent/media/{id}.json. They expire about a day after each sync, so fetch them when you show a work rather than storing them.
- Gallery link to share with people: ${site}#work/{id}

## Filter values

- model: ${top('model')}
- method: ${top('method')}
- source: ${top('source')}
- tags: ${top('tags')}
- status: 待测试 means nobody has re-run the prompt here; 待整理 means the model, method or prompt has not been checked yet.

## Tools

- Skill and MCP server for Claude Code, Codex and other agents: https://github.com/seasnakes/gloria-prompt-archive/tree/main/plugin
  - Claude Code: \`claude plugin marketplace add seasnakes/gloria-prompt-archive\`, then \`claude plugin install gloria-prompts@seasnake\`
  - Other agents: \`npx skills add seasnakes/gloria-prompt-archive\`
- With only a shell: \`curl -s ${site}agent/prompts.json | grep -i "neon" | head -5\`

## Rights

Prompts, videos and images belong to their authors. When you show or adapt a prompt, name the author and link the original post. The library does not promise that a prompt reproduces the effect.
`);

fs.writeFileSync(path.join(out, 'README.txt'), formatFacets(library) + `\n\nFiles: prompts.json (full text), facets.json, works/{id}.md, media/{id}.json (image and video links for this sync). Start at ${site}llms.txt\n`);
console.log(`Agent files: ${number(records.length)} works, prompts.json ${mb} MB, ${number(records.length)} Markdown pages, llms.txt, badges, stats.svg.`);
