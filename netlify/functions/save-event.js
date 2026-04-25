const gh = require('./gh-storage');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method not allowed' };

  try {
    const { adminPassword, eventData } = JSON.parse(event.body);
    if (adminPassword !== process.env.ADMIN_PASSWORD)
      return { statusCode: 401, headers: cors(), body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!eventData.eventId) eventData.eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    eventData.updatedAt = new Date().toISOString();
    if (!eventData.createdAt) eventData.createdAt = eventData.updatedAt;
    await gh.saveEvent(eventData);
    return { statusCode: 200, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, eventId: eventData.eventId, storage: 'github' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};
function cors() { return { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS' }; }
