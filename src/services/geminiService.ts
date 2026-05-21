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
              { text: `Aşağıdaki görseli analiz et ve verileri JSON formatında döndür. 
                BU GÖRSEL: Bir alışveriş fişi, fatura VEYA Akbank mobil bankacılık (havale, eft, FAST, dekont, transfer, kredi kartı harcaması, mobil ödeme) ekran görüntüsü olabilir.
                Eğer bir Akbank mobil bankacılık veya transfer detayı ise:
                - MAĞAZA ADI (vendor): Alıcı veya gönderen kişi/kurum adını ya da işlemin özelliğini ("AKBANK FAST - [Alıcı]") büyük harflerle yaz.
                - TOPLAM (total): İşlem tutarını 숫자/sayı olarak bul (örn. 450.00 veya 1500).
                - TARİH (date): İşlem/dekont tarihindeki tarihi bul.
                - KATEGORİ (category): Bu harcamayı/transferi mevcut kategorilerden en uygununa eşle (örn. Ev kirası havalesi ise "Kişisel Harcama", elektrik internet ise "Fatura").
                
                STANDART FİŞLER İÇİN:
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
        return data;
      }
      throw new Error("Model boş yanıt döndürdü.");
    } catch (e: any) {
      lastError = e;
      const errorMsg = e.message || "";
      
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

export async function extractAkbankTextData(
  copiedText: string,
  categories: string[],
  onStatusUpdate?: (msg: string) => void
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY bulunamadı. Lütfen ayarları kontrol edin.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  if (onStatusUpdate) onStatusUpdate("Akbank metni çözümleniyor...");
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          parts: [
            { text: `Aşağıdaki Akbank mobil bankacılık paylaşım metnini veya SMS/bildirim yazısını oku, işlem detaylarını analiz et ve verileri JSON formatında döndür.
              İçerikten gönderici/alıcı adı, transfer miktarı, işlem tarihi ve kategoriyi çıkar.
              TARİH FORMATI: Daima DD.MM.YYYY (örn: 15.04.2024) şeklinde olmalı. 
              MAĞAZA ADI (vendor): Alıcı veya gönderen kişi ya da kurumun adını büyük harflerle yaz. (örn: 'AKBANK FAST - AHMET YILMAZ' veya sadece 'AHMET YILMAZ')
              KATEGORİ (category): Metindeki işlem amacına göre (${categories.join(', ')}) listesinden en uygun kategoriyi ata.
              
              Metin:
              """
              ${copiedText}
              """` 
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
                  price: { type: Type.NUMBER }
                },
                required: ["name", "price"]
              }
            }
          },
          required: ["vendor", "total", "date"]
        }
      }
    });

    const respText = response.text?.trim();
    if (respText) {
      return JSON.parse(respText);
    }
    throw new Error("Model boş yanıt döndürdü.");
  } catch (err) {
    console.error("Akbank text parsing error:", err);
    throw err;
  }
}
