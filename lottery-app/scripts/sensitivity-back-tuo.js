/**
 * 后区拖码参数敏感性分析工具
 * 对BackTuoOptimizer每个维度进行消融实验
 * 
 * 使用方法: node scripts/sensitivity-back-tuo.js [策略] [期数] [重复次数]
 *   - 策略: hot/balanced/conservative/all，默认all
 *   - 期数: 回测期数，默认214
 *   - 重复次数: 每期重复采样次数，默认5
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { CONFIG } from '../src/utils/core/Config.js';
import { FrequencyAnalyzer } from '../src/utils/analysis/FrequencyAnalyzer.js';
import { OmissionCalculator } from '../src/utils/analysis/OmissionCalculator.js';
import { TrendAnalyzer } from '../src/utils/analysis/TrendAnalyzer.js';
import { ConditionalProbability } from '../src/utils/analysis/ConditionalProbability.js';
import { CorrelationAnalyzer } from '../src/utils/analysis/CorrelationAnalyzer.js';
import { BackDanOptimizer } from '../src/utils/optimization/BackDanOptimizer.js';
import { BackTuoOptimizer } from '../src/utils/optimization/BackTuoOptimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 后区拖码维度定义
const BACK_TUO_DIMENSION_DEFS = {
  hot: [
    { key: 'conditionalProb', label: '条件概率', weight: '20分' },
    { key: 'omission', label: '遗漏评分(低遗漏奖)', weight: '20分' },
    { key: 'freqMomentum', label: '频率+动量', weight: '20分' },
    { key: 'timeDecay', label: '时间衰减', weight: '10分' },
    { key: 'hotZoneTrend', label: '热区趋势(半区)', weight: '5分' },
    { key: 'repeatFactor', label: '重号因子', weight: '10分' },
    { key: 'zone4Trend', label: '4小区趋势', weight: '5分' },
    { key: 'coolingPenalty', label: '冷却惩罚', weight: '-5分' },
  ],
  balanced: [
    { key: 'conditionalProb', label: '条件概率', weight: '25分' },
    { key: 'omission', label: '遗漏回归评分', weight: '20+5分' },
    { key: 'freqMomentum', label: '频率+动量', weight: '20分' },
    { key: 'timeDecay', label: '时间衰减', weight: '15分' },
    { key: 'freqTrend', label: '频率趋势', weight: '15分' },
    { key: 'zone4Trend', label: '4小区趋势', weight: '5分' },
  ],
  conservative: [
    { key: 'conditionalProb', label: '条件概率', weight: '25分' },
    { key: 'omission', label: '遗漏回归评分', weight: '20+5分' },
    { key: 'freqMomentum', label: '频率+动量', weight: '20分' },
    { key: 'timeDecay', label: '时间衰减', weight: '15分' },
    { key: 'freqTrend', label: '频率趋势', weight: '15分' },
    { key: 'zone4Trend', label: '4小区趋势', weight: '5分' },
  ]
};

// BacktestAnalyzer
class BacktestAnalyzer {
  constructor(historyData) {
    this.historyData = historyData;
    this.dataWindow = 0;
    const frontNumbers = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1);
    const backNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1);
    this._frequencyAnalyzer = new FrequencyAnalyzer(historyData, () => this.getActiveData());
    this._omissionCalculator = new OmissionCalculator(historyData, () => this.getActiveData(), frontNumbers, backNumbers);
    this._trendAnalyzer = new TrendAnalyzer(historyData, () => this.getActiveData());
    this._conditionalProbability = new ConditionalProbability(historyData, () => this.getActiveData());
    this._correlationAnalyzer = new CorrelationAnalyzer(historyData, () => this.getActiveData());
  }
  getActiveData() {
    if (this.dataWindow === 0) return this.historyData;
    return this.historyData.slice(-this.dataWindow);
  }
  setDataWindow(windowSize) {
    this.dataWindow = windowSize;
    this._frequencyAnalyzer.clearCache();
    this._omissionCalculator.clearCache();
    this._trendAnalyzer.clearCache();
    this._conditionalProbability.clearCache();
    this._correlationAnalyzer.clearCache();
  }
  get frequencyAnalyzer() { return this._frequencyAnalyzer; }
  get omissionCalculator() { return this._omissionCalculator; }
  get trendAnalyzer() { return this._trendAnalyzer; }
  get conditionalProbability() { return this._conditionalProbability; }
  get correlationAnalyzer() { return this._correlationAnalyzer; }
  calculateTimeDecayWeights() {
    const activeData = this.getActiveData();
    const frontWeights = {};
    const backWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontWeights[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backWeights[i] = 0;
    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const timeWeight = Math.exp((idx - activeData.length + 1) / activeData.length);
      for (const num of draw.front) frontWeights[num] += timeWeight;
      for (const num of draw.back) backWeights[num] += timeWeight;
    }
    return { front: frontWeights, back: backWeights };
  }
}

function loadHistoryData() {
  const dataPath = join(__dirname, '..', 'src', 'data', 'lottery-history.txt');
  const content = fs.readFileSync(dataPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  const historyData = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 7) {
      historyData.push({ front: parts.slice(0, 5).map(n => parseInt(n, 10)), back: parts.slice(5, 7).map(n => parseInt(n, 10)) });
    }
  }
  return historyData;
}

function getBackDanCount() { return 1; }
function getBackTuoCount() { return 4; } // 后区1胆+4拖=覆盖5/12个号码

function suppressConsole() {
  const orig = console.log;
  const origW = console.warn;
  console.log = () => {};
  console.warn = () => {};
  return { restore: () => { console.log = orig; console.warn = origW; } };
}

function clearAnalyzerCache(analyzer) {
  analyzer._frequencyAnalyzer.clearCache();
  analyzer._omissionCalculator.clearCache();
  analyzer._trendAnalyzer.clearCache();
  analyzer._conditionalProbability.clearCache();
  analyzer._correlationAnalyzer.clearCache();
}

/**
 * 运行后区拖码基线回测
 * 测量指标：拖码命中（在2个中奖号中，有多少是拖码覆盖的）
 * 注意：拖码命中 = 中奖号在拖码中但不在胆码中
 */
function runBackTuoBaseline(strategy, tuoMultipliers, historyData, totalPeriods, repeatCount) {
  const backDanCount = getBackDanCount();
  const tuoCount = getBackTuoCount();
  let totalDanHits = 0;
  let totalTuoHits = 0;
  let totalCoverage = 0; // 胆+拖总共覆盖了多少中奖号
  let coverageAtLeast1 = 0;
  let coverageBoth = 0;
  let validPeriods = 0;
  let totalSamples = 0;
  
  const { restore } = suppressConsole();
  try {
    for (let i = 50; i < totalPeriods; i++) {
      const trainData = historyData.slice(0, i);
      const testData = historyData[i];
      if (trainData.length < 50) continue;
      
      const analyzer = new BacktestAnalyzer(trainData);
      const actualBack = testData.back;
      
      for (let r = 0; r < repeatCount; r++) {
        clearAnalyzerCache(analyzer);
        
        // 先选后区胆码（使用当前已优化BackDanOptimizer）
        const backDanResult = BackDanOptimizer.optimize(analyzer, backDanCount, strategy);
        const danNumbers = backDanResult.selected;
        
        // 再选后区拖码
        const backTuoResult = BackTuoOptimizer.optimize(analyzer, danNumbers, tuoCount, strategy, tuoMultipliers);
        const tuoNumbers = backTuoResult.selected;
        
        // 计算命中
        const danHits = danNumbers.filter(n => actualBack.includes(n)).length;
        const tuoHits = tuoNumbers.filter(n => actualBack.includes(n)).length;
        const coverage = danHits + tuoHits; // 胆+拖总共覆盖
        
        totalDanHits += danHits;
        totalTuoHits += tuoHits;
        totalCoverage += coverage;
        if (coverage >= 1) coverageAtLeast1++;
        if (coverage >= 2) coverageBoth++;
        
        totalSamples++;
      }
      validPeriods++;
    }
  } finally {
    restore();
  }
  
  const avgDanHits = totalSamples > 0 ? totalDanHits / totalSamples : 0;
  const avgTuoHits = totalSamples > 0 ? totalTuoHits / totalSamples : 0;
  const avgCoverage = totalSamples > 0 ? totalCoverage / totalSamples : 0;
  const coverageAtLeast1Rate = totalSamples > 0 ? coverageAtLeast1 / totalSamples : 0;
  const coverageBothRate = totalSamples > 0 ? coverageBoth / totalSamples : 0;
  
  return { avgDanHits, avgTuoHits, avgCoverage, coverageAtLeast1Rate, coverageBothRate, validPeriods, totalSamples };
}

/**
 * 运行单维度消融回测（将某维度设为0）
 */
function runBackTuoAblation(strategy, dimKey, baselineMultipliers, historyData, totalPeriods, repeatCount) {
  const ablationMultipliers = { ...baselineMultipliers };
  ablationMultipliers[dimKey] = 0;
  return runBackTuoBaseline(strategy, ablationMultipliers, historyData, totalPeriods, repeatCount);
}

// 组合数计算
function comb(n, k) {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) result *= (n - i) / (i + 1);
  return result;
}

// 主函数
function runBackTuoSensitivity(strategy, totalPeriods, repeatCount) {
  const historyData = loadHistoryData();
  totalPeriods = Math.min(totalPeriods, historyData.length);
  
  console.log(`\n🔬 后区拖码参数敏感性分析 - 策略: ${strategy}`);
  console.log(`回测期数: ${totalPeriods-50}, 每期重复: ${repeatCount}次`);
  console.log('测试指标: 胆码命中率 + 拖码命中率 + 胆拖总覆盖率');
  console.log('='.repeat(80));
  
  // 维度定义
  const tuoDims = BACK_TUO_DIMENSION_DEFS[strategy];
  
  // 构建基线倍率（全部=1.0，但freqTrend已默认0）
  const tuoBaseline = {};
  for (const dim of tuoDims) tuoBaseline[dim.key] = 1;
  
  // 运行基线回测
  console.log('\n📊 运行基线回测（所有维度权重=1.0）...');
  const baselineResult = runBackTuoBaseline(strategy, tuoBaseline, historyData, totalPeriods, repeatCount);
  
  console.log(`  基线结果:`);
  console.log(`    胆码平均命中: ${baselineResult.avgDanHits.toFixed(3)}个`);
  console.log(`    拖码平均命中: ${baselineResult.avgTuoHits.toFixed(3)}个`);
  console.log(`    胆拖总覆盖率≥1: ${(baselineResult.coverageAtLeast1Rate*100).toFixed(1)}%`);
  console.log(`    胆拖总覆盖率≥2(全中): ${(baselineResult.coverageBothRate*100).toFixed(1)}%`);
  
  // 计算随机基线
  // 1胆+4拖=5个号码覆盖12个中的5个，中奖2个
  // P(≥1覆盖) = 1 - C(7,2)/C(12,2) = 1 - 21/66 ≈ 68.2%
  // P(全覆盖) = C(2,2)*C(10,3)/C(12,5) ... 更简单: 5选2/12选5 修正
  // 简化: P(≥1 of 2 in 5) = 1 - (7/12)*(6/11) ≈ 68.2%
  // P(both in 5) = (5/12)*(4/11) ≈ 15.2%
  const randomCoverageAtLeast1 = 1 - (7/12)*(6/11); // ≈68.2%
  const randomCoverageBoth = (5/12)*(4/11); // ≈15.2%
  
  console.log(`\n📊 随机基线（纯随机1胆+4拖）:`);
  console.log(`    ≥1覆盖随机概率: ${(randomCoverageAtLeast1*100).toFixed(1)}%`);
  console.log(`    全覆盖随机概率: ${(randomCoverageBoth*100).toFixed(1)}%`);
  console.log(`    ≥1覆盖提升倍数: ${(baselineResult.coverageAtLeast1Rate/randomCoverageAtLeast1).toFixed(2)}x`);
  console.log(`    全覆盖提升倍数: ${(baselineResult.coverageBothRate/randomCoverageBoth).toFixed(2)}x`);
  
  // 消融实验
  console.log('\n📊 后区拖码维度消融实验（逐一移除维度）');
  console.log('-'.repeat(80));
  console.log('维度\t\t\t| 权重 | 基线≥1% | 消融≥1% | Δ% | 基线全中% | 消融全中% | Δ全中% | 贡献度');
  console.log('-'.repeat(80));
  
  const results = [];
  for (const dim of tuoDims) {
    const ablationResult = runBackTuoAblation(strategy, dim.key, tuoBaseline, historyData, totalPeriods, repeatCount);
    const deltaCoverage = baselineResult.coverageAtLeast1Rate - ablationResult.coverageAtLeast1Rate;
    const deltaBoth = baselineResult.coverageBothRate - ablationResult.coverageBothRate;
    const contribution = deltaCoverage * 100;
    
    results.push({
      key: dim.key,
      label: dim.label,
      weight: dim.weight,
      baselineCoverage: baselineResult.coverageAtLeast1Rate,
      ablationCoverage: ablationResult.coverageAtLeast1Rate,
      deltaCoverage,
      baselineBoth: baselineResult.coverageBothRate,
      ablationBoth: ablationResult.coverageBothRate,
      deltaBoth,
      contribution
    });
    
    const labelStr = dim.label.padEnd(20);
    const wStr = dim.weight.padEnd(8);
    const bCov = (baselineResult.coverageAtLeast1Rate * 100).toFixed(1).padStart(6);
    const aCov = (ablationResult.coverageAtLeast1Rate * 100).toFixed(1).padStart(6);
    const dCov = (deltaCoverage >= 0 ? '+' : '') + (deltaCoverage * 100).toFixed(1).padStart(5);
    const bBoth = (baselineResult.coverageBothRate * 100).toFixed(1).padStart(6);
    const aBoth = (ablationResult.coverageBothRate * 100).toFixed(1).padStart(6);
    const dBoth = (deltaBoth >= 0 ? '+' : '') + (deltaBoth * 100).toFixed(1).padStart(5);
    const contrib = (contribution >= 0 ? '+' : '') + contribution.toFixed(1).padStart(5);
    
    console.log(`${labelStr}| ${wStr}| ${bCov}% | ${aCov}% | ${dCov}% | ${bBoth}% | ${aBoth}% | ${dBoth}% | ${contrib}%`);
  }
  
  results.sort((a, b) => b.contribution - a.contribution);
  
  console.log('\n📈 后区拖码维度贡献度排名（从大到小）:');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const sign = r.contribution >= 0 ? '✅ 正贡献' : '❌ 负贡献';
    console.log(`  #${i+1} ${r.label}(${r.weight}): ${sign} ${r.contribution >= 0 ? '+' : ''}${r.contribution.toFixed(1)}% (≥1覆盖率 ${(r.baselineCoverage*100).toFixed(1)}% → ${(r.ablationCoverage*100).toFixed(1)}%)`);
  }
  
  // 关键结论
  console.log('\n' + '='.repeat(80));
  console.log('🔑 关键结论');
  console.log('='.repeat(80));
  
  const positiveDims = results.filter(r => r.contribution > 0.5);
  const negativeDims = results.filter(r => r.contribution < -0.5);
  const neutralDims = results.filter(r => Math.abs(r.contribution) <= 0.5);
  
  if (positiveDims.length > 0) {
    console.log('✅ 正贡献维度（移除后覆盖率下降）:');
    for (const r of positiveDims) console.log(`  - ${r.label}: +${r.contribution.toFixed(1)}%`);
  }
  if (negativeDims.length > 0) {
    console.log('❌ 负贡献维度（移除后覆盖率反而上升 → 拖累表现）:');
    for (const r of negativeDims) console.log(`  - ${r.label}: ${r.contribution.toFixed(1)}%`);
  }
  if (neutralDims.length > 0) {
    console.log('⚪ 中性维度（贡献极小）:');
    for (const r of neutralDims) console.log(`  - ${r.label}: ${r.contribution.toFixed(1)}%`);
  }
  
  // 保存结果
  const output = {
    strategy,
    totalPeriods,
    repeatCount,
    baseline: baselineResult,
    randomBaseline: { coverageAtLeast1: randomCoverageAtLeast1, coverageBoth: randomCoverageBoth },
    ablationResults: results,
    dimensionDefs: tuoDims,
    meta: { timestamp: new Date().toISOString() }
  };
  
  const outputPath = join(__dirname, `sensitivity-back-tuo-${strategy}-results.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n💾 结果已保存到: ${outputPath}`);
}

// 解析参数
const args = process.argv.slice(2);
const strategyArg = args[0] || 'all';
const totalPeriods = args[1] ? parseInt(args[1], 10) : 214;
const repeatCount = args[2] ? parseInt(args[2], 10) : 5;

const strategies = strategyArg === 'all' 
  ? ['hot', 'balanced', 'conservative'] 
  : [strategyArg];

console.log('🔬 后区拖码参数敏感性分析工具');
console.log(`使用方法: node scripts/sensitivity-back-tuo.js [策略] [期数] [重复次数]`);
console.log(`当前配置: 策略=${strategyArg}, 期数=${totalPeriods}, 重复=${repeatCount}`);

for (const strategy of strategies) {
  runBackTuoSensitivity(strategy, totalPeriods, repeatCount);
}