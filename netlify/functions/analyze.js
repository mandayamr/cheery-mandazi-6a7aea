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
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '"nope"' };

  let text = '';
  try { text = JSON.parse(event.body || '{}').text || ''; } catch(e) {}
  if (!text.trim()) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No text' }) };

  const payload = JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: `Detect the emotion in this text. Reply ONLY with this exact JSON and nothing else:\n{"primary_emotion":"joy","confidence":0.8,"intensity":"medium","emotion_scores":{"joy":0.8,"sadness":0.05,"anger":0.05,"fear":0.02,"surprise":0.03,"disgust":0.02,"neutral":0.02,"anticipation":0.01},"sentiment":"positive","empathetic_response":"A warm one sentence response."}\n\nText to analyze: ${text.trim()}` }]
  });

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

    if (res.status !== 200) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'API said ' + res.status + ': ' + res.body }) };
    }

    const api = JSON.parse(res.body);
    const raw = (api.content || []).map(b => b.text || '').join('').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch(e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { result = JSON.parse(m[0]); }
        catch(e2) { return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'Parse failed: ' + raw.slice(0,200) }) }; }
      } else {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'No JSON found in: ' + raw.slice(0,200) }) };
      }
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };

  } catch(err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'Exception: ' + err.message }) };
  }
};
