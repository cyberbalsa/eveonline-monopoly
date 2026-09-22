/* Presentation only. Camera coordinates never change game state or dice. */
(function (root) {
  const SIZE = 1024;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function fitTransform(width, height) {
    const scale = Math.max(0.01, Math.min(width, height) / (SIZE + 20));
    return { x:(width - SIZE * scale) / 2, y:(height - SIZE * scale) / 2, scale };
  }
  function focusTransform(width, height, point, zoom) {
    const fit = fitTransform(width, height), scale = fit.scale * clamp(zoom, 1, 4);
    const limit = (value, dimension) => SIZE * scale < dimension ? (dimension - SIZE * scale) / 2 : clamp(value, dimension - SIZE * scale - 8, 8);
    return { x:limit(width / 2 - point.x * scale, width), y:limit(height / 2 - point.y * scale, height), scale };
  }
  function pawnPoint(cell, index, slot) {
    const cx = cell.x + cell.width / 2, cy = cell.y + cell.height / 2;
    const depth = 45 + slot * 80;
    // Corner berths sit one lane further in, away from adjacent edge spaces.
    if (index === 0) return {x:cell.x - 124 - slot % 2 * 76, y:cell.y - 124 - Math.floor(slot / 2) * 72};
    if (index === 10) return {x:cell.x + cell.width + 124 + slot % 2 * 76, y:cell.y - 124 - Math.floor(slot / 2) * 72};
    if (index === 20) return {x:cell.x + cell.width + 124 + slot % 2 * 76, y:cell.y + cell.height + 124 + Math.floor(slot / 2) * 72};
    if (index === 30) return {x:cell.x - 124 - slot % 2 * 76, y:cell.y + cell.height + 124 + Math.floor(slot / 2) * 72};
    if (index < 10) return {x:cx, y:cell.y - depth};
    if (index < 20) return {x:cell.x + cell.width + depth, y:cy};
    if (index < 30) return {x:cx, y:cell.y + cell.height + depth};
    return {x:cell.x - depth, y:cy};
  }
  function create(viewport, layer) {
    let current = null, target = null, frame = 0, lastTime = 0, zoom = 1, focus = {x:512,y:512}, drag = null, manualRevision = 0;
    let follow = true;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    function paint() {
      layer.style.transform = `translate(${current.x}px, ${current.y}px) scale(${current.scale})`;
      viewport.dataset.zoom = zoom.toFixed(2);
      viewport.classList.toggle('zoomed', zoom > 1.05);
      document.querySelector('#camera-zoom').textContent = `${Math.round(zoom * 100)}%`;
    }
    function tick(now) {
      frame = 0;
      const step = 1 - Math.exp(-Math.min(60, now - (lastTime || now - 16)) / 95);
      lastTime = now;
      let error = 0;
      for (const key of ['x','y','scale']) { const delta = target[key] - current[key]; current[key] += delta * step; error += Math.abs(delta); }
      if (error < 0.08) current = {...target};
      paint();
      if (error >= 0.08) frame = requestAnimationFrame(tick);
    }
    function move(next, immediate = false) {
      target = next;
      if (!current || immediate || reduced()) { cancelAnimationFrame(frame); frame = 0; current = {...next}; paint(); }
      else if (!frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
    }
    function update(immediate = false) {
      move(zoom <= 1 ? fitTransform(viewport.clientWidth, viewport.clientHeight) : focusTransform(viewport.clientWidth, viewport.clientHeight, focus, zoom), immediate);
    }
    function fit(manual = true) { if (manual) manualRevision++; zoom = 1; focus = {x:512,y:512}; update(); document.querySelector('#camera-caption').textContent = 'TACTICAL OVERVIEW'; }
    function focusOn(point, label, automatic = false) {
      if (automatic && (!follow || reduced())) return false;
      if (!automatic) manualRevision++;
      focus = point; zoom = Math.min(3.5, Math.max(2.15, 850 / viewport.clientWidth)); update();
      document.querySelector('#camera-caption').textContent = label;
      return true;
    }
    function resize() {
      const header = document.querySelector('.topbar').getBoundingClientRect().height;
      const available = (window.visualViewport?.height || innerHeight) - header - 110;
      const height = Math.max(120, Math.min(viewport.clientWidth, available));
      if (Math.abs(viewport.clientHeight - height) > 1) viewport.style.height = `${height}px`;
      update(true);
    }
    function adjust(factor) { manualRevision++; zoom = clamp(zoom * factor, 1, 4); update(); }
    document.querySelector('#camera-fit').addEventListener('click', () => fit());
    document.querySelector('#camera-in').addEventListener('click', () => adjust(1.4));
    document.querySelector('#camera-out').addEventListener('click', () => adjust(1 / 1.4));
    document.querySelector('#camera-follow').addEventListener('click', (e) => {
      follow = !follow; manualRevision++;
      e.currentTarget.setAttribute('aria-pressed', String(follow)); e.currentTarget.textContent = follow ? 'FOLLOW ON' : 'FOLLOW OFF';
      if (!follow) fit(false);
    });
    viewport.addEventListener('pointerdown', (e) => {
      if (zoom <= 1.05 || e.button !== 0 || e.target.closest('.ship-token')) return;
      drag = {id:e.pointerId,x:e.clientX,y:e.clientY,start:{...current},moved:false};
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx,dy) < 6 && !drag.moved) return;
      if (!drag.moved) { manualRevision++; viewport.setPointerCapture(e.pointerId); }
      drag.moved = true;
      focus = {x:(viewport.clientWidth / 2 - drag.start.x - dx) / current.scale, y:(viewport.clientHeight / 2 - drag.start.y - dy) / current.scale};
      update(true);
    });
    viewport.addEventListener('click', (e) => { if (drag?.moved) { e.preventDefault(); e.stopPropagation(); } drag = null; }, true);
    viewport.addEventListener('pointerup', () => { if (drag && !drag.moved) drag = null; else setTimeout(()=>{drag=null;},0); });
    viewport.addEventListener('pointercancel', () => { drag = null; });
    const observer = new ResizeObserver(resize); observer.observe(viewport);
    window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
    resize();
    return {fit, focusOn, get revision() {return manualRevision;}, get canFollow() {return follow && !reduced();}, get snapshot() {return {...current, zoom};}, reset() {manualRevision++; drag = null; fit(false);} };
  }
  root.BoardCamera = {SIZE, fitTransform, focusTransform, pawnPoint, create};
  if (typeof module !== 'undefined') module.exports = root.BoardCamera;
})(globalThis);
