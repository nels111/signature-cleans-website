# Setting Up Git for Deployment

If you haven't set up git yet, here's how:

## Quick Setup

1. **Check if git is installed:**
   ```bash
   git --version
   ```
   If it says "command not found", install git first.

2. **Initialize git repository:**
   ```bash
   cd "/Users/nelsoniseguan/Downloads/signature-cleans-production 2"
   git init
   ```

3. **Add all files:**
   ```bash
   git add .
   ```

4. **Make first commit:**
   ```bash
   git commit -m "Initial commit - production ready website"
   ```

5. **Create GitHub repository:**
   - Go to https://github.com/new
   - Repository name: `signature-cleans-website`
   - Choose Private or Public
   - **Don't** check "Initialize with README"
   - Click "Create repository"

6. **Connect to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/signature-cleans-website.git
   git branch -M main
   git push -u origin main
   ```
   (Replace `YOUR-USERNAME` with your actual GitHub username)

7. **Enter GitHub credentials** when prompted (or use GitHub Desktop app for easier authentication)

## Done!

Now your code is on GitHub and ready to deploy on Railway/Render/Elestio.

## Using GitHub Desktop (Easier for Beginners)

If command line is scary:

1. Download GitHub Desktop: https://desktop.github.com
2. Sign in with GitHub
3. Click "File" → "Add Local Repository"
4. Browse to your project folder
5. Commit and push from the app (much easier!)


