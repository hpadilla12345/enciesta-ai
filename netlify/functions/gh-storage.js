// ── GitHub Storage Helper ─────────────────────────────────────
// Usa el repo como base de datos JSON para eventos y respuestas
// Archivos: data/events.json  y  data/responses/{eventId}.json

const OWNER = process.env.GITHUB_REPO_OWNER || 'hpadilla12345';
const REPO  = process.env.GITHUB_REPO_NAME  || 'enciesta-ai';
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = 'main';

const BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

async function ghGet(path) {
  const res = await fetch(`${BASE}/${path}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return { exists: false, data: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf8');
  return { exists: true, data: JSON.parse(content), sha: json.sha };
}

async function ghPut(path, data, sha, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message: message || `update ${path}`, content, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} — ${err}`);
  }
  return await res.json();
}

// ── Public API ────────────────────────────────────────────────

async function getEvents() {
  const { data } = await ghGet('data/events.json');
  return data || [];
}

async function saveEvent(eventData) {
  const { data: events, sha } = await ghGet('data/events.json');
  const list = events || [];
  const idx = list.findIndex(e => e.eventId === eventData.eventId);
  if (idx >= 0) list[idx] = eventData; else list.push(eventData);
  await ghPut('data/events.json', list, sha, `event: ${eventData.eventName}`);
  return eventData;
}

async function deleteEvent(eventId) {
  const { data: events, sha } = await ghGet('data/events.json');
  const list = (events || []).filter(e => e.eventId !== eventId);
  await ghPut('data/events.json', list, sha, `delete event: ${eventId}`);
}

async function getResponses(eventId) {
  const { data } = await ghGet(`data/responses/${eventId}.json`);
  return data || [];
}

async function saveResponse(eventId, responseData) {
  const { data: responses, sha } = await ghGet(`data/responses/${eventId}.json`);
  const list = responses || [];
  list.push(responseData);
  await ghPut(
    `data/responses/${eventId}.json`,
    list,
    sha,
    `response: ${responseData.respondent?.name} @ ${eventId}`
  );
  return responseData;
}

async function deleteResponse(eventId, responseIndex) {
  const { data: responses, sha } = await ghGet(`data/responses/${eventId}.json`);
  const list = responses || [];
  list.splice(responseIndex, 1);
  await ghPut(`data/responses/${eventId}.json`, list, sha, `delete response ${responseIndex} @ ${eventId}`);
}

module.exports = { getEvents, saveEvent, deleteEvent, getResponses, saveResponse, deleteResponse };
