exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { adminPassword, eventData } = body;

    // Simple password check
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const { getStore } = require("@netlify/blobs");
    const store = getStore({ name: "survey-events", consistency: "strong" });

    // Generate eventId if new
    if (!eventData.eventId) {
      eventData.eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    eventData.updatedAt = new Date().toISOString();

    await store.set(eventData.eventId, JSON.stringify(eventData));

    // Also update the events index
    let index = [];
    try {
      index = await store.get("__index__", { type: "json" }) || [];
    } catch (_) {}
    const existing = index.findIndex(e => e.eventId === eventData.eventId);
    const summary = {
      eventId: eventData.eventId,
      eventName: eventData.eventName,
      slug: eventData.slug,
      active: eventData.active,
      createdAt: eventData.createdAt || eventData.updatedAt,
      updatedAt: eventData.updatedAt,
    };
    if (existing >= 0) index[existing] = summary;
    else index.push(summary);
    await store.set("__index__", JSON.stringify(index));

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, eventId: eventData.eventId }),
    };
  } catch (err) {
    console.error("save-event error:", err);
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
