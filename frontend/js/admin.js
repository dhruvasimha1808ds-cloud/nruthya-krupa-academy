(function () {
  'use strict';

  const API = "https://nruthya-krupa-academy.onrender.com/api";
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const escapeHtml = (str) => (str || '').toString().replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const TOKEN_KEY = 'nk_admin_token';
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);
  const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

  function toast(msg, isError) {
    const el = $('#admin-toast');
    el.textContent = msg;
    el.style.borderLeftColor = isError ? 'var(--vermilion)' : 'var(--gold)';
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, options);
    if (res.status === 401) {
      clearToken();
      closeAdminPanel();
      openLoginOverlay();
      toast('Session expired — please log in again.', true);
      throw new Error('unauthorized');
    }
    if (!res.ok) {
      let msg = 'Request failed.';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  // ---------------------------------------------------------------------
  // Login / logout / panel open-close
  // ---------------------------------------------------------------------
  function openLoginOverlay() { $('#admin-login-overlay').classList.add('open'); }
  function closeLoginOverlay() {
    $('#admin-login-overlay').classList.remove('open');
    $('#admin-login-error').textContent = '';
    $('#admin-login-form').reset();
  }
  function openAdminPanel() {
    $('#admin-panel').classList.add('open');
    document.body.style.overflow = 'hidden';
    loadAllAdminData();
  }
  function closeAdminPanel() {
    $('#admin-panel').classList.remove('open');
    document.body.style.overflow = '';
  }

  $('#open-admin-login').addEventListener('click', () => {
    if (getToken()) { openAdminPanel(); } else { openLoginOverlay(); }
  });
  $('#admin-login-cancel').addEventListener('click', closeLoginOverlay);
  $('#admin-login-overlay').addEventListener('click', (e) => { if (e.target.id === 'admin-login-overlay') closeLoginOverlay(); });

  $('#admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#admin-username').value.trim();
    const password = $('#admin-password').value;
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      setToken(data.token);
      closeLoginOverlay();
      openAdminPanel();
    } catch (err) {
      $('#admin-login-error').textContent = err.message;
    }
  });

  $('#admin-logout').addEventListener('click', () => {
    clearToken();
    closeAdminPanel();
    toast('Logged out.');
  });
  $('#admin-view-site').addEventListener('click', closeAdminPanel);

  // ---------------------------------------------------------------------
  // Admin nav tabs
  // ---------------------------------------------------------------------
  $$('#admin-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#admin-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.admin-section').forEach(s => s.classList.remove('active'));
      $('#admin-' + btn.dataset.tab).classList.add('active');
    });
  });

  function loadAllAdminData() {
    renderSettingsForm();
    renderGalleryAdmin();
    renderPerformanceAdmin();
    SIMPLE_RESOURCES.forEach(r => renderSimpleResourceAdmin(r));
    renderMessagesAdmin();
  }

  // ---------------------------------------------------------------------
  // SITE SETTINGS
  // ---------------------------------------------------------------------
  const TEXT_SETTING_GROUPS = [
    { key: 'academy_name', label: 'Academy name' },
    { key: 'mission_statement', label: 'Hero mission line' },
    { key: 'hero_quote', label: 'Hero quote' },
    { key: 'hero_quote_author', label: 'Hero quote author' },
    { key: 'guru_name_en', label: "Guru's name (English)" },
    { key: 'guru_name_kn', label: "Guru's name (Kannada)" },
    { key: 'about_text', label: 'About / Our Guru text', long: true },
    { key: 'heritage_text', label: 'Heritage of the Art Form text', long: true },
    { key: 'kseab_junior_count', label: 'KSEAB Junior Grade count' },
    { key: 'kseab_senior_count', label: 'KSEAB Senior Grade count' },
    { key: 'seva_text', label: 'Seva & Social Responsibility text', long: true },
    { key: 'gratitude_text', label: 'Gratitude note', long: true },
    { key: 'address', label: 'Address' },
    { key: 'map_lat', label: 'Map latitude' },
    { key: 'map_lng', label: 'Map longitude' },
    { key: 'contact_phone', label: 'Contact phone' },
    { key: 'contact_whatsapp', label: 'Contact WhatsApp' },
    { key: 'contact_email', label: 'Contact email' },
    { key: 'scholarship_title', label: 'Govinda Bagya Nidhi — page title' },
    { key: 'scholarship_content', label: 'Govinda Bagya Nidhi — content', long: true }
  ];
  const IMAGE_SETTINGS = [
    { key: 'site_logo', label: 'Academy logo (shown in header & footer)' },
    { key: 'site_background', label: 'Site-wide background pattern/texture' },
    { key: 'hero_image', label: 'Hero background (Nataraja photo)' },
    { key: 'guru_portrait', label: "Guru's portrait" },
    { key: 'scholarship_image', label: 'Govinda Bagya Nidhi image' }
  ];
  const COLOR_SETTINGS = [
    { key: 'background_color', label: 'Site background color' }
  ];

  async function renderSettingsForm() {
    const settings = await apiFetch('/settings');
    const wrap = $('#admin-settings-form');

    const textFields = TEXT_SETTING_GROUPS.map(f => `
      <div class="${f.long ? 'full' : ''}">
        <label>${escapeHtml(f.label)}</label>
        ${f.long
          ? `<textarea data-setting-key="${f.key}">${escapeHtml(settings[f.key] || '')}</textarea>`
          : `<input type="text" data-setting-key="${f.key}" value="${escapeHtml(settings[f.key] || '')}">`}
      </div>
    `).join('');

    wrap.innerHTML = `
      <form class="admin-form" id="settings-text-form">
        ${textFields}
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save Text Settings</button></div>
      </form>
      <h3>Background Color</h3>
      <p class="admin-note">Sets the page background behind every ivory section. Change it if the current tone isn't to your taste — it takes effect immediately.</p>
      <form class="admin-form" id="settings-color-form">
        ${COLOR_SETTINGS.map(c => `
          <div>
            <label>${escapeHtml(c.label)}</label>
            <input type="color" data-color-key="${c.key}" value="${(settings[c.key] || '#FBF5E9')}" style="height:44px;padding:2px;">
          </div>
        `).join('')}
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save Color</button></div>
      </form>
      <h3>Images</h3>
      <p class="admin-note">Site background pattern is a subtle repeating texture layered over the color above — upload a new one, or leave it to keep the current pattern.</p>
      <div class="admin-form">
        ${IMAGE_SETTINGS.map(img => `
          <div>
            <label>${escapeHtml(img.label)}</label>
            <img src="${settings[img.key] || ''}" alt="" style="width:100%;max-height:120px;object-fit:cover;margin-bottom:0.5rem;border:1px solid rgba(92,26,34,0.2);">
            <input type="file" data-image-key="${img.key}" accept="image/*">
          </div>
        `).join('')}
      </div>
    `;

    $('#settings-text-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {};
      $$('[data-setting-key]', wrap).forEach(el => { payload[el.dataset.settingKey] = el.value; });
      try {
        await apiFetch('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload)
        });
        toast('Site settings saved.');
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    });

    $('#settings-color-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {};
      $$('[data-color-key]', wrap).forEach(el => { payload[el.dataset.colorKey] = el.value; });
      try {
        await apiFetch('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload)
        });
        toast('Background color updated.');
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    });

    $$('[data-image-key]', wrap).forEach(input => {
      input.addEventListener('change', async () => {
        if (!input.files[0]) return;
        const fd = new FormData();
        fd.append('image', input.files[0]);
        try {
          await apiFetch(`/settings/image/${input.dataset.imageKey}`, {
            method: 'POST', headers: authHeaders(), body: fd
          });
          toast('Image updated.');
          renderSettingsForm();
          window.nkReloadPublicData();
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  // ---------------------------------------------------------------------
  // GLORIES OF NK'S — gallery admin
  // ---------------------------------------------------------------------
  $('#gallery-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    try {
      await apiFetch('/gallery', { method: 'POST', headers: authHeaders(), body: fd });
      toast('Uploaded to Glories of NK\'s.');
      form.reset();
      renderGalleryAdmin();
      window.nkReloadPublicData();
    } catch (err) { toast(err.message, true); }
  });

  const CATEGORY_LABELS = { photo: 'Photo', video: 'Video', gejje_pooje: 'Gejje Pooje', media: 'Media' };

  async function renderGalleryAdmin() {
    const items = await apiFetch('/gallery');
    const wrap = $('#gallery-admin-list');
    if (!items.length) { wrap.innerHTML = '<p class="admin-note">Nothing uploaded yet.</p>'; return; }

    wrap.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Preview</th><th>Category</th><th>Title</th><th>Caption</th><th>Order</th><th>Actions</th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr data-id="${item.id}">
              <td>${item.media_type === 'video' ? '🎬' : `<img src="${item.file_path}">`}</td>
              <td>
                <select data-field="category">
                  ${Object.entries(CATEGORY_LABELS).map(([v, l]) => `<option value="${v}" ${item.category === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </td>
              <td><input type="text" data-field="title" value="${escapeHtml(item.title)}"></td>
              <td><input type="text" data-field="caption" value="${escapeHtml(item.caption)}"></td>
              <td><input type="number" data-field="sort_order" value="${item.sort_order}" style="width:64px;"></td>
              <td class="row-actions">
                <button class="btn btn-small btn-ghost" data-action="save">Save</button>
                <button class="btn btn-small btn-danger" data-action="delete">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    $$('tr', wrap).forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const payload = {};
        $$('[data-field]', row).forEach(el => { payload[el.dataset.field] = el.value; });
        try {
          await apiFetch(`/gallery/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload)
          });
          toast('Saved.');
          window.nkReloadPublicData();
        } catch (err) { toast(err.message, true); }
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm('Delete this item?')) return;
        try {
          await apiFetch(`/gallery/${id}`, { method: 'DELETE', headers: authHeaders() });
          renderGalleryAdmin();
          window.nkReloadPublicData();
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  // ---------------------------------------------------------------------
  // PERFORMANCE PLACES — places + per-place photos
  // ---------------------------------------------------------------------
  $('#place-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = { name: form.name.value, note: form.note.value };
    try {
      await apiFetch('/performance/places', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload)
      });
      toast('Place added.');
      form.reset();
      renderPerformanceAdmin();
      window.nkReloadPublicData();
    } catch (err) { toast(err.message, true); }
  });

  async function renderPerformanceAdmin() {
    const places = await apiFetch('/performance');
    const wrap = $('#performance-admin-list');
    wrap.innerHTML = places.map(place => `
      <div class="card" style="margin-bottom:1.2rem;">
        <div class="card-body">
          <h3>${escapeHtml(place.name)} <button class="btn btn-small btn-danger" data-del-place="${place.id}" style="float:right;">Delete Place</button></h3>
          <input type="text" data-note-input="${place.id}" value="${escapeHtml(place.note || '')}" placeholder="Note" style="margin-bottom:0.6rem;width:60%;">
          <button class="btn btn-small btn-ghost" data-save-note="${place.id}">Save Note</button>
          <div class="place-photo-grid" style="margin-top:0.8rem;">
            ${(place.photos || []).map(ph => `
              <div style="position:relative;">
                <img src="${ph.file_path}" style="width:100%;height:110px;object-fit:cover;">
                <button class="btn btn-small btn-danger" data-del-photo="${ph.id}" style="position:absolute;top:2px;right:2px;padding:0.15rem 0.4rem;">×</button>
              </div>
            `).join('') || '<p class="empty-note">No photos yet.</p>'}
          </div>
          <form class="admin-form" data-photo-form="${place.id}" style="margin-top:0.8rem;">
            <div><label>Add photo</label><input type="file" name="file" required></div>
            <div><label>Caption</label><input type="text" name="caption"></div>
            <div class="form-actions"><button class="btn btn-small btn-primary" type="submit">Upload Photo</button></div>
          </form>
        </div>
      </div>
    `).join('') || '<p class="admin-note">No places yet — add one above.</p>';

    $$('[data-del-place]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this place and all its photos?')) return;
      try {
        await apiFetch(`/performance/places/${btn.dataset.delPlace}`, { method: 'DELETE', headers: authHeaders() });
        renderPerformanceAdmin();
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    }));

    $$('[data-save-note]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.dataset.saveNote;
      const note = $(`[data-note-input="${id}"]`, wrap).value;
      try {
        await apiFetch(`/performance/places/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ note })
        });
        toast('Note saved.');
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    }));

    $$('[data-del-photo]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this photo?')) return;
      try {
        await apiFetch(`/performance/photos/${btn.dataset.delPhoto}`, { method: 'DELETE', headers: authHeaders() });
        renderPerformanceAdmin();
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    }));

    $$('[data-photo-form]', wrap).forEach(form => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const placeId = form.dataset.photoForm;
      const fd = new FormData(form);
      try {
        await apiFetch(`/performance/places/${placeId}/photos`, { method: 'POST', headers: authHeaders(), body: fd });
        toast('Photo uploaded.');
        renderPerformanceAdmin();
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    }));
  }

  // ---------------------------------------------------------------------
  // Generic simple resources: branches, blogs, footprints, festivals, faculty, awards
  // ---------------------------------------------------------------------
  const SIMPLE_RESOURCES = [
    { name: 'branches', formId: 'branches-form', listId: 'branches-admin-list', titleField: 'name', metaField: 'phone', bodyField: 'description' },
    { name: 'blogs', formId: 'blogs-form', listId: 'blogs-admin-list', titleField: 'title', metaField: 'author', bodyField: 'content' },
    { name: 'footprints', formId: 'footprints-form', listId: 'footprints-admin-list', titleField: 'title', metaField: 'year', bodyField: 'description' },
    { name: 'festivals', formId: 'festivals-form', listId: 'festivals-admin-list', titleField: 'title', metaField: 'festival_date', bodyField: 'description' },
    { name: 'faculty', formId: 'faculty-form', listId: 'faculty-admin-list', titleField: 'name', metaField: 'role', bodyField: 'bio' },
    { name: 'awards', formId: 'awards-form', listId: 'awards-admin-list', titleField: 'title', metaField: 'award_year', bodyField: 'description' }
  ];

  SIMPLE_RESOURCES.forEach(res => {
    const form = $('#' + res.formId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const editingId = form.dataset.editingId;
      try {
        if (editingId) {
          await apiFetch(`/${res.name}/${editingId}`, { method: 'PUT', headers: authHeaders(), body: fd });
          toast('Updated.');
          delete form.dataset.editingId;
          form.querySelector('button[type="submit"]').textContent = form.querySelector('button[type="submit"]').textContent.replace('Update', 'Add');
        } else {
          await apiFetch(`/${res.name}`, { method: 'POST', headers: authHeaders(), body: fd });
          toast('Added.');
        }
        form.reset();
        renderSimpleResourceAdmin(res);
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    });
  });

  async function renderSimpleResourceAdmin(res) {
    const items = await apiFetch(`/${res.name}`);
    const wrap = $('#' + res.listId);
    if (!items.length) { wrap.innerHTML = '<p class="admin-note">Nothing added yet.</p>'; return; }

    wrap.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Image</th><th>${res.titleField}</th><th>${res.metaField}</th><th>Order</th><th>Actions</th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.image ? `<img src="${item.image}">` : '—'}</td>
              <td>${escapeHtml(item[res.titleField])}</td>
              <td>${escapeHtml(item[res.metaField] || '')}</td>
              <td>${item.sort_order}</td>
              <td class="row-actions">
                <button class="btn btn-small btn-ghost" data-edit="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-delete="${item.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    $$('[data-edit]', wrap).forEach(btn => btn.addEventListener('click', () => {
      const item = items.find(i => i.id === Number(btn.dataset.edit));
      const form = $('#' + res.formId);
      Object.keys(item).forEach(key => {
        const field = form.elements[key];
        if (field && field.type !== 'file') field.value = item[key] ?? '';
      });
      form.dataset.editingId = item.id;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn.textContent.includes('Update')) submitBtn.textContent = submitBtn.textContent.replace('Add', 'Update');
      form.scrollIntoView({ behavior: reduceMotionSafe() ? 'auto' : 'smooth' });
    }));

    $$('[data-delete]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this item?')) return;
      try {
        await apiFetch(`/${res.name}/${btn.dataset.delete}`, { method: 'DELETE', headers: authHeaders() });
        renderSimpleResourceAdmin(res);
        window.nkReloadPublicData();
      } catch (err) { toast(err.message, true); }
    }));
  }

  function reduceMotionSafe() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------------------------------------------------------------------
  // Contact enquiries
  // ---------------------------------------------------------------------
  async function renderMessagesAdmin() {
    let items;
    try {
      items = await apiFetch('/contact', { headers: authHeaders() });
    } catch (err) { return; }
    const wrap = $('#messages-admin-list');
    if (!items.length) { wrap.innerHTML = '<p class="admin-note">No enquiries yet.</p>'; return; }
    wrap.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Message</th><th>Received</th><th></th></tr></thead>
        <tbody>
          ${items.map(m => `
            <tr>
              <td>${escapeHtml(m.name)}</td>
              <td>${escapeHtml(m.phone)}</td>
              <td>${escapeHtml(m.message)}</td>
              <td>${escapeHtml(m.created_at)}</td>
              <td><button class="btn btn-small btn-danger" data-msg-del="${m.id}">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-msg-del]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      await apiFetch(`/contact/${btn.dataset.msgDel}`, { method: 'DELETE', headers: authHeaders() });
      renderMessagesAdmin();
    }));
  }

})();
