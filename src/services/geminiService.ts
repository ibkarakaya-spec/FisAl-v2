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

// Model rotasyonu için kullanılacak modeller (Hızdan kaliteye doğru sıralı)
const MODELS = [
  "gemini-3.1-flash-lite-preview", // En hızlı (Lite)
  "gemini-flash-latest",          // Çok hızlı (Flash 2.0)
  "gemini-3-flash-preview",       // Dengeli (Flash 3.0)
  "gemini-3.1-pro-preview",       // En kaliteli (Pro)
];

export async function extractReceiptData(
  base64Image: string, 
  categories: string[], 
  onStatusUpdate?: (msg: string) => void
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY bulunamadı. Lütfen ayarları kontrol edin.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  let lastError: any = null;

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i];
    try {
      if (onStatusUpdate) onStatusUpdate(`Analiz Ediliyor (${modelName})...`);
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: `Aşağıdaki fiş görselini analiz et ve verileri JSON formatında döndür. 
                TARİH FORMATI: Daima DD.MM.YYYY (örn: 15.04.2024) şeklinde olmalı. 
                MAĞAZA ADI: Fişteki mağaza adını büyük harflerle yaz.
                Kategoriler: ${categories.join(', ')}` },
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
              confidence: { type: Type.NUMBER, description: "0.0 - 1.0 arası güven skoru" },
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
            },
            required: ["vendor", "total", "date"]
          }
        }
      });

      const text = response.text?.trim();
      if (text) {
        const data = JSON.parse(text);
        // Eğer bir veri döndüyse başarılı sayıyoruz
        return data;
      }
      throw new Error("Model boş yanıt döndürdü.");
    } catch (e: any) {
      lastError = e;
      const errorMsg = e.message || "";
      
      // Hatalarda (Limit aşımı, model hatası vb.) sıradaki modele geç
      if (i < MODELS.length - 1) {
        const statusMsg = errorMsg.includes('429') ? "Limit doldu, sıradaki modele geçiliyor..." : `${modelName} denemesi başarısız, sıradaki modele geçiliyor...`;
        if (onStatusUpdate) onStatusUpdate(statusMsg);
        console.warn(`${modelName} hatası, sıradaki modele geçiliyor...`, errorMsg);
        continue;
      }
      throw e;
    }
  }

  throw lastError;
}
