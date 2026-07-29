const gh = require('./gh-storage');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method not allowed' };

  try {
    const { adminPassword, formData, html } = JSON.parse(event.body);
    if (adminPassword !== process.env.ADMIN_PASSWORD)
      return { statusCode: 401, headers: cors(), body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!formData || !formData.slug)
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Falta slug' }) };

    if (!formData.formId)
      formData.formId = `form_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    formData.updatedAt = new Date().toISOString();
    if (!formData.createdAt) formData.createdAt = formData.updatedAt;

    if (html && html.trim()) {
      const ok = await gh.saveFile(`custom-forms/${formData.slug}.html`, html, `html: ${formData.formName || formData.slug}`);
      if (!ok) throw new Error('No se pudo guardar el HTML en GitHub');
    }

    await gh.saveCustomForm(formData);

    return {
      statusCode: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, formId: formData.formId, slug: formData.slug }),
    };
  } catch (err) {
    console.error('save-custom-form error:', err);
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
}
