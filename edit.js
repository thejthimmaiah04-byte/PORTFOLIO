(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  const pendingImgs = new Map(); // img/container element → File
  let savedApiData = null;

  // ── Boot ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  async function boot() {
    try { savedApiData = await (await fetch('/api/content')).json(); } catch (_) {}
    injectCSS();
    injectSaveBar();
    neutralisePortfolioJS();
    initProjectTiles();
    initNoteTiles();
    initAbout();
    addTileButtons();
  }

  // ── Neutralise portfolio interactivity ────────────────────────────────────
  function neutralisePortfolioJS() {
    // Kill tilt on existing tiles
    document.querySelectorAll('.tile').forEach(t => {
      t.onmousemove = null;
      t.onmouseleave = null;
      t.style.transform = 'none';
    });
    // Kill carousel pointer-drag (arrow buttons still work)
    document.querySelectorAll('.track').forEach(track => {
      track.onpointerdown = null;
    });
    // Hide snake canvas & controls
    ['snake-canvas', 'snake-controls'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('canvas').forEach(c => (c.style.display = 'none'));
  }

  // ── Save bar ──────────────────────────────────────────────────────────────
  function injectSaveBar() {
    const bar = document.createElement('div');
    bar.id = 'edit-bar';
    bar.innerHTML =
      '<span id="edit-bar-label">EDIT MODE</span>' +
      '<span id="edit-bar-msg"></span>' +
      '<button id="edit-bar-save">Save changes</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('edit-bar-save').addEventListener('click', save);
  }

  function barMsg(text, color) {
    const el = document.getElementById('edit-bar-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '#9AA1A8';
  }

  // ── Inject CSS ────────────────────────────────────────────────────────────
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
/* ── Kill all animations in edit mode ─────────────────────────────────── */
body.edit-mode *, body.edit-mode *::before, body.edit-mode *::after {
  animation: none !important;
  transition: none !important;
}
body.edit-mode .tile { transform: none !important; }

/* ── Edit bar ──────────────────────────────────────────────────────────── */
#edit-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9000;
  height: 52px;
  display: flex; align-items: center; gap: 14px; padding: 0 20px;
  background: rgba(10,23,18,.97); border-bottom: 1px solid #24382E;
  font-family: "Jost","Futura",system-ui,sans-serif;
}
#edit-bar-label {
  font-size: 9px; font-weight: 700; letter-spacing: .32em; color: #FF5A00;
}
#edit-bar-msg { flex: 1; font-size: 12px; }
#edit-bar-save {
  background: #FF5A00; color: #fff; border: none; border-radius: 8px;
  font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .06em;
  padding: 9px 22px; cursor: pointer;
}
#edit-bar-save:disabled { opacity: .5; cursor: default; }
body.edit-mode { padding-top: 52px; }

/* ── Editable text ─────────────────────────────────────────────────────── */
body.edit-mode [contenteditable] {
  outline: none; cursor: text; min-width: 1px;
  border-radius: 4px;
}
body.edit-mode [contenteditable]:hover { background: rgba(255,90,0,.07); }
body.edit-mode [contenteditable]:focus { background: rgba(255,90,0,.13); }

/* ── Image overlay ─────────────────────────────────────────────────────── */
.edit-img-wrap { position: relative; }
.edit-img-overlay {
  position: absolute; inset: 0; z-index: 5;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: rgba(0,0,0,.52); border-radius: inherit;
  opacity: 0; pointer-events: none;
}
.edit-img-wrap:hover .edit-img-overlay { opacity: 1; pointer-events: auto; }
.edit-img-btn {
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.26);
  color: #fff; border-radius: 6px; cursor: pointer;
  font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  padding: 6px 13px; white-space: nowrap;
}
.edit-img-btn:hover { background: rgba(255,255,255,.26); }
.edit-img-btn.rm { background: rgba(220,50,40,.55); border-color: rgba(220,50,40,.55); }
.edit-img-btn.rm:hover { background: rgba(220,50,40,.8); }

/* placeholder when no image ─────────────────────────────────────────── */
.edit-img-empty {
  position: relative; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  background: rgba(36,56,46,.4); border: 2px dashed #24382E;
  border-radius: inherit; cursor: pointer; min-height: 120px; width: 100%;
  color: #9AA1A8; font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
}
.edit-img-empty:hover { border-color: #FF5A00; color: #FF5A00; }
.edit-img-empty input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.edit-img-empty-ico { font-size: 28px; }

/* ── Tile delete button ─────────────────────────────────────────────── */
.tile-del {
  position: absolute; top: 10px; right: 10px; z-index: 20;
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(220,50,40,.85); color: #fff; border: none;
  font-size: 15px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
}
.tile:hover .tile-del { opacity: 1; }
.tile { position: relative; }

/* ── Tag editing ────────────────────────────────────────────────────── */
.chip { display: inline-flex; align-items: center; gap: 3px; }
.chip-x {
  background: none; border: none; color: rgba(255,255,255,.5);
  cursor: pointer; font-size: 13px; line-height: 1; padding: 0 1px;
}
.chip-x:hover { color: #FF5A00; }
.tag-add {
  display: inline-flex; align-items: center;
  border: 1px dashed rgba(255,255,255,.2); border-radius: 20px;
  background: none; color: #9AA1A8; cursor: pointer;
  font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .1em; padding: 3px 9px;
  vertical-align: middle;
}
.tag-add:hover { border-color: #FF5A00; color: #FF5A00; }

/* ── Status toggle row ──────────────────────────────────────────────── */
.status-row {
  margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
}
.status-pill {
  font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
  border: 1px solid #24382E; border-radius: 20px; padding: 3px 10px;
  cursor: pointer; background: none; color: #9AA1A8;
}
.status-pill.active { border-color: #FF5A00; color: #FF5A00; background: rgba(255,90,0,.1); }
.link-input {
  background: rgba(36,56,46,.6); border: 1px solid #24382E; border-radius: 6px;
  color: #fff; font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 11px; padding: 4px 8px; outline: none; width: 100%; margin-top: 4px;
}
.link-input:focus { border-color: #FF5A00; }

/* ── Add-tile button ────────────────────────────────────────────────── */
.add-tile {
  flex: 0 0 240px; align-self: stretch; min-height: 300px;
  border: 2px dashed #24382E; border-radius: 16px;
  background: none; color: #9AA1A8; cursor: pointer;
  font-family: "Jost","Futura",system-ui,sans-serif;
  font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.add-tile:hover { border-color: #FF5A00; color: #FF5A00; }
.add-tile-ico { font-size: 30px; line-height: 1; }
`;
    document.head.appendChild(s);
  }

  // ── Image controls ────────────────────────────────────────────────────────
  // Wraps an element with an overlay (replace / remove) or renders a click-to-add empty state.
  function makeImgEditable(container, imgEl, onNewFile, onRemove) {
    container.classList.add('edit-img-wrap');

    if (!imgEl) {
      renderEmptySlot(container, onNewFile);
      return;
    }

    // Store original URL (non-base64 only)
    if (!imgEl.dataset.src) {
      const raw = imgEl.getAttribute('src') || '';
      imgEl.dataset.src = raw.startsWith('data:') ? '' : raw;
    }

    const overlay = document.createElement('div');
    overlay.className = 'edit-img-overlay';

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'edit-img-btn';
    replaceBtn.textContent = 'Replace';

    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.style.display = 'none';
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0]; if (!f) return;
      onNewFile(f, imgEl);
      const reader = new FileReader();
      reader.onload = e => { imgEl.src = e.target.result; };
      reader.readAsDataURL(f);
    });

    replaceBtn.addEventListener('click', () => fileIn.click());

    const removeBtn = document.createElement('button');
    removeBtn.className = 'edit-img-btn rm';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      pendingImgs.delete(imgEl);
      imgEl.remove();
      overlay.remove();
      container.classList.remove('edit-img-wrap');
      onRemove();
      renderEmptySlot(container, onNewFile);
      container.classList.add('edit-img-wrap');
    });

    overlay.append(replaceBtn, fileIn, removeBtn);
    container.appendChild(overlay);
  }

  function renderEmptySlot(container, onNewFile) {
    const empty = document.createElement('label');
    empty.className = 'edit-img-empty';
    empty.innerHTML = '<span class="edit-img-empty-ico">+</span><span>Add image</span>';
    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*';
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0]; if (!f) return;
      const img = document.createElement('img');
      img.dataset.src = '';
      empty.replaceWith(img);
      container.classList.add('edit-img-wrap');
      onNewFile(f, img);
      const reader = new FileReader();
      reader.onload = e => {
        img.src = e.target.result;
        makeImgEditable(container, img, onNewFile, () => {
          container.classList.remove('edit-img-wrap');
          renderEmptySlot(container, onNewFile);
          container.classList.add('edit-img-wrap');
        });
      };
      reader.readAsDataURL(f);
    });
    empty.appendChild(fileIn);
    container.appendChild(empty);
  }

  // ── Tag helpers ───────────────────────────────────────────────────────────
  function makeTagsEditable(tagsEl) {
    tagsEl.querySelectorAll('.chip').forEach(chip => {
      const x = document.createElement('button');
      x.className = 'chip-x'; x.textContent = '×';
      x.addEventListener('click', () => chip.remove());
      chip.appendChild(x);
    });
    appendAddTagBtn(tagsEl);
  }

  function appendAddTagBtn(tagsEl) {
    const btn = document.createElement('button');
    btn.className = 'tag-add'; btn.textContent = '+ tag';
    btn.addEventListener('click', () => {
      const val = prompt('New tag:');
      if (!val || !val.trim()) return;
      const chip = document.createElement('span'); chip.className = 'chip';
      const txt = document.createTextNode(val.trim()); chip.appendChild(txt);
      const x = document.createElement('button'); x.className = 'chip-x'; x.textContent = '×';
      x.addEventListener('click', () => chip.remove());
      chip.appendChild(x);
      tagsEl.insertBefore(chip, btn);
    });
    tagsEl.appendChild(btn);
  }

  // ── Status row ────────────────────────────────────────────────────────────
  function makeStatusEditable(tile) {
    const goEl = tile.querySelector('.go');
    if (!goEl) return;

    const row = document.createElement('div'); row.className = 'status-row';

    const csBtn = document.createElement('button'); csBtn.className = 'status-pill'; csBtn.textContent = 'Coming soon';
    const cpBtn = document.createElement('button'); cpBtn.className = 'status-pill'; cpBtn.textContent = 'Complete';

    const linkInput = document.createElement('input');
    linkInput.className = 'link-input'; linkInput.placeholder = 'e.g. project-mantis.html';
    linkInput.value = tile.dataset.link || '';
    linkInput.title = 'Filename of the project detail page';

    const updateStatus = (s) => {
      tile.dataset.status = s;
      csBtn.classList.toggle('active', s === 'coming-soon');
      cpBtn.classList.toggle('active', s === 'complete');
      linkInput.style.display = s === 'complete' ? 'block' : 'none';
      if (s === 'complete') {
        goEl.textContent = 'View project';
        goEl.classList.remove('disabled');
        goEl.removeAttribute('aria-disabled');
      } else {
        goEl.textContent = 'Coming soon';
        goEl.classList.add('disabled');
        goEl.setAttribute('aria-disabled', 'true');
      }
    };

    csBtn.addEventListener('click', () => updateStatus('coming-soon'));
    cpBtn.addEventListener('click', () => updateStatus('complete'));
    linkInput.addEventListener('input', () => { tile.dataset.link = linkInput.value; });

    row.append(csBtn, cpBtn, linkInput);
    goEl.after(row);
    updateStatus(tile.dataset.status || 'coming-soon');

    // "Edit project page" deep-link for complete projects
    const editPageLink = document.createElement('a');
    editPageLink.className = 'edit-project-link';
    editPageLink.textContent = 'Edit project page →';
    editPageLink.style.cssText =
      'display:none;font-family:"Jost","Futura",system-ui,sans-serif;' +
      'font-size:10px;color:#FF5A00;text-decoration:none;letter-spacing:.1em;' +
      'text-transform:uppercase;margin-top:6px;';
    editPageLink.addEventListener('click', e => {
      e.stopPropagation();
      window.location.href = '/edit-project/' + tile.dataset.id;
    });
    row.after(editPageLink);

    // Show/hide it when status changes
    const origUpdateStatus = updateStatus;
    const patchedUpdate = (s) => {
      origUpdateStatus(s);
      editPageLink.style.display = (s === 'complete' && tile.dataset.link) ? 'block' : 'none';
    };
    csBtn.onclick = () => patchedUpdate('coming-soon');
    cpBtn.onclick = () => { patchedUpdate('complete'); };
    linkInput.addEventListener('input', () => {
      tile.dataset.link = linkInput.value;
      editPageLink.style.display = (tile.dataset.status === 'complete' && linkInput.value) ? 'block' : 'none';
    });
    // Init display
    editPageLink.style.display =
      (tile.dataset.status === 'complete' && tile.dataset.link) ? 'block' : 'none';
  }

  // ── Project tiles ─────────────────────────────────────────────────────────
  function initProjectTile(tile) {
    // Text
    const nameEl = tile.querySelector('.name'); if (nameEl) nameEl.contentEditable = 'true';
    const blurbEl = tile.querySelector('.blurb'); if (blurbEl) blurbEl.contentEditable = 'true';

    // Tags
    const tagsEl = tile.querySelector('.tags'); if (tagsEl) makeTagsEditable(tagsEl);

    // Status
    makeStatusEditable(tile);

    // Image
    const shot = tile.querySelector('.shot');
    if (shot) {
      const img = shot.querySelector('img');
      makeImgEditable(shot, img,
        (f, imgEl) => pendingImgs.set(imgEl, f),
        () => {}
      );
    }

    // Delete
    const del = document.createElement('button');
    del.className = 'tile-del'; del.textContent = '×'; del.title = 'Delete project';
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete this project?')) return;
      tile.remove();
    });
    tile.appendChild(del);
  }

  function initProjectTiles() {
    document.querySelectorAll('.tile[data-type="project"]').forEach(initProjectTile);
  }

  // ── Note tiles ────────────────────────────────────────────────────────────
  function initNoteTile(tile) {
    const nameEl = tile.querySelector('.name'); if (nameEl) nameEl.contentEditable = 'true';
    const blurbEl = tile.querySelector('.blurb'); if (blurbEl) blurbEl.contentEditable = 'true';

    const shot = tile.querySelector('.shot');
    if (shot) {
      const img = shot.querySelector('img');
      makeImgEditable(shot, img,
        (f, imgEl) => pendingImgs.set(imgEl, f),
        () => {}
      );
    }

    const del = document.createElement('button');
    del.className = 'tile-del'; del.textContent = '×'; del.title = 'Delete entry';
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete this entry?')) return;
      tile.remove();
    });
    tile.appendChild(del);
  }

  function initNoteTiles() {
    document.querySelectorAll('.tile[data-type="note"]').forEach(initNoteTile);
  }

  // ── About section ─────────────────────────────────────────────────────────
  function initAbout() {
    // Bio paragraphs
    document.querySelectorAll('.about-copy p').forEach(p => { p.contentEditable = 'true'; });

    // Profile portrait
    const portrait = document.querySelector('.portrait');
    if (portrait) {
      const img = portrait.querySelector('img');
      makeImgEditable(portrait, img,
        (f, imgEl) => pendingImgs.set(imgEl, f),
        () => {}
      );
    }

    // Fieldwork aside
    const aside = document.querySelector('.about-aside');
    if (aside) {
      // Remove em placeholder if present
      const em = aside.querySelector('em'); if (em) em.remove();
      const img = aside.querySelector('img');
      makeImgEditable(aside, img,
        (f, imgEl) => pendingImgs.set(imgEl, f),
        () => {}
      );
    }
  }

  // ── Add-tile buttons ──────────────────────────────────────────────────────
  function addTileButtons() {
    const projectsTrack = document.getElementById('track');
    if (projectsTrack) {
      const btn = document.createElement('button');
      btn.className = 'add-tile';
      btn.innerHTML = '<span class="add-tile-ico">+</span><span>Add project</span>';
      btn.addEventListener('click', () => {
        const t = makeEmptyProjectTile();
        projectsTrack.insertBefore(t, btn);
        initProjectTile(t);
        t.querySelector('[contenteditable]')?.focus();
      });
      projectsTrack.appendChild(btn);
    }

    const notesTrack = document.getElementById('notesTrack');
    if (notesTrack) {
      const btn = document.createElement('button');
      btn.className = 'add-tile';
      btn.innerHTML = '<span class="add-tile-ico">+</span><span>Add entry</span>';
      btn.addEventListener('click', () => {
        const t = makeEmptyNoteTile();
        notesTrack.insertBefore(t, btn);
        initNoteTile(t);
        t.querySelector('[contenteditable]')?.focus();
      });
      notesTrack.appendChild(btn);
    }
  }

  function makeEmptyProjectTile() {
    const a = document.createElement('article');
    a.className = 'tile glass';
    a.dataset.id = ''; a.dataset.type = 'project';
    a.dataset.status = 'coming-soon'; a.dataset.link = '';
    a.innerHTML =
      '<div class="shot"></div>' +
      '<h3 class="name">Project name</h3>' +
      '<div class="tags"></div>' +
      '<p class="blurb">Describe the project.</p>' +
      '<span class="go disabled" aria-disabled="true">Coming soon</span>';
    return a;
  }

  function makeEmptyNoteTile() {
    const a = document.createElement('article');
    a.className = 'tile glass';
    a.dataset.id = ''; a.dataset.type = 'note';
    a.innerHTML =
      '<div class="shot"></div>' +
      '<h3 class="name">Entry title</h3>' +
      '<p class="blurb">What you saw, what you learned, why it mattered.</p>';
    return a;
  }

  // ── Collect + save ────────────────────────────────────────────────────────
  async function uploadFile(file) {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('Upload failed');
    return (await r.json()).url;
  }

  function imgUrl(imgEl) {
    if (!imgEl) return null;
    if (pendingImgs.has(imgEl)) return null; // will be replaced after upload
    const s = imgEl.dataset.src || imgEl.getAttribute('src') || '';
    if (!s || s.startsWith('data:')) return null;
    try { return new URL(s).pathname; } catch (_) { return s; }
  }

  function innerText(el) {
    if (!el) return '';
    // Remove child buttons (chip-x, tag-add) from text
    const clone = el.cloneNode(true);
    clone.querySelectorAll('button, input').forEach(b => b.remove());
    return clone.textContent.trim();
  }

  async function collectData() {
    const projects = [];
    for (const tile of document.querySelectorAll('#track .tile[data-type="project"]')) {
      const imgEl = tile.querySelector('.shot img');
      let image = imgUrl(imgEl);
      if (imgEl && pendingImgs.has(imgEl)) image = await uploadFile(pendingImgs.get(imgEl));

      const tags = [...tile.querySelectorAll('.tags .chip')].map(c => {
        const clone = c.cloneNode(true);
        clone.querySelectorAll('button').forEach(b => b.remove());
        return clone.textContent.trim();
      }).filter(Boolean);

      projects.push({
        id: tile.dataset.id || crypto.randomUUID(),
        name: innerText(tile.querySelector('.name')),
        tags,
        blurb: innerText(tile.querySelector('.blurb')),
        status: tile.dataset.status || 'coming-soon',
        link: tile.dataset.link || null,
        image,
      });
    }

    const fieldNotes = [];
    for (const tile of document.querySelectorAll('#notesTrack .tile[data-type="note"]')) {
      const imgEl = tile.querySelector('.shot img');
      let image = imgUrl(imgEl);
      if (imgEl && pendingImgs.has(imgEl)) image = await uploadFile(pendingImgs.get(imgEl));

      fieldNotes.push({
        id: tile.dataset.id || crypto.randomUUID(),
        title: innerText(tile.querySelector('.name')),
        text: innerText(tile.querySelector('.blurb')),
        image,
      });
    }

    // About
    const bio = [...document.querySelectorAll('.about-copy p')]
      .map(p => p.textContent.trim()).filter(Boolean);

    const portraitImg = document.querySelector('.portrait img');
    let photo = savedApiData?.about?.photo || null;
    if (portraitImg && pendingImgs.has(portraitImg)) photo = await uploadFile(pendingImgs.get(portraitImg));
    else if (portraitImg) { const u = imgUrl(portraitImg); if (u) photo = u; }

    const asideImg = document.querySelector('.about-aside img');
    let fieldworkPhoto = savedApiData?.about?.fieldworkPhoto || null;
    if (asideImg && pendingImgs.has(asideImg)) fieldworkPhoto = await uploadFile(pendingImgs.get(asideImg));
    else if (asideImg) { const u = imgUrl(asideImg); if (u) fieldworkPhoto = u; }

    const about = (bio.length || photo || fieldworkPhoto)
      ? { photo, fieldworkPhoto, bio }
      : (savedApiData?.about || null);

    return { projects, fieldNotes, about };
  }

  async function save() {
    const btn = document.getElementById('edit-bar-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    barMsg('Uploading images…', '#9AA1A8');
    try {
      const data = await collectData();
      const r = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      savedApiData = await (await fetch('/api/content')).json();
      pendingImgs.clear();
      barMsg('Saved ✓ — refresh the portfolio to see changes', '#00c864');
      setTimeout(() => barMsg(''), 5000);
    } catch (e) {
      barMsg('Error: ' + e.message, '#dc3c32');
    } finally {
      btn.disabled = false; btn.textContent = 'Save changes';
    }
  }
})();
