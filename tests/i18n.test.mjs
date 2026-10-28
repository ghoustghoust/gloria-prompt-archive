import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEXT, POEM, ENGLISH_NAMES, pickLanguage, setLanguage, t, label, searchAlias } from '../src/i18n.js';
import { filterItems, summaryFor } from '../src/catalog.js';

test('Both languages define the same keys, including every key the page markup uses', () => {
  assert.deepEqual(Object.keys(TEXT.en).sort(), Object.keys(TEXT.zh).sort());
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(match => match[1]);
  for (const attrs of html.matchAll(/data-i18n-attr="([^"]+)"/g)) used.push(...attrs[1].split(';').map(pair => pair.split(':')[1]));
  assert.ok(used.length > 40);
  for (const key of used) assert.ok(key in TEXT.zh, `missing ${key}`);
});

test('A ?lang link wins over the saved choice, which wins over the browser', () => {
  assert.equal(pickLanguage({ search: '?lang=en', stored: 'zh', languages: ['zh-CN'] }), 'en');
  assert.equal(pickLanguage({ search: '?lang=xx', stored: 'en', languages: ['zh-CN'] }), 'en');
  assert.equal(pickLanguage({ languages: ['en-GB', 'zh-TW'] }), 'zh');
  assert.equal(pickLanguage({ languages: ['en-US', 'ja'] }), 'en');
  assert.equal(pickLanguage({}), 'zh');
});

test('English labels facet names and keeps collected text; both names are searchable', () => {
  const item = { id: 'x', title: '霓虹雨夜', kind: 'reference', prompt: '', description: '时间暂停', usage: '', source: 'X / Twitter', author: 'A', model: '即梦 / Seedance', modelVersion: '', method: '文生视频', tags: ['电影感', '运镜'] };
  try {
    setLanguage('en');
    assert.equal(t('result.count', { count: 3 }), '3 works');
    assert.equal(label('文生视频'), 'Text to video');
    assert.equal(label('Veo'), 'Veo');
    assert.equal(summaryFor(item), 'Effect: 时间暂停');
  } finally { setLanguage('zh'); }
  assert.equal(label('文生视频'), '文生视频');
  assert.equal(summaryFor(item), '效果：时间暂停');
  const items = [{ ...item, searchAlias: searchAlias(item) }];
  assert.equal(filterItems(items, { query: 'cinematic camera' }).length, 1);
  assert.equal(filterItems(items, { query: '电影感 seedance' }).length, 1);
});

test('The poem pages keep every line of the poem in order', () => {
  for (const lang of ['zh', 'en']) assert.equal(POEM.pages[lang].flat().join(''), POEM[lang].join(''));
  assert.ok(Object.values(ENGLISH_NAMES).every(name => typeof name === 'string' && name));
});
