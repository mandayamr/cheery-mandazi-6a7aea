const https = require('https');

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    let text;
    try { text = JSON.parse(event.body).text; } catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }
    if (!text || !text.trim()) { return { statusCode: 400, body: JSON.stringify({ error: 'No text provided' }) }; }

    const prompt = `You are an emotion recognition AI. Analyze the emotional content of this text and respond ONLY with raw JSON, no markdown, no code blocks.\n\nText: "${text.trim()}"\n\nRespond with this exact JSON structure:\n{"primary_emotion":"joy","confidence":0.85,"intensity":"high","emotion_scores":{"joy":0.85,"sadness":0.05,"anger":0.02,"fear":0.02,"surprise":0.03,"disgust":0.01,"neutral":0.01,"anticipation":0.01},"sentiment":"positive","empathetic_response":"Your warm empathetic response here."}\n\nRules: primary_emotion must be one of: joy sadness anger fear surprise disgust neutral anticipation. All emotion_scores sum to 1.0. intensity is low medium or high. sentiment is positive negative neutral or mixed.`;

    const requestBody = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'x-api-key': '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',
        'anthropic-version': '2023-06-01'
      }
    };

    const response = await httpsPost(options, requestBody);
    if (response.status !== 200) {
      return { statusCode: response.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: response.body };
    }

    const apiData = JSON.parse(response.body);
    const raw = apiData.content.map(b => b.text || '').join('').trim();

    let result;
    try { result = JSON.parse(raw); }
    catch(e) { const match = raw.match(/\{[\s\S]*\}/); if (match) { result = JSON.parse(match[0]); } else { throw new Error('Could not parse response'); } }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};
