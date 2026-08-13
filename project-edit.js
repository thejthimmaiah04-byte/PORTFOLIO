(function () {
  'use strict';

  const PROJECT_ID = window.PROJECT_ID;
  const pendingImgs = new Map();
  let apiProject = null;
  let galleryTouched = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  async function boot() {
    try {
      const d = await (await fetch('/api/content')).json();
      apiProject = (d.projects || []).find(p => p.id === PROJECT_ID) || null;
    } catch (_) {}
    injectCSS();
    injectSaveBar();
    neutralise();
    makeHeaderEditable();
    makeHeroEditable();
    makeChaptersEditable();
    makeGalleryEditable();
  }

  // ── Header: title, subtitle, facts ────────────────────────────────────────
  function makeHeaderEditable() {
    // Project title
    const h1 = document.querySelector('h1');
    if (h1) h1.contentEditable = 'true';

    // Subtitle (scientific name)
    const sci = document.querySelector('.sci');
    if (sci) sci.contentEditable = 'true';

    // Facts grid — make both label (k) and value (v) editable
    document.querySelectorAll('.facts .k, .facts .v').forEach(el => {
      el.contentEditable = 'true';
    });
  }

  // ── Neutralise animations ─────────────────────────────────────────────────
  function neutralise() {
    document.querySelectorAll('canvas').forEach(c => (c.style.display = 'none'));
  }

  // ── Save bar ──────────────────────────────────────────────────────────────
  function injectSaveBar() {
    const bar = document.createElement('div');
    bar.id = 'pe-bar';
    bar.innerHTML =
      '<a id="pe-back" href="/edit">← Back to portfolio</a>' +
      '<span id="pe-label">EDIT MODE</span>' +
      '<span id="pe-msg"></span>' +
      '<button id="pe-save">Save changes</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('pe-save').addEventListener('click', save);
  }

  function barMsg(t, c) {
    const el = document.getElementById('pe-msg');
    if (el) { el.textContent = t; el.style.color = c || '#9AA1A8'; }
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
body.edit-mode *, body.edit-mode *::before, body.edit-mode *::after {
  animation: none !important; transition: none !important;
}
#pe-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9000; height: 52px;
  display: flex; align-items: center; gap: 14px; padding: 0 20px;
  background: rgba(10,23,18,.97); border-bottom: 1px solid #24382E;
  font-family: "Jost","Futura",system-ui,sans-serif;
}
#pe-back {
  font-size: 11px; color: #9AA1A8; text-decoration: none; letter-spacing: .06em;
  white-space: nowrap;
}
#pe-back:hover { color: #fff; }
#pe-label {
  font-size: 9px; font-weight: 700; letter-spacing: .32em; color: #FF5A00;
  white-space: nowrap;
}
#pe-msg { flex: 1; font-size: 12px; }
#pe-save {
  background: #FF5A00; color: #fff; border: none; border-radius: 8px;
  font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .06em;
  padding: 9px 22px; cursor: pointer; white-space: nowrap;
}
#pe-save:disabled { opacity: .5; cursor: default; }
body.edit-mode { padding-top: 52px; }

/* Editable text */
body.edit-mode [contenteditable] { outline: none; cursor: text; border-radius: 3px; }
body.edit-mode [contenteditable]:hover { background: rgba(255,90,0,.07); }
body.edit-mode [contenteditable]:focus { background: rgba(255,90,0,.13); }

/* Image overlay */
.pe-img-wrap { position: relative; }
.pe-overlay {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  background: rgba(0,0,0,.55); border-radius: inherit;
  opacity: 0; pointer-events: none;
}
.pe-img-wrap:hover .pe-overlay { opacity: 1; pointer-events: auto; }
.pe-btn {
  background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.28);
  color: #fff; border-radius: 6px; cursor: pointer;
  font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 6px 12px;
}
.pe-btn:hover { background: rgba(255,255,255,.28); }
.pe-btn.rm { background: rgba(200,40,30,.55); border-color: rgba(200,40,30,.5); }
.pe-btn.rm:hover { background: rgba(200,40,30,.8); }
.pe-btn.active { border-color: #FF5A00; color: #FF5A00; }

/* Empty hero placeholder */
.pe-hero-empty {
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  gap: 10px; min-height: 300px; width: 100%; cursor: pointer;
  border: 2px dashed #24382E; border-radius: 12px;
  color: #9AA1A8; font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
  position: relative;
}
.pe-hero-empty input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.pe-hero-empty:hover { border-color: #FF5A00; color: #FF5A00; }

/* Chapter add buttons */
.pe-add-p, .pe-add-li {
  display: inline-block; margin-top: 8px; margin-right: 8px;
  background: none; border: 1px dashed #24382E; border-radius: 6px;
  color: #9AA1A8; cursor: pointer; font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .14em; text-transform: uppercase; padding: 4px 12px;
}
.pe-add-p:hover, .pe-add-li:hover { border-color: #FF5A00; color: #FF5A00; }

/* Gallery controls */
.gallery .slot { position: relative; }
.slot-overlay {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;
  background: rgba(0,0,0,.55); border-radius: inherit;
  opacity: 0; pointer-events: none;
}
.gallery .slot:hover .slot-overlay { opacity: 1; pointer-events: auto; }

/* Gallery add slot */
.gallery-add-slot {
  width: 70%; border: 2px dashed #24382E; border-radius: 14px;
  min-height: 200px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px; cursor: pointer;
  color: #9AA1A8; font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 11px; letter-spacing: .18em; text-transform: uppercase; position: relative;
}
.gallery-add-slot:hover { border-color: #FF5A00; color: #FF5A00; }
.gallery-add-slot input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.gallery-add-slot-ico { font-size: 30px; }
`;
    document.head.appendChild(s);
  }

  // ── Hero image ────────────────────────────────────────────────────────────
  function makeHeroEditable() {
    const figure = document.querySelector('section.plate figure');
    if (!figure) return;
    figure.classList.add('pe-img-wrap');

    const img = figure.querySelector('img');
    if (img) {
      if (!img.dataset.src) {
        const raw = img.getAttribute('src') || '';
        img.dataset.src = raw.startsWith('data:') ? '' : raw;
      }
      attachImgOverlay(figure, img, () => {
        img.remove();
        figure.classList.remove('pe-img-wrap');
        renderHeroEmpty(figure);
      });
    } else {
      renderHeroEmpty(figure);
    }
  }

  function renderHeroEmpty(figure) {
    const empty = document.createElement('label');
    empty.className = 'pe-hero-empty';
    empty.innerHTML = '<span style="font-size:30px">+</span><span>Add hero image</span>';
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
    fi.addEventListener('change', () => {
      const f = fi.files[0]; if (!f) return;
      const img = document.createElement('img'); img.dataset.src = '';
      empty.replaceWith(img); figure.classList.add('pe-img-wrap');
      pendingImgs.set(img, f);
      const r = new FileReader();
      r.onload = e => {
        img.src = e.target.result;
        attachImgOverlay(figure, img, () => {
          img.remove(); figure.classList.remove('pe-img-wrap'); renderHeroEmpty(figure);
        });
      };
      r.readAsDataURL(f);
    });
    empty.appendChild(fi);
    figure.appendChild(empty);
  }

  function attachImgOverlay(wrap, img, onRemove) {
    const ov = document.createElement('div'); ov.className = 'pe-overlay';

    const replBtn = document.createElement('button'); replBtn.className = 'pe-btn'; replBtn.textContent = 'Replace';
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
    fi.addEventListener('change', () => {
      const f = fi.files[0]; if (!f) return;
      pendingImgs.set(img, f);
      const r = new FileReader(); r.onload = e => { img.src = e.target.result; }; r.readAsDataURL(f);
    });
    replBtn.addEventListener('click', () => fi.click());

    const rmBtn = document.createElement('button'); rmBtn.className = 'pe-btn rm'; rmBtn.textContent = 'Remove';
    rmBtn.addEventListener('click', () => { pendingImgs.delete(img); ov.remove(); onRemove(); });

    ov.append(replBtn, fi, rmBtn);
    wrap.appendChild(ov);
  }

  // ── Chapters ──────────────────────────────────────────────────────────────
  function makeChaptersEditable() {
    document.querySelectorAll('section.chapter').forEach(section => {
      const divs = section.querySelectorAll(':scope > div');
      const contentDiv = divs[1] || divs[0]; // second div = text side
      if (!contentDiv) return;

      // Make heading editable
      const h2 = section.querySelector('h2');
      if (h2) h2.contentEditable = 'true';

      // Make paragraphs editable + add delete on each
      contentDiv.querySelectorAll('p').forEach(p => makeParaEditable(p, contentDiv));

      // Make list items editable
      const ul = contentDiv.querySelector('ul');
      if (ul) {
        ul.querySelectorAll('li').forEach(li => makeLiEditable(li, ul));
        // Add bullet button
        const addLi = document.createElement('button'); addLi.className = 'pe-add-li'; addLi.textContent = '+ bullet';
        addLi.addEventListener('click', () => {
          const li = document.createElement('li'); li.contentEditable = 'true'; li.textContent = '';
          makeLiEditable(li, ul); ul.appendChild(li); li.focus();
        });
        ul.after(addLi);
      }

      // Add paragraph button
      const addP = document.createElement('button'); addP.className = 'pe-add-p'; addP.textContent = '+ paragraph';
      addP.addEventListener('click', () => {
        const p = document.createElement('p'); p.textContent = '';
        makeParaEditable(p, contentDiv);
        // Insert before the add buttons
        contentDiv.insertBefore(p, addP);
        p.focus();
      });
      contentDiv.appendChild(addP);
    });
  }

  function makeParaEditable(p, parent) {
    p.contentEditable = 'true';
    p.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Add a new paragraph after this one
        const next = document.createElement('p'); next.contentEditable = 'true'; next.textContent = '';
        p.after(next); next.focus();
      }
      if (e.key === 'Backspace' && p.textContent === '') {
        e.preventDefault();
        const prev = p.previousElementSibling;
        p.remove();
        if (prev && prev.contentEditable) { moveCursorToEnd(prev); }
      }
    });
  }

  function makeLiEditable(li, ul) {
    li.contentEditable = 'true';
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const next = document.createElement('li'); next.contentEditable = 'true'; next.textContent = '';
        li.after(next); next.focus();
      }
      if (e.key === 'Backspace' && li.textContent === '') {
        e.preventDefault(); const prev = li.previousElementSibling; li.remove();
        if (prev) moveCursorToEnd(prev);
      }
    });
  }

  function moveCursorToEnd(el) {
    el.focus();
    const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }

  // ── Gallery ───────────────────────────────────────────────────────────────
  function makeGalleryEditable() {
    const gallery = document.querySelector('.gallery');
    if (!gallery) return;

    gallery.querySelectorAll('.slot').forEach(slot => attachSlotOverlay(slot));

    // Add-image slot
    const addSlot = document.createElement('label');
    addSlot.className = 'gallery-add-slot';
    addSlot.innerHTML = '<span class="gallery-add-slot-ico">+</span><span>Add image</span>';
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*';
    fi.addEventListener('change', () => {
      const f = fi.files[0]; if (!f) return;
      galleryTouched = true;
      const newSlot = document.createElement('div'); newSlot.className = 'slot glass';
      const img = document.createElement('img'); img.dataset.src = ''; newSlot.appendChild(img);
      gallery.insertBefore(newSlot, addSlot);
      pendingImgs.set(img, f);
      const r = new FileReader(); r.onload = e => { img.src = e.target.result; attachSlotOverlay(newSlot); };
      r.readAsDataURL(f);
      fi.value = '';
    });
    addSlot.appendChild(fi);
    gallery.appendChild(addSlot);
  }

  function attachSlotOverlay(slot) {
    const img = slot.querySelector('img');
    const ov = document.createElement('div'); ov.className = 'slot-overlay';

    // Portrait toggle
    const portBtn = document.createElement('button'); portBtn.className = 'pe-btn';
    const updatePortBtn = () => {
      const on = slot.classList.contains('slot--scroll');
      portBtn.textContent = on ? 'Portrait ✓' : 'Portrait';
      portBtn.classList.toggle('active', on);
    };
    updatePortBtn();
    portBtn.addEventListener('click', () => {
      galleryTouched = true; slot.classList.toggle('slot--scroll'); updatePortBtn();
    });

    // Replace
    const replBtn = document.createElement('button'); replBtn.className = 'pe-btn'; replBtn.textContent = 'Replace';
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
    fi.addEventListener('change', () => {
      const f = fi.files[0]; if (!f) return;
      galleryTouched = true;
      if (img) pendingImgs.set(img, f);
      const r = new FileReader(); r.onload = e => { if (img) img.src = e.target.result; }; r.readAsDataURL(f);
    });
    replBtn.addEventListener('click', () => fi.click());

    // Remove
    const rmBtn = document.createElement('button'); rmBtn.className = 'pe-btn rm'; rmBtn.textContent = 'Remove';
    rmBtn.addEventListener('click', () => { galleryTouched = true; if (img) pendingImgs.delete(img); slot.remove(); });

    ov.append(portBtn, replBtn, fi, rmBtn);
    slot.appendChild(ov);

    if (img && !img.dataset.src) {
      const raw = img.getAttribute('src') || '';
      img.dataset.src = raw.startsWith('data:') ? '' : raw;
    }
  }

  // ── Upload helper ─────────────────────────────────────────────────────────
  async function uploadFile(file) {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('Upload failed');
    return (await r.json()).url;
  }

  function imgUrl(img) {
    if (!img) return null;
    const s = img.dataset.src || img.getAttribute('src') || '';
    if (!s || s.startsWith('data:')) return null;
    try { return new URL(s).pathname; } catch (_) { return s; }
  }

  // ── Collect + save ────────────────────────────────────────────────────────
  async function save() {
    const btn = document.getElementById('pe-save');
    btn.disabled = true; btn.textContent = 'Saving…'; barMsg('Uploading…', '#9AA1A8');

    try {
      const payload = {};

      // Title, subtitle, facts
      const h1 = document.querySelector('h1');
      if (h1) payload.title = h1.textContent.trim();
      const sci = document.querySelector('.sci');
      if (sci) payload.subtitle = sci.textContent.trim();
      const factRows = [...document.querySelectorAll('.facts > div')];
      if (factRows.length) {
        payload.facts = factRows.map(row => ({
          key: row.querySelector('.k')?.textContent.trim() || '',
          value: row.querySelector('.v')?.textContent.trim() || '',
        }));
      }

      // Hero image
      const heroImg = document.querySelector('section.plate figure img');
      if (heroImg) {
        if (pendingImgs.has(heroImg)) payload.heroImage = await uploadFile(pendingImgs.get(heroImg));
        else { const u = imgUrl(heroImg); if (u) payload.heroImage = u; }
      }

      // Chapters
      payload.chapters = [...document.querySelectorAll('section.chapter')].map(section => {
        const h2 = section.querySelector('h2');
        const divs = section.querySelectorAll(':scope > div');
        const contentDiv = divs[1] || divs[0];
        const paragraphs = [...(contentDiv?.querySelectorAll('p') || [])]
          .map(p => p.textContent.trim()).filter(Boolean);
        const bullets = [...(contentDiv?.querySelectorAll('li') || [])]
          .map(li => li.textContent.trim()).filter(Boolean);
        return { heading: h2 ? h2.textContent.trim() : '', paragraphs, bullets };
      });

      // Gallery — only save if user touched it
      if (galleryTouched) {
        const gallery = [];
        for (const slot of document.querySelectorAll('.gallery .slot')) {
          const img = slot.querySelector('img');
          if (!img) continue;
          let url = null;
          if (pendingImgs.has(img)) { url = await uploadFile(pendingImgs.get(img)); pendingImgs.delete(img); }
          else url = imgUrl(img);
          if (url) gallery.push({ url, isPortrait: slot.classList.contains('slot--scroll') });
        }
        payload.gallery = gallery;
      }

      const r = await fetch(`/api/projects/${PROJECT_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());

      pendingImgs.clear(); galleryTouched = false;
      barMsg('Saved ✓', '#00c864');
      setTimeout(() => barMsg(''), 4000);
    } catch (e) {
      barMsg('Error: ' + e.message, '#dc3c32');
    } finally {
      btn.disabled = false; btn.textContent = 'Save changes';
    }
  }
})();
