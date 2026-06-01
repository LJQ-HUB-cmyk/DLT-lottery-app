/**
 * 时间衰减预测模型
 * 基于近期数据的时间衰减权重，结合条件概率和关联性
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class TimeDecayModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'TimeDecay';
    this.decayFactor = CONFIG.TIME_DECAY_FACTOR;
  }

  predict() {
    const weights = this.calculateTimeDecayWeights();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const correlation = this.correlationAnalyzer.calculateNumberCorrelation();

    // 前区：衰减权重 + 条件概率叠加 + 关联性加分
    const frontEnhancedWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const decayWeight = (weights.front[i] || 0) + 1;
      const condBonus = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      
      // 关联性加分（简化版）
      let corrBonus = 0;
      if (correlation.front[i]) {
        const correlations = Object.values(correlation.front[i]);
        if (correlations.length > 0) {
          corrBonus = correlations.reduce((sum, c) => sum + c, 0) / correlations.length * 0.1;
        }
      }
      
      frontEnhancedWeights[i] = decayWeight + condBonus + corrBonus;
    }

    // 后区：衰减权重 + 条件概率叠加
    const backEnhancedWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const decayWeight = (weights.back[i] || 0) + 1;
      const condBonus = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      backEnhancedWeights[i] = decayWeight + condBonus;
    }

    const front = this.smartFrontSample(frontEnhancedWeights, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backEnhancedWeights, 'time_decay');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 TimeDecay 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  /**
   * 计算时间衰减权重
   */
  calculateTimeDecayWeights() {
    const activeData = this.getActiveData();
    const frontWeights = {};
    const backWeights = {};

    // 初始化
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontWeights[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backWeights[i] = 0;

    // 计算时间衰减权重
    for (let idx = 0; idx < activeData.length; idx++) {
      const draw = activeData[idx];
      const timeWeight = Math.pow(this.decayFactor, activeData.length - 1 - idx);

      for (const num of draw.front) {
        frontWeights[num] += timeWeight;
      }
      for (const num of draw.back) {
        backWeights[num] += timeWeight;
      }
    }

    return { front: frontWeights, back: backWeights };
  }

  getDescription() {
    return '基于近期数据时间衰减权重的预测模型';
  }
}
