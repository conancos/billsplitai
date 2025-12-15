import type { Handler } from '@netlify/functions'
import fetch from 'node-fetch'

const handler: Handler = async (event) => {
  console.log('API KEY EXISTS:', !!process.env.GEMINI_API_KEY)

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: 'Missing API key' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { imageBase64 } = body

    if (!imageBase64) {
      return { statusCode: 400, body: 'Missing imageBase64' }
    }

    const payload = {
      contents: [
        {
          parts: [
            {
              text: `
Analiza este recibo y DEVUELVE SOLO JSON válido con este formato exacto:
{
  "items": [
    { "id": "1", "name": "Producto", "price": 5.99 }
  ],
  "subtotal": 0,
  "tax": 0,
  "tip": 0,
  "total": 0,
  "currency": "€"
}
NO incluyas texto fuera del JSON.
`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
              }
            }
          ]
        }
      ]
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )

    const data = await res.json()
    console.log('Gemini raw:', JSON.stringify(data, null, 2))

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return { statusCode: 500, body: 'Invalid Gemini response' }
    }

    const parsed = JSON.parse(text)

    return {
      statusCode: 200,
      body: JSON.stringify(parsed)
    }

  } catch (err: any) {
    console.error('Proxy error:', err)
    return { statusCode: 500, body: err.message }
  }
}

export { handler }
