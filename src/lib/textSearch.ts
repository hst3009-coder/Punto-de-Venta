export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const normalizeString = normalizeSearchText;

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

export function isFuzzyMatch(query: string, target: string, maxDistance?: number): boolean {
  const normQuery = normalizeSearchText(query.trim());
  if (!normQuery) return true;

  const normTarget = normalizeSearchText(target || '');
  if (!normTarget) return false;

  if (normTarget.includes(normQuery)) return true;

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const targetWords = normTarget.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return true;
  if (targetWords.length === 0) return false;

  return queryTokens.every((qToken) => {
    if (normTarget.includes(qToken)) return true;

    const allowedDist = maxDistance ?? (qToken.length <= 4 ? 1 : 2);
    return targetWords.some((pWord) => {
      if (Math.abs(qToken.length - pWord.length) > allowedDist) return false;
      const dist = levenshteinDistance(qToken, pWord);
      return dist <= allowedDist;
    });
  });
}
