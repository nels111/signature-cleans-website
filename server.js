/**
 * Signature Cleans - Production Server
 * Commercial Cleaning Website Backend
 */

// Load environment variables from .env file (if it exists, for local development)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not installed, that's ok
  }
}

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const validator = require('validator');
const nodemailer = require('nodemailer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

// ============================================
// DATABASE SETUP
// ============================================
const db = new Database('./data/submissions.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('quote', 'contact')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    postcode TEXT,
    message TEXT,
    serviceType TEXT,
    frequency TEXT,
    size TEXT,
    sector TEXT,
    leadSource TEXT,
    estimate TEXT,
    estimatedHours TEXT,
    ip TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);


// ============================================
// EMAIL CONFIGURATION
// ============================================
let transporter = null;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('✓ Email configured via SMTP');
} else {
  console.log('⚠ Email not configured - submissions will be logged only');
}

async function sendNotificationEmail(submission) {
  if (!transporter) {
    console.log('Email notification skipped (not configured)');
    return;
  }

  const emailTo = process.env.EMAIL_TO || 'nick@signature-cleans.co.uk';
  const emailFrom = process.env.EMAIL_FROM || 'website@signature-cleans.co.uk';

  const isQuote = submission.type === 'quote';
  const subject = isQuote 
    ? `🧹 New Quote Request: ${submission.name}${submission.company ? ` (${submission.company})` : ''}`
    : `📧 New Contact: ${submission.name}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1d1d1f; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #f5f5f7; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; }
    .value { font-size: 15px; margin-top: 2px; }
    .message-box { background: white; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .footer { margin-top: 20px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isQuote ? '🧹 New Quote Request' : '📧 New Contact Message'}</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Name</div>
        <div class="value">${submission.name}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${submission.email}">${submission.email}</a></div>
      </div>
      ${submission.phone ? `<div class="field"><div class="label">Phone</div><div class="value"><a href="tel:${submission.phone}">${submission.phone}</a></div></div>` : ''}
      ${submission.company ? `<div class="field"><div class="label">Company</div><div class="value">${submission.company}</div></div>` : ''}
      ${submission.postcode ? `<div class="field"><div class="label">Postcode</div><div class="value">${submission.postcode}</div></div>` : ''}
      ${submission.serviceType ? `<div class="field"><div class="label">Service Type</div><div class="value">${submission.serviceType}</div></div>` : ''}
      ${submission.sector ? `<div class="field"><div class="label">Sector</div><div class="value">${submission.sector}</div></div>` : ''}
      ${submission.size ? `<div class="field"><div class="label">Size</div><div class="value">${submission.size}</div></div>` : ''}
      ${submission.frequency ? `<div class="field"><div class="label">Frequency</div><div class="value">${submission.frequency}</div></div>` : ''}
      ${submission.estimate ? `<div class="field"><div class="label">Website Estimate</div><div class="value" style="font-size:18px;font-weight:bold;color:#2563eb;">&pound;${submission.estimate}</div></div>` : ''}
      ${submission.estimatedHours ? `<div class="field"><div class="label">Estimated Hours/Day</div><div class="value">${submission.estimatedHours}</div></div>` : ''}
      ${submission.leadSource ? `<div class="field"><div class="label">Lead Source</div><div class="value">${submission.leadSource}</div></div>` : ''}
      ${submission.message ? `<div class="message-box"><div class="label">Message</div><div class="value">${submission.message.replace(/\n/g, '<br>')}</div></div>` : ''}
      <div class="footer">
        Submitted: ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}<br>
        IP: ${submission.ip || 'Unknown'}
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({ from: emailFrom, to: emailTo, subject, html });
    console.log('✓ Email notification sent');
  } catch (error) {
    console.error('✗ Email failed:', error.message);
  }
}

// ============================================
// MIDDLEWARE
// ============================================
// Trust proxy for accurate IP addresses (important when behind reverse proxy/load balancer)
app.set('trust proxy', true);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many submissions. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// VALIDATION
// ============================================
function sanitize(str) {
  if (!str) return '';
  return validator.escape(validator.trim(String(str)));
}

function validateQuote(data) {
  const errors = [];
  if (!data.name || data.name.trim().length < 2) errors.push('Name is required');
  if (!data.email || !validator.isEmail(data.email)) errors.push('Valid email is required');
  if (!data.serviceType) errors.push('Please select a service type');
  if (!data.sector) errors.push('Please select a property type');
  if (data.website && data.website.trim() !== '') return ['spam'];
  return errors;
}

function validateContact(data) {
  const errors = [];
  if (!data.name || data.name.trim().length < 2) errors.push('Name is required');
  if (!data.email || !validator.isEmail(data.email)) errors.push('Valid email is required');
  if (!data.message || data.message.trim().length < 10) errors.push('Message must be at least 10 characters');
  if (data.website && data.website.trim() !== '') return ['spam'];
  return errors;
}

// ============================================
// QUOTE ESTIMATOR CONFIG — Price Bands Framework
// Uses broad hours RANGES per site size to produce wide price bands.
// No hourly rate or hours exposed to visitor.
// ============================================
const ESTIMATOR_CONFIG = {
  // Client-facing billing rates (£/hr) — used server-side only
  billingRateLow:  25,    // Floor rate — never quote below this
  billingRateHigh: 27,    // Target rate

  weeksPerMonth: 4.33,

  // Hours per VISIT range [low, high] by site size
  // Wide ranges account for varied scope within each size band
  sizeToHoursRange: {
    'small':      [1, 3],     // Under 200 m²
    'medium':     [2, 6],     // 200 – 1,000 m²
    'large':      [3, 10],    // 1,000 – 5,000 m²
    'very-large': [6, 20]     // 5,000+ m²
  },

  // Scope-tier multiplier by site type
  // Standard = 1.0, Enhanced (+10-15%), Heavy (+20-30%)
  scopeMultiplier: {
    'Office/Commercial':      1.0,    // Standard scope
    'Education/Institutional': 1.0,   // Standard scope
    'Dental/Medical':          1.12,  // Enhanced — clinical areas
    'Hospitality/Venue':       1.12,  // Enhanced — front-of-house standards
    'Welfare/Construction':    1.15,  // Enhanced — welfare regs
    'Specialist/Industrial':   1.25   // Heavy — industrial / specialist
  }
};

// ============================================
// API ROUTES
// ============================================

// Estimate endpoint — Broad Price Bands calculation
app.post('/api/estimate', rateLimit({ windowMs: 60000, max: 10 }), (req, res) => {
  try {
    const { siteType, size, frequency } = req.body;
    const freq = parseInt(frequency);

    if (!size || !freq || freq < 1 || freq > 7) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    const hoursRange = ESTIMATOR_CONFIG.sizeToHoursRange[size];
    if (!hoursRange) {
      return res.status(400).json({ success: false, error: 'Invalid size' });
    }

    // Apply scope multiplier (Enhanced / Heavy sites need more hours)
    const scopeMult = ESTIMATOR_CONFIG.scopeMultiplier[siteType] || 1.0;
    const hoursLowPerVisit  = hoursRange[0] * scopeMult;
    const hoursHighPerVisit = hoursRange[1] * scopeMult;

    // Weekly hours range
    const weeklyHoursLow  = hoursLowPerVisit * freq;
    const weeklyHoursHigh = hoursHighPerVisit * freq;

    // Weekly charge: low hours × low rate, high hours × high rate
    const weeklyLow  = weeklyHoursLow  * ESTIMATOR_CONFIG.billingRateLow;
    const weeklyHigh = weeklyHoursHigh * ESTIMATOR_CONFIG.billingRateHigh;

    // Round weekly to nearest £5
    const weeklyLowRounded  = Math.round(weeklyLow  / 5) * 5;
    const weeklyHighRounded = Math.round(weeklyHigh / 5) * 5;

    // Monthly charge: weekly × 4.33, rounded to nearest £10
    const monthlyLow  = Math.round(weeklyLowRounded  * ESTIMATOR_CONFIG.weeksPerMonth / 10) * 10;
    const monthlyHigh = Math.round(weeklyHighRounded * ESTIMATOR_CONFIG.weeksPerMonth / 10) * 10;

    // Classify into Cell Type based on midpoint of weekly hours range
    const weeklyHoursMid = (weeklyHoursLow + weeklyHoursHigh) / 2;
    let cellType, cellLabel;
    if (weeklyHoursMid <= 15) {
      cellType = 'A';
      cellLabel = 'Small Site';
    } else if (weeklyHoursMid <= 30) {
      cellType = 'B';
      cellLabel = 'Medium Site';
    } else {
      cellType = 'C';
      cellLabel = 'Large Site';
    }

    res.json({
      success: true,
      estimate: {
        cellType: cellType,
        cellLabel: cellLabel,
        weeklyLow:  weeklyLowRounded,
        weeklyHigh: weeklyHighRounded,
        monthlyLow:  monthlyLow,
        monthlyHigh: monthlyHigh
      }
    });
  } catch (error) {
    console.error('Estimate error:', error);
    res.status(500).json({ success: false, error: 'Calculation failed' });
  }
});

app.post('/api/quote', formLimiter, async (req, res) => {
  try {
    const errors = validateQuote(req.body);
    if (errors.includes('spam')) return res.json({ success: true });
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const submission = {
      type: 'quote',
      name: sanitize(req.body.name),
      email: validator.normalizeEmail(req.body.email) || '',
      phone: sanitize(req.body.phone),
      company: sanitize(req.body.company),
      postcode: sanitize(req.body.postcode),
      message: sanitize(req.body.message),
      serviceType: sanitize(req.body.serviceType),
      frequency: sanitize(req.body.frequency),
      size: sanitize(req.body.size),
      sector: sanitize(req.body.sector),
      leadSource: sanitize(req.body.leadSource),
      estimate: sanitize(req.body.estimate),
      estimatedHours: sanitize(req.body.estimatedHours),
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    };

    const stmt = db.prepare(`
      INSERT INTO submissions (type, name, email, phone, company, postcode, message, serviceType, frequency, size, sector, leadSource, estimate, estimatedHours, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(submission.type, submission.name, submission.email, submission.phone, submission.company,
             submission.postcode, submission.message, submission.serviceType, submission.frequency,
             submission.size, submission.sector, submission.leadSource, submission.estimate,
             submission.estimatedHours, submission.ip);

    await sendNotificationEmail(submission);
    res.json({ success: true, message: 'Quote request received' });
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/contact', formLimiter, async (req, res) => {
  try {
    const errors = validateContact(req.body);
    if (errors.includes('spam')) return res.json({ success: true });
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const submission = {
      type: 'contact',
      name: sanitize(req.body.name),
      email: validator.normalizeEmail(req.body.email) || '',
      phone: sanitize(req.body.phone),
      company: sanitize(req.body.company),
      postcode: '',
      message: sanitize(req.body.message),
      serviceType: '',
      frequency: '',
      size: '',
      sector: '',
      leadSource: '',
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    };

    const stmt = db.prepare(`
      INSERT INTO submissions (type, name, email, phone, company, postcode, message, serviceType, frequency, size, sector, leadSource, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(submission.type, submission.name, submission.email, submission.phone, submission.company,
             submission.postcode, submission.message, submission.serviceType, submission.frequency,
             submission.size, submission.sector, submission.leadSource, submission.ip);

    await sendNotificationEmail(submission);
    res.json({ success: true, message: 'Message received' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  const adminPass = process.env.ADMIN_PASSWORD || 'signature2025';
  if (user === 'admin' && pass === adminPass) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).send('Invalid credentials');
}

app.get('/admin', adminAuth, (req, res) => {
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

  const quoteCount = db.prepare(`SELECT COUNT(*) as c FROM submissions WHERE type = 'quote'`).get().c;
  const contactCount = db.prepare(`SELECT COUNT(*) as c FROM submissions WHERE type = 'contact'`).get().c;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - Signature Cleans</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; min-height: 100vh; }
    .header { background: #1d1d1f; color: white; padding: 20px 30px; }
    .header h1 { font-size: 20px; font-weight: 600; }
    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
    .stats { display: flex; gap: 20px; margin-bottom: 30px; }
    .stat { background: white; padding: 24px; border-radius: 12px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 36px; font-weight: 700; color: #1d1d1f; }
    .stat-label { color: #86868b; font-size: 13px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .filters { display: flex; gap: 10px; margin-bottom: 20px; }
    .filters a { padding: 10px 20px; border-radius: 8px; text-decoration: none; color: #1d1d1f; background: white; font-size: 14px; font-weight: 500; border: 1px solid #d2d2d7; }
    .filters a.active { background: #1d1d1f; color: white; border-color: #1d1d1f; }
    .filters a:hover:not(.active) { background: #f0f0f0; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #fafafa; padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #86868b; border-bottom: 1px solid #e5e5e5; }
    td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; vertical-align: top; }
    tr:hover { background: #fafafa; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-quote { background: #e3f2fd; color: #1565c0; }
    .badge-contact { background: #f3e5f5; color: #7b1fa2; }
    .pagination { display: flex; gap: 8px; justify-content: center; margin-top: 30px; }
    .pagination a { padding: 10px 16px; border-radius: 8px; text-decoration: none; color: #1d1d1f; background: white; border: 1px solid #d2d2d7; font-size: 14px; }
    .pagination a.active { background: #1d1d1f; color: white; border-color: #1d1d1f; }
    .empty { text-align: center; padding: 60px; color: #86868b; }
    .detail { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header"><h1>Signature Cleans Admin</h1></div>
  <div class="container">
    <div class="stats">
      <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Total Submissions</div></div>
      <div class="stat"><div class="stat-value">${quoteCount}</div><div class="stat-label">Quote Requests</div></div>
      <div class="stat"><div class="stat-value">${contactCount}</div><div class="stat-label">Contact Messages</div></div>
    </div>
    <div class="filters">
      <a href="/admin" class="${!type ? 'active' : ''}">All</a>
      <a href="/admin?type=quote" class="${type === 'quote' ? 'active' : ''}">Quotes</a>
      <a href="/admin?type=contact" class="${type === 'contact' ? 'active' : ''}">Contact</a>
    </div>
    ${submissions.length > 0 ? `
    <table>
      <thead><tr><th>Type</th><th>Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Service</th><th>Estimate</th><th>Details</th></tr></thead>
      <tbody>
        ${submissions.map(s => `<tr>
          <td><span class="badge badge-${s.type}">${s.type}</span></td>
          <td>${new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td>${s.name}</td>
          <td><a href="mailto:${s.email}">${s.email}</a></td>
          <td>${s.phone ? `<a href="tel:${s.phone}">${s.phone}</a>` : '-'}</td>
          <td>${s.company || '-'}</td>
          <td>${s.serviceType || '-'}</td>
          <td>${s.estimate ? `<strong>&pound;${s.estimate}</strong>` : '-'}</td>
          <td class="detail">${s.message || s.sector || '-'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<div class="empty">No submissions yet</div>'}
    ${totalPages > 1 ? `<div class="pagination">${Array.from({length: totalPages}, (_, i) => i + 1).map(p => 
      `<a href="/admin?${type ? 'type=' + type + '&' : ''}page=${p}" class="${p === page ? 'active' : ''}">${p}</a>`
    ).join('')}</div>` : ''}
  </div>
</body>
</html>`);
});

// ============================================
// FALLBACK ROUTES
// ============================================
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else if (req.path.endsWith('.html') || !req.path.includes('.')) {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).send('Not found');
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'signature2025';
  const isDefaultPassword = !process.env.ADMIN_PASSWORD;
  console.log(`
╔══════════════════════════════════════════════════╗
║  Signature Cleans Website                        ║
║  Running on http://localhost:${PORT}                 ║
║                                                  ║
║  Admin: http://localhost:${PORT}/admin               ║
${isDefaultPassword ? '║  ⚠️  WARNING: Using default admin password!       ║\n║     Set ADMIN_PASSWORD env var in production      ║' : '║  Admin password: Set via ADMIN_PASSWORD          ║'}
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
