const formidable = require('formidable')
const fs = require('fs')
const client = require('../lib/openai')
const { calculateATSScore } = require('../lib/ats')

// CORS
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

module.exports = async function handler(req, res) {
  setCORS(res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const form = formidable({ maxFileSize: 5 * 1024 * 1024 })
    const [fields, files] = await form.parse(req)

    const jobDesc = Array.isArray(fields.jobDesc) ? fields.jobDesc[0] : fields.jobDesc
    const file = Array.isArray(files.resume) ? files.resume[0] : files.resume

    if (!file || !jobDesc) {
      return res.status(400).json({ error: 'Resume and job description required.' })
    }

    let resumeText = ''

    if (file.mimetype === 'application/pdf' || file.originalFilename?.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      resumeText = (await pdfParse(fs.readFileSync(file.filepath))).text
    } else {
      resumeText = fs.readFileSync(file.filepath, 'utf8')
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text.' })
    }

    const beforeATS = calculateATSScore(resumeText, jobDesc)

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Rewrite this resume for ATS optimization.

Include keywords: ${beforeATS.missingKeywords.join(', ')}

--- JOB DESCRIPTION ---
${jobDesc.slice(0, 2000)}

--- RESUME ---
${resumeText.slice(0, 2000)}

Return ONLY the resume.`
      }]
    })

    const rewrittenResume = completion.choices[0].message.content || ''

    const afterATS = calculateATSScore(rewrittenResume, jobDesc)

    return res.status(200).json({
      success: true,
      before: beforeATS,
      after: afterATS,
      rewrittenResume,
      originalResume: resumeText
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
