/**
 * 推荐置信度计算器
 * 综合评估当前推荐的可信程度，为用户提供参考
 * 置信度 = 条件概率置信度(30%) + 数据量充分性(20%) + 维度一致性(30%) + 验证评分(20%)
 */

import { CONFIG } from '../core/Config.js';

export class ConfidenceCalculator {
  /**
   * 计算综合推荐置信度
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {Object} validationResult - 组合验证结果
   * @param {number[]} selectedNumbers - 推荐的前区号码
   * @returns {Object} { confidence, level, breakdown }
   */
  static calculate(analyzer, validationResult, selectedNumbers) {
    const breakdown = {};

    // 1. 条件概率置信度（30%权重）
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const condConfidence = conditionalProb.confidence || 0.3;
    breakdown.conditionalConfidence = condConfidence;
    const condScore = condConfidence * 30; // 最高30分

    // 2. 数据量充分性（20%权重）
    const dataLength = analyzer.historyData ? analyzer.historyData.length : 0;
    // 100期=0.5, 200期=0.8, 300期=1.0
    const dataSufficiency = Math.min(1, dataLength / 300);
    breakdown.dataSufficiency = dataSufficiency;
    breakdown.dataLength = dataLength;
    const dataScore = dataSufficiency * 20; // 最高20分

    // 3. 维度一致性（30%权重）- 各维度评分方差越小越一致
    // 用推荐号码的各维度得分差异来衡量
    const dimensionConsistency = this.calculateDimensionConsistency(analyzer, selectedNumbers);
    breakdown.dimensionConsistency = dimensionConsistency;
    const consistencyScore = dimensionConsistency * 30; // 最高30分

    // 4. 验证评分（20%权重）- 组合质量验证评分越高置信度越高
    const validationScore = validationResult ? validationResult.score / 100 : 0.7;
    breakdown.validationScore = validationScore;
    const validScore = validationScore * 20; // 最高20分

    // 综合置信度（0-100）
    const confidence = Math.round(condScore + dataScore + consistencyScore + validScore);

    // 置信度等级
    let level;
    if (confidence >= 80) level = '高';
    else if (confidence >= 60) level = '中';
    else level = '低';

    return {
      confidence,
      level,
      breakdown
    };
  }

  /**
   * 计算维度一致性
   * 检查各推荐号码的多维度得分是否一致（方差小=一致性好）
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number[]} selectedNumbers - 推荐号码
   * @returns {number} 一致性0-1
   */
  static calculateDimensionConsistency(analyzer, selectedNumbers) {
    if (!selectedNumbers || selectedNumbers.length === 0) return 0.5;

    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const [frontCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const omissionData = analyzer.omissionCalculator.calculateOmission();

    // 为每个号码计算4个维度得分（每个维度满分25，保证量级一致）
    const maxCondProb = Math.max(...Object.values(conditionalProb.front));
    const maxFreq = Math.max(...Object.values(frontCounter));
    const maxOmission = Math.max(...Object.values(omissionData.front));

    const dimensionScores = selectedNumbers.map(num => {
      const condProb = maxCondProb > 0 ? ((conditionalProb.front[num] || 0) / maxCondProb) * 25 : 0; // 归一化到0-25
      const freq = maxFreq > 0 ? ((frontCounter[String(num)] || frontCounter[num] || 0) / maxFreq) * 25 : 0; // 归一化到0-25
      const omission = maxOmission > 0 ? ((omissionData.front[num] || 0) / maxOmission) * 25 : 0; // 归一化到0-25
      // 奇偶加成: 推荐号码中奇数占比接近2:3或3:2时加分
      const oddCount = selectedNumbers.filter(n => n % 2 !== 0).length;
      const isOdd = num % 2 !== 0;
      const idealOddMin = Math.round(selectedNumbers.length * 0.4);
      const idealOddMax = Math.round(selectedNumbers.length * 0.6);
      const parityBonus = (isOdd && oddCount >= idealOddMin && oddCount <= idealOddMax) ? 10 : 5; // 奇偶合理10分， 欏斜5分
      return condProb + freq + omission + parityBonus;
    });

    // 计算方差
    if (dimensionScores.length < 2) return 0.5;
    const avg = dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length;
    const variance = dimensionScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / dimensionScores.length;
    const stdDev = Math.sqrt(variance);

    // 方差映射到一致性：标准差0 → 一致性1，标准差越大 → 一致性越低
    // 假设标准差>50为极不一致
    const consistency = Math.max(0, Math.min(1, 1 - stdDev / 50));

    return consistency;
  }

  /**
   * 生成置信度描述文本（供UI旁白展示）
   * @param {Object} confidenceResult - 置信度计算结果
   * @returns {string} 描述文本
   */
  static generateDescription(confidenceResult) {
    const { confidence, level, breakdown } = confidenceResult;

    let desc = `推荐置信度：${confidence}分（${level}）`;
    
    // 补充置信度细节
    if (breakdown.dataLength < 100) {
      desc += `。数据量${breakdown.dataLength}期偏少，置信度受限`;
    } else if (breakdown.dataLength >= 200) {
      desc += `。数据量${breakdown.dataLength}期充分`;
    }

    if (breakdown.conditionalConfidence < 0.5) {
      desc += '，条件概率置信度偏低';
    }

    if (breakdown.dimensionConsistency < 0.5) {
      desc += '，号码间维度评分差异较大';
    }

    return desc;
  }
}