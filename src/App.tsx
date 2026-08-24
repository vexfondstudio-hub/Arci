/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { 
  Send, 
  Code, 
  Eye, 
  Terminal, 
  Cpu, 
  Layers, 
  Download, 
  Zap,
  CheckCircle2,
  Globe,
  Link as LinkIcon,
  Settings,
  Github,
  X,
  Plus,
  MessageSquare,
  Layout,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Languages,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Clock,
  BarChart2,
  Smartphone,
  Tablet,
  Monitor,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Stethoscope,
  RotateCw,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SUPPORTED_LANGUAGES, TRANSLATIONS, type LanguageCode } from "./i18n";
import { 
  DAILY_TOKEN_LIMIT, 
  WEEKLY_TOKEN_LIMIT, 
  MONTHLY_TOKEN_LIMIT,
  getTokenQuotaStats, 
  recordTokenUsage, 
  checkTokenQuota, 
  estimateTokensFromText, 
  formatTokenNumber, 
  type TokenQuotaStats 
} from "./tokenQuota";
import { TOKEN_CONSUMPTION_DATA } from "./tokenConsumptionGuide";
import { 
  analyzeSiteHealth, 
  injectDiagnosticHook, 
  type SiteHealthReport 
} from "./siteHealthChecker";

// Types
interface Message {
  role: "user" | "ai";
  content: string;
}

function TokenChipIcon({ className = "w-3.5 h-3.5", alt = "Tokens" }: { className?: string; alt?: string }) {
  return (
    <img
      src="https://img.icons8.com/?size=100&id=573&format=png&color=ffffff"
      alt={alt}
      className={`inline-block object-contain ${className}`}
      referrerPolicy="no-referrer"
    />
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [mobileView, setMobileView] = useState<"chat" | "stage">("chat");
  const [previewDevice, setPreviewDevice] = useState<"full" | "desktop" | "tablet" | "mobile">("full");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState("openrouter/auto");
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("arci_api_key") || "");
  
  // Token Quotas (25k / day, 125k / week, 510k / month for free tier)
  const [quotaStats, setQuotaStats] = useState<TokenQuotaStats>(() => getTokenQuotaStats());
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  // Primary app language (affects UI and AI response)
  const [primaryLang, setPrimaryLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("arci_primary_lang") as LanguageCode;
    return saved && TRANSLATIONS[saved] ? saved : "RU";
  });

  // Languages embedded in generated website header
  const [selectedLangs, setSelectedLangs] = useState<string[]>(() => {
    const saved = localStorage.getItem("arci_selected_langs");
    return saved ? JSON.parse(saved) : ["RU", "EN", "ZH", "DE", "FR", "ES", "JA", "KO", "PT", "IT"];
  });

  const [apiTestStatus, setApiTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [apiTestMessage, setApiTestMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [githubUser, setGithubUser] = useState<any>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [groundingLinks, setGroundingLinks] = useState<{title: string, uri: string}[]>([]);

  // AI Diagnostics & Auto-Repair (50 tokens)
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [isRepairingSite, setIsRepairingSite] = useState(false);
  const [repairToast, setRepairToast] = useState<string | null>(null);

  // Compute health report dynamically without setting state in useEffect to prevent infinite loop
  const healthReport = useMemo(() => {
    if (!generatedCode) return null;
    return analyzeSiteHealth(generatedCode, runtimeErrors);
  }, [generatedCode, runtimeErrors]);

  // Current translation dictionary
  const t = TRANSLATIONS[primaryLang] || TRANSLATIONS.RU;
  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === primaryLang) || SUPPORTED_LANGUAGES[0];

  const models = [
    // RECOMMENDED & AUTO
    { id: "openrouter/auto", name: "Auto Select", provider: "OpenRouter", desc: t.modelDescriptions["openrouter/auto"], isFree: true, icon: <img src="https://img.icons8.com/?size=100&id=3473&format=png&color=ffffff" className="w-3.5 h-3.5 object-contain" alt="Automatic" referrerPolicy="no-referrer" /> },
    { id: "stealth/ox-alpha", name: "Ox Alpha", provider: "Stealth", desc: t.modelDescriptions["stealth/ox-alpha"], isFree: true, icon: <img src="https://img.icons8.com/?size=100&id=22770&format=png&color=ffffff" className="w-3.5 h-3.5 object-contain" alt="Ox Alpha" referrerPolicy="no-referrer" /> },

    // FREE & FAST
    { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3", provider: "DeepSeek", desc: t.modelDescriptions["deepseek/deepseek-chat:free"], isFree: true, icon: <img src="https://img.icons8.com/fluency/48/deepseek.png" className="w-3.5 h-3.5 object-contain" alt="DeepSeek" /> },
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", provider: "Meta", desc: t.modelDescriptions["meta-llama/llama-3.3-70b-instruct:free"], isFree: true, icon: <img src="https://img.icons8.com/color/48/llama.png" className="w-3.5 h-3.5 object-contain" alt="Llama" /> },
    { id: "qwen/qwen-2.5-coder-32b-instruct:free", name: "Qwen 2.5 Coder", provider: "Alibaba", desc: t.modelDescriptions["qwen/qwen-2.5-coder-32b-instruct:free"] || "Alibaba Code Specialist", isFree: true, icon: <img src="https://img.icons8.com/color/48/source-code.png" className="w-3.5 h-3.5 object-contain" alt="Qwen" /> },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", desc: t.modelDescriptions["google/gemini-2.5-flash"] || "Ultra-fast Gemini", isFree: true, icon: <img src="https://img.icons8.com/color/48/gemini-ai.png" className="w-3.5 h-3.5 object-contain" alt="Gemini" /> },
    
    // PRO
    { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", desc: t.modelDescriptions["openai/gpt-4o"], isFree: false, icon: <img src="https://img.icons8.com/fluency/48/chatgpt.png" className="w-3.5 h-3.5 object-contain" alt="ChatGPT" /> },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", desc: t.modelDescriptions["openai/gpt-4o-mini"], isFree: false, icon: <img src="https://img.icons8.com/fluency/48/chatgpt.png" className="w-3.5 h-3.5 object-contain" alt="ChatGPT" /> },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", desc: t.modelDescriptions["anthropic/claude-3.5-sonnet"], isFree: false, icon: <img src="https://img.icons8.com/fluency/48/claude-ai.png" className="w-3.5 h-3.5 object-contain" alt="Claude" /> },
    { id: "x-ai/grok-1", name: "Grok-1", provider: "xAI", desc: t.modelDescriptions["x-ai/grok-1"], isFree: false, icon: <img src="https://img.icons8.com/fluency/48/grok.png" className="w-3.5 h-3.5 object-contain" alt="Grok" /> },
    { id: "zhipu/chatglm-turbo-v2", name: "GLM-4 Turbo", provider: "Zhipu", desc: t.modelDescriptions["zhipu/chatglm-turbo-v2"], isFree: false, icon: <img src="https://img.icons8.com/ios-filled/50/ffffff/z.png" className="w-3.5 h-3.5 object-contain bg-black rounded-sm p-0.5" alt="GLM" /> },
  ];

  const currentModel = models.find(m => m.id === model) || models[0];
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generatedCode]);

  // Memoize iframe srcDoc so it doesn't recalculate and reload unnecessarily on state changes
  const srcDocContent = useMemo(() => {
    if (!generatedCode) return "";
    return injectDiagnosticHook(generatedCode);
  }, [generatedCode]);

  // Intercept runtime JavaScript errors emitted from preview iframe
  useEffect(() => {
    let lastHandled = 0;
    const handleMessage = (event: MessageEvent) => {
      // Prevent processing messages from the same window
      if (event.source === window) return;
      if (event.data && typeof event.data === "object" && event.data.type === "ARCI_SITE_RUNTIME_ERROR") {
        const errorMsg = String(event.data.error || "Unknown JavaScript runtime error");
        const now = Date.now();
        if (now - lastHandled < 250) return; // Throttle to max 4 updates/sec
        lastHandled = now;

        setRuntimeErrors(prev => {
          if (prev.includes(errorMsg)) return prev;
          if (prev.length >= 10) return prev;
          return [...prev, errorMsg];
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleAutoRepairSite = async () => {
    if (!generatedCode || isRepairingSite) return;

    // Check token quota for 50 tokens (free users)
    const quotaCheck = checkTokenQuota(50, !!customApiKey);
    if (!quotaCheck.allowed) {
      const tierName = quotaCheck.reason === "day" 
        ? t.tokenQuotaDaily 
        : quotaCheck.reason === "week" 
        ? t.tokenQuotaWeekly 
        : t.tokenQuotaMonthly;
      const tierLimit = quotaCheck.reason === "day" 
        ? formatTokenNumber(DAILY_TOKEN_LIMIT) 
        : quotaCheck.reason === "week" 
        ? formatTokenNumber(WEEKLY_TOKEN_LIMIT) 
        : formatTokenNumber(MONTHLY_TOKEN_LIMIT);
      
      const errorMsg = t.tokenQuotaExceededError
        .replace("{tier}", tierName)
        .replace("{limit}", tierLimit);

      setMessages(prev => [
        ...prev,
        { role: "ai", content: `⚠️ ${errorMsg}` }
      ]);
      setShowQuotaModal(true);
      return;
    }

    setIsRepairingSite(true);
    setRepairToast(null);

    try {
      const response = await fetch("/api/repair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": customApiKey,
        },
        body: JSON.stringify({
          code: generatedCode,
          model,
          primaryLanguage: primaryLang,
          errorLogs: runtimeErrors,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to repair website");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let repairedCode = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "");
            if (dataStr === "[DONE]") break;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                repairedCode += data.content;
                setGeneratedCode(repairedCode);
              }
            } catch (e) {
              // Ignore stream JSON chunk errors
            }
          }
        }
      }

      // Deduct 50 tokens for auto-repair
      if (!customApiKey) {
        const updatedStats = recordTokenUsage(50, "AI Site Auto-Repair (50 Tokens)");
        setQuotaStats(updatedStats);
      }

      // Clear runtime errors and re-evaluate health
      setRuntimeErrors([]);

      setRepairToast(t.aiFixSuccessMsg);
      setTimeout(() => setRepairToast(null), 5000);
      
      setMessages(prev => [
        ...prev,
        { role: "ai", content: `✨ ${t.aiFixSuccessMsg}` }
      ]);
    } catch (err: any) {
      setRepairToast(`${t.aiFixErrorMsg}: ${err.message}`);
      setTimeout(() => setRepairToast(null), 5000);
    } finally {
      setIsRepairingSite(false);
    }
  };

  const handleTestApiKey = async () => {
    if (!customApiKey.trim()) {
      setApiTestStatus("error");
      setApiTestMessage(t.enterKeyFirst);
      return;
    }

    setApiTestStatus("testing");
    setApiTestMessage("");

    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": customApiKey.trim(),
        },
        body: JSON.stringify({ apiKey: customApiKey.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setApiTestStatus("success");
        setApiTestMessage(data.message || t.testKeySuccess);
      } else {
        setApiTestStatus("error");
        setApiTestMessage(data.error || t.testKeyError);
      }
    } catch (err: any) {
      setApiTestStatus("error");
      setApiTestMessage(t.networkErrorKey);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    const currentPrompt = prompt;

    // Check token limits for free usage
    const estimatedInputTokens = estimateTokensFromText(currentPrompt) + 500;
    const quotaCheck = checkTokenQuota(estimatedInputTokens, !!customApiKey);

    if (!quotaCheck.allowed) {
      const tierName = quotaCheck.reason === "day" 
        ? t.tokenQuotaDaily 
        : quotaCheck.reason === "week" 
        ? t.tokenQuotaWeekly 
        : t.tokenQuotaMonthly;
      const tierLimit = quotaCheck.reason === "day" 
        ? formatTokenNumber(DAILY_TOKEN_LIMIT) 
        : quotaCheck.reason === "week" 
        ? formatTokenNumber(WEEKLY_TOKEN_LIMIT) 
        : formatTokenNumber(MONTHLY_TOKEN_LIMIT);
      
      const errorMsg = t.tokenQuotaExceededError
        .replace("{tier}", tierName)
        .replace("{limit}", tierLimit);

      setMessages(prev => [
        ...prev, 
        { role: "user", content: currentPrompt },
        { role: "ai", content: `⚠️ ${errorMsg}` }
      ]);
      setPrompt("");
      setShowQuotaModal(true);
      return;
    }

    setPrompt("");
    setIsGenerating(true);
    setGroundingLinks([]);
    setMessages(prev => [...prev, { role: "user", content: currentPrompt }]);
    
    // Auto-switch to stage view on mobile when generating starts
    if (window.innerWidth < 1024) {
      setMobileView("stage");
    }

    let fullResponse = "";
    
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": customApiKey 
        },
        body: JSON.stringify({ 
          prompt: currentPrompt, 
          model, 
          webSearch,
          primaryLanguage: primaryLang,
          selectedLanguages: selectedLangs
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to connect to generator");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "");
            if (dataStr === "[DONE]") break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullResponse += data.content;
                setGeneratedCode(fullResponse);
              }
              if (data.grounding) {
                const chunks = data.grounding.groundingChunks;
                if (chunks) {
                  const links = chunks
                    .filter((c: any) => c.web)
                    .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
                  setGroundingLinks(prev => [...prev, ...links]);
                }
              }
            } catch (e: any) {
              if (e.message && e.message.includes("Rate Limit")) throw e;
            }
          }
        }
      }
      
      // Update token usage stats
      if (!customApiKey) {
        const usedCount = estimateTokensFromText(currentPrompt + fullResponse);
        const updatedStats = recordTokenUsage(usedCount, model);
        setQuotaStats(updatedStats);
      }

      setMessages(prev => [...prev, { role: "ai", content: t.siteCreatedSuccess }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "ai", content: `Error: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCode = () => {
    const blob = new Blob([generatedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Switch primary language and persist
  const changePrimaryLanguage = (code: LanguageCode) => {
    setPrimaryLang(code);
    localStorage.setItem("arci_primary_lang", code);
  };

  // Reset token history (Only allowed if user provides their own API key)
  const handleResetTokenHistory = () => {
    if (!customApiKey) return;
    localStorage.removeItem("arci_token_usage_history");
    setQuotaStats(getTokenQuotaStats());
  };

  // GitHub Auth Handler
  const handleConnectGithub = () => {
    const CLIENT_ID = "Ov23liJ10xYnQ68V2W5a";
    const REDIRECT_URI = window.location.origin;
    const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=read:user,repo`;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      GITHUB_AUTH_URL,
      "github_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=0,menubar=0`
    );

    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        return;
      }

      try {
        if (popup.location.href.includes("code=")) {
          const urlParams = new URLSearchParams(popup.location.search);
          const code = urlParams.get("code");
          
          if (code) {
            popup.close();
            clearInterval(checkPopup);
            fetchGithubToken(code);
          }
        }
      } catch (e) {
        // Ignore cross-origin frame access errors
      }
    }, 500);
  };

  const fetchGithubToken = async (code: string) => {
    try {
      const res = await fetch("/api/github/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.access_token) {
        fetchGithubUser(data.access_token);
      }
    } catch (e) {
      console.error("Failed to exchange github code", e);
    }
  };

  const fetchGithubUser = async (token: string) => {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = await res.json();
      setGithubUser(user);
    } catch (e) {
      console.error("Failed to fetch GitHub user", e);
    }
  };

  return (
    <div className="relative flex flex-col lg:flex-row h-[100dvh] min-h-[100dvh] w-full bg-[#07070b] text-zinc-300 font-sans overflow-hidden select-none">
      
      {/* Ambient Depth Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/10 blur-[130px] animate-pulse" />
        <div className="absolute top-[40%] -right-[15%] w-[45vw] h-[45vw] rounded-full bg-cyan-600/10 blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[25%] w-[55vw] h-[55vw] rounded-full bg-purple-600/10 blur-[150px]" />
      </div>

      {/* Mobile Header (Only on small screens) */}
      <header className="lg:hidden h-14 bg-black/40 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-3 sm:px-4 shrink-0 z-30 relative">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center overflow-hidden shrink-0">
            <img src="https://assets.pokemon.com/assets/cms2/img/pokedex/full/493.png" alt="Arci Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent truncate">Arci.ai</span>
          <button 
            onClick={() => setShowSettings(true)}
            className="text-xs bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-1.5 py-0.5 rounded-md text-zinc-300 font-mono flex items-center gap-1 transition-all shrink-0 backdrop-blur-md"
            title={`Language: ${currentLangObj.nativeName}`}
          >
            <span>{currentLangObj.flag}</span>
            <span className="text-[11px] font-semibold">{primaryLang}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Token Quota Mobile Trigger */}
          <button
            onClick={() => setShowQuotaModal(true)}
            className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-indigo-500/40 px-2 py-1 rounded-lg text-xs font-mono transition-all backdrop-blur-md"
            title={t.tokenQuotaSectionTitle}
          >
            <TokenChipIcon className={`w-3.5 h-3.5 ${customApiKey ? "brightness-125" : quotaStats.percentDay > 85 ? "hue-rotate-[320deg]" : ""}`} />
            {customApiKey ? (
              <span className="text-[10px] text-emerald-400 font-bold">∞</span>
            ) : (
              <span className="text-[10px] text-zinc-300 font-bold">{formatTokenNumber(quotaStats.remainingDay)}</span>
            )}
          </button>

          <button 
            onClick={() => setShowSettings(true)}
            className="p-1.5 sm:p-2 hover:bg-white/[0.08] border border-transparent hover:border-white/[0.08] rounded-lg transition-all text-zinc-400 hover:text-white"
            title={t.settingsTitle}
          >
            <Settings size={18} />
          </button>

          {/* Quick Header Toggle */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] backdrop-blur-md">
            <button 
              onClick={() => setMobileView("chat")}
              className={`p-1.5 rounded-md transition-all ${mobileView === "chat" ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30" : "text-zinc-500 hover:text-zinc-300"}`}
              title={t.chatTitle}
            >
              <MessageSquare size={15} />
            </button>
            <button 
              onClick={() => setMobileView("stage")}
              className={`p-1.5 rounded-md transition-all relative ${mobileView === "stage" ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30" : "text-zinc-500 hover:text-zinc-300"}`}
              title={t.previewTab}
            >
              <Layout size={15} />
              {generatedCode && mobileView !== "stage" && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar (Hidden on mobile) */}
      <aside className="hidden lg:flex w-16 flex-col items-center py-6 bg-black/25 backdrop-blur-2xl border-r border-white/[0.08] space-y-6 shrink-0 z-20 relative">
        <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
          <img src="https://assets.pokemon.com/assets/cms2/img/pokedex/full/493.png" alt="Arci Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">by Arci</span>
        
        <nav className="flex flex-col space-y-4 flex-1 pt-2">
          {/* Token Quota Quick Access */}
          <button 
            onClick={() => setShowQuotaModal(true)}
            className={`p-2 rounded-xl border border-transparent hover:border-white/[0.08] transition-all flex flex-col items-center gap-1.5 backdrop-blur-md ${
              customApiKey ? "text-emerald-400 hover:bg-emerald-500/10" : "text-amber-400 hover:bg-amber-500/10"
            }`}
            title={t.tokenQuotaSectionTitle}
          >
            <TokenChipIcon className="w-4 h-4" />
            <span className="text-[8px] font-bold font-mono">
              {customApiKey ? "PRO" : formatTokenNumber(quotaStats.remainingDay)}
            </span>
          </button>

          <button className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors">
            <Layers size={20} />
          </button>
          <button className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors">
            <Terminal size={20} />
          </button>
        </nav>

        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors mt-auto"
          title={t.settingsTitle}
        >
          <Settings size={22} />
        </button>
      </aside>

      {/* Main IDE Area */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Left Column: Chat/Prompt (Collapsible on mobile) */}
        <div className={`
          flex flex-col bg-black/20 backdrop-blur-2xl border-r border-white/[0.08] transition-all duration-300
          ${mobileView === "chat" ? "w-full flex" : "hidden lg:flex lg:w-[380px] xl:w-[440px] 2xl:w-[480px] lg:shrink-0"}
        `}>
          <header className="px-4 lg:px-6 py-3.5 lg:py-4 border-b border-white/[0.08] bg-white/[0.01] backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wider text-zinc-300 uppercase">{t.chatTitle}</h2>
              <button 
                onClick={() => setShowSettings(true)}
                className="hidden lg:flex text-[10px] bg-white/[0.05] border border-white/[0.08] hover:border-indigo-500/40 text-zinc-300 px-2 py-0.5 rounded-full items-center gap-1 transition-all backdrop-blur-md"
              >
                <span>{currentLangObj.flag}</span>
                <span className="font-semibold">{currentLangObj.code}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Token Quota Badge in Chat Header */}
              <button
                onClick={() => setShowQuotaModal(true)}
                className="hidden lg:flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-all backdrop-blur-md"
                title={t.tokenQuotaSectionTitle}
              >
                <TokenChipIcon className="w-3.5 h-3.5" />
                {customApiKey ? (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{t.tokenQuotaUnlimited}</span>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="text-zinc-200 font-bold">{formatTokenNumber(quotaStats.remainingDay)}</span>
                    <span className="text-zinc-500">/ 25k</span>
                  </div>
                )}
              </button>

              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] px-2 py-1 rounded-md backdrop-blur-md">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-tighter font-medium">{t.chatStatusReady}</span>
              </div>
            </div>
          </header>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 sm:space-y-6 scrollbar-hide pb-20 lg:pb-6"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4 opacity-70 py-8">
                <div className="w-12 h-12 bg-white/[0.04] border border-white/[0.08] backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/5">
                  <Zap size={24} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{t.startBuildingTitle}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-[260px] mx-auto">
                    {t.startBuildingSubtitle}
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[88%] sm:max-w-[85%] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm leading-relaxed backdrop-blur-md ${
                  msg.role === "user" 
                    ? "bg-indigo-600/80 border border-indigo-400/30 text-white shadow-lg shadow-indigo-500/15" 
                    : msg.content.includes("⚠️") || msg.content.includes("Error:")
                    ? "bg-amber-500/10 border border-amber-500/25 text-amber-300 font-medium"
                    : "bg-white/[0.04] border border-white/[0.08] text-zinc-200 shadow-sm"
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-4 py-3 rounded-2xl flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs text-indigo-400 font-mono tracking-widest uppercase font-semibold">
                    {webSearch ? t.chatStatusBrowsing : t.chatStatusBuilding}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 lg:p-6 bg-black/30 backdrop-blur-2xl border-t border-white/[0.08] shrink-0 pb-16 lg:pb-6">
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder={t.placeholder}
                className="w-full bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl py-3 sm:py-4 pl-4 sm:pl-5 pr-12 sm:pr-14 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all resize-none min-h-[68px] sm:min-h-[90px] text-zinc-200 placeholder:text-zinc-500 shadow-inner"
              />
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 p-2 bg-indigo-600/90 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 backdrop-blur-sm"
                aria-label="Send prompt"
              >
                <Send size={16} />
              </button>
            </div>
            
            <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 relative">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="relative">
                  <button 
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="flex items-center gap-2 py-1 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition-all text-left backdrop-blur-sm"
                  >
                    <div className="text-indigo-400 shrink-0">
                      {currentModel.icon}
                    </div>
                    <div className="flex flex-col min-w-[100px] sm:min-w-[120px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-200 font-bold uppercase tracking-tight leading-tight truncate max-w-[110px] sm:max-w-none">{currentModel.name}</span>
                        {currentModel.isFree && (
                          <span className="text-[8px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-0.2 rounded font-mono font-bold">
                            FREE
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-tighter leading-tight">{currentModel.provider}</span>
                    </div>
                    <ChevronDown size={12} className={`text-zinc-500 transition-transform ${showModelMenu ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {showModelMenu && (
                      <>
                        {/* Mobile Backdrop */}
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowModelMenu(false)}
                          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
                        />

                        {/* Menu */}
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full left-0 mb-3 w-[280px] sm:w-[290px] bg-[#0c0c14]/85 backdrop-blur-2xl border border-white/[0.12] rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-[60] lg:z-10"
                        >
                          <div className="p-3 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                              <Sparkles size={10} className="text-indigo-400" />
                              {t.engineTitle}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setShowModelMenu(false);
                                setShowQuotaModal(true);
                              }}
                              className="text-[9px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
                            >
                              <TokenChipIcon className="w-3 h-3" />
                              {t.dailyLimitLabel}
                            </button>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto p-1.5">
                            {models.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setModel(m.id);
                                  setShowModelMenu(false);
                                }}
                                className={`w-full flex items-start gap-3 p-2.5 sm:p-3 rounded-lg transition-all text-left group ${
                                  model === m.id ? "bg-indigo-600/20 border border-indigo-500/30" : "hover:bg-white/[0.06] border border-transparent"
                                }`}
                              >
                                <div className={`mt-0.5 p-1.5 rounded-md transition-colors ${
                                  model === m.id ? "bg-indigo-600 text-white" : "bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200"
                                }`}>
                                  {m.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className={`text-xs font-bold uppercase tracking-tight truncate ${model === m.id ? "text-indigo-300" : "text-zinc-200"}`}>
                                      {m.name}
                                    </p>
                                    {m.isFree ? (
                                      <span className="text-[8px] font-mono font-bold px-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">FREE</span>
                                    ) : (
                                      <span className="text-[8px] font-mono font-bold px-1 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">PRO</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight font-medium uppercase tracking-tighter truncate">
                                    {m.desc}
                                  </p>
                                </div>
                                {model === m.id && (
                                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shadow-[0_0_8px_rgba(99,102,241,0.6)] shrink-0"></div>
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-4 w-px bg-white/[0.08] hidden sm:block"></div>

                <button 
                  onClick={() => setWebSearch(!webSearch)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border transition-all backdrop-blur-md ${
                    webSearch 
                      ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300" 
                      : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                  }`}
                >
                  <Globe size={12} className={webSearch ? "text-indigo-400" : "text-zinc-400"} />
                  <span>{t.searchBtn}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono tracking-widest uppercase">{t.poweredBy}</span>
              </div>
            </div>

            {/* Grounding Source Links Display */}
            {groundingLinks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.08]">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <LinkIcon size={12} /> {t.sourcesFound}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {groundingLinks.map((link, idx) => (
                    <a 
                      key={idx} 
                      href={link.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded text-[10px] text-zinc-300 hover:text-indigo-300 hover:border-white/[0.15] transition-all backdrop-blur-sm"
                    >
                      <span className="truncate max-w-[120px]">{link.title || link.uri}</span>
                      <ExternalLink size={8} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stage/Preview */}
        <div className={`
          flex-1 flex flex-col bg-black/15 backdrop-blur-2xl transition-all duration-300 pb-16 lg:pb-0
          ${mobileView === "stage" ? "w-full flex" : "hidden lg:flex"}
        `}>
          <header className="h-14 border-b border-white/[0.08] flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0 bg-black/30 backdrop-blur-xl z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center bg-white/[0.04] p-0.5 sm:p-1 rounded-lg border border-white/[0.08] backdrop-blur-md">
                <button 
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all ${
                    activeTab === "preview" 
                      ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Eye size={13} /> <span>{t.previewTab}</span>
                </button>
                <button 
                  onClick={() => setActiveTab("code")}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all ${
                    activeTab === "code" 
                      ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Code size={13} /> <span>{t.codeTab}</span>
                </button>
              </div>

              {/* Viewport Device Size Switcher (Preview Mode) */}
              {activeTab === "preview" && (
                <div className="hidden md:flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.08] text-zinc-400 backdrop-blur-md">
                  <button
                    onClick={() => setPreviewDevice("full")}
                    className={`p-1.5 rounded transition-all ${previewDevice === "full" ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]" : "hover:text-zinc-200"}`}
                    title="Fullscreen Width (100%)"
                  >
                    <Layers size={13} />
                  </button>
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`p-1.5 rounded transition-all ${previewDevice === "desktop" ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]" : "hover:text-zinc-200"}`}
                    title="Desktop (1200px)"
                  >
                    <Monitor size={13} />
                  </button>
                  <button
                    onClick={() => setPreviewDevice("tablet")}
                    className={`p-1.5 rounded transition-all ${previewDevice === "tablet" ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]" : "hover:text-zinc-200"}`}
                    title="Tablet (768px)"
                  >
                    <Tablet size={13} />
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`p-1.5 rounded transition-all ${previewDevice === "mobile" ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]" : "hover:text-zinc-200"}`}
                    title="Mobile (390px)"
                  >
                    <Smartphone size={13} />
                  </button>
                </div>
              )}

              {/* Desktop Model & Token Indicator */}
              <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg backdrop-blur-md">
                <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? "bg-indigo-400 animate-pulse" : "bg-indigo-500"}`}></div>
                <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest font-semibold">
                  AI: {model.split("/").pop()?.replace("-", " ")}
                </span>
                <span className="text-zinc-600 text-xs">•</span>
                <span className="text-[10px] font-mono text-zinc-300">{currentLangObj.flag} {primaryLang}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
              {/* AI Diagnostic & Auto-Repair Button */}
              {generatedCode && (
                <button 
                  onClick={() => setShowHealthModal(true)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all backdrop-blur-md ${
                    runtimeErrors.length > 0 || (healthReport && healthReport.issues.some(i => i.severity === "critical"))
                      ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse"
                      : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-sm"
                  }`}
                  title={t.aiHealthCheckBtn}
                >
                  <ShieldAlert size={13} className={runtimeErrors.length > 0 ? "text-rose-400" : "text-emerald-400"} />
                  <span className="hidden sm:inline">{t.aiHealthCheckBtn}</span>
                  <span className="bg-black/40 px-1.5 py-0.5 rounded text-[9px] font-mono border border-white/10">50⚡</span>
                </button>
              )}

              <button 
                onClick={downloadCode}
                disabled={!generatedCode}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 rounded-lg text-[10px] sm:text-xs font-medium border border-white/[0.08] transition-all disabled:opacity-30 backdrop-blur-md"
                title={t.exportBtn}
              >
                <Download size={13} /> <span className="hidden sm:inline">{t.exportBtn}</span>
              </button>
              <div className="h-4 w-px bg-white/[0.08] mx-0.5 sm:mx-1 hidden sm:block"></div>
              <button 
                onClick={() => {
                  setGeneratedCode("");
                  setMessages([]);
                  setRuntimeErrors([]);
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 rounded-lg text-[10px] sm:text-xs font-semibold border border-indigo-500/30 transition-all backdrop-blur-md"
                title={t.newSiteBtn}
              >
                <Plus size={13} /> <span className="hidden sm:inline">{t.newSiteBtn}</span>
              </button>
            </div>
          </header>

          <div className="flex-1 relative overflow-hidden bg-black/20 p-1 sm:p-3 lg:p-6 flex items-center justify-center">
            {/* Real-time Floating Error Alert Banner */}
            {runtimeErrors.length > 0 && activeTab === "preview" && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-30 bg-rose-950/85 backdrop-blur-xl border border-rose-500/50 rounded-xl p-2.5 sm:p-3 text-rose-200 text-xs flex items-center justify-between shadow-2xl shadow-rose-950/80"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <AlertTriangle size={15} className="text-rose-400 shrink-0 animate-bounce" />
                  <div className="min-w-0">
                    <p className="font-bold text-rose-200 text-xs leading-none">
                      {t.aiIssuesFoundStatus} ({runtimeErrors.length})
                    </p>
                    <p className="text-[10px] text-rose-300/80 font-mono truncate mt-0.5 max-w-[240px] sm:max-w-md">
                      {runtimeErrors[runtimeErrors.length - 1]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAutoRepairSite}
                  disabled={isRepairingSite}
                  className="shrink-0 bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white font-bold text-[10px] sm:text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 backdrop-blur-sm"
                >
                  {isRepairingSite ? (
                    <>
                      <RotateCw size={12} className="animate-spin" />
                      <span>{t.aiFixRepairing}</span>
                    </>
                  ) : (
                    <>
                      <Wrench size={12} />
                      <span>{t.aiFixSite50TokensBtn}</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {activeTab === "preview" ? (
                <motion.div 
                  key={`preview-${previewDevice}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`h-full transition-all duration-300 overflow-hidden bg-white shadow-2xl shadow-black/70 ${
                    previewDevice === "mobile"
                      ? "w-full max-w-[390px] rounded-3xl border-4 border-white/10 ring-1 ring-white/10"
                      : previewDevice === "tablet"
                      ? "w-full max-w-[768px] rounded-2xl border-2 border-white/10 ring-1 ring-white/10"
                      : previewDevice === "desktop"
                      ? "w-full max-w-[1200px] rounded-xl border border-white/10 ring-1 ring-white/10"
                      : "w-full rounded-lg sm:rounded-xl lg:rounded-2xl ring-1 ring-white/10"
                  }`}
                >
                  {generatedCode ? (
                    <iframe
                      ref={iframeRef}
                      title="Preview"
                      srcDoc={srcDocContent}
                      className="w-full h-full border-none"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#07070b]/90 backdrop-blur-md text-zinc-500 space-y-4 p-4 text-center">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 border-2 border-white/10 border-dashed rounded-full flex items-center justify-center animate-spin-slow">
                        <Globe size={20} className="text-indigo-400/80" />
                      </div>
                      <p className="text-[10px] lg:text-sm font-mono tracking-widest text-zinc-500 uppercase">{t.awaitingInstruction}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="code"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-full h-full rounded-lg sm:rounded-xl lg:rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/[0.08] p-3 sm:p-4 lg:p-6 font-mono text-[10px] sm:text-xs lg:text-sm overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800"
                >
                  <pre className="text-indigo-300 selection:bg-indigo-500/30 break-all whitespace-pre-wrap">
                    {generatedCode || t.codePlaceholder}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Floating Mobile Bottom Navigation Switcher */}
      <div className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 bg-[#0c0c14]/85 backdrop-blur-2xl border border-white/[0.12] rounded-full p-1.5 shadow-2xl shadow-black/90 flex items-center gap-1.5">
        <button
          onClick={() => setMobileView("chat")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
            mobileView === "chat"
              ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <MessageSquare size={14} />
          <span>{t.chatTitle}</span>
        </button>

        <button
          onClick={() => setMobileView("stage")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all relative ${
            mobileView === "stage"
              ? "bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layout size={14} />
          <span>{t.previewTab}</span>
          {generatedCode && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Quick Token Quota Modal */}
      <AnimatePresence>
        {showQuotaModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuotaModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg max-h-[90dvh] bg-[#0c0c16]/85 backdrop-blur-3xl border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 overflow-hidden z-10 flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                    <TokenChipIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                      {t.tokenQuotaSectionTitle}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-zinc-400 truncate">
                      25k / {t.tokenQuotaDaily.toLowerCase()} • 125k / {t.tokenQuotaWeekly.toLowerCase()} • 510k / {t.tokenQuotaMonthly.toLowerCase()}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowQuotaModal(false)}
                  className="p-1.5 sm:p-2 hover:bg-white/[0.08] rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(90dvh-80px)] scrollbar-thin scrollbar-thumb-zinc-800">
                {customApiKey ? (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center gap-3 backdrop-blur-md">
                    <ShieldCheck className="text-emerald-400 shrink-0" size={24} />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{t.tokenQuotaUnlimited}</h4>
                      <p className="text-xs text-zinc-300 mt-0.5">
                        {t.apiKeySavedBadge}: {t.unlimitedActiveDesc}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {t.tokenQuotaSectionDesc}
                  </p>
                )}

                {/* 3 Quota Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Daily Quota */}
                  <div className="p-3.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200 flex items-center gap-1">
                        <Clock size={12} className="text-amber-400" />
                        {t.tokenQuotaDaily}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">{formatTokenNumber(DAILY_TOKEN_LIMIT)}</span>
                    </div>

                    <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          quotaStats.percentDay > 85 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : quotaStats.percentDay > 60 ? "bg-amber-500" : "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                        }`}
                        style={{ width: `${Math.max(4, quotaStats.percentDay)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>{t.tokenQuotaRemaining}: <strong className="text-zinc-200">{formatTokenNumber(quotaStats.remainingDay)}</strong></span>
                      <span>{quotaStats.percentDay}%</span>
                    </div>
                  </div>

                  {/* Weekly Quota */}
                  <div className="p-3.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200 flex items-center gap-1">
                        <Calendar size={12} className="text-indigo-400" />
                        {t.tokenQuotaWeekly}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">{formatTokenNumber(WEEKLY_TOKEN_LIMIT)}</span>
                    </div>

                    <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          quotaStats.percentWeek > 85 ? "bg-rose-500" : quotaStats.percentWeek > 60 ? "bg-amber-500" : "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                        }`}
                        style={{ width: `${Math.max(4, quotaStats.percentWeek)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>{t.tokenQuotaRemaining}: <strong className="text-zinc-200">{formatTokenNumber(quotaStats.remainingWeek)}</strong></span>
                      <span>{quotaStats.percentWeek}%</span>
                    </div>
                  </div>

                  {/* Monthly Quota */}
                  <div className="p-3.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200 flex items-center gap-1">
                        <BarChart2 size={12} className="text-cyan-400" />
                        {t.tokenQuotaMonthly}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">{formatTokenNumber(MONTHLY_TOKEN_LIMIT)}</span>
                    </div>

                    <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          quotaStats.percentMonth > 85 ? "bg-rose-500" : quotaStats.percentMonth > 60 ? "bg-amber-500" : "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                        }`}
                        style={{ width: `${Math.max(4, quotaStats.percentMonth)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>{t.tokenQuotaRemaining}: <strong className="text-zinc-200">{formatTokenNumber(quotaStats.remainingMonth)}</strong></span>
                      <span>{quotaStats.percentMonth}%</span>
                    </div>
                  </div>
                </div>

                {/* Token Consumption Cheat Sheet / Reference */}
                <div className="border-t border-white/[0.08] pt-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <TokenChipIcon className="w-3.5 h-3.5" />
                      <span>{primaryLang === "RU" ? "Примерный расход токенов на задачи" : "Estimated Token Usage per Action"}</span>
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {primaryLang === "RU" ? "Промпт + Ответ" : "Prompt + Response"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {(TOKEN_CONSUMPTION_DATA[primaryLang] || TOKEN_CONSUMPTION_DATA.EN || TOKEN_CONSUMPTION_DATA.RU).map((item) => (
                      <div 
                        key={item.id}
                        className="p-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-xl flex items-center justify-between gap-3 transition-all backdrop-blur-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-zinc-200 truncate">{item.title}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{item.desc}</div>
                        </div>
                        <div className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold shrink-0 ${item.badgeColor}`}>
                          {item.tokens} {item.tokens !== "Отдельно" && item.tokens !== "Separate" && (primaryLang === "RU" ? "ток." : "tokens")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={() => {
                      setShowQuotaModal(false);
                      setShowSettings(true);
                    }}
                    className="w-full py-2.5 px-4 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all backdrop-blur-sm"
                  >
                    <TokenChipIcon className="w-3.5 h-3.5" />
                    <span>{customApiKey ? t.manageApiKey : t.enterCustomKeyUnlimited}</span>
                  </button>

                  {customApiKey && (
                    <button
                      onClick={handleResetTokenHistory}
                      className="w-full sm:w-auto py-2.5 px-3 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 border border-white/[0.08]"
                      title={t.resetHistoryTitle}
                    >
                      <RotateCcw size={12} />
                      <span>{t.resetBtn}</span>
                    </button>
                  )}
                </div>

                {!customApiKey && (
                  <p className="text-[10px] text-zinc-400 text-center font-mono pt-1">
                    {primaryLang === "RU" 
                      ? "⏳ Бесплатные токены восстанавливаются автоматически со временем (24ч / 7дн / 30дн)" 
                      : "⏳ Free quota replenishes automatically over time (24h / 7d / 30d)"}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg max-h-[90dvh] bg-[#0c0c16]/85 backdrop-blur-3xl border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col z-10"
            >
              <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02] backdrop-blur-md">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-white tracking-tight flex items-center gap-2 truncate">
                    <Settings className="text-indigo-400 shrink-0" size={18} />
                    <span>{t.settingsTitle}</span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate">{t.settingsDesc}</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 sm:p-2 hover:bg-white/[0.08] rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto max-h-[calc(90dvh-80px)] scrollbar-thin scrollbar-thumb-zinc-800">
                
                {/* Primary Language Selection Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-indigo-400" />
                      {t.primaryLangTitle}
                    </h3>
                  </div>
                  <div className="p-4 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-3">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t.primaryLangDesc}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      {SUPPORTED_LANGUAGES.map((lang) => {
                        const isPrimary = primaryLang === lang.code;
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => changePrimaryLanguage(lang.code)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                              isPrimary
                                ? "bg-indigo-600/90 text-white border-indigo-400/80 shadow-[0_0_15px_rgba(99,102,241,0.3)] font-bold scale-[1.02]"
                                : "bg-black/30 border-white/[0.08] text-zinc-400 hover:border-white/[0.18] hover:text-zinc-200"
                            }`}
                          >
                            <span className="text-base mb-0.5">{lang.flag}</span>
                            <span className="text-xs font-bold leading-none">{lang.code}</span>
                            <span className={`text-[9px] mt-1 truncate w-full ${isPrimary ? "text-indigo-100" : "text-zinc-400"}`}>{lang.nativeName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* API Key Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                      {t.apiSectionTitle}
                    </h3>
                    {customApiKey && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {t.apiKeySavedBadge}
                      </span>
                    )}
                  </div>
                  <div className="p-4 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-3">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t.apiSectionDesc}
                    </p>
                    <div className="space-y-2">
                      <input 
                        type="password"
                        value={customApiKey}
                        onChange={(e) => {
                          setCustomApiKey(e.target.value);
                          localStorage.setItem("arci_api_key", e.target.value);
                          setApiTestStatus("idle");
                          setApiTestMessage("");
                        }}
                        placeholder="sk-or-v1-..."
                        className="w-full bg-black/40 backdrop-blur-md border border-white/[0.1] rounded-lg px-3 py-2.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 outline-none font-mono placeholder:text-zinc-600"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleTestApiKey}
                          disabled={apiTestStatus === "testing" || !customApiKey.trim()}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 ${
                            apiTestStatus === "success" 
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                              : apiTestStatus === "error"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-indigo-600/90 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-white/[0.05] disabled:bg-white/[0.05] disabled:text-zinc-500"
                          }`}
                        >
                          {apiTestStatus === "testing" ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              <span>{t.testKeyChecking}</span>
                            </>
                          ) : apiTestStatus === "success" ? (
                            <>
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              <span>{t.testKeySuccess}</span>
                            </>
                          ) : apiTestStatus === "error" ? (
                            <>
                              <X size={14} className="text-rose-400" />
                              <span>{t.testKeyError}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              <span>{t.testKeyBtn}</span>
                            </>
                          )}
                        </button>
                        {customApiKey && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomApiKey("");
                              localStorage.removeItem("arci_api_key");
                              setApiTestStatus("idle");
                              setApiTestMessage("");
                            }}
                            className="px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200 text-xs rounded-lg transition-colors border border-white/[0.08]"
                            title={t.resetBtn}
                          >
                            {t.resetBtn}
                          </button>
                        )}
                      </div>
                      {apiTestMessage && (
                        <p className={`text-[11px] px-3 py-2 rounded-lg border ${
                          apiTestStatus === "success"
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
                            : "bg-rose-950/40 text-rose-300 border-rose-800/40"
                        }`}>
                          {apiTestMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Free Token Quota & Limits Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                      <TokenChipIcon className="w-3.5 h-3.5" />
                      {t.tokenQuotaSectionTitle}
                    </h3>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                      25k / 125k / 510k
                    </span>
                  </div>
                  <div className="p-4 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-4">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t.tokenQuotaSectionDesc}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Day */}
                      <div className="p-3 bg-black/30 border border-white/[0.08] rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-200 font-medium">{t.tokenQuotaDaily}</span>
                          <span className="font-mono text-zinc-300 font-bold">25k</span>
                        </div>
                        <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${quotaStats.percentDay > 85 ? "bg-rose-500" : quotaStats.percentDay > 60 ? "bg-amber-500" : "bg-indigo-500"}`}
                            style={{ width: `${Math.max(4, quotaStats.percentDay)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                          <span>{t.tokenQuotaRemaining}: {formatTokenNumber(quotaStats.remainingDay)}</span>
                          <span>{quotaStats.percentDay}%</span>
                        </div>
                      </div>

                      {/* Week */}
                      <div className="p-3 bg-black/30 border border-white/[0.08] rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-200 font-medium">{t.tokenQuotaWeekly}</span>
                          <span className="font-mono text-zinc-300 font-bold">125k</span>
                        </div>
                        <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${quotaStats.percentWeek > 85 ? "bg-rose-500" : quotaStats.percentWeek > 60 ? "bg-amber-500" : "bg-indigo-500"}`}
                            style={{ width: `${Math.max(4, quotaStats.percentWeek)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                          <span>{t.tokenQuotaRemaining}: {formatTokenNumber(quotaStats.remainingWeek)}</span>
                          <span>{quotaStats.percentWeek}%</span>
                        </div>
                      </div>

                      {/* Month */}
                      <div className="p-3 bg-black/30 border border-white/[0.08] rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-200 font-medium">{t.tokenQuotaMonthly}</span>
                          <span className="font-mono text-zinc-300 font-bold">510k</span>
                        </div>
                        <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${quotaStats.percentMonth > 85 ? "bg-rose-500" : quotaStats.percentMonth > 60 ? "bg-amber-500" : "bg-cyan-500"}`}
                            style={{ width: `${Math.max(4, quotaStats.percentMonth)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                          <span>{t.tokenQuotaRemaining}: {formatTokenNumber(quotaStats.remainingMonth)}</span>
                          <span>{quotaStats.percentMonth}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-400">
                        {customApiKey 
                          ? t.unlimitedBadgeText 
                          : (primaryLang === "RU" ? "⏳ Лимит восстанавливается по времени (24ч / 7дн / 30дн)" : "⏳ Limits recover automatically over time (24h/7d/30d)")}
                      </span>
                      {customApiKey && (
                        <button
                          type="button"
                          onClick={handleResetTokenHistory}
                          className="text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw size={10} />
                          {t.resetBtn}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Target Languages Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      {t.targetLangsTitle} ({selectedLangs.length}/10)
                    </h3>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => {
                          const all = SUPPORTED_LANGUAGES.map(l => l.code);
                          setSelectedLangs(all);
                          localStorage.setItem("arci_selected_langs", JSON.stringify(all));
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded hover:bg-indigo-950/30 transition-colors"
                      >
                        {t.quickAll}
                      </button>
                      <span className="text-zinc-600 text-xs">•</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const min = [primaryLang, "EN"];
                          const unique = Array.from(new Set(min));
                          setSelectedLangs(unique);
                          localStorage.setItem("arci_selected_langs", JSON.stringify(unique));
                        }}
                        className="text-[10px] text-zinc-400 hover:text-zinc-300 px-2 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
                      >
                        {t.quickRuEn}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl space-y-3">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t.targetLangsDesc}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      {SUPPORTED_LANGUAGES.map((lang) => {
                        const isSelected = selectedLangs.includes(lang.code);
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => {
                              let next: string[];
                              if (isSelected) {
                                if (selectedLangs.length <= 1) return; // keep at least 1
                                next = selectedLangs.filter(c => c !== lang.code);
                              } else {
                                next = [...selectedLangs, lang.code];
                              }
                              setSelectedLangs(next);
                              localStorage.setItem("arci_selected_langs", JSON.stringify(next));
                            }}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                              isSelected
                                ? "bg-indigo-500/20 border-indigo-500/60 text-white shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                                : "bg-black/30 border-white/[0.08] text-zinc-400 hover:border-white/[0.18] hover:text-zinc-200"
                            }`}
                          >
                            <span className="text-base mb-0.5">{lang.flag}</span>
                            <span className="text-xs font-bold leading-none">{lang.code}</span>
                            <span className="text-[9px] text-zinc-400 mt-1 truncate w-full">{lang.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Integrations Section */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-3">{t.integrationsTitle}</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl flex items-center justify-between group hover:border-white/[0.16] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black/40 border border-white/[0.1] rounded-xl flex items-center justify-center text-white backdrop-blur-sm">
                          <Github size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-zinc-200">GitHub</h4>
                            {githubUser ? (
                              <span className="px-2 py-0.5 bg-green-500/15 text-green-400 border border-green-500/30 text-[10px] font-mono rounded-full">
                                {t.githubConnected}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-white/[0.06] text-zinc-400 text-[10px] font-mono rounded-full border border-white/[0.08]">
                                {t.githubStatusReady}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {githubUser ? `@${githubUser.login}` : t.githubAccount}
                          </p>
                        </div>
                      </div>
                      
                      {githubUser ? (
                        <div className="flex items-center gap-2">
                          <img 
                            src={githubUser.avatar_url} 
                            alt={githubUser.login} 
                            className="w-8 h-8 rounded-full border border-zinc-700" 
                          />
                        </div>
                      ) : (
                        <button 
                          onClick={handleConnectGithub}
                          className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition-all backdrop-blur-sm"
                        >
                          {t.githubConnect}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{t.systemVersion}</span>
                  <span>{t.languagesCount}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Site Health Check & Auto-Repair Modal */}
      <AnimatePresence>
        {showHealthModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isRepairingSite && setShowHealthModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg max-h-[90dvh] bg-[#0c0c16]/85 backdrop-blur-3xl border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col z-10"
            >
              <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02] backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${
                    healthReport && healthReport.isHealthy
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  }`}>
                    <Stethoscope size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                      {t.aiFixModalTitle}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                      {t.aiFixCostNotice}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => !isRepairingSite && setShowHealthModal(false)}
                  disabled={isRepairingSite}
                  className="p-1.5 sm:p-2 hover:bg-white/[0.08] rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0 disabled:opacity-30"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(90dvh-80px)] scrollbar-thin scrollbar-thumb-zinc-800">
                
                {/* Health Score Card */}
                {healthReport && (
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 backdrop-blur-md ${
                    healthReport.isHealthy
                      ? "bg-emerald-950/25 border-emerald-500/40"
                      : "bg-rose-950/25 border-rose-500/40"
                  }`}>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {healthReport.isHealthy ? (
                          <CheckCircle className="text-emerald-400 shrink-0" size={18} />
                        ) : (
                          <AlertTriangle className="text-rose-400 shrink-0" size={18} />
                        )}
                        <h3 className={`text-sm font-bold truncate ${
                          healthReport.isHealthy ? "text-emerald-300" : "text-rose-300"
                        }`}>
                          {healthReport.isHealthy ? t.aiHealthyStatus : t.aiIssuesFoundStatus}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {healthReport.isHealthy 
                          ? t.aiHealthySubtitle 
                          : `${healthReport.issues.length} ${primaryLang === "RU" ? "проблем обнаружено в коде или выполнении." : "issues found in code or execution."}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-mono font-black ${
                        healthReport.score >= 80 ? "text-emerald-400" : healthReport.score >= 50 ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {healthReport.score}%
                      </div>
                      <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Health</span>
                    </div>
                  </div>
                )}

                {/* Diagnostic Checks Breakdown */}
                {healthReport && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={12} className="text-indigo-400" />
                      <span>{primaryLang === "RU" ? "Диагностические параметры" : "Diagnostic Parameters"}</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-lg flex items-center justify-between">
                        <span className="text-zinc-300">HTML & DOCTYPE</span>
                        {healthReport.checks.hasHtmlStructure ? (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">✓ OK</span>
                        ) : (
                          <span className="text-rose-400 font-mono text-[11px] font-bold">✗ Issue</span>
                        )}
                      </div>

                      <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-lg flex items-center justify-between">
                        <span className="text-zinc-300">Viewport Meta</span>
                        {healthReport.checks.hasViewportMeta ? (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">✓ OK</span>
                        ) : (
                          <span className="text-amber-400 font-mono text-[11px] font-bold">⚠️ Missing</span>
                        )}
                      </div>

                      <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-lg flex items-center justify-between">
                        <span className="text-zinc-300">CSS Styles</span>
                        {healthReport.checks.hasStyles ? (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">✓ OK</span>
                        ) : (
                          <span className="text-amber-400 font-mono text-[11px] font-bold">⚠️ None</span>
                        )}
                      </div>

                      <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-lg flex items-center justify-between">
                        <span className="text-zinc-300">JS Runtime</span>
                        {healthReport.checks.runtimeErrorsCount === 0 ? (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">✓ Clean</span>
                        ) : (
                          <span className="text-rose-400 font-mono text-[11px] font-bold">✗ {healthReport.checks.runtimeErrorsCount} Err</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* List of Detected Issues */}
                {healthReport && healthReport.issues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-rose-400" />
                      <span>{primaryLang === "RU" ? "Список найденных неполадок" : "Detected Issues"} ({healthReport.issues.length})</span>
                    </h4>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {healthReport.issues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 backdrop-blur-sm ${
                            issue.severity === "critical"
                              ? "bg-rose-950/30 border-rose-800/50 text-rose-300"
                              : issue.severity === "warning"
                              ? "bg-amber-950/30 border-amber-800/50 text-amber-300"
                              : "bg-white/[0.03] border-white/[0.08] text-zinc-300"
                          }`}
                        >
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 shrink-0 ${
                            issue.severity === "critical"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : issue.severity === "warning"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-white/[0.06] text-zinc-300"
                          }`}>
                            {issue.severity}
                          </span>
                          <span className="flex-1 leading-relaxed">{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
                  <button
                    onClick={handleAutoRepairSite}
                    disabled={isRepairingSite}
                    className="w-full py-3 px-4 bg-indigo-600/90 hover:bg-indigo-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 backdrop-blur-sm"
                  >
                    {isRepairingSite ? (
                      <>
                        <RotateCw size={14} className="animate-spin" />
                        <span>{t.aiFixRepairing}</span>
                      </>
                    ) : (
                      <>
                        <Wrench size={14} />
                        <span>{t.aiFixSite50TokensBtn}</span>
                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono">50⚡</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono px-1">
                    <span>{customApiKey ? t.unlimitedBadgeText : `⚡ ${t.tokenQuotaRemaining}: ${formatTokenNumber(quotaStats.remainingDay)} / 25k`}</span>
                    <span>
                      {healthReport?.isHealthy 
                        ? (primaryLang === "RU" ? "Диагностика: 0 токенов" : "Diagnosis: 0 tokens")
                        : t.aiFixCostNotice}
                    </span>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Repair Toast Notification */}
      <AnimatePresence>
        {repairToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[130] bg-[#0c0c16]/90 border border-emerald-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-2xl"
          >
            <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
            <span className="text-xs font-medium text-zinc-200">{repairToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
