const OpenAI     = require('openai')
const formidable = require('formidable')
const fs         = require('fs')
const nodemailer = require('nodemailer')

// ── CONFIG ──────────────────────────────────────────────────
// Di Vercel dashboard → Settings → Environment Variables
// Tambah: OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxxxxx
// ────────────────────────────────────────────────────────────
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── ATS Scoring (no API needed) ──
const STOP_WORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','will','would','could','should','this','that','these','those','not','no','its','our','your','their','my','his','her','as','if','so'])

function extractKeywords(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s\-+#.]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  return Array.from(new Set(words))
}

function calculateATSScore(resumeText, jobDescText) {
  const resumeLower  = resumeText.toLowerCase()
  const jobKeywords  = extractKeywords(jobDescText).filter(k => k.length > 4).slice(0, 50)
  const matched      = jobKeywords.filter(k => resumeLower.includes(k))
  const missing      = jobKeywords.filter(k => !resumeLower.includes(k))
  const keywordScore = jobKeywords.length > 0 ? Math.round((matched.length / jobKeywords.length) * 100) : 50

  const formatIssues = []
  if (!resumeLower.includes('experience') && !resumeLower.includes('work history')) formatIssues.push('Missing "Experience" section')
  if (!resumeLower.includes('education'))  formatIssues.push('Missing "Education" section')
  if (!resumeLower.includes('skills'))     formatIssues.push('No skills section detected')

  const sectionScore = Math.max(0, 100 - formatIssues.length * 20)
  const score        = Math.min(100, Math.max(5, Math.round(keywordScore * 0.7 + sectionScore * 0.3)))

  return { score, matchedKeywords: matched.slice(0, 15), missingKeywords: missing.slice(0, 10), formatIssues }
}

// ── CORS helper ──
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ── /api/analyze ──
module.exports.analyze = async (req, res) => {
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
      const buffer   = fs.readFileSync(file.filepath)
      const parsed   = await pdfParse(buffer)
      resumeText     = parsed.text
    } else {
      resumeText = fs.readFileSync(file.filepath, 'utf8')
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text. Please try a PDF or TXT file.' })
    }

    const beforeATS = calculateATSScore(resumeText, jobDesc)

    const completion = await client.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 4096,
      messages: [{
        role:    'user',
        content: `You are an expert resume writer and ATS optimization specialist.

Rewrite the resume below to be optimized for the job description provided.

RULES:
1. Keep ALL facts accurate — do not invent experience or skills
2. Naturally incorporate missing keywords where truthful: ${beforeATS.missingKeywords.join(', ')}
3. Use strong action verbs matching the job description
4. Ensure clear sections: Summary, Experience, Education, Skills
5. Output ONLY the rewritten resume text, no commentary

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
    console.error(err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

// ── /api/send-email ──
module.exports.sendEmail = async (req, res) => {
  setCORS(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { email, resumeText } = req.body
    if (!email || !resumeText) return res.status(400).json({ error: 'Missing email or resume' })

    const transporter = nodemailer.createTransporter({
      host:   'smtp.hostinger.com',
      port:   465,
      secure: true,
      auth:   { user: process.env.EMAIL_FROM, pass: process.env.EMAIL_PASSWORD }
    })

    await transporter.sendMail({
      from:    `ATSPass <${process.env.EMAIL_FROM}>`,
      to:      email,
      subject: 'Your optimized resume is ready — ATSPass',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#111">
          <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Your resume is ready ✓</h1>
          <p style="color:#666;margin-bottom:24px">Here's your ATS-optimized resume. Copy the content below into Word or Google Docs and format it.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;white-space:pre-wrap;font-size:14px;line-height:1.7;color:#374151">${resumeText}</div>
          <p style="margin-top:28px;color:#666;font-size:13px">You have 9 more optimizations remaining. Come back anytime at <a href="${process.env.APP_URL}" style="color:#16a34a">${process.env.APP_URL}</a></p>
        </div>`,
      attachments: [{ filename: 'resume-optimized.txt', content: resumeText, contentType: 'text/plain' }]
    })

    if (process.env.ADMIN_EMAIL) {
      await transporter.sendMail({
        from:    `ATSPass <${process.env.EMAIL_FROM}>`,
        to:      process.env.ADMIN_EMAIL,
        subject: `💰 New ATSPass payment — ${email}`,
        text:    `New customer: ${email}\nTime: ${new Date().toISOString()}`
      })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to send email.' })
  }
}
