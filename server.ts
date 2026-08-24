import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Gemini Client (for high-quality search)
  const genai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // OpenRouter Client
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Arci.ai",
    },
  });

  // API route to test OpenRouter API key
  app.post("/api/test-key", async (req, res) => {
    const userApiKey = req.headers["x-api-key"] || req.body?.apiKey;
    if (!userApiKey || typeof userApiKey !== "string" || userApiKey.trim().length < 8) {
      return res.status(400).json({ error: "Ключ не указан или слишком короткий" });
    }

    try {
      const testClient = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: userApiKey.trim(),
        defaultHeaders: {
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "Arci.ai",
        },
      });

      await testClient.chat.completions.create({
        model: "openrouter/auto",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 2,
      });

      return res.json({ status: "ok", message: "API-ключ действителен и готов к работе!" });
    } catch (error: any) {
      console.error("Test API Key Error:", error);
      let message = error.message || "Ошибка проверки ключа";
      if (error.status === 401) {
        message = "Неверный API ключ (Unauthorized). Проверьте правильность sk-or-...";
      } else if (error.status === 402) {
        message = "Недостаточно средств (Payment Required) на балансе OpenRouter.";
      }
      return res.status(401).json({ error: message });
    }
  });

  // API Route for streaming completions
  app.post("/api/generate", async (req, res) => {
    const { 
      prompt, 
      model = "stealth/ox-alpha", 
      webSearch = false, 
      primaryLanguage = "RU", 
      selectedLanguages = ["RU", "EN", "ZH", "DE", "FR", "ES", "JA", "KO", "PT", "IT"] 
    } = req.body;

    const langNames: Record<string, string> = {
      RU: "русском (Russian)",
      EN: "английском (English)",
      ZH: "китайском (中文 / Simplified Chinese)",
      DE: "немецком (Deutsch)",
      FR: "французском (Français)",
      ES: "испанском (Español)",
      JA: "японском (日本語 / Japanese)",
      KO: "корейском (한국어 / Korean)",
      PT: "португальском (Português)",
      IT: "итальянском (Italiano)",
    };

    const targetLangName = langNames[primaryLanguage] || "русском (Russian)";

    const langsList = (Array.isArray(selectedLanguages) && selectedLanguages.length > 0)
      ? selectedLanguages.join(", ")
      : "RU, EN, ZH, DE, FR, ES, JA, KO, PT, IT";

    // System instructions tailored strictly to the selected primary language
    const systemPromptText = `Вы — Arci.ai, элитный ИИ-веб-разработчик и дизайнер мирового уровня.
ГЛАВНОЕ ПРАВИЛО ЯЗЫКА:
1. Вы ОБЯЗАНЫ отвечать, объяснять и генерировать исходный контент сайта на ${targetLangName}.
2. Если в ответе есть текстовые пояснения, они ДОЛЖНЫ быть СТРОГО на ${targetLangName}.
3. Создайте идеальный адаптивный сайт (Mobile-First 320px–1920px+).
4. ТРЕБОВАНИЕ МУЛЬТИЯЗЫЧНОСТИ: В шапку сайта (header) обязательно добавьте функциональный переключатель языков (${langsList}). При переключении весь текст на странице мгновенно переводится с помощью встроенного JavaScript объекта словаря переводов. По умолчанию сайт открывается на ${primaryLanguage}.
5. В футере сайта добавьте аккуратную подпись «by Arci.ai».
6. ВЫВОД: Только рабочий чистый HTML-код (CSS внутри <style>, логика внутри <script>). Без постороннего текста и markdown блоков.`;

    // Try Gemini Search if requested and available
    const isGeminiModel = model.includes("google/gemini") || model.includes("gemini") || model === "gemini-3.7-flash";
    
    if (webSearch && isGeminiModel && process.env.GEMINI_API_KEY) {
      try {
        const response = await genai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: systemPromptText,
          },
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({ content: response.text })}\n\n`);
        
        // Include grounding metadata if available
        if (response.candidates?.[0]?.groundingMetadata) {
          res.write(`data: ${JSON.stringify({ grounding: response.candidates[0].groundingMetadata })}\n\n`);
        }
        
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      } catch (error: any) {
        console.warn("Gemini Search unavailable or quota reached, falling back to LLM generation:", error.message || error);
        // Fallback continues below
      }
    }

    if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "No AI API key configured" });
    }

    const userApiKey = req.headers["x-api-key"];
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: (userApiKey && typeof userApiKey === 'string' && userApiKey.length > 10) 
        ? userApiKey 
        : (process.env.OPENROUTER_API_KEY || "dummy"),
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Arci.ai",
      },
    });

    // List of fallback models to try if the requested model 404s or is unavailable
    const candidateModels = [
      model,
      "openrouter/auto",
      "deepseek/deepseek-chat:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.5-flash",
      "qwen/qwen-2.5-coder-32b-instruct:free"
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let stream = null;
    let lastError: any = null;

    for (const targetModel of candidateModels) {
      try {
        stream = await openai.chat.completions.create({
          model: targetModel,
          messages: [
            { role: "system", content: systemPromptText },
            { role: "user", content: prompt }
          ],
          stream: true,
          max_tokens: 4000,
        });
        if (stream) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${targetModel} failed (${err.status || err.message}), attempting fallback...`);
        // If it's a 401 unauthorized or 402 payment, don't keep trying all models
        if (err.status === 401 || err.status === 402) {
          break;
        }
      }
    }

    if (!stream) {
      // If OpenRouter completely failed and GEMINI_API_KEY is available, try direct Gemini
      if (process.env.GEMINI_API_KEY) {
        try {
          const directGemini = await genai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              systemInstruction: systemPromptText,
            }
          });

          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          for await (const chunk of directGemini) {
            if (chunk.text) {
              res.write(`data: ${JSON.stringify({ content: chunk.text })}\n\n`);
            }
          }

          res.write("data: [DONE]\n\n");
          res.end();
          return;
        } catch (geminiErr: any) {
          console.error("Direct Gemini backup failed:", geminiErr);
        }
      }

      console.error("OpenRouter Error:", lastError);
      let status = lastError?.status || 500;
      let message = lastError?.message || "An unexpected error occurred during generation";

      if (lastError?.status === 429) {
        status = 429;
        message = "Model is currently rate-limited. Please try again in a few seconds or choose another model.";
      } else if (lastError?.status === 401) {
        status = 401;
        message = "Invalid OpenRouter API Key. Please check your key configuration.";
      }

      if (!res.headersSent) {
        return res.status(status).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
        return;
      }
    }

    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (streamErr: any) {
      console.error("Stream transfer error:", streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: streamErr.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
        res.end();
      }
    }
  });

  // API Route to diagnose and repair website code (Fix for 50 tokens)
  app.post("/api/repair", async (req, res) => {
    const { 
      code, 
      model = "google/gemini-2.0-flash-exp:free", 
      primaryLanguage = "RU", 
      errorLogs = [] 
    } = req.body;

    if (!code || typeof code !== "string" || code.trim().length < 10) {
      return res.status(400).json({ error: "Code is required for repair" });
    }

    const systemPromptText = `Вы — специализированный ИИ-агент исправления и отладки веб-сайтов Arci.ai Debugger & Auto-Repair.
ВАША ЗАДАЧА:
1. Проанализировать существующий код сайта, обнаружить и исправить любые синтаксические ошибки HTML, CSS, JavaScript.
2. Устранить runtime ошибки скриптов, необработанные исключения (ReferenceError, TypeError, SyntaxError), сломанные селекторы DOM или обработчики событий.
3. Проверить адаптивность (мета-тег viewport), корректность закрытия тегов, отсутствие битых стилей.
4. Сохранить изначальный дизайн, структуру, контент и функционал сайта, сделав его на 100% рабочим и стабильным.
5. ВЫВОД: Выдайте ТОЛЬКО исправленный чистый HTML-код (с <style> и <script> внутри). Без вводного текста, без markdown \`\`\`html блоков, только чистый исполняемый HTML документ.`;

    const userPrompt = `Пожалуйста, проверь и почини этот сайт.
${Array.isArray(errorLogs) && errorLogs.length > 0 ? `Обнаруженные ошибки консоли / DOM:\n${errorLogs.join("\n")}\n\n` : ""}
Исходный код сайта:
${code}`;

    const userApiKey = req.headers["x-api-key"];
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: (userApiKey && typeof userApiKey === "string" && userApiKey.length > 10) 
        ? userApiKey 
        : process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Arci.ai Auto-Repair",
      },
    });

    const candidateModels = [
      model,
      "openrouter/auto",
      "deepseek/deepseek-chat:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.5-flash",
      "qwen/qwen-2.5-coder-32b-instruct:free"
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let stream = null;
    let lastError: any = null;

    for (const targetModel of candidateModels) {
      try {
        stream = await openai.chat.completions.create({
          model: targetModel,
          messages: [
            { role: "system", content: systemPromptText },
            { role: "user", content: userPrompt }
          ],
          stream: true,
          max_tokens: 6000,
        });
        if (stream) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Repair model ${targetModel} failed, attempting fallback...`);
        if (err.status === 401 || err.status === 402) {
          break;
        }
      }
    }

    if (!stream) {
      if (process.env.GEMINI_API_KEY) {
        try {
          const directGemini = await genai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: userPrompt,
            config: {
              systemInstruction: systemPromptText,
            }
          });

          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          for await (const chunk of directGemini) {
            if (chunk.text) {
              res.write(`data: ${JSON.stringify({ content: chunk.text })}\n\n`);
            }
          }

          res.write("data: [DONE]\n\n");
          res.end();
          return;
        } catch (geminiErr) {
          console.error("Direct Gemini repair backup failed:", geminiErr);
        }
      }

      let status = lastError?.status || 500;
      let message = lastError?.message || "Ошибка при автоматической починке сайта";
      if (!res.headersSent) {
        return res.status(status).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
        return;
      }
    }

    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Auto-Repair Stream Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // GitHub OAuth Routes
  app.get("/api/auth/github/url", (req, res) => {
    const client_id = process.env.GITHUB_CLIENT_ID;
    if (!client_id) {
      return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
    }

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    const params = new URLSearchParams({
      client_id: client_id,
      scope: "repo user",
      redirect_uri: `${baseUrl}/auth/callback`,
    });

    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) throw new Error("Failed to get access token");

      // Get User Info
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      const userData = await userResponse.json();

      // Return HTML that sends message to opener and closes
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GITHUB_AUTH_SUCCESS', 
                  user: ${JSON.stringify(userData)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. Closing window...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("GitHub Auth Error:", error);
      res.status(500).send("Authentication failed");
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
    console.log(`WebForge Server running on http://localhost:${PORT}`);
  });
}

startServer();
