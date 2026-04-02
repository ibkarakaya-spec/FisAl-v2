import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const prompt = `Aşağıdaki fiş görselini en yüksek doğrulukla analiz et ve verileri JSON formatında çıkar.
  
  KRİTİK TALİMATLAR:
  1. MAĞAZA ADI (vendor): Fişin en üstündeki en büyük yazıyı veya logodaki ismi bul. (Örn: MİGROS, BİM, A101, SHELL vb.)
  2. TARİH (date): Fiş üzerindeki tarihi bul. Format GG.AA.YYYY olmalı. Eğer tarih bulunamazsa bugünün tarihini (${new Date().toLocaleDateString('tr-TR')}) kullan.
  3. TOPLAM TUTAR (total): Fişin en altında yazan "TOPLAM", "GENEL TOPLAM" veya "ÖDENECEK" tutarını sayı olarak yaz. Kuruş ayracı olarak nokta kullan.
  4. ÜRÜNLER (items): 
     - Fişteki her bir kalemi tek tek oku.
     - Ürün isimlerini tamamen BÜYÜK HARF yap.
     - Fiyatları sayı olarak yaz.
     - Miktar belirtilmemişse 1 yaz.
     - Poşet, KDV, indirim gibi kalemleri de listeye ekle.
  5. KATEGORİ (category): Fişin içeriğine göre şu listeden en uygun olanı seç: ${categories.join(', ')}.
  
  HATA ÖNLEME:
  - Rakamları okurken çok dikkatli ol (Örn: 8 ile B, 0 ile O karışmamalı).
  - Virgül ile ayrılmış tutarları noktaya çevir (Örn: 12,50 -> 12.50).
  - Ürünlerin toplamı ile 'total' alanındaki tutarın tutarlı olduğundan emin ol.
  - Sadece JSON döndür, başka açıklama yazma.`;

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
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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
    
    if (!response) {
      throw new Error("Gemini API returned no response");
    }

    const text = response.text;
    if (!text) {
      throw new Error("Gemini API returned no text content");
    }

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse Error on text:", text);
      throw new Error("Failed to parse Gemini response as JSON");
    }
  } catch (e: any) {
    console.error("Gemini API error details:", e);
    throw e;
  }
}
