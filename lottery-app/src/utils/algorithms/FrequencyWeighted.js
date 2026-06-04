/**
 * 频率加权预测模型
 * 基于历史频率统计，结合条件概率进行加权选择
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class FrequencyWeightedModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'FrequencyWeighted';
  }

  /**
   * 生成预测号码
   * @returns {number[]} [前区5个号码, 后区2个号码]
   */
  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    
    // 前区：频率加权 + 条件概率融合
    const frontWeightsWithConditional = {};
    for (let n = 1; n <= CONFIG.FRONT_RANGE; n++) {
      const freqWeight = (frontCounter[n] || 0) + 1;
      const condWeight = (conditionalProb.front[n] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      frontWeightsWithConditional[n] = freqWeight + condWeight;
    }
    
    // 后区：频率加权 + 条件概率融合
    const backWeightsWithConditional = {};
    for (let n = 1; n <= CONFIG.BACK_RANGE; n++) {
      const freqWeight = (backCounter[n] || 0) + 1;
      const condWeight = (conditionalProb.back[n] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
      backWeightsWithConditional[n] = freqWeight + condWeight;
    }
    
    const front = this.smartFrontSample(frontWeightsWithConditional, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backWeightsWithConditional, 'weighted');
    
    // 强制区间覆盖
    const coveredFront = this.enforceZoneCoverage(front, 4);
    
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    
    console.log('📊 FrequencyWeighted 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);
    
    return [...coveredFront, ...back];
  }

  getDescription() {
    return '基于历史频率统计，结合条件概率进行加权选择的预测模型';
  }
}
