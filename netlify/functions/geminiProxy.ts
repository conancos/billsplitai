import type { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { imageBase64, message, items } = body;

    // Validación básica
    if (!imageBase64 && (!message || !items)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Debe enviar imageBase64 o (message + items)' }) };
    }

    // Construir payload para Gemini
    const payload: any = {};
    if (imageBase64) payload.imageBase64 = imageBase64;
    if (message) payload.message = message;
    if (items) payload.items = items;

    // Llamada a Gemini con API Key segura de Netlify
    const response = await fetch('https://api.gemini.com/analyze', { // Ajusta la URL real
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: text }) };
    }

    const data = await response.json();
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (err: any) {
    console.error('Error en geminiProxy:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Error desconocido' }) };
  }
};

export { handler };
