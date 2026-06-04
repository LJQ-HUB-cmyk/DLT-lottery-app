/**
 * 遗漏分析预测模型
 * 基于遗漏值回归倾向，结合条件概率和关联性进行评分
 */

import { BaseModel } from './BaseModel.js';
import { CONFIG } from '../core/Config.js';

export class OmissionAnalysisModel extends BaseModel {
  constructor(dependencies) {
    super(dependencies);
    this.name = 'OmissionAnalysis';
  }

  predict() {
    const omission = this.omissionCalculator.calculateOmission();
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const correlation = this.correlationAnalyzer.calculateNumberCorrelation();
    const [frontCounter, backCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const totalDraws = this.getActiveData().length;

    // 计算遗漏值的统计特征
    const frontOmissionValues = Object.values(omission.front);
    const backOmissionValues = Object.values(omission.back);

    const frontMean = frontOmissionValues.reduce((a, b) => a + b, 0) / frontOmissionValues.length;
    const backMean = backOmissionValues.reduce((a, b) => a + b, 0) / backOmissionValues.length;
    const frontStd = Math.sqrt(
      frontOmissionValues.reduce((sum, val) => sum + Math.pow(val - frontMean, 2), 0) / frontOmissionValues.length
    );
    const backStd = Math.sqrt(
      backOmissionValues.reduce((sum, val) => sum + Math.pow(val - backMean, 2), 0) / backOmissionValues.length
    );

    // 前区：连续评分
    const frontOmissionWeights = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const currentOmission = omission.front[i] || 0;
      const deviation = (currentOmission - frontMean) / (frontStd || 1);
      const regressionScore = 1 + deviation * 0.5;
      const extremeBonus = Math.abs(deviation) > 2 ? Math.abs(deviation) * 0.3 : 0;
      const freqBaseline = (frontCounter[i] || 0) / (totalDraws || 1) * 3;
      const condBonus = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      
      // 关联性加分（简化版）
      let corrBonus = 0;
      if (correlation.front[i]) {
        const correlations = Object.values(correlation.front[i]);
        if (correlations.length > 0) {
          corrBonus = correlations.reduce((sum, c) => sum + c, 0) / correlations.length * 0.1;
        }
      }
      
      frontOmissionWeights[i] = regressionScore + extremeBonus + freqBaseline + condBonus + corrBonus + 1;
    }

    // 后区：连续评分
    const backOmissionWeights = {};
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const currentOmission = omission.back[i] || 0;
      const deviation = (currentOmission - backMean) / (backStd || 1);
      const regressionScore = 1 + deviation * 0.5;
      const extremeBonus = Math.abs(deviation) > 2 ? Math.abs(deviation) * 0.3 : 0;
      const freqBaseline = (backCounter[i] || 0) / (totalDraws || 1) * 3;
      const condBonus = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      backOmissionWeights[i] = regressionScore + extremeBonus + freqBaseline + condBonus + 1;
    }

    const front = this.smartFrontSample(frontOmissionWeights, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backOmissionWeights, 'omission');

    const coveredFront = this.enforceZoneCoverage(front, 4);
    coveredFront.sort((a, b) => a - b);
    back.sort((a, b) => a - b);

    console.log('📊 OmissionAnalysis 生成结果 - 前区:', coveredFront.length, '个号码', coveredFront, '后区:', back.length, '个号码', back);

    return [...coveredFront, ...back];
  }

  getDescription() {
    return '基于遗漏值回归倾向，结合条件概率和关联性的预测模型';
  }
}
