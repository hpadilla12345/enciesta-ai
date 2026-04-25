exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const { adminPassword, eventId } = event.queryStringParameters || {};
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: "Unauthorized" }) };
  }
  if (!eventId) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing eventId" }) };
  }

  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({ name: "survey-responses", consistency: "strong" });
    const { blobs } = await store.list({ prefix: `${eventId}/` });

    const responses = await Promise.all(
      blobs.map(async (b) => {
        try {
          const data = await store.get(b.key, { type: "json" });
          return {
            key: b.key,
            timestamp: data.timestamp,
            respondent: data.respondent,
            eventId: data.eventId,
          };
        } catch (_) { return null; }
      })
    );

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, responses: responses.filter(Boolean) }),
    };
  } catch (err) {
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
