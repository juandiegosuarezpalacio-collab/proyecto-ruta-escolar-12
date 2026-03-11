export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,x-api-key'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const ok = Boolean(env.WHATSAPP_TOKEN && env.PHONE_NUMBER_ID);
      return json({ ok, mode: ok ? 'business' : 'incomplete-config' }, 200, cors);
    }

    if (url.pathname !== '/send' || request.method !== 'POST') {
      return json({ ok: false, error: 'Ruta no encontrada' }, 404, cors);
    }

    const apiKey = request.headers.get('x-api-key');
    if (env.API_KEY && apiKey !== env.API_KEY) {
      return json({ ok: false, error: 'No autorizado' }, 401, cors);
    }

    const body = await request.json().catch(() => null);
    if (!body?.telefono || !body?.mensaje) {
      return json({ ok: false, error: 'Faltan telefono o mensaje' }, 400, cors);
    }

    if (!env.WHATSAPP_TOKEN || !env.PHONE_NUMBER_ID) {
      return json({ ok: false, error: 'Faltan secretos WHATSAPP_TOKEN o PHONE_NUMBER_ID' }, 500, cors);
    }

    const phone = String(body.telefono).replace(/\D/g, '');
    const response = await fetch(`https://graph.facebook.com/v23.0/${env.PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: body.mensaje }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ ok: false, error: data.error?.message || 'Error enviando a WhatsApp' }, 500, cors);
    }

    return json({ ok: true, id: data.messages?.[0]?.id || null }, 200, cors);
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}
