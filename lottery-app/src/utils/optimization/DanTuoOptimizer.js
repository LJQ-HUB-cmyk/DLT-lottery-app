/**
 * 胆拖优化器
 * 负责胆拖玩法的拖码选择优化、间距控制、区间覆盖等
 */

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

    // 计算每个候选拖码的综合评分
    const tuoScores = candidateNumbers.map(tuoNum => {
      const zone = getZone(tuoNum);
      let score = 0;

      // 1. 基础频率分（40%）
      const freq = frontCounter[String(tuoNum)] || frontCounter[tuoNum] || 0;
      const maxFreq = Math.max(...Object.values(frontCounter));
      score += (freq / maxFreq) * 40;

      // 2. 区间分布分（30%）
      const danInThisZone = danZoneCount[zone] || 0;
      const zoneFreqRank = Object.entries(zoneFrequencies)
        .sort((a, b) => b[1] - a[1])
        .findIndex(([z]) => parseInt(z) === zone);

      if (danInThisZone === 0) {
        // 胆码不在此区间 → 根据区间热度加分
        if (zoneFreqRank < 4) {
          score += 25; // 热区间，多选
        } else if (zoneFreqRank < 6) {
          score += 15; // 中热区间，适中
        } else {
          score += 8;  // 冷区间，少量
        }
      } else {
        // 胆码已在此区间 → 减少拖码（避免过度集中）
        score += 10 - danInThisZone * 3;
      }

      // 3. 历史搭档关系加分（30%）
      const pairBonus = this.calculatePairBonus(danNumbers, [tuoNum]);
      score += Math.min(pairBonus[tuoNum] || 0, 30);

      return {
        number: tuoNum,
        score,
        zone,
        freq,
        pairBonus: pairBonus[tuoNum] || 0
      };
    });

    // 按评分排序
    tuoScores.sort((a, b) => b.score - a.score);

    // 选择前targetCount个，但要避免连号
    const selectedTuo = [];
    const selectedNumbers = new Set(danNumbers); // 已选号码集合（包含胆码）

    for (const item of tuoScores) {
      if (selectedTuo.length >= targetCount) break;

      const num = item.number;

      // 检查是否与已选号码（胆码+已选拖码）形成连号
      let hasConsecutive = false;
      for (const selected of selectedNumbers) {
        if (Math.abs(num - selected) <= 1) {
          hasConsecutive = true;
          break;
        }
      }

      if (!hasConsecutive) {
        selectedTuo.push(num);
        selectedNumbers.add(num);
      }
    }

    // 如果因为间距限制导致数量不足，放宽限制（允许隔1个号码）
    if (selectedTuo.length < targetCount) {
      console.log('  间距限制导致数量不足，放宽限制');
      for (const item of tuoScores) {
        if (selectedTuo.length >= targetCount) break;
        if (!selectedNumbers.has(item.number)) {
          // 允许隔1个号码的连号（如3和5）
          let hasCloseNumber = false;
          for (const selected of selectedNumbers) {
            if (Math.abs(item.number - selected) === 1) {
              hasCloseNumber = true;
              break;
            }
          }

          if (!hasCloseNumber) {
            selectedTuo.push(item.number);
            selectedNumbers.add(item.number);
          }
        }
      }
    }

    // 如果还是不足，只能接受连号
    if (selectedTuo.length < targetCount) {
      console.log('  仍然数量不足，接受连号');
      for (const item of tuoScores) {
        if (selectedTuo.length >= targetCount) break;
        if (!selectedNumbers.has(item.number)) {
          selectedTuo.push(item.number);
          selectedNumbers.add(item.number);
        }
      }
    }

    console.log('✅ 拖码选择完成:', selectedTuo, '(共' + selectedTuo.length + '个)');
    console.log('  拖码详情:', tuoScores.slice(0, targetCount).map(item =>
      `#${item.number}(区${item.zone}, 频率${item.freq}, 搭档${item.pairBonus}, 总分${item.score.toFixed(1)})`
    ).join(', '));

    return selectedTuo;
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
   * 确保号码分布在三个区间
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

    // 如果某个区间完全没有号码，则替换一个
    let result = [...selectedNumbers];

    if (zone1 === 0) {
      // 需要补充一区号码
      const zone1Candidates = Array.from({ length: 12 }, (_, i) => i + 1)
        .filter(n => !allNumbers.includes(n));
      if (zone1Candidates.length > 0) {
        const replaceIdx = result.findIndex(n => n > 12);
        if (replaceIdx !== -1) {
          result[replaceIdx] = zone1Candidates[Math.floor(Math.random() * zone1Candidates.length)];
        }
      }
    }

    if (zone2 === 0) {
      // 需要补充二区号码
      const zone2Candidates = Array.from({ length: 12 }, (_, i) => i + 13)
        .filter(n => !allNumbers.includes(n));
      if (zone2Candidates.length > 0) {
        const replaceIdx = result.findIndex(n => n <= 12 || n > 24);
        if (replaceIdx !== -1) {
          result[replaceIdx] = zone2Candidates[Math.floor(Math.random() * zone2Candidates.length)];
        }
      }
    }

    if (zone3 === 0) {
      // 需要补充三区号码
      const zone3Candidates = Array.from({ length: 11 }, (_, i) => i + 25)
        .filter(n => !allNumbers.includes(n));
      if (zone3Candidates.length > 0) {
        const replaceIdx = result.findIndex(n => n <= 24);
        if (replaceIdx !== -1) {
          result[replaceIdx] = zone3Candidates[Math.floor(Math.random() * zone3Candidates.length)];
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

    return scored.slice(0, targetCount).map(item => item.number);
  }
}
