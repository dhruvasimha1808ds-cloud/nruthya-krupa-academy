-- Nruthyakrupa Academy — database schema
-- SQLite. Every editable section of the site maps to one table here.

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Free-form key/value store for site-wide, single-instance content:
-- site background, guru portrait, hero image, about text, heritage text,
-- KSEAB stats, seva text, gratitude note, address/map, contact placeholders,
-- Govinda Bhagya Nidhi scholarship page content.
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- "Glories of NK's" gallery. category = photo | video | gejje_pooje | media
CREATE TABLE IF NOT EXISTS gallery_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL CHECK (category IN ('photo','video','gejje_pooje','media')),
  title       TEXT,
  caption     TEXT,
  file_path   TEXT NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('image','video')),
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Performances Across India: city/venue, each with its own photo set
CREATE TABLE IF NOT EXISTS performance_places (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  note       TEXT,               -- e.g. "Ganesha Utsava, 2023"
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS performance_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id   INTEGER NOT NULL REFERENCES performance_places(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,
  caption    TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  image       TEXT,
  description TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blogs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  content    TEXT,
  image      TEXT,
  author     TEXT,
  post_date  TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS footprints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year        TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  image       TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS festivals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  description    TEXT,
  image          TEXT,
  festival_date  TEXT,
  sort_order     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faculty (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  role       TEXT,
  bio        TEXT,
  image      TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS awards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  image       TEXT,
  award_year  TEXT,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  phone      TEXT,
  message    TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
