import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptData, ReceiptItem } from "../types";

// Helper to get fresh API client
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const RECEIPT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          price: { type: Type.NUMBER, description: "Total price for this line item (unit price * quantity)" },
          quantity: { type: Type.NUMBER },
        },
        required: ["name", "price", "quantity"]
      },
    },
    subtotal: { type: Type.NUMBER },
    tax: { type: Type.NUMBER },
    tip: { type: Type.NUMBER },
    total: { type: Type.NUMBER },
    currency: { type: Type.STRING, description: "Currency symbol, e.g. $, €, £" }
  },
  required: ["items", "subtotal", "total"]
};

const UPDATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          assignedTo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of people's names assigned to this item."
          }
        },
        required: ["id", "assignedTo"]
      }
    },
    people_found: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of all unique people names identified in the current command."
    },
    response_message: {
        type: Type.STRING,
        description: "A short, friendly confirmation message in Spanish summarizing what was done (e.g., 'Añadida la Pizza a Emilia')."
    }
  },
  required: ["items", "people_found", "response_message"]
};

export async function analyzeReceiptImage(base64Image: string): Promise<ReceiptData> {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: "Analyze this receipt image. Extract all items, prices, tax, tip, and total. Identify the currency symbol. Return strictly JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RECEIPT_SCHEMA
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from AI");

    const data = JSON.parse(text);
    
    // Post-process to add IDs and empty assignments
    const items = (data.items || []).map((item: any, index: number) => ({
      ...item,
      id: `item-${index}-${Date.now()}`,
      assignedTo: []
    }));

    return {
      items,
      subtotal: data.subtotal || 0,
      tax: data.tax || 0,
      tip: data.tip || 0,
      total: data.total || 0,
      currency: data.currency || '$'
    };

  } catch (error) {
    console.error("Receipt analysis failed:", error);
    throw error;
  }
}

export async function processSplitCommand(
  currentItems: ReceiptItem[], 
  userCommand: string
): Promise<{ updatedItems: { id: string, assignedTo: string[] }[], message: string, people: string[] }> {
  const ai = getAiClient();

  // Create a simplified version of items to send to the model to save tokens and focus attention
  const simplifiedItems = currentItems.map(i => ({
    id: i.id,
    name: i.name,
    price: i.price,
    current_assignments: i.assignedTo
  }));

  const prompt = `
    Current receipt items:
    ${JSON.stringify(simplifiedItems, null, 2)}

    User Command: "${userCommand}"

    Instructions:
    1. Update the 'assignedTo' list for items based on the user's command.
    2. Use fuzzy matching for item names (e.g. 'coke' matches 'Coca Cola').
    3. If multiple people share an item, list all their names in 'assignedTo'.
    4. If the user says "Everyone shared X", add all known people plus 'Everyone' if specific names aren't clear, but prefer specific names if previously mentioned.
    5. Maintain existing assignments unless the user explicitly changes them or says "remove X".
    6. Return the FULL list of items with their IDs and the NEW 'assignedTo' state.
    7. Generate a short, helpful response message IN SPANISH (Español).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: UPDATE_SCHEMA
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return {
        updatedItems: result.items,
        message: result.response_message,
        people: result.people_found || []
    };

  } catch (error) {
    console.error("Chat command processing failed:", error);
    throw error;
  }
}