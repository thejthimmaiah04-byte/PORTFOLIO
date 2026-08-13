(function () {
  // Derive project ID from filename: "project-mantis.html" → "mantis"
  const filename = window.location.pathname.split('/').pop();
  const match = filename.match(/^project-(.+)\.html$/);
  if (!match) return;
  const projectId = match[1];

  (async function () {
    let project;
    try {
      project = await (await fetch('/api/projects/' + projectId)).json();
    } catch (_) { return; }

    // Update gallery
    if (project.gallery && project.gallery.length) {
      const gallery = document.querySelector('.gallery');
      if (gallery) {
        gallery.innerHTML = project.gallery.map(g =>
          `<div class="slot glass${g.isPortrait ? ' slot--scroll' : ''}">\n` +
          `  <img src="${g.url}" alt="">\n</div>`
        ).join('\n');
      }
    }

    // Update chapters
    if (project.chapters && project.chapters.length) {
      const sections = document.querySelectorAll('section.chapter');
      project.chapters.forEach((ch, i) => {
        if (!sections[i]) return;
        const divs = sections[i].querySelectorAll(':scope > div');
        const contentDiv = divs[1] || divs[0];
        if (!contentDiv) return;
        let html = (ch.paragraphs || []).map(p => `<p>${p}</p>`).join('\n');
        if (ch.bullets && ch.bullets.length) {
          html += '<ul>' + ch.bullets.map(b => `<li>${b}</li>`).join('') + '</ul>';
        }
        contentDiv.innerHTML = html;
      });
    }

    // Update hero image
    if (project.heroImage) {
      const heroImg = document.querySelector('section.plate figure img');
      if (heroImg) heroImg.src = project.heroImage;
    }

    // Update title, subtitle, facts
    if (project.title) {
      const h1 = document.querySelector('h1');
      if (h1) h1.textContent = project.title;
    }
    if (project.subtitle) {
      const sci = document.querySelector('.sci');
      if (sci) sci.textContent = project.subtitle;
    }
    if (project.facts && project.facts.length) {
      const factDivs = [...document.querySelectorAll('.facts > div')];
      project.facts.forEach((f, i) => {
        if (!factDivs[i]) return;
        const k = factDivs[i].querySelector('.k');
        const v = factDivs[i].querySelector('.v');
        if (k) k.textContent = f.key;
        if (v) v.textContent = f.value;
      });
    }
  })();
})();
