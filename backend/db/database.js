const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'nk_academy.db');
const isFirstRun = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema (idempotent — CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

function seedIfEmpty() {
  // --- Admin user -----------------------------------------------------
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme123';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log('----------------------------------------------------------');
    console.log('Created default admin account.');
    console.log('  username:', username);
    console.log('  password:', password);
    console.log('CHANGE THIS PASSWORD after first login (see /api/auth/change-password).');
    console.log('----------------------------------------------------------');
  }

  // --- Site settings (key/value) --------------------------------------
  const defaults = {
    site_logo: '/assets/placeholders/logo-placeholder.svg',
    background_color: '#FBF5E9',
    site_background: '/assets/placeholders/bg-default.svg',
    hero_image: '/assets/placeholders/nataraja-placeholder.svg',
    guru_portrait: '/assets/placeholders/guru-portrait-placeholder.svg',
    guru_name_en: 'Srimati Vidushi Chandana Mohan',
    guru_name_kn: 'ಶ್ರೀಮತಿ ವಿದುಷಿ ಚಂದನ ಮೋಹನ್',
    academy_name: "Nruthyakrupa Academy of Performing Arts",
    academy_name_kn: 'ನೃತ್ಯಕೃಪ ಕಲಾ ಶಾಲೆ',
    mission_statement: 'A home in Mandya where Bharatanatyam is learned as discipline, devotion, and art.',
    hero_quote: 'Art is not merely for entertainment, but for the evolution of the soul.',
    hero_quote_author: 'Swami Vivekananda',
    about_text: 'For ten years, Nurty Krupa Kala Shale has stood in Mandya as a place where Bharatanatyam is taught not as performance alone, but as a path of artistic excellence, self-discovery, and spiritual growth. Under the guidance of Guru Srimati Vidushi Chandana Mohan, generations of students have learned to carry this ancient art with sincerity and discipline.',
    heritage_text: 'Bharatanatyam is regarded as the oldest of India\'s classical dance forms — often called the mother of all classical dances. Its roots reach into the temples of Tamil Nadu more than two thousand years ago, and its codified grammar traces back to the Natya Shastra. Tradition holds that the art was first danced by Lord Shiva as Nataraja, and that Lord Brahma revealed its principles to the sage Bharata. Every student begins with the aramandi, the half-seated stance that grounds the entire vocabulary of movement, and learns to speak through mudras — hand gestures with precise meaning. The traditional attire, a pleated silk saree, temple jewelry, ghungroo at the ankles, and expressive eye makeup, is worn not as costume but as an offering of respect to the form.',
    kseab_junior_count: '20+',
    kseab_senior_count: '6',
    seva_text: 'Beyond the dance, Nurty Krupa Kala Shale organizes annual blood donation and eye donation awareness camps, carrying the values of compassion and service that Bharatanatyam itself teaches.',
    gratitude_text: 'We remain grateful to our Gurus, to the parents who bring their children to this art with trust, to our well-wishers, and to the extended Nurty Krupa family. Your support carries this tradition forward, year after year.',
    address: 'Mandya, Karnataka, India',
    map_lat: '12.51804',
    map_lng: '76.89895',
    contact_phone: 'Coming soon',
    contact_whatsapp: 'Coming soon',
    contact_email: 'Coming soon',
    scholarship_title: 'GOVINDA BAGYA NIDHI',
    scholarship_content: 'Govinda Bagya Nidhi is Nurty Krupa Kala Shale\'s scholarship initiative, created to support deserving students in continuing their Bharatanatyam education. Details of eligibility and how to apply will be published here soon.',
    scholarship_image: '/assets/placeholders/scholarship-placeholder.svg'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((entries) => {
    for (const [k, v] of entries) insertSetting.run(k, v);
  });
  insertMany(Object.entries(defaults));

  // --- A handful of starter performance places (empty photo sets) ----
  const placeCount = db.prepare('SELECT COUNT(*) AS c FROM performance_places').get().c;
  if (placeCount === 0) {
    const places = ['Shirasi', 'Belagavi', 'Goa', 'Kolkata', 'Kannur', 'Tirupati', 'Melukote', 'Delhi', 'Ayodhya', 'Kashi'];
    const insertPlace = db.prepare('INSERT INTO performance_places (name, sort_order) VALUES (?, ?)');
    places.forEach((name, i) => insertPlace.run(name, i));
  }
}

seedIfEmpty();

if (isFirstRun) {
  console.log('New database created at', DB_PATH);
}

module.exports = db;
