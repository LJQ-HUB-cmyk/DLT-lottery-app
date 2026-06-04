/**
 * 通用工具函数
 */

/**
 * 安全的加权随机选择
 * @param {Object} weights - 权重对象 {号码: 权重}
 * @param {number} count - 选择数量
 * @returns {number[]} 选中的号码数组
 */
export function weightedRandomSelect(weights, count) {
  const entries = Object.entries(weights);
  if (entries.length === 0) return [];
  
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight === 0) {
    // 如果权重都是0，随机选择
    const keys = entries.map(([k]) => Number(k));
    return shuffle(keys).slice(0, count);
  }
  
  const selected = [];
  const remaining = [...entries];
  
  while (selected.length < count && remaining.length > 0) {
    let random = Math.random() * totalWeight;
    let cumulative = 0;
    
    for (let i = 0; i < remaining.length; i++) {
      cumulative += remaining[i][1];
      if (random <= cumulative) {
        selected.push(Number(remaining[i][0]));
        remaining.splice(i, 1);
        break;
      }
    }
  }
  
  return selected;
}

/**
 * Fisher-Yates 洗牌算法
 */
export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 组合数计算 C(n, k)
 */
export function combinations(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n / 2) k = n - k;
  
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = result * (n - i + 1) / i;
  }
  return Math.round(result);
}

/**
 * 生成所有组合
 */
export function generateCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const withFirst = generateCombinations(rest, k - 1).map(comb => [first, ...comb]);
  const withoutFirst = generateCombinations(rest, k);
  
  return [...withFirst, ...withoutFirst];
}

/**
 * 安全的除法（避免除以0）
 */
export function safeDivide(numerator, denominator, defaultValue = 0) {
  if (denominator === 0 || !isFinite(denominator)) return defaultValue;
  return numerator / denominator;
}

/**
 * 过滤并验证数字数组
 */
export function filterValidNumbers(arr) {
  return arr.filter(n => typeof n === 'number' && isFinite(n) && !isNaN(n));
}

/**
 * 计算数组的平均值
 */
export function average(arr) {
  const valid = filterValidNumbers(arr);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * 计算数组的标准差
 */
export function standardDeviation(arr) {
  const valid = filterValidNumbers(arr);
  if (valid.length === 0) return 0;
  const avg = average(valid);
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / valid.length;
  return Math.sqrt(variance);
}

/**
 * 生成指定范围的数字数组
 */
export function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * 检查是否为连号
 */
export function hasConsecutiveNumbers(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= 1) return true;
  }
  return false;
}

/**
 * 计算号码之间的最小间距
 */
export function minGap(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < minGap) minGap = gap;
  }
  return minGap === Infinity ? 0 : minGap;
}
