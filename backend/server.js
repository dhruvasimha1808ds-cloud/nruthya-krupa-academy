require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const buildResourceRouter = require('./routes/resourceFactory');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Static files -----------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- API routes ---------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/contact', require('./routes/contact'));

// Simple content lists built from the generic resource factory
app.use('/api/branches', buildResourceRouter('branches', 'branches', ['name', 'address', 'phone', 'description']));
app.use('/api/blogs', buildResourceRouter('blogs', 'blogs', ['title', 'content', 'author', 'post_date']));
app.use('/api/footprints', buildResourceRouter('footprints', 'footprints', ['year', 'title', 'description']));
app.use('/api/festivals', buildResourceRouter('festivals', 'festivals', ['title', 'description', 'festival_date']));
app.use('/api/faculty', buildResourceRouter('faculty', 'faculty', ['name', 'role', 'bio']));
app.use('/api/awards', buildResourceRouter('awards', 'awards', ['title', 'description', 'award_year']));

// --- Fallback: serve the single-page site for any other GET route ------
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Error handler (multer errors, etc.) --------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Nruthyakrupa Academy server running on http://localhost:${PORT}`);
});
