# Tracker App

Personal productivity tracker with multiplayer features.

## Deploy to Vercel

1. Create a GitHub account at github.com if you don't have one
2. Create a new repository called `tracker-app`
3. Upload all these files to the repository
4. Go to vercel.com → "Add New Project" → import your GitHub repo
5. Vercel auto-detects React — just click Deploy
6. Once deployed, copy your Vercel URL (e.g. https://tracker-app-xyz.vercel.app)
7. Go to Supabase → Authentication → URL Configuration → add your Vercel URL to "Redirect URLs"
8. Go to Google Cloud → OAuth Client → add your Vercel URL to "Authorized JavaScript Origins" and `https://your-vercel-url.vercel.app` to "Authorized redirect URIs" alongside the Supabase one

## Stack
- React (Create React App)
- Supabase (auth + database + realtime)
- Vercel (hosting)
