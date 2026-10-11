(function () {
  'use strict';

  const API = '/api';
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const escapeHtml = (str) => (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  // ---------------------------------------------------------------------
  // Mobile nav toggle
  // ---------------------------------------------------------------------
  const navToggle = $('#nav-toggle');
  const navLinks = $('#nav-links');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    $$('#nav-links a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // ---------------------------------------------------------------------
  // Rotating chakra ring — rotates with scroll position
  // ---------------------------------------------------------------------
  const chakraImg = $('#chakra-img');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (chakraImg && !reduceMotion) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const deg = (window.scrollY * 0.18) % 360;
        chakraImg.style.transform = `rotate(${deg}deg)`;
        ticking = false;
      });
    }, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Scroll-fade reveal
  // ---------------------------------------------------------------------
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // ---------------------------------------------------------------------
  // Site settings — text, background, portraits, hero image, map, scholarship
  // ---------------------------------------------------------------------
  async function loadSettings() {
    const res = await fetch(`${API}/settings`);
    const s = await res.json();

    const setText = (id, key) => { const el = $('#' + id); if (el && s[key] !== undefined) el.textContent = s[key]; };
    const setSrc = (id, key) => { const el = $('#' + id); if (el && s[key]) el.src = s[key]; };

    ['nav-academy-name', 'hero-academy-name', 'footer-academy-name'].forEach(id => setText(id, 'academy_name'));
    setText('hero-quote-text', 'hero_quote');
    setText('hero-quote-author', 'hero_quote_author');
    setText('hero-mission', 'mission_statement');
    setText('about-text', 'about_text');
    setText('heritage-text', 'heritage_text');
    setText('guru-name-en', 'guru_name_en');
    setText('guru-name-kn', 'guru_name_kn');
    setText('footer-guru-name', 'guru_name_en');
    setText('kseab-junior-count', 'kseab_junior_count');
    setText('kseab-senior-count', 'kseab_senior_count');
    setText('seva-text', 'seva_text');
    setText('gratitude-text', 'gratitude_text');
    setText('scholarship-title', 'scholarship_title');
    setText('scholarship-content', 'scholarship_content');
    setText('visit-address', 'address');
    setText('contact-phone', 'contact_phone');
    setText('contact-whatsapp', 'contact_whatsapp');
    setText('contact-email', 'contact_email');

    setSrc('guru-portrait-img', 'guru_portrait');
    setSrc('scholarship-image', 'scholarship_image');

    ['nav-logo', 'footer-logo'].forEach(id => {
      const el = $('#' + id);
      if (!el) return;
      if (s.site_logo) { el.src = s.site_logo; el.classList.add('has-logo'); }
      else { el.classList.remove('has-logo'); }
    });

    if (s.hero_image) {
      $('.hero').style.setProperty('--hero-image', `url('${s.hero_image}')`);
      $('.hero').style.backgroundImage = `url('${s.hero_image}')`;
    }
    if (s.background_color) {
      document.body.style.setProperty('--site-bg-color', s.background_color);
    }
    document.body.style.setProperty('--site-bg-image', s.site_background ? `url('${s.site_background}')` : 'none');
    if (s.map_lat && s.map_lng) {
      const lat = parseFloat(s.map_lat), lng = parseFloat(s.map_lng);
      const d = 0.01;
      const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
      $('#map-iframe').src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
    }

    window.__nkSettings = s; // cache for admin.js
  }

  // ---------------------------------------------------------------------
  // Performances Across India — clickable places -> modal with photos
  // ---------------------------------------------------------------------
  async function loadPerformances() {
    const res = await fetch(`${API}/performance`);
    const places = await res.json();
    window.__nkPlaces = places;

    const grid = $('#places-grid');
    grid.innerHTML = places.map(p => `
      <button class="place-chip" data-place-id="${p.id}">
        ${escapeHtml(p.name)}
        ${p.note ? `<span class="place-note">${escapeHtml(p.note)}</span>` : ''}
      </button>
    `).join('') || '<p class="empty-note">Performance places will appear here.</p>';

    $$('.place-chip', grid).forEach(btn => {
      btn.addEventListener('click', () => openPlaceModal(Number(btn.dataset.placeId)));
    });
  }

  function openPlaceModal(placeId) {
    const place = (window.__nkPlaces || []).find(p => p.id === placeId);
    if (!place) return;
    $('#place-modal-title').textContent = place.name;
    $('#place-modal-note').textContent = place.note || '';
    const photoGrid = $('#place-modal-photos');
    photoGrid.innerHTML = (place.photos && place.photos.length)
      ? place.photos.map(ph => `<img src="${ph.file_path}" alt="${escapeHtml(ph.caption || place.name)}" data-full="${ph.file_path}" data-caption="${escapeHtml(ph.caption || place.name)}">`).join('')
      : '<p class="empty-note">Photos from this performance will be added soon.</p>';
    $$('img', photoGrid).forEach(img => img.addEventListener('click', () => openLightbox(img.dataset.full, img.dataset.caption, 'image')));
    $('#place-modal').classList.add('open');
  }
  $('#place-modal-close').addEventListener('click', () => $('#place-modal').classList.remove('open'));
  $('#place-modal').addEventListener('click', (e) => { if (e.target.id === 'place-modal') $('#place-modal').classList.remove('open'); });

  // ---------------------------------------------------------------------
  // Simple card sections: branches, blogs, footprints, festivals, faculty, awards
  // ---------------------------------------------------------------------
  function cardHtml(item, { eyebrow, titleField = 'title', bodyField = 'description', metaField }) {
    const meta = metaField ? item[metaField] : '';
    return `
      <div class="card">
        ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item[titleField] || '')}">` : ''}
        <div class="card-body">
          ${eyebrow || meta ? `<p class="card-eyebrow">${escapeHtml(meta || eyebrow || '')}</p>` : ''}
          <h3>${escapeHtml(item[titleField] || '')}</h3>
          <p>${escapeHtml(item[bodyField] || '')}</p>
        </div>
      </div>
    `;
  }

  async function loadSimpleList(endpoint, gridId, opts, emptyMsg) {
    const res = await fetch(`${API}/${endpoint}`);
    const items = await res.json();
    const grid = $('#' + gridId);
    grid.innerHTML = items.length ? items.map(i => cardHtml(i, opts)).join('') : `<p class="empty-note">${emptyMsg}</p>`;
    return items;
  }

  async function loadBranches() {
    await loadSimpleList('branches', 'branches-grid',
      { titleField: 'name', bodyField: 'description', metaField: 'address' },
      'Branches will be listed here.');
  }
  async function loadBlogs() {
    await loadSimpleList('blogs', 'blogs-grid',
      { titleField: 'title', bodyField: 'content', metaField: 'author' },
      'Blog posts will appear here.');
  }
  async function loadFootprints() {
    await loadSimpleList('footprints', 'footprints-grid',
      { titleField: 'title', bodyField: 'description', metaField: 'year' },
      'Milestones will appear here.');
  }
  async function loadFestivals() {
    await loadSimpleList('festivals', 'festivals-grid',
      { titleField: 'title', bodyField: 'description', metaField: 'festival_date' },
      'Festival highlights will appear here.');
  }
  async function loadAwards() {
    await loadSimpleList('awards', 'awards-grid',
      { titleField: 'title', bodyField: 'description', metaField: 'award_year' },
      'Awards will be listed here.');
  }
  async function loadFaculty() {
    const res = await fetch(`${API}/faculty`);
    const items = await res.json();
    const grid = $('#faculty-grid');
    grid.innerHTML = items.length ? items.map(f => `
      <div class="faculty-card">
        ${f.image ? `<img src="${f.image}" alt="${escapeHtml(f.name)}">` : ''}
        <h3>${escapeHtml(f.name)}</h3>
        <p class="faculty-role">${escapeHtml(f.role || '')}</p>
        <p>${escapeHtml(f.bio || '')}</p>
      </div>
    `).join('') : '<p class="empty-note">Faculty profiles will appear here.</p>';
  }

  // ---------------------------------------------------------------------
  // Glories of NK's — tabbed masonry gallery + lightbox
  // ---------------------------------------------------------------------
  let currentCategory = 'photo';

  async function loadGallery(category) {
    const res = await fetch(`${API}/gallery?category=${encodeURIComponent(category)}`);
    const items = await res.json();
    const wrap = $('#gallery-masonry');
    wrap.innerHTML = items.length ? items.map(item => `
      <div class="masonry-item" data-full="${item.file_path}" data-caption="${escapeHtml(item.caption || item.title || '')}" data-type="${item.media_type}">
        ${item.media_type === 'video'
          ? `<video src="${item.file_path}" muted playsinline></video><span class="video-badge">Video</span>`
          : `<img src="${item.file_path}" alt="${escapeHtml(item.title || '')}" loading="lazy">`}
        ${(item.title || item.caption) ? `<div class="masonry-caption">${escapeHtml(item.title || '')}${item.title && item.caption ? ' — ' : ''}${escapeHtml(item.caption || '')}</div>` : ''}
      </div>
    `).join('') : '<p class="empty-note">Nothing uploaded to this category yet.</p>';

    $$('.masonry-item', wrap).forEach(el => {
      el.addEventListener('click', () => openLightbox(el.dataset.full, el.dataset.caption, el.dataset.type));
    });
  }

  $$('.gallery-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.gallery-tab').forEach(t => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      currentCategory = tab.dataset.category;
      loadGallery(currentCategory);
    });
  });

  function openLightbox(src, caption, type) {
    const inner = $('#lightbox-inner');
    inner.innerHTML = (type === 'video')
      ? `<video src="${src}" controls autoplay></video>`
      : `<img src="${src}" alt="${escapeHtml(caption || '')}">`;
    if (caption) inner.innerHTML += `<p class="lightbox-caption">${escapeHtml(caption)}</p>`;
    $('#lightbox').classList.add('open');
  }
  $('#lightbox-close').addEventListener('click', closeLightbox);
  $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeLightbox(); $('#place-modal').classList.remove('open'); } });
  function closeLightbox() {
    $('#lightbox').classList.remove('open');
    $('#lightbox-inner').innerHTML = '';
  }

  // ---------------------------------------------------------------------
  // Contact form
  // ---------------------------------------------------------------------
  $('#contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#contact-status');
    const payload = {
      name: $('#cf-name').value.trim(),
      phone: $('#cf-phone').value.trim(),
      message: $('#cf-message').value.trim()
    };
    status.textContent = 'Sending…';
    try {
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      status.textContent = 'Thank you — we will be in touch soon.';
      status.style.color = 'var(--teal)';
      e.target.reset();
    } catch {
      status.textContent = 'Something went wrong. Please try again.';
      status.style.color = 'var(--vermilion)';
    }
  });

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  window.nkReloadPublicData = function () {
    loadSettings();
    loadPerformances();
    loadBranches();
    loadBlogs();
    loadFootprints();
    loadFestivals();
    loadAwards();
    loadFaculty();
    loadGallery(currentCategory);
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.nkReloadPublicData();
  });
})();
