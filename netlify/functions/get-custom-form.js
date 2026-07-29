const gh = require('./gh-storage');

// Sirve el HTML del cuestionario libre como página real (no JSON).
// Mapeado por netlify.toml: /c/:slug -> esta function con ?slug=:slug
exports.handler = async (event) => {
  // La regla de netlify.toml reescribe /c/{slug} -> /.netlify/functions/get-custom-form/{slug}
  // así que el slug llega como último segmento del path. También aceptamos ?slug=
  // para poder probar la function directamente.
  let slug = event.queryStringParameters?.slug;
  if (!slug) {
    const parts = (event.path || '').split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last !== 'get-custom-form') slug = last;
  }
  if (!slug) return htmlMessage('Falta el identificador del cuestionario.');

  try {
    const forms = await gh.getCustomForms();
    const meta = forms.find(f => f.slug === slug);
    if (!meta) return htmlMessage('Este cuestionario no existe o fue eliminado.');
    if (meta.active === false) return htmlMessage('Este cuestionario ya no está activo.');

    const content = await gh.getFile(`custom-forms/${slug}.html`);
    if (!content) return htmlMessage('No se encontró el contenido de este cuestionario.');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: content,
    };
  } catch (err) {
    return htmlMessage('Error cargando el cuestionario: ' + err.message);
  }
};

function htmlMessage(msg) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cuestionario no disponible</title></head>
      <body style="font-family:Inter,sans-serif;background:#F0F3F8;color:#5C6B82;display:flex;
        align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px">
        <div><div style="font-size:32px;margin-bottom:12px">⚠️</div><p style="font-size:15px">${msg}</p></div>
      </body></html>`,
  };
}
