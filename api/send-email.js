const nodemailer = require('nodemailer')

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
    const { email, resumeText } = req.body

    if (!email || !resumeText) {
      return res.status(400).json({ error: 'Missing email or resume.' })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD
      }
    })

    await transporter.sendMail({
      from: `ATSPass <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Your optimized resume is ready',
      text: resumeText
    })

    return res.status(200).json({ success: true })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
