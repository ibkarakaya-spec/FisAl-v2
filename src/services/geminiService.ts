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

// Model rotasyonu için kullanılacak modeller (Sadece izin verilen ve güncel modeller)
const MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview"
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
              { text: `Aşağıdaki fiş görselini analiz et ve verileri JSON formatında döndür. Kategoriler: ${categories.join(', ')}` },
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
          // thinkingConfig'i kaldırıyoruz çünkü her modelle uyumlu olmayabilir
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

      const text = response.text?.trim();
      if (text) {
        return JSON.parse(text);
      }
      throw new Error("Model boş yanıt döndürdü.");
    } catch (e: any) {
      lastError = e;
      const errorMsg = e.message || "";
      // Eğer hata limit aşımı ise bir sonraki modele geç
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
        console.warn(`${modelName} limiti doldu, sıradaki modele geçiliyor...`);
        continue;
      }
      // Diğer kritik hatalarda (örn: geçersiz görsel) direkt fırlat
      throw e;
    }
  }

  throw lastError;
}
