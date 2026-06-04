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
  static optimize(analyzer, backDanCount = 1, strategy = 'balanced') {
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
    
    // 热号策略专用数据
    const repeatAnalysis = analyzer.trendAnalyzer.analyzeRepeatNumbers();
    const activeData = analyzer.getActiveData();
    const lastDraw = activeData.length > 0 ? activeData[activeData.length - 1] : null;
    
    // 4. 获取时间衰减权重（归一化到0-1范围）
    const rawTimeWeights = analyzer.calculateTimeDecayWeights();
    const maxBackTimeWeight = Math.max(...Object.values(rawTimeWeights.back));
    const timeWeights = {}; // 归一化后的权重
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      timeWeights[i] = maxBackTimeWeight > 0 ? (rawTimeWeights.back[i] || 0) / maxBackTimeWeight : 0;
    }
    
    // 5. 预计算频率趋势数据（维度5需要）
    const totalDraws = activeData.length;
    const expectedRate = CONFIG.BACK_COUNT / CONFIG.BACK_RANGE; // 2/12 ≈ 0.167
    const freqRates = {}; // 每个号码的历史频率比率
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const f = backCounter[String(i)] || backCounter[i] || 0;
      freqRates[i] = totalDraws > 0 ? f / totalDraws : 0;
    }
    const maxFreqRate = Math.max(...Object.values(freqRates));

    // 6. 计算每个号码的综合得分
    // 热号策略7维度：条件概率25 + 遗漏偏离度20 + 频率+动量15(含热号恒热+5) + 时间衰减10 + 频率趋势15 + 重号因子10 + 冷却惩罚扣5 = 95~100
    // 均衡/保守策略5维度：条件概率30 + 遗漏偏离度20 + 频率+动量15 + 时间衰减15 + 频率趋势20 = 总分100分
    const scored = [];
    for (let num = 1; num <= CONFIG.BACK_RANGE; num++) {
      let score = 0;
      
      // 预先计算频率（维度2和维度3都需要）
      const freq = backCounter[String(num)] || backCounter[num] || 0;
      
      // 维度1: 条件概率得分 - 归一化（热号25分，均衡/保守30分）
      const condProb = conditionalProb.back[num] || 0;
      const maxCondProb = Math.max(...Object.values(conditionalProb.back));
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * (strategy === 'hot' ? 25 : 30);
            
      // 维度2: 遗漏回归评分（20分满分）
      // 逻辑：适度遗漏最佳（既不太热也不太冷），符合均值回归原理
      const currentOmission = omissionData.back[num] || 0;
      const omissionDeviation = currentOmission - avgBackOmission;
      const absDeviation = Math.abs(omissionDeviation);
      
      // 预计算最大偏离度（用于归一化）
      const maxAbsDeviation = Math.max(
        ...Object.values(omissionData.back).map(o => Math.abs((o || 0) - avgBackOmission))
      );
      
      // 适度遗漏得分：偏离均值越近得分越高（10分满分）
      const normalizedOmission = maxAbsDeviation > 0 ? 1 - (absDeviation / maxAbsDeviation) : 0;
      score += normalizedOmission * 10;
      
      // 策略加成（10分）：
      // - 热号策略：偏向低遗漏（近期刚开出的号码）
      // - 均衡/保守策略：偏向高遗漏（冷号回归）
      if (strategy === 'hot') {
        if (omissionDeviation < 0) {
          // 热号策略：遗漏越低得分越高
          const maxNegDeviation = Math.max(
            ...Object.values(omissionData.back)
              .map(o => (o || 0) - avgBackOmission)
              .filter(d => d < 0)
              .map(d => Math.abs(d))
          );
          const hotness = maxNegDeviation > 0 ? Math.abs(omissionDeviation) / maxNegDeviation : 0;
          score += hotness * 10;
        }
      } else {
        if (omissionDeviation > 0) {
          const maxPosDeviation = Math.max(...Object.values(omissionData.back).map(o => (o || 0) - avgBackOmission).filter(d => d > 0));
          const posNormalized = maxPosDeviation > 0 ? omissionDeviation / maxPosDeviation : 0;
          let strategyBonus = posNormalized * 7;
          if (omissionDeviation > omissionStd * 2) {
            strategyBonus += 3;
          }
          // 频率惩罚：低频号码(11、12)的遗漏回归得分打折
          const totalBackFreq = Object.values(backCounter).reduce((sum, f) => sum + f, 0);
          const globalFreqRatio = totalBackFreq > 0 ? freq / totalBackFreq : 0;
          const avgFreqRatio = 1 / CONFIG.BACK_RANGE;
          if (globalFreqRatio < avgFreqRatio) {
            strategyBonus *= globalFreqRatio / avgFreqRatio;
          }
          score += strategyBonus;
        }
      }
            
      // 维度3: 频率+动量得分（15分满分）+ 热号恒热正向反馈
      const freqBase = maxFreq > 0 ? (freq / maxFreq) * 10 : 0; // 基础频率 10分
      const momentum = recentFreq.backMomentum[num] || 0;
      const maxMomentum = Math.max(...Object.values(recentFreq.backMomentum).map(m => Math.abs(m)));
      const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
      let freqScore = freqBase + Math.max(0, normalizedMomentum) * 5; // 动量 5分
      
      // 热号恒热正向反馈：高频 + 正向动量 = 额外加分
      // 逻辑：既是历史高频，近期又在升温，形成热号更热循环
      if (strategy === 'hot') {
        const totalBackFreq = Object.values(backCounter).reduce((sum, f) => sum + f, 0);
        const globalFreqRatio = totalBackFreq > 0 ? freq / totalBackFreq : 0;
        const avgFreqRatio = 1 / CONFIG.BACK_RANGE;
        // 频率高于平均 且 动量为正 → 热号恒热加成
        if (globalFreqRatio > avgFreqRatio && momentum > 0) {
          const hotBonus = Math.min(normalizedMomentum * 5, 5); // 最高5分
          freqScore += hotBonus;
        }
      }
      score += freqScore;
            
      // 维度4: 时间衰减得分（热号10分，均衡/保守15分）- 已归一化
      const timeWeight = timeWeights[num] || 0;
      score += timeWeight * (strategy === 'hot' ? 10 : 15);
            
      // 维度5: 频率趋势加分（热号15分，均衡/保守20分）
      // 按项目设计决策：取消区间均衡补偿，改为基于历史频率的趋势加分
      // 频率高于期望值(≈0.167)的号码按比例加分，低于期望值的不加分
      // 使推荐更符合1-10高频、11-12低频的真实开奖规律
      const freqRate = freqRates[num];
      const freqTrendMax = strategy === 'hot' ? 15 : 20;
      if (freqRate > expectedRate && maxFreqRate > expectedRate) {
        const normalizedTrend = (freqRate - expectedRate) / (maxFreqRate - expectedRate);
        score += normalizedTrend * freqTrendMax;
      }
      
      // 热号策略维度6: 重号因子（10分满分）
      // 大乐透后区约25-35%重号率，上期出现的号码本期更可能再出
      if (strategy === 'hot') {
        if (lastDraw && lastDraw.back.includes(num)) {
          score += Math.min(repeatAnalysis.backRepeatRate * 10, 10);
        }
      }
      
      // 热号策略维度7: 冷却惩罚（最多扣5分）
      // 高频号且当前遗漏 > 平均遗漏 → 正在冷却 → 扣分
      if (strategy === 'hot') {
        const totalBackFreq = Object.values(backCounter).reduce((a, b) => a + b, 0);
        const avgFreqPerNum = totalBackFreq / CONFIG.BACK_RANGE;
        if (freq > avgFreqPerNum && currentOmission > avgBackOmission) {
          const coolingDegree = (currentOmission - avgBackOmission) / avgBackOmission;
          const freqHeat = freq / avgFreqPerNum;
          const penalty = Math.min(coolingDegree * freqHeat * 2, 5);
          score -= penalty;
        }
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
    
    // 后区胆码：确定性推荐（直接取评分最高），确保推荐结果稳定可预期
    // 后区12选1的特性适合确定性策略，每次推荐都是同一号码
    const selected = scored.sort((a, b) => b.score - a.score)
      .slice(0, backDanCount)
      .map(s => s.number);
    
    // 输出Top候选详情（用于概率排名显示）
    const topCandidates = [...scored].sort((a, b) => b.score - a.score).slice(0, 5);
    const maxScore = scored.length > 0 ? Math.max(...scored.map(s => s.score)) : 1;
    const probabilityInfo = topCandidates.map(w => {
      const actualProb = maxScore > 0 ? (w.score / maxScore * 100) : 0;
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
    console.log('  实际选择:', selected.map(n => `#${n}`).join(', '), '(确定性推荐)');
    if (strategy === 'hot' && lastDraw) {
      const repeatNums = selected.filter(n => lastDraw.back.includes(n));
      if (repeatNums.length > 0) console.log('  含重号:', repeatNums.map(n => `#${n}`).join(', '));
    }
    console.log('  Top5概率排名:', probabilityInfo.map(p => 
      `#${p.number}(概率${p.probability.toFixed(1)}%, 条件概率${p.condProb.toFixed(3)}, 遗漏${p.omission}, 频率${p.freq}, 总分${p.score.toFixed(2)})`
    ).join(', '));
    
    return {
      selected: selected.sort((a, b) => a - b),
      probabilityInfo: probabilityInfo
    };
  }
}
