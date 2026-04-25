const fs = require("fs");
const STORE_PATH = "/tmp/survey-events.json";

const AMCHAM_CONFIG = {
  eventId: "evt_amcham_mty_0521",
  eventName: "AmCham Monterrey · Comité Manufactura · 21 Mayo 2026",
  slug: "amcham-mty",
  heroDesc: "Diagnóstico rápido de madurez en Inteligencia Artificial para empresas de manufactura. Responde 8 preguntas y recibe tu reporte personalizado al instante.",
  active: true,
  ccAdmin: true,
  questions: [
    {
      id: "q1", type: "single", required: true,
      label: "¿Cuál es el giro principal de tu empresa?",
      options: ["Manufactura discreta (autopartes, maquinaria, electrónica)", "Manufactura de proceso (química, alimentos, farmacéutica)", "Logística y cadena de suministro", "Servicios industriales / MRO", "Otro"]
    },
    {
      id: "q1b", type: "single", required: true,
      label: "¿Cuántas personas trabajan en tu planta o empresa?",
      options: ["Menos de 100 empleados", "100 – 500 empleados", "500 – 2,000 empleados", "Más de 2,000 empleados"]
    },
    {
      id: "q2", type: "single", required: true,
      label: "¿En qué etapa de madurez digital se encuentra tu empresa? (Framework Gartner)",
      sub: "Independiente = sin integración digital · Agéntico = IA autónoma tomando decisiones",
      options: [
        "Independiente — sistemas y maquinaria aislados, datos en papel o silos",
        "Conectado — equipos conectados a red, datos centralizados básicos",
        "Informado — dashboards y KPIs en tiempo real, análisis descriptivo",
        "Predictivo — machine learning activo, mantenimiento predictivo, alertas automáticas",
        "Agéntico — IA autónoma tomando decisiones y ejecutando acciones sin intervención humana"
      ]
    },
    {
      id: "q3", type: "multi", required: true,
      label: "¿En qué áreas tienen o están considerando casos de uso de IA? (Selecciona todos los que apliquen)",
      options: [
        "Mantenimiento predictivo de equipos",
        "Control de calidad y visión artificial",
        "Optimización de producción / scheduling",
        "Gestión de inventario y cadena de suministro",
        "Seguridad industrial y cumplimiento normativo",
        "Eficiencia energética",
        "Atención a clientes y pedidos",
        "Finanzas y costos de producción",
        "Recursos Humanos / talento de planta"
      ]
    },
    {
      id: "q3b", type: "open", required: false,
      label: "Otro caso de uso de IA que estés considerando (opcional):",
      placeholder: "Describe brevemente..."
    },
    {
      id: "q4", type: "single", required: true,
      label: "¿Cómo capturan el dato de producción hoy en piso?",
      options: [
        "Manual — papel, Excel, entrada humana",
        "Semi-automatizado — algunos sensores pero procesamiento manual",
        "MES / SCADA conectado con datos en tiempo real",
        "Data Lake / plataforma industrial de datos centralizada"
      ]
    },
    {
      id: "q5", type: "single", required: true,
      label: "¿Cuál es la principal barrera para adoptar IA en tu empresa?",
      options: [
        "Falta de estrategia o visión clara desde dirección",
        "Calidad o disponibilidad de datos de planta",
        "Presupuesto insuficiente",
        "Falta de talento o conocimiento interno",
        "Infraestructura tecnológica / conectividad OT-IT",
        "Resistencia cultural al cambio"
      ]
    },
    {
      id: "q6", type: "scale", required: true,
      label: "¿Qué tan urgente sientes la presión competitiva de adoptar IA?",
      sub: "1 = Sin presión · 10 = Urgencia crítica, competidores ya nos están ganando",
      min: 1, max: 10
    },
    {
      id: "q7", type: "single", required: true,
      label: "¿Cuánto planea invertir tu empresa en IA en los próximos 12 meses?",
      options: [
        "No está presupuestado aún",
        "Menos de $50,000 USD",
        "$50,000 – $200,000 USD",
        "$200,000 – $500,000 USD",
        "Más de $500,000 USD"
      ]
    }
  ],
  systemPrompt: "Eres un consultor senior de transformación digital e IA de Grupo Scanda, especializado en manufactura industrial en México y LATAM. Analizas respuestas de un diagnóstico de madurez en IA de directivos del Comité de Manufactura AmCham Monterrey.\n\nBENCHMARKS GARTNER 2025-2026:\n- Solo el 27% de plantas manufactureras en LATAM tienen edge computing desplegado en piso\n- 84% de empresas manufactureras planea aumentar inversión en IIoT en los próximos 2 años\n- Menos del 5% de empresas manufactureras usan IA compuesta (múltiples agentes) en producción hoy\n- El 68% aún captura datos de producción de forma manual o semi-manual\n- Empresas con mantenimiento predictivo reportan 23-40% de reducción en paros no programados\n- Gap de tiempo entre líderes y rezagados en adopción de IA manufactura: 3.2 años promedio\n\nFRAMEWORK DE MADUREZ GARTNER INDUSTRIAL AI:\n- Tradicional (Score 0-25): Sin integración digital, datos en silos o papel\n- Conectado (Score 26-50): Conectividad básica, datos centralizados\n- Analítico (Score 51-70): Dashboards tiempo real, análisis descriptivo-predictivo\n- Inteligente (Score 71-100): ML en producción, mantenimiento predictivo, decisiones aumentadas por IA\n\nCALCULA EL SCORE 0-100 con estos pesos:\n- Etapa de madurez declarada (25%)\n- Calidad de captura de dato en piso (20%)\n- Casos de uso activos/considerados (15%)\n- Inversión planeada (15%)\n- Urgencia competitiva percibida (10%)\n- Barrera principal (10%)\n- Tamaño de empresa (5%)\n\nGENERA EL REPORTE con este template HTML. Llena TODAS las variables {{...}}:\n- {{SCORE}}: número entero 0-100\n- {{TIER}}: uno de los 4 tiers del framework\n- {{POSICION_GARTNER}}: 2-3 oraciones situando a la empresa en el framework, específicas a sus respuestas\n- {{RIESGO}}: el riesgo competitivo más crítico identificado, concreto y específico a su contexto\n- {{BENCHMARK}}: 2-3 puntos de benchmark Gartner relevantes a su giro y tamaño, con datos específicos\n- {{INICIATIVAS}}: 3 bloques HTML de iniciativas (usa el formato del template)\n- {{EMPRESA}}: nombre de la empresa del respondente\n- {{CARGO}}: cargo del respondente\n\nTONO: Ejecutivo, directo, honesto. Sin jerga técnica excesiva. Los lectores son directores de planta y C-level.\n\nResponde ÚNICAMENTE con el HTML del reporte completo usando el template. Sin markdown, sin explicaciones, solo el HTML puro.",
  reportTemplate: `<div style="font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#0a1628 0%,#0e203d 100%);color:#f0f4f8;padding:0;border-radius:16px;max-width:640px;margin:0 auto;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0e203d,#162d50);border-bottom:2px solid #0edda9;padding:28px 32px;text-align:center">
    <div style="font-size:11px;letter-spacing:0.15em;color:#0edda9;text-transform:uppercase;margin-bottom:8px">Grupo Scanda · AI Intelligence</div>
    <div style="font-size:20px;font-weight:700;color:#f0f4f8;margin-bottom:4px">Reporte de Madurez en IA · Manufactura</div>
    <div style="font-size:13px;color:#7a8fa8">{{EMPRESA}} · {{CARGO}}</div>
  </div>
  <div style="padding:28px 32px;text-align:center;border-bottom:1px solid rgba(14,221,169,0.15)">
    <div style="font-size:64px;font-weight:800;color:#0edda9;line-height:1">{{SCORE}}</div>
    <div style="font-size:13px;color:#7a8fa8;margin-top:4px">de 100 puntos</div>
    <div style="display:inline-block;background:rgba(14,221,169,0.12);border:1px solid rgba(14,221,169,0.35);border-radius:20px;padding:6px 20px;margin-top:12px">
      <span style="font-size:13px;font-weight:700;color:#0edda9;letter-spacing:0.05em">{{TIER}}</span>
    </div>
    <div style="margin-top:20px;background:#0a1628;border-radius:8px;padding:4px;max-width:320px;margin-left:auto;margin-right:auto">
      <div style="height:10px;background:linear-gradient(90deg,#0edda9,#5fa8ff);border-radius:6px;width:{{SCORE}}%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;max-width:320px;margin:6px auto 0;font-size:10px;color:#4a5a70">
      <span>Tradicional</span><span>Conectado</span><span>Analítico</span><span>Inteligente</span>
    </div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid rgba(14,221,169,0.1)">
    <div style="font-size:11px;letter-spacing:0.1em;color:#0edda9;text-transform:uppercase;margin-bottom:12px">📍 Tu Posición · Framework Gartner Industrial AI</div>
    <div style="background:#0e203d;border-radius:10px;padding:16px">
      <div style="font-size:14px;color:#f0f4f8;line-height:1.7">{{POSICION_GARTNER}}</div>
    </div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid rgba(14,221,169,0.1)">
    <div style="font-size:11px;letter-spacing:0.1em;color:#ff5a6e;text-transform:uppercase;margin-bottom:12px">⚠️ Riesgo Principal Identificado</div>
    <div style="background:rgba(255,90,110,0.08);border:1px solid rgba(255,90,110,0.25);border-radius:10px;padding:16px">
      <div style="font-size:14px;color:#f0f4f8;line-height:1.7">{{RIESGO}}</div>
    </div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid rgba(14,221,169,0.1)">
    <div style="font-size:11px;letter-spacing:0.1em;color:#5fa8ff;text-transform:uppercase;margin-bottom:12px">📊 Benchmark vs Mercado · Gartner 2025-2026</div>
    <div style="background:#0e203d;border-radius:10px;padding:16px">
      <div style="font-size:14px;color:#b0c4d8;line-height:1.7">{{BENCHMARK}}</div>
    </div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid rgba(14,221,169,0.1)">
    <div style="font-size:11px;letter-spacing:0.1em;color:#0edda9;text-transform:uppercase;margin-bottom:16px">🚀 Top 3 Iniciativas Recomendadas</div>
    {{INICIATIVAS}}
  </div>
  <div style="padding:28px 32px;text-align:center;background:linear-gradient(135deg,rgba(14,221,169,0.07),rgba(95,168,255,0.07))">
    <div style="font-size:15px;font-weight:700;color:#f0f4f8;margin-bottom:8px">¿Listo para convertir esto en un plan de acción real?</div>
    <div style="font-size:13px;color:#7a8fa8;margin-bottom:20px">Agenda tu sesión AI Discovery gratuita con un consultor de Grupo Scanda</div>
    <a href="https://calendly.com/hpadilla-scanda/ai-discovery" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#0edda9,#08c99a);color:#050d1a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.05em">AGENDAR AI DISCOVERY →</a>
    <div style="margin-top:16px;font-size:11px;color:#4a5a70">Grupo Scanda · Inteligencia de Datos LATAM · grupoScanda.com</div>
  </div>
</div>`
};

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch (_) { return {}; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const { slug, eventId } = event.queryStringParameters || {};
  const lookup = slug || eventId;

  if (!lookup) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing slug or eventId" }) };
  }

  const HARDCODED = { "amcham-mty": AMCHAM_CONFIG, "demo": AMCHAM_CONFIG };

  // 1. Try Blobs
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({ name: "survey-events", consistency: "strong" });
    const data = await store.get(lookup, { type: "json" });
    if (data) return { statusCode: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ success: true, event: data, storage: "blobs" }) };
  } catch (_) {}

  // 2. Try /tmp
  try {
    const store = readStore();
    let ev = store[lookup];
    if (!ev && store[`slug:${lookup}`]) ev = store[store[`slug:${lookup}`]];
    if (ev) return { statusCode: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ success: true, event: ev, storage: "tmp" }) };
  } catch (_) {}

  // 3. Hardcoded fallback
  if (HARDCODED[lookup]) {
    return { statusCode: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ success: true, event: HARDCODED[lookup], storage: "hardcoded" }) };
  }

  return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Event not found" }) };
};

function corsHeaders() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
}
