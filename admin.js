/**
 * Signature Cleans - Admin Panel Module
 * Full CMS: Blog posts, Page SEO, Head tags, Media library, Submissions
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

module.exports = function createAdminRouter(db) {
  const router = express.Router();

  // ============================================
  // DATABASE TABLES
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      read_time TEXT DEFAULT '5 min read',
      featured_image TEXT,
      meta_title TEXT,
      meta_description TEXT,
      published INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS head_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_path TEXT DEFAULT '*',
      tag_content TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed Google verification tag if not already present
  const existingVerification = db.prepare("SELECT id FROM head_tags WHERE tag_content LIKE '%google-site-verification%'").get();
  if (!existingVerification) {
    db.prepare('INSERT INTO head_tags (page_path, tag_content, description) VALUES (?, ?, ?)')
      .run('*', '<meta name="google-site-verification" content="8GQwdJk6Da8WsIvubmz-QXZ9eUUvukBImNBdgwdPsOjQ" />', 'Google Search Console verification');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS page_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_path TEXT UNIQUE NOT NULL,
      meta_title TEXT,
      meta_description TEXT,
      og_title TEXT,
      og_description TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ============================================
  // SESSION MANAGEMENT
  // ============================================
  const sessions = new Map();

  function createSession() {
    const token = crypto.randomUUID();
    sessions.set(token, { created: Date.now() });
    // Clean old sessions (older than 24h)
    for (const [t, s] of sessions) {
      if (Date.now() - s.created > 86400000) sessions.delete(t);
    }
    return token;
  }

  function parseCookies(req) {
    const cookies = {};
    const header = req.headers.cookie;
    if (header) {
      header.split(';').forEach(c => {
        const parts = c.trim().split('=');
        if (parts.length >= 2) cookies[parts[0]] = decodeURIComponent(parts.slice(1).join('='));
      });
    }
    return cookies;
  }

  // ============================================
  // AUTH MIDDLEWARE
  // ============================================
  function requireAuth(req, res, next) {
    const cookies = parseCookies(req);
    const token = cookies.admin_session;
    if (token && sessions.has(token)) return next();
    return res.redirect('/admin/login');
  }

  // Override CSP for admin pages (allow Quill CDN)
  function adminCSP(req, res, next) {
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://cdn.quilljs.com https://fonts.googleapis.com; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.quilljs.com; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' https://fonts.gstatic.com https://cdn.quilljs.com data:;"
    );
    res.setHeader('Cache-Control', 'no-store');
    next();
  }

  router.use(adminCSP);

  // ============================================
  // FILE UPLOAD CONFIG
  // ============================================
  const uploadsDir = path.join(__dirname, 'public', 'images', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-').replace(ext, '');
        const unique = Date.now() + '-' + Math.round(Math.random() * 1000);
        cb(null, name + '-' + unique + ext);
      }
    });
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i;
      if (allowed.test(file.originalname)) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  });


  // ============================================
  // LAYOUT TEMPLATE
  // ============================================
  function layout(title, content, activeNav) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${title} - Admin | Signature Cleans</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f0f2f5; min-height: 100vh; display: flex; }
    .sidebar { width: 260px; background: #1a1a2e; color: white; min-height: 100vh; position: fixed; top: 0; left: 0; z-index: 100; display: flex; flex-direction: column; }
    .sidebar-brand { padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .sidebar-brand h2 { font-size: 18px; font-weight: 700; }
    .sidebar-brand span { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; }
    .sidebar-nav { padding: 16px 0; flex: 1; }
    .sidebar-nav a { display: flex; align-items: center; gap: 12px; padding: 12px 20px; color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; }
    .sidebar-nav a:hover { background: rgba(255,255,255,0.08); color: white; }
    .sidebar-nav a.active { background: rgba(37,99,235,0.2); color: #60a5fa; border-right: 3px solid #2563eb; }
    .sidebar-nav a svg { width: 20px; height: 20px; flex-shrink: 0; }
    .sidebar-nav .nav-section { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.3); padding: 20px 20px 8px; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1); }
    .sidebar-footer a { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 13px; }
    .sidebar-footer a:hover { color: white; }
    .main { margin-left: 260px; flex: 1; min-height: 100vh; }
    .topbar { background: white; padding: 16px 30px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .topbar h1 { font-size: 22px; font-weight: 700; color: #111827; }
    .topbar-actions { display: flex; gap: 10px; }
    .content { padding: 30px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 24px; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; }
    .card-header h3 { font-size: 16px; font-weight: 600; color: #111827; }
    .card-body { padding: 24px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all 0.2s; }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-success { background: #059669; color: white; }
    .btn-success:hover { background: #047857; }
    .btn-danger { background: #dc2626; color: white; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-outline { background: white; color: #374151; border: 1px solid #d1d5db; }
    .btn-outline:hover { background: #f9fafb; }
    .btn-sm { padding: 6px 12px; font-size: 13px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; transition: border-color 0.2s; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .form-group textarea { min-height: 120px; resize: vertical; }
    .form-group .help { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .stat-card .stat-value { font-size: 32px; font-weight: 700; color: #111827; }
    .stat-card .stat-label { font-size: 13px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    table th { background: #f9fafb; padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; vertical-align: middle; }
    table tr:hover { background: #f9fafb; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-purple { background: #f3e8ff; color: #6b21a8; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .alert { padding: 14px 20px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
    .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .alert-info { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .media-item { position: relative; border-radius: 8px; overflow: hidden; border: 2px solid #e5e7eb; transition: border-color 0.2s; cursor: pointer; }
    .media-item:hover { border-color: #2563eb; }
    .media-item img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .media-item .media-info { padding: 8px 10px; font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .media-item .media-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
    .media-item:hover .media-actions { opacity: 1; }
    .media-item .media-actions button { padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer; font-size: 11px; }
    .empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
    .empty-state svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }
    .empty-state h3 { font-size: 16px; color: #6b7280; margin-bottom: 8px; }
    .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .switch .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #d1d5db; border-radius: 24px; transition: 0.3s; }
    .switch .slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
    .switch input:checked + .slider { background: #2563eb; }
    .switch input:checked + .slider:before { transform: translateX(20px); }
    .pagination { display: flex; gap: 6px; justify-content: center; margin-top: 24px; }
    .pagination a { padding: 8px 14px; border-radius: 6px; text-decoration: none; color: #374151; background: white; border: 1px solid #d1d5db; font-size: 13px; }
    .pagination a.active { background: #2563eb; color: white; border-color: #2563eb; }
    #editor-container { height: 400px; background: white; }
    .ql-editor { min-height: 350px; font-size: 15px; line-height: 1.7; }
    .ql-toolbar { background: #f9fafb; border-bottom: 1px solid #d1d5db !important; }
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; }
      .form-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <h2>Signature Cleans</h2>
      <span>Admin Panel</span>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">Overview</div>
      <a href="/admin/dashboard" class="${activeNav === 'dashboard' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        Dashboard
      </a>
      <div class="nav-section">Content</div>
      <a href="/admin/content" class="${activeNav === 'content' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        Page Content
      </a>
      <a href="/admin/blog" class="${activeNav === 'blog' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
        Blog Posts
      </a>
      <a href="/admin/media" class="${activeNav === 'media' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        Media Library
      </a>
      <div class="nav-section">SEO</div>
      <a href="/admin/pages" class="${activeNav === 'pages' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Pages & SEO
      </a>
      <a href="/admin/head-tags" class="${activeNav === 'headtags' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
        Head Tags
      </a>
      <div class="nav-section">Data</div>
      <a href="/admin/submissions" class="${activeNav === 'submissions' ? 'active' : ''}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
        Submissions
      </a>
    </nav>
    <div class="sidebar-footer">
      <a href="/" target="_blank">View Site</a> &nbsp;|&nbsp; <a href="/admin/logout">Logout</a>
    </div>
  </aside>
  <div class="main">
    <div class="topbar">
      <h1>${title}</h1>
      <div class="topbar-actions" id="topbar-actions"></div>
    </div>
    <div class="content">
      ${content}
    </div>
  </div>
</body>
</html>`;
  }


  // ============================================
  // LOGIN / LOGOUT
  // ============================================
  router.get('/login', (req, res) => {
    const error = req.query.error ? 'Invalid password. Please try again.' : '';
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Admin Login - Signature Cleans</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-card { background: white; border-radius: 16px; padding: 40px; width: 400px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .login-card h1 { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .login-card p { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .btn { width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .error { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>Admin Panel</h1>
    <p>Signature Cleans Content Management</p>
    ${error ? '<div class="error">' + error + '</div>' : ''}
    <form method="POST" action="/admin/login">
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" placeholder="Enter admin password" required autofocus>
      </div>
      <button type="submit" class="btn">Sign In</button>
    </form>
  </div>
</body>
</html>`);
  });

  router.post('/login', (req, res) => {
    const adminPass = process.env.ADMIN_PASSWORD || 'signature2025';
    if (req.body.password === adminPass) {
      const token = createSession();
      res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/admin; Max-Age=86400; SameSite=Lax`);
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login?error=1');
  });

  router.get('/logout', (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.admin_session) sessions.delete(cookies.admin_session);
    res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Path=/admin; Max-Age=0');
    res.redirect('/admin/login');
  });

  // Redirect /admin to /admin/dashboard
  router.get('/', (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.admin_session && sessions.has(cookies.admin_session)) {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');
  });

  // ============================================
  // DASHBOARD
  // ============================================
  router.get('/dashboard', requireAuth, (req, res) => {
    const totalSubs = db.prepare('SELECT COUNT(*) as c FROM submissions').get().c;
    const quotes = db.prepare("SELECT COUNT(*) as c FROM submissions WHERE type='quote'").get().c;
    const contacts = db.prepare("SELECT COUNT(*) as c FROM submissions WHERE type='contact'").get().c;
    const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c;
    const publishedCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE published=1').get().c;
    const recentSubs = db.prepare('SELECT * FROM submissions ORDER BY createdAt DESC LIMIT 5').all();

    res.send(layout('Dashboard', `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalSubs}</div>
          <div class="stat-label">Total Submissions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${quotes}</div>
          <div class="stat-label">Quote Requests</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${contacts}</div>
          <div class="stat-label">Contact Messages</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${publishedCount}/${blogCount}</div>
          <div class="stat-label">Published Blog Posts</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Recent Submissions</h3>
          <a href="/admin/submissions" class="btn btn-outline btn-sm">View All</a>
        </div>
        ${recentSubs.length > 0 ? `<table>
          <thead><tr><th>Type</th><th>Date</th><th>Name</th><th>Email</th><th>Details</th></tr></thead>
          <tbody>
            ${recentSubs.map(s => `<tr>
              <td><span class="badge ${s.type === 'quote' ? 'badge-blue' : 'badge-purple'}">${s.type}</span></td>
              <td>${new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
              <td>${s.name}</td>
              <td><a href="mailto:${s.email}">${s.email}</a></td>
              <td>${s.serviceType || s.message?.substring(0, 50) || '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="card-body"><div class="empty-state"><h3>No submissions yet</h3></div></div>'}
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="card">
          <div class="card-header"><h3>Quick Actions</h3></div>
          <div class="card-body">
            <a href="/admin/content" class="btn btn-primary" style="margin-bottom:10px;display:block;text-align:center;">Edit Page Content</a>
            <a href="/admin/blog/new" class="btn btn-outline" style="margin-bottom:10px;display:block;text-align:center;">New Blog Post</a>
            <a href="/admin/media" class="btn btn-outline" style="margin-bottom:10px;display:block;text-align:center;">Upload Media</a>
            <a href="/admin/pages" class="btn btn-outline" style="display:block;text-align:center;">Edit Page SEO</a>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Help</h3></div>
          <div class="card-body" style="font-size:14px;color:#6b7280;line-height:1.8;">
            <p><strong>Page Content</strong> — Edit text and content on any page of the site</p>
            <p><strong>Blog Posts</strong> — Create and manage blog articles with images</p>
            <p><strong>Pages & SEO</strong> — Edit meta titles and descriptions for all pages</p>
            <p><strong>Head Tags</strong> — Add Google verification, analytics, or custom tags</p>
            <p><strong>Media Library</strong> — Upload and manage images for blog posts</p>
          </div>
        </div>
      </div>
    `, 'dashboard'));
  });


  // ============================================
  // BLOG POSTS - LIST
  // ============================================
  router.get('/blog', requireAuth, (req, res) => {
    const posts = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();

    res.send(layout('Blog Posts', `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <p style="color:#6b7280;">${posts.length} blog post${posts.length !== 1 ? 's' : ''}</p>
        <a href="/admin/blog/new" class="btn btn-primary">+ New Post</a>
      </div>

      ${posts.length > 0 ? `
      <div class="card">
        <table>
          <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${posts.map(p => `<tr>
              <td>
                <strong>${p.title}</strong>
                <div style="font-size:12px;color:#6b7280;">/${p.slug}</div>
              </td>
              <td><span class="badge badge-blue">${p.category}</span></td>
              <td><span class="badge ${p.published ? 'badge-green' : 'badge-yellow'}">${p.published ? 'Published' : 'Draft'}</span></td>
              <td>${new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td>
                <a href="/admin/blog/edit/${p.id}" class="btn btn-outline btn-sm">Edit</a>
                ${p.published ? '<a href="/blog/' + p.slug + '.html" target="_blank" class="btn btn-outline btn-sm">View</a>' : ''}
                <form method="POST" action="/admin/blog/delete/${p.id}" style="display:inline;" onsubmit="return confirm('Delete this post?')">
                  <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                </form>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="card">
        <div class="card-body">
          <div class="empty-state">
            <h3>No blog posts yet</h3>
            <p>Create your first blog post to get started.</p>
            <a href="/admin/blog/new" class="btn btn-primary" style="margin-top:16px;">Create Blog Post</a>
          </div>
        </div>
      </div>`}
    `, 'blog'));
  });

  // ============================================
  // BLOG POSTS - NEW / EDIT
  // ============================================
  function blogEditorPage(post, isNew, msg) {
    const p = post || { title: '', slug: '', excerpt: '', content: '', category: 'General', read_time: '5 min read', featured_image: '', meta_title: '', meta_description: '', published: 0, featured: 0 };

    return layout(isNew ? 'New Blog Post' : 'Edit Blog Post', `
      ${msg ? '<div class="alert alert-success">' + msg + '</div>' : ''}
      <form method="POST" action="/admin/blog/save${isNew ? '' : '/' + p.id}" enctype="multipart/form-data" id="blog-form">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;">
          <div>
            <div class="card">
              <div class="card-header"><h3>Content</h3></div>
              <div class="card-body">
                <div class="form-group">
                  <label>Title</label>
                  <input type="text" name="title" value="${(p.title || '').replace(/"/g, '&quot;')}" required placeholder="Post title" oninput="if(!document.getElementById('slug-edited').checked){document.getElementById('slug').value=this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}">
                </div>
                <div class="form-group">
                  <label>Content</label>
                  <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
                  <div id="editor-container">${p.content || ''}</div>
                  <input type="hidden" name="content" id="content-input">
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>SEO</h3></div>
              <div class="card-body">
                <div class="form-group">
                  <label>Meta Title <span style="font-weight:400;color:#9ca3af;">(leave blank to use post title)</span></label>
                  <input type="text" name="meta_title" value="${(p.meta_title || '').replace(/"/g, '&quot;')}" placeholder="Custom meta title for search engines">
                  <div class="help">Recommended: 50-60 characters</div>
                </div>
                <div class="form-group">
                  <label>Meta Description</label>
                  <textarea name="meta_description" rows="3" placeholder="Brief description for search results">${p.meta_description || ''}</textarea>
                  <div class="help">Recommended: 150-160 characters</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-header"><h3>Publish</h3></div>
              <div class="card-body">
                <div class="form-group">
                  <label style="display:flex;align-items:center;gap:10px;">
                    <span class="switch">
                      <input type="checkbox" name="published" value="1" ${p.published ? 'checked' : ''}>
                      <span class="slider"></span>
                    </span>
                    Published
                  </label>
                </div>
                <div class="form-group">
                  <label style="display:flex;align-items:center;gap:10px;">
                    <span class="switch">
                      <input type="checkbox" name="featured" value="1" ${p.featured ? 'checked' : ''}>
                      <span class="slider"></span>
                    </span>
                    Featured Post
                  </label>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">${isNew ? 'Create Post' : 'Save Changes'}</button>
                <a href="/admin/blog" class="btn btn-outline" style="width:100%;margin-top:8px;text-align:center;">Cancel</a>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>Details</h3></div>
              <div class="card-body">
                <div class="form-group">
                  <label>URL Slug</label>
                  <input type="text" name="slug" id="slug" value="${(p.slug || '').replace(/"/g, '&quot;')}" required placeholder="post-url-slug">
                  <label style="font-size:12px;color:#9ca3af;margin-top:4px;"><input type="checkbox" id="slug-edited"> Custom slug</label>
                </div>
                <div class="form-group">
                  <label>Category</label>
                  <select name="category">
                    ${['General', 'Operations', 'Sustainability', 'Process', 'Healthcare', 'Workplace', 'Service Guide', 'Sector Guide', 'Quality Management', 'Business Insight', 'Procurement Guide', 'Industry Guide', 'Accreditations'].map(c =>
                      '<option' + (p.category === c ? ' selected' : '') + '>' + c + '</option>'
                    ).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>Read Time</label>
                  <input type="text" name="read_time" value="${(p.read_time || '5 min read').replace(/"/g, '&quot;')}" placeholder="5 min read">
                </div>
                <div class="form-group">
                  <label>Excerpt</label>
                  <textarea name="excerpt" rows="3" placeholder="Brief summary for blog listing">${p.excerpt || ''}</textarea>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>Featured Image</h3></div>
              <div class="card-body">
                ${p.featured_image ? '<img src="' + p.featured_image + '" style="width:100%;border-radius:8px;margin-bottom:12px;" alt="Featured">' : ''}
                <div class="form-group">
                  <input type="file" name="featured_image" accept="image/*" style="font-size:13px;">
                  <div class="help">Or enter URL below:</div>
                  <input type="text" name="featured_image_url" value="${(p.featured_image || '').replace(/"/g, '&quot;')}" placeholder="/images/uploads/photo.jpg" style="margin-top:6px;">
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
      <script>
        var quill = new Quill('#editor-container', {
          theme: 'snow',
          modules: {
            toolbar: {
              container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['blockquote'],
                ['link', 'image'],
                ['clean']
              ],
              handlers: {
                image: function() {
                  var url = prompt('Enter image URL (upload images via Media Library first):');
                  if (url) {
                    var range = quill.getSelection(true);
                    quill.insertEmbed(range.index, 'image', url);
                  }
                }
              }
            }
          }
        });

        document.getElementById('blog-form').addEventListener('submit', function() {
          document.getElementById('content-input').value = quill.root.innerHTML;
        });

        // If slug already has value, check the custom slug box
        if (document.getElementById('slug').value) {
          document.getElementById('slug-edited').checked = true;
        }
      </script>
    `, 'blog');
  }

  router.get('/blog/new', requireAuth, (req, res) => {
    res.send(blogEditorPage(null, true, null));
  });

  router.get('/blog/edit/:id', requireAuth, (req, res) => {
    const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
    if (!post) return res.redirect('/admin/blog');
    const msg = req.query.saved === '1' ? 'Post saved successfully!' : null;
    res.send(blogEditorPage(post, false, msg));
  });


  // ============================================
  // BLOG POSTS - SAVE
  // ============================================
  const blogSaveHandler = (req, res) => {
    const id = req.params.id;
    const { title, slug, excerpt, content, category, read_time, meta_title, meta_description, featured_image_url } = req.body;
    const published = req.body.published ? 1 : 0;
    const featured = req.body.featured ? 1 : 0;

    // Handle featured image: uploaded file takes priority over URL
    let featuredImage = featured_image_url || '';
    if (req.file) {
      featuredImage = '/images/uploads/' + req.file.filename;
    }

    const cleanSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (id) {
      // Update existing
      db.prepare(`UPDATE blog_posts SET title=?, slug=?, excerpt=?, content=?, category=?, read_time=?, featured_image=?, meta_title=?, meta_description=?, published=?, featured=?, updated_at=datetime('now') WHERE id=?`)
        .run(title, cleanSlug, excerpt || '', content || '', category || 'General', read_time || '5 min read', featuredImage, meta_title || '', meta_description || '', published, featured, id);
    } else {
      // Insert new
      db.prepare(`INSERT INTO blog_posts (title, slug, excerpt, content, category, read_time, featured_image, meta_title, meta_description, published, featured) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(title, cleanSlug, excerpt || '', content || '', category || 'General', read_time || '5 min read', featuredImage, meta_title || '', meta_description || '', published, featured);
    }

    // Generate static HTML if published
    const post = db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(cleanSlug);
    if (post && post.published) {
      generateBlogPostHTML(post);
      regenerateBlogHub();
    } else if (post && !post.published) {
      // Remove HTML file if unpublished
      const filePath = path.join(__dirname, 'public', 'blog', cleanSlug + '.html');
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      regenerateBlogHub();
    }

    const savedId = id || db.prepare('SELECT id FROM blog_posts WHERE slug = ?').get(cleanSlug)?.id;
    res.redirect('/admin/blog/edit/' + savedId + '?saved=1');
  };

  router.post('/blog/save', requireAuth, upload.single('featured_image'), blogSaveHandler);
  router.post('/blog/save/:id', requireAuth, upload.single('featured_image'), blogSaveHandler);

  // ============================================
  // BLOG POSTS - DELETE
  // ============================================
  router.post('/blog/delete/:id', requireAuth, (req, res) => {
    const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
    if (post) {
      // Remove static HTML file
      const filePath = path.join(__dirname, 'public', 'blog', post.slug + '.html');
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
      regenerateBlogHub();
    }
    res.redirect('/admin/blog');
  });

  // ============================================
  // BLOG HTML GENERATOR
  // ============================================
  function generateBlogPostHTML(post) {
    const metaTitle = post.meta_title || post.title + ' | Signature Cleans';
    const metaDesc = post.meta_description || post.excerpt || '';
    const canonical = 'https://signature-cleans.co.uk/blog/' + post.slug + '.html';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="../favicon.ico">
    <link rel="apple-touch-icon" href="../apple-touch-icon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHTML(metaTitle)}</title>
    <meta name="description" content="${escHTML(metaDesc)}">
    <link rel="canonical" href="${canonical}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/styles.css">
    <link rel="stylesheet" href="../css/blog.css">
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","headline":"${escJSON(post.title)}","description":"${escJSON(metaDesc)}","author":{"@type":"Organization","name":"Signature Cleans"},"publisher":{"@type":"Organization","name":"Signature Cleans","logo":{"@type":"ImageObject","url":"https://signature-cleans.co.uk/images/logo.jpeg"}},"url":"${canonical}","mainEntityOfPage":"${canonical}"${post.featured_image ? ',"image":"https://signature-cleans.co.uk' + post.featured_image + '"' : ''}}
    </script>
</head>
<body>
    <!-- Navigation -->
    <nav class="nav" id="nav">
        <div class="nav-container">
            <a href="../index.html" class="nav-logo">
                <img src="../images/logo-cropped.png" alt="Signature Cleans" class="nav-logo-img">
            </a>
            <div class="nav-links" id="nav-links">
                <a href="../index.html#services">Services</a>
                <a href="../about.html">About</a>
                <a href="../blog.html">Blog</a>
                <a href="../contact.html">Contact</a>
                <a href="../quote.html" class="nav-cta">Get a Quote</a>
            </div>
            <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">
                <span></span>
                <span></span>
            </button>
        </div>
    </nav>

    <!-- Blog Post -->
    <article class="blog-post">
        <div class="container">
            <header class="post-header">
                <a href="../blog.html" class="post-back">&larr; Back to Blog</a>
                <span class="post-category">${escHTML(post.category)}</span>
                <h1>${escHTML(post.title)}</h1>
                <div class="post-meta">
                    <span>${escHTML(post.read_time)}</span>
                    <span>&bull;</span>
                    <span>${dateStr}</span>
                </div>
            </header>
            ${post.featured_image ? '<img src="' + post.featured_image + '" alt="' + escHTML(post.title) + '" style="width:100%;border-radius:12px;margin:20px 0;">' : ''}
            <div class="post-content">
                ${post.content}

                <div class="post-cta">
                    <h3>Ready for better cleaning?</h3>
                    <p>Signature Cleans provides tailored commercial cleaning across Exeter and Devon. Get in touch for a free, no-obligation quote.</p>
                    <a href="../quote.html" class="cta-button">Get a Quote</a>
                </div>
            </div>
        </div>
    </article>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <img src="../images/logo-cropped.png" alt="Signature Cleans" class="footer-logo-img">
                    <p class="footer-tagline">Peace of Mind, Every Time</p>
                    <p class="footer-contact">
                        <a href="tel:01392931035">01392 931035</a><br>
                        <a href="mailto:hello@signature-cleans.co.uk">hello@signature-cleans.co.uk</a>
                    </p>
                    <div class="footer-accreditations">
                        <span>SSIP Accredited</span>
                        <span>CQMS Verified</span>
                    </div>
                </div>
                <div class="footer-links">
                    <h4>Services</h4>
                    <a href="../services/contract-cleaning.html">Contract Cleaning</a>
                    <a href="../services/deep-cleaning.html">Deep Cleaning</a>
                    <a href="../services/specialist-services.html">Specialist Services</a>
                </div>
                <div class="footer-links">
                    <h4>Company</h4>
                    <a href="../about.html">About Us</a>
                    <a href="../blog.html">Blog</a>
                    <a href="../contact.html">Contact</a>
                    <a href="../quote.html">Get a Quote</a>
                </div>
                <div class="footer-links">
                    <h4>Areas</h4>
                    <a href="../areas/devon.html">Devon</a>
                    <a href="../areas/cornwall.html">Cornwall</a>
                    <a href="../areas/somerset.html">Somerset</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${now.getFullYear()} Signature Cleans. All rights reserved.</p>
                <div class="footer-legal">
                    <a href="../privacy.html">Privacy</a>
                    <a href="../cookies.html">Cookies</a>
                    <a href="../terms.html">Terms</a>
                </div>
                <div class="footer-social">
                    <a href="https://www.linkedin.com/company/100613310/" target="_blank" rel="noopener" aria-label="LinkedIn">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                    <a href="https://www.facebook.com/profile.php?id=61554538772884" target="_blank" rel="noopener" aria-label="Facebook">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                </div>
            </div>
        </div>
    </footer>

    <script src="../js/main.js"></script>
</body>
</html>`;

    const filePath = path.join(__dirname, 'public', 'blog', post.slug + '.html');
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log('✓ Blog HTML generated: ' + post.slug + '.html');
  }

  // HTML escaping helpers
  function escHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escJSON(str) {
    if (!str) return '';
    return String(str).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n');
  }


  // ============================================
  // BLOG HUB REGENERATOR
  // ============================================
  function regenerateBlogHub() {
    const posts = db.prepare('SELECT * FROM blog_posts WHERE published = 1 ORDER BY featured DESC, created_at DESC').all();

    // Also scan for existing static blog posts NOT in the database
    const blogDir = path.join(__dirname, 'public', 'blog');
    const staticFiles = fs.existsSync(blogDir) ? fs.readdirSync(blogDir).filter(f => f.endsWith('.html')) : [];
    const dbSlugs = new Set(posts.map(p => p.slug + '.html'));
    const unmanagedFiles = staticFiles.filter(f => !dbSlugs.has(f));

    // Parse unmanaged files for basic info
    const unmanagedPosts = unmanagedFiles.map(f => {
      try {
        const content = fs.readFileSync(path.join(blogDir, f), 'utf-8');
        const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
        const categoryMatch = content.match(/class="post-category">(.*?)<\//);
        const descMatch = content.match(/<meta name="description" content="(.*?)"/);
        const readMatch = content.match(/(\d+ min read)/);
        return {
          slug: f.replace('.html', ''),
          title: titleMatch ? titleMatch[1] : f.replace('.html', '').replace(/-/g, ' '),
          category: categoryMatch ? categoryMatch[1] : 'General',
          excerpt: descMatch ? descMatch[1] : '',
          read_time: readMatch ? readMatch[1] : '5 min read',
          featured: 0
        };
      } catch (e) { return null; }
    }).filter(Boolean);

    const allPosts = [...posts, ...unmanagedPosts];

    let postCards = '';
    allPosts.forEach((p, i) => {
      const isFeatured = i === 0 && (p.featured || allPosts.length === 1);
      postCards += `
                <article class="blog-card${isFeatured ? ' featured' : ''}">
                    <a href="blog/${p.slug}.html">
                        <div class="blog-content">
                            <span class="blog-category">${escHTML(p.category)}</span>
                            <${isFeatured ? 'h2' : 'h3'}>${escHTML(p.title)}</${isFeatured ? 'h2' : 'h3'}>
                            <p>${escHTML(p.excerpt || '')}</p>
                            <span class="blog-meta">${escHTML(p.read_time || '5 min read')}</span>
                        </div>
                    </a>
                </article>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog | Signature Cleans - Commercial Cleaning Insights</title>
    <meta name="description" content="Insights on commercial cleaning, facility management, and maintaining professional environments in Exeter and Devon.">
    <link rel="canonical" href="https://signature-cleans.co.uk/blog.html">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="css/blog.css">
</head>
<body>
    <!-- Navigation -->
    <nav class="nav" id="nav">
        <div class="nav-container">
            <a href="index.html" class="nav-logo">
                <img src="images/logo-cropped.png" alt="Signature Cleans" class="nav-logo-img">
            </a>
            <div class="nav-links" id="nav-links">
                <a href="index.html#services">Services</a>
                <a href="about.html">About</a>
                <a href="blog.html">Blog</a>
                <a href="contact.html">Contact</a>
                <a href="quote.html" class="nav-cta">Get a Quote</a>
            </div>
            <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">
                <span></span>
                <span></span>
            </button>
        </div>
    </nav>

    <!-- Blog Hero -->
    <section class="blog-hero">
        <div class="container">
            <h1>Insights</h1>
            <p>Practical advice on commercial cleaning and facility management</p>
        </div>
    </section>

    <!-- Blog Grid -->
    <section class="blog-section">
        <div class="container">
            <div class="blog-grid">
${postCards}
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
        <div class="container">
            <h2>Ready for better cleaning?</h2>
            <p>Get a tailored quote for your commercial space</p>
            <a href="quote.html" class="cta-button">Request a Quote</a>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <img src="images/logo-cropped.png" alt="Signature Cleans" class="footer-logo-img">
                    <p class="footer-tagline">Peace of Mind, Every Time</p>
                    <p class="footer-contact">
                        <a href="tel:01392931035">01392 931035</a><br>
                        <a href="mailto:hello@signature-cleans.co.uk">hello@signature-cleans.co.uk</a>
                    </p>
                    <div class="footer-accreditations">
                        <span>SSIP Accredited</span>
                        <span>CQMS Verified</span>
                    </div>
                </div>
                <div class="footer-links">
                    <h4>Services</h4>
                    <a href="services/contract-cleaning.html">Contract Cleaning</a>
                    <a href="services/deep-cleaning.html">Deep Cleaning</a>
                    <a href="services/specialist-services.html">Specialist Services</a>
                </div>
                <div class="footer-links">
                    <h4>Company</h4>
                    <a href="about.html">About Us</a>
                    <a href="blog.html">Blog</a>
                    <a href="contact.html">Contact</a>
                    <a href="quote.html">Get a Quote</a>
                </div>
                <div class="footer-links">
                    <h4>Areas</h4>
                    <a href="areas/devon.html">Devon</a>
                    <a href="areas/cornwall.html">Cornwall</a>
                    <a href="areas/somerset.html">Somerset</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} Signature Cleans. All rights reserved.</p>
                <div class="footer-legal">
                    <a href="privacy.html">Privacy</a>
                    <a href="cookies.html">Cookies</a>
                    <a href="terms.html">Terms</a>
                </div>
                <div class="footer-social">
                    <a href="https://www.linkedin.com/company/100613310/" target="_blank" rel="noopener" aria-label="LinkedIn">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                    <a href="https://www.facebook.com/profile.php?id=61554538772884" target="_blank" rel="noopener" aria-label="Facebook">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                </div>
            </div>
        </div>
    </footer>

    <script src="js/main.js"></script>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'public', 'blog.html'), html, 'utf-8');
    console.log('✓ Blog hub regenerated with ' + allPosts.length + ' posts');
  }


  // ============================================
  // PAGE CONTENT EDITOR
  // ============================================

  // Parse editable sections from HTML content
  function parseEditableSections(html) {
    const sections = [];
    const regex = /<!-- editable:(\S+) label:(.*?) type:(\S+) -->([\s\S]*?)<!-- \/editable:\1 -->/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      sections.push({
        id: match[1],
        label: match[2].trim(),
        type: match[3],
        content: match[4].trim()
      });
    }
    return sections;
  }

  // Get friendly page name from path
  function getPageName(pagePath) {
    const names = {
      'index.html': 'Homepage',
      'about.html': 'About Us',
      'contact.html': 'Contact',
      'quote.html': 'Get a Quote',
      'services/contract-cleaning.html': 'Contract Cleaning',
      'services/deep-cleaning.html': 'Deep Cleaning',
      'services/specialist-services.html': 'Specialist Services',
      'areas/devon.html': 'Devon Area',
      'areas/cornwall.html': 'Cornwall Area',
      'areas/somerset.html': 'Somerset Area'
    };
    return names[pagePath] || pagePath;
  }

  // LIST all pages with editable content
  router.get('/content', requireAuth, (req, res) => {
    const msg = req.query.saved === '1' ? 'Content saved successfully!' : null;
    const publicDir = path.join(__dirname, 'public');
    const pages = [];

    function scanDir(dir, prefix) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !['images', 'css', 'js', 'uploads', 'blog'].includes(f)) {
          scanDir(fullPath, prefix + f + '/');
        } else if (f.endsWith('.html') && !['thank-you.html', 'privacy.html', 'cookies.html', 'terms.html', 'estimator.html', 'blog.html'].includes(f)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const sections = parseEditableSections(content);
          if (sections.length > 0) {
            pages.push({
              path: prefix + f,
              name: getPageName(prefix + f),
              sectionCount: sections.length,
              sections: sections.map(s => s.label)
            });
          }
        }
      }
    }
    scanDir(publicDir, '');

    // Sort: main pages first
    const order = ['index.html', 'about.html', 'contact.html', 'quote.html'];
    pages.sort((a, b) => {
      const aIdx = order.indexOf(a.path);
      const bIdx = order.indexOf(b.path);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.path.localeCompare(b.path);
    });

    res.send(layout('Page Content', `
      ${msg ? '<div class="alert alert-success">' + msg + '</div>' : ''}
      <div class="alert alert-info">Edit the text and content on any page of your website. Click a page to start editing.</div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">
        ${pages.map(p => `
          <a href="/admin/content/edit?path=${encodeURIComponent(p.path)}" class="card" style="text-decoration:none;color:inherit;transition:transform 0.2s,box-shadow 0.2s;cursor:pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div class="card-body" style="padding:24px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <div style="width:40px;height:40px;border-radius:10px;background:#dbeafe;display:flex;align-items:center;justify-content:center;">
                  <svg width="20" height="20" fill="none" stroke="#2563eb" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </div>
                <div>
                  <h3 style="font-size:16px;font-weight:600;margin:0;">${escHTML(p.name)}</h3>
                  <div style="font-size:12px;color:#6b7280;">/${p.path}</div>
                </div>
              </div>
              <div style="font-size:13px;color:#6b7280;">
                <span class="badge badge-blue">${p.sectionCount} editable section${p.sectionCount !== 1 ? 's' : ''}</span>
              </div>
              <div style="margin-top:10px;font-size:12px;color:#9ca3af;line-height:1.5;">
                ${p.sections.slice(0, 4).join(' &bull; ')}${p.sections.length > 4 ? ' &bull; +' + (p.sections.length - 4) + ' more' : ''}
              </div>
            </div>
          </a>
        `).join('')}
      </div>

      ${pages.length === 0 ? '<div class="card"><div class="card-body"><div class="empty-state"><h3>No editable pages found</h3><p>Pages need editable content markers to appear here.</p></div></div></div>' : ''}
    `, 'content'));
  });

  // EDIT content for a specific page
  router.get('/content/edit', requireAuth, (req, res) => {
    const pagePath = req.query.path;
    if (!pagePath) return res.redirect('/admin/content');

    const fullPath = path.join(__dirname, 'public', pagePath);
    if (!fs.existsSync(fullPath)) return res.redirect('/admin/content');

    const html = fs.readFileSync(fullPath, 'utf-8');
    const sections = parseEditableSections(html);
    const pageName = getPageName(pagePath);
    const msg = req.query.saved === '1' ? 'Content saved successfully!' : null;

    if (sections.length === 0) {
      return res.redirect('/admin/content');
    }

    // Build form fields for each editable section
    let fieldIndex = 0;
    const formFields = sections.map(s => {
      fieldIndex++;
      if (s.type === 'html') {
        return `
          <div class="card">
            <div class="card-header"><h3>${escHTML(s.label)}</h3><span class="badge badge-blue">Rich Text</span></div>
            <div class="card-body">
              <div id="editor-${s.id}" class="content-editor">${s.content}</div>
              <input type="hidden" name="editable_${s.id}" id="input-${s.id}" value="">
            </div>
          </div>`;
      } else {
        return `
          <div class="card">
            <div class="card-header"><h3>${escHTML(s.label)}</h3><span class="badge badge-green">Text</span></div>
            <div class="card-body">
              <div class="form-group" style="margin-bottom:0;">
                <textarea name="editable_${s.id}" rows="${s.content.length > 100 ? '3' : '1'}" style="font-size:15px;line-height:1.6;">${escHTML(s.content)}</textarea>
                <div class="help">Plain text or basic HTML (e.g. &lt;br&gt; for line breaks, &lt;span&gt; for styling)</div>
              </div>
            </div>
          </div>`;
      }
    }).join('\n');

    // Collect all html-type editor IDs for Quill initialization
    const htmlEditors = sections.filter(s => s.type === 'html').map(s => s.id);

    res.send(layout('Edit: ' + pageName, `
      ${msg ? '<div class="alert alert-success">' + msg + '</div>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <a href="/admin/content" style="color:#6b7280;text-decoration:none;font-size:14px;">&larr; All Pages</a>
          <span style="color:#d1d5db;margin:0 8px;">/</span>
          <span style="font-size:14px;color:#374151;font-weight:500;">${escHTML(pageName)}</span>
        </div>
        <a href="/${pagePath}" target="_blank" class="btn btn-outline btn-sm">View Page</a>
      </div>

      <form method="POST" action="/admin/content/save" id="content-form">
        <input type="hidden" name="path" value="${escHTML(pagePath)}">

        ${formFields}

        <div style="position:sticky;bottom:0;background:#f0f2f5;padding:16px 0;border-top:1px solid #e5e7eb;margin-top:24px;display:flex;gap:12px;">
          <button type="submit" class="btn btn-primary">Save All Changes</button>
          <a href="/admin/content" class="btn btn-outline">Cancel</a>
        </div>
      </form>

      ${htmlEditors.length > 0 ? `
      <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
      <style>
        .content-editor { min-height: 200px; background: white; }
        .content-editor .ql-editor { min-height: 180px; font-size: 15px; line-height: 1.7; }
      </style>
      <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
      <script>
        var editors = {};
        ${htmlEditors.map(id => `
          editors['${id}'] = new Quill('#editor-${id}', {
            theme: 'snow',
            modules: {
              toolbar: [
                [{ 'header': [2, 3, 4, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link'],
                ['clean']
              ]
            }
          });
        `).join('\n')}

        document.getElementById('content-form').addEventListener('submit', function(e) {
          ${htmlEditors.map(id => `
            document.getElementById('input-${id}').value = editors['${id}'].root.innerHTML;
          `).join('\n')}
        });
      </script>` : ''}
    `, 'content'));
  });

  // SAVE content changes
  router.post('/content/save', requireAuth, (req, res) => {
    const pagePath = req.body.path;
    if (!pagePath) return res.redirect('/admin/content');

    const fullPath = path.join(__dirname, 'public', pagePath);
    if (!fs.existsSync(fullPath)) return res.redirect('/admin/content');

    let html = fs.readFileSync(fullPath, 'utf-8');

    // Replace each editable section with new content
    for (const [key, value] of Object.entries(req.body)) {
      if (key.startsWith('editable_')) {
        const id = key.replace('editable_', '');
        // Match the editable block and replace its content
        const regex = new RegExp(
          '(<!-- editable:' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' label:.*? type:\\S+ -->)[\\s\\S]*?(<!-- \\/editable:' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' -->)',
          'g'
        );
        html = html.replace(regex, '$1\n' + value + '\n$2');
      }
    }

    fs.writeFileSync(fullPath, html, 'utf-8');
    console.log('✓ Page content updated: ' + pagePath);
    res.redirect('/admin/content/edit?path=' + encodeURIComponent(pagePath) + '&saved=1');
  });


  // ============================================
  // PAGES & SEO
  // ============================================
  router.get('/pages', requireAuth, (req, res) => {
    const msg = req.query.saved === '1' ? 'Page meta saved successfully!' : null;

    // Scan all HTML pages
    const publicDir = path.join(__dirname, 'public');
    const pages = [];

    function scanDir(dir, prefix) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !['images', 'css', 'js'].includes(f)) {
          scanDir(fullPath, prefix + f + '/');
        } else if (f.endsWith('.html') && f !== 'thank-you.html') {
          const pagePath = prefix + f;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const titleMatch = content.match(/<title>(.*?)<\/title>/);
          const descMatch = content.match(/<meta name="description" content="(.*?)"/);
          const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/s);
          pages.push({
            path: pagePath,
            title: titleMatch ? titleMatch[1] : '',
            description: descMatch ? descMatch[1] : '',
            h1: h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '',
            titleLength: (titleMatch ? titleMatch[1] : '').length,
            descLength: (descMatch ? descMatch[1] : '').length
          });
        }
      }
    }
    scanDir(publicDir, '');

    // Sort: main pages first, then blog, then areas, then services
    pages.sort((a, b) => {
      const aDepth = (a.path.match(/\//g) || []).length;
      const bDepth = (b.path.match(/\//g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.path.localeCompare(b.path);
    });

    res.send(layout('Pages & SEO', `
      ${msg ? '<div class="alert alert-success">' + msg + '</div>' : ''}
      <div class="alert alert-info">Edit meta titles and descriptions for each page. These affect how your pages appear in Google search results.</div>
      <div class="card">
        <table>
          <thead><tr><th>Page</th><th>Title Tag</th><th>Meta Description</th><th>Length</th><th></th></tr></thead>
          <tbody>
            ${pages.map(p => {
              const titleOk = p.titleLength > 0 && p.titleLength <= 60;
              const descOk = p.descLength > 0 && p.descLength <= 160;
              return `<tr>
                <td>
                  <strong>/${p.path}</strong>
                  ${p.h1 ? '<div style="font-size:12px;color:#6b7280;">H1: ' + escHTML(p.h1) + '</div>' : ''}
                </td>
                <td style="max-width:250px;"><span style="font-size:13px;">${escHTML(p.title)}</span></td>
                <td style="max-width:300px;font-size:12px;color:#6b7280;">${escHTML(p.description).substring(0, 80)}${p.description.length > 80 ? '...' : ''}</td>
                <td>
                  <span class="badge ${titleOk ? 'badge-green' : 'badge-red'}">${p.titleLength}</span>
                  <span class="badge ${descOk ? 'badge-green' : 'badge-red'}">${p.descLength}</span>
                </td>
                <td><a href="/admin/pages/edit?path=${encodeURIComponent(p.path)}" class="btn btn-outline btn-sm">Edit</a></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `, 'pages'));
  });

  router.get('/pages/edit', requireAuth, (req, res) => {
    const pagePath = req.query.path;
    if (!pagePath) return res.redirect('/admin/pages');

    const fullPath = path.join(__dirname, 'public', pagePath);
    if (!fs.existsSync(fullPath)) return res.redirect('/admin/pages');

    const content = fs.readFileSync(fullPath, 'utf-8');
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const descMatch = content.match(/<meta name="description" content="(.*?)"/);
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/s);
    const canonicalMatch = content.match(/<link rel="canonical" href="(.*?)"/);

    res.send(layout('Edit Page: /' + pagePath, `
      <form method="POST" action="/admin/pages/save">
        <input type="hidden" name="path" value="${pagePath}">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;">
          <div>
            <div class="card">
              <div class="card-header"><h3>Meta Tags</h3></div>
              <div class="card-body">
                <div class="form-group">
                  <label>Page Title (title tag)</label>
                  <input type="text" name="title" value="${escHTML(titleMatch ? titleMatch[1] : '')}" required>
                  <div class="help" id="title-count">Recommended: 50-60 characters</div>
                </div>
                <div class="form-group">
                  <label>Meta Description</label>
                  <textarea name="description" rows="3">${descMatch ? descMatch[1] : ''}</textarea>
                  <div class="help" id="desc-count">Recommended: 150-160 characters</div>
                </div>
                <div class="form-group">
                  <label>H1 Heading</label>
                  <input type="text" name="h1" value="${escHTML(h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '')}">
                  <div class="help">Main heading visible on the page</div>
                </div>
                ${canonicalMatch ? `<div class="form-group">
                  <label>Canonical URL</label>
                  <input type="text" name="canonical" value="${escHTML(canonicalMatch[1])}">
                </div>` : ''}
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>Google Search Preview</h3></div>
              <div class="card-body">
                <div style="font-family:Arial,sans-serif;max-width:600px;">
                  <div id="preview-title" style="font-size:20px;color:#1a0dab;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(titleMatch ? titleMatch[1] : '')}</div>
                  <div style="font-size:14px;color:#006621;margin-bottom:4px;">https://signature-cleans.co.uk/${pagePath}</div>
                  <div id="preview-desc" style="font-size:13px;color:#545454;line-height:1.4;">${escHTML(descMatch ? descMatch[1] : '')}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-body">
                <button type="submit" class="btn btn-primary" style="width:100%;">Save Changes</button>
                <a href="/admin/pages" class="btn btn-outline" style="width:100%;margin-top:8px;text-align:center;">Cancel</a>
                <a href="/${pagePath}" target="_blank" class="btn btn-outline" style="width:100%;margin-top:8px;text-align:center;">View Page</a>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>SEO Tips</h3></div>
              <div class="card-body" style="font-size:13px;color:#6b7280;line-height:1.6;">
                <p><strong>Title:</strong> 50-60 chars. Include main keyword near the start.</p>
                <p style="margin-top:8px;"><strong>Description:</strong> 150-160 chars. Compelling summary with call to action.</p>
                <p style="margin-top:8px;"><strong>H1:</strong> One per page. Should match the page's main topic.</p>
              </div>
            </div>
          </div>
        </div>
      </form>

      <script>
        document.querySelector('[name=title]').addEventListener('input', function() {
          document.getElementById('preview-title').textContent = this.value;
          document.getElementById('title-count').textContent = this.value.length + '/60 characters';
          document.getElementById('title-count').style.color = this.value.length > 60 ? '#dc2626' : '#6b7280';
        });
        document.querySelector('[name=description]').addEventListener('input', function() {
          document.getElementById('preview-desc').textContent = this.value;
          document.getElementById('desc-count').textContent = this.value.length + '/160 characters';
          document.getElementById('desc-count').style.color = this.value.length > 160 ? '#dc2626' : '#6b7280';
        });
      </script>
    `, 'pages'));
  });

  router.post('/pages/save', requireAuth, (req, res) => {
    const { path: pagePath, title, description, h1, canonical } = req.body;
    const fullPath = path.join(__dirname, 'public', pagePath);
    if (!fs.existsSync(fullPath)) return res.redirect('/admin/pages');

    let content = fs.readFileSync(fullPath, 'utf-8');

    // Update title tag
    if (title) content = content.replace(/<title>.*?<\/title>/, '<title>' + title + '</title>');

    // Update meta description
    if (description !== undefined) {
      if (content.includes('<meta name="description"')) {
        content = content.replace(/<meta name="description" content=".*?"/, '<meta name="description" content="' + description.replace(/"/g, '&quot;') + '"');
      } else {
        content = content.replace('</title>', '</title>\n    <meta name="description" content="' + description.replace(/"/g, '&quot;') + '">');
      }
    }

    // Update H1
    if (h1 !== undefined && h1 !== '') {
      content = content.replace(/<h1([^>]*)>.*?<\/h1>/s, '<h1$1>' + h1 + '</h1>');
    }

    // Update canonical
    if (canonical) {
      content = content.replace(/<link rel="canonical" href=".*?"/, '<link rel="canonical" href="' + canonical + '"');
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log('✓ Page meta updated: ' + pagePath);
    res.redirect('/admin/pages?saved=1');
  });


  // ============================================
  // HEAD TAGS
  // ============================================
  router.get('/head-tags', requireAuth, (req, res) => {
    const tags = db.prepare('SELECT * FROM head_tags ORDER BY created_at DESC').all();
    const msg = req.query.saved === '1' ? 'Head tags saved!' : req.query.deleted === '1' ? 'Tag deleted.' : null;

    res.send(layout('Head Tags', `
      ${msg ? '<div class="alert alert-success">' + msg + '</div>' : ''}
      <div class="alert alert-info">Add custom tags to the &lt;head&gt; of your pages. Use this for Google Search Console verification, analytics scripts, Open Graph tags, etc.</div>

      <div class="card">
        <div class="card-header">
          <h3>Add New Tag</h3>
        </div>
        <div class="card-body">
          <form method="POST" action="/admin/head-tags/save">
            <div class="form-row">
              <div class="form-group">
                <label>Apply To</label>
                <select name="page_path">
                  <option value="*">All Pages</option>
                  <option value="index.html">Homepage</option>
                  <option value="about.html">About</option>
                  <option value="contact.html">Contact</option>
                  <option value="quote.html">Quote</option>
                  <option value="blog.html">Blog Hub</option>
                  <option value="services/*">All Service Pages</option>
                  <option value="areas/*">All Area Pages</option>
                  <option value="blog/*">All Blog Posts</option>
                </select>
              </div>
              <div class="form-group">
                <label>Description <span style="font-weight:400;color:#9ca3af;">(for your reference)</span></label>
                <input type="text" name="description" placeholder="e.g. Google Search Console verification">
              </div>
            </div>
            <div class="form-group">
              <label>Tag HTML</label>
              <textarea name="tag_content" rows="3" placeholder='e.g. <meta name="google-site-verification" content="abc123">' required style="font-family:monospace;font-size:13px;"></textarea>
              <div class="help">Paste the full HTML tag. This will be injected into the &lt;head&gt; section of matching pages.</div>
            </div>
            <button type="submit" class="btn btn-primary">Add Tag</button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Active Tags</h3></div>
        ${tags.length > 0 ? `<table>
          <thead><tr><th>Pages</th><th>Description</th><th>Tag</th><th></th></tr></thead>
          <tbody>
            ${tags.map(t => `<tr>
              <td><span class="badge badge-blue">${t.page_path === '*' ? 'All Pages' : t.page_path}</span></td>
              <td>${escHTML(t.description || '-')}</td>
              <td><code style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:4px;word-break:break-all;">${escHTML(t.tag_content).substring(0, 80)}${t.tag_content.length > 80 ? '...' : ''}</code></td>
              <td>
                <form method="POST" action="/admin/head-tags/delete/${t.id}" style="display:inline;" onsubmit="return confirm('Remove this tag?')">
                  <button type="submit" class="btn btn-danger btn-sm">Remove</button>
                </form>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="card-body"><div class="empty-state"><h3>No custom head tags</h3><p>Add verification tags, analytics scripts, or other custom tags above.</p></div></div>'}
      </div>
    `, 'headtags'));
  });

  router.post('/head-tags/save', requireAuth, (req, res) => {
    const { page_path, tag_content, description } = req.body;
    if (tag_content && tag_content.trim()) {
      db.prepare('INSERT INTO head_tags (page_path, tag_content, description) VALUES (?, ?, ?)')
        .run(page_path || '*', tag_content.trim(), description || '');

      // Inject into matching HTML files
      injectHeadTags();
    }
    res.redirect('/admin/head-tags?saved=1');
  });

  router.post('/head-tags/delete/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM head_tags WHERE id = ?').run(req.params.id);
    // Re-inject to remove deleted tag from files
    injectHeadTags();
    res.redirect('/admin/head-tags?deleted=1');
  });

  // Inject all active head tags into matching HTML files
  function injectHeadTags() {
    const tags = db.prepare('SELECT * FROM head_tags').all();
    const publicDir = path.join(__dirname, 'public');

    function processFile(filePath, relativePath) {
      let content = fs.readFileSync(filePath, 'utf-8');

      // Remove previously injected tags (marked with comment)
      content = content.replace(/\n\s*<!-- ADMIN-TAG -->.*?<!-- \/ADMIN-TAG -->/gs, '');

      // Find matching tags for this page
      const matchingTags = tags.filter(t => {
        if (t.page_path === '*') return true;
        if (t.page_path.endsWith('/*')) {
          return relativePath.startsWith(t.page_path.replace('/*', '/'));
        }
        return relativePath === t.page_path;
      });

      if (matchingTags.length > 0) {
        const tagStr = matchingTags.map(t => '    <!-- ADMIN-TAG -->' + t.tag_content + '<!-- /ADMIN-TAG -->').join('\n');
        content = content.replace('</head>', tagStr + '\n</head>');
      }

      fs.writeFileSync(filePath, content, 'utf-8');
    }

    function scanAndInject(dir, prefix) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !['images', 'css', 'js', 'uploads'].includes(f)) {
          scanAndInject(fullPath, prefix + f + '/');
        } else if (f.endsWith('.html')) {
          processFile(fullPath, prefix + f);
        }
      }
    }

    scanAndInject(publicDir, '');
    console.log('✓ Head tags injected into HTML files');
  }

  // ============================================
  // MEDIA LIBRARY
  // ============================================
  router.get('/media', requireAuth, (req, res) => {
    const msg = req.query.uploaded === '1' ? 'Image uploaded!' : req.query.deleted === '1' ? 'Image deleted.' : null;

    // List all images in uploads directory
    const images = [];
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(ext)) {
          const stat = fs.statSync(path.join(uploadsDir, f));
          images.push({
            name: f,
            url: '/images/uploads/' + f,
            size: (stat.size / 1024).toFixed(1) + ' KB',
            date: stat.mtime
          });
        }
      }
    }
    images.sort((a, b) => b.date - a.date);

    // Also list original images
    const origDir = path.join(__dirname, 'public', 'images');
    const origImages = [];
    if (fs.existsSync(origDir)) {
      const files = fs.readdirSync(origDir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(ext)) {
          origImages.push({ name: f, url: '/images/' + f });
        }
      }
    }

    res.send(layout('Media Library', `
      ${msg ? '<div class="alert alert-success">' + msg + '</div>' : ''}

      <div class="card">
        <div class="card-header">
          <h3>Upload Image</h3>
        </div>
        <div class="card-body">
          <form method="POST" action="/admin/media/upload" enctype="multipart/form-data" style="display:flex;gap:12px;align-items:end;">
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label>Select Image</label>
              <input type="file" name="image" accept="image/*" required>
            </div>
            <button type="submit" class="btn btn-primary">Upload</button>
          </form>
          <div class="help" style="margin-top:8px;">Max file size: 10MB. Supported: JPG, PNG, GIF, WebP, SVG, AVIF</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Uploaded Images (${images.length})</h3>
        </div>
        <div class="card-body">
          ${images.length > 0 ? `
          <div class="media-grid">
            ${images.map(img => `
              <div class="media-item">
                <img src="${img.url}" alt="${escHTML(img.name)}" loading="lazy">
                <div class="media-info">${escHTML(img.name)}</div>
                <div class="media-actions">
                  <button onclick="navigator.clipboard.writeText('${img.url}');this.textContent='Copied!'" style="background:#2563eb;color:white;">Copy URL</button>
                  <form method="POST" action="/admin/media/delete" style="display:inline;" onsubmit="return confirm('Delete this image?')">
                    <input type="hidden" name="filename" value="${escHTML(img.name)}">
                    <button type="submit" style="background:#dc2626;color:white;">Delete</button>
                  </form>
                </div>
              </div>
            `).join('')}
          </div>` : '<div class="empty-state"><h3>No uploaded images yet</h3><p>Upload images above to use in blog posts.</p></div>'}
        </div>
      </div>

      ${origImages.length > 0 ? `
      <div class="card">
        <div class="card-header"><h3>Site Images (${origImages.length})</h3></div>
        <div class="card-body">
          <div class="media-grid">
            ${origImages.map(img => `
              <div class="media-item">
                <img src="${img.url}" alt="${escHTML(img.name)}" loading="lazy">
                <div class="media-info">${escHTML(img.name)}</div>
                <div class="media-actions">
                  <button onclick="navigator.clipboard.writeText('${img.url}');this.textContent='Copied!'" style="background:#2563eb;color:white;">Copy URL</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>` : ''}
    `, 'media'));
  });

  router.post('/media/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.redirect('/admin/media');
    res.redirect('/admin/media?uploaded=1');
  });

  router.post('/media/delete', requireAuth, (req, res) => {
    const filename = req.body.filename;
    if (filename && !filename.includes('..') && !filename.includes('/')) {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.redirect('/admin/media?deleted=1');
  });


  // ============================================
  // SUBMISSIONS (replaces old /admin route)
  // ============================================
  router.get('/submissions', requireAuth, (req, res) => {
    const type = req.query.type || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    let where = '';
    let params = [];
    if (type && ['quote', 'contact'].includes(type)) {
      where = 'WHERE type = ?';
      params.push(type);
    }

    const { total } = db.prepare(`SELECT COUNT(*) as total FROM submissions ${where}`).get(...params);
    const submissions = db.prepare(`SELECT * FROM submissions ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const totalPages = Math.ceil(total / limit);

    res.send(layout('Submissions', `
      <div style="display:flex;gap:10px;margin-bottom:24px;">
        <a href="/admin/submissions" class="btn ${!type ? 'btn-primary' : 'btn-outline'} btn-sm">All (${total})</a>
        <a href="/admin/submissions?type=quote" class="btn ${type === 'quote' ? 'btn-primary' : 'btn-outline'} btn-sm">Quotes</a>
        <a href="/admin/submissions?type=contact" class="btn ${type === 'contact' ? 'btn-primary' : 'btn-outline'} btn-sm">Contact</a>
      </div>

      ${submissions.length > 0 ? `
      <div class="card">
        <table>
          <thead><tr><th>Type</th><th>Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Service</th><th>Estimate</th><th>Details</th></tr></thead>
          <tbody>
            ${submissions.map(s => `<tr>
              <td><span class="badge ${s.type === 'quote' ? 'badge-blue' : 'badge-purple'}">${s.type}</span></td>
              <td style="white-space:nowrap;">${new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td><strong>${escHTML(s.name)}</strong></td>
              <td><a href="mailto:${s.email}" style="color:#2563eb;">${s.email}</a></td>
              <td>${s.phone ? '<a href="tel:' + s.phone + '" style="color:#2563eb;">' + s.phone + '</a>' : '-'}</td>
              <td>${escHTML(s.company) || '-'}</td>
              <td>${escHTML(s.serviceType) || '-'}</td>
              <td>${s.estimate ? '<strong>&pound;' + escHTML(s.estimate) + '</strong>' : '-'}</td>
              <td style="max-width:200px;font-size:13px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(s.message || s.sector || '-')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? `<div class="pagination">${Array.from({length: totalPages}, (_, i) => i + 1).map(p =>
        '<a href="/admin/submissions?' + (type ? 'type=' + type + '&' : '') + 'page=' + p + '" class="' + (p === page ? 'active' : '') + '">' + p + '</a>'
      ).join('')}</div>` : ''}
      ` : `
      <div class="card">
        <div class="card-body">
          <div class="empty-state"><h3>No submissions yet</h3></div>
        </div>
      </div>`}
    `, 'submissions'));
  });

  // Inject head tags on startup (ensures seeded/admin tags are in HTML files)
  injectHeadTags();

  return router;
};
