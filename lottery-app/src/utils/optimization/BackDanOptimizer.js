/**
 * 后区胆码智能推荐优化器
 * 融合：条件概率 + 遗漏回归 + 时间衰减 + 频率 + 区间分布
 */

import { CONFIG } from '../core/Config.js';

export class BackDanOptimizer {
  /**
   * 优化后区胆码推荐（多维度智能评分）
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number} backDanCount - 需要推荐的胆码数量
   * @returns {number[]} 推荐的后区胆码
   */
  static optimize(analyzer, backDanCount = 1) {
    console.log('🎯 后区胆码智能推荐（多维度评分）');
    
    // 1. 获取条件概率
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const confidence = conditionalProb.confidence || 0.3;
    
    // 2. 获取遗漏数据
    const omissionData = analyzer.omissionCalculator.calculateOmission();
    const avgBackOmission = analyzer.omissionCalculator.getAverageOmission('back');
    const omissionStd = analyzer.omissionCalculator.getOmissionStd('back');
    
    // 3. 获取频率数据（全量 + 近期趋势动量）
    const [, backCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const maxFreq = Math.max(...Object.values(backCounter));
    const recentFreq = analyzer.frequencyAnalyzer.analyzeRecentFrequency();
    
    // 4. 获取时间衰减权重（归一化到0-1范围）
    const rawTimeWeights = analyzer.calculateTimeDecayWeights();
    const maxBackTimeWeight = Math.max(...Object.values(rawTimeWeights.back));
    const timeWeights = {}; // 归一化后的权重
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      timeWeights[i] = maxBackTimeWeight > 0 ? (rawTimeWeights.back[i] || 0) / maxBackTimeWeight : 0;
    }
    
    // 5. 计算每个号码的综合得分
    // 评分体系：5维度均衡，每维度满分25分，总分100分
    const scored = [];
    for (let num = 1; num <= CONFIG.BACK_RANGE; num++) {
      let score = 0;
      
      // 预先计算频率（维度2和维度3都需要）
      const freq = backCounter[String(num)] || backCounter[num] || 0;
      
      // 维度1: 条件概率得分（25分满分）
      const condProb = conditionalProb.back[num] || 0;
      const maxCondProb = Math.max(...Object.values(conditionalProb.back));
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * 25;
            
      // 维度2: 遗漏回归加成（25分满分）
      const currentOmission = omissionData.back[num] || 0;
      const omissionDeviation = currentOmission - avgBackOmission;
      if (omissionDeviation > 0) {
        // 遗漏高于均值，归一化到0-25
        const maxDeviation = Math.max(...Object.values(omissionData.back).map(o => (o || 0) - avgBackOmission).filter(d => d > 0));
        const normalizedDeviation = maxDeviation > 0 ? omissionDeviation / maxDeviation : 0;
        let omissionScore = normalizedDeviation * 20; // 基础回归
        if (omissionDeviation > omissionStd * 2) {
          omissionScore += 5; // 超过2倍标准差额外加分
        }
        // 频率惩罚：如果该号码历史频率低于平均（如11、12），降低遗漏回归得分
        const totalBackFreq = Object.values(backCounter).reduce((sum, f) => sum + f, 0);
        const globalFreqRatio = totalBackFreq > 0 ? freq / totalBackFreq : 0;
        const avgFreqRatio = 1 / CONFIG.BACK_RANGE;
        if (globalFreqRatio < avgFreqRatio) {
          // 频率低于平均，按低于比例降低遗漏回归得分
          const freqPenalty = globalFreqRatio / avgFreqRatio; // 0-1之间
          omissionScore *= freqPenalty;
        }
        score += omissionScore;
      }
            
      // 维度3: 频率得分（20分满分）- 归一化 + 近期趋势动量加成
      const freqBase = maxFreq > 0 ? (freq / maxFreq) * 15 : 0; // 基础频率 15分
      const momentum = recentFreq.backMomentum[num] || 0;
      const maxMomentum = Math.max(...Object.values(recentFreq.backMomentum).map(m => Math.abs(m)));
      const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
      score += freqBase + Math.max(0, normalizedMomentum) * 5;
            
      // 维度4: 时间衰减得分（15分满分）- 已归一化
      const timeWeight = timeWeights[num] || 0;
      score += timeWeight * 15;
            
      // 维度5: 频率趋势加分（15分满分）
      // 后区1-12号码历史分布天然不均匀（1-10占85%，11-12仅15%）
      // 不再强行"均衡"，而是让频率高的号码自然得分更高
      // 计算所有后区号码的总频率
      const totalBackFreq = Object.values(backCounter).reduce((sum, f) => sum + f, 0);
      const globalFreqRatio = totalBackFreq > 0 ? freq / totalBackFreq : 0;
      const avgFreqRatio = 1 / CONFIG.BACK_RANGE; // 理论平均 1/12
      // 如果该号码频率高于平均，给予加分
      if (globalFreqRatio > avgFreqRatio) {
        const excess = (globalFreqRatio - avgFreqRatio) / avgFreqRatio; // 超出比例
        score += Math.min(excess * 30, 15); // 最高15分
      }
      
      scored.push({
        number: num,
        score,
        condProb,
        omission: currentOmission,
        freq,
        timeWeight
      });
    }
    
    // 加权随机采样：高分号码被选中概率更高，但不是100%
    // 每次推荐都会有合理的变化，避免每天推荐相同号码
    const minScore = Math.min(...scored.map(s => s.score));
    const scoreRange = Math.max(...scored.map(s => s.score)) - minScore;
    
    // 给每个号码一个非零的权重（最低也有5%的机会），高分号码权重更高
    const weights = scored.map(s => {
      const normalized = scoreRange > 0 ? (s.score - minScore) / scoreRange : 0.5;
      // 线性映射：最低0.05（5%基础概率），最高1.0（满分概率）
      return {
        number: s.number,
        weight: 0.05 + normalized * 0.95,
        score: s.score,
        condProb: s.condProb,
        omission: s.omission,
        freq: s.freq,
        timeWeight: s.timeWeight
      };
    });
    
    // 加权随机采样选出 backDanCount 个号码
    const selected = [];
    const remaining = [...weights];
    
    for (let i = 0; i < backDanCount && remaining.length > 0; i++) {
      // 计算当前剩余号码的总权重
      const totalWeight = remaining.reduce((sum, w) => sum + w.weight, 0);
      
      // 加权随机选择一个号码
      let random = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let j = 0; j < remaining.length; j++) {
        random -= remaining[j].weight;
        if (random <= 0) {
          chosenIdx = j;
          break;
        }
      }
      
      const chosen = remaining[chosenIdx];
      selected.push(chosen.number);
      remaining.splice(chosenIdx, 1); // 移除已选号码
    }
    
    // 输出Top候选详情
    const topCandidates = [...weights].sort((a, b) => b.weight - a.weight).slice(0, 5);
    const totalWeightSum = weights.reduce((sum, w) => sum + w.weight, 0);
    const probabilityInfo = topCandidates.map(w => {
      const actualProb = totalWeightSum > 0 ? (w.weight / totalWeightSum * 100) : 0;
      return {
        number: w.number,
        probability: actualProb,
        score: w.score,
        condProb: w.condProb,
        omission: w.omission,
        freq: w.freq
      }; 
    });
    
    console.log('✅ 后区胆码推荐完成:', selected.sort((a, b) => a - b));
    console.log('  实际选择:', selected.map(n => `#${n}`).join(', '), '(加权随机采样)');
    console.log('  Top5概率排名:', probabilityInfo.map(p => 
      `#${p.number}(概率${p.probability.toFixed(1)}%, 条件概率${p.condProb.toFixed(3)}, 遗漏${p.omission}, 频率${p.freq}, 总分${p.score.toFixed(2)})`
    ).join(', '));
    
    return {
      selected: selected.sort((a, b) => a - b),
      probabilityInfo: probabilityInfo
    };
  }
}
