const https = require('https');

function httpsPost(options, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timed out')); });
    req.write(bodyStr);
    req.end();
  });
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '"Method not allowed"' };

  let text;
  try { text = JSON.parse(event.body || '{}').text; } catch(e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  if (!text || !text.trim()) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No text provided' }) };

  const prompt = `Analyze the emotion in this text. Reply ONLY with raw JSON, no markdown, no explanation.

Text: "${text.trim()}"

JSON format (use real values, not these examples):
{"primary_emotion":"joy","confidence":0.85,"intensity":"high","emotion_scores":{"joy":0.85,"sadness":0.05,"anger":0.02,"fear":0.02,"surprise":0.03,"disgust":0.01,"neutral":0.01,"anticipation":0.01},"sentiment":"positive","empathetic_response":"One warm sentence responding to the person."}

primary_emotion: joy | sadness | anger | fear | surprise | disgust | neutral | anticipation
intensity: low | medium | high
sentiment: positive | negative | neutral | mixed`;

  const payload = JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] });

  const opts = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-api-key': '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',
      'anthropic-version': '2023-06-01'
    }
  };

  try {
    const res = await httpsPost(opts, payload);
    if (res.status !== 200) return { statusCode: res.status, headers: CORS, body: res.body };

    const api = JSON.parse(res.body);
    const raw = (api.content || []).map(b => b.text || '').join('').trim();

    let result;
    try { result = JSON.parse(raw); }
    catch(e) { const m = raw.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); else return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Bad AI response: ' + raw.slice(0,100) }) }; }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
  } catch(err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
