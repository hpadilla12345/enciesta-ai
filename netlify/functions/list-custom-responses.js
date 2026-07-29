const gh = require('./gh-storage');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  const { slug, adminPassword } = event.queryStringParameters || {};
  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return { statusCode: 401, headers: cors(), body: JSON.stringify({ error: 'Unauthorized' }) };
  if (!slug) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Falta slug' }) };

  try {
    const responses = await gh.getCustomResponses(slug);
    return {
      statusCode: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, responses }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, responses: [], note: err.message }),
    };
  }
};

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
}
