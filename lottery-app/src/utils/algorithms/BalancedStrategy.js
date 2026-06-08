/**
 * 平衡策略预测模型
 * 自适应冷热温比例分配，根据趋势动态调整
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class BalancedStrategyModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'BalancedStrategy';
  }

  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const sumTrend = this.trendAnalyzer.analyzeSumTrend();

    // 前区：冷热温号分类
    const sortedFront = Object.entries(frontCounter).sort((a, b) => b[1] - a[1]);
    const hotFrontNums = sortedFront.slice(0, CONFIG.HOT_NUMBERS_COUNT).map(x => Number(x[0]));
    const coldFrontNums = sortedFront.slice(-CONFIG.COLD_NUMBERS_COUNT).map(x => Number(x[0]));
    const warmFrontNums = sortedFront.slice(CONFIG.HOT_NUMBERS_COUNT, -CONFIG.COLD_NUMBERS_COUNT).map(x => Number(x[0]));

    // 自适应分配：根据历史数据走势决定冷热温比例
    let hotCount, warmCount, coldCount;

    if (sumTrend.trendFront > 5) {
      // 近期和值上升，偏重热号
      hotCount = 2; warmCount = 2; coldCount = 0;
    } else if (sumTrend.trendFront < -5) {
      // 近期和值下降，偏重冷号和温号
      hotCount = 1; warmCount = 1; coldCount = 2;
    } else {
      // 趋势平稳，均衡分配
      hotCount = 1; warmCount = 2; coldCount = 1;
    }

    const selectedHotFront = this.randomSample(hotFrontNums, Math.min(hotCount, hotFrontNums.length));
    const selectedWarmFront = this.randomSample(warmFrontNums, Math.min(warmCount, warmFrontNums.length));
    const selectedColdFront = this.randomSample(coldFrontNums, Math.min(coldCount, coldFrontNums.length));

    const usedNumbers = new Set([...selectedHotFront, ...selectedWarmFront, ...selectedColdFront]);
    const remainingFront = this.frontNumbers.filter(n => !usedNumbers.has(n));
    const neededCount = CONFIG.FRONT_COUNT - usedNumbers.size;
    const selectedRandomFront = neededCount > 0 ? this.randomSample(remainingFront, neededCount) : [];

    let front = [...selectedHotFront, ...selectedWarmFront, ...selectedColdFront, ...selectedRandomFront];

    // 奇偶比后处理：确保2:3或3:2的理想比例
    front = this.enforceParityRatio(front);

    // 后区：融合条件概率的智能采样
    const backWeightsWithConditional = {};
    for (let n = 1; n <= CONFIG.BACK_RANGE; n++) {
      const freq = (backCounter[n] || 0) + 1;
      const cond = (conditionalProb.back[n] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      backWeightsWithConditional[n] = freq + cond;
    }
    const back = this.smartBackSample(backWeightsWithConditional, 'balanced');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 BalancedStrategy 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  /**
   * 随机采样（无放回）
   */
  randomSample(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  getDescription() {
    return '自适应冷热温比例分配的平衡策略预测模型';
  }
}
