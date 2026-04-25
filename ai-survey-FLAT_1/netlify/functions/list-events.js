const fs = require("fs");
const STORE_PATH = "/tmp/survey-events.json";

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch (_) { return {}; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const adminPassword = event.queryStringParameters?.adminPassword;
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: "Unauthorized" }) };
  }

  // Try Blobs first
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({ name: "survey-events", consistency: "strong" });
    const index = await store.get("__index__", { type: "json" }) || [];
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, events: index, storage: "blobs" }),
    };
  } catch (_) {}

  // Fallback: /tmp
  try {
    const store = readStore();
    const events = Object.values(store)
      .filter(v => typeof v === "object" && v.eventId)
      .map(ev => ({ eventId: ev.eventId, eventName: ev.eventName, slug: ev.slug, active: ev.active, updatedAt: ev.updatedAt }));
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, events, storage: "tmp" }),
    };
  } catch (err) {
    // Always return 200 so admin can log in — just empty events
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, events: [], storage: "none", note: err.message }),
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
