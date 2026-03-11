/**
 * Signature Cleans - Production Server
 * Commercial Cleaning Website Backend
 */

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, that's ok
}

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const validator = require('validator');
const nodemailer = require('nodemailer');
const fs = require('fs');
const https = require('https');

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

  const emailTo = process.env.EMAIL_TO || 'hello@signature-cleans.co.uk';
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
// AUTO-REPLY EMAIL (sent to the customer)
// ============================================
async function sendAutoReplyEmail(submission) {
  if (!transporter) return;
  if (process.env.AUTO_REPLY_ENABLED === 'false') return;

  const emailFrom = process.env.EMAIL_FROM || 'website@signature-cleans.co.uk';
  const isQuote = submission.type === 'quote';

  const subject = isQuote
    ? 'Thanks for your quote request — Signature Cleans'
    : 'We\'ve received your message — Signature Cleans';

  const headline = isQuote
    ? 'We\'ve received your quote request'
    : 'Thanks for getting in touch';

  const bodyText = isQuote
    ? 'Thank you for requesting a quote. One of our team will review your requirements and be in touch within 24 hours to discuss next steps.'
    : 'Thank you for contacting us. We\'ve received your message and will get back to you as soon as possible, usually within one working day.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f7; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #1d1d1f; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .body { padding: 30px; }
    .body p { margin: 0 0 16px; font-size: 15px; color: #333; }
    .body p:last-child { margin-bottom: 0; }
    .greeting { font-size: 17px; font-weight: 600; color: #1d1d1f; }
    .summary { background: #f5f5f7; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .summary-label { color: #86868b; font-weight: 500; }
    .summary-value { color: #1d1d1f; font-weight: 600; text-align: right; }
    .divider { height: 1px; background: #e5e5e5; margin: 20px 0; }
    .contact-info { font-size: 14px; color: #666; }
    .contact-info a { color: #2563eb; text-decoration: none; }
    .footer { padding: 20px 30px; text-align: center; font-size: 12px; color: #86868b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>Signature Cleans</h1>
      </div>
      <div class="body">
        <p class="greeting">Hi ${submission.name},</p>
        <p>${bodyText}</p>
        ${isQuote && (submission.serviceType || submission.estimate) ? `
        <div class="summary">
          ${submission.serviceType ? `<div class="summary-row"><span class="summary-label">Service</span><span class="summary-value">${submission.serviceType}</span></div>` : ''}
          ${submission.sector ? `<div class="summary-row"><span class="summary-label">Sector</span><span class="summary-value">${submission.sector}</span></div>` : ''}
          ${submission.size ? `<div class="summary-row"><span class="summary-label">Size</span><span class="summary-value">${submission.size}</span></div>` : ''}
          ${submission.frequency ? `<div class="summary-row"><span class="summary-label">Frequency</span><span class="summary-value">${submission.frequency}</span></div>` : ''}
          ${submission.estimate ? `<div class="summary-row"><span class="summary-label">Indicative Estimate</span><span class="summary-value">&pound;${submission.estimate.replace('/wk', '')} per week</span></div>` : ''}
        </div>` : ''}
        <div class="divider"></div>
        <div class="contact-info">
          <p>In the meantime, if you have any questions you can reach us at:</p>
          <p>
            Phone: <a href="tel:01392931035">01392 931035</a><br>
            Email: <a href="mailto:hello@signature-cleans.co.uk">hello@signature-cleans.co.uk</a>
          </p>
        </div>
      </div>
      <div class="footer">
        Signature Cleans &bull; Commercial Cleaning Services<br>
        Exeter, Devon &bull; <a href="https://signature-cleans.co.uk" style="color:#86868b;">signature-cleans.co.uk</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Signature Cleans" <${emailFrom}>`,
      to: submission.email,
      subject,
      html,
      replyTo: 'hello@signature-cleans.co.uk'
    });
    console.log('✓ Auto-reply sent to ' + submission.email);
  } catch (error) {
    console.error('✗ Auto-reply failed:', error.message);
  }
}

// ============================================
// ZOHO CRM INTEGRATION
// ============================================
const zoho = {
  clientId:     process.env.ZOHO_CLIENT_ID     || '',
  clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
  refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
  domain:       process.env.ZOHO_DOMAIN        || 'eu',  // 'eu', 'com', 'in', 'au', 'jp'
  accessToken:  null,
  tokenExpiry:  0,

  get enabled() {
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  },

  get accountsUrl() {
    return `https://accounts.zoho.${this.domain}`;
  },

  get apiUrl() {
    return `https://www.zohoapis.${this.domain}`;
  },

  // Fetch a fresh access token using the refresh token
  async getAccessToken() {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        refresh_token: this.refreshToken,
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        grant_type:    'refresh_token'
      }).toString();

      const url = new URL(`${this.accountsUrl}/oauth/v2/token`);
      const options = {
        hostname: url.hostname,
        path:     url.pathname + '?' + postData,
        method:   'POST',
        headers:  { 'Content-Length': 0 }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token) {
              this.accessToken = parsed.access_token;
              // Zoho tokens last 1 hour
              this.tokenExpiry = Date.now() + (parsed.expires_in || 3600) * 1000;
              resolve(this.accessToken);
            } else {
              reject(new Error('Zoho token error: ' + (parsed.error || data)));
            }
          } catch (e) {
            reject(new Error('Zoho token parse error: ' + e.message));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  },

  // Push a lead to Zoho CRM
  async pushLead(submission) {
    if (!this.enabled) return;

    try {
      const token = await this.getAccessToken();

      // Map submission fields to Zoho Lead fields
      const nameParts = (submission.name || '').trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
      const lastName  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || 'Unknown';

      const lead = {
        First_Name:  firstName,
        Last_Name:   lastName,
        Email:       submission.email || '',
        Phone:       submission.phone || '',
        Company:     submission.company || 'Not specified',
        City:        submission.postcode || '',
        Description: this._buildDescription(submission),
        Lead_Source: 'Website',
        Lead_Status: 'New'
      };

      const body = JSON.stringify({ data: [lead] });

      return new Promise((resolve, reject) => {
        const url = new URL(`${this.apiUrl}/crm/v5/Leads`);
        const options = {
          hostname: url.hostname,
          path:     url.pathname,
          method:   'POST',
          headers: {
            'Authorization': 'Zoho-oauthtoken ' + token,
            'Content-Type':  'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.data && parsed.data[0] && parsed.data[0].status === 'success') {
                console.log('✓ Zoho CRM: Lead created — ' + parsed.data[0].details.id);
              } else {
                console.error('✗ Zoho CRM error:', data);
              }
            } catch (e) {
              console.error('✗ Zoho CRM parse error:', e.message);
            }
            resolve();
          });
        });
        req.on('error', (err) => {
          console.error('✗ Zoho CRM network error:', err.message);
          resolve(); // Don't reject — lead is already in local DB
        });
        req.write(body);
        req.end();
      });
    } catch (err) {
      console.error('✗ Zoho CRM push failed:', err.message);
      // Never throw — local DB is the safety net
    }
  },

  // Build a readable description for the Zoho lead note
  _buildDescription(s) {
    const lines = [];
    if (s.type)           lines.push('Type: ' + s.type);
    if (s.leadSource)     lines.push('Lead Source: ' + s.leadSource);
    if (s.serviceType)    lines.push('Service: ' + s.serviceType);
    if (s.sector)         lines.push('Sector: ' + s.sector);
    if (s.size)           lines.push('Site Size: ' + s.size);
    if (s.frequency)      lines.push('Frequency: ' + s.frequency);
    if (s.estimate)       lines.push('Website Estimate: £' + s.estimate);
    if (s.postcode)       lines.push('Postcode: ' + s.postcode);
    if (s.message)        lines.push('\nMessage:\n' + s.message);
    return lines.join('\n');
  }
};

if (zoho.enabled) {
  console.log('✓ Zoho CRM integration configured (domain: .' + zoho.domain + ')');
} else {
  console.log('⚠ Zoho CRM not configured — set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN');
}

// ============================================
// MIDDLEWARE
// ============================================
// Trust proxy for accurate IP addresses (important when behind reverse proxy/load balancer)
app.set('trust proxy', true);

// Gzip compression — reduces response sizes by ~70%
app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: []
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

// ============================================
// OLD URL REDIRECTS (from previous site — preserves Google sitelinks)
// ============================================
const oldUrlRedirects = {
  '/contact-us':      '/contact.html',
  '/contact-us/':     '/contact.html',
  '/testimonials':    '/#testimonials',
  '/testimonials/':   '/#testimonials',
  '/blog/':           '/blog.html',
  '/about-us':        '/about.html',
  '/about-us/':       '/about.html',
  '/services':        '/services.html',
  '/services/':       '/services.html',
  '/get-a-quote':     '/quote.html',
  '/get-a-quote/':    '/quote.html',
  '/defaultsite':     '/',
};

Object.entries(oldUrlRedirects).forEach(([from, to]) => {
  app.get(from, (req, res) => res.redirect(301, to));
});

// Static files — cache CSS/JS/images for 7 days, HTML for 1 hour
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

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
    sendAutoReplyEmail(submission).catch(() => {});

    // Push to Zoho CRM (async, non-blocking — DB is the safety net)
    zoho.pushLead(submission).catch(() => {});

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
    sendAutoReplyEmail(submission).catch(() => {});

    // Push to Zoho CRM (async, non-blocking — DB is the safety net)
    zoho.pushLead(submission).catch(() => {});

    res.json({ success: true, message: 'Message received' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// ============================================
// ADMIN PANEL (CMS)
// ============================================
const createAdminRouter = require('./admin');
app.use('/admin', createAdminRouter(db));

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
