import axios from "axios";

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

export async function extractReceiptData(
  base64Image: string, 
  categories: string[], 
  onStatusUpdate?: (msg: string) => void
) {
  try {
    if (onStatusUpdate) onStatusUpdate("Analiz İstemi Gönderiliyor...");
    
    const response = await axios.post("/api/analyze-receipt", {
      image: base64Image,
      categories: categories
    });

    return response.data;
  } catch (error: any) {
    console.error("Gemini API Client error:", error);
    const apiError = error.response?.data?.error || error.message;
    throw new Error(`Analiz başarısız: ${apiError}`);
  }
}
