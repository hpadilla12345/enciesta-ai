const gh = require('./gh-storage');

// Devuelve el HTML crudo de un cuestionario (para clonar o editar desde el admin).
// A diferencia de get-custom-form, esta requiere adminPassword y responde JSON.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  const { slug, adminPassword } = event.queryStringParameters || {};
  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return { statusCode: 401, headers: cors(), body: JSON.stringify({ error: 'Unauthorized' }) };
  if (!slug) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Falta slug' }) };

  try {
    const html = await gh.getFile(`custom-forms/${slug}.html`);
    return {
      statusCode: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, html: html || '' }),
    };
  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
}
