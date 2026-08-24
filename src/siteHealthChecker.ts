export interface SiteIssue {
  id: string;
  type: "syntax" | "runtime" | "structure" | "responsive" | "style";
  severity: "critical" | "warning" | "info";
  message: string;
  suggestion?: string;
}

export interface SiteHealthChecks {
  hasHtmlStructure: boolean;
  hasViewportMeta: boolean;
  hasStyles: boolean;
  runtimeErrorsCount: number;
}

export interface SiteHealthReport {
  status: "healthy" | "warning" | "error";
  isHealthy: boolean;
  isBroken: boolean;
  score: number;
  issues: SiteIssue[];
  checks: SiteHealthChecks;
  runtimeErrors: string[];
  summary: string;
}

/**
 * Analyzes the generated HTML/CSS/JS code to detect structural, syntax, and execution bugs.
 */
export function analyzeSiteHealth(code: string, capturedRuntimeErrors: string[] = []): SiteHealthReport {
  const issues: SiteIssue[] = [];
  const trimmed = code?.trim() || "";

  if (!trimmed) {
    return {
      status: "error",
      isHealthy: false,
      isBroken: true,
      score: 0,
      issues: [
        {
          id: "empty-code",
          type: "structure",
          severity: "critical",
          message: "Код сайта пуст или не сгенерирован.",
          suggestion: "Сгенерируйте сайт с помощью запроса в чате.",
        },
      ],
      checks: {
        hasHtmlStructure: false,
        hasViewportMeta: false,
        hasStyles: false,
        runtimeErrorsCount: capturedRuntimeErrors.length,
      },
      runtimeErrors: [],
      summary: "Код пуст",
    };
  }

  // 1. Check for runtime errors passed from iframe
  if (capturedRuntimeErrors.length > 0) {
    capturedRuntimeErrors.forEach((err, idx) => {
      issues.push({
        id: `runtime-${idx}`,
        type: "runtime",
        severity: "critical",
        message: `JavaScript Runtime: ${err}`,
        suggestion: "ИИ исправит логику и функции скрипта.",
      });
    });
  }

  // 2. Structure Checks
  const hasDoctypeOrHtml = /<!DOCTYPE\s+html/i.test(trimmed) || /<html/i.test(trimmed);
  if (!hasDoctypeOrHtml) {
    issues.push({
      id: "missing-html-tag",
      type: "structure",
      severity: "warning",
      message: "Отсутствует стандартная декларация <!DOCTYPE html> или тег <html>.",
      suggestion: "Обернуть документ в валидную HTML5 структуру.",
    });
  }

  const hasBody = /<body[\s>]/i.test(trimmed);
  if (!hasBody) {
    issues.push({
      id: "missing-body-tag",
      type: "structure",
      severity: "warning",
      message: "Отсутствует тег <body>.",
      suggestion: "Добавить тег <body> для корректного отображения DOM.",
    });
  }

  // Check unclosed tags
  const openScriptCount = (trimmed.match(/<script\b[^>]*>/gi) || []).length;
  const closeScriptCount = (trimmed.match(/<\/script>/gi) || []).length;
  if (openScriptCount !== closeScriptCount) {
    issues.push({
      id: "unclosed-script",
      type: "syntax",
      severity: "critical",
      message: `Несоответствие тегов <script>: открыто ${openScriptCount}, закрыто ${closeScriptCount}.`,
      suggestion: "Закрыть все незавершённые теги <script>.",
    });
  }

  const openStyleCount = (trimmed.match(/<style\b[^>]*>/gi) || []).length;
  const closeStyleCount = (trimmed.match(/<\/style>/gi) || []).length;
  if (openStyleCount !== closeStyleCount) {
    issues.push({
      id: "unclosed-style",
      type: "syntax",
      severity: "critical",
      message: `Несоответствие тегов <style>: открыто ${openStyleCount}, закрыто ${closeStyleCount}.`,
      suggestion: "Закрыть теги <style>.",
    });
  }

  // 3. Responsive Meta Check
  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(trimmed);
  if (!hasViewportMeta) {
    issues.push({
      id: "missing-viewport",
      type: "responsive",
      severity: "warning",
      message: "Отсутствует мета-тег <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">.",
      suggestion: "Добавить meta viewport для корректной адаптивности на смартфонах.",
    });
  }

  // 4. Extract and check JavaScript syntax inside <script> blocks
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(trimmed)) !== null) {
    const scriptContent = match[1];
    if (!scriptContent.trim()) continue;

    try {
      new Function(scriptContent);
    } catch (syntaxErr: any) {
      issues.push({
        id: `js-syntax-${issues.length}`,
        type: "syntax",
        severity: "critical",
        message: `Синтаксическая ошибка в JavaScript: ${syntaxErr.message}`,
        suggestion: "Исправить синтаксис, скобки и выражения в <script>.",
      });
    }
  }

  // 5. CSS basic brace balancing check
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let hasStyles = false;
  while ((match = styleRegex.exec(trimmed)) !== null) {
    hasStyles = true;
    const styleContent = match[1];
    const openBraces = (styleContent.match(/\{/g) || []).length;
    const closeBraces = (styleContent.match(/\}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 1) {
      issues.push({
        id: `css-braces-${issues.length}`,
        type: "style",
        severity: "warning",
        message: `Дисбаланс фигурных скобок в CSS: { открыто ${openBraces}, } закрыто ${closeBraces}.`,
        suggestion: "Проверить правила и закрытие медиа-запросов в <style>.",
      });
    }
  }

  if (trimmed.includes("class=") || trimmed.includes("style=")) {
    hasStyles = true;
  }

  // Calculate score and status
  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  let score = 100 - (criticalCount * 35) - (warningCount * 10);
  if (score < 0) score = 0;

  const isBroken = criticalCount > 0 || (capturedRuntimeErrors.length > 0);
  const isHealthy = !isBroken && warningCount === 0;
  let status: "healthy" | "warning" | "error" = isHealthy ? "healthy" : isBroken ? "error" : "warning";

  const summary = isBroken
    ? `Обнаружено критических проблем: ${criticalCount}`
    : warningCount > 0
    ? `Сайт работает, есть предупреждений: ${warningCount}`
    : "Сайт работает отлично, ошибок не найдено!";

  return {
    status,
    isHealthy,
    isBroken,
    score,
    issues,
    checks: {
      hasHtmlStructure: Boolean(hasDoctypeOrHtml && hasBody),
      hasViewportMeta: Boolean(hasViewportMeta),
      hasStyles: Boolean(hasStyles),
      runtimeErrorsCount: capturedRuntimeErrors.length,
    },
    runtimeErrors: capturedRuntimeErrors,
    summary,
  };
}

/**
 * Injects error interception script into generated code for live iframe diagnostics.
 */
export function injectDiagnosticHook(code: string): string {
  if (!code || typeof code !== "string") return code;

  const hookScript = `
<script>
(function() {
  if (window.__arci_hook_installed__) return;
  window.__arci_hook_installed__ = true;
  var reported = {};
  var errorCount = 0;

  function reportError(msg, file, line) {
    if (window.parent === window) return;
    if (errorCount >= 5) return;
    var key = String(msg || '');
    if (reported[key]) return;
    reported[key] = true;
    errorCount++;
    try {
      window.parent.postMessage({
        type: 'ARCI_SITE_RUNTIME_ERROR',
        error: key,
        filename: file || '',
        lineno: line || 0
      }, '*');
    } catch (_) {}
  }

  window.addEventListener('error', function(e) {
    reportError(e.message || 'Script execution error', e.filename, e.lineno);
  });

  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason ? (e.reason.message || String(e.reason)) : 'Unknown rejection';
    reportError('Unhandled Promise: ' + reason, '', 0);
  });
})();
</script>
`;

  if (/<head[\s>]/i.test(code)) {
    return code.replace(/<head[\s>]/i, match => `${match}\n${hookScript}`);
  }
  return `${hookScript}\n${code}`;
}
