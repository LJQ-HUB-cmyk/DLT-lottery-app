/**
 * 正态分布预测模型
 * 基于期望值和方差，用引导式搜索逼近目标和值
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class NormalDistributionModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'NormalDistribution';
  }

  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const [expFront, expBack] = this.frequencyAnalyzer.calculateExpectedValue();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();

    // 目标参数
    const targetSumFront = Math.round(expFront * CONFIG.FRONT_COUNT);
    const targetSumBack = Math.round(expBack * CONFIG.BACK_COUNT);

    let bestFront = null, bestBack = null;
    let bestScore = -Infinity;

    // 融合条件概率的权重
    const frontFreqWeights = {};
    const backFreqWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const freq = (frontCounter[i] || 0) + 1;
      const cond = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      frontFreqWeights[i] = freq + cond;
    }
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const freq = (backCounter[i] || 0) + 1;
      const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      backFreqWeights[i] = freq + cond;
    }

    // 引导式搜索
    for (let i = 0; i < CONFIG.DISTRIBUTION_TRY_COUNT; i++) {
      // 混合策略：80%用加权采样，20%用纯随机
      let f, b;
      if (i < CONFIG.DISTRIBUTION_TRY_COUNT * 0.8) {
        const frontNums = Object.keys(frontFreqWeights).map(Number);
        const frontWeights = Object.values(frontFreqWeights);
        f = this.weightedSampleNoReplacement(frontNums, frontWeights, CONFIG.FRONT_COUNT);
        b = this.smartBackSample(backFreqWeights, 'distribution');
      } else {
        f = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
        b = this.smartBackSample(backFreqWeights, 'distribution');
      }

      const sumF = f.reduce((a, b) => a + b, 0);
      const sumB = b.reduce((a, b) => a + b, 0);

      const diffF = Math.abs(sumF - targetSumFront);
      const diffB = Math.abs(sumB - targetSumBack);

      // 奇偶比检查：不符合2:3或3:2的跳过（避免极端比例浪费搜索轮次）
      const fOddCount = f.filter(n => n % 2 !== 0).length;
      if (fOddCount < 2 || fOddCount > 3) continue;

      // 综合评分：和值接近度 + 组合质量 + 区间覆盖
      const sumScore = 100 - (diffF / targetSumFront * 50 + diffB / targetSumBack * 50);
      const qualityScore = this.evaluateCombination(f, b);
      const zones = new Set(f.map(n => Math.floor((n - 1) / 5)));
      const coverageBonus = zones.size >= 4 ? 5 : zones.size >= 3 ? 2 : -3;
      const totalScore = sumScore * 0.3 + qualityScore * 0.6 + coverageBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestFront = f;
        bestBack = b;
      }

      if (diffF < 10 && diffB < 4 && qualityScore >= 70 && zones.size >= 3) {
        bestFront = f;
        bestBack = b;
        break;
      }
    }

    let front = bestFront || this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
    let back = bestBack || this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 NormalDistribution 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  /**
   * 评估组合质量（简化版）
   */
  evaluateCombination(front) {
    // 简化的质量评估：基于奇偶比、大小比等（连续归一化评分）
    let score = 50; // 基础分
    
    // 奇偶平衡（连续归一化：2:3/3:2满分10，1:4/4:1半5分，0:5/5:0不加分）
    const oddCount = front.filter(n => n % 2 !== 0).length;
    if (oddCount >= 2 && oddCount <= 3) {
      score += 10; // 理想比例满分
    } else if (oddCount === 1 || oddCount === front.length - 1) {
      score += 5;  // 1:4或4:1半分
    } // 0:5或5:0不加分
    
    // 大小平衡（连续归一化）
    const bigCount = front.filter(n => n > 17).length;
    if (bigCount >= 2 && bigCount <= 3) {
      score += 10;
    } else if (bigCount === 1 || bigCount === front.length - 1) {
      score += 5;
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
    return '基于期望值和方差的引导式搜索预测模型';
  }
}
