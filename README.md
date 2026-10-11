# Nruthyakrupa Academy of Performing Arts — Website

Full-stack site for Nurty Krupa Kala Shale (Mandya, Karnataka): Node.js + Express
backend, SQLite database, and a single-page frontend with the entire admin
dashboard built into the same page.

## What's included

```
nk-academy/
  backend/            Express API + SQLite database
    server.js
    db/schema.sql      table definitions
    db/database.js     connects, creates tables, seeds default content
    routes/            one file per API area (auth, settings, gallery,
                        performance, contact) + a shared factory for the
                        simple content lists (branches, blogs, footprints,
                        festivals, faculty, awards)
    middleware/         JWT auth guard + file upload handling
    uploads/            uploaded images/videos are stored here on disk
  frontend/
    index.html          every section of the site, in the order in the brief,
                         plus the admin dashboard markup (hidden until login)
    css/style.css        the temple-courtyard design system
    js/main.js            fetches content from the API and renders the page
    js/admin.js            the admin dashboard logic
    assets/placeholders/  placeholder art — swap these for your real photos
```

## Running it locally

Requires Node.js 18+.

```bash
cd backend
cp .env.example .env      # then edit ADMIN_USERNAME / ADMIN_PASSWORD / JWT_SECRET
npm install
npm start
```

Visit **http://localhost:4000** — the frontend and API are served from the
same Express app, so there's nothing else to configure. The first time it
runs, it creates `backend/db/nk_academy.db` and prints the admin login to the
console (also whatever you put in `.env`).

## Using the admin dashboard

Scroll to the footer of the site and click **Admin** (small, deliberately
understated link, bottom-right of the footer). Log in with the credentials
from your `.env` file. From there you can edit, in order:

- **Site Settings** — academy name, hero quote, About/Heritage/Seva/Gratitude
  text, KSEAB stats, address & map coordinates, contact placeholders, the
  Govinda Bagya Nidhi text, and every image (site background, hero photo,
  guru's portrait, scholarship image).
- **Glories of NK's** — upload photos/videos/gejje pooje/media, edit
  captions and category, delete.
- **Performance Places** — add cities, and per city, upload the photos that
  appear when a visitor clicks that place on the public site.
- **Branches, Blogs, Footprints, Festivals, Faculty, Awards** — each is a
  simple add/edit/delete list with an image and a couple of text fields.
- **Enquiries** — messages sent through the "Visit Us" contact form.

Changing your password: `POST /api/auth/change-password` with your current
and new password and your login token — there's no UI button for this yet by
design (it's a rare action); ask me to add one if you'd like it in the panel.

## Deploying for real

1. Put the whole `backend/` folder (which also serves `frontend/`) on a
   Node-capable host — Render, Railway, a VPS, etc. Anything that can run
   `npm install && npm start` and gives you a persistent disk works, since
   SQLite and uploaded files both live on disk (`backend/db/` and
   `backend/uploads/`).
2. Set real environment variables — especially `JWT_SECRET`,
   `ADMIN_USERNAME`, and `ADMIN_PASSWORD` — before the first run creates the
   admin account. Change the password from the default immediately.
3. Point your domain at the host, ideally with HTTPS (most hosts do this for
   you). The site itself doesn't need a build step — it's plain HTML/CSS/JS.
4. Back up `backend/db/nk_academy.db` and `backend/uploads/` regularly —
   that's your entire content and media library.

## Replacing placeholder images

Everything under `frontend/assets/placeholders/` is a stand-in. Once you're
logged into the admin dashboard, go to **Site Settings** and use the file
inputs under "Images" to replace the background, hero (Nataraja) photo, and
guru's portrait directly — no code changes needed. Gallery, branch, blog,
footprint, festival, faculty, and award photos are uploaded the same way from
their own sections.

## Notes on what's deliberately simple

- Only one admin account is supported (this matches "an admin dashboard I
  can access" in the brief). Ask if you'd like multiple admin logins.
- The map on "Visit Us" uses OpenStreetMap's embeddable view (no API key
  needed) centered on the coordinates from Site Settings.
- Video files upload up to 200MB by default — adjust `maxSizeMB` in
  `backend/routes/gallery.js` if you need more.
