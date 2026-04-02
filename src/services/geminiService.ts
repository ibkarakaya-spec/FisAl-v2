import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

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

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 5, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const isRetryable = e.message?.includes('429') || e.status === 429 || 
                        e.message?.includes('503') || e.status === 503;
    if (retries > 0 && isRetryable) {
      console.warn(`Transient error hit (${e.status || 'unknown'}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 1.5);
    }
    throw e;
  }
}

export async function extractReceiptData(base64Image: string, categories: string[]) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Aşağıdaki fiş görselini analiz et ve verileri JSON formatında çıkar.
  
  Kurallar:
  1. Kategori seçimini şu listeden yap: ${categories.join(', ')}.
  2. Tarih formatı GG.AA.YYYY (Örn: 02.04.2026) olmalı.
  3. Ürün isimlerini (items) tamamen BÜYÜK HARF yap.
  4. Fişteki tüm kalemleri (ürünler, poşet, KDV vb.) 'items' listesine ekle.
  5. Eğer miktar (quantity) belirtilmemişse 1 varsay.
  6. Fişin en altındaki genel toplam tutarı 'total' alanına sayı olarak yaz.
  7. Mağaza adını (vendor) fişin en üstünden veya logodan bulup 'vendor' alanına yaz.
  
  Önemli: Fişteki rakamlar bazen silik olabilir, lütfen en mantıklı okumayı yap. Toplam tutar (total) ile kalemlerin (items) toplamının tutarlı olduğundan emin ol.`;

  try {
    const response = await retryWithBackoff(() => ai.models.generateContent({
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
    }));
    
    console.log("Gemini API raw response:", response);
    
    if (!response) {
      throw new Error("Gemini API returned no response");
    }

    const text = response.text;
    console.log("Gemini API text:", text);
    
    if (!text) {
      throw new Error("Gemini API returned no text content");
    }

    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini API error details:", e);
    return {};
  }
}
