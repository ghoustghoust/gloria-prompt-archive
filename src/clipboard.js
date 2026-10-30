// Cross-origin Toy containers may omit clipboard-write permission. Keep the
// selection-based copy inside the original click, before any asynchronous wait.
export async function copyText(text) {
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const inputSelection = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.setAttribute('aria-label', '复制内容');
  field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px';
  // A modal makes body children inert, so mount inside the open dialog.
  (document.querySelector('dialog[open]') || document.body).append(field);
  let copied = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, field.value.length);
    copied = document.execCommand('copy');
  } catch { /* Try the modern API below. */ }
  finally {
    field.remove();
    active?.focus({ preventScroll: true });
    if (inputSelection) active.setSelectionRange(...inputSelection);
    else if (selection) { selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range)); }
  }
  if (copied) return true;
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

export function showManualCopy(text) {
  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'width:min(600px,90vw);padding:24px;border-radius:16px;color:#fff;background:#202630;border:1px solid #697485';
  const title = document.createElement('p');
  title.textContent = '请按 ⌘C / Ctrl+C 复制，手机可长按下方文字';
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.setAttribute('aria-label', '待复制的完整内容');
  field.style.cssText = 'width:100%;height:40vh;font-size:16px;box-sizing:border-box';
  const close = document.createElement('button');
  close.textContent = '关闭';
  close.addEventListener('click', () => dialog.close());
  const previous = document.activeElement;
  dialog.addEventListener('close', () => { dialog.remove(); previous?.focus({ preventScroll: true }); });
  dialog.append(title, field, close);
  document.body.append(dialog);
  dialog.showModal();
  field.focus({ preventScroll: true });
  field.select();
}
