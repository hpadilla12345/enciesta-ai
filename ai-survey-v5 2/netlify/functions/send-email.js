exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method not allowed" };
  }

  try {
    const { to, name, company, eventName, reportHtml, ccAdmin } = JSON.parse(event.body);

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tu Reporte de Madurez IA</title>
<style>
  body { margin: 0; padding: 0; background: #0a1628; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrapper { max-width: 700px; margin: 0 auto; background: #0a1628; }
  .header { background: linear-gradient(135deg, #0e203d 0%, #0a1628 100%);
    border-bottom: 2px solid #0edda9; padding: 32px 40px; text-align: center; }
  .header h1 { color: #0edda9; font-size: 22px; margin: 0 0 8px; letter-spacing: 0.05em; }
  .header p { color: #7a8fa8; font-size: 14px; margin: 0; }
  .content { padding: 0; }
  .footer { background: #060f1e; padding: 24px 40px; text-align: center;
    border-top: 1px solid rgba(14,221,169,0.15); }
  .footer p { color: #4a5a70; font-size: 12px; margin: 4px 0; }
  .footer a { color: #0edda9; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Grupo Scanda · AI Intelligence</h1>
    <p>Tu Reporte Personalizado de Madurez en IA — ${eventName}</p>
  </div>
  <div class="content">
    ${reportHtml}
  </div>
  <div class="footer">
    <p>Este reporte fue generado exclusivamente para <strong style="color:#f0f4f8">${name}</strong> de <strong style="color:#f0f4f8">${company}</strong></p>
    <p style="margin-top:16px">¿Quieres profundizar? <a href="https://grupoScanda.com">Agenda tu AI Discovery gratuito →</a></p>
    <p style="margin-top:12px; color:#2a3a50">© Grupo Scanda · Inteligencia de Datos LATAM</p>
  </div>
</div>
</body>
</html>`;

    const payload = {
      from: process.env.RESEND_FROM_EMAIL || "ai@grupoScanda.com",
      to: [to],
      subject: `Tu Reporte de Madurez IA · ${eventName}`,
      html: emailHtml,
    };

    if (ccAdmin && process.env.ADMIN_CC_EMAIL) {
      payload.cc = [process.env.ADMIN_CC_EMAIL];
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Resend API error");
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, emailId: data.id }),
    };
  } catch (err) {
    console.error("send-email error:", err);
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
