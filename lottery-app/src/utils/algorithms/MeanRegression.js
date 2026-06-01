/**
 * 均值回归预测模型
 * 基于期望值的回归权重，结合条件概率融合
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class MeanRegressionModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'MeanRegression';
  }

  predict() {
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const [expFront, expBack] = this.frequencyAnalyzer.calculateExpectedValue();
    const omission = this.omissionCalculator.calculateOmission();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();

    // 计算平均遗漏值
    const frontOmissionValues = Object.values(omission.front);
    const frontAvgOmission = frontOmissionValues.reduce((a, b) => a + b, 0) / frontOmissionValues.length;
    const backOmissionValues = Object.values(omission.back);
    const backAvgOmission = backOmissionValues.reduce((a, b) => a + b, 0) / backOmissionValues.length;

    // 前区：回归权重
    const frontRegressionWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const freqBaseline = (frontCounter[i] || 0) + 1;
      const currentOmission = omission.front[i] || 0;
      const omissionDeviation = Math.abs(currentOmission - frontAvgOmission);
      const regressionFactor = 1 + omissionDeviation / frontAvgOmission;
      const distanceFromExp = Math.abs(i - expFront);
      const expFactor = 1 + (CONFIG.FRONT_RANGE - distanceFromExp) / CONFIG.FRONT_RANGE * 0.3;
      const condFactor = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      frontRegressionWeights[i] = freqBaseline * regressionFactor * expFactor + condFactor;
    }

    // 后区：回归权重
    const backRegressionWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const freqBaseline = (backCounter[i] || 0) + 1;
      const currentOmission = omission.back[i] || 0;
      const omissionDeviation = Math.abs(currentOmission - backAvgOmission);
      const regressionFactor = 1 + omissionDeviation / backAvgOmission;
      const distanceFromExp = Math.abs(i - expBack);
      const expFactor = 1 + (CONFIG.BACK_RANGE - distanceFromExp) / CONFIG.BACK_RANGE * 0.2;
      const condFactor = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      backRegressionWeights[i] = freqBaseline * regressionFactor * expFactor + condFactor;
    }

    const front = this.smartFrontSample(frontRegressionWeights, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backRegressionWeights, 'regression');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 MeanRegression 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  getDescription() {
    return '基于期望值回归权重的预测模型';
  }
}
