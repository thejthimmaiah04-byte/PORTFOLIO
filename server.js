const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');

const ROOT = __dirname;
// On Railway (or any host), set DATA_DIR env var to a writable volume path.
// Locally falls back to the repo's own data/ and uploads/ folders.
const DATA_DIR   = process.env.DATA_DIR    ? path.resolve(process.env.DATA_DIR)    : path.join(ROOT, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(ROOT, 'uploads');
const DATA_FILE  = path.join(DATA_DIR, 'content.json');

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED = {
  projects: [
    {
      id: 'mantis',
      name: 'The Mantis',
      tags: ['3D Modelling'],
      blurb: 'A high-detail 3D model of Empusa pennata. Built to capture the beauty of the mantis working from a monocular alone.',
      status: 'complete',
      link: 'project-mantis.html',
      image: '/MANTIS-MAIN.jpeg',
    },
    {
      id: 'weather',
      name: 'Weather Station',
      tags: ['Electronics', 'ESP-32'],
      blurb: 'A custom ESP-32 weather station. Logs temperature, humidity and pressure to an SD card and serves a live dashboard over Wi-Fi.',
      status: 'coming-soon',
      link: null,
      image: null,
    },
    {
      id: 'avian',
      name: 'Avian Diversity Index',
      tags: ['Data', 'Ecology'],
      blurb: 'A species-richness survey across three habitat types in Kodagu. 47 species logged over six months using transect walks.',
      status: 'coming-soon',
      link: null,
      image: null,
    },
  ],
  fieldNotes: [],
  about: null,
};

// ── Persistence ──────────────────────────────────────────────────────────────
try { fs.mkdirSync(DATA_DIR,    { recursive: true }); } catch (e) { console.error('Cannot create DATA_DIR:', e.message); }
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { console.error('Cannot create UPLOADS_DIR:', e.message); }

const read = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED, null, 2));
    return SEED;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
};
const write = d => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));

// ── SSR templates ────────────────────────────────────────────────────────────
const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function contributorBadge(p, ownerPhoto) {
  const collabs = (p.contributors || []).filter(c => !c.isOwner);
  const ownerImg = ownerPhoto
    ? `<img src="${esc(ownerPhoto)}" alt="Owner">`
    : `<span class="t-initials">TT</span>`;
  let html = `<div class="tile-contributors">`;
  html += `<div class="t-avatar" title="Thimmaiah">${ownerImg}</div>`;
  if (collabs.length) {
    const people = collabs.map(c => {
      const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      const img = c.photo ? `<img src="${esc(c.photo)}" alt="${esc(c.name)}">` : initials;
      return `<div class="t-collab-person">
        <div class="t-avatar-sm">${img}</div>
        <div class="t-collab-info"><b>${esc(c.name)}</b>${c.role ? `<small>${esc(c.role)}</small>` : ''}</div>
      </div>`;
    }).join('');
    html += `<div class="t-collab-wrap">
      <div class="t-collab-btn" tabindex="0" aria-label="Collaborators">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <div class="t-collab-tip">${people}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function projectTile(p, ownerPhoto) {
  const tags = (p.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  const shot = p.image
    ? `<img src="${esc(p.image)}" data-src="${esc(p.image)}" alt="${esc(p.name)}">`
    : `<em>Replace &mdash; project image</em>`;
  const cta = p.status === 'complete' && p.link
    ? `<a class="go" href="${esc(p.link)}">View project</a>`
    : `<span class="go disabled" aria-disabled="true">Coming soon</span>`;
  return `    <article class="tile glass" data-id="${esc(p.id)}" data-type="project" data-status="${esc(p.status||'coming-soon')}" data-link="${esc(p.link||'')}">
      <div class="shot">${shot}</div>
      <h3 class="name">${esc(p.name)}</h3>
      <div class="tags">${tags}</div>
      <p class="blurb">${esc(p.blurb)}</p>
      ${cta}
      ${contributorBadge(p, ownerPhoto)}
    </article>`;
}

function noteTile(n) {
  const shot = n.image
    ? `<img src="${esc(n.image)}" data-src="${esc(n.image)}" alt="${esc(n.title)}">`
    : `<em>Replace &mdash; photo</em>`;
  return `    <article class="tile glass" data-id="${esc(n.id)}" data-type="note">
      <div class="shot">${shot}</div>
      <h3 class="name">${esc(n.title)}</h3>
      <p class="blurb">${esc(n.text)}</p>
    </article>`;
}

// ── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname)),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Root — SSR ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const d = read();
    const projects = d.projects || [];
    const notes = d.fieldNotes || [];

    const ownerPhoto = d.about?.photo || null;
    const projectsHtml = projects.length
      ? projects.map(p => projectTile(p, ownerPhoto)).join('\n')
      : `    <article class="tile glass"><div class="shot"><em>No projects yet</em></div><h3 class="name">Add a project</h3><p class="blurb">Open the admin panel to add projects.</p><span class="go disabled" aria-disabled="true">Coming soon</span></article>`;

    const notesHtml = notes.length
      ? notes.map(noteTile).join('\n')
      : `    <article class="tile glass"><div class="shot"><em>No entries yet</em></div><h3 class="name">Add a field note</h3><p class="blurb">Open the admin panel to add field notes.</p></article>`;

    html = html.replace(/<!--\s*PROJECTS_TILES\s*-->[\s\S]*?<!--\s*\/PROJECTS_TILES\s*-->/, `<!-- PROJECTS_TILES -->${projectsHtml}<!-- /PROJECTS_TILES -->`);
    html = html.replace(/<!--\s*NOTES_TILES\s*-->[\s\S]*?<!--\s*\/NOTES_TILES\s*-->/, `<!-- NOTES_TILES -->${notesHtml}<!-- /NOTES_TILES -->`);

    // About section (if admin has saved it)
    if (d.about) {
      const a = d.about;
      if (a.photo) {
        html = html.replace(/(<div class="portrait[^"]*"[^>]*>[\s\S]*?<img)[^>]+(alt="[^"]*")/, `$1 src="${esc(a.photo)}" $2`);
      }
      if (a.fieldworkPhoto) {
        html = html.replace(
          /<div class="about-aside glass">[\s\S]*?<\/div>/,
          `<div class="about-aside glass"><img src="${esc(a.fieldworkPhoto)}" alt="Fieldwork" loading="lazy"></div>`
        );
      }
      if (a.bio && a.bio.length) {
        const bioHtml = a.bio.map(p => `<p>${esc(p)}</p>`).join('\n        ');
        html = html.replace(/<div class="about-copy">[\s\S]*?<\/div>/, `<div class="about-copy">\n        ${bioHtml}\n      </div>`);
      }
    }

    res.send(html);
  } catch (e) {
    res.sendFile(path.join(ROOT, 'index.html'));
  }
});

// Static files (project pages, images, admin, etc.)
app.use(express.static(ROOT));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── API ──────────────────────────────────────────────────────────────────────
app.get('/api/content', (req, res) => res.json(read()));

// Image upload
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Projects CRUD
app.post('/api/projects', (req, res) => {
  const d = read();
  const p = { ...req.body, id: randomUUID() };
  d.projects.push(p);
  write(d); res.json(p);
});

app.put('/api/projects/:id', (req, res) => {
  const d = read();
  const i = d.projects.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  d.projects[i] = { ...d.projects[i], ...req.body, id: req.params.id };
  write(d); res.json(d.projects[i]);
});

app.delete('/api/projects/:id', (req, res) => {
  const d = read();
  d.projects = d.projects.filter(p => p.id !== req.params.id);
  write(d); res.json({ ok: true });
});

// Field notes CRUD
app.post('/api/fieldnotes', (req, res) => {
  const d = read();
  const n = { ...req.body, id: randomUUID() };
  d.fieldNotes.push(n);
  write(d); res.json(n);
});

app.put('/api/fieldnotes/:id', (req, res) => {
  const d = read();
  const i = d.fieldNotes.findIndex(n => n.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  d.fieldNotes[i] = { ...d.fieldNotes[i], ...req.body, id: req.params.id };
  write(d); res.json(d.fieldNotes[i]);
});

app.delete('/api/fieldnotes/:id', (req, res) => {
  const d = read();
  d.fieldNotes = d.fieldNotes.filter(n => n.id !== req.params.id);
  write(d); res.json({ ok: true });
});

// About
app.put('/api/about', (req, res) => {
  const d = read();
  d.about = req.body;
  write(d); res.json(d.about);
});

// Bulk save (from WYSIWYG editor)
app.put('/api/content', (req, res) => {
  const d = read();
  if (Array.isArray(req.body.projects)) d.projects = req.body.projects;
  if (Array.isArray(req.body.fieldNotes)) d.fieldNotes = req.body.fieldNotes;
  if (req.body.about !== undefined) d.about = req.body.about;
  write(d); res.json({ ok: true });
});

// Individual project (for project detail pages)
app.get('/api/projects/:id', (req, res) => {
  const d = read();
  const p = d.projects.find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

// Project detail page — SSR with API data (for live portfolio)
app.get('/project-mantis.html', (req, res) => {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'project-mantis.html'), 'utf8');
    const d = read();
    const project = d.projects.find(p => p.id === 'mantis');
    if (project) html = injectProjectData(html, project);
    res.send(html);
  } catch (e) { res.sendFile(path.join(ROOT, 'project-mantis.html')); }
});

// WYSIWYG edit for project detail pages
app.get('/edit-project/:id', (req, res) => {
  try {
    const d = read();
    const project = d.projects.find(p => p.id === req.params.id);
    if (!project || !project.link) return res.status(404).send('Project not found');
    let html = fs.readFileSync(path.join(ROOT, project.link), 'utf8');
    html = injectProjectData(html, project);
    html = html.replace('<body', '<body class="edit-mode"');
    html = html.replace('</body>',
      `<script>window.PROJECT_ID=${JSON.stringify(project.id)};</script>\n` +
      `<script src="/cropper.js"></script>\n` +
      `<script src="/project-edit.js"></script>\n</body>`);
    res.send(html);
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

function injectProjectData(html, project) {
  // Replace project title (h1)
  if (project.title) {
    html = html.replace(/<h1>[^<]*<\/h1>/, `<h1>${esc(project.title)}</h1>`);
  }
  // Replace subtitle (.sci)
  if (project.subtitle) {
    html = html.replace(/(<div class="sci">)[^<]*(<\/div>)/, `$1${esc(project.subtitle)}$2`);
  }
  // Replace facts grid (.facts.glass)
  if (project.facts && project.facts.length) {
    const factsStart = html.indexOf('<div class="facts glass">');
    if (factsStart !== -1) {
      const headerEnd = html.indexOf('</header>', factsStart);
      const factsEnd = html.lastIndexOf('</div>', headerEnd) + '</div>'.length;
      const inner = project.facts.map(f =>
        `    <div><div class="k">${esc(f.key)}</div><div class="v">${esc(f.value)}</div></div>`
      ).join('\n');
      html = html.slice(0, factsStart) +
        `<div class="facts glass">\n${inner}\n  </div>` +
        html.slice(factsEnd);
    }
  }
  // Replace gallery section if API has gallery data
  if (project.gallery && project.gallery.length) {
    const gStart = html.indexOf('<section class="gallery-wrap">');
    if (gStart !== -1) {
      const gEnd = html.indexOf('</section>', gStart) + '</section>'.length;
      const slots = project.gallery.map(g =>
        `      <div class="slot glass${g.isPortrait ? ' slot--scroll' : ''}">\n` +
        `        <img src="${esc(g.url)}" data-src="${esc(g.url)}" alt="">\n      </div>`
      ).join('\n');
      html = html.slice(0, gStart) +
        `  <section class="gallery-wrap">\n    <span class="idx-mark caps">05 / 05 &mdash; Gallery</span>\n` +
        `    <div class="gallery">\n${slots}\n    </div>\n  </section>` +
        html.slice(gEnd);
    }
  }
  // Replace hero image if API has one
  if (project.heroImage) {
    html = html.replace(
      /<section class="plate">[\s\S]*?<figure[^>]*>[\s\S]*?(<img)[^>]*>/,
      (m, tag) => m.replace(tag, `<img src="${esc(project.heroImage)}" data-src="${esc(project.heroImage)}"`)
    );
  }
  // Replace chapter text if API has chapters data
  if (project.chapters && project.chapters.length) {
    let pos = 0;
    project.chapters.forEach(ch => {
      const marker = '<section class="chapter">';
      const idx = html.indexOf(marker, pos);
      if (idx === -1) return;
      const end = html.indexOf('</section>', idx) + '</section>'.length;
      const original = html.slice(idx, end);
      // Keep the heading side-div, replace the content div
      const headingDiv = original.match(/<div>\s*<span[^>]*>[\s\S]*?<\/span>\s*<h2>[^<]*<\/h2>\s*<\/div>/)?.[0] || '';
      const paras = (ch.paragraphs || []).map(p => `      <p>${esc(p)}</p>`).join('\n');
      const bullets = (ch.bullets || []).length
        ? `      <ul>\n${ch.bullets.map(b => `        <li>${esc(b)}</li>`).join('\n')}\n      </ul>`
        : '';
      const newSection =
        `<section class="chapter">\n    ${headingDiv}\n    <div>\n${paras}${bullets ? '\n' + bullets : ''}\n    </div>\n  </section>`;
      html = html.slice(0, idx) + newSection + html.slice(end);
      pos = idx + newSection.length;
    });
  }
  return html;
}

// WYSIWYG edit page
app.get('/admin', (req, res) => {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const d = read();
    const projects = d.projects || [];
    const notes = d.fieldNotes || [];

    const projectsHtml = projects.map(projectTile).join('\n') ||
      `    <article class="tile glass" data-id="" data-type="project" data-status="coming-soon" data-link=""><div class="shot"><em>Add a project</em></div><h3 class="name">Project name</h3><div class="tags"></div><p class="blurb">Describe it here.</p><span class="go disabled">Coming soon</span></article>`;
    const notesHtml = notes.map(noteTile).join('\n') ||
      `    <article class="tile glass" data-id="" data-type="note"><div class="shot"><em>Add a note</em></div><h3 class="name">Entry title</h3><p class="blurb">What you observed.</p></article>`;

    html = html.replace(/<!--\s*PROJECTS_TILES\s*-->[\s\S]*?<!--\s*\/PROJECTS_TILES\s*-->/, `<!-- PROJECTS_TILES -->${projectsHtml}<!-- /PROJECTS_TILES -->`);
    html = html.replace(/<!--\s*NOTES_TILES\s*-->[\s\S]*?<!--\s*\/NOTES_TILES\s*-->/, `<!-- NOTES_TILES -->${notesHtml}<!-- /NOTES_TILES -->`);

    if (d.about) {
      const a = d.about;
      if (a.photo) html = html.replace(/(<div class="portrait[^"]*"[^>]*>[\s\S]*?<img)[^>]+(alt="[^"]*")/, `$1 src="${esc(a.photo)}" data-src="${esc(a.photo)}" $2`);
      if (a.bio && a.bio.length) {
        const bioHtml = a.bio.map(p => `<p>${esc(p)}</p>`).join('\n        ');
        html = html.replace(/<div class="about-copy">[\s\S]*?<\/div>/, `<div class="about-copy">\n        ${bioHtml}\n      </div>`);
      }
      if (a.fieldworkPhoto) {
        html = html.replace(/<div class="about-aside glass">[\s\S]*?<\/div>/, `<div class="about-aside glass"><img src="${esc(a.fieldworkPhoto)}" data-src="${esc(a.fieldworkPhoto)}" alt="Fieldwork"></div>`);
      }
    }

    html = html.replace('<body', '<body class="edit-mode"');
    html = html.replace('</body>', '<script src="/cropper.js"></script>\n<script src="/edit.js"></script>\n</body>');
    res.send(html);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address);

  console.log('\n  Portfolio server running.\n');
  console.log('  Local:   http://localhost:' + PORT);
  ips.forEach(ip => console.log('  Network: http://' + ip + ':' + PORT));
  console.log('\n  Admin:   http://localhost:' + PORT + '/admin');
  console.log('');
});
