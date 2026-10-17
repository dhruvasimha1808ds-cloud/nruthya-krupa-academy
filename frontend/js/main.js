(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------
  const BACKEND_ORIGIN = 'https://nruthya-krupa-academy.onrender.com';
  const API = `${BACKEND_ORIGIN}/api`;

  // ---------------------------------------------------------------------
  // Tiny DOM helpers
  // ---------------------------------------------------------------------
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const escapeHtml = (str) => (str == null ? '' : String(str)).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const escapeAttr = (str) => escapeHtml(str);

  /**
   * mediaUrl(path)
   * Converts any backend media reference into a safe, absolute URL.
   *
   *  - '' / null / undefined  -> ''
   *  - 'http://...' or 'https://...' -> returned unchanged
   *  - 'data:...' or 'blob:...' -> returned unchanged
   *  - '/uploads/x.jpg' -> 'https://.../uploads/x.jpg'
   *  - 'uploads/x.jpg'  -> 'https://.../uploads/x.jpg'
   *  - already-prefixed backend URL -> returned unchanged (no double prefix)
   */
  function mediaUrl(path) {
    if (path === null || path === undefined) return '';
    const p = String(path).trim();
    if (!p) return '';
    if (/^(https?:)?\/\//i.test(p)) return p;
    if (/^(data:|blob:)/i.test(p)) return p;
    // Already includes backend origin somewhere (defensive)
    if (p.indexOf(BACKEND_ORIGIN) === 0) return p;
    const clean = p.replace(/^\/+/, '');
    return `${BACKEND_ORIGIN}/${clean}`;
  }

  /**
   * safeFetchJson(url, options)
   * Wraps fetch so one broken endpoint cannot kill the whole page.
   */
  async function safeFetchJson(url, options) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[nk] Request failed:', url, err);
      return null;
    }
  }

  /**
   * Attach a one-time error fallback so one broken image never breaks layout.
   */
  function attachImageFallbacks(root) {
    $$('img', root || document).forEach(img => {
      if (img.dataset.nkErrorBound === '1') return;
      img.dataset.nkErrorBound = '1';
      img.addEventListener('error', () => {
        img.style.display = 'none';
      }, { once: true });
    });
  }

  // ---------------------------------------------------------------------
  // Mobile nav toggle
  // ---------------------------------------------------------------------
  const navToggle = $('#nav-toggle');
  const navLinks = $('#nav-links');
  if (navToggle && navLinks) {
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
    const s = await safeFetchJson(`${API}/settings`);
    if (!s || typeof s !== 'object') return;

    const setText = (id, key) => {
      const el = $('#' + id);
      if (el && s[key] !== undefined && s[key] !== null) el.textContent = s[key];
    };

    const setSrc = (id, key) => {
      const el = $('#' + id);
      if (!el) return;
      const url = mediaUrl(s[key]);
      if (url) el.src = url;
    };

    // Text fields
    ['nav-academy-name', 'hero-academy-name', 'footer-academy-name'].forEach(id => setText(id, 'academy_name'));
    setText('hero-quote-text', 'hero_quote');
    setText('hero-quote-author', 'hero_quote_author');
    setText('hero-mission', 'mission_statement');
    setText('about-text', 'about_text');
    setText('heritage-text', 'heritage_text');
    setText('guru-name-en', 'guru_name_en');
    setText('guru-name-kn', 'guru_name_kn');
    setText('footer-guru-name', 'guru_name_en');
    setText('kseeb-junior-count', 'kseeb_junior_count');
    setText('kseeb-senior-count', 'kseeb_senior_count');
    setText('seva-text', 'seva_text');
    setText('gratitude-text', 'gratitude_text');
    setText('scholarship-title', 'scholarship_title');
    setText('scholarship-content', 'scholarship_content');
    setText('visit-address', 'address');
    setText('contact-phone', 'contact_phone');
    setText('contact-whatsapp', 'contact_whatsapp');
    setText('contact-email', 'contact_email');

    // Image sources (via mediaUrl so relative paths work)
    setSrc('guru-portrait-img', 'guru_portrait');
    setSrc('scholarship-image', 'scholarship_image');

    // Logo (nav + footer)
    ['nav-logo', 'footer-logo'].forEach(id => {
      const el = $('#' + id);
      if (!el) return;
      const logoUrl = mediaUrl(s.site_logo);
      if (logoUrl) {
        el.src = logoUrl;
        el.classList.add('has-logo');
      } else {
        el.classList.remove('has-logo');
      }
    });

    // Hero background image
    const heroEl = $('.hero');
    if (heroEl) {
      const heroUrl = mediaUrl(s.hero_image);
      if (heroUrl) {
        heroEl.style.backgroundImage = `url('${heroUrl}')`;
      }
    }

    // Site-wide background color + image
    if (s.background_color) {
      document.body.style.setProperty('--site-bg-color', s.background_color);
    }
    const siteBgUrl = mediaUrl(s.site_background);
    document.body.style.setProperty(
      '--site-bg-image',
      siteBgUrl ? `url('${siteBgUrl}')` : 'none'
    );

    // Map
    if (s.map_lat && s.map_lng) {
      const lat = parseFloat(s.map_lat);
      const lng = parseFloat(s.map_lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const d = 0.01;
        const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
        const mapIframe = $('#map-iframe');
        if (mapIframe) {
          mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
        }
      }
    }

    window.__nkSettings = s; // cache for admin.js
    attachImageFallbacks();
  }

  // ---------------------------------------------------------------------
  // Performances Across India — clickable places -> modal with photos
  // ---------------------------------------------------------------------
  async function loadPerformances() {
    const places = await safeFetchJson(`${API}/performance`);
    const grid = $('#places-grid');
    if (!grid) return;

    const list = Array.isArray(places) ? places : [];
    window.__nkPlaces = list;

    grid.innerHTML = list.length
      ? list.map(p => `
          <button class="place-chip" data-place-id="${escapeAttr(p.id)}">
            ${escapeHtml(p.name)}
            ${p.note ? `<span class="place-note">${escapeHtml(p.note)}</span>` : ''}
          </button>
        `).join('')
      : '<p class="empty-note">Performance places will appear here.</p>';

    $$('.place-chip', grid).forEach(btn => {
      btn.addEventListener('click', () => openPlaceModal(Number(btn.dataset.placeId)));
    });
  }

  function openPlaceModal(placeId) {
    const place = (window.__nkPlaces || []).find(p => p.id === placeId);
    if (!place) return;

    const titleEl = $('#place-modal-title');
    const noteEl = $('#place-modal-note');
    const photoGrid = $('#place-modal-photos');
    const modal = $('#place-modal');
    if (!titleEl || !noteEl || !photoGrid || !modal) return;

    titleEl.textContent = place.name || '';
    noteEl.textContent = place.note || '';

    const photos = Array.isArray(place.photos) ? place.photos : [];
    photoGrid.innerHTML = photos.length
      ? photos.map(ph => {
          const src = mediaUrl(ph.file_path);
          const caption = ph.caption || place.name || '';
          return `<img src="${escapeAttr(src)}" alt="${escapeAttr(caption)}" data-full="${escapeAttr(src)}" data-caption="${escapeAttr(caption)}" loading="lazy">`;
        }).join('')
      : '<p class="empty-note">Photos from this performance will be added soon.</p>';

    attachImageFallbacks(photoGrid);

    $$('img', photoGrid).forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.full, img.dataset.caption, 'image'));
    });

    modal.classList.add('open');
  }

  const placeModalClose = $('#place-modal-close');
  if (placeModalClose) {
    placeModalClose.addEventListener('click', () => {
      const m = $('#place-modal');
      if (m) m.classList.remove('open');
    });
  }
  const placeModal = $('#place-modal');
  if (placeModal) {
    placeModal.addEventListener('click', (e) => {
      if (e.target.id === 'place-modal') placeModal.classList.remove('open');
    });
  }

  // ---------------------------------------------------------------------
  // Simple card sections: branches, blogs, footprints, festivals, faculty, awards
  // ---------------------------------------------------------------------
  function cardHtml(item, { eyebrow, titleField = 'title', bodyField = 'description', metaField }) {
    const meta = metaField ? item[metaField] : '';
    const imgUrl = mediaUrl(item.image);
    return `
      <div class="card">
        ${imgUrl ? `<img src="${escapeAttr(imgUrl)}" alt="${escapeAttr(item[titleField] || '')}" loading="lazy">` : ''}
        <div class="card-body">
          ${eyebrow || meta ? `<p class="card-eyebrow">${escapeHtml(meta || eyebrow || '')}</p>` : ''}
          <h3>${escapeHtml(item[titleField] || '')}</h3>
          <p>${escapeHtml(item[bodyField] || '')}</p>
        </div>
      </div>
    `;
  }

  async function loadSimpleList(endpoint, gridId, opts, emptyMsg) {
    const grid = $('#' + gridId);
    if (!grid) return [];

    const data = await safeFetchJson(`${API}/${endpoint}`);
    const items = Array.isArray(data) ? data : [];

    grid.innerHTML = items.length
      ? items.map(i => cardHtml(i, opts)).join('')
      : `<p class="empty-note">${escapeHtml(emptyMsg)}</p>`;

    attachImageFallbacks(grid);
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
    const grid = $('#faculty-grid');
    if (!grid) return;

    const data = await safeFetchJson(`${API}/faculty`);
    const items = Array.isArray(data) ? data : [];

    grid.innerHTML = items.length
      ? items.map(f => {
          const imgUrl = mediaUrl(f.image);
          return `
            <div class="faculty-card">
              ${imgUrl ? `<img src="${escapeAttr(imgUrl)}" alt="${escapeAttr(f.name || '')}" loading="lazy">` : ''}
              <h3>${escapeHtml(f.name || '')}</h3>
              <p class="faculty-role">${escapeHtml(f.role || '')}</p>
              <p>${escapeHtml(f.bio || '')}</p>
            </div>
          `;
        }).join('')
      : '<p class="empty-note">Faculty profiles will appear here.</p>';

    attachImageFallbacks(grid);
  }

  // ---------------------------------------------------------------------
  // Glories of NK's — tabbed masonry gallery + lightbox
  // ---------------------------------------------------------------------
  let currentCategory = 'photo';

  async function loadGallery(category) {
    const wrap = $('#gallery-masonry');
    if (!wrap) return;

    const data = await safeFetchJson(`${API}/gallery?category=${encodeURIComponent(category)}`);
    const items = Array.isArray(data) ? data : [];

    wrap.innerHTML = items.length
      ? items.map(item => {
          const src = mediaUrl(item.file_path);
          const caption = item.caption || item.title || '';
          const title = item.title || '';
          const isVideo = item.media_type === 'video';
          const media = isVideo
            ? `<video src="${escapeAttr(src)}" muted playsinline preload="metadata"></video>`
            : `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy">`;
          const captionBlock = (title || item.caption)
            ? `<div class="masonry-caption">${escapeHtml(title)}${title && item.caption ? ' — ' : ''}${escapeHtml(item.caption || '')}</div>`
            : '';
          return `
            <div class="masonry-item" data-full="${escapeAttr(src)}" data-caption="${escapeAttr(caption)}" data-type="${escapeAttr(item.media_type || 'image')}">
              ${media}
              ${captionBlock}
            </div>
          `;
        }).join('')
      : '<p class="empty-note">Nothing uploaded to this category yet.</p>';

    attachImageFallbacks(wrap);

    $$('.masonry-item', wrap).forEach(el => {
      el.addEventListener('click', () => openLightbox(el.dataset.full, el.dataset.caption, el.dataset.type));
    });
  }

  $$('.gallery-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.gallery-tab').forEach(t => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      currentCategory = tab.dataset.category || 'photo';
      loadGallery(currentCategory);
    });
  });

  function openLightbox(src, caption, type) {
    const lightbox = $('#lightbox');
    const inner = $('#lightbox-inner');
    if (!lightbox || !inner || !src) return;

    const safeSrc = escapeAttr(src);
    const safeCaption = escapeHtml(caption || '');

    const mediaHtml = (type === 'video')
      ? `<video src="${safeSrc}" controls autoplay playsinline></video>`
      : `<img src="${safeSrc}" alt="${escapeAttr(caption || '')}">`;

    inner.innerHTML = mediaHtml + (caption ? `<p class="lightbox-caption">${safeCaption}</p>` : '');
    lightbox.classList.add('open');
  }

  function closeLightbox() {
    const lightbox = $('#lightbox');
    const inner = $('#lightbox-inner');
    if (lightbox) lightbox.classList.remove('open');
    if (inner) inner.innerHTML = '';
  }

  const lightboxClose = $('#lightbox-close');
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

  const lightboxEl = $('#lightbox');
  if (lightboxEl) {
    lightboxEl.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      const m = $('#place-modal');
      if (m) m.classList.remove('open');
    }
  });

  // ---------------------------------------------------------------------
  // Contact form
  // ---------------------------------------------------------------------
  const contactForm = $('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = $('#contact-status');
      const nameEl = $('#cf-name');
      const phoneEl = $('#cf-phone');
      const messageEl = $('#cf-message');

      const payload = {
        name: nameEl ? nameEl.value.trim() : '',
        phone: phoneEl ? phoneEl.value.trim() : '',
        message: messageEl ? messageEl.value.trim() : ''
      };

      if (status) status.textContent = 'Sending…';

      try {
        const res = await fetch(`${API}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (status) {
          status.textContent = 'Thank you — we will be in touch soon.';
          status.style.color = 'var(--teal)';
        }
        e.target.reset();
      } catch (err) {
        console.warn('[nk] Contact submit failed:', err);
        if (status) {
          status.textContent = 'Something went wrong. Please try again.';
          status.style.color = 'var(--vermilion)';
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Expose helpers (admin.js and other scripts may use these)
  // ---------------------------------------------------------------------
  window.nkMediaUrl = mediaUrl;
  window.nkApiBase = API;
  window.nkBackendOrigin = BACKEND_ORIGIN;

  // ---------------------------------------------------------------------
  // Init — load all public data. Each loader is independent so one
  // failure cannot block the others.
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.nkReloadPublicData());
  } else {
    window.nkReloadPublicData();
  }
})();