const fs = require("fs");

const STORE_PATH = "/tmp/survey-events.json";

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch (_) { return {}; }
}
function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data), "utf8");
}

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

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: "Unauthorized" }) };
    }

    if (!eventData.eventId) {
      eventData.eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    eventData.updatedAt = new Date().toISOString();

    // Try Netlify Blobs first (works when properly deployed via CLI or git)
    try {
      const { getStore } = require("@netlify/blobs");
      const store = getStore({ name: "survey-events", consistency: "strong" });
      await store.set(eventData.eventId, JSON.stringify(eventData));
      let index = [];
      try { index = await store.get("__index__", { type: "json" }) || []; } catch (_) {}
      const summary = { eventId: eventData.eventId, eventName: eventData.eventName, slug: eventData.slug, active: eventData.active, updatedAt: eventData.updatedAt };
      const ei = index.findIndex(e => e.eventId === eventData.eventId);
      if (ei >= 0) index[ei] = summary; else index.push(summary);
      await store.set("__index__", JSON.stringify(index));
      return { statusCode: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ success: true, eventId: eventData.eventId, storage: "blobs" }) };
    } catch (_) {}

    // Fallback: /tmp file store (ephemeral but works within same function instance)
    const store = readStore();
    store[eventData.eventId] = eventData;
    if (eventData.slug) store[`slug:${eventData.slug}`] = eventData.eventId;
    writeStore(store);

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, eventId: eventData.eventId, storage: "tmp", eventData }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
