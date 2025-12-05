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
    // Changed to gemini-2.5-flash for speed and quota
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `
              Analyze this receipt image. Extract all items, prices, tax, tip, and total. Identify the currency symbol. 
              
              CRITICAL INSTRUCTIONS FOR SPLIT/PARTIAL RECEIPTS:
              1. **TOP EDGE DETECTION**: This might be the 2nd half of a long receipt. Look at the VERY TOP pixel line. If there is text cut off or a price appearing without a name, try to infer it or label it "Item continued". DO NOT SKIP the first item even if it looks incomplete.
              2. **Missing Items**: If an item name is cut off but price is visible, include it as "Unknown Item" with the price.
              3. **Tax Logic**: If the receipt lists tax separately but the item prices ALREADY include tax (common in Europe), extract the tax amount anyway.
              4. Return strictly JSON.
            ` }
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

    // --- SMART TAX LOGIC ---
    // Check if items sum up to Total (VAT Included) or Subtotal (VAT Excluded)
    const sumItems = items.reduce((sum: number, item: any) => sum + item.price, 0);
    const statedTotal = data.total || 0;
    
    // If sum of items is closer to Total than to (Total - Tax), implies Tax is included in item prices.
    // In this case, we zero out the 'tax' field for the split calculation so we don't add it twice.
    let finalTax = data.tax || 0;
    let finalSubtotal = data.subtotal || sumItems;

    if (Math.abs(sumItems - statedTotal) < (statedTotal * 0.05)) {
        // The items already equal the total. Tax is included.
        // We set tax to 0 for the "Add on" logic in SummaryPanel, 
        // effectively treating the item prices as the final cost to split.
        finalTax = 0;
        finalSubtotal = sumItems; 
    }

    return {
      items,
      subtotal: finalSubtotal,
      tax: finalTax,
      tip: data.tip || 0,
      total: statedTotal,
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
      model: 'gemini-2.5-flash',
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