// Simple in-memory store for full event configs (prompt + template)
// Called by admin when saving an event
// generate-report reads from here

// NOTE: Netlify Functions are stateless — this uses a workaround:
// We store configs in the function's tmp filesystem between warm invocations
// For production use, migrate to KV store or DB

const fs = require("fs");
const path = require("path");
const STORE_PATH = "/tmp/event-configs.json";

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch(_) { return {}; }
}
function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data));
}

exports.handler = async (event) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "application/json" };
  
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  if (event.httpMethod === "POST") {
    const { adminPassword, eventId, systemPrompt, reportTemplate } = JSON.parse(event.body);
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    const store = readStore();
    store[eventId] = { systemPrompt, reportTemplate, savedAt: new Date().toISOString() };
    writeStore(store);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  if (event.httpMethod === "GET") {
    const eventId = event.queryStringParameters?.eventId;
    const store = readStore();
    const config = store[eventId];
    if (!config) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...config }) };
  }

  return { statusCode: 405, headers, body: "Method not allowed" };
};
