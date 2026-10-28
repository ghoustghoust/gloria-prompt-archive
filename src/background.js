import { BlueTears } from './blue-tears/fluid.js';
import { t } from './i18n.js';

// One non-interactive canvas. Pointer listeners never capture, cancel or block page input.
export function startBackground() {
  const layer = document.querySelector('.ocean-background');
  const canvas = document.querySelector('#gloria-ocean');
  const toggle = document.querySelector('.ocean-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let fluid, frame = 0, timer, previous = null, last = 0, fpsAt = 0, frames = 0;
  let paused = reducedMotion.matches, failed = false, modalOpen = false, dialogObserver;
  const abort = new AbortController();
  const listen = (target, name, fn, options = {}) => target.addEventListener(name, fn, { ...options, signal: abort.signal });
  const resetPointer = () => { previous = null; fluid?.targetTilt.set(0, 0); };
  const showPause = () => {
    toggle.textContent = paused ? t('hero.resume') : t('hero.pause');
    toggle.setAttribute('aria-pressed', String(paused));
    document.body.classList.toggle('motion-paused', paused);
  };
  const fail = error => {
    failed = true;
    cancelAnimationFrame(frame); frame = 0;
    if (fluid) fluid.params.paused = true;
    layer.dataset.state = 'fallback';
    toggle.hidden = true;
    document.body.classList.add('motion-paused');
    if (error) console.warn('Blue Tears background:', error.message);
  };
  const animate = now => {
    frame = 0;
    if (failed || paused || document.hidden) return;
    // A calm background uses at most 30 rendered frames per second.
    if (now - last >= 1000 / (modalOpen ? 18 : 30) - .5) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      fluid.step(dt);
      fluid.render();
      if (fluid.shaderError) { fail(new Error(fluid.shaderError)); return; }
      frames++;
      if (now - fpsAt >= 1000) { fluid.fps = Math.round(frames * 1000 / (now - fpsAt)); fpsAt = now; frames = 0; }
    }
    frame = requestAnimationFrame(animate);
  };
  const syncMotion = () => {
    cancelAnimationFrame(frame); frame = 0;
    fluid.params.paused = failed || paused || document.hidden;
    resetPointer();
    fluid.pendingSplats.length = 0;
    last = fpsAt = performance.now(); frames = 0;
    showPause();
    if (!failed && !fluid.params.paused) frame = requestAnimationFrame(animate);
  };
  try {
    fluid = new BlueTears(canvas);
    Object.assign(fluid.params, { speed: .65, shimmer: .8, swell: .5 });
    fluid.render();
    if (fluid.shaderError) throw new Error(fluid.shaderError);
    layer.dataset.state = 'ready';
    toggle.hidden = false;
    Object.defineProperty(window, 'gloriaBackground', { configurable: true, value: Object.freeze({
      get stats() { return { ...fluid.stats, integrationVersion: 3, state: layer.dataset.state, framePending: !!frame }; }
    }) });
    listen(toggle, 'click', () => { paused = !paused; syncMotion(); });
    listen(reducedMotion, 'change', event => { paused = event.matches; syncMotion(); });
    listen(document, 'visibilitychange', syncMotion);
    // The poem card wants the fluid behind it at full speed; other dialogs slow it down.
    const syncDialog = () => { modalOpen = !!document.querySelector('dialog[open]:not([data-keep-motion])'); syncMotion(); };
    dialogObserver = new MutationObserver(syncDialog);
    document.querySelectorAll('dialog').forEach(dialog => dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
    syncDialog();
    listen(window, 'blur', resetPointer);
    listen(document.documentElement, 'pointerleave', resetPointer);
    listen(window, 'pointercancel', resetPointer);
    listen(window, 'pointerup', event => { if (event.pointerType !== 'mouse') resetPointer(); });
    listen(window, 'pointermove', event => {
      if (paused || failed || document.hidden || modalOpen) { resetPointer(); return; }
      const rect = canvas.getBoundingClientRect();
      const p = { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height };
      fluid.targetTilt.set((p.x - .5) * .8, (p.y - .5) * .8);
      const interactive = event.target.closest('a,button,input,textarea,select,[contenteditable="true"]');
      if (previous && (!interactive || interactive.matches('.banner-open'))) {
        const dx = p.x - previous.x, dy = p.y - previous.y;
        if (Math.abs(dy) > .0006 && Math.hypot(dx, dy) < .18) fluid.disturb(p.x, p.y, dx, dy, event.buttons ? .65 : .28);
      }
      previous = p;
    }, { passive: true });
    listen(window, 'resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (failed) return;
        try { fluid.resize(); fluid.render(); resetPointer(); } catch (error) { fail(error); }
      }, 150);
    }, { passive: true });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL context lost')); });
    listen(canvas, 'webglcontextrestored', () => {
      try { fluid.dispose(); fluid = new BlueTears(canvas); Object.assign(fluid.params, { speed: .65, shimmer: .8, swell: .5 });
        fluid.render();
        if (fluid.shaderError) throw new Error(fluid.shaderError);
        failed = false; layer.dataset.state = 'ready'; toggle.hidden = false; syncMotion();
      } catch (error) { fail(error); }
    });
    listen(window, 'pagehide', event => {
      cancelAnimationFrame(frame); frame = 0; clearTimeout(timer);
      if (!event.persisted) { dialogObserver?.disconnect(); abort.abort(); fluid.dispose(); }
    });
    listen(window, 'pageshow', event => { if (event.persisted && !failed) syncMotion(); });
    syncMotion();
  } catch (error) { fluid?.dispose(); fail(error); }
}
