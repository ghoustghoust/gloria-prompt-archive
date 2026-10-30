import { copyText, showManualCopy } from './clipboard.js';
import './style.css';
import './liquid-glass.css';
import './compact-ui.css';
import './likes.css';
import { createLikesClient } from './likes-client.js';
import { createSortControl } from './sort-control.js';
import { icon, mountIcons } from './icons.js';
import { startCompactFilters } from './compact-filters.js';
import { startWorkSwipe } from './work-swipe.js';
import { startGlassMotion, createDetailTransition } from './glass-motion.js';
import { startIntro } from './intro.js';
import { startPoem } from './poem.js';
import { t, label, language, setLanguage, pickLanguage, translatePage, searchAlias } from './i18n.js';
import { escapeHTML as esc, filterItems, summaryFor, safeURL } from './catalog.js';
import { createMasonry } from './masonry.js';
import { createCoverLoader } from './gallery-media.js';
import { startStickyFilters } from './sticky-filters.js';
import { fitVideoLayout } from './video-layout.js';
import { version } from '../package.json';

const storedLanguage = (() => { try { return localStorage.getItem('gloria:lang'); } catch { return null; } })();
setLanguage(pickLanguage({ search: location.search, stored: storedLanguage, languages: navigator.languages || [navigator.language] }));
translatePage();
mountIcons();
const $ = selector => document.querySelector(selector);
const english = language() === 'en';
// Switching saves the choice and reloads, so every view renders once in one language.
$('.lang-toggle').addEventListener('click', () => {
  const next = english ? 'zh' : 'en', url = new URL(location.href);
  let saved = true; try { localStorage.setItem('gloria:lang', next); } catch { saved = false; }
  if (saved) url.searchParams.delete('lang'); else url.searchParams.set('lang', next);
  if (url.href === location.href) location.reload(); else location.replace(url.href);
});
const base = import.meta.env.BASE_URL;
const catalogURL = import.meta.env.VITE_CATALOG_URL || base + 'data/catalog.json';
const mediaURL = path => { if (!path) return ''; if (/^https:\/\//.test(path)) return safeURL(path) || ''; return new URL(base + path, location.href.split('#')[0]).href; };
let items = [], filtered = [], limit = 24, current = null, modalItems = [], lastFocus, toastTimer;
const filters = { kind: 'all', query: '', source: '', model: '', method: '', tag: '' };
const dialog = $('#work-dialog'), video = $('#work-video');
const titleForKind = kind => kind === 'prompt' ? t('kind.prompt') : t('kind.reference');
// An open dialog sits in the top layer, so the toast goes in as a popover from inside it (a z-index can't beat the dialog).
function toast(message) {
  const el = $('#toast'), host = document.querySelector('dialog[open]') || document.body;
  if (el.parentElement !== host) host.append(el);
  el.classList.remove('visible');
  if (el.showPopover) { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); void el.offsetWidth; }
  el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}
startIntro();
startPoem();
// Shown once the hero has scrolled away (html.in-gallery, set in intro.js).
$('.back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
import('./background.js').then(({ startBackground }) => startBackground()).catch(() => { $('.ocean-background').dataset.state = 'fallback'; });
$('#site-version').textContent = `V${version}`;
const masonry = createMasonry($('#gallery'));
const covers = createCoverLoader(mediaURL, () => masonry.schedule());
const sticky = startStickyFilters();

const copyIcon = icon('copy');
const filterUI = startCompactFilters({ getFilters: () => filters, apply(values) { Object.assign(filters, values); applyFilters(); } });
const heart='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
let rankingCounts=null;
function updateLikeButton(button,id) {
  const state=likes.states.get(id),busy=likes.pending.has(id);
  button.innerHTML=heart+`<span>${state ? new Intl.NumberFormat(english?'en-US':'zh-CN',{notation:state.count>=10000?'compact':'standard',maximumFractionDigits:1}).format(state.count) : '…'}</span>`;
  button.setAttribute('aria-pressed',String(state?.liked || false));button.setAttribute('aria-busy',String(busy));button.disabled=busy;
  button.setAttribute('aria-label',(state?.liked?t('like.remove'):t('like.add'))+(state?t('like.count',{count:state.count}):''));
  button.title=state?.liked?t('like.remove'):t('like.add');
}
function refreshLikeButtons(id) {document.querySelectorAll('[data-like]').forEach(button=>{if(button.dataset.like===id)updateLikeButton(button,id);});}
const likes=createLikesClient({api:import.meta.env.VITE_LIKES_URL || 'https://gloria-likes-seasnake-1011.elatedeel.chatgpt.site',
  onChange(id,state){if(rankingCounts)rankingCounts.set(id,state.count);refreshLikeButtons(id);},onBusy:refreshLikeButtons});
const detailLike=document.createElement('button');detailLike.className='work-like';$('.work-topline').append(detailLike);
const sortControl=createSortControl($('.search-actions'),async value=>{if(value==='popular'){sortControl.busy=true;try{rankingCounts=await likes.ranking();}catch(error){sortControl.value='recent';toast(english?t('like.failed'):error.message);}finally{sortControl.busy=false;}}applyFilters();},'popular');
// Most liked is the default. The first render waits up to 4 s for the ranking; if it fails, the gallery falls back to newest.
const firstRanking=likes.ranking().then(counts=>{rankingCounts=counts;if(items.length&&sortControl.value==='popular')render();},()=>{if(sortControl.value==='popular')sortControl.value='recent';});
$('.archive-footnote').textContent+=' '+t('footnote.likes');
const workImage=document.createElement('img');workImage.id='work-image';workImage.hidden=true;$('.work-media').insertBefore(workImage,$('.video-surface'));
const imageNav=document.createElement('div');imageNav.className='image-navigation';imageNav.hidden=true;imageNav.innerHTML=`<button data-image-step="-1" aria-label="${t('media.prevLabel')}">${t('media.prev')}</button><span></span><button data-image-step="1" aria-label="${t('media.nextLabel')}">${t('media.next')}</button>`;
$('.work-media').insertBefore(imageNav,$('#media-caption'));
const sourceEvidence=document.createElement('details');sourceEvidence.className='source-evidence';sourceEvidence.innerHTML=`<summary>${t('evidence.title')}</summary><div class="source-evidence-images"></div>`;$('#parameters-section').before(sourceEvidence);
let imageIndex=0;
function imageURLs(item){return (item.images?.length?item.images:[item.cover]).map(mediaURL).filter(Boolean);}
function showImage(item){const urls=imageURLs(item);imageIndex=Math.max(0,Math.min(imageIndex,urls.length-1));workImage.hidden=!urls.length;if(urls.length)workImage.src=urls[imageIndex];workImage.alt=item.title;imageNav.hidden=urls.length<2;imageNav.querySelector('span').textContent=`${imageIndex+1} / ${urls.length}`;imageNav.querySelector('[data-image-step="-1"]').disabled=imageIndex===0;imageNav.querySelector('[data-image-step="1"]').disabled=imageIndex===urls.length-1;$('#media-caption').textContent=`${label(item.imageCaptions?.[imageIndex] || '') || t('media.image')} ${imageIndex+1} / ${urls.length} · ${item.generatedCover?t('media.coverRights'):t('media.rights')}`;}
imageNav.addEventListener('click',event=>{const button=event.target.closest('[data-image-step]');if(current&&button){imageIndex+=Number(button.dataset.imageStep);$('#video-error').hidden=true;showImage(current);}});
workImage.addEventListener('load',()=>{if(current&&!current.video)updateVideoLayout(workImage.naturalWidth,workImage.naturalHeight);});
workImage.addEventListener('error',()=>{if(current&&!current.video&&workImage.hasAttribute('src'))$('#video-error').hidden=false;});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-like]');if(!button)return;event.preventDefault();event.stopPropagation();try{await likes.toggle(button.dataset.like);}catch(error){toast(english?t('like.failed'):(error.message || t('like.failed')));}});
function copyWork(item) {
  if (item.prompt) copy(item.prompt, t('toast.promptCopied'));
  else copy(new URL(`#work/${encodeURIComponent(item.id)}`, location.href).href, t('toast.noPrompt'));
}
startGlassMotion($('#gallery'));
const detailTransition = createDetailTransition($('.work-layout'));
function card(item) {
  const article = document.createElement('article'); article.className = 'work-card'; article.dataset.id = item.id;
  article.innerHTML = `<div class="card-glass"><button class="card-open" data-open="${esc(item.id)}" aria-label="${esc(t('work.open', { title: item.title }))}"><span class="card-media" style="--ratio:${item.width}/${item.height}"><span class="card-placeholder" aria-hidden="true"><span class="placeholder-mark">${icon("sparkle")}</span><span class="placeholder-title">${esc(item.title)}</span><span class="placeholder-lines"><i></i><i></i></span></span><img alt="${esc(item.title)}" width="${item.width}" height="${item.height}" decoding="async"><span class="card-error"><strong>${t('card.coverPending')}</strong><span>${t('card.openForVideo')}</span></span></span><span class="card-info"><span class="card-title">${esc(item.title)}</span><span class="card-description">${esc(summaryFor(item))}</span><span class="card-caption">${esc(label(item.source))} · ${esc(label(item.model))}</span></span></button><button class="card-copy" data-copy="${esc(item.id)}" aria-label="${item.prompt ? t('work.copyPrompt') : t('work.copyLink')}: ${esc(item.title)}" title="${item.prompt ? t('work.copyPrompt') : t('work.copyLink')}">${copyIcon}</button></div>`;
  const like=document.createElement('button');like.className='card-like';like.dataset.like=item.id;article.querySelector('.card-glass').append(like);updateLikeButton(like,item.id);
  if(item.generatedCover){const badge=document.createElement('span');badge.className='generated-cover-badge';badge.textContent=t('cover.generated');article.querySelector('.card-media').append(badge);}
  covers.observe(article, item);
  return article;
}
function render(append = false) {
  filtered = filterItems(items, filters);
  if(sortControl.value==='popular'&&rankingCounts)filtered.sort((a,b)=>(rankingCounts.get(b.id)||0)-(rankingCounts.get(a.id)||0)||(a.order||0)-(b.order||0));
  const gallery = $('#gallery');
  const before = append ? gallery.children.length : 0;
  if (!append) { covers.clear(gallery); gallery.replaceChildren(); }
  const fragment = document.createDocumentFragment();
  filtered.slice(before, limit).forEach((item, i) => fragment.append(card(item, before + i)));
  gallery.append(fragment);
  likes.load(filtered.slice(before,limit).map(item=>item.id)).catch(()=>{gallery.querySelectorAll('[data-like]').forEach(button=>{if(!likes.states.has(button.dataset.like)){button.title=t('like.retry');button.querySelector('span').textContent='·';}});});
  masonry.layout();
  $('#empty-state').hidden = !!filtered.length || !items.length;
  $('#result-count').textContent = t('result.count', { count: filtered.length });
  $('#reset-filters').hidden = filters.kind === 'all' && !Object.entries(filters).some(([name, value]) => name !== 'kind' && value);
  $('#load-more-area').hidden = !filtered.length;
  $('#batch-status').textContent = t('batch.status', { shown: Math.min(limit, filtered.length), total: filtered.length });
  $('#load-more').hidden = limit >= filtered.length;
  filterUI.sync();
}
function applyFilters() { limit = 24; render(); }
function resetFilters() { clearTimeout(searchTimer); Object.assign(filters, { kind: 'all', query: '', source: '', model: '', method: '', tag: '' }); $('#search').value = ''; ['source', 'model', 'method'].forEach(name => $(`#${name}-filter`).value = ''); applyFilters(); }
$('#gallery').addEventListener('click', event => {
  const button = event.target.closest('[data-copy]'); if (button) { const item = items.find(item => item.id === button.dataset.copy); if (item) copyWork(item); return; }
  const open = event.target.closest('[data-open]'); if (open) openWork(open.dataset.open, true);
});
let searchTimer;
$('#search').addEventListener('input', event => { const value = event.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { filters.query = value; applyFilters(); }, 250); });
$('#reset-filters').addEventListener('click', resetFilters); $('#empty-reset').addEventListener('click', resetFilters);
let appending = false, armed = true;
function loadMore() {
  if (appending || limit >= filtered.length || !$('#gallery').clientWidth || !$('#gallery').offsetHeight) return;
  appending = true;
  try { limit += 24; render(true); } finally { appending = false; }
}
$('#load-more').addEventListener('click', loadMore);
new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) { armed = true; continue; }
    if (armed) { armed = false; loadMore(); }
  }
}, { rootMargin: '350px 0px' }).observe($('#load-sentinel'));

function updateVideoLayout(width, height) {
  const layout = fitVideoLayout(width, height, innerWidth, innerHeight);
  dialog.dataset.orientation = layout.orientation;
  dialog.style.setProperty('--dialog-width', `${layout.dialogWidth}px`);
  dialog.style.setProperty('--media-width', `${layout.mediaWidth}px`);
  dialog.style.setProperty('--video-ratio', `${width || 16}/${height || 9}`);
}
video.addEventListener('loadedmetadata', () => {
  if (current && video.currentSrc === mediaURL(current.video)) updateVideoLayout(video.videoWidth, video.videoHeight);
});
let videoResizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(videoResizeFrame);
  videoResizeFrame = requestAnimationFrame(() => {
    if (current) updateVideoLayout(video.videoWidth || current.width, video.videoHeight || current.height);
  });
});
function setVideo(item) {
  video.pause(); video.removeAttribute('src'); video.load();
  workImage.removeAttribute('src');workImage.hidden=true;imageNav.hidden=true;imageIndex=0;
  $('#video-error').hidden = true;
  updateVideoLayout(item.width, item.height);
  video.poster = mediaURL(item.cover); video.preload = 'metadata';
  const url = mediaURL(item.video);
  $('.video-surface').hidden=!url;
  $('#video-error p').textContent=url?t('media.videoError'):t('media.imageError');$('#retry-video').textContent=url?t('media.retryVideo'):t('media.retryImage');
  if (url) { video.src = url; video.load();$('#media-caption').textContent=t('media.playHint'); }
  else if(imageURLs(item).length)showImage(item);
  else{$('#video-error p').textContent=t('media.none');$('#video-error').hidden=false;}
}
function openWork(id, push = false) {
  const item = items.find(item => item.id === id); if (!item) return;
  if (!dialog.open) { lastFocus = document.activeElement; modalItems = filtered.some(item => item.id === id) ? [...filtered] : [...items]; }
  current = item;
  const position = modalItems.findIndex(item => item.id === id);
  $('#work-position').textContent = `${String(position + 1).padStart(2, '0')} / ${String(modalItems.length).padStart(2, '0')}`;
  $('#work-kind').textContent = titleForKind(item.kind);
  $('#work-title').textContent = item.title;
  $('#work-credit').textContent = [item.generatedCover&&t('work.promptSource'),item.author, label(item.source)].filter(Boolean).join(' · ');
  sourceEvidence.hidden=!item.sourceImages?.length;sourceEvidence.open=false;
  sourceEvidence.querySelector('div').innerHTML=(item.sourceImages || []).map(url=>mediaURL(url)).filter(Boolean).map((url,index)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="${t('evidence.image', { n: index + 1 })}" loading="lazy"></a>`).join('');
  $('#work-tags').innerHTML = item.tags.map(tag => `<span>${esc(label(tag))}</span>`).join('');
  $('#work-facts').innerHTML = [[item.generatedCover?t('work.archivedModel'):t('work.model'), label(item.model)], [item.generatedCover?t('work.coverMethod'):t('work.method'), item.generatedCover?t('work.coverMade'):label(item.method)], [t('work.modelVersion'), item.modelVersion || t('work.unconfirmed')]].map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('');
  $('#prompt-title').textContent = item.prompt ? t('work.prompt') : t('work.effect');
  $('#prompt-text').textContent = item.prompt || [item.description || t('work.effectOnly'), item.usage && t('work.usage', { usage: item.usage })].filter(Boolean).join('\n\n');
  $('#copy-prompt').hidden = !item.prompt;
  $('#prompt-note').textContent = item.prompt ? t('work.promptNote') : t('work.effectNote');
  $('#negative-section').hidden = !item.negativePrompt; $('#negative-text').textContent = item.negativePrompt;
  $('#parameters-section').open = false;
  $('#parameters-text').textContent = [t('work.size', { width: item.width, height: item.height, duration: item.duration ? t('work.seconds', { seconds: item.duration }) : t('work.noDuration') }), item.parameters].filter(Boolean).join('\n\n');
  const source = safeURL(item.sourceUrl); $('#source-link').hidden = !source; if (source) $('#source-link').href = source;
  $('#media-caption').textContent = t('media.playHint');
  detailLike.dataset.like=item.id;updateLikeButton(detailLike,item.id);likes.load([item.id],true).catch(()=>{});
  setVideo(item);
  $('.work-info').scrollTop = 0;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  if (push) history.pushState({ gloriaWork: true }, '', `#work/${encodeURIComponent(id)}`);
}
function closeWork(updateURL = true) {
  detailTransition.cancel();
  video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load(); current = null;
  workImage.removeAttribute('src');detailLike.removeAttribute('data-like');
  if (dialog.open) dialog.close();
  if (updateURL && location.hash.startsWith('#work/')) {
    // Back returns to the exact scroll position and filters that opened this item.
    if (history.state?.gloriaWork) history.back(); else history.replaceState(null, '', '#archive');
  }
  lastFocus?.focus({ preventScroll: true });
}
function moveWork(offset) {
  if (!current || detailTransition.busy) return;
  const position = modalItems.findIndex(item => item.id === current.id);
  const item = modalItems[position + offset];
  if (!item) return;
  video.pause();
  detailTransition.move(offset, () => {
    openWork(item.id);
    history.replaceState(history.state, '', `#work/${encodeURIComponent(item.id)}`);
  });
}
$('#close-work').addEventListener('click', () => closeWork());
dialog.addEventListener('cancel', event => { event.preventDefault(); closeWork(); });
startWorkSwipe(dialog, moveWork);
// The surface receives gestures above native controls, which can swallow pointer events.
$('.video-gesture-surface').addEventListener('click', () => {
  if (!current || !video.hasAttribute('src')) return;
  if (video.paused) video.play().catch(() => toast(t('toast.playFailed')));
  else video.pause();
});
video.addEventListener('error', () => { if (current && video.hasAttribute('src')) $('#video-error').hidden = false; });
$('#retry-video').addEventListener('click', async () => {
  if (!current) return;
  const id = current.id;
  const button = $('#retry-video'); button.disabled = true;
  try {
    const response = await fetch(catalogURL, { cache: 'reload' });
    if (response.ok) {
      const latest = await response.json();
      const updated = latest.items?.find(item => item.id === id);
      if (updated && current?.id === id) Object.assign(current, updated);
    }
  } catch { /* Retry the current link when the catalog is temporarily unavailable. */ }
  finally { button.disabled = false; }
  if (current?.id === id) setVideo(current);
});
async function copy(text, message) { if (await copyText(text)) toast(message); else showManualCopy(text); }
$('#copy-prompt').addEventListener('click', () => current?.prompt && copy(current.prompt, t('toast.promptCopied')));
$('#copy-negative').addEventListener('click', () => current?.negativePrompt && copy(current.negativePrompt, t('toast.negativeCopied')));
$('#share-work').addEventListener('click', () => current && copy(new URL(`#work/${current.id}`, location.href).href, t('toast.linkCopied')));
[dialog].forEach(modal => modal.addEventListener('click', event => { if (event.target !== modal) return; const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { if (modal === dialog) closeWork(); else modal.close(); } }));
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (dialog.open && !event.target.closest('video')) { if (event.key === 'ArrowLeft') { event.preventDefault(); moveWork(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); moveWork(1); } }
  else if (event.key === '/' && !document.querySelector('dialog[open]')) { event.preventDefault(); sticky.reveal(); $('#search').focus(); }
});
function readHash() { detailTransition.cancel(); if (location.hash.startsWith('#work/')) { const id = location.hash.slice(6); if (items.some(item => item.id === id)) openWork(id); else toast(t('toast.missing')); } else if (dialog.open) closeWork(false); }
window.addEventListener('popstate', readHash);
async function loadCatalog() {
  $('#catalog-error').hidden = true; $('#result-count').textContent = t('result.loading');
  try {
    const response = await fetch(catalogURL, { cache: 'no-cache' }); if (!response.ok) throw new Error('catalog');
    const catalog = await response.json(); if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items) || catalog.count !== catalog.items.length) throw new Error('schema');
    items = catalog.items.map(item => ({ ...item, width: item.width || 4, height: item.height || 3, searchAlias: searchAlias(item) }));
    const prompts = items.filter(item => item.prompt).length;
    $('#total-count').textContent = items.length;
    $('#hero-count').textContent = t('hero.count', { works: items.length, prompts });
    $('#updated-at').textContent = t('archive.updated', { date: new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { year: 'numeric', month: english ? 'short' : '2-digit', day: english ? 'numeric' : '2-digit' }).format(new Date(catalog.updatedAt)) });
    $('[data-kind="all"] span').textContent = items.length; $('[data-kind="prompt"] span').textContent = prompts; $('[data-kind="reference"] span').textContent = items.length - prompts;
    ['source', 'model', 'method'].forEach(name => { const select = $(`#${name}-filter`); select.querySelectorAll('option:not(:first-child)').forEach(option => option.remove()); [...new Set([...(catalog.options?.[name] || []), ...items.map(item => item[name])])].filter(Boolean).forEach(value => select.add(new Option(label(value), value))); });
    $('#tag-filters').innerHTML = [...new Set([...(catalog.options?.tags || []), ...items.flatMap(item => item.tags)])].map(tag => `<button data-tag="${esc(tag)}" aria-pressed="false">${esc(label(tag))}</button>`).join('');
    if (sortControl.value === 'popular' && !rankingCounts) await Promise.race([firstRanking, new Promise(resolve => setTimeout(resolve, 4000))]);
    applyFilters(); readHash();
  } catch { $('#catalog-error').hidden = false; $('#result-count').textContent = t('result.failed'); }
}
$('#retry-catalog').addEventListener('click', loadCatalog);
loadCatalog();
window.addEventListener('pagehide', () => { video.pause(); });
