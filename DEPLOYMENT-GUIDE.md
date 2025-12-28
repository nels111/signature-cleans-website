# Deployment Guide - Signature Cleans Website

**For Complete Beginners** 🚀

This guide will walk you through deploying your website step-by-step. No technical experience needed!

## Quick Comparison: Where Should I Deploy?

### 🟢 Recommended for Beginners (Easiest)

1. **Railway** ⭐ BEST FOR BEGINNERS
   - ✅ Free trial ($5 credit, ~30 days)
   - ✅ Easiest setup (connects to GitHub)
   - ✅ Auto-deploys on every git push
   - ✅ Built-in database support
   - ✅ Free SSL certificate
   - 💰 ~$5-10/month after trial

2. **Render** ⭐ GREAT FREE OPTION
   - ✅ Free tier available (with limits)
   - ✅ Easy setup
   - ✅ Free SSL
   - ⚠️ Spins down after inactivity (15min startup on free tier)
   - 💰 $7/month for always-on

3. **Elestio** ⭐ YOUR MENTIONED CHOICE
   - ✅ Managed hosting, beginner-friendly
   - ✅ Good support
   - ✅ Professional setup
   - 💰 Pricing varies (~$10-20/month)

### 🟡 Other Options

- **DigitalOcean App Platform** - Good but more complex
- **Heroku** - Popular but no longer has free tier
- **Vercel/Netlify** - Great for static sites, but this has a backend so not ideal

---

## 🎯 Recommended: Railway (Easiest for Beginners)

### Step 1: Prepare Your Code

1. **Open Terminal/Command Prompt** on your computer
2. **Navigate to your project folder:**
   ```bash
   cd "/Users/nelsoniseguan/Downloads/signature-cleans-production 2"
   ```

3. **Make sure everything is committed to git:**
   ```bash
   git status
   ```
   If you see files listed, commit them:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   ```

### Step 2: Create GitHub Account (if you don't have one)

1. Go to https://github.com and sign up (free)
2. Create a new repository:
   - Click "New Repository"
   - Name it: `signature-cleans-website`
   - Make it **Private** (or Public, your choice)
   - **Don't** initialize with README (you already have files)
   - Click "Create repository"

3. **Push your code to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/signature-cleans-website.git
   git branch -M main
   git push -u origin main
   ```
   (Replace `YOUR-USERNAME` with your GitHub username)

### Step 3: Deploy on Railway

1. **Sign up for Railway:**
   - Go to https://railway.app
   - Click "Start a New Project"
   - Sign up with GitHub (easiest)

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `signature-cleans-website` repository
   - Railway will automatically detect it's a Node.js app

3. **Configure Environment Variables:**
   - Click on your project
   - Go to "Variables" tab
   - Add these variables (click "New Variable" for each):

   ```
   NODE_ENV=production
   PORT=3000
   ADMIN_PASSWORD=your_secure_password_here
   ```

   ⚠️ **IMPORTANT:** Choose a strong password for `ADMIN_PASSWORD` (not "signature2025"!)

   (Optional - for email notifications):
   ```
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@example.com
   SMTP_PASS=your_email_password
   EMAIL_FROM=website@signature-cleans.co.uk
   EMAIL_TO=nick@signature-cleans.co.uk
   ```

4. **Deploy:**
   - Railway will automatically start deploying
   - Wait 2-3 minutes
   - Once done, click "Settings" → "Generate Domain"
   - Your site will be live at something like: `your-site.railway.app`

5. **Custom Domain (Optional):**
   - In Railway settings, click "Custom Domain"
   - Enter your domain (e.g., `signature-cleans.co.uk`)
   - Railway will give you DNS instructions
   - Update your domain's DNS records as instructed
   - Wait 5-10 minutes for DNS to propagate

### Step 4: Test Your Site

1. Visit your Railway URL
2. Test the homepage
3. Test the quote form (submit a test request)
4. Test the contact form
5. Check `/admin` works with your password

---

## 🚀 Alternative: Render

### Step 1: Same as Railway (GitHub setup)

### Step 2: Deploy on Render

1. **Sign up:**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect Node.js

3. **Configure:**
   - **Name:** signature-cleans-website
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter for $7/month - always on)

4. **Add Environment Variables:**
   - Click "Environment" tab
   - Add the same variables as Railway (see above)

5. **Deploy:**
   - Click "Create Web Service"
   - Wait 3-5 minutes
   - Your site will be at: `your-site.onrender.com`

---

## 🎯 Alternative: Elestio

If you specifically want to use Elestio:

1. **Sign up:**
   - Go to https://elest.io
   - Create an account

2. **Create Node.js App:**
   - Click "Create" → "Node.js App"
   - Connect your GitHub repository
   - Select your `signature-cleans-website` repo

3. **Configure:**
   - **Port:** 3000
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - Add environment variables (same as Railway)

4. **Deploy:**
   - Click "Deploy"
   - Elestio will handle the rest

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure:

- [ ] All files are committed to git
- [ ] You have a strong `ADMIN_PASSWORD` ready
- [ ] You've tested locally (`npm start` works)
- [ ] You have your domain ready (if using custom domain)
- [ ] Email credentials ready (if using email notifications)

---

## 🔒 Important Security Notes

1. **Change Default Admin Password:**
   - Never use "signature2025" in production
   - Use a strong, unique password
   - Store it securely (password manager)

2. **Environment Variables:**
   - Never commit `.env` file to GitHub
   - Always set variables in your hosting platform
   - `.env` is already in `.gitignore` (good!)

3. **Database:**
   - SQLite file (`data/submissions.db`) will be created automatically
   - On most platforms, this persists between deployments
   - Consider upgrading to PostgreSQL later for production

---

## 🐛 Troubleshooting

### Site Won't Start

1. **Check Logs:**
   - Railway: Click your project → "Deployments" → View logs
   - Render: Click your service → "Logs" tab
   - Look for error messages

2. **Common Issues:**
   - Missing environment variables → Add them
   - Port conflict → Make sure PORT is set to 3000
   - Build fails → Check Node.js version (needs 18+)

### Forms Don't Work

1. **Check API endpoint:**
   - Visit: `https://your-site.com/api/quote` (should return 405 Method Not Allowed - that's OK)
   - If 404, the route isn't set up

2. **Check CORS:**
   - Forms should work if deployed correctly
   - Check browser console for errors

### Can't Access Admin

1. **Check password:**
   - Make sure `ADMIN_PASSWORD` is set correctly
   - Use Basic Auth: username `admin`, password (your ADMIN_PASSWORD)

2. **Check URL:**
   - Should be: `https://your-site.com/admin`

---

## 📊 Recommended: Railway (My Top Pick)

**Why Railway:**
- ✅ Easiest setup (literally 5 minutes)
- ✅ Great for beginners
- ✅ Auto-deploys when you push to GitHub
- ✅ Free trial to test
- ✅ Good documentation
- ✅ Professional enough for production

**Cost:** ~$5-10/month after free trial

---

## 🎓 Next Steps After Deployment

1. **Set up custom domain** (if you have one)
2. **Test all forms** thoroughly
3. **Monitor the admin panel** for submissions
4. **Set up email notifications** (optional but recommended)
5. **Consider upgrading database** to PostgreSQL (later)

---

## 📞 Need Help?

- **Railway Docs:** https://docs.railway.app
- **Render Docs:** https://render.com/docs
- **Elestio Docs:** Check their website

---

## ✅ Quick Start (TL;DR)

1. Push code to GitHub
2. Sign up for Railway
3. Connect GitHub repo
4. Add environment variables
5. Deploy!
6. Test your site

**That's it!** Your site will be live in ~5 minutes.

---

**Good luck! 🚀**


