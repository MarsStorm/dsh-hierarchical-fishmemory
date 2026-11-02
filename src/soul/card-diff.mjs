/**
 * 人设卡版本 diff（2026-11-02 抽出来，为了能单独测）。
 *
 * 只做「按行的最长公共子序列」。参数顺序是 `(当前文本, 快照文本)`：
 * `+` 是快照里有、当前没有的（恢复会加回来），`-` 是当前有、快照里没有的
 * （恢复会删掉）。
 * 不做词级细粒度 —— 人设卡通常只有几行，行级已经够读。
 */
export function diffLines(current, saved, limit = 40) {
  const split = (value) => {
    const text = String(value ?? '');
    return text === '' ? [] : text.split('\n');
  };
  const a = split(current);
  const b = split(saved);
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push(`- ${a[i]}`);
      i += 1;
    } else {
      out.push(`+ ${b[j]}`);
      j += 1;
    }
  }
  while (i < n) {
    out.push(`- ${a[i]}`);
    i += 1;
  }
  while (j < m) {
    out.push(`+ ${b[j]}`);
    j += 1;
  }
  return { lines: out.slice(0, limit), total: out.length };
}

export default diffLines;
