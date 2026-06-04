/**
 * 组合质量后验验证器
 * 对推荐的号码组合进行质量评估（和值、AC值、奇偶比、区间覆盖等）
 * 不达标时提供微调建议
 */

import { CONFIG } from '../core/Config.js';

export class CombinationValidator {
  /**
   * 验证前区号码组合质量
   * @param {number[]} frontNumbers - 前区5个号码
   * @param {number[]} backNumbers - 后区2个号码
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @returns {Object} { score, issues, suggestions, passed }
   */
  static validate(frontNumbers, backNumbers, analyzer) {
    console.log('🔍 组合质量后验验证');
    
    let score = 100; // 基础100分，有问题扣分
    const issues = [];
    const suggestions = [];

    // === 前区验证 ===
    const front = [...frontNumbers].sort((a, b) => a - b);
    
    // 1. 和值合理性（权重15分）
    const frontSum = front.reduce((a, b) => a + b, 0);
    const sumTrend = analyzer.trendAnalyzer.analyzeSumTrend();
    const sumDiff = Math.abs(frontSum - sumTrend.avgFrontSum);
    const sumStd = sumTrend.frontStd;
    
    if (frontSum < CONFIG.SUM_RANGE_MIN) {
      score -= 15;
      issues.push(`前区和值${frontSum}偏低（合理范围${CONFIG.SUM_RANGE_MIN}-${CONFIG.SUM_RANGE_MAX}）`);
      suggestions.push('可替换一个小号为较大号来提升和值');
    } else if (frontSum > CONFIG.SUM_RANGE_MAX) {
      score -= 15;
      issues.push(`前区和值${frontSum}偏高（合理范围${CONFIG.SUM_RANGE_MIN}-${CONFIG.SUM_RANGE_MAX}）`);
      suggestions.push('可替换一个大号为较小号来降低和值');
    } else if (sumDiff > sumStd * 2) {
      score -= 8;
      issues.push(`前区和值${frontSum}偏离均值${sumTrend.avgFrontSum.toFixed(1)}较远（偏差${sumDiff.toFixed(1)}）`);
    }

    // 2. AC值检查（权重10分）
    const acValue = this.calculateACValue(front);
    if (acValue < CONFIG.AC_VALUE_MIN) {
      score -= 10;
      issues.push(`AC值${acValue}偏低（最小${CONFIG.AC_VALUE_MIN}），号码间距过于均匀`);
      suggestions.push('可以调整号码间距使分布更不均匀');
    } else if (acValue > CONFIG.AC_VALUE_MAX) {
      score -= 5;
      issues.push(`AC值${acValue}偏高（最大${CONFIG.AC_VALUE_MAX}），号码间距过于离散`);
    }

    // 3. 奇偶比检查（权重10分）- 理想比2:3或3:2
    const oddCount = front.filter(n => n % 2 !== 0).length;
    const evenCount = front.length - oddCount;
    const oddEvenDiff = Math.abs(oddCount - evenCount);
    if (oddEvenDiff <= 1) {
      // 2:3或3:2 - 理想比，不扣分
    } else if (oddEvenDiff === 2) {
      // 1:4或4:1 - 扣5分
      score -= 5;
      issues.push(`奇偶比${oddCount}:${evenCount}偏斜，理想比2:3或3:2`);
      suggestions.push('建议替换1个号码使奇偶比接近2:3或3:2');
    } else if (oddEvenDiff >= 3) {
      // 0:5或5:0 - 扣10分
      score -= 10;
      issues.push(`奇偶比${oddCount}:${evenCount}极度不均衡，理想比2:3或3:2`);
      suggestions.push(oddCount === 0 ? '建议至少包含2个奇数以达到2:3' : '建议至少包含2个偶数以达到3:2');
    }

    // 4. 区间覆盖检查（权重10分）
    const zones = new Set(front.map(n => Math.floor((n - 1) / 5)));
    if (zones.size < 3) {
      score -= 10;
      issues.push(`前区仅覆盖${zones.size}个区间，建议至少覆盖3-4个区间`);
      const missingZones = [];
      for (let z = 0; z < 7; z++) {
        if (!zones.has(z)) missingZones.push(`区${z + 1}(${z * 5 + 1}-${z * 5 + 5})`);
      }
      suggestions.push(`缺少区间：${missingZones.join('、')}，可从中选择号码替换`);
    } else if (zones.size >= 4) {
      // 覆盖4+区间加分（已在基础100分内）
    }

    // 5. 连号检查（权重5分）
    let consecutiveGroups = 0;
    for (let i = 1; i < front.length; i++) {
      if (front[i] - front[i - 1] === 1) {
        consecutiveGroups++;
      }
    }
    if (consecutiveGroups > CONFIG.CONSECUTIVE_GROUPS_MAX) {
      score -= 5;
      issues.push(`连号组数${consecutiveGroups}偏多（最多${CONFIG.CONSECUTIVE_GROUPS_MAX}）`);
      suggestions.push('连号过多可替换其中一个为非连号');
    }

    // === 后区验证 ===
    const back = [...backNumbers].sort((a, b) => a - b);
    let backOddCount = 0;
    let backEvenCount = 0;

    // 6. 后区奇偶检查（权重5分）- 仅在有后区号码时检查
    if (back.length >= 2) {
      backOddCount = back.filter(n => n % 2 !== 0).length;
      backEvenCount = back.length - backOddCount;
      if (backOddCount === 0 || backEvenCount === 0) {
        score -= 5;
        issues.push(`后区奇偶比${backOddCount}:${backEvenCount}不均衡，理想1奇1偶`);
      }
    }

    // 7. 后区跨度检查（权重5分）
    const backSpan = back[back.length - 1] - back[0];
    if (backSpan === 0) {
      score -= 5;
      issues.push('后区两个号码相同（不可能）');
    } else if (backSpan < 2) {
      score -= 3;
      issues.push(`后区跨度${backSpan}太小`);
    }

    const passed = score >= 70;
    console.log(`  组合质量评分: ${score}分 ${passed ? '✅ 通过' : '⚠️ 不达标'}`);
    if (issues.length > 0) {
      console.log('  问题:', issues.join('; '));
      if (suggestions.length > 0) {
        console.log('  建议:', suggestions.join('; '));
      }
    }

    return {
      score,
      issues,
      suggestions,
      passed,
      details: {
        frontSum,
        acValue,
        oddEvenRatio: `${oddCount}:${evenCount}`,
        zoneCoverage: zones.size,
        consecutiveGroups,
        backOddEvenRatio: `${backOddCount}:${backEvenCount}`,
        backSpan
      }
    };
  }

  /**
   * 计算AC值（Arithmetic Complexity）
   * AC值 = 不同差值个数 - (号码个数 - 1)
   * @param {number[]} numbers - 号码数组
   * @returns {number} AC值
   */
  static calculateACValue(numbers) {
    if (numbers.length < 2) return 0;
    
    const diffs = new Set();
    for (let i = 0; i < numbers.length; i++) {
      for (let j = i + 1; j < numbers.length; j++) {
        diffs.add(Math.abs(numbers[i] - numbers[j]));
      }
    }
    
    return diffs.size - (numbers.length - 1);
  }

  /**
   * 基于验证结果微调号码（替换不达标号码）
   * @param {number[]} frontNumbers - 前区号码
   * @param {number[]} backNumbers - 后区号码
   * @param {Object} validationResult - 验证结果
   * @param {Object} analyzer - LotteryAnalyzer实例
   * @returns {Object} { front: number[], back: number[] } 微调后的号码
   */
  static suggestAdjustment(frontNumbers, backNumbers, validationResult, analyzer) {
    if (validationResult.passed) {
      return { front: frontNumbers, back: backNumbers };
    }

    let front = [...frontNumbers];
    let back = [...backNumbers];

    const conditionalProb = analyzer.conditionalProbability.calculateConditionalProbability();
    const [frontCounter] = analyzer.frequencyAnalyzer.analyzeFrequency();

    // 和值偏低：替换最小号码为更大号码
    if (validationResult.details.frontSum < CONFIG.SUM_RANGE_MIN) {
      const minNum = Math.min(...front);
      const candidates = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
        .filter(n => !front.includes(n) && n > minNum);
      if (candidates.length > 0) {
        // 按条件概率排序选最优替代
        const best = candidates.sort((a, b) => 
          ((conditionalProb.front[b] || 0) + (frontCounter[String(b)] || frontCounter[b] || 0)) -
          ((conditionalProb.front[a] || 0) + (frontCounter[String(a)] || frontCounter[a] || 0))
        )[0];
        front = front.filter(n => n !== minNum);
        front.push(best);
        front.sort((a, b) => a - b);
      }
    }

    // 和值偏高：替换最大号码为更小号码
    if (validationResult.details.frontSum > CONFIG.SUM_RANGE_MAX) {
      const maxNum = Math.max(...front);
      const candidates = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
        .filter(n => !front.includes(n) && n < maxNum);
      if (candidates.length > 0) {
        const best = candidates.sort((a, b) => 
          ((conditionalProb.front[b] || 0) + (frontCounter[String(b)] || frontCounter[b] || 0)) -
          ((conditionalProb.front[a] || 0) + (frontCounter[String(a)] || frontCounter[a] || 0))
        )[0];
        front = front.filter(n => n !== maxNum);
        front.push(best);
        front.sort((a, b) => a - b);
      }
    }

    // 全奇或全偶：替换一个号码使奇偶比更均衡
    const oddEvenRatio = validationResult.details.oddEvenRatio;
    if (oddEvenRatio === '5:0' || oddEvenRatio === '0:5') {
      const needOdd = oddEvenRatio === '0:5';
      const candidates = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
        .filter(n => !front.includes(n) && (needOdd ? n % 2 !== 0 : n % 2 === 0));
      if (candidates.length > 0) {
        const worstIdx = front.reduce((worst, num, idx) => {
          const score = (conditionalProb.front[num] || 0) + (frontCounter[String(num)] || frontCounter[num] || 0);
          return score < worst.score ? { idx, score } : worst;
        }, { idx: 0, score: Infinity }).idx;
        const best = candidates.sort((a, b) => 
          ((conditionalProb.front[b] || 0) + (frontCounter[String(b)] || frontCounter[b] || 0)) -
          ((conditionalProb.front[a] || 0) + (frontCounter[String(a)] || frontCounter[a] || 0))
        )[0];
        front[worstIdx] = best;
        front.sort((a, b) => a - b);
      }
    }

    // 奇偶比1:4或4:1：替换一个号码使奇偶比接近2:3或3:2
    if (oddEvenRatio === '1:4' || oddEvenRatio === '4:1') {
      const needOdd = oddEvenRatio === '1:4'; // 1奇4偶 → 需要更多奇数
      // 需要替换1个偶数为奇数，或1个奇数为偶数
      const replaceTarget = needOdd ? front.filter(n => n % 2 === 0) : front.filter(n => n % 2 !== 0);
      const replacementParity = needOdd ? (n => n % 2 !== 0) : (n => n % 2 === 0);
      const candidates = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
        .filter(n => !front.includes(n) && replacementParity(n));
      if (candidates.length > 0 && replaceTarget.length > 0) {
        // 替换评分最低的目标号码
        const worst = replaceTarget.reduce((w, num) => {
          const score = (conditionalProb.front[num] || 0) + (frontCounter[String(num)] || frontCounter[num] || 0);
          return score < w.score ? { num, score } : w;
        }, { num: 0, score: Infinity });
        const best = candidates.sort((a, b) => 
          ((conditionalProb.front[b] || 0) + (frontCounter[String(b)] || frontCounter[b] || 0)) -
          ((conditionalProb.front[a] || 0) + (frontCounter[String(a)] || frontCounter[a] || 0))
        )[0];
        front[front.indexOf(worst.num)] = best;
        front.sort((a, b) => a - b);
      }
    }

    // 区间覆盖不足：替换号码增加缺失区间
    if (validationResult.details.zoneCoverage < 3) {
      const presentZones = new Set(front.map(n => Math.floor((n - 1) / 5)));
      const missingZones = []; // 找缺失的区
      for (let z = 0; z < 7; z++) {
        if (!presentZones.has(z)) missingZones.push(z);
      }
      if (missingZones.length > 0) {
        // 优先补充第1个缺失区
        const targetZone = missingZones[0];
        const zoneStart = targetZone * 5 + 1;
        const zoneEnd = targetZone * 5 + 5;
        const zoneCandidates = Array.from({ length: zoneEnd - zoneStart + 1 }, (_, i) => zoneStart + i)
          .filter(n => !front.includes(n));
        if (zoneCandidates.length > 0) {
          // 替换重复区中评分最低的号码
          const overrepresentedZones = [...presentZones].filter(z => front.filter(n => Math.floor((n - 1) / 5) === z).length >= 2);
          let replaceNum = null;
          if (overrepresentedZones.length > 0) {
            const worst = front.reduce((w, num) => {
              const zone = Math.floor((num - 1) / 5);
              if (!overrepresentedZones.includes(zone)) return w;
              const score = (conditionalProb.front[num] || 0) + (frontCounter[String(num)] || frontCounter[num] || 0);
              return score < w.score ? { num, score } : w;
            }, { num: 0, score: Infinity });
            replaceNum = worst.num;
          } else {
            // 没有重复区，替换评分最低的号码
            const worst = front.reduce((w, num) => {
              const score = (conditionalProb.front[num] || 0) + (frontCounter[String(num)] || frontCounter[num] || 0);
              return score < w.score ? { num, score } : w;
            }, { num: 0, score: Infinity });
            replaceNum = worst.num;
          }
          if (replaceNum > 0) {
            const best = zoneCandidates.sort((a, b) => 
              ((conditionalProb.front[b] || 0) + (frontCounter[String(b)] || frontCounter[b] || 0)) -
              ((conditionalProb.front[a] || 0) + (frontCounter[String(a)] || frontCounter[a] || 0))
            )[0];
            front[front.indexOf(replaceNum)] = best;
            front.sort((a, b) => a - b);
          }
        }
      }
    }

    // 连号过多：替换一个连号号码为非连号
    if (validationResult.details.consecutiveGroups > CONFIG.CONSECUTIVE_GROUPS_MAX) {
      // 找连号组中评分最低的号码
      for (let i = 1; i < front.length; i++) {
        if (front[i] - front[i - 1] === 1) {
          // 评分较低的连号号码
          const scoreA = (conditionalProb.front[front[i - 1]] || 0) + (frontCounter[String(front[i - 1])] || frontCounter[front[i - 1]] || 0);
          const scoreB = (conditionalProb.front[front[i]] || 0) + (frontCounter[String(front[i])] || frontCounter[front[i]] || 0);
          const replaceNum = scoreA < scoreB ? front[i - 1] : front[i];
          const candidates = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1)
            .filter(n => !front.includes(n) && Math.abs(n - replaceNum) > 1);
          if (candidates.length > 0) {
            const best = candidates.sort((a, b) => 
              ((conditionalProb.front[b] || 0) + (frontCounter[String(b)] || frontCounter[b] || 0)) -
              ((conditionalProb.front[a] || 0) + (frontCounter[String(a)] || frontCounter[a] || 0))
            )[0];
            front[front.indexOf(replaceNum)] = best;
            front.sort((a, b) => a - b);
            break; // 只替换一组连号
          }
        }
      }
    }

    return { front, back };
  }
}