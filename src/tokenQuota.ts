export interface TokenUsageRecord {
  timestamp: number;
  tokens: number;
  model: string;
}

export interface TokenQuotaStats {
  usedDay: number;
  usedWeek: number;
  usedMonth: number;
  limitDay: number;
  limitWeek: number;
  limitMonth: number;
  remainingDay: number;
  remainingWeek: number;
  remainingMonth: number;
  percentDay: number;
  percentWeek: number;
  percentMonth: number;
}

export const DAILY_TOKEN_LIMIT = 25_000;    // 25k per day
export const WEEKLY_TOKEN_LIMIT = 125_000;  // 125k per week
export const MONTHLY_TOKEN_LIMIT = 510_000; // 510k per month

const STORAGE_KEY = "arci_token_usage_history";

export function getUsageHistory(): TokenUsageRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out records older than 31 days to keep storage clean
      const cutoff = Date.now() - 31 * 24 * 60 * 60 * 1000;
      return parsed.filter(item => typeof item.timestamp === "number" && item.timestamp > cutoff);
    }
  } catch (e) {
    console.error("Failed to parse token usage history", e);
  }
  return [];
}

export function recordTokenUsage(tokens: number, model: string): TokenQuotaStats {
  const current = getUsageHistory();
  const safeTokens = Math.max(1, Math.round(tokens));
  const newRecord: TokenUsageRecord = {
    timestamp: Date.now(),
    tokens: safeTokens,
    model,
  };
  const updated = [...current, newRecord];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save token usage", e);
  }
  return getTokenQuotaStats();
}

export function getTokenQuotaStats(): TokenQuotaStats {
  const history = getUsageHistory();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  let usedDay = 0;
  let usedWeek = 0;
  let usedMonth = 0;

  for (const record of history) {
    if (record.timestamp >= oneDayAgo) {
      usedDay += record.tokens;
    }
    if (record.timestamp >= oneWeekAgo) {
      usedWeek += record.tokens;
    }
    if (record.timestamp >= oneMonthAgo) {
      usedMonth += record.tokens;
    }
  }

  const remainingDay = Math.max(0, DAILY_TOKEN_LIMIT - usedDay);
  const remainingWeek = Math.max(0, WEEKLY_TOKEN_LIMIT - usedWeek);
  const remainingMonth = Math.max(0, MONTHLY_TOKEN_LIMIT - usedMonth);

  const percentDay = Math.min(100, Math.round((usedDay / DAILY_TOKEN_LIMIT) * 100));
  const percentWeek = Math.min(100, Math.round((usedWeek / WEEKLY_TOKEN_LIMIT) * 100));
  const percentMonth = Math.min(100, Math.round((usedMonth / MONTHLY_TOKEN_LIMIT) * 100));

  return {
    usedDay,
    usedWeek,
    usedMonth,
    limitDay: DAILY_TOKEN_LIMIT,
    limitWeek: WEEKLY_TOKEN_LIMIT,
    limitMonth: MONTHLY_TOKEN_LIMIT,
    remainingDay,
    remainingWeek,
    remainingMonth,
    percentDay,
    percentWeek,
    percentMonth,
  };
}

export function checkTokenQuota(estimatedTokens: number, hasCustomApiKey: boolean): {
  allowed: boolean;
  reason?: "day" | "week" | "month";
  stats: TokenQuotaStats;
} {
  const stats = getTokenQuotaStats();

  if (hasCustomApiKey) {
    return { allowed: true, stats };
  }

  if (stats.usedDay + estimatedTokens > DAILY_TOKEN_LIMIT) {
    return { allowed: false, reason: "day", stats };
  }
  if (stats.usedWeek + estimatedTokens > WEEKLY_TOKEN_LIMIT) {
    return { allowed: false, reason: "week", stats };
  }
  if (stats.usedMonth + estimatedTokens > MONTHLY_TOKEN_LIMIT) {
    return { allowed: false, reason: "month", stats };
  }

  return { allowed: true, stats };
}

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  // Standard approximation: ~3.5-4 characters per token for multi-language code/prompts
  return Math.ceil(text.length / 3.8);
}

export function formatTokenNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toLocaleString();
}
