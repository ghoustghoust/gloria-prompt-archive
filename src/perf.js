const SOFTWARE_RENDERER = /swiftshader|basic render driver|llvmpipe|softpipe|software rasterizer/i;

export function isSoftwareRenderer() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return SOFTWARE_RENDERER.test(renderer);
  } catch {
    return true;
  }
}

export function prefersLowEffects() {
  try {
    const lowfx = new URLSearchParams(location.search).get('lowfx');
    if (lowfx === '1') return true;
    if (lowfx === '0') return false;
    if (localStorage.getItem('gloria:low-fx') === '1') return true;
  } catch {}
  return isSoftwareRenderer();
}
