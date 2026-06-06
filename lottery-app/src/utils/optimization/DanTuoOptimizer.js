/**
 * 胆拖优化器
 * 负责胆拖玩法的拖码选择优化、间距控制、区间覆盖等
 */

import { CONFIG } from '../core/Config.js';
import { HistoricalSimilarity } from '../analysis/HistoricalSimilarity.js';

export class DanTuoOptimizer {
  constructor(options) {
    // 支持两种调用方式：对象参数或位置参数
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      // 对象参数模式（新）
      this.frequencyAnalyzer = options.frequencyAnalyzer;
      this.omissionCalculator = options.omissionCalculator;
      this.trendAnalyzer = options.trendAnalyzer;
      this.correlationAnalyzer = options.correlationAnalyzer;
      this.conditionalProbability = options.conditionalProbability;
      this.getActiveData = options.getActiveData;
      this.frontNumbers = options.frontNumbers;
      this.backNumbers = options.backNumbers;
      this.historyData = null; // 通过 getActiveData 动态获取
    } else {
      // 位置参数模式（旧版兼容）
      this.historyData = arguments[0];
      this.getActiveData = arguments[1];
      this.frequencyAnalyzer = arguments[2];
      this.correlationAnalyzer = arguments[3];
    }
  }

  /**
   * 融合区间频率的拖码选择优化
   * @param {number[]} danNumbers - 胆码数组
   * @param {number[]} candidateNumbers - 候选拖码数组
   * @param {number} targetCount - 目标拖码数量
   * @param {string} strategy - 策略：hot/balanced/conservative
   * @returns {number[]} 优化后的拖码数组
   */
  optimizeTuoSelectionWithZoneFrequency(danNumbers, candidateNumbers, targetCount = 10, strategy = 'balanced') {
    console.log(' 方案2：拖码选择优化（融合区间频率）');

    // 防御性检查
    if (!danNumbers || !Array.isArray(danNumbers) || danNumbers.length === 0) {
      console.warn('⚠️ 胆码为空，降级到普通优化');
      return this.optimizeTuoSelection(danNumbers || [], candidateNumbers, targetCount);
    }

    if (!candidateNumbers || candidateNumbers.length === 0) {
      return [];
    }

    // 定义7区间
    const getZone = (num) => {
      if (num <= 5) return 1;
      if (num <= 10) return 2;
      if (num <= 15) return 3;
      if (num <= 20) return 4;
      if (num <= 25) return 5;
      if (num <= 30) return 6;
      return 7;
    };

    // 分析胆码的区间分布
    const danZoneCount = {};
    danNumbers.forEach(num => {
      const zone = getZone(num);
      danZoneCount[zone] = (danZoneCount[zone] || 0) + 1;
    });

    console.log('  胆码区间分布:', danZoneCount);

    // 获取区间频率数据
    const [frontCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const recentFreq = this.frequencyAnalyzer.analyzeRecentFrequency();

    // 计算每个区间的总频率
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

    console.log('  区间频率:', zoneFrequencies);

    // 计算每个候选拖码的综合评分（10~12维度）
    // 均衡策略10维度：频率+动量15 + 区间分布12 + 区间升温趋势8 + 近期频率逆袭5 + 条件概率25 + 遗漏偏离度15 + 关联性10 + 协同性10 + 历史相似度5 + 间距模式5 + 冷却惩罚-3 = 96
    // 保守策略10维度：频率+动量15 + 区间分布12 + 区间升温趋势5 + 近期频率逆袭5 + 条件概率25 + 遗漏偏离度15 + 关联性10 + 协同性10 + 历史相似度5 + 间距模式5 + 冷却惩罚-2 = 95
    // 热号策略12维度：热度信号20 + 近期频率逆袭6 + 条件概率18 + 热区趋势10 + 重号因子(自适应5-10) + 动量加速5 + 关联性10 + 协同性7 + 历史相似度3 + 间距模式5 + 区间防极端-3 + 冷却惩罚-5 = 81~91
    // 获取条件概率和遗漏数据
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const omission = this.omissionCalculator.calculateOmission();
    const correlationData = this.correlationAnalyzer.calculateNumberCorrelationWithTimeDecay();
    const avgFrontOmission = this.omissionCalculator.getAverageOmission('front');

    // 热号策略专用数据
    const repeatAnalysis = this.trendAnalyzer.analyzeRepeatNumbers();
    const activeData = this.getActiveData();
    const lastDraw = activeData.length > 0 ? activeData[activeData.length - 1] : null;
    
    // 热区趋势：近5期各区频率占比
    const veryRecentCount = Math.min(5, activeData.length);
    const veryRecentData = activeData.slice(-veryRecentCount);
    const hotZoneRecentFreq = {};
    for (let zone = 1; zone <= 7; zone++) hotZoneRecentFreq[zone] = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.front) hotZoneRecentFreq[getZone(num)]++;
    }
    const totalHotZoneFreq = Object.values(hotZoneRecentFreq).reduce((a, b) => a + b, 0) || 1;
    
    // 动量加速度：近5期频率
    const veryRecentFrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) veryRecentFrontFreq[i] = 0;
    for (const draw of veryRecentData) {
      for (const num of draw.front) veryRecentFrontFreq[num]++;
    }

    // 近期频率逆袭数据（优化1）：对比近15期频率与全量频率
    // 近15期频率远高于全量频率的号码 → 冷→热逆袭信号 → 加分
    const recent15Count = Math.min(15, activeData.length);
    const recent15Data = activeData.slice(-recent15Count);
    const recent15FrontFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recent15FrontFreq[i] = 0;
    for (const draw of recent15Data) {
      for (const num of draw.front) recent15FrontFreq[num]++;
    }
    const totalDraws = activeData.length;
    const frontFreqRatio = {}; // 近期频率 / 全量频率 的比值
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const recentRate = recent15FrontFreq[i] / recent15Count;
      const overallRate = (frontCounter[String(i)] || frontCounter[i] || 0) / totalDraws;
      frontFreqRatio[i] = overallRate > 0 ? recentRate / overallRate : 0;
    }
    // 归一化：只取 ratio > 1 的号码，计算最大ratio用于归一化
    const maxFreqRatioValue = Math.max(...Object.values(frontFreqRatio).filter(r => r > 1), 1);

    // 重号因子自适应数据（优化4）：根据近10期实际重号率调整权重
    // 期望前区重号率约1.5个/期(30%)，实际低于1.0时降低权重，高于2.0时增加
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
    // 自适应权重因子：低重号周期→0.5，正常→1.0，高重号周期→1.5
    const repeatWeightFactor = recent10RepeatRate < 1.0 ? 0.5 : recent10RepeatRate > 2.0 ? 1.5 : 1.0;
    console.log('  近10期前区重号率:', recent10RepeatRate.toFixed(2), '自适应因子:', repeatWeightFactor);

    // 归一化所需的统计量（提前计算避免重复）
    const maxFreq = Math.max(...Object.values(frontCounter));
    const maxCondProb = Math.max(...Object.values(conditionalProb.front));
    const allOmissionValues = Object.values(omission.front);
    const omissionStd = this.omissionCalculator.getOmissionStd('front');
    const maxPositiveDeviation = Math.max(...allOmissionValues.map(o => (o || 0) - avgFrontOmission).filter(d => d > 0));
    // 关联性归一化：先计算每个号码的原始关联性得分
    const rawCorrelationScores = candidateNumbers.map(tuoNum => {
      let corr = 0;
      const TIME_DECAY = 0.98;
      // 使用外层已获取的activeData，避免重复调用getActiveData
      const recentDraws = activeData.slice(-15);
      for (const dan of danNumbers) {
        const coOccurrence = correlationData.front[dan] && correlationData.front[dan][tuoNum] || 0;
        corr += coOccurrence;
        for (const draw of recentDraws) {
          if (draw.front.includes(dan) && draw.front.includes(tuoNum)) {
            const recencyIdx = recentDraws.indexOf(draw);
            corr += Math.pow(TIME_DECAY, recentDraws.length - recencyIdx);
          }
        }
      }
      return { number: tuoNum, corr };
    });
    const maxCorr = Math.max(...rawCorrelationScores.map(s => s.corr));

    // 预计算：map外常量（避免在每个候选号码中重复计算）
    const totalFrontFreq = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const avgFreqPerNum = totalFrontFreq / CONFIG.FRONT_RANGE;
    const sumTrend = this.trendAnalyzer.analyzeSumTrend();
    const spanAnalysis = this.trendAnalyzer.analyzeSpan();
    // 预计算：动量加速度全局最大值
    const maxAcceleration = Math.max(
      ...candidateNumbers.map(n => {
        const vr = (veryRecentFrontFreq[n] || 0) / veryRecentCount;
        const mr = (recentFreq.front[n] || 0) / (recentFreq.recentCount || 15);
        return vr - mr;
      }).filter(a => a > 0)
    );
    const currentDanSum = danNumbers.reduce((a, b) => a + b, 0);
    // 预计算：均衡/保守策略动量归一化常量
    const maxMomentum = Math.max(...Object.values(recentFreq.frontMomentum).map(m => Math.abs(m)));
    const tuoScores = candidateNumbers.map(tuoNum => {
      const zone = getZone(tuoNum);
      let score = 0;

      // 1. 热度信号得分（20分满分）- 频率+遗漏合并，消除信息重叠
      const freq = frontCounter[String(tuoNum)] || frontCounter[tuoNum] || 0;
      const currentOmission = omission.front[tuoNum] || 0;
      if (strategy === 'hot') {
        // 热号策略：低遗漏权重(0~15) + 频率可信度5分
        const omissionBaseScore = Math.max(0, 15 - (currentOmission / avgFrontOmission) * 15);
        const freqBoost = maxFreq > 0 ? (freq / maxFreq) * 5 : 0;
        score += omissionBaseScore + freqBoost;
      } else {
        // 均衡/保守策略：频率基础10分 + 动量5分（保持原逻辑，使用预计算的maxMomentum）
        const freqBase = maxFreq > 0 ? (freq / maxFreq) * 10 : 0;
        const momentum = recentFreq.frontMomentum[tuoNum] || 0;
        const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
        score += freqBase + Math.max(0, normalizedMomentum) * 5;
      }

      // 1b. 近期频率逆袭加成（优化1：热号6分，均衡/保守5分）- 归一化
      // 近15期频率/全量频率 比值>1 → 近期升温比历史更热 → 加分
      // 直接捕捉冷→热逆袭号码（如#26、#34），弥补全量频率对逆袭号的低估
      const freqRatio = frontFreqRatio[tuoNum] || 0;
      if (freqRatio > 1) {
        const normalizedRatio = maxFreqRatioValue > 1 ? (freqRatio - 1) / (maxFreqRatioValue - 1) : 0;
        score += normalizedRatio * (strategy === 'hot' ? 6 : 5);
      }

      // 2. 区间/热区评分
      // 热号：热区趋势10分 + 重号因子(自适应5-10分)
      // 均衡：区间分布12分 + 区间升温趋势8分
      // 保守：区间分布12分 + 区间升温趋势5分
      if (strategy === 'hot') {
        // 热区趋势加分（10分满分）：号码所在区近期频率占比越高→该区越热→加分
        const zoneRatio = totalHotZoneFreq > 0 ? hotZoneRecentFreq[zone] / totalHotZoneFreq : 0;
        const idealZoneRatio = 1 / 7;
        const hotZoneBonus = zoneRatio > idealZoneRatio
          ? Math.min((zoneRatio - idealZoneRatio) / (1 - idealZoneRatio) * 10, 10)
          : 0;
        score += hotZoneBonus;
        
        // 重号因子加分（优化4：自适应5-10分满分）：上期出现的号码加分
        // 低重号周期（近10期重号率<1.0）权重降为0.5，高重号周期权重升为1.5
        const repeatMaxScore = Math.min(10 * repeatWeightFactor, 10);
        if (lastDraw && lastDraw.front.includes(tuoNum)) {
          score += Math.min(repeatAnalysis.frontRepeatRate * 10 * repeatWeightFactor, repeatMaxScore);
        }
      } else {
        // 区间分布得分（12分满分，从20分降至12分，释放8分给区间升温趋势）
        const danInThisZone = danZoneCount[zone] || 0;
        const zoneFreqRank = Object.entries(zoneFrequencies)
          .sort((a, b) => b[1] - a[1])
          .findIndex(([z]) => parseInt(z) === zone);

        if (danInThisZone === 0) {
          if (zoneFreqRank < 4) score += 12;
          else if (zoneFreqRank < 6) score += 7;
          else score += 3;
        } else {
          score += 5 - danInThisZone * 1;
        }

        // 区间升温趋势加成（优化3：均衡8分，保守5分）- 近5期各区频率占比
        // 号码所在区近期频率占比超过理论均值越多 → 该区正在升温 → 加分
        const zoneRatio = totalHotZoneFreq > 0 ? hotZoneRecentFreq[zone] / totalHotZoneFreq : 0;
        const idealZoneRatio = 1 / 7;
        const trendMax = strategy === 'balanced' ? 8 : 5;
        if (zoneRatio > idealZoneRatio) {
          const trendBonus = Math.min((zoneRatio - idealZoneRatio) / (1 - idealZoneRatio) * trendMax, trendMax);
          score += trendBonus;
        }
      }

      // 3. 条件概率加成（热号18分，均衡/保守25分）- 归一化
      const condProb = conditionalProb.front[tuoNum] || 0;
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * (strategy === 'hot' ? 18 : 25);

      // 4. 遗漏偏离度评分（15分满分）- 仅均衡/保守策略
      // 热号策略已在热度信号维度中处理遗漏，此处仅均衡/保守策略使用
      if (strategy !== 'hot') {
        const omissionDeviation = currentOmission - avgFrontOmission;
        const absOmissionDeviation = Math.abs(omissionDeviation);
        const maxAbsDeviation = Math.max(
          ...Object.values(omission.front).map(o => Math.abs((o || 0) - avgFrontOmission))
        );
        const normalizedAbsDeviation = maxAbsDeviation > 0 ? absOmissionDeviation / maxAbsDeviation : 0;
        score += normalizedAbsDeviation * 5; // 偏离度基础分5分
        // 均衡/保守偏向高遗漏号码
        if (omissionDeviation > 0 && maxPositiveDeviation > 0) {
          score += (omissionDeviation / maxPositiveDeviation) * 7;
          if (omissionDeviation > omissionStd * 2) score += 3;
        }
      }

      // 5. 关联性加成（10分满分）- 归一化
      const rawCorr = rawCorrelationScores.find(s => s.number === tuoNum)?.corr || 0;
      const normalizedCorr = maxCorr > 0 ? rawCorr / maxCorr : 0;
      score += normalizedCorr * 10;

      // 6. 协同评分加成（热号7分，均衡/保守10分）- 与胆码的和值/跨度协调性
      // 和值协调：拖码加入后使总和接近历史均值（使用预计算的sumTrend/currentDanSum）
      const targetTotalSum = sumTrend.avgFrontSum;
      const sumWithTuo = currentDanSum + tuoNum;
      const sumDiff = Math.abs(sumWithTuo - targetTotalSum / 5 * (danNumbers.length + 1));
      const maxSumDiff = targetTotalSum * 0.5;
      const sumScoreMax = strategy === 'hot' ? 3 : 4;
      const sumScore = maxSumDiff > 0 ? Math.max(0, 1 - sumDiff / maxSumDiff) * sumScoreMax : 2;
      score += sumScore;

      // 奇偶协调：所有策略评估奇偶协调性（热号仅评估不强制，均衡/保守加分激励）
      const danOddCount = danNumbers.filter(n => n % 2 !== 0).length;
      const isOdd = tuoNum % 2 !== 0;
      const totalWithTuo = danNumbers.length + 1;
      const newOddCount = danOddCount + (isOdd ? 1 : 0);
      if (strategy === 'hot') {
        // 热号策略：仅评估极端情况（全奇或全偶时轻微扣分）
        if (newOddCount === 0 || newOddCount === totalWithTuo) {
          score -= 2; // 极端奇偶比轻微扣分
        }
      } else {
        // 均衡/保守策略：理想奇偶比加分
        const idealOddMin = Math.round(totalWithTuo * 0.4);
        const idealOddMax = Math.round(totalWithTuo * 0.6);
        if (newOddCount >= idealOddMin && newOddCount <= idealOddMax) {
          score += 3;
        } else if (Math.abs(newOddCount - totalWithTuo / 2) <= 1) {
          score += 1;
        }
      }

      // 跨度协调：拖码加入后使号码跨度合理（使用预计算的spanAnalysis）
      const allNumbersWithTuo = [...danNumbers, tuoNum];
      const spanWithTuo = Math.max(...allNumbersWithTuo) - Math.min(...allNumbersWithTuo);
      const spanDiff = Math.abs(spanWithTuo - spanAnalysis.avgFrontSpan);
      const maxSpanDiff = spanAnalysis.avgFrontSpan * 0.3;
      const spanScoreMax = strategy === 'hot' ? 2 : 3;
      const spanBonus = maxSpanDiff > 0 ? Math.max(0, 1 - spanDiff / maxSpanDiff) * spanScoreMax : 1;
      score += spanBonus;
      
      // 热号策略：动量加速度加分（5分满分）
      // 近5期动量 > 近15期动量 → 正在加速升温 → 加分
      if (strategy === 'hot') {
        const veryRecentRate = (veryRecentFrontFreq[tuoNum] || 0) / veryRecentCount;
        const mediumRecentRate = (recentFreq.front[tuoNum] || 0) / (recentFreq.recentCount || 15);
        const acceleration = veryRecentRate - mediumRecentRate;
        if (acceleration > 0 && maxAcceleration > 0) {
          score += (acceleration / maxAcceleration) * 5;
        }
      }
      
      // 所有策略：冷却惩罚（热号最多-5分，均衡-3分，保守-2分）
      // 高频号（历史频率 > 平均）且当前遗漏 > 平均遗漏 → 正在冷却 → 扣分
      // 使用预计算的avgFreqPerNum/currentOmission
      const numFreq = frontCounter[String(tuoNum)] || frontCounter[tuoNum] || 0;
      if (numFreq > avgFreqPerNum && currentOmission > avgFrontOmission) {
        const coolingDegree = (currentOmission - avgFrontOmission) / avgFrontOmission;
        const freqHeat = numFreq / avgFreqPerNum;
        const maxPenalty = strategy === 'hot' ? 5 : strategy === 'balanced' ? 3 : 2;
        const penalty = Math.min(coolingDegree * freqHeat * 2, maxPenalty);
        score -= penalty;
      }


      // 7. 历史形态相似度加成（热号3分，均衡/保守5分）- 归一化
      // 使用外层已获取的activeData，避免重复调用getActiveData
      const similarityBonus = HistoricalSimilarity.computeNumberSimilarityBonus(
        tuoNum, true, danNumbers, [], activeData
      );
      score += similarityBonus * (strategy === 'hot' ? 3 : 5);

      // 8. 号码间距模式加成（5分满分）- 独立性维度
      // 基于拖码与胆码之间差值的分布模式，与频率/遗漏/关联性低相关
      // 计算拖码与每个胆码的间距，检查是否符合历史常见的间距分布
      const gapsWithDan = danNumbers.map(dan => Math.abs(tuoNum - dan));
      // 历史前区5个号码的平均间距约7-8，每对号码的间距分布有规律
      // 间距在3-12范围内的号码更可能出现在合理的组合中
      const reasonableGapCount = gapsWithDan.filter(g => g >= 3 && g <= 12).length;
      // 与胆码的间距越合理（3-12范围），得分越高
      const gapScore = danNumbers.length > 0 ? (reasonableGapCount / danNumbers.length) * 5 : 2.5;
      score += gapScore;

      return {
        number: tuoNum,
        score,
        zone,
        freq,
        condProb,
        omission: currentOmission,
        corrBonus: rawCorr,
        similarityBonus,
        gapScore
      };
    });

    // 热号策略：区间防极端惩罚（最多扣3分）- 必须在所有号码评分完成后统一计算
    // 防止在map回调内基于不完整的tuoScores数组计算（会导致TDZ错误和评分不公平）
    if (strategy === 'hot') {
      tuoScores.sort((a, b) => b.score - a.score);
      const top15ZoneCounts = {};
      for (let z = 1; z <= 7; z++) top15ZoneCounts[z] = 0;
      tuoScores.slice(0, 15).forEach(s => top15ZoneCounts[s.zone]++);
      // 对所在区在Top15中占比>=4的号码统一扣3分
      for (const s of tuoScores) {
        if (top15ZoneCounts[s.zone] >= 4) {
          s.score -= 3;
        }
      }
    }

    // 按评分排序
    tuoScores.sort((a, b) => b.score - a.score);
    
    // 加权随机采样选择拖码（高分号码概率更高，但每次结果不同）
    // 第一步：给每个号码分配采样权重
    const minScore = Math.min(...tuoScores.map(s => s.score));
    const maxScore = Math.max(...tuoScores.map(s => s.score));
    const scoreRange = maxScore - minScore;
        
    const weightedCandidates = tuoScores.map(s => {
      const normalized = scoreRange > 0 ? (s.score - minScore) / scoreRange : 0.5;
      // 权重映射：最低10%概率，最高100%概率
      return { ...s, sampleWeight: 0.1 + normalized * 0.9 }; 
    });
        
    // 第二步：动态优先采样，考虑已选拖码的累积效果
    // 每选一个拖码后，评估当前组合质量，动态调整后续号码权重
    const selectedTuo = []; 
    const selectedNumbers = new Set(danNumbers);
    let consecutivePairs = 0;
    const remaining = [...weightedCandidates];
    
    // 动态权重调整函数：根据当前组合不足的维度，提升对应号码的权重
    // 热号策略：防止极端奇偶比（0:5或5:0），其余让趋势决定
    // 均衡/保守策略：补充奇偶和区间覆盖
    const adjustDynamicWeight = (candidate, currentDan, currentTuo) => {
      const allSelected = [...currentDan, ...currentTuo];
      let bonus = 1.0; // 基础权重倍率
          
      // 所有策略：防止极端奇偶比
      const currentOdd = allSelected.filter(n => n % 2 !== 0).length;
      const currentEven = allSelected.length - currentOdd;
      const targetSize = 5;
      
      // 热号策略：仅防止全奇或全偶（极端情况）
      if (strategy === 'hot' && allSelected.length >= 2) {
        if ((currentOdd === 0 && candidate.number % 2 !== 0) ||
            (currentEven === 0 && candidate.number % 2 === 0)) {
          bonus += 0.5; // 防止极端奇偶比
        }
      }
      
      // 均衡/保守策略：完整的奇偶和区间均衡
      if (strategy !== 'hot') {
        if (allSelected.length < targetSize) {
          const idealOddMin = Math.round(targetSize * 0.4);
          const idealOddMax = Math.round(targetSize * 0.6);
          if (currentOdd < idealOddMin && candidate.number % 2 !== 0) {
            bonus += 0.5;
          } else if (currentEven < idealOddMin && candidate.number % 2 === 0) {
            bonus += 0.5;
          }
        }
            
        const coveredZones = new Set(allSelected.map(n => getZone(n)));
        if (allSelected.length < targetSize && coveredZones.size < 4) {
          const candidateZone = getZone(candidate.number);
          if (!coveredZones.has(candidateZone)) {
            bonus += 0.3;
          }
        }
      }
          
      return candidate.sampleWeight * bonus;
    };
        
    while (selectedTuo.length < targetCount && remaining.length > 0) {
      // 动态权重：根据当前组合质量调整各号码权重
      const dynamicWeights = remaining.map(w => ({
        ...w,
        dynamicWeight: adjustDynamicWeight(w, danNumbers, selectedTuo)
      }));
      const totalWeight = dynamicWeights.reduce((sum, w) => sum + w.dynamicWeight, 0);
          
      // 加权随机选择
      let random = Math.random() * totalWeight;
      let chosenIdx = -1;
      for (let j = 0; j < dynamicWeights.length; j++) {
        random -= dynamicWeights[j].dynamicWeight;
        if (random <= 0) {
          chosenIdx = j;
          break;
        }
      }
      if (chosenIdx === -1) chosenIdx = dynamicWeights.length - 1;
          
      const chosen = remaining[chosenIdx];
      const num = chosen.number;
          
      // 连号检查
      let isConsecutive = false;
      for (const sel of selectedNumbers) {
        if (Math.abs(num - sel) === 1) {
          isConsecutive = true;
          break;
        }
      }
          
      // 允许最多1对连号，超出则跳过此号码
      if (isConsecutive && consecutivePairs >= 1) {
        remaining.splice(chosenIdx, 1); // 移除不合适的号码
        continue;
      }
          
      if (isConsecutive) consecutivePairs++; 
      selectedTuo.push(num);
      selectedNumbers.add(num);
      remaining.splice(chosenIdx, 1); // 移除已选号码
    }
        
    // 如果因为间距限制导致数量不足，放宽限制
    if (selectedTuo.length < targetCount) {
      console.log('  连号限制导致数量不足，放宽限制');
      const allRemaining = tuoScores.filter(s => !selectedNumbers.has(s.number));
      for (const item of allRemaining) {
        if (selectedTuo.length >= targetCount) break;
        selectedTuo.push(item.number);
        selectedNumbers.add(item.number);
      }
    }

    console.log('✅ 拖码选择完成:', selectedTuo, '(共' + selectedTuo.length + '个)');
    console.log(' 拖码详情:', tuoScores.slice(0, targetCount).map(item =>
      `#${item.number}(区${item.zone}, 频率${item.freq}, 条件概率${(item.condProb || 0).toFixed(3)}, 遗漏${item.omission}, 关联${item.corrBonus.toFixed(1)}, 总分${item.score.toFixed(1)})`
    ).join(', '));
  
    // 按数字大小排序后返回
    return selectedTuo.sort((a, b) => a - b);
  }

  /**
   * 计算号码对的历史搭档关系加分
   * @param {number[]} danNumbers - 胆码数组
   * @param {number[]} candidateNumbers - 候选号码数组
   * @returns {Object} {号码: 搭档加分}
   */
  calculatePairBonus(danNumbers, candidateNumbers) {
    // 防御性检查
    if (!danNumbers || !Array.isArray(danNumbers) || danNumbers.length === 0) {
      return {};
    }

    if (!candidateNumbers || !Array.isArray(candidateNumbers) || candidateNumbers.length === 0) {
      return {};
    }

    const activeData = this.getActiveData();
    const bonus = {};

    // 初始化
    candidateNumbers.forEach(num => {
      bonus[num] = 0;
    });

    // 统计历史共现次数
    for (const draw of activeData) {
      for (const dan of danNumbers) {
        if (draw.front.includes(dan)) {
          for (const candidate of candidateNumbers) {
            if (draw.front.includes(candidate)) {
              bonus[candidate] = (bonus[candidate] || 0) + 1;
            }
          }
        }
      }
    }

    return bonus;
  }

  /**
   * 强制区间覆盖（胆拖专用版）
   * 确保号码分布在三个区间，使用加权选择替代随机
   * @param {number[]} selectedNumbers - 已选号码
   * @param {number[]} danNumbers - 胆码数组
   * @param {number} targetCount - 目标数量
   * @returns {number[]} 优化后的号码数组
   */
  enforceZoneCoverageForDanTuo(selectedNumbers, danNumbers, targetCount) {
    // 防御性检查
    if (!danNumbers || !Array.isArray(danNumbers)) {
      danNumbers = [];
    }

    if (selectedNumbers.length <= targetCount) {
      return selectedNumbers;
    }

    const allNumbers = [...danNumbers, ...selectedNumbers];

    // 检查区间分布
    const zone1 = allNumbers.filter(n => n <= 12).length;
    const zone2 = allNumbers.filter(n => n > 12 && n <= 24).length;
    const zone3 = allNumbers.filter(n => n > 24).length;

    // 如果每个区间都有号码，无需调整
    if (zone1 > 0 && zone2 > 0 && zone3 > 0) {
      return selectedNumbers.slice(0, targetCount);
    }

    let result = [...selectedNumbers];
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const [frontCounter] = this.frequencyAnalyzer.analyzeFrequency();

    // 加权选择函数：按频率+条件概率评分选择最优号码
    const selectBestCandidate = (candidates) => {
      if (candidates.length === 0) return null;
      let best = candidates[0];
      let bestScore = 0;
      for (const n of candidates) {
        const freqScore = (frontCounter[String(n)] || frontCounter[n] || 0) / Math.max(...Object.values(frontCounter));
        const condScore = (conditionalProb.front[n] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence;
        const total = freqScore * 0.6 + condScore * 0.4;
        if (total > bestScore) {
          bestScore = total;
          best = n;
        }
      }
      return best;
    };

    if (zone1 === 0) {
      const zone1Candidates = Array.from({ length: 12 }, (_, i) => i + 1)
        .filter(n => !allNumbers.includes(n));
      if (zone1Candidates.length > 0) {
        const bestCandidate = selectBestCandidate(zone1Candidates);
        if (bestCandidate) {
          const replaceIdx = result.findIndex(n => n > 12);
          if (replaceIdx !== -1) {
            result[replaceIdx] = bestCandidate;
          }
        }
      }
    }

    if (zone2 === 0) {
      const zone2Candidates = Array.from({ length: 12 }, (_, i) => i + 13)
        .filter(n => !allNumbers.includes(n));
      if (zone2Candidates.length > 0) {
        const bestCandidate = selectBestCandidate(zone2Candidates);
        if (bestCandidate) {
          const replaceIdx = result.findIndex(n => n <= 12 || n > 24);
          if (replaceIdx !== -1) {
            result[replaceIdx] = bestCandidate;
          }
        }
      }
    }

    if (zone3 === 0) {
      const zone3Candidates = Array.from({ length: 11 }, (_, i) => i + 25)
        .filter(n => !allNumbers.includes(n));
      if (zone3Candidates.length > 0) {
        const bestCandidate = selectBestCandidate(zone3Candidates);
        if (bestCandidate) {
          const replaceIdx = result.findIndex(n => n <= 24);
          if (replaceIdx !== -1) {
            result[replaceIdx] = bestCandidate;
          }
        }
      }
    }

    return result.slice(0, targetCount);
  }

  /**
   * 普通拖码优化（不带区间频率）
   * 降级版本：5维度评分体系（频率+条件概率+遗漏+搭档+区间分布）
   * @param {number[]} danNumbers - 胆码数组
   * @param {number[]} candidateNumbers - 候选拖码数组
   * @param {number} targetCount - 目标数量
   * @returns {number[]} 优化后的拖码数组
   */
  optimizeTuoSelection(danNumbers, candidateNumbers, targetCount = 10) {
    // 5维度评分体系，与主方法保持维度一致性
    const [frontCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const maxFreq = Math.max(...Object.values(frontCounter));
    const pairBonus = this.calculatePairBonus(danNumbers, candidateNumbers);
    const maxPairBonus = Math.max(...Object.values(pairBonus), 1);
  
    // 获取条件概率和遗漏数据
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const maxCondProb = Math.max(...Object.values(conditionalProb.front));
    const omission = this.omissionCalculator.calculateOmission();
    const avgFrontOmission = this.omissionCalculator.getAverageOmission('front');
  
    // 区间定义（7区间，与主方法一致）
    const getZone = (num) => {
      if (num <= 5) return 1;
      if (num <= 10) return 2;
      if (num <= 15) return 3;
      if (num <= 20) return 4;
      if (num <= 25) return 5;
      if (num <= 30) return 6;
      return 7;
    };
    // 计算胆码区间分布
    const danZoneCount = {};
    danNumbers.forEach(num => {
      const zone = getZone(num);
      danZoneCount[zone] = (danZoneCount[zone] || 0) + 1;
    });
    // 计算区间频率排名
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
  
    const scored = candidateNumbers.map(num => {
      let score = 0;
      const zone = getZone(num);
  
      // 维度1: 频率得分（20分满分）- 归一化
      const freq = frontCounter[String(num)] || frontCounter[num] || 0;
      score += maxFreq > 0 ? (freq / maxFreq) * 20 : 0;
  
      // 维度2: 条件概率得分（20分满分）- 归一化
      const condProb = conditionalProb.front[num] || 0;
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * 20;
  
      // 维度3: 遗漏回归得分（20分满分）- 归一化
      const currentOmission = omission.front[num] || 0;
      const omissionDeviation = currentOmission - avgFrontOmission;
      const maxPositiveDeviation = Math.max(
        ...Object.values(omission.front).map(o => (o || 0) - avgFrontOmission).filter(d => d > 0)
      );
      if (omissionDeviation > 0 && maxPositiveDeviation > 0) {
        score += (omissionDeviation / maxPositiveDeviation) * 20;
      }
  
      // 维度4: 搭档关系得分（20分满分）- 归一化
      const bonus = pairBonus[num] || 0;
      score += (bonus / maxPairBonus) * 20;
  
      // 维度5: 区间分布得分（20分满分）
      // 胆码未覆盖的高频区加分
      const danInThisZone = danZoneCount[zone] || 0;
      const zoneFreqRank = Object.entries(zoneFrequencies)
        .sort((a, b) => b[1] - a[1])
        .findIndex(([z]) => parseInt(z) === zone);
      if (danInThisZone === 0) {
        if (zoneFreqRank < 4) score += 20;
        else if (zoneFreqRank < 6) score += 12;
        else score += 6;
      } else {
        score += 8 - danInThisZone * 2;
      }
  
      return { number: num, score };
    });
  
    scored.sort((a, b) => b.score - a.score);
  
    // 按数字大小排序后返回
    return scored.slice(0, targetCount).map(item => item.number).sort((a, b) => a - b);
  }
}
