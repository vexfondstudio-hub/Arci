export interface TokenConsumptionGuideItem {
  id: string;
  title: string;
  desc: string;
  tokens: string;
  badgeColor: string;
}

export const TOKEN_CONSUMPTION_DATA: Record<string, TokenConsumptionGuideItem[]> = {
  RU: [
    {
      id: "ai-auto-repair",
      title: "ИИ Диагностика и автопочинка сайта",
      desc: "Проверка работы, отладка ошибок JS/HTML/CSS и починка сайта",
      tokens: "50",
      badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    },
    {
      id: "simple-chat",
      title: "Простой чат-вопрос",
      desc: "Короткий ответ без кода",
      tokens: "200–500",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "small-fix",
      title: "Мелкая правка",
      desc: "Точечное изменение (цвет, текст, один блок)",
      tokens: "500–1 500",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "code-patch",
      title: "Правка/доработка существующего кода",
      desc: "Модель видит старый код + пишет патч",
      tokens: "1 500–4 000",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    },
    {
      id: "site-scratch",
      title: "Генерация сайта с нуля",
      desc: "Полный HTML+CSS+JS одностраничник",
      tokens: "3 000–8 000",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "complex-site",
      title: "Генерация сложного сайта",
      desc: "Много секций, анимации, большой файл",
      tokens: "8 000–15 000",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
    {
      id: "web-search",
      title: "Поиск в интернете (Web Search)",
      desc: "Запрос к поисковому API + обработка выдачи",
      tokens: "+300–800",
      badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    },
    {
      id: "image-gen",
      title: "Генерация изображений / плейсхолдеров",
      desc: "Отдельный вызов модели изображений",
      tokens: "Отдельно",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
  ],
  EN: [
    {
      id: "ai-auto-repair",
      title: "AI Site Diagnostic & Auto-Repair",
      desc: "Check site health, debug JS/HTML/CSS errors & fix for 50 tokens",
      tokens: "50",
      badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    },
    {
      id: "simple-chat",
      title: "Simple Chat Question",
      desc: "Short answer without code",
      tokens: "200–500",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "small-fix",
      title: "Minor Code Edit",
      desc: "Targeted change (color, text, single block)",
      tokens: "500–1,500",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "code-patch",
      title: "Edit / Refine Existing Code",
      desc: "Model inspects existing code and writes patch",
      tokens: "1,500–4,000",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    },
    {
      id: "site-scratch",
      title: "Generate Site from Scratch",
      desc: "Full single-page HTML + CSS + JS site",
      tokens: "3,000–8,000",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "complex-site",
      title: "Generate Complex Site",
      desc: "Many sections, rich animations, large codebase",
      tokens: "8,000–15,000",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
    {
      id: "web-search",
      title: "Web Search & Grounding",
      desc: "Search API query + result parsing",
      tokens: "+300–800",
      badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    },
    {
      id: "image-gen",
      title: "Image / Icon Generation",
      desc: "Dedicated image model invocation",
      tokens: "Separate",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
  ],
};
