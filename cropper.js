(function () {
  'use strict';

  // Inject dialog CSS once
  const style = document.createElement('style');
  style.textContent = `
#crop-dialog {
  padding: 0; border: none; background: transparent;
  max-width: 100vw; max-height: 100vh; overflow: visible;
}
#crop-dialog::backdrop {
  background: rgba(0,0,0,.90);
}
#crop-dialog > .crop-inner {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  font-family: "Jost","Futura",system-ui,sans-serif;
  padding: 28px 20px;
  max-height: 100vh; box-sizing: border-box;
}
.crop-title {
  color: #9AA1A8; font-size: 10px; letter-spacing: .28em; font-weight: 700;
}
.crop-hint {
  color: #3a5040; font-size: 10px; letter-spacing: .12em; margin-top: -8px;
}
.crop-frame-wrap {
  border-radius: 10px; overflow: hidden;
  border: 2px solid #FF5A00; box-shadow: 0 0 0 5px rgba(255,90,0,.18);
}
.crop-frame-wrap canvas { display: block; cursor: grab; touch-action: none; }
.crop-frame-wrap canvas:active { cursor: grabbing; }
.crop-presets {
  display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
}
.crop-preset-btn {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
  color: #9AA1A8; border-radius: 6px; padding: 6px 14px; cursor: pointer;
  font-family: inherit; font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
}
.crop-preset-btn:hover { border-color: rgba(255,255,255,.4); color: #fff; }
.crop-preset-btn.active { border-color: #FF5A00; color: #FF5A00; background: rgba(255,90,0,.1); }
.crop-zoom-row { display: flex; align-items: center; gap: 10px; }
.crop-zoom-btn {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
  color: #fff; border-radius: 6px; width: 36px; height: 36px;
  font-size: 20px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-family: inherit;
}
.crop-zoom-btn:hover { background: rgba(255,255,255,.18); }
.crop-zoom-label { color: #5a6a60; font-size: 10px; letter-spacing: .1em; min-width: 80px; text-align: center; }
.crop-actions { display: flex; gap: 12px; }
.crop-cancel-btn {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
  color: #9AA1A8; border-radius: 8px; padding: 10px 26px; cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .06em;
}
.crop-cancel-btn:hover { background: rgba(255,255,255,.14); color: #fff; }
.crop-apply-btn {
  background: #FF5A00; border: none; color: #fff; border-radius: 8px;
  padding: 10px 26px; cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .06em;
}
.crop-apply-btn:hover { background: #e05000; }
.crop-apply-btn:disabled { opacity: .5; cursor: default; }
`;
  document.head.appendChild(style);

  // ── openCropper ─────────────────────────────────────────────────────────────
  // openCropper(file, callback)
  // openCropper(file, { aspectRatio: 16/9 }, callback)
  function openCropper(file, opts, callback) {
    if (typeof opts === 'function') { callback = opts; opts = {}; }
    opts = opts || {};

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); build(img, file.name, opts, callback); };
    img.onerror = () => { URL.revokeObjectURL(url); callback(file); };
    img.src = url;
  }

  function buildFrame(ar, vw, vh) {
    const maxW = Math.min(vw * 0.88, 760);
    const maxH = Math.min(Math.round(vh * 0.60), 560);
    if (!ar) return { w: maxW, h: maxH };
    let w = maxW, h = Math.round(w / ar);
    if (h > maxH) { h = maxH; w = Math.round(h * ar); }
    return { w, h };
  }

  function build(img, filename, opts, callback) {
    const vw = window.innerWidth, vh = window.innerHeight;
    let ar = ('aspectRatio' in opts) ? opts.aspectRatio : null;
    let { w: FRAME_W, h: FRAME_H } = buildFrame(ar, vw, vh);

    let scale, ox, oy;

    const fitScale = () => Math.max(FRAME_W / img.width, FRAME_H / img.height);

    function resetView() {
      scale = fitScale();
      ox = img.width / 2;
      oy = img.height / 2;
    }
    resetView();

    function clamp() {
      scale = Math.max(fitScale(), scale);
      ox = Math.min(Math.max(ox, (FRAME_W / 2) / scale), img.width  - (FRAME_W / 2) / scale);
      oy = Math.min(Math.max(oy, (FRAME_H / 2) / scale), img.height - (FRAME_H / 2) / scale);
    }

    // ── Dialog ────────────────────────────────────────────────────────────────
    const dialog = document.createElement('dialog');
    dialog.id = 'crop-dialog';

    const inner = document.createElement('div');
    inner.className = 'crop-inner';

    const titleEl = document.createElement('div');
    titleEl.className = 'crop-title';
    titleEl.textContent = 'CROP & POSITION';

    const hintEl = document.createElement('div');
    hintEl.className = 'crop-hint';
    hintEl.textContent = 'Drag to reposition  ·  Scroll / pinch to zoom';

    // ── Canvas ────────────────────────────────────────────────────────────────
    const frameWrap = document.createElement('div');
    frameWrap.className = 'crop-frame-wrap';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    function sizeCanvas() {
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      canvas.style.width  = FRAME_W + 'px';
      canvas.style.height = FRAME_H + 'px';
      frameWrap.style.width  = FRAME_W + 'px';
      frameWrap.style.height = FRAME_H + 'px';
    }
    sizeCanvas();
    frameWrap.appendChild(canvas);

    function draw() {
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      ctx.drawImage(img,
        FRAME_W / 2 - ox * scale,
        FRAME_H / 2 - oy * scale,
        img.width * scale, img.height * scale
      );
    }
    draw();

    // ── Aspect ratio presets ──────────────────────────────────────────────────
    const presets = [
      { label: 'Free',   ar: null     },
      { label: '1 : 1',  ar: 1        },
      { label: '4 : 3',  ar: 4 / 3    },
      { label: '16 : 9', ar: 16 / 9   },
      { label: '3 : 4',  ar: 3 / 4    },
    ];

    const presetRow = document.createElement('div');
    presetRow.className = 'crop-presets';

    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'crop-preset-btn' + (p.ar === ar ? ' active' : '');
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        ar = p.ar;
        ({ w: FRAME_W, h: FRAME_H } = buildFrame(ar, vw, vh));
        sizeCanvas();
        scale = Math.max(fitScale(), scale);
        clamp(); draw();
        presetRow.querySelectorAll('.crop-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      presetRow.appendChild(btn);
    });

    // ── Zoom controls ─────────────────────────────────────────────────────────
    const zoomRow = document.createElement('div');
    zoomRow.className = 'crop-zoom-row';

    const zoomOut = document.createElement('button');
    zoomOut.className = 'crop-zoom-btn'; zoomOut.textContent = '−'; zoomOut.type = 'button';
    zoomOut.addEventListener('click', () => { scale *= 0.85; clamp(); draw(); updateZoomLabel(); });

    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'crop-zoom-label';
    const updateZoomLabel = () => { zoomLabel.textContent = Math.round(scale / fitScale() * 100) + '%  zoom'; };
    updateZoomLabel();

    const zoomIn = document.createElement('button');
    zoomIn.className = 'crop-zoom-btn'; zoomIn.textContent = '+'; zoomIn.type = 'button';
    zoomIn.addEventListener('click', () => { scale *= 1.15; clamp(); draw(); updateZoomLabel(); });

    zoomRow.append(zoomOut, zoomLabel, zoomIn);

    // ── Action buttons ────────────────────────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'crop-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'crop-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { dialog.close(); dialog.remove(); });

    const applyBtn = document.createElement('button');
    applyBtn.className = 'crop-apply-btn';
    applyBtn.textContent = 'Apply Crop';
    applyBtn.addEventListener('click', () => {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Processing…';

      const outW = Math.min(FRAME_W * 2, img.width);
      const outH = Math.round(outW * FRAME_H / FRAME_W);
      const out = document.createElement('canvas');
      out.width = outW; out.height = outH;
      out.getContext('2d').drawImage(img,
        ox - (FRAME_W / 2) / scale,
        oy - (FRAME_H / 2) / scale,
        FRAME_W / scale, FRAME_H / scale,
        0, 0, outW, outH
      );
      out.toBlob(blob => {
        const name = filename.replace(/\.[^.]+$/, '') + '-cropped.jpg';
        dialog.close(); dialog.remove();
        callback(new File([blob], name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    });

    // Close on backdrop click
    dialog.addEventListener('click', e => {
      if (e.target === dialog) { dialog.close(); dialog.remove(); }
    });

    actions.append(cancelBtn, applyBtn);
    inner.append(titleEl, hintEl, presetRow, frameWrap, zoomRow, actions);
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    dialog.showModal();

    // ── Mouse drag ────────────────────────────────────────────────────────────
    let dragging = false, lx, ly;

    canvas.addEventListener('mousedown', e => {
      dragging = true; lx = e.clientX; ly = e.clientY; e.preventDefault();
    });
    dialog.addEventListener('mousemove', e => {
      if (!dragging) return;
      ox -= (e.clientX - lx) / scale;
      oy -= (e.clientY - ly) / scale;
      lx = e.clientX; ly = e.clientY;
      clamp(); draw();
    });
    dialog.addEventListener('mouseup', () => { dragging = false; });

    // ── Touch (pan + pinch) ───────────────────────────────────────────────────
    let lastT = null;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault(); lastT = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const cur = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
      if (cur.length === 1 && lastT && lastT.length >= 1) {
        ox -= (cur[0].x - lastT[0].x) / scale;
        oy -= (cur[0].y - lastT[0].y) / scale;
      } else if (cur.length === 2 && lastT && lastT.length === 2) {
        const d0 = Math.hypot(lastT[0].x - lastT[1].x, lastT[0].y - lastT[1].y);
        const d1 = Math.hypot(cur[0].x  - cur[1].x,  cur[0].y  - cur[1].y);
        if (d0 > 0) scale *= d1 / d0;
      }
      lastT = cur; clamp(); draw(); updateZoomLabel();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { lastT = null; });

    // ── Scroll zoom ───────────────────────────────────────────────────────────
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      scale *= e.deltaY < 0 ? 1.1 : 0.9;
      clamp(); draw(); updateZoomLabel();
    }, { passive: false });
  }

  window.openCropper = openCropper;
})();
