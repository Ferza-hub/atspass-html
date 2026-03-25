# ATSPass — ATS Resume Optimizer

> Upload resume + paste job description → see ATS score before/after → pay $5 → get optimized resume via email.

**Live demo:** [atspass.ranevaoli.site](https://atspass.ranevaoli.site)  
**Built by:** [Ranevaoli Create](https://ranevaoli.site)

---

## What it does

Most resumes never reach a human — ATS filters them out before anyone reads a single word, usually because of missing keywords.

ATSPass shows users exactly why they're getting ghosted:

1. Upload resume (PDF or TXT)
2. Paste any job description
3. See ATS match score before & after AI optimization
4. Pay $5 → receive optimized resume via email

---

## Tech stack

- **Frontend** — Pure HTML/CSS/JS (no framework, no build step)
- **Backend** — Node.js serverless function
- **AI** — OpenAI GPT-4o-mini
- **Deploy** — Vercel (free tier works)
- **Payment** — PayPal.me (zero setup)
- **Email** — Nodemailer + Hostinger SMTP

---

## Project structure

```
atspass/
├── index.html        ← Full UI (landing page + tool)
├── privacy.html      ← Privacy policy
├── terms.html        ← Terms of use
├── api/
│   └── index.js      ← Backend (analyze + send email)
├── vercel.json       ← Routing + function config
└── package.json      ← Dependencies
```

---

## Deploy in 5 minutes

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/atspass.git
cd atspass
npm install
```

### 2. Set environment variables

Create `.env.local` in root:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
EMAIL_FROM=your@email.com
EMAIL_PASSWORD=your-email-password
ADMIN_EMAIL=your@email.com
APP_URL=https://your-domain.com
```

### 3. Test locally

Open `index.html` directly in browser for UI preview.

For API testing, run via Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

### 4. Deploy to Vercel

```bash
git add .
git commit -m "initial commit"
git push origin main
```

Then:
1. Go to [vercel.com](https://vercel.com) → New Project → Import repo
2. Add all environment variables in Vercel dashboard
3. Deploy → done ✓

### 5. Add custom domain (optional)

Vercel dashboard → Settings → Domains → Add your domain.

For subdomain (e.g. `atspass.yourdomain.com`), add CNAME record in your DNS:
```
Type:  CNAME
Name:  atspass
Value: cname.vercel-dns.com
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | From [platform.openai.com](https://platform.openai.com) |
| `EMAIL_FROM` | Your SMTP email address |
| `EMAIL_PASSWORD` | Your SMTP email password |
| `ADMIN_EMAIL` | Your email — receives payment notifications |
| `APP_URL` | Your live URL (e.g. https://atspass.ranevaoli.site) |

---

## Payment flow

Uses PayPal.me (no webhook needed):

1. User analyzes resume → sees before/after ATS score
2. User clicks "Pay $5 via PayPal" → completes payment
3. User returns → enters email → clicks send
4. App emails optimized resume to user
5. You receive payment notification at `ADMIN_EMAIL`

To upgrade to automated Stripe payments later, replace PayPal.me with a Stripe Payment Link and add a webhook to `/api/index.js`.

---

## Pricing tiers

| Plan | Price | Applications |
|------|-------|-------------|
| Starter | $5 one-time | 10 |
| Pro Pack | $12 one-time | 30 |
| Hustler | $25 one-time | Unlimited / 1 year |
| Pro | $12/month | Unlimited |

Update `NEXT_PUBLIC_PAYPAL_LINK` in `index.html` to match your PayPal.me username.

---

## Customization

**Change brand name** — search & replace `ATSPass` in all files.

**Change pricing** — edit the pricing section in `index.html`.

**Change email template** — edit the HTML email in `api/index.js` sendEmail function.

**Change SMTP provider** — update host/port in `api/index.js`:
```javascript
// Gmail
host: 'smtp.gmail.com', port: 465, secure: true

// Hostinger
host: 'smtp.hostinger.com', port: 465, secure: true

// Any provider
host: 'your-smtp-host', port: 465, secure: true
```

---

## ATS scoring

The ATS score is calculated locally — no external API needed:

- **Keyword matching (70%)** — extracts keywords from job description, checks how many appear in resume
- **Format check (30%)** — verifies standard sections (Experience, Education, Skills) are present

This covers 90% of real-world ATS use cases. For full ATS simulation (Workday, Greenhouse, etc.), that requires paid third-party APIs like Jobscan.

---

## Source code license

Single use — deploy for yourself or one client.  
For multiple deployments, purchase additional licenses.

Questions? [hello@ranevaoli.site](mailto:hello@ranevaoli.site)

---

© 2025 ATSPass · [Ranevaoli Create](https://ranevaoli.site) · [Privacy](/privacy.html) · [Terms](/terms.html)
