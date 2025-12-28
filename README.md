# Signature Cleans Website

Production website for Signature Cleans Ltd - Commercial Cleaning Services in Devon, Cornwall & Somerset.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode (with auto-reload)
npm run dev
```

The site will be available at `http://localhost:3000`

## Environment Variables

For local development, create a `.env` file in the root directory with the following variables (the server will automatically load it):

For production deployment, set these as environment variables in your hosting platform:

```env
# Server
PORT=3000

# Admin Panel
ADMIN_PASSWORD=your_secure_password_here

# Email Configuration (optional - submissions will be logged without email)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password

# Email Recipients
EMAIL_FROM=website@signature-cleans.co.uk
EMAIL_TO=nick@signature-cleans.co.uk
```

## Features

### Frontend
- Responsive, Apple-inspired design
- Infinite logo carousel
- Animated statistics
- Mobile-optimised navigation
- SEO-optimised pages with meta tags and JSON-LD schema

### Backend
- Express.js server
- SQLite database for form submissions
- Email notifications via Nodemailer
- Rate limiting for API endpoints
- Honeypot spam protection
- Admin dashboard

### Pages
- Homepage (`/`)
- About (`/about.html`)
- Services:
  - Contract Cleaning (`/services/contract-cleaning.html`)
  - Deep Cleaning (`/services/deep-cleaning.html`)
  - Specialist Services (`/services/specialist-services.html`)
- Blog with articles
- Areas (Devon, Cornwall, Somerset)
- Quote form
- Contact form
- Legal pages (Privacy, Cookies, Terms)
- Thank you confirmation page

## API Endpoints

### POST /api/quote
Submit a quote request.

**Fields:**
- `name` (required)
- `email` (required)
- `phone`
- `company`
- `postcode`
- `serviceType` (required)
- `sector` (required)
- `frequency`
- `size`
- `message`
- `leadSource`

### POST /api/contact
Submit a contact message.

**Fields:**
- `name` (required)
- `email` (required)
- `phone`
- `company`
- `message` (required, min 10 chars)

## Admin Panel

Access the admin dashboard at `/admin`

**Default credentials (development only):**
- Username: `admin`
- Password: `signature2025` 

⚠️ **IMPORTANT:** Always set `ADMIN_PASSWORD` environment variable in production! The server will warn if using the default password.

Features:
- View all submissions
- Filter by type (quote/contact)
- Pagination
- Statistics overview

## Deployment

### Render / Railway / Heroku

1. Connect your Git repository
2. Set environment variables in the dashboard
3. Set start command: `npm start`
4. Deploy

### VPS / Traditional Hosting

1. Clone the repository
2. Run `npm install --production`
3. Set environment variables
4. Use PM2 or similar process manager:
   ```bash
   pm2 start server.js --name "signature-cleans"
   ```

### Nginx Reverse Proxy (recommended)

```nginx
server {
    listen 80;
    server_name signature-cleans.co.uk www.signature-cleans.co.uk;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## File Structure

```
├── server.js           # Express server
├── package.json        # Dependencies
├── data/               # SQLite database (created automatically)
└── public/             # Static files
    ├── index.html
    ├── about.html
    ├── blog.html
    ├── contact.html
    ├── quote.html
    ├── thank-you.html
    ├── privacy.html
    ├── cookies.html
    ├── terms.html
    ├── sitemap.xml
    ├── robots.txt
    ├── css/
    ├── js/
    ├── images/
    ├── services/
    ├── areas/
    └── blog/
```

## Test Checklist

- [ ] Homepage loads correctly
- [ ] All navigation links work
- [ ] Mobile menu functions
- [ ] Quote form submits successfully
- [ ] Contact form submits successfully
- [ ] Thank you page displays after submission
- [ ] Admin panel accessible with correct credentials
- [ ] Email notifications sent (if configured)
- [ ] No console errors in browser
- [ ] All images load
- [ ] Logo displays correctly throughout site

## Support

For technical issues, contact the development team.

For business enquiries:
- Phone: 01392 931035
- Email: nick@signature-cleans.co.uk

---

© 2025 Signature Cleans Ltd. All rights reserved.
