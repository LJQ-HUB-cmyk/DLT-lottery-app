/**
 * 混合模型预测算法
 * 结合多个模型的优势，通过投票机制和智能加权
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class HybridModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'Hybrid';
  }

  predict() {
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const sumTrend = this.trendAnalyzer.analyzeSumTrend();
    const spanAnalysis = this.trendAnalyzer.analyzeSpan();

    // 模拟三个模型的预测结果（实际应该调用其他模型）
    // 这里使用简化的方式：基于频率分析生成候选
    const [frontCounter] = this.frequencyAnalyzer.analyzeFrequency();
    
    // 前区：收集所有模型的候选号码，并根据模型权重加权投票
    const sortedFront = Object.entries(frontCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(x => Number(x[0]));

    // 加权投票机制
    const voteCount = {};
    sortedFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + 1;
      voteCount[num] += (conditionalProb.front[num] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
    });

    // 按票数排序
    const candidates = Object.entries(voteCount)
      .sort((a, b) => {
        if (Math.abs(b[1] - a[1]) > 0.01) return b[1] - a[1];
        return Math.random() - 0.5;
      })
      .map(x => Number(x[0]));

    // 如果候选号码不足，补充高质量号码
    if (candidates.length < CONFIG.FRONT_COUNT) {
      const remaining = this.frontNumbers
        .filter(n => !candidates.includes(n))
        .sort((a, b) => (frontCounter[b] || 0) - (frontCounter[a] || 0));
      candidates.push(...remaining.slice(0, CONFIG.FRONT_COUNT - candidates.length));
    }

    // 从候选中选择前区号码，使用加权采样+质量评估
    let bestFront = null;
    let bestScore = -Infinity;

    const candidateWeights = candidates.map(num => voteCount[num] || 1);

    for (let i = 0; i < 150; i++) {
      let selected;
      if (i < 75) {
        selected = this.weightedSampleNoReplacement(candidates, candidateWeights, CONFIG.FRONT_COUNT);
      } else {
        selected = this.randomSample(candidates, CONFIG.FRONT_COUNT);
      }

      // 检查是否符合跨度要求
      const span = Math.max(...selected) - Math.min(...selected);
      const spanDiff = Math.abs(span - spanAnalysis.avgFrontSpan);
      if (spanDiff > CONFIG.SPAN_DIFF_THRESHOLD * 1.2) continue;

      // 检查和值要求
      const sum = selected.reduce((a, b) => a + b, 0);
      const sumDiff = Math.abs(sum - sumTrend.avgFrontSum);
      if (sumDiff > CONFIG.SUM_DIFF_THRESHOLD * 1.2) continue;

      // 区间覆盖检查
      const zones = new Set(selected.map(n => Math.floor((n - 1) / 5)));
      if (zones.size < 3) continue;

      // 奇偶比检查：不符合2:3或3:2的跳过（避免极端比例浪费搜索轮次）
      const oddCount = selected.filter(n => n % 2 !== 0).length;
      if (oddCount < 2 || oddCount > 3) continue;

      // 计算条件概率最优后区号码
      const probableBack = Object.entries(conditionalProb.back)
        .sort((a, b) => b[1] - a[1])
        .slice(0, CONFIG.BACK_COUNT)
        .map(x => Number(x[0]))
        .sort((a, b) => a - b);

      const score = this.evaluateCombination(selected, probableBack);

      if (score > bestScore) {
        bestScore = score;
        bestFront = selected;
      }

      if (score >= CONFIG.QUALITY_SCORE_THRESHOLD) break;
    }

    let front = bestFront || this.randomSample(candidates, CONFIG.FRONT_COUNT);

    // 后区：使用投票机制 + 条件概率
    const backVoteCount = {};
    const backCandidates = Object.keys(conditionalProb.back).map(Number).slice(0, 8);
    backCandidates.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + 1;
      backVoteCount[num] += (conditionalProb.back[num] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
    });

    // 如果有上期开奖数据，考虑重号策略
    const activeData = this.getActiveData();
    if (activeData && activeData.length > 0) {
      const lastDraw = activeData[activeData.length - 1];
      lastDraw.back.forEach(num => {
        if (backVoteCount[num]) {
          backVoteCount[num] += 0.3;
        }
      });
    }

    // 后区：使用智能采样
    const backCandidateWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const voteScore = backVoteCount[i] || 0;
      backCandidateWeights[i] = voteScore > 0 ? voteScore + 0.3 : CONFIG.BACK_RANDOM_BONUS;
    }

    const back = this.smartBackSample(backCandidateWeights, 'hybrid');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 Hybrid 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  /**
   * 评估组合质量
   */
  evaluateCombination(front, back) {
    let score = 50;

    // 奇偶平衡（连续归一化：2:3/3:2满分10，1:4/4:1半5分，0:5/5:0不加分）
    const oddCount = front.filter(n => n % 2 !== 0).length;
    const idealOddMin = Math.round(CONFIG.FRONT_COUNT * 0.4);
    const idealOddMax = Math.round(CONFIG.FRONT_COUNT * 0.6);
    if (oddCount >= idealOddMin && oddCount <= idealOddMax) {
      score += 10; // 理想比例满分
    } else if (oddCount === 1 || oddCount === CONFIG.FRONT_COUNT - 1) {
      score += 5;  // 1:4或4:1半分
    } // 0:5或5:0不加分

    // 大小平衡（动态适配FRONT_RANGE）
    const halfLine = Math.floor(CONFIG.FRONT_RANGE / 2);
    const bigCount = front.filter(n => n > halfLine).length;
    const idealBigMin = Math.round(CONFIG.FRONT_COUNT * 0.4);
    const idealBigMax = Math.round(CONFIG.FRONT_COUNT * 0.6);
    if (bigCount >= idealBigMin && bigCount <= idealBigMax) score += 10;

    // 后区和值（动态适配BACK_COUNT和BACK_RANGE）
    const backSum = back.reduce((a, b) => a + b, 0);
    if (CONFIG.BACK_COUNT >= 2) {
      // 多后区：和值理想范围
      const idealSumMin = Math.round(CONFIG.BACK_COUNT * CONFIG.BACK_RANGE * 0.25);
      const idealSumMax = Math.round(CONFIG.BACK_COUNT * CONFIG.BACK_RANGE * 0.5);
      if (backSum >= idealSumMin && backSum <= idealSumMax) score += 15;
      else if (backSum >= idealSumMin - 3 && backSum <= idealSumMax + 4) score += 5;
    } else {
      // 单后区号码：中等偏高号码得分更高
      const midBack = Math.ceil(CONFIG.BACK_RANGE / 3);
      if (backSum >= midBack && backSum <= CONFIG.BACK_RANGE) score += 15;
      else if (backSum >= Math.ceil(CONFIG.BACK_RANGE / 4)) score += 5;
    }

    return score;
  }

  /**
   * 随机采样
   */
  randomSample(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  getDescription() {
    return '多模型融合的混合预测模型';
  }
}
