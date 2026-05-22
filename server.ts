import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache to temporarily match share-target POST requests and React client GET retrievals
const sharedContentCache = new Map<string, any>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Configure multer memory storage for sharing pdfs, screenshots, and bills
  const upload = multer({ storage: multer.memoryStorage() });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Handle Android PWA / Chrome / System Share module post request
  app.post("/api/share-target", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const title = (req.body.title || "").toString().trim();
      const text = (req.body.text || "").toString().trim();

      console.log(`[PWA Share Target] Files count: ${files?.length || 0}, Title: ${title}, Text: ${text}`);

      let parsedResult: any = null;
      const contentToAnalyze = text || title;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEYis not configured on server.");
      }
      const ai = new GoogleGenAI({ apiKey });

      if (files && files.length > 0) {
        // PDF or Image shared
        const file = files[0];
        console.log(`[PWA Share Target] Extracting data from file: ${file.originalname} (mimetype: ${file.mimetype})`);

        const promptText = `Aşağıdaki dosyayı analiz et ve verileri Türkçe JSON formatında döndür.
          BU GÖRSEL VEYA PDF: Bir alışveriş fişi, fatura VEYA Akbank mobil bankacılık (havale, eft, FAST, dekont, transfer, kredi kartı harcaması, mobil ödeme) belgesi olabilir.
          
          Senden şu alanları tamamen doğru bir şekilde çıkarmanı istiyoruz:
          - MAĞAZA ADI (vendor): Alıcı veya gönderen kişi/kurum veya işlem açıklamasını ("AKBANK FAST - [Alıcı]") büyük harflerle yaz.
          - TOPLAM (total): İşlem tutarını sayı/number olarak bul (örn. 450.00 veya 1500). Kuruş hanesine dikkat et.
          - TARİH (date): İşlem/dekont tarihindeki tarihi bul. TARİH FORMATI: Daima DD.MM.YYYY (örn: 15.04.2024 veya 22.05.2026) şeklinde olmalı.
          - KATEGORİ (category): Alışveriş veya transfer türüne göre şu kategorilerden en uygununu eşle: 'Gıda ve Market', 'Araç ve Ulaşım', 'Fatura', 'Abonelik', 'Kişisel Harcama', 'Eş Kişisel', 'Aile Sosyal', 'Mobilya'
          
          Yanıtı sadece schema yapısına uygun JSON olarak döndür.`;

        const filePart = {
          inlineData: {
            data: file.buffer.toString("base64"),
            mimeType: file.mimetype
          }
        };

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                { text: promptText },
                filePart
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
                category: { type: Type.STRING }
              },
              required: ["vendor", "total", "date", "category"]
            }
          }
        });

        const responseText = response.text?.trim();
        if (responseText) {
          parsedResult = JSON.parse(responseText);
          if (file.mimetype.startsWith("image/")) {
            parsedResult.imageUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
          }
        }
      } else if (contentToAnalyze) {
        // Plain text shared
        console.log(`[PWA Share Target] Extracting data from text description`);

        const promptText = `Aşağıdaki Akbank mobil bankacılık paylaşım metnini veya SMS/bildirim yazısını oku, işlem detaylarını analiz et ve verileri Türkçe JSON formatında döndür.
          TARİH FORMATI: Daima DD.MM.YYYY (örn: 15.04.2024) şeklinde olmalı. 
          MAĞAZA ADI (vendor): Alıcı veya gönderen kişi ya da kurumun adını büyük harflerle yaz. (örn: 'AKBANK FAST - AHMET YILMAZ')
          KATEGORİ (category): Metindeki işlem amacına göre şu kategorilerden en uygununu eşle: 'Gıda ve Market', 'Araç ve Ulaşım', 'Fatura', 'Abonelik', 'Kişisel Harcama', 'Eş Kişisel', 'Aile Sosyal', 'Mobilya'
          
          Metin:
          """
          ${contentToAnalyze}
          """`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                { text: promptText }
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
                category: { type: Type.STRING }
              },
              required: ["vendor", "total", "date", "category"]
            }
          }
        });

        const responseText = response.text?.trim();
        if (responseText) {
          parsedResult = JSON.parse(responseText);
        }
      }

      if (parsedResult) {
        const shareId = "share-" + Math.random().toString(36).substring(2, 11);
        sharedContentCache.set(shareId, parsedResult);
        // Clean from cache after 5 minutes
        setTimeout(() => {
          sharedContentCache.delete(shareId);
        }, 5 * 60 * 1000);

        console.log(`[PWA Share Target] Successfully cached parsed share result. ID: ${shareId}`);
        return res.redirect(`/?sharedId=${shareId}`);
      } else {
        return res.redirect(`/?shareError=NoDataExtracted`);
      }
    } catch (err: any) {
      console.error("[PWA Share Target] Parsing error:", err);
      return res.redirect(`/?shareError=${encodeURIComponent(err.message || "UnknownError")}`);
    }
  });

  // Client fetches the parsed information using the cached ID
  app.get("/api/shared-target/:id", (req, res) => {
    const { id } = req.params;
    const data = sharedContentCache.get(id);
    if (data) {
      sharedContentCache.delete(id); // Single capture
      return res.json({ success: true, data });
    }
    return res.status(404).json({ success: false, error: "Paylaşılan veri bulunamadı veya süresi doldu." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
