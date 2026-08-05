// ── GitHub Storage Helper ─────────────────────────────────────
// Usa el repo como base de datos JSON para eventos y respuestas
// Archivos: data/events.json  y  data/responses/{eventId}.json

const OWNER = process.env.GITHUB_REPO_OWNER || 'hpadilla12345';
const REPO  = process.env.GITHUB_REPO_NAME  || 'encuesta-ai';
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
  // Fusiona en vez de reemplazar: si el formulario que llama no conoce un
  // campo (ej. dimensions, scoring, pillars — agregados para eventos
  // personalizados), ese campo se conserva en vez de borrarse.
  if (idx >= 0) list[idx] = { ...list[idx], ...eventData }; else list.push(eventData);
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


async function saveFile(filePath, content, message) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || 'hpadilla12345';
  const repo  = process.env.GITHUB_REPO_NAME  || 'encuesta-ai';
  const hdrs  = { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json', 'X-GitHub-Api-Version':'2022-11-28' };
  const url   = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  let sha;
  try { const r = await fetch(url, {headers:hdrs}); const d = await r.json(); sha = d.sha; } catch(_) {}
  const body = { message, content: Buffer.from(content).toString('base64') };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method:'PUT', headers:hdrs, body:JSON.stringify(body) });
  return res.ok;
}

async function getFile(filePath) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || 'hpadilla12345';
  const repo  = process.env.GITHUB_REPO_NAME  || 'encuesta-ai';
  const hdrs  = { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' };
  const url   = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const res = await fetch(url, {headers:hdrs});
  if (!res.ok) return null;
  const d = await res.json();
  return Buffer.from(d.content.replace(/\n/g,''), 'base64').toString('utf-8');
}

// ── Cuestionarios libres (HTML personalizado) ──────────────────
// Metadata en data/custom-forms.json · HTML en custom-forms/{slug}.html
// Respuestas en data/custom-responses/{slug}.json

async function getCustomForms() {
  const { data } = await ghGet('data/custom-forms.json');
  return data || [];
}

async function saveCustomForm(formData) {
  const { data: forms, sha } = await ghGet('data/custom-forms.json');
  const list = forms || [];
  // Dedupe por formId (edición normal) y por slug (protege contra doble-submit / carrera)
  let idx = list.findIndex(f => f.formId === formData.formId);
  if (idx < 0) idx = list.findIndex(f => f.slug === formData.slug);
  if (idx >= 0) { formData.formId = list[idx].formId; list[idx] = formData; }
  else list.push(formData);
  await ghPut('data/custom-forms.json', list, sha, `cuestionario: ${formData.formName}`);
  return formData;
}

async function deleteCustomForm(formId) {
  const { data: forms, sha } = await ghGet('data/custom-forms.json');
  const list = (forms || []).filter(f => f.formId !== formId);
  await ghPut('data/custom-forms.json', list, sha, `delete cuestionario: ${formId}`);
}

async function getCustomResponses(slug) {
  const { data } = await ghGet(`data/custom-responses/${slug}.json`);
  return data || [];
}

async function saveCustomResponse(slug, responseData) {
  const { data: responses, sha } = await ghGet(`data/custom-responses/${slug}.json`);
  const list = responses || [];
  list.push(responseData);
  await ghPut(`data/custom-responses/${slug}.json`, list, sha, `respuesta @ ${slug}`);
  return responseData;
}

async function clearCustomResponses(slug) {
  const { sha } = await ghGet(`data/custom-responses/${slug}.json`);
  await ghPut(`data/custom-responses/${slug}.json`, [], sha, `limpiar respuestas @ ${slug}`);
}

module.exports = {
  getEvents, saveEvent, deleteEvent, getResponses, saveResponse, deleteResponse, saveFile, getFile,
  getCustomForms, saveCustomForm, deleteCustomForm, getCustomResponses, saveCustomResponse, clearCustomResponses
};
