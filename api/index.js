const OpenAI     = require('openai')
const formidable = require('formidable')
const fs         = require('fs')
const nodemailer = require('nodemailer')

// ── CONFIG ──────────────────────────────────────────────────
// Vercel → Settings → Environment Variables
// OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxxxxx
// ────────────────────────────────────────────────────────────
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── CORS ──
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ── ATS Scoring (no API needed) ──
const STOP_WORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','will','would','could','should','this','that','these','those','not','no','its','our','your','their','my','his','her','as','if','so'])

function extractKeywords(text) {
  return Array.from(new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  ))
}

function calculateATSScore(resumeText, jobDescText) {
  const resumeLower  = resumeText.toLowerCase()
  const jobKeywords  = extractKeywords(jobDescText).filter(k => k.length > 4).slice(0, 50)
  const matched      = jobKeywords.filter(k => resumeLower.includes(k))
  const missing      = jobKeywords.filter(k => !resumeLower.includes(k))
  const keywordScore = jobKeywords.length > 0 ? Math.round((matched.length / jobKeywords.length) * 100) : 50
  const formatIssues = []
  if (!resumeLower.includes('experience')) formatIssues.push('Missing "Experience" section')
  if (!resumeLower.includes('education'))  formatIssues.push('Missing "Education" section')
  if (!resumeLower.includes('skills'))     formatIssues.push('No skills section detected')
  const sectionScore = Math.max(0, 100 - formatIssues.length * 20)
  const score = Math.min(100, Math.max(5, Math.round(keywordScore * 0.7 + sectionScore * 0.3)))
  return { score, matchedKeywords: matched.slice(0,15), missingKeywords: missing.slice(0,10), formatIssues }
}

// ── Handler: /api/analyze ──
async function analyze(req, res) {
  setCORS(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  try {
    const form = formidable({ maxFileSize: 5 * 1024 * 1024 })
    const [fields, files] = await form.parse(req)
    const jobDesc = Array.isArray(fields.jobDesc) ? fields.jobDesc[0] : fields.jobDesc
    const file    = Array.isArray(files.resume)   ? files.resume[0]   : files.resume

    if (!file || !jobDesc) return res.status(400).json({ error: 'Resume and job description required.' })

    let resumeText = ''
    if (file.mimetype === 'application/pdf' || file.originalFilename?.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      resumeText = (await pdfParse(fs.readFileSync(file.filepath))).text
    } else {
      resumeText = fs.readFileSync(file.filepath, 'utf8')
    }

    if (!resumeText || resumeText.trim().length < 50)
      return res.status(400).json({ error: 'Could not extract text. Try a PDF or TXT file.' })

    const beforeATS = calculateATSScore(resumeText, jobDesc)

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 4096,
      messages: [{ role: 'user', content:
        `You are an expert resume writer and ATS specialist. Rewrite the resume below optimized for this job description.
RULES: Keep all facts accurate. Incorporate these missing keywords naturally: ${beforeATS.missingKeywords.join(', ')}.
Use strong action verbs. Keep sections: Summary, Experience, Education, Skills. Output ONLY the resume text.

---JOB DESCRIPTION---
${jobDesc.slice(0, 3000)}

---ORIGINAL RESUME---
${resumeText.slice(0, 3000)}

Rewrite now:`
      }]
    })

    const rewrittenResume = completion.choices[0].message.content || ''
    const afterATS = calculateATSScore(rewrittenResume, jobDesc)

    res.status(200).json({
      success: true,
      before: { score: beforeATS.score, matchedKeywords: beforeATS.matchedKeywords, missingKeywords: beforeATS.missingKeywords, formatIssues: beforeATS.formatIssues },
      after:  { score: afterATS.score,  matchedKeywords: afterATS.matchedKeywords,  missingKeywords: afterATS.missingKeywords },
      rewrittenResume,
      originalResume: resumeText,
    })
  } catch (err) {
    console.error('analyze error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

// ── Handler: /api/send-email ──
async function sendEmail(req, res) {
  setCORS(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { email, resumeText } = req.body
    if (!email || !resumeText) return res.status(400).json({ error: 'Missing email or resume.' })

    const transporter = nodemailer.createTransporter({
      host: 'smtp.hostinger.com', port: 465, secure: true,
      auth: { user: process.env.EMAIL_FROM, pass: process.env.EMAIL_PASSWORD }
    })

    await transporter.sendMail({
      from:    `ATSPass <${process.env.EMAIL_FROM}>`,
      to:      email,
      subject: 'Your optimized resume is ready — ATSPass',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#111">
          <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Your resume is ready ✓</h1>
          <p style="color:#666;margin-bottom:24px">Copy the content below into Word or Google Docs and format it.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;white-space:pre-wrap;font-size:14px;line-height:1.7;color:#374151">${resumeText}</div>
          <p style="margin-top:28px;color:#999;font-size:12px">You have 9 more optimizations remaining. <a href="${process.env.APP_URL}" style="color:#16a34a">ATSPass</a></p>
        </div>`,
      attachments: [{ filename: 'resume-optimized.txt', content: resumeText, contentType: 'text/plain' }]
    })

    if (process.env.ADMIN_EMAIL) {
      await transporter.sendMail({
        from:    `ATSPass <${process.env.EMAIL_FROM}>`,
        to:      process.env.ADMIN_EMAIL,
        subject: `💰 New ATSPass payment — ${email}`,
        text:    `Customer: ${email}\nTime: ${new Date().toISOString()}`
      })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('sendEmail error:', err)
    res.status(500).json({ error: 'Failed to send email.' })
  }
}
