const Anthropic = require("@anthropic-ai/sdk");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method not allowed" };
  }

  try {
    const { answers, respondent, eventConfig } = JSON.parse(event.body);
    const { systemPrompt, reportTemplate, questions, eventName } = eventConfig;

    // Build the user message with structured answers
    const answersText = questions.map((q, i) => {
      const ans = answers[q.id];
      let formattedAns = ans;
      if (Array.isArray(ans)) formattedAns = ans.join(", ");
      return `**${q.label}**\nRespuesta: ${formattedAns || "No respondida"}`;
    }).join("\n\n");

    const userMessage = `
Respondente:
- Nombre: ${respondent.name}
- Empresa: ${respondent.company}
- Cargo: ${respondent.role}
- Industria: ${respondent.industry}
- Email: ${respondent.email}

Evento: ${eventName}

RESPUESTAS DEL CUESTIONARIO:
${answersText}

---
TEMPLATE DEL REPORTE (respeta esta estructura HTML, llena las variables {{...}}):
${reportTemplate}

INSTRUCCIÓN FINAL: Responde ÚNICAMENTE con el HTML del reporte completo, sin markdown, sin explicaciones, sin bloques de código. Solo el HTML puro.
`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const reportHtml = message.content[0].text;

    // Save response to Netlify Blobs if available
    try {
      const { getStore } = require("@netlify/blobs");
      const store = getStore({ name: "survey-responses", consistency: "strong" });
      const responseKey = `${eventConfig.eventId}/${Date.now()}_${respondent.email.replace(/[^a-z0-9]/gi, "_")}`;
      await store.set(responseKey, JSON.stringify({
        respondent,
        answers,
        eventId: eventConfig.eventId,
        eventName,
        reportHtml,
        timestamp: new Date().toISOString(),
      }));
    } catch (blobErr) {
      console.log("Blobs not available, skipping persistence:", blobErr.message);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, reportHtml }),
    };
  } catch (err) {
    console.error("generate-report error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
