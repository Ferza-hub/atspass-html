const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','have','has','had','do','does','will','would',
  'could','should','this','that','these','those','not','no','its','our','your','their',
  'my','his','her','as','if','so'
])

function extractKeywords(text) {
  return Array.from(new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g,' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
  ))
}

function calculateATSScore(resumeText, jobDescText) {
  const resumeLower  = resumeText.toLowerCase()
  const jobKeywords  = extractKeywords(jobDescText).filter(k => k.length > 4).slice(0, 50)

  const matched = jobKeywords.filter(k => resumeLower.includes(k))
  const missing = jobKeywords.filter(k => !resumeLower.includes(k))

  const keywordScore = jobKeywords.length > 0
    ? Math.round((matched.length / jobKeywords.length) * 100)
    : 50

  const formatIssues = []
  if (!resumeLower.includes('experience')) formatIssues.push('Missing "Experience" section')
  if (!resumeLower.includes('education'))  formatIssues.push('Missing "Education" section')
  if (!resumeLower.includes('skills'))     formatIssues.push('No skills section detected')

  const sectionScore = Math.max(0, 100 - formatIssues.length * 20)

  const score = Math.min(
    100,
    Math.max(5, Math.round(keywordScore * 0.7 + sectionScore * 0.3))
  )

  return {
    score,
    matchedKeywords: matched.slice(0,15),
    missingKeywords: missing.slice(0,10),
    formatIssues
  }
}

module.exports = {
  calculateATSScore
}
