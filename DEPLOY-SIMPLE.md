# Quick Deploy Guide (5 Minutes)

## 🎯 Easiest Option: Railway

### What You Need:
- GitHub account (free)
- Railway account (free trial)
- 5 minutes

### Steps:

1. **Push to GitHub:**
   ```bash
   cd "/Users/nelsoniseguan/Downloads/signature-cleans-production 2"
   git init  # if not already a git repo
   git add .
   git commit -m "Initial commit"
   
   # Create repo on github.com first, then:
   git remote add origin https://github.com/YOUR-USERNAME/signature-cleans-website.git
   git push -u origin main
   ```

2. **Deploy on Railway:**
   - Go to https://railway.app
   - Click "Start a New Project"
   - Sign in with GitHub
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects Node.js and deploys!

3. **Add Password:**
   - Click your project → "Variables"
   - Add: `ADMIN_PASSWORD` = `your_strong_password_here`
   - (Optional) Add: `NODE_ENV` = `production`

4. **Get Your URL:**
   - Click "Settings"
   - Click "Generate Domain"
   - Your site is live! 🎉

5. **Test:**
   - Visit your Railway URL
   - Test a form submission
   - Visit `/admin` (username: `admin`, password: your ADMIN_PASSWORD)

### That's It!

Your site is live. Any changes you push to GitHub will auto-deploy.

**Cost:** Free trial, then ~$5/month

---

## 🆓 Free Option: Render

1. Go to https://render.com
2. Sign in with GitHub
3. Click "New +" → "Web Service"
4. Select your GitHub repo
5. Click "Create Web Service"
6. Add environment variables (same as Railway)
7. Done!

**Cost:** Free (but spins down after 15min inactivity)

---

## ❓ Which Should I Choose?

- **Railway:** Easiest, best for beginners, auto-deploys
- **Render:** Free option, good for testing
- **Elestio:** If you specifically want managed hosting

**Recommendation:** Start with Railway - it's the easiest! 🚀


