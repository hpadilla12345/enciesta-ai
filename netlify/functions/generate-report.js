const Anthropic = require('@anthropic-ai/sdk');
const gh = require('./gh-storage');

// Defaults para el modelo de Madurez en IA — se sobreescriben si el evento
// define sus propias dimensiones, niveles o ruta de recomendacion
const DEFAULT_DIMS = [
  { id:'qB1', label:'Estrategia de IA' },
  { id:'qB2', label:'Valor e Iniciativas' },
  { id:'qB3', label:'Organización' },
  { id:'qB4', label:'Personas y Cultura' },
  { id:'qB5', label:'Gobernanza' },
  { id:'qB6', label:'Ingeniería y Sistemas' },
  { id:'qB7', label:'Datos' },
];
const DEFAULT_NIVELES = ['','Inicial','Experimentación','Estabilización','Escalamiento','Liderazgo'];
const DEFAULT_ROUTE = [
  { maxAvg:2.5, steps:[
    ['Fase 01 · Discovery','Workshop Ejecutivo de Discovery (2-3h)','Mapeo de dolores, matriz impacto/complejidad, roadmap Q1-Q4. Entregable: heat map de madurez + business case.'],
    ['Fase 01 + Componentes 05 & 06','Champions + Gobernanza + Data Foundation','Formación de AI Champions, políticas de IA y Data Pipeline. Cierra las brechas antes de construir.'],
    ['Fases 02-03 · Diseño & Construcción','Blueprint + Primer proyecto Track A','Con PoV aprobado, construye la primera iniciativa en Stage-Gate CMMI L3 con valor medido.']
  ]},
  { maxAvg:3.5, steps:[
    ['Fase 01 · Discovery','Workshop Ejecutivo + Proof of Value','Prioriza los 2-3 casos de uso con mayor ROI y valida factibilidad técnica.'],
    ['Fase 02 · Diseño','Blueprint de arquitectura hub-and-spoke','Define los patrones técnicos y el modelo operativo para escalar.'],
    ['Fase 03 · Construcción','Fábrica de IA - Stage-Gate CMMI L3','Construye y despliega iniciativas con pruebas T1-T6 y loops de mejora continua.']
  ]},
  { maxAvg:5.0, steps:[
    ['Fase 03 · Construcción avanzada','Escalar iniciativas existentes con MLOps','Tu madurez permite ir directo a construcción. Define el portafolio y escala con gobernanza.'],
    ['Fase 04 · Operación','MLOps + Loop anual de madurez','Implementa monitoreo de modelos, detección de drift y ciclo de mejora continua del CoE.'],
    ['Siguiente nivel · IA Nativa','Track B: reimaginar procesos clave con IA','Con Track A estable, diseña procesos Track B que diferencien tu organización en el mercado.']
  ]}
];
const DIM_COLORS = { 1:'#ef4444', 2:'#f59e0b', 3:'#0d9488', 4:'#059669', 5:'#0597ff' };

// Mapea un valor de cualquier escala a uno de los 5 colores de semaforo
function dimColor(val, min, range) {
  const n = Math.max(1, Math.min(5, Math.round(((val - min) / range) * 4) + 1));
  return DIM_COLORS[n] || '#94a3b8';
}

function formatAnswer(ans, qType) {
  if (ans === null || ans === undefined) return 'No respondida';
  if (qType === 'scale') return `${ans}/5`;
  if (qType === 'multi-open' && typeof ans === 'object' && !Array.isArray(ans)) {
    const sel = Object.entries(ans).filter(([k,v]) => k !== '_open' && v === true).map(([k]) => k);
    const custom = ans._open ? `"${ans._open}"` : '';
    return [...sel, custom].filter(Boolean).join(' · ') || 'No respondida';
  }
  if (Array.isArray(ans)) return ans.join(' · ') || 'No respondida';
  return String(ans) || 'No respondida';
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:cors, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:cors, body:'Method not allowed' };

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { statusCode:500, headers:cors, body: JSON.stringify({ success:false, error:'ANTHROPIC_API_KEY not set in environment' }) };
    }
    const { answers, respondent, eventConfig } = JSON.parse(event.body);
    let { questions, eventName, eventId } = eventConfig;

    // Fetch fresh config from GitHub
    let systemPrompt = null, reportTemplate = null, ev = null;
    try {
      const owner = process.env.GITHUB_REPO_OWNER || 'hpadilla12345';
      const repo  = process.env.GITHUB_REPO_NAME  || 'encuesta-ai';
      const token = process.env.GITHUB_TOKEN;
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/events.json`,
        { headers: { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' } }
      );
      if (r.ok) {
        const d = await r.json();
        const events = JSON.parse(Buffer.from(d.content,'base64').toString('utf8'));
        ev = events.find(e => e.eventId === eventId || e.slug === eventId) || null;
        if (ev) {
          systemPrompt   = ev.systemPrompt   || null;
          reportTemplate = ev.reportTemplate || null;
          questions      = ev.questions      || questions;
        }
      }
    } catch(ghErr) { console.log('GitHub fallback:', ghErr.message); }

    if (!systemPrompt)   systemPrompt   = eventConfig.systemPrompt   || 'Eres consultor senior del CoE-IA de Grupo Scanda.';
    if (!reportTemplate) reportTemplate = eventConfig.reportTemplate || '<div style="padding:32px"><h2>{{SCORE_MADUREZ}}/5 · {{NIVEL_GARTNER}}</h2><p>{{ANALISIS_POSICION}}</p></div>';


    // Dimensiones, niveles y ruta: del evento si definidos, si no los defaults de IA
    const DIMS    = (ev && ev.dimensions  && ev.dimensions.length)  ? ev.dimensions  : DEFAULT_DIMS;
    const NIVELES = (ev && ev.levels      && ev.levels.length)      ? ev.levels      : DEFAULT_NIVELES;
    const ROUTE   = (ev && ev.routeSteps  && ev.routeSteps.length)  ? ev.routeSteps  : DEFAULT_ROUTE;
    // Escala, bandas de nivel y pesos: del evento si los define
    const SC          = (ev && ev.scoring) ? ev.scoring : {};
    const hasScoring  = !!(ev && ev.scoring);
    const scaleMin    = Number.isFinite(SC.scaleMin) ? Number(SC.scaleMin) : 1;
    const scaleMax    = Number.isFinite(SC.scaleMax) ? Number(SC.scaleMax) : 5;
    const scaleRange  = (scaleMax - scaleMin) || 1;
    const WEIGHTS     = (SC.weights && typeof SC.weights === 'object') ? SC.weights : null;
    const LEVEL_BANDS = (Array.isArray(SC.levelBands) && SC.levelBands.length) ? SC.levelBands : null;

    // ── SERVER-SIDE: calculate scores from scale answers (no Claude needed) ─
    // Un 0 es respuesta valida cuando la escala arranca en 0, por eso se
    // distingue "no respondida" (null) de "respondida con cero"
    const scores = {};
    const answered = [];
    DIMS.forEach(d => {
      const raw = answers[d.id];
      const ok = raw !== undefined && raw !== null && raw !== '' && !isNaN(Number(raw));
      scores[d.id] = ok ? Number(raw) : null;
      if (ok) answered.push(d);
    });

    let avg;
    if (!answered.length) {
      avg = hasScoring ? (scaleMin + scaleRange / 2) : 2;
    } else if (WEIGHTS) {
      let sumW = 0, acc = 0;
      answered.forEach(d => {
        const w = Number(WEIGHTS[d.id]) || 0;
        sumW += w; acc += scores[d.id] * w;
      });
      avg = sumW > 0
        ? acc / sumW
        : answered.reduce((a,d) => a + scores[d.id], 0) / answered.length;
    } else {
      avg = answered.reduce((a,d) => a + scores[d.id], 0) / answered.length;
    }

    const scoreGlobal = Math.max(0, Math.min(100, Math.round(((avg - scaleMin) / scaleRange) * 100)));
    // Regla de veto opcional: si una dimension critica queda en o por debajo de
    // vetoMaxScore, el nivel global se fuerza al primero sin importar el ponderado
    let vetoed = false;
    if (SC.veto && Array.isArray(SC.veto.dimensions) && SC.veto.dimensions.length) {
      const lim = Number.isFinite(SC.veto.maxScore) ? Number(SC.veto.maxScore) : scaleMin;
      vetoed = SC.veto.dimensions.some(id => scores[id] !== null && scores[id] !== undefined && scores[id] <= lim);
    }

    let nivelMadurez;
    if (LEVEL_BANDS) {
      const band = vetoed ? LEVEL_BANDS[0] : (LEVEL_BANDS.find(b => avg <= Number(b.maxAvg)) || LEVEL_BANDS[LEVEL_BANDS.length - 1]);
      nivelMadurez = band.label || '';
    } else {
      nivelMadurez = avg < 2 ? NIVELES[1] : avg < 3 ? NIVELES[2] : avg < 4 ? NIVELES[3] : avg < 5 ? NIVELES[4] : NIVELES[5];
    }
    const scoreNivelStr = avg.toFixed(1);

    // Generate dimension bars HTML server-side
    const dimensionBars = DIMS.map(d => {
      const val = scores[d.id];
      const has = val !== null;
      const color = has ? dimColor(val, scaleMin, scaleRange) : '#94a3b8';
      const pct = has ? Math.round(Math.max(0, Math.min(100, (val / scaleMax) * 100)) * 10) / 10 : 0;
      return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${d.label}</span><span style="color:${color};font-weight:700">${has ? val : '—'}/${scaleMax}</span></div><div style="background:#e2e8f0;border-radius:999px;height:7px"><div style="width:${pct}%;height:100%;border-radius:999px;background:${color}"></div></div></div>`;
    }).join('');

    // Sorted by score for brechas (lowest 3)
    const sortedDims = DIMS.map(d => ({ ...d, score: scores[d.id] !== null ? scores[d.id] : 0 })).sort((a,b) => a.score - b.score);
    const brechas3 = sortedDims.slice(0, 3);
    const dimsText = DIMS.map(d => `${d.label}: ${scores[d.id] !== null ? scores[d.id] : 0}/${scaleMax}`).join(', ');

    // Non-scale answers
    const answersText = (questions || []).filter(q => q.type !== 'scale').map(q => {
      const fmt = formatAnswer(answers[q.id], q.type);
      return `${q.label}: ${fmt}`;
    }).join('\n');

    // CTA
    const ctaUrl  = eventConfig.ctaUrl  || 'https://gruposcanda.com/discovery';
    const ctaText = eventConfig.ctaText || 'AGENDA TU AI DISCOVERY →';

    // ── CLAUDE: only text analysis (~500 tokens output) ──────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: systemPrompt + '\n\nResponde SOLO con texto plano separado por marcadores. Sin HTML. Sin markdown.',
      messages: [{
        role: 'user',
        content: `Respondente: ${respondent.name} | ${respondent.company} | ${respondent.role} | ${respondent.industry || '—'}
Score de Madurez: ${scoreNivelStr}/5 · ${nivelMadurez} · ${scoreGlobal}/100
Dimensiones: ${dimsText}
Brechas críticas (más bajas): ${brechas3.map(d=>`${d.label} ${d.score}/5`).join(', ')}
Datos adicionales: ${answersText}

Genera texto para estas 5 secciones separadas por ===:
1. ANÁLISIS (4 oraciones: posición actual, fortalezas, brechas, oportunidad)
===
2. BENCHMARK (2 oraciones: comparación vs ${respondent.industry || 'su industria'} en LATAM con cifras reales)
===
3. BRECHAS (para cada una de las 3 dimensiones más bajas: nombre + 2 oraciones sobre impacto operativo y componente CoE que la resuelve)
===
4. INDUSTRIA_IA (3 casos Track A reales de su industria con resultado en %, luego 2 casos Track B transformacionales)
===
5. INICIATIVAS (3 iniciativas concretas: nombre + descripción 2 líneas + ROI estimado + plazo + patrón CoE)`
      }],
    });

    // Strip markdown from Claude output
    const rawText = msg.content[0].text
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** → text
      .replace(/\*([^*]+)\*/g, '$1')         // *italic* → text
      .replace(/^[-*] /gm, '• ')              // bullet markers
      .replace(/^#{1,3} /gm, '');              // headings
    const parts = rawText.split('===').map(s => s.trim());
    const analisis    = parts[0] || '';
    const benchmark   = parts[1] || '';
    const brechasText = parts[2] || '';
    const industriaText = parts[3] || '';
    const iniciativasText = parts[4] || '';

    // ── Build HTML sections server-side ──────────────────────────────────────
    // Brechas
    const brechasHtml = brechas3.map((d, i) => {
      const lines = brechasText.split('\n').filter(Boolean);
      const start = lines.findIndex(l => l.includes(d.label));
      const text = start >= 0 ? lines.slice(start, start+3).join(' ') : `${d.label} (${d.score}/${scaleMax}): brecha identificada.`;
      const icons = ['🏛️','🗄️','🏢','👥','⚙️','📊','🔒'];
      const coeMap = { 'qB5':'CoE Componente 06 (Gobernanza)', 'qB7':'CoE Componente 05 (AI Data)', 'qB3':'CoE Fase 01 Champions', 'qB4':'CoE Programa Champions', 'qB1':'CoE Discovery', 'qB2':'CoE Discovery (PoV)', 'qB6':'CoE Fase 03 Construcción' };
      const tag = d.tag || coeMap[d.id] || '';
      const tagHtml = tag ? ` <span style="font-family:monospace;font-size:10px;padding:2px 7px;border-radius:4px;background:#dbeafe;color:#1e40af">${tag}</span>` : '';
      return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f1f5f9"><div style="width:36px;height:36px;border-radius:8px;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${icons[i]||'⚠️'}</div><div><div style="font-size:13px;font-weight:700;color:#0b1a30;margin-bottom:4px">${d.label} <span style="font-family:monospace;font-size:10px;padding:2px 7px;border-radius:4px;background:#fee2e2;color:#dc2626">${d.score}/${scaleMax}</span>${tagHtml}</div><div style="font-size:13px;color:#6b7280;line-height:1.6">${text.replace(d.label,'').replace(/^\s*[:\-]\s*/,'')}</div></div></div>`;
    }).join('');

    // Bloque de contexto. Por defecto usa las dos pistas del modelo de IA;
    // un evento puede definir sus propias etiquetas o pasar [] para texto plano
    const TRACKS = (ev && Array.isArray(ev.trackLabels)) ? ev.trackLabels : ['Track A · IA Aumentada','Track B · IA Nativa'];
    let industria;
    if (TRACKS.length < 2) {
      industria = `<p style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-line">${industriaText.trim()}</p>`;
    } else {
      const sepRaw = TRACKS[1].split('·')[0].trim();
      const sep = new RegExp(sepRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [trackAText, trackBText] = industriaText.split(sep);
      industria = `<div style="margin-bottom:16px"><div style="font-size:11px;font-family:monospace;font-weight:700;background:#0b1a30;color:#a7f3d0;padding:3px 10px;border-radius:4px;display:inline-block;margin-bottom:8px">${TRACKS[0]}</div><p style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-line">${(trackAText||industriaText).trim()}</p></div><div><div style="font-size:11px;font-family:monospace;font-weight:700;background:#4338ca;color:#e0e7ff;padding:3px 10px;border-radius:4px;display:inline-block;margin-bottom:8px">${TRACKS[1]}</div><p style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-line">${(trackBText||'').trim()}</p></div>`;
    }

    // Iniciativas
    const iniLines = iniciativasText.split(/\n(?=\d\.|\d\))/);
    const iniciativasHtml = iniLines.slice(0,3).map((item, i) => {
      const lines2 = item.trim().split('\n');
      const title = lines2[0].replace(/^\d[\.\)]\s*/,'').trim();
      const desc = lines2.slice(1).join(' ').trim();
      return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f1f5f9"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0597ff);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0">${i+1}</div><div><div style="font-size:14px;font-weight:700;color:#0b1a30;margin-bottom:4px">${title}</div><div style="font-size:13px;color:#6b7280;line-height:1.6">${desc}</div></div></div>`;
    }).join('');

    // Ruta CoE steps based on level
    // Selecciona los pasos de ruta según el avg del respondente
    // Si una dimension critica esta vetada, la ruta arranca en el primer bloque
    // aunque el promedio ponderado sea alto: no se recomienda escalar sin medicion
    const rutaBlock = vetoed ? ROUTE[0] : (ROUTE.find(r => avg <= r.maxAvg) || ROUTE[ROUTE.length - 1]);
    const rutaSteps = rutaBlock.steps;

    const rutaHtml = rutaSteps.map((step, i) => `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #e0e7ff"><div style="min-width:34px;height:34px;border-radius:50%;background:#3730a3;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0">${i+1}</div><div><div style="font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.06em;color:#6366f1;margin-bottom:3px">${step[0]}</div><div style="font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:3px">${step[1]}</div><div style="font-size:12px;color:#4338ca;line-height:1.5">${step[2]}</div></div></div>`).join('');

    // Fill template
    const vars = {
      NOMBRE: respondent.name, EMPRESA: respondent.company, CARGO: respondent.role,
      SCORE: String(scoreGlobal), SCORE_MADUREZ: scoreNivelStr, NIVEL_GARTNER: nivelMadurez,
      DIMENSIONES_BARRAS: dimensionBars,
      ANALISIS_POSICION: analisis,
      BENCHMARK: benchmark,
      BRECHAS: brechasHtml,
      INDUSTRIA_IA: industria,
      INICIATIVAS: iniciativasHtml,
      RUTA_COE: rutaHtml,
      CTA_URL: ctaUrl, CTA_TEXT: ctaText,
    };

    let reportHtml = reportTemplate;
    Object.entries(vars).forEach(([k,v]) => {
      reportHtml = reportHtml.split(`{{${k}}}`).join(v || '');
    });

    // Save to GitHub
    const responseData = { respondent, answers, eventId, eventName, reportHtml, timestamp: new Date().toISOString() };
    try { await gh.saveResponse(eventId, responseData); } catch(e) { console.log('Save failed:', e.message); }

    // Send short notification email — report link instead of embedded HTML
    const reportUrl = `https://encuesta-ia.netlify.app/view-report/?id=${encodeURIComponent(respondent.email)}&event=${eventId}`;
    const scoreVal  = vars.SCORE || '—';
    const nivelVal  = vars.NIVEL_GARTNER || '—';
    const shortEmail = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu Reporte de Madurez en IA</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Inter,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#0b1a30,#1a3a6b);padding:32px 40px;text-align:center">
    <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#a7f3d0;margin-bottom:8px">AI Maturity Assessment · Grupo Scanda</div>
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 6px">Tu Diagnóstico de Madurez en IA está listo</h1>
    <p style="color:rgba(255,255,255,.65);font-size:13px;margin:0">${respondent.name} · ${respondent.company}</p>
  </td></tr>
  <tr><td style="padding:32px 40px;text-align:center">
    <div style="display:inline-block;background:#f0fdf9;border:2px solid #a7f3d0;border-radius:12px;padding:20px 40px;margin-bottom:24px">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#0d9488;margin-bottom:4px">Score Global</div>
      <div style="font-size:56px;font-weight:900;color:#0b1a30;line-height:1">${scoreVal}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">de 100 · Nivel: ${nivelVal}</div>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 28px">
      Hemos generado tu reporte personalizado con análisis de brechas, casos de uso de tu industria y un plan de acción concreto para el CoE-IA.
    </p>
    <a href="${reportUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0597ff);color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:.02em">
      Ver mi reporte completo →
    </a>
    <p style="color:#94a3b8;font-size:11px;margin:20px 0 0">El enlace es personal y estará disponible por 30 días.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="color:#94a3b8;font-size:11px;margin:0">© Grupo Scanda · Centro de Excelencia de IA</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'ai@encuestas.hpm.one',
          reply_to: 'hola@gruposcanda.com',
          to: [respondent.email],
          subject: `Tu Diagnóstico de Madurez en IA está listo · Score ${scoreVal}/100`,
          html: shortEmail,
          headers: { 'List-Unsubscribe': '<mailto:hola@gruposcanda.com?subject=unsubscribe>' },
        }),
      });
      const emailData = await emailRes.json();
      if (emailRes.ok) { console.log('Email sent OK:', emailData.id, '->', respondent.email); }
      else { console.error('Resend error:', JSON.stringify(emailData)); }
    } catch(emailErr) { console.error('Email exception:', emailErr.message); }
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type':'application/json' },
      body: JSON.stringify({ success:true, reportHtml }),
    };

  } catch(err) {
    console.error('generate-report error:', err);
    return { statusCode:500, headers:cors, body: JSON.stringify({ success:false, error:err.message }) };
  }
};

function cors() {
  return { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS' };
}
