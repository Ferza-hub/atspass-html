const formidable = require('formidable')
const fs = require('fs')
const client = require('../lib/openai')
const { calculateATSScore } = require('../lib/ats')

// ⛔ WAJIB untuk upload file di Vercel
export const config = {
  api: {
    bodyParser: false
  }
}

// CORS
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

module.exports = async function handler(req, res) {
  setCORS(res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const form = new formidable.IncomingForm({
  maxFileSize: 5 * 1024 * 1024
})

    // 🔥 FIX: parse pakai callback biar stabil di serverless
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err)
        resolve({ fields, files })
      })
    })

    const jobDesc = Array.isArray(fields.jobDesc)
      ? fields.jobDesc[0]
      : fields.jobDesc

    const file = Array.isArray(files.resume)
      ? files.resume[0]
      : files.resume

    if (!file || !jobDesc) {
      return res.status(400).json({
        error: 'Resume and job description required.'
      })
    }

    let resumeText = ''

    if (
      file.mimetype === 'application/pdf' ||
      file.originalFilename?.endsWith('.pdf')
    ) {
      const pdfParse = require('pdf-parse')
      const buffer = fs.readFileSync(file.filepath)
      try {
      const pdfParse = require('pdf-parse')
      const buffer = fs.readFileSync(file.filepath)
      const parsed = await pdfParse(buffer)

      resumeText = parsed.text

} catch (err) {
  console.error('PDF PARSE ERROR:', err.message)

  return res.status(400).json({
    error: 'We could not read this PDF. Please upload DOCX or TXT for best results.'
  })
}
    } else {
      resumeText = fs.readFileSync(file.filepath, 'utf8')
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        error: 'Could not extract text.'
      })
    }

    const beforeATS = calculateATSScore(resumeText, jobDesc)

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Rewrite this resume for ATS optimization.

Include keywords: ${beforeATS.missingKeywords.join(', ')}

--- JOB DESCRIPTION ---
${jobDesc.slice(0, 2000)}

--- RESUME ---
${resumeText.slice(0, 2000)}

Return ONLY the resume.`
        }
      ]
    })

    const rewrittenResume =
      completion?.choices?.[0]?.message?.content || ''

    const afterATS = calculateATSScore(
      rewrittenResume,
      jobDesc
    )

    return res.status(200).json({
      success: true,
      before: beforeATS,
      after: afterATS,
      rewrittenResume,
      originalResume: resumeText
    })
  } catch (err) {
    console.error('ANALYZE ERROR:', err)

    return res.status(500).json({
      error: 'Something went wrong',
      detail: err.message // 🔥 bantu debug di production
    })
  }
}
