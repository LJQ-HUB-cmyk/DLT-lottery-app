/**
 * 后区胆码预测分析脚本
 * 分析最近数据，计算各号码的8维评分
 */
const fs = require('fs');

// 读取历史数据
const data = fs.readFileSync(__dirname + '/../src/data/lottery-history.txt', 'utf-8');
const lines = data.trim().split('\n').filter(l => l.trim());

// 反转为chronological order (oldest first, most recent last)
const draws = [];
for (const line of lines) {
  const nums = line.trim().split(/\s+/).map(Number);
  if (nums.length === 7) {
    draws.push({ front: nums.slice(0, 5), back: nums.slice(5, 7) });
  }
}
draws.reverse(); // 现在draws[0]=最旧, draws[n-1]=最新

const totalDraws = draws.length;
console.log(`\n=== 后区胆码预测分析 ===`);
console.log(`总期数: ${totalDraws}`);
console.log(`最新一期: ${draws[totalDraws-1].front.join(' ')} | ${draws[totalDraws-1].back.join(' ')}`);

const lastDraw = draws[totalDraws - 1];
const secondLastDraw = draws[totalDraws - 2];
console.log(`上期后区: ${lastDraw.back.join(' ')}`);
console.log(`上上期后区: ${secondLastDraw.back.join(' ')}`);

// 1. 先验频率
const backFreq = {};
for (let i = 1; i <= 12; i++) backFreq[i] = 0;
for (const d of draws) {
  for (const n of d.back) backFreq[n]++;
}
const totalBackFreq = Object.values(backFreq).reduce((s, f) => s + f, 0);
console.log('\n--- 1. 先验频率 ---');
for (let i = 1; i <= 12; i++) {
  const ratio = backFreq[i] / totalDraws;
  console.log(`#${i}: 频率${backFreq[i]}, 比率${ratio.toFixed(4)}, 期望${2/12}(${(ratio/(2/12)).toFixed(2)}倍)`);
}

// 2. 遗漏值（从最新期往前搜索）
const backOmission = {};
for (let num = 1; num <= 12; num++) {
  let omission = 0;
  for (let i = totalDraws - 1; i >= 0; i--) {
    if (draws[i].back.includes(num)) break;
    omission++;
  }
  backOmission[num] = omission;
}
const avgOmission = Object.values(backOmission).reduce((s, v) => s + v, 0) / 12;
console.log('\n--- 2. 遗漏值 ---');
for (let i = 1; i <= 12; i++) {
  const diff = Math.abs(backOmission[i] - avgOmission);
  const factor = Math.max(0, 1 - diff / (avgOmission * 2)) * 0.15;
  console.log(`#${i}: 遗漏${backOmission[i]}, 偏差${diff.toFixed(1)}, 遗漏因子${factor.toFixed(4)}`);
}
console.log(`平均遗漏: ${avgOmission.toFixed(2)}`);

// 3. 近期频率趋势（最近15期）
const recentCount = 15;
const recentDraws = draws.slice(-recentCount);
const recentBackFreq = {};
for (let i = 1; i <= 12; i++) recentBackFreq[i] = 0;
for (const d of recentDraws) {
  for (const n of d.back) recentBackFreq[n]++;
}
console.log('\n--- 3. 近期频率（最近15期） ---');
for (let i = 1; i <= 12; i++) {
  const recentRate = recentBackFreq[i] / recentCount;
  const overallRate = backFreq[i] / totalDraws;
  const momentum = recentRate - overallRate;
  const expectedRate = 2 / 12;
  const tempRatio = recentRate / expectedRate;
  let tempScore = 0;
  if (tempRatio >= 1.5) tempScore = Math.min(0.08, (tempRatio - 1.5) * 0.04);
  else if (tempRatio < 0.5) {
    const historicalHeat = overallRate / expectedRate;
    tempScore = -Math.min(0.08, (0.5 - tempRatio) * 0.04 * Math.min(2, historicalHeat));
  }
  console.log(`#${i}: 近期${recentBackFreq[i]}次(${recentRate.toFixed(3)}), 全期${overallRate.toFixed(3)}, 动量${momentum.toFixed(3)}, 温度${tempRatio.toFixed(2)}${tempScore>0?'↑':tempScore<0?'↓':'→'}(${tempScore.toFixed(4)})`);
}

// 4. 条件概率（马尔可夫转移）
// 构建转移矩阵
const backTransition = {};
for (let i = 1; i < totalDraws; i++) {
  const prev = draws[i-1].back;
  const curr = draws[i].back;
  const timeWeight = Math.pow(0.98, totalDraws - i);
  for (const x of prev) {
    if (!backTransition[x]) backTransition[x] = {};
    for (const y of curr) {
      backTransition[x][y] = (backTransition[x][y] || 0) + timeWeight;
    }
  }
}
// 计算条件概率
const LAPLACE = 0.01;
const laplaceProb = (count, total, outcomes) => (count + LAPLACE) / (total + LAPLACE * outcomes);
const backCondProb = {};
for (let y = 1; y <= 12; y++) {
  let score = 0, wSum = 0;
  for (const x of lastDraw.back) {
    const tr = backTransition[x] || {};
    const rawTotal = Object.values(tr).reduce((a, b) => a + b, 0);
    const rawCount = tr[y] || 0;
    score += laplaceProb(rawCount, rawTotal, 12);
    wSum++;
  }
  backCondProb[y] = wSum > 0 ? score / wSum : 1/12;
}
// 二阶马尔可夫
for (let y = 1; y <= 12; y++) {
  let score2 = 0, w2 = 0;
  for (const x of secondLastDraw.back) {
    const tr = backTransition[x] || {};
    const rawTotal = Object.values(tr).reduce((a, b) => a + b, 0);
    const rawCount = tr[y] || 0;
    score2 += laplaceProb(rawCount, rawTotal, 12);
    w2++;
  }
  const s2 = w2 > 0 ? score2 / w2 : 0;
  backCondProb[y] = backCondProb[y] * 0.7 + s2 * 0.3;
}

console.log('\n--- 4. 条件概率（基于上期后区' + lastDraw.back.join(',') + '） ---');
for (let i = 1; i <= 12; i++) {
  console.log(`#${i}: 条件概率${backCondProb[i].toFixed(4)}`);
}

// 5. 时间加权得分（归一化）
const backTimeScores = {}; 
for (let i = 1; i <= 12; i++) backTimeScores[i] = 0;
for (let idx = 0; idx < totalDraws; idx++) {
  const timeWeight = Math.exp((idx - totalDraws + 1) / totalDraws) * 0.2;
  for (const n of draws[idx].back) backTimeScores[n] += timeWeight;
}
const backMaxTime = Math.max(...Object.values(backTimeScores)) || 1;
for (let i = 1; i <= 12; i++) backTimeScores[i] /= backMaxTime;
console.log('\n--- 5. 时间加权得分（归一化后） ---');
for (let i = 1; i <= 12; i++) {
  console.log(`#${i}: ${backTimeScores[i].toFixed(4)} (原始${(backTimeScores[i]*backMaxTime).toFixed(2)}, max=${backMaxTime.toFixed(2)})`);
}

// 6. 重号因子
let backRepeatCount = 0;
for (let i = 1; i < totalDraws; i++) {
  const repeats = draws[i].back.filter(n => draws[i-1].back.includes(n));
  backRepeatCount += repeats.length;
}
const backRepeatRate = backRepeatCount / (totalDraws - 1);
console.log('\n--- 6. 重号因子 ---');
console.log(`后区重号率: ${backRepeatRate.toFixed(4)} (${backRepeatCount}个 / ${(totalDraws-1)}期)`);
for (let i = 1; i <= 12; i++) {
  const isRepeat = lastDraw.back.includes(i);
  const repeatScore = isRepeat ? backRepeatRate * 0.08 : 0;
  console.log(`#${i}: 上期${isRepeat?'是':'否'}重号, 得分${repeatScore.toFixed(4)}`);
}

// === 综合评分 ===
console.log('\n=== 8维综合评分（修正后） ===');
const scored = [];
const confidence = 0.43; // 从日志中获取
for (let i = 1; i <= 12; i++) {
  const freq = backFreq[i];
  const priorScore = (freq / totalDraws) * 0.15;
  const timeScore = (backTimeScores[i] || 0) * 0.12;
  const recentRate = recentBackFreq[i] / recentCount;
  const overallRate = freq / totalDraws;
  const momentumScore = (recentRate - overallRate) * 0.12;
  const condScore = backCondProb[i] * 0.20 * confidence;
  const omissionDiff = Math.abs(backOmission[i] - avgOmission);
  let omissionFactor = Math.max(0, 1 - omissionDiff / (avgOmission * 2)) * 0.15;
  const globalFreqRatio = totalBackFreq > 0 ? freq / totalBackFreq : 0;
  const avgFreqRatio = 1 / 12;
  if (globalFreqRatio < avgFreqRatio) omissionFactor *= globalFreqRatio / avgFreqRatio;
  const oddEvenScore = (i % 2 === 1) ? 0.05 : 0;
  const isRepeat = lastDraw.back.includes(i);
  const repeatScore = isRepeat ? backRepeatRate * 0.08 : 0;
  const expectedRate = 2 / 12;
  const tempRatio = recentRate / expectedRate;
  let tempScore = 0;
  if (tempRatio >= 1.5) tempScore = Math.min(0.08, (tempRatio - 1.5) * 0.04);
  else if (tempRatio < 0.5) {
    const historicalHeat = overallRate / expectedRate;
    tempScore = -Math.min(0.08, (0.5 - tempRatio) * 0.04 * Math.min(2, historicalHeat));
  }
  
  const streakRatio = backOmission[i] / avgOmission;
  let streakPenalty = 0;
  if (streakRatio > 1.5) {
    const heatMultiplier = Math.min(2, overallRate / expectedRate);
    streakPenalty = -Math.min(0.08, (streakRatio - 1.5) * 0.02 * heatMultiplier);
  }
  const totalScore = priorScore + timeScore + momentumScore + condScore + omissionFactor + oddEvenScore + repeatScore + tempScore + streakPenalty;
  scored.push({
    number: i, totalScore,
    detail: `先验${priorScore.toFixed(3)} + 时间${timeScore.toFixed(3)} + 动量${momentumScore.toFixed(3)} + 条件${condScore.toFixed(3)} + 遗漏${omissionFactor.toFixed(3)} + 奇偶${oddEvenScore.toFixed(3)} + 重号${repeatScore.toFixed(3)} + 温度${tempScore.toFixed(3)} + 连续缺席${streakPenalty.toFixed(3)}`
  });
}
scored.sort((a, b) => b.totalScore - a.totalScore);

console.log('\n排名 | 号码 | 总分 | 各维度得分');
for (const s of scored) {
  const streakFlag = backOmission[s.number] / avgOmission > 1.5 ? '❄️' + backOmission[s.number] + '期' : '';
  const tempFlag = recentBackFreq[s.number]/recentCount/(2/12) >= 1.5 ? '🔥' : recentBackFreq[s.number]/recentCount/(2/12) < 0.5 ? '❄️' : '→';
  const repeatFlag = lastDraw.back.includes(s.number) ? '✓' : '';
  console.log(`#${scored.indexOf(s)+1} | ${s.number.toString().padStart(2,'0')} | ${s.totalScore.toFixed(3)} | ${s.detail} | 遗漏${backOmission[s.number]} | 温度${tempFlag} | 重号${repeatFlag}`);
}

console.log('\n=== 预测结论 ===');
console.log(`下一期后区胆码推荐: ${scored[0].number.toString().padStart(2,'0')}`);
console.log(`Top3候选: ${scored.slice(0, 3).map(s => s.number.toString().padStart(2,'0')).join(', ')}`);