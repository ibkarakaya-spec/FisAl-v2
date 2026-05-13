import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import axios from "axios";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // API Routes
  app.get("/api/auth/google/url", (req, res) => {
    const client_id = process.env.GOOGLE_CLIENT_ID;
    if (!client_id) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID NOT SET. Please configure in Settings." });
    }

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const redirect_uri = `${protocol}://${host}/auth/callback`;
    
    const scopes = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ");

    const params = new URLSearchParams({
      client_id,
      redirect_uri,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url });
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const redirect_uri = `${protocol}://${host}/auth/callback`;
      
      const response = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: "authorization_code",
      });

      const { access_token } = response.data;

      // Store in cookie - SameSite=none and Secure=true required for iframes
      res.cookie("google_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3600 * 1000, // 1 hour
      });

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f8fafc; margin: 0;">
            <div style="background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center;">
              <h2 style="color: #4f46e5; margin-top: 0;">Bağlantı Başarılı!</h2>
              <p style="color: #64748b;">Google Drive bağlantısı kuruldu. Bu pencere kapatılıyor...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', service: 'google_drive' }, '*');
                  setTimeout(() => window.close(), 1000);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Auth error", error.response?.data || error.message);
      res.status(500).send(`Authentication failed: ${error.response?.data?.error?.message || error.message}`);
    }
  });

  app.get("/api/auth/google/status", (req, res) => {
    res.json({ connected: !!req.cookies.google_token });
  });

  app.post("/api/drive/export", async (req, res) => {
    const token = req.cookies.google_token;
    if (!token) return res.status(401).json({ error: "Oturum süresi dolmuş veya bağlanılmamış." });

    const { data, filename } = req.body;

    try {
      const metadata = {
        name: filename || `fis_ai_backup_${new Date().toISOString().split('T')[0]}.json`,
        mimeType: "application/json",
      };

      const form = new FormData();
      form.append("metadata", JSON.stringify(metadata), { contentType: "application/json" });
      form.append("file", JSON.stringify(data), { contentType: "application/json", filename: "backup.json" });

      const uploadResponse = await axios.post(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
        }
      );

      res.json({ success: true, fileId: uploadResponse.data.id });
    } catch (error: any) {
      console.error("Drive upload error", error.response?.data || error.message);
      res.status(500).json({ error: `Yükleme başarısız oldu: ${error.response?.data?.error?.message || error.message}` });
    }
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
