const Anthropic = require('@anthropic-ai/sdk');
const gh = require('./gh-storage');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method not allowed' };

  try {
    const { answers, respondent, eventConfig } = JSON.parse(event.body);
    let { systemPrompt, reportTemplate, questions, eventName, eventId } = eventConfig;

    if (!systemPrompt) systemPrompt = "Eres un consultor experto en IA de Grupo Scanda. Genera un reporte ejecutivo de madurez en IA con Score 0-100, Tier, análisis, benchmark LATAM, Top 3 iniciativas y CTA para AI Discovery. Llena TODAS las variables {{...}} del template. Responde SOLO con el HTML puro.";
    if (!reportTemplate) reportTemplate = "<div style='font-family:Arial;background:#0a1628;color:#f0f4f8;padding:32px;border-radius:12px;max-width:600px;margin:0 auto'><h2 style='color:#0edda9;text-align:center'>Score: {{SCORE}}/100</h2><p>{{POSICION_GARTNER}}</p></div>";

    const answersText = (questions || []).map(q => {
      const ans = answers[q.id];
      return `**${q.label}**\nRespuesta: ${Array.isArray(ans) ? ans.join(', ') : (ans || 'No respondida')}`;
    }).join('\n\n');

    const userMessage = `Respondente:\n- Nombre: ${respondent.name}\n- Empresa: ${respondent.company}\n- Cargo: ${respondent.role}\n- Email: ${respondent.email}\n\nEvento: ${eventName}\n\nRESPUESTAS:\n${answersText}\n\n---\nTEMPLATE (llena todas las variables {{...}}):\n${reportTemplate}\n\nResponde ÚNICAMENTE con el HTML completo. Sin markdown, sin explicaciones.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    let reportHtml = message.content[0].text;
    reportHtml = reportHtml.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim();

    const responseData = { respondent, answers, eventId, eventName, reportHtml, timestamp: new Date().toISOString() };
    try { await gh.saveResponse(eventId, responseData); } catch (ghErr) { console.log('GitHub save failed:', ghErr.message); }

    return { statusCode: 200, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, reportHtml }) };
  } catch (err) {
    console.error('generate-report error:', err);
    return { statusCode: 500, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
function cors() { return { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS' }; }
