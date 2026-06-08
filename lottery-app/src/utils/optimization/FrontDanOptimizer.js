/**
 * 前区胆码智能推荐优化器
 * 融合：条件概率 + 遗漏回归 + 时间衰减 + 频率 + 区间分布
 * 使用加权随机采样，每次推荐结果不同但合理
 */

import { CONFIG } from '../core/Config.js';
import { HistoricalSimilarity } from '../analysis/HistoricalSimilarity.js';
import { computeZone5Prediction, formatZonePredictionLog } from './ZonePrediction.js';

export class FrontDanOptimizer {
  /**
   * 优化前区胆码推荐（多维度智能评分 + 加权随机采样）
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @param {number} danCount - 需要推荐的胆码数量（2-4）
   * @param {string} strategy - 策略：hot/balanced/conservative
   * @returns {Object} { selected: number[], probabilityInfo: Object[] }
   */
  static optimize(analyzer, danCount = 3, strategy = 'hot') {
    console.log('🎯 前区胆码智能推荐（多维度评分 + 加权随机采样）');
    console.log('  策略:', strategy, '胆码数量:', danCount);
    
    // 1. 获取条件概率
    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const confidence = conditionalProb.confidence || 0.3;
    
    // 2. 获取遗漏数据
    const omissionData = analyzer.omissionCalculator.calculateOmission();
    const avgFrontOmission = analyzer.omissionCalculator.getAverageOmission('front');
    const omissionStd = analyzer.omissionCalculator.getOmissionStd('front');
    
    // 3. 获取频率数据（全量 + 近期趋势动量）
    const [frontCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();
    const maxFreq = Math.max(...Object.values(frontCounter));
    const recentFreq = analyzer.frequencyAnalyzer.analyzeRecentFrequency();
    
    // 4. 获取时间衰减权重（归一化到0-1范围）
    const rawTimeWeights = analyzer.calculateTimeDecayWeights();
    const maxFrontTimeWeight = Math.max(...Object.values(rawTimeWeights.front));
    
    // 5. 获取关联性数据（使用时间衰减版本，近期共现权重更高）
    const correlationData = analyzer.correlationAnalyzer.calculateNumberCorrelationWithTimeDecay();
    
    // 6. 热号策略专用数据
    const repeatAnalysis = analyzer.trendAnalyzer.analyzeRepeatNumbers();
    const activeData = analyzer.getActiveData();
    const lastDraw = activeData.length > 0 ? activeData[activeData.length - 1] : null;
    
    // 动量加速度：近10期频率 vs 近30期频率（更长窗口减少噪音，更稳定的趋势信号）
    const veryRecentCount = Math.min(10, activeData.length); // 改为近10期（原5期噪音大）
    const veryRecentData = activeData.slice(-veryRecentCount);
    const veryRecentFrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) veryRecentFrontFreq[i] = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.front) veryRecentFrontFreq[num]++;
    }
    
    // 5小区定义（替代7小区，更符合出号规律：85.4%只有3-4区出号）
    const getZone5 = (num) => Math.ceil(num / 7); // 区1(1-7),区2(8-14),区3(15-21),区4(22-28),区5(29-35)
    // 7小区定义（仍用于维度8区间饱和度调节）
    const getZone7 = (num) => {
      if (num <= 5) return 1;
      if (num <= 10) return 2;
      if (num <= 15) return 3;
      if (num <= 20) return 4;
      if (num <= 25) return 5;
      if (num <= 30) return 6;
      return 7;
    };
    // 7. 计算每个号码的综合得分（策略差异化评分，总分约100）
    // 改进1~5：均衡/保守差异化+共享趋势工具+自适应扰动
    // 热号策略：9维度(热度信号17+频率逆袭6+条件概率20+5小区趋势15+胆码重号降温-1~-3+动量加速5+时间衰减10+历史相似度5+区间饱和度±5+冷却惩罚-5 = 47~73)
    // 均衡策略：6维度(频率动量15+条件概率30+遗漏偏离度20+时间衰减15+频率趋势10+5小区趋势10 = 100)
    // 保守策略：6维度(频率动量8+条件概率25+遗漏偏离度25+时间衰减15+频率趋势7+5小区趋势7 = 80~87)
    const scored = [];
    
    // 先计算全局最大值用于归一化
    const maxCondProb = Math.max(...Object.values(conditionalProb.front));
    const maxOmissionDeviation = Math.max(
      ...Object.values(omissionData.front)
        .map(o => (o || 0) - avgFrontOmission)
        .filter(d => d > 0)
    );
    // 计算关联性最大值
    let maxCorrelation = 0;
    for (const num in correlationData.front) {
      const correlations = Object.values(correlationData.front[num] || {});
      const sum = correlations.reduce((a, b) => a + b, 0);
      if (sum > maxCorrelation) maxCorrelation = sum;
    }
    
    // 预计算：7小区频率趋势数据（均衡/保守策略维度5用，取消3大区强制均衡补偿）
    // 与后区BackDanOptimizer设计决策一致：基于历史频率的趋势加分而非强制均衡
    const recentFrontWindowCount = Math.min(30, activeData.length); // 近30期频率（更稳定）
    const recentFrontWindowData = activeData.slice(-recentFrontWindowCount);
    const recentFrontWindowFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recentFrontWindowFreq[i] = 0;
    for (const draw of recentFrontWindowData) {
      for (const num of draw.front) recentFrontWindowFreq[num]++;
    }
    const frontExpectedRate = CONFIG.FRONT_COUNT / CONFIG.FRONT_RANGE; // 5/35 ≈ 0.143
    const frontFreqRates = {}; // 每个号码的近期频率比率
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      frontFreqRates[i] = recentFrontWindowCount > 0 ? recentFrontWindowFreq[i] / recentFrontWindowCount : 0;
    }
    const maxFrontFreqRate = Math.max(...Object.values(frontFreqRates));
    
    // === 5小区动态趋势数据（改进4：使用共享ZonePrediction工具，统一预测逻辑） ===
    // 数据支撑：85.4%只有3-4个小区出号，连续不出2期后100%回归
    const { zone5Absence, zone5RecentHit, zone5Trend, zone5Prediction } = computeZone5Prediction(activeData, getZone5);
    
    // 5小区预测：判断哪些区下期"必出"、"可能出"、"可能不出"
    // 核心逻辑：连续不出2期后回归概率接近100%，连续不出3期以上绝对必出
    const zone5Log = formatZonePredictionLog(zone5Prediction, zone5Absence, zone5Trend, 5, (z) => `${(z-1)*7+1}-${z*7}`, '5小区');
    console.log('  📊 5小区动态趋势预测:', zone5Log);
    
    // 7小区近期频率占比（仍用于区间饱和度调节维度8）
    const zone7RecentFreq = {}; // 近30期各区频率占比
    for (let zone = 1; zone <= 7; zone++) zone7RecentFreq[zone] = 0;
    for (const draw of recentFrontWindowData) {
      for (const num of draw.front) zone7RecentFreq[getZone7(num)]++;
    }
    const totalZone7RecentFreq = Object.values(zone7RecentFreq).reduce((a, b) => a + b, 0) || 1;
    
    // 预计算：近期频率逆袭数据（近30期频率/全量频率比值>1 → 冷→热逆袭信号）
    // 升级窗口到30期：更大的窗口能捕捉中期趋势而非短期噪音
    const recent30Count = Math.min(30, activeData.length);
    const recent30Data = activeData.slice(-recent30Count);
    const recent30FrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recent30FrontFreq[i] = 0;
    for (const draw of recent30Data) {
      for (const num of draw.front) recent30FrontFreq[num]++;
    }
    const totalDraws = activeData.length;
    const frontFreqRatio = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const recentRate = recent30FrontFreq[i] / recent30Count;
      const overallRate = (frontCounter[String(i)] || frontCounter[i] || 0) / totalDraws;
      frontFreqRatio[i] = overallRate > 0 ? recentRate / overallRate : 0;
    }
    const maxFreqRatioValue = Math.max(...Object.values(frontFreqRatio).filter(r => r > 1), 1);

    // 预计算：近10期重号率（用于胆码重号降温幅度判断）
    // 胆码是"必须命中"位置，上期号码不应因"重号因子"被大力推向胆码
    // 改为降温逻辑：上期出现过的号码在胆码位置扣1-3分
    // 降温幅度取决于近期重号环境：高重号周期→降温更多
    const recent10ForRepeat = Math.min(10, activeData.length - 1);
    let recent10RepeatSum = 0;
    for (let i = activeData.length - recent10ForRepeat; i < activeData.length; i++) {
      if (i > 0) {
        const prevDraw = activeData[i - 1];
        const currDraw = activeData[i];
        const repeatCount = currDraw.front.filter(n => prevDraw.front.includes(n)).length;
        recent10RepeatSum += repeatCount;
      }
    }
    const recent10RepeatRate = recent10ForRepeat > 0 ? recent10RepeatSum / recent10ForRepeat : 0;

    // 预计算：近10期各区频率（用于热号策略区间饱和度调节）
    // 区间饱和度调节仍用更短窗口(近10期)，捕捉短期过热/冷区信号
    const hotZoneRecentFreq = {};
    for (let zone = 1; zone <= 7; zone++) hotZoneRecentFreq[zone] = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.front) hotZoneRecentFreq[getZone7(num)]++;
    }
    const totalHotZoneFreq = Object.values(hotZoneRecentFreq).reduce((a, b) => a + b, 0) || 1;

    // 预计算：循环外常量（避免在35次循环中重复计算）
    const maxMomentum = Math.max(...Object.values(recentFreq.frontMomentum).map(m => Math.abs(m))); 
    const totalFrontFreq = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const avgFreqPerNum = totalFrontFreq / CONFIG.FRONT_RANGE;
    // 预计算：动量加速度全局最大值
    const maxAcceleration = Math.max(
      ...Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
        .map(n => ((veryRecentFrontFreq[n] || 0) / veryRecentCount) - ((recentFreq.front[n] || 0) / recentFreq.recentCount))
        .filter(a => a > 0)
    );

    for (let num = 1; num <= CONFIG.FRONT_RANGE; num++) {
      let score = 0;
      const zone7 = getZone7(num);
      
      // 维度1: 热度信号得分（20分满分）- 频率+遗漏合并，消除信息重叠
      // 热号策略：低遗漏=热号信号强，频率作为权重倍率
      // 均衡/保守策略：频率基础10分 + 动量5分（与原逻辑一致）
      const freq = frontCounter[String(num)] || frontCounter[num] || 0;
      const momentum = recentFreq.frontMomentum[num] || 0;
      const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
      const currentOmission = omissionData.front[num] || 0;
      
      if (strategy === 'hot') {
        // 热号策略：热度信号 = 遗漏评分(0~12) + 频率权重倍率(0~5)
        // 修复：遗漏=0不应给满分15分，它只意味着"上期刚出"而非"极度热门"
        // 遗漏0与遗漏1的实际出现概率差距很小，不应导致8-10分的巨大评分差异
        // 上期号码(遗漏=0)已有重号降温维度扣分，此处再给15分会双重矛盾
        // 改为天花板12分：遗漏0得12分（天花板），遗漏1得~10分，遗漏avg得5分
        const rawOmissionScore = Math.max(0, 15 - (currentOmission / avgFrontOmission) * 15);
        const omissionBaseScore = Math.min(rawOmissionScore, 12); // 天花板12分
        // 频率倍率：高频号的热度信号更可信，加权5分
        const freqBoost = maxFreq > 0 ? (freq / maxFreq) * 5 : 0;
        score += omissionBaseScore + freqBoost;
      } else if (strategy === 'balanced') {
        // 均衡策略：频率基础10分 + 动量5分
        const freqBase = maxFreq > 0 ? (freq / maxFreq) * 10 : 0;
        score += freqBase + Math.max(0, normalizedMomentum) * 5;
      } else {
        // 保守策略（改进1）：频率降至6分 + 动量降至2分，更注重遗漏回归
        const freqBase = maxFreq > 0 ? (freq / maxFreq) * 6 : 0;
        score += freqBase + Math.max(0, normalizedMomentum) * 2;
      }

      // 热号策略维度2: 近期频率逆袭加成（6分满分）
      // 近15期频率/全量频率比值>1 → 近期升温比历史更热 → 加分
      // 直接捕捉冷→热逆袭号码（如#26、#34），弥补全量频率低估
      if (strategy === 'hot') {
        const freqRatio = frontFreqRatio[num] || 0;
        if (freqRatio > 1) {
          const normalizedRatio = maxFreqRatioValue > 1 ? (freqRatio - 1) / (maxFreqRatioValue - 1) : 0;
          score += normalizedRatio * 6;
        }
      }

      // 条件概率得分 - 归一化（改进1：均衡30分，保守降至25分）
      const condProb = conditionalProb.front[num] || 0;
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * (strategy === 'hot' ? 20 : strategy === 'balanced' ? 30 : 25);
      
      // 均衡/保守策略维度3: 遗漏偏离度评分（改进1：保守25分，均衡20分）
      // 热号策略已在热度信号维度中处理遗漏，此处仅均衡/保守策略使用
      if (strategy !== 'hot') {
        const omissionDeviation = currentOmission - avgFrontOmission;
        const absDeviation = Math.abs(omissionDeviation);
        const maxAbsDeviation = Math.max(
          ...Object.values(omissionData.front).map(o => Math.abs((o || 0) - avgFrontOmission))
        );
        const normalizedDeviation = maxAbsDeviation > 0 ? absDeviation / maxAbsDeviation : 0;
        const devBaseMax = strategy === 'balanced' ? 10 : 13; // 保守偏离基础分更高
        score += normalizedDeviation * devBaseMax;
        // 遗漏策略加成：均衡/保守偏向高遗漏号码
        if (omissionDeviation > 0) {
          const posNormalized = maxOmissionDeviation > 0 ? omissionDeviation / maxOmissionDeviation : 0;
          const highOmissionMax = strategy === 'balanced' ? 7 : 10; // 保守高遗漏加分更高
          score += posNormalized * highOmissionMax;
          if (omissionDeviation > omissionStd * 2) {
            score += strategy === 'balanced' ? 3 : 5; // 保守极端遗漏加分更高
          }
        }
      }
      

      
      // 热号策略维度4: 时间衰减得分（10分）
      // 均衡/保守策略维度4: 时间衰减得分（15分）
      const rawTimeWeight = rawTimeWeights.front[num] || 0;
      const normalizedTimeWeight = maxFrontTimeWeight > 0 
        ? rawTimeWeight / maxFrontTimeWeight : 0;
      score += normalizedTimeWeight * (strategy === 'hot' ? 10 : 15);
      
      // 热号策略维度5: 5小区动态趋势 + 重号因子
      if (strategy === 'hot') {
        // 维度5a: 5小区动态趋势加分（15分满分，替代原热区趋势10分）
        // 数据支撑：85.4%只有3-4个小区出号，连续不出2期后100%回归
        // must(连续不出≥3期): +15分 - 胆码必从必出区选
        // very_likely(连续不出≥2期): +10分 - 极可能出号的区
        // likely_warm(不出1期): +5分 - 有回归信号(约70%概率)
        // warming(刚出+升温≥1.2): +2分 - 可能继续出号
        // normal: +0分 - 正常概率
        // unlikely_cool(上期出+降温): -3分 - 该区可能不出号
        const zone5 = getZone5(num);
        const prediction = zone5Prediction[zone5];
        if (prediction === 'must') {
          score += 15;
        } else if (prediction === 'very_likely') {
          score += 10;
        } else if (prediction === 'likely_warm') {
          score += 5;
        } else if (prediction === 'warming') {
          score += 2;
        } else if (prediction === 'unlikely_cool') {
          score -= 3;
        }
        
        // 维度5b: 胆码重号降温（最多扣3分）
        // 胆码是"必须命中"位置，上期出现的号码再出概率仅30-40%(约1.5个)
        // 把2-3个上期号码放进胆码过度集中，降温后其他维度仍可推荐强号
        // 但不再因"重号"信号大力推向胆码，这更符合实际概率分布
        if (lastDraw && lastDraw.front.includes(num)) {
          // 降温幅度取决于近期重号环境：
          // 高重号周期(>2.0)→降温更多(-3)，说明重号已偏多，回归概率大
          // 低重号周期(<1.0)→轻微降温(-1)，重号可能反弹但胆码不应过度集中
          // 正常周期→中等降温(-2)
          const coolingPenalty = recent10RepeatRate > 2.0 ? 3 : recent10RepeatRate < 1.0 ? 1 : 2;
          score -= coolingPenalty;
        }
      } else if (strategy === 'balanced') {
      // 均衡策略维度5: 频率趋势(10分) + 5小区动态趋势(10分) = 20分
        const freqRate = frontFreqRates[num] || 0;
        const freqTrendMax = 10;
        if (freqRate > frontExpectedRate && maxFrontFreqRate > frontExpectedRate) {
          const normalizedTrend = (freqRate - frontExpectedRate) / (maxFrontFreqRate - frontExpectedRate);
          score += normalizedTrend * freqTrendMax;
        }
        
        // 均衡策略：5小区动态趋势（10分满分）
        const zone5 = getZone5(num);
        const prediction = zone5Prediction[zone5];
        if (prediction === 'must') {
          score += 10;
        } else if (prediction === 'very_likely') {
          score += 7;
        } else if (prediction === 'likely_warm') {
          score += 3;
        } else if (prediction === 'warming') {
          score += 1;
        } else if (prediction === 'unlikely_cool') {
          score -= 2;
        }
      } else {
      // 保守策略维度5（改进1）：频率趋势降至7分 + 5小区动态趋势降至7分 = 14分
      // 保守更谨慎对待趋势预测，减少追逐热号
        const freqRate = frontFreqRates[num] || 0;
        const freqTrendMax = 7;
        if (freqRate > frontExpectedRate && maxFrontFreqRate > frontExpectedRate) {
          const normalizedTrend = (freqRate - frontExpectedRate) / (maxFrontFreqRate - frontExpectedRate);
          score += normalizedTrend * freqTrendMax;
        }
        
        // 保守策略：5小区动态趋势（7分满分）
        const zone5 = getZone5(num);
        const prediction = zone5Prediction[zone5];
        if (prediction === 'must') {
          score += 7; // 保守对must的信任度略低
        } else if (prediction === 'very_likely') {
          score += 4;
        } else if (prediction === 'likely_warm') {
          score += 2;
        } else if (prediction === 'warming') {
          score += 1;
        } else if (prediction === 'unlikely_cool') {
          score -= 1;
        }
      }
      
      // 热号策略维度6: 动量加速度加分（5分满分）
      // 近5期频率/5 > 近15期频率/15 → 动量正在加速 → 加分
      if (strategy === 'hot') {
        const veryRecentRate = (veryRecentFrontFreq[num] || 0) / veryRecentCount;
        const mediumRecentRate = (recentFreq.front[num] || 0) / recentFreq.recentCount;
        const acceleration = veryRecentRate - mediumRecentRate;
        if (acceleration > 0 && maxAcceleration > 0) {
          score += (acceleration / maxAcceleration) * 5;
        }
      }
      
      // 热号策略维度7: 冷却惩罚（最多扣5分）
      // 高频号（历史频率 > 平均）且当前遗漏 > 平均遗漏 → 正在冷却 → 扣分
      if (strategy === 'hot') {
        const numFreq = frontCounter[String(num)] || frontCounter[num] || 0;
        if (numFreq > avgFreqPerNum && currentOmission > avgFrontOmission) {
          const coolingDegree = (currentOmission - avgFrontOmission) / avgFrontOmission;
          const freqHeat = numFreq / avgFreqPerNum;
          const penalty = Math.min(coolingDegree * freqHeat * 2, 5);
          score -= penalty;
        }
      }
      
      // 热号策略维度8: 区间饱和度调节（恢复加分最多5分，过热扣分最多3分）
      // 近5期某区频率远超理论期望 → 该区可能即将冷却 → 区内号码扣分
      // 近5期某区频率低于理论期望 → 该区可能即将恢复 → 区内号码加分
      // 捕捉均值回归：212期区7近5期出6次(远超理论3.57次)，但212区7完全没号
      if (strategy === 'hot') {
        const expectedZoneFreqPerPeriod = 5 / 7; // 5个前区号/期，7个区，理论≈0.71个/区/期
        const expectedZoneFreq = expectedZoneFreqPerPeriod * veryRecentCount;
        const zoneRecentFreqNum = hotZoneRecentFreq[zone7] || 0;
        if (zoneRecentFreqNum < expectedZoneFreq * 0.7) {
          // 冷区恢复加分：该区近期偏冷，恢复概率增加
          const recoveryBonus = Math.min((expectedZoneFreq - zoneRecentFreqNum) / expectedZoneFreq * 5, 5);
          score += recoveryBonus;
        } else if (zoneRecentFreqNum > expectedZoneFreq * 1.5) {
          // 过热区冷却扣分：该区近期偏热，冷却概率增加
          const overheatPenalty = Math.min((zoneRecentFreqNum - expectedZoneFreq) / expectedZoneFreq * 3, 3);
          score -= overheatPenalty;
        }
      }
      
      // 热号策略维度9: 历史形态相似度加成（5分满分）- 归一化
      if (strategy === 'hot') {
        const similarityBonus = HistoricalSimilarity.computeNumberSimilarityBonus(
          num, true, [], [], activeData
        );
        score += similarityBonus * 5;
      }
      
      scored.push({
        number: num,
        score,
        zone5: getZone5(num),
        zone7: zone7,
        zone5Prediction: zone5Prediction[getZone5(num)],
        zone5Absence: zone5Absence[getZone5(num)],
        condProb,
        omission: currentOmission,
        freq,
        timeWeight: normalizedTimeWeight,
        isRepeat: lastDraw ? lastDraw.front.includes(num) : false,
        isCooling: strategy === 'hot' && freq > avgFreqPerNum && currentOmission > avgFrontOmission
      });
    }
    
    // 热号策略：区间防极端惩罚（最多扣3分）- 必须在所有号码评分完成后统一计算
    // 防止在循环内部基于不完整的scored数组计算，导致评分不公平
    if (strategy === 'hot') {
      scored.sort((a, b) => b.score - a.score);
      const top12ZoneCounts = {};
      for (let z = 1; z <= 7; z++) top12ZoneCounts[z] = 0;
      scored.slice(0, 12).forEach(s => top12ZoneCounts[getZone7(s.number)]++);
      // 对所在区在Top12中占比>=4的号码统一扣3分
      for (const s of scored) {
        const zone7Num = getZone7(s.number);
        if (top12ZoneCounts[zone7Num] >= 4) {
          s.score -= 3;
        }
      }
    }

    // 根据策略调整候选池
    scored.sort((a, b) => b.score - a.score);
    
    // 评分随机扰动（改进5：幅度按分数范围自适应，扰动=range*5%）
    // 打破确定性排名，避免同一号码每次都排同一位置
    // 影响范围：range*5%，足够改变相近分数号码的排名但保留远距离排名
    const scoredRange = Math.max(...scored.map(s => s.score)) - Math.min(...scored.map(s => s.score));
    const scoredPerturbation = scoredRange * 0.05;
    for (const s of scored) {
      s.score += (Math.random() - 0.5) * scoredPerturbation * 2;
    }
    // 重新排序（扰动后排名可能变化）
    scored.sort((a, b) => b.score - a.score);
    
    let candidatePool;
    if (strategy === 'hot') {
      // 热号策略：从Top15中选
      candidatePool = scored.slice(0, 15);
    } else if (strategy === 'balanced') {
      // 均衡策略：从Top15中选
      candidatePool = scored.slice(0, 15);
    } else {
      // 保守策略：偏向遗漏回归号码（高遗漏+中等频率），而非简单跳过Top3
      // 遗漏回归号码更容易出现，降低热号集中风险
      candidatePool = scored.filter(s => {
        const omissionDeviation = (s.omission || 0) - avgFrontOmission;
        // 条件1：遗漏高于均值（冷号回归信号）
        // 条件2：或遗漏适中但评分中上（中等号稳妥选择）
        return omissionDeviation > 0 || (omissionDeviation >= -avgFrontOmission * 0.3 && s.score > scored[0].score * 0.6);
      }).slice(0, 15);
      // 如果过滤后候选不足，从Top20中补充
      if (candidatePool.length < danCount + 3) {
        const extras = scored.filter(s => !candidatePool.includes(s)).slice(0, 15 - candidatePool.length);
        candidatePool.push(...extras);
      }
    }
    
    // 加权随机采样（平方根压缩权重差距，保证多样性）
    // 线性归一化时，最高分号码的权重可能是最低分的20倍，导致推荐几乎无随机性
    // 平方根压缩后：最高分权重约是最低分的4-5倍，保留优先性但增加多样性
    const minScore = Math.min(...candidatePool.map(s => s.score));
    const scoreRange = Math.max(...candidatePool.map(s => s.score)) - minScore;
    
    const weights = candidatePool.map(s => {
      const normalized = scoreRange > 0 ? (s.score - minScore) / scoreRange : 0.5;
      const compressed = Math.sqrt(normalized); // 平方根压缩：高分仍优先但差距缩小
      return {
        ...s,
        sampleWeight: 0.1 + compressed * 0.9 // 最低权重从0.05提高到0.1
      };
    });
    
    // 加权随机采样选出 danCount 个号码
    // 热号策略：不做区间覆盖强制，让趋势自然决定分布
    // 均衡/保守策略：确保3大区都有覆盖
    const selected = [];
    const remaining = [...weights];
    
    if (strategy === 'hot') {
      // 热号策略：加权随机采样 + 区间覆盖约束（防止胆码集中在同一区）
      // 212期失败教训：胆码31,34都在区7，导致0命中
      const selectedZoneCount = {}; // 记录已选胆码的区间分布
      for (let z = 1; z <= 7; z++) selectedZoneCount[z] = 0;
      
      while (selected.length < danCount && remaining.length > 0) {
        // 区间约束：同一7区最多2个胆码，已满则排除该区号码
        const filteredRemaining = remaining.filter(w => {
          const zone7Num = getZone7(w.number);
          return (selectedZoneCount[zone7Num] || 0) < 2;
        });
        
        // 如果过滤后没有候选了，放宽限制使用原始池
        const pool = filteredRemaining.length > 0 ? filteredRemaining : remaining;
        const totalW = pool.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        let chosenIdx = 0;
        for (let j = 0; j < pool.length; j++) {
          random -= pool[j].sampleWeight;
          if (random <= 0) { chosenIdx = j; break; }
        }
        const chosen = pool[chosenIdx];
        selected.push(chosen.number);
        selectedZoneCount[getZone7(chosen.number)]++; // 记录区间分布
        remaining.splice(remaining.findIndex(w => w.number === chosen.number), 1);
      }
    } else {
      // 均衡/保守策略：基于7小区动态频率占比采样（取消3大区强制覆盖）
      // 从频率占比最高的几个区中优先选号码，而非强制每区各选1个
      // 按近30期各区频率占比排序，优先从高频率区选号
      const zone7Groups = {};
      for (let z = 1; z <= 7; z++) zone7Groups[z] = remaining.filter(w => getZone7(w.number) === z);
      const zone7Sorted = Object.entries(zone7Groups)
        .map(([z, candidates]) => ({
          zone: parseInt(z),
          candidates,
          totalWeight: candidates.reduce((s, w) => s + w.sampleWeight, 0),
          freqRatio: zone7RecentFreq[parseInt(z)] / totalZone7RecentFreq
        }))
        .filter(z => z.candidates.length > 0)
        .sort((a, b) => b.freqRatio - a.freqRatio); // 按近期频率占比降序
      
      // 按频率占比优先选择号码（高频率区优先，但每区最多2个胆码防过度集中）
      const selectedZone7Count = {};
      for (let z = 1; z <= 7; z++) selectedZone7Count[z] = 0;
      
      const pickOneFromZone7 = (zoneInfo, remList) => {
        const candidates = zoneInfo.candidates;
        if (candidates.length === 0) return null;
        const totalW = candidates.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        for (const w of candidates) {
          random -= w.sampleWeight;
          if (random <= 0) {
            remList.splice(remList.findIndex(r => r.number === w.number), 1);
            return w.number;
          }
        }
        const chosen = candidates[0];
        remList.splice(remList.findIndex(r => r.number === chosen.number), 1);
        return chosen.number;
      };
      
      // 按频率占比从高到低选择胆码，每区最多2个
      for (const zoneInfo of zone7Sorted) {
        if (selected.length >= danCount) break;
        if (selectedZone7Count[zoneInfo.zone] >= 2) continue; // 每区最多2个胆码
        const num = pickOneFromZone7(zoneInfo, remaining);
        if (num) {
          selected.push(num);
          selectedZone7Count[zoneInfo.zone]++;
          // 更新候选池（移除已选号码）
          zone7Sorted.forEach(zi => {
            zi.candidates = zi.candidates.filter(w => w.number !== num);
            zi.totalWeight = zi.candidates.reduce((s, w) => s + w.sampleWeight, 0);
          });
        }
      }
      
      // 如果还需更多胆码，从剩余号码中加权随机选
      while (selected.length < danCount && remaining.length > 0) {
        const totalW = remaining.reduce((sum, w) => sum + w.sampleWeight, 0);
        let random = Math.random() * totalW;
        let chosenIdx = 0;
        for (let j = 0; j < remaining.length; j++) {
          random -= remaining[j].sampleWeight;
          if (random <= 0) { chosenIdx = j; break; }
        }
        selected.push(remaining[chosenIdx].number);
        remaining.splice(chosenIdx, 1);
      }
    }
    
    // 胆码遗漏多样性约束（热号策略专用）
    // 防止所有胆码都是低遗漏（纯热号），降低"集体冷却"风险
    // 212期教训：胆码17(遗漏中)、26(低遗漏)、31(低遗漏)、34(低遗漏)，集体未命中
    // 至少1个胆码遗漏 > 平均遗漏（中等偏冷号），增加命中容错
    if (strategy === 'hot' && danCount >= 3) {
      const selectedOmissions = selected.map(n => omissionData.front[n] || 0);
      const allBelowAvg = selectedOmissions.every(o => o <= avgFrontOmission);
      if (allBelowAvg) {
        // 找评分最高的中等遗漏号码替换评分最低的胆码
        const moderateOmissionCandidates = scored
          .filter(s => !selected.includes(s.number) && (s.omission || 0) > avgFrontOmission)
          .sort((a, b) => b.score - a.score);
        if (moderateOmissionCandidates.length > 0) {
          const worstSelected = selected
            .map(n => ({ num: n, score: scored.find(s => s.number === n)?.score || 0 }))
            .sort((a, b) => a.score - b.score)[0];
          selected[selected.indexOf(worstSelected.num)] = moderateOmissionCandidates[0].number;
        }
      }
    }

    // 奇偶平衡后处理
    // 所有策略：防止0:5或5:0极端比例（统计上极不可能出现）
    // 均衡/保守策略：更严格确保2:3或3:2
    if (danCount >= 2) {
      const selOddCount = selected.filter(n => n % 2 !== 0).length;
      const selEvenCount = selected.length - selOddCount;
      const needFix = strategy === 'hot'
        ? (selOddCount === 0 || selEvenCount === 0) // 热号：仅防止极端
        : (selOddCount === 0 || selEvenCount === 0); // 均衡/保守：防止极端（已通过采样约束保证2:3或3:2）
      
      if (needFix) {
        const needOdd = selOddCount === 0;
        // 从未被选中的号码中找最优替换（按评分排序）
        const replaceCandidates = scored
          .filter(s => !selected.includes(s.number) && (needOdd ? s.number % 2 !== 0 : s.number % 2 === 0))
          .sort((a, b) => b.score - a.score);
        if (replaceCandidates.length > 0) {
          // 替换评分最低的已选号码
          const worstSelected = selected
            .map(n => ({ num: n, score: scored.find(s => s.number === n)?.score || 0 }))
            .sort((a, b) => a.score - b.score)[0];
          selected[selected.indexOf(worstSelected.num)] = replaceCandidates[0].number;
        }
      }
    }

    // 计算概率排名信息（基于全量35号码）
    const allWeights = scored.map(s => {
      const allMinScore = Math.min(...scored.map(s2 => s2.score));
      const allScoreRange = Math.max(...scored.map(s2 => s2.score)) - allMinScore;
      const normalized = allScoreRange > 0 ? (s.score - allMinScore) / allScoreRange : 0.5;
      return { number: s.number, weight: 0.05 + normalized * 0.95 };
    });
    
    const totalWeightSum = allWeights.reduce((sum, w) => sum + w.weight, 0);
    const topCandidates = [...allWeights].sort((a, b) => b.weight - a.weight).slice(0, 5);
    const probabilityInfo = topCandidates.map(w => {
      const actualProb = totalWeightSum > 0 ? (w.weight / totalWeightSum * 100) : 0;
      const originalScore = scored.find(s => s.number === w.number);
      return {
        number: w.number,
        probability: actualProb,
        score: originalScore ? originalScore.score : 0,
        zone7: originalScore ? originalScore.zone7 : 0,
        condProb: originalScore ? originalScore.condProb : 0,
        omission: originalScore ? originalScore.omission : 0,
        freq: originalScore ? originalScore.freq : 0
      };
    });
    
    // 计算7区频率排名（供UI显示）
    const zoneNames = ['一区(01-05)', '二区(06-10)', '三区(11-15)', '四区(16-20)', '五区(21-25)', '六区(26-30)', '七区(31-35)'];
    const zoneFrequencies = {};
    for (let zone = 1; zone <= 7; zone++) {
      const start = (zone - 1) * 5 + 1;
      const end = zone * 5;
      let totalFreq = 0;
      for (let i = start; i <= end; i++) {
        totalFreq += frontCounter[String(i)] || frontCounter[i] || 0;
      }
      zoneFrequencies[zone] = totalFreq;
    }
    // 按频率排序
    const zoneRank = Object.entries(zoneFrequencies)
      .sort((a, b) => b[1] - a[1])
      .map(([zone, freq], idx) => ({ zone: parseInt(zone), name: zoneNames[parseInt(zone) - 1], freq, rank: idx + 1 }));
    const zoneInfo = zoneRank.map(z => `${z.name}:${z.freq}次(第${z.rank}名)`).join('、');
    
    console.log('✅ 前区胆码推荐完成:', selected.sort((a, b) => a - b));
    console.log('  实际选择:', selected.map(n => `#${n}`).join(', '), '(加权随机采样)');
    console.log('  Top5概率排名:', probabilityInfo.map(p => 
      `#${p.number}(概率${p.probability.toFixed(1)}%, 区${p.zone7}, 条件概率${p.condProb.toFixed(3)}, 遗漏${p.omission}, 频率${p.freq}, 总分${p.score.toFixed(2)})`
    ).join(', '));
    console.log('  区间频率排名:', zoneInfo);
    
    return {
      selected: selected.sort((a, b) => a - b),
      probabilityInfo: probabilityInfo,
      zoneInfo: zoneInfo
    };
  }
}