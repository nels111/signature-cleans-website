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

function escHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
        <div class="value">${escHTML(submission.name)}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${escHTML(submission.email)}">${escHTML(submission.email)}</a></div>
      </div>
      ${submission.phone ? `<div class="field"><div class="label">Phone</div><div class="value"><a href="tel:${escHTML(submission.phone)}">${escHTML(submission.phone)}</a></div></div>` : ''}
      ${submission.company ? `<div class="field"><div class="label">Company</div><div class="value">${escHTML(submission.company)}</div></div>` : ''}
      ${submission.postcode ? `<div class="field"><div class="label">Postcode</div><div class="value">${escHTML(submission.postcode)}</div></div>` : ''}
      ${submission.serviceType ? `<div class="field"><div class="label">Service Type</div><div class="value">${escHTML(submission.serviceType)}</div></div>` : ''}
      ${submission.sector ? `<div class="field"><div class="label">Sector</div><div class="value">${escHTML(submission.sector)}</div></div>` : ''}
      ${submission.size ? `<div class="field"><div class="label">Size</div><div class="value">${escHTML(submission.size)}</div></div>` : ''}
      ${submission.frequency ? `<div class="field"><div class="label">Frequency</div><div class="value">${escHTML(submission.frequency)}</div></div>` : ''}
      ${submission.estimate ? `<div class="field"><div class="label">Website Estimate</div><div class="value" style="font-size:18px;font-weight:bold;color:#2563eb;">&pound;${escHTML(submission.estimate)}</div></div>` : ''}
      ${submission.estimatedHours ? `<div class="field"><div class="label">Estimated Hours/Day</div><div class="value">${escHTML(submission.estimatedHours)}</div></div>` : ''}
      ${submission.leadSource ? `<div class="field"><div class="label">Lead Source</div><div class="value">${escHTML(submission.leadSource)}</div></div>` : ''}
      ${submission.message ? `<div class="message-box"><div class="label">Message</div><div class="value">${escHTML(submission.message).replace(/\n/g, '<br>')}</div></div>` : ''}
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
        <p class="greeting">Hi ${escHTML(submission.name)},</p>
        <p>${bodyText}</p>
        ${isQuote && (submission.serviceType || submission.estimate) ? `
        <div class="summary">
          ${submission.serviceType ? `<div class="summary-row"><span class="summary-label">Service</span><span class="summary-value">${escHTML(submission.serviceType)}</span></div>` : ''}
          ${submission.sector ? `<div class="summary-row"><span class="summary-label">Sector</span><span class="summary-value">${escHTML(submission.sector)}</span></div>` : ''}
          ${submission.size ? `<div class="summary-row"><span class="summary-label">Size</span><span class="summary-value">${escHTML(submission.size)}</span></div>` : ''}
          ${submission.frequency ? `<div class="summary-row"><span class="summary-label">Frequency</span><span class="summary-value">${escHTML(submission.frequency)}</span></div>` : ''}
          ${submission.estimate ? `<div class="summary-row"><span class="summary-label">Indicative Estimate</span><span class="summary-value">&pound;${escHTML(submission.estimate).replace('/wk', '')} per week</span></div>` : ''}
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
// Trust proxy for accurate IP addresses (1 = trust single Nginx reverse proxy)
app.set('trust proxy', 1);

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

// ============================================
// DYNAMIC SITEMAP — auto-generated from files + DB
// ============================================
const SITE_URL = 'https://signature-cleans.co.uk';

// Page config: priority, changefreq by path pattern
function getSitemapConfig(urlPath) {
  if (urlPath === '/') return { priority: '1.0', changefreq: 'weekly' };
  if (urlPath === '/quote.html' || urlPath === '/estimator.html') return { priority: '0.9', changefreq: 'monthly' };
  if (urlPath === '/about.html' || urlPath === '/contact.html') return { priority: '0.8', changefreq: 'monthly' };
  if (urlPath === '/services.html') return { priority: '0.8', changefreq: 'monthly' };
  if (urlPath.startsWith('/services/')) return { priority: '0.8', changefreq: 'monthly' };
  if (urlPath.startsWith('/areas/')) return { priority: '0.7', changefreq: 'monthly' };
  if (urlPath === '/blog.html') return { priority: '0.7', changefreq: 'weekly' };
  if (urlPath.startsWith('/blog/')) return { priority: '0.6', changefreq: 'monthly' };
  if (['/privacy.html', '/terms.html', '/cookies.html'].includes(urlPath)) return { priority: '0.3', changefreq: 'yearly' };
  return { priority: '0.5', changefreq: 'monthly' };
}

// Excluded from sitemap
const SITEMAP_EXCLUDE = new Set(['/thank-you.html', '/sitemap.xml', '/robots.txt']);

function scanHtmlFiles(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const urlPath = base + '/' + entry.name;
    if (entry.isDirectory()) {
      // Skip non-content directories
      if (['css', 'js', 'images', 'fonts'].includes(entry.name)) continue;
      results.push(...scanHtmlFiles(fullPath, urlPath));
    } else if (entry.name.endsWith('.html') && !SITEMAP_EXCLUDE.has(urlPath)) {
      const stats = fs.statSync(fullPath);
      results.push({
        urlPath,
        lastmod: stats.mtime.toISOString().split('T')[0]
      });
    }
  }
  return results;
}

app.get('/sitemap.xml', (req, res) => {
  try {
    const publicDir = path.join(__dirname, 'public');
    const pages = scanHtmlFiles(publicDir, '');

    // Add homepage
    const indexFile = path.join(publicDir, 'index.html');
    const indexMod = fs.existsSync(indexFile) ? fs.statSync(indexFile).mtime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Group pages by type for organized output
    const core = [];
    const services = [];
    const areas = [];
    const blog = [];
    const legal = [];

    for (const page of pages) {
      if (page.urlPath === '/index.html') continue; // handled as homepage
      if (page.urlPath.startsWith('/services/')) services.push(page);
      else if (page.urlPath === '/services.html') services.unshift(page);
      else if (page.urlPath.startsWith('/areas/')) areas.push(page);
      else if (page.urlPath.startsWith('/blog/')) blog.push(page);
      else if (page.urlPath === '/blog.html') blog.unshift(page);
      else if (['/privacy.html', '/terms.html', '/cookies.html'].includes(page.urlPath)) legal.push(page);
      else core.push(page);
    }

    function urlEntry(loc, lastmod, config) {
      return `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${config.changefreq}</changefreq>\n    <priority>${config.priority}</priority>\n  </url>`;
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += '\n  <!-- Homepage -->\n';
    xml += urlEntry('/', indexMod, getSitemapConfig('/')) + '\n';

    // Core pages
    if (core.length) {
      xml += '\n  <!-- Core Pages -->\n';
      for (const p of core) xml += urlEntry(p.urlPath, p.lastmod, getSitemapConfig(p.urlPath)) + '\n';
    }

    // Services
    if (services.length) {
      xml += '\n  <!-- Services -->\n';
      for (const p of services) xml += urlEntry(p.urlPath, p.lastmod, getSitemapConfig(p.urlPath)) + '\n';
    }

    // Areas
    if (areas.length) {
      xml += '\n  <!-- Service Areas -->\n';
      for (const p of areas) xml += urlEntry(p.urlPath, p.lastmod, getSitemapConfig(p.urlPath)) + '\n';
    }

    // Blog
    if (blog.length) {
      xml += '\n  <!-- Blog -->\n';
      for (const p of blog) xml += urlEntry(p.urlPath, p.lastmod, getSitemapConfig(p.urlPath)) + '\n';
    }

    // Legal
    if (legal.length) {
      xml += '\n  <!-- Legal -->\n';
      for (const p of legal) xml += urlEntry(p.urlPath, p.lastmod, getSitemapConfig(p.urlPath)) + '\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
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
// QUOTE ESTIMATOR CONFIG — Hours-Based Pricing
// Flat £27/hr rate. Visitor selects estimated hours per visit.
// Contact details required BEFORE estimator is accessible.
// ============================================
const ESTIMATOR_CONFIG = {
  billingRate: 27,          // £27/hr flat rate
  weeksPerMonth: 4.33
};

// ============================================
// API ROUTES
// ============================================

// Estimate endpoint — Hours-based, contact-gated
app.post('/api/estimate', rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  try {
    const { siteType, hours, frequency, name, email, phone, company, postcode, website } = req.body;

    // Honeypot check
    if (website && website.trim() !== '') return res.json({ success: true, estimate: { weeklyPrice: 0, monthlyPrice: 0, weeklyHours: 0, cellType: 'A', cellLabel: 'Small Site' } });

    // Validate contact details (required — this gates the estimator)
    const errors = [];
    if (!name || name.trim().length < 2) errors.push('Name is required');
    if (!email || !validator.isEmail(email)) errors.push('Valid email is required');
    if (!phone || phone.replace(/\D/g, '').length < 10) errors.push('Valid phone number is required');
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const freq = parseInt(frequency);
    const hrs = parseFloat(hours);

    if (!hrs || hrs < 2 || hrs > 40 || !freq || freq < 1 || freq > 7) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    // Whitelist site types (contain / which validator.escape would encode)
    const validSiteTypes = ['Office/Commercial', 'Dental/Medical', 'Hospitality/Venue', 'Education/Institutional', 'Welfare/Construction', 'Specialist/Industrial'];
    const cleanSiteType = validSiteTypes.includes(siteType) ? siteType : sanitize(siteType || '');

    // Calculate estimate at £27/hr
    const weeklyHours = hrs * freq;
    const weeklyPrice = Math.round(weeklyHours * ESTIMATOR_CONFIG.billingRate / 5) * 5;
    const monthlyPrice = Math.round(weeklyPrice * ESTIMATOR_CONFIG.weeksPerMonth / 10) * 10;
    const siteVisitRecommended = weeklyHours >= 30;

    // Cell type classification
    let cellType, cellLabel;
    if (weeklyHours <= 15) {
      cellType = 'A'; cellLabel = 'Small Site';
    } else if (weeklyHours <= 30) {
      cellType = 'B'; cellLabel = 'Medium Site';
    } else {
      cellType = 'C'; cellLabel = 'Large Site';
    }

    // Save lead to database
    const estimateStr = weeklyPrice + '/wk' + (siteVisitRecommended ? ' (site visit recommended)' : '');
    const submission = {
      type: 'quote',
      name: sanitize(name),
      email: validator.normalizeEmail(email) || '',
      phone: sanitize(phone),
      company: sanitize(company || ''),
      postcode: sanitize(postcode || ''),
      message: '',
      serviceType: 'contract',
      frequency: String(freq),
      size: '',
      sector: cleanSiteType,
      leadSource: 'website-estimator',
      estimate: estimateStr,
      estimatedHours: String(hrs),
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

    // Send notification + auto-reply (non-blocking)
    sendNotificationEmail(submission).catch(() => {});
    sendAutoReplyEmail(submission).catch(() => {});
    zoho.pushLead(submission).catch(() => {});

    res.json({
      success: true,
      estimate: {
        cellType, cellLabel,
        weeklyPrice, monthlyPrice,
        weeklyHours,
        siteVisitRecommended
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
  const publicDir = path.join(__dirname, 'public');
  const filePath = path.resolve(publicDir, req.path.replace(/^\//, ''));
  if (!filePath.startsWith(publicDir)) return res.status(403).send('Forbidden');
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
