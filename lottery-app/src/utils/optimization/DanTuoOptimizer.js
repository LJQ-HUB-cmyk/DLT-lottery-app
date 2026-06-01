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
   * @returns {number[]} 优化后的拖码数组
   */
  optimizeTuoSelectionWithZoneFrequency(danNumbers, candidateNumbers, targetCount = 10) {
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

    // 计算每个候选拖码的综合评分（7维度）
    // 获取条件概率和遗漏数据
    const conditionalProb = this.conditionalProbability.calculateConditionalProbability();
    const omission = this.omissionCalculator.calculateOmission();
    const correlationData = this.correlationAnalyzer.calculateNumberCorrelationWithTimeDecay();
    const avgFrontOmission = this.omissionCalculator.getAverageOmission('front');

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
      const activeData = this.getActiveData();
      for (const dan of danNumbers) {
        const coOccurrence = correlationData.front[dan] && correlationData.front[dan][tuoNum] || 0;
        corr += coOccurrence;
        const recentDraws = activeData.slice(-15);
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

    const tuoScores = candidateNumbers.map(tuoNum => {
      const zone = getZone(tuoNum);
      let score = 0;

      // 1. 基础频率分（15分满分）- 归一化 + 近期趋势动量（5分）
      const freq = frontCounter[String(tuoNum)] || frontCounter[tuoNum] || 0;
      const freqBase = maxFreq > 0 ? (freq / maxFreq) * 15 : 0;
      const momentum = recentFreq.frontMomentum[tuoNum] || 0;
      const maxMomentum = Math.max(...Object.values(recentFreq.frontMomentum).map(m => Math.abs(m)));
      const normalizedMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0;
      score += freqBase + Math.max(0, normalizedMomentum) * 5;

      // 2. 区间分布分（20分满分）
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

      // 3. 条件概率加成（20分满分）- 归一化
      const condProb = conditionalProb.front[tuoNum] || 0;
      const normalizedCondProb = maxCondProb > 0 ? condProb / maxCondProb : 0;
      score += normalizedCondProb * 20;

      // 4. 遗漏回归加成（15分满分）- 归一化
      const currentOmission = omission.front[tuoNum] || 0;
      const omissionDeviation = currentOmission - avgFrontOmission;
      if (omissionDeviation > 0 && maxPositiveDeviation > 0) {
        score += (omissionDeviation / maxPositiveDeviation) * 10; // 归一化回归加分
        if (omissionDeviation > omissionStd * 2) score += 5;
      }

      // 5. 关联性加成（15分满分）- 归一化
      const rawCorr = rawCorrelationScores.find(s => s.number === tuoNum)?.corr || 0;
      const normalizedCorr = maxCorr > 0 ? rawCorr / maxCorr : 0;
      score += normalizedCorr * 15;

      // 6. 协同评分加成（10分满分）- 与胆码的和值/跨度/奇偶协调性
      // 和值协调：拖码加入后使总和接近历史均值
      const sumTrend = this.trendAnalyzer.analyzeSumTrend();
      const currentDanSum = danNumbers.reduce((a, b) => a + b, 0);
      const targetTotalSum = sumTrend.avgFrontSum;
      const sumWithTuo = currentDanSum + tuoNum;
      const sumDiff = Math.abs(sumWithTuo - targetTotalSum / 5 * (danNumbers.length + 1));
      const maxSumDiff = targetTotalSum * 0.5;
      const sumScore = maxSumDiff > 0 ? Math.max(0, 1 - sumDiff / maxSumDiff) * 4 : 2;
      score += sumScore;

      // 奇偶协调：拖码加入后使奇偶比接近2:3或3:2（5个号码中奇数2或3个）
      const danOddCount = danNumbers.filter(n => n % 2 !== 0).length;
      const isOdd = tuoNum % 2 !== 0;
      const totalWithTuo = danNumbers.length + 1; // 胆码+当前拖码
      const newOddCount = danOddCount + (isOdd ? 1 : 0);
      // 理想奇数占比: 2/5=0.4 或 3/5=0.6，即奇数2-3个
      const idealOddMin = Math.round(totalWithTuo * 0.4);
      const idealOddMax = Math.round(totalWithTuo * 0.6);
      if (newOddCount >= idealOddMin && newOddCount <= idealOddMax) {
        score += 3; // 达到理想奇偶比2:3或3:2
      } else if (Math.abs(newOddCount - totalWithTuo / 2) <= 1) {
        score += 1; // 接近理想但未达标
      }

      // 跨度协调：拖码加入后使号码跨度合理
      const allNumbersWithTuo = [...danNumbers, tuoNum];
      const spanWithTuo = Math.max(...allNumbersWithTuo) - Math.min(...allNumbersWithTuo);
      const spanAnalysis = this.trendAnalyzer.analyzeSpan();
      const spanDiff = Math.abs(spanWithTuo - spanAnalysis.avgFrontSpan);
      const maxSpanDiff = spanAnalysis.avgFrontSpan * 0.3;
      const spanBonus = maxSpanDiff > 0 ? Math.max(0, 1 - spanDiff / maxSpanDiff) * 3 : 1.5;
      score += spanBonus;

      // 7. 历史形态相似度加成（5分满分）- 归一化
      // 号码出现在与当前组合形态相似的历史记录中，加分
      const historyData = this.getActiveData();
      const similarityBonus = HistoricalSimilarity.computeNumberSimilarityBonus(
        tuoNum, true, danNumbers, [], historyData
      );
      score += similarityBonus * 5;

      return {
        number: tuoNum,
        score,
        zone,
        freq,
        condProb,
        omission: currentOmission,
        corrBonus: rawCorr,
        similarityBonus
      };
    });

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
    const adjustDynamicWeight = (candidate, currentDan, currentTuo) => {
      const allSelected = [...currentDan, ...currentTuo];
      let bonus = 1.0; // 基础权重倍率
      
      // 1. 奇偶平衡：如果当前组合奇偶偏斜，提升缺失奇偶号码权重
      const currentOdd = allSelected.filter(n => n % 2 !== 0).length;
      const currentEven = allSelected.length - currentOdd;
      const targetSize = 5; // 最终5个号码
      if (allSelected.length < targetSize) {
        // 理想2:3或3:2，当前偏斜时需要补充
        const idealOddMin = Math.round(targetSize * 0.4);
        const idealOddMax = Math.round(targetSize * 0.6);
        if (currentOdd < idealOddMin && candidate.number % 2 !== 0) {
          bonus += 0.5; // 奇数不足时，奇数号码权重+50%
        } else if (currentEven < idealOddMin && candidate.number % 2 === 0) {
          bonus += 0.5; // 偶数不足时，偶数号码权重+50%
        }
      }
      
      // 2. 区间覆盖：如果当前组合缺失某些区，提升缺区号码权重
      const coveredZones = new Set(allSelected.map(n => getZone(n)));
      if (allSelected.length < targetSize && coveredZones.size < 4) {
        const candidateZone = getZone(candidate.number);
        if (!coveredZones.has(candidateZone)) {
          bonus += 0.3; // 缺区的号码权重+30%
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
   * @param {number[]} danNumbers - 胆码数组
   * @param {number[]} candidateNumbers - 候选拖码数组
   * @param {number} targetCount - 目标数量
   * @returns {number[]} 优化后的拖码数组
   */
  optimizeTuoSelection(danNumbers, candidateNumbers, targetCount = 10) {
    // 简化版本：基于频率和搭档关系
    const [frontCounter] = this.frequencyAnalyzer.analyzeFrequency();
    const pairBonus = this.calculatePairBonus(danNumbers, candidateNumbers);

    const scored = candidateNumbers.map(num => {
      const freq = frontCounter[String(num)] || frontCounter[num] || 0;
      const bonus = pairBonus[num] || 0;
      return {
        number: num,
        score: freq + bonus
      };
    });

    scored.sort((a, b) => b.score - a.score);

    // 按数字大小排序后返回
    return scored.slice(0, targetCount).map(item => item.number).sort((a, b) => a - b);
  }
}
