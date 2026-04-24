exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const eventId = event.queryStringParameters?.eventId;
  if (!eventId) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing eventId" }) };
  }

  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({ name: "survey-events", consistency: "strong" });
    const data = await store.get(eventId, { type: "json" });

    if (!data) {
      return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Event not found" }) };
    }

    // Don't expose system prompt to public — only return what survey needs
    const { systemPrompt, reportTemplate, ...publicConfig } = data;
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, event: publicConfig }),
    };
  } catch (err) {
    // Fallback: return demo event if Blobs not configured
    console.error("get-event error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}
