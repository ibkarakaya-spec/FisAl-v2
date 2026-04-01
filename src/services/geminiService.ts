import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const DEFAULT_CATEGORIES = [
  'Gıda ve Market',
  'Araç ve Ulaşım',
  'Fatura',
  'Abonelik',
  'Kişisel Harcama',
  'Eş Kişisel',
  'Aile Sosyal',
  'Mobilya'
];

export async function extractReceiptData(base64Image: string, categories: string[]) {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `Bu fiş görselindeki verileri ayıkla. 
  Kategoriyi şu listeden seç: ${categories.join(', ')}.
  Tarih formatı GG.AA.YYYY olmalı.
  Tüm ürün isimlerini büyük harf yap.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor: { type: Type.STRING },
            date: { type: Type.STRING },
            total: { type: Type.NUMBER },
            category: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER }
                },
                required: ["name", "price"]
              }
            }
          }
        }
      }
    });
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini API error", e);
    return {};
  }
}
