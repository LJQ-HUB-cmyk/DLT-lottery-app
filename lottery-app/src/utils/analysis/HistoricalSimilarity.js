/**
 * 历史形态相似度匹配器
 * 找历史中和值、奇偶比、区间分布、AC值与当前推荐组合相似的开奖记录
 * 相似度高的号码在评分中加分
 */

export class HistoricalSimilarity {
  /**
   * 计算一组号码的"形态指纹"
   * @param {number[]} numbers - 号码数组（已排序）
   * @param {number[]} backNumbers - 后区号码数组
   * @returns {Object} 形态指纹
   */
  static computePattern(numbers, backNumbers = []) {
    const front = [...numbers].sort((a, b) => a - b);
    // 和值区间（按10分档）
    const sum = front.reduce((a, b) => a + b, 0);
    const sumBand = Math.floor(sum / 20); // 0-5档
    // 奇偶比（编码为"奇:偶"）
    const oddCount = front.filter(n => n % 2 !== 0).length;
    const evenCount = front.length - oddCount;
    // 区间覆盖（7区中有号码的区集合）
    const zones = new Set(front.map(n => Math.floor((n - 1) / 5)));
    // AC值
    const acValue = this.calculateACValue(front);
    // 连号组数
    let consecutiveGroups = 0;
    for (let i = 1; i < front.length; i++) {
      if (front[i] - front[i - 1] === 1) consecutiveGroups++;
    }
    // 后区特征
    const back = [...backNumbers].sort((a, b) => a - b);
    const backOddCount = back.filter(n => n % 2 !== 0).length;
    const backSpan = back.length >= 2 ? back[back.length - 1] - back[0] : 0;

    return {
      sumBand,
      sum,
      oddCount,
      evenCount,
      zoneCoverage: zones.size,
      zones: [...zones],
      acValue,
      consecutiveGroups,
      backOddCount,
      backSpan
    };
  }

  /**
   * 计算两组形态指纹的相似度（加权欧氏距离 → 映射到0-1相似度）
   * @param {Object} patternA - 形态指纹A
   * @param {Object} patternB - 形态指纹B
   * @returns {number} 相似度 0-1（1=完全相同）
   */
  static computeSimilarity(patternA, patternB) {
    // 各维度权重
    const weights = {
      sumBand: 0.15,     // 和值档位
      oddEven: 0.20,     // 奇偶比
      zoneCoverage: 0.20, // 区间覆盖
      acValue: 0.15,     // AC值
      consecutive: 0.10,  // 连号
      backOddEven: 0.10,  // 后区奇偶
      backSpan: 0.10      // 后区跨度
    };

    let distance = 0;

    // 和值档位差异（归一化到0-5）
    distance += weights.sumBand * Math.abs(patternA.sumBand - patternB.sumBand) / 5;

    // 奇偶比差异（归一化到0-5）
    distance += weights.oddEven * Math.abs(patternA.oddCount - patternB.oddCount) / 5;

    // 区间覆盖差异（归一化到0-7）
    distance += weights.zoneCoverage * Math.abs(patternA.zoneCoverage - patternB.zoneCoverage) / 7;

    // AC值差异（归一化到0-10）
    distance += weights.acValue * Math.abs(patternA.acValue - patternB.acValue) / 10;

    // 连号差异（归一化到0-4）
    distance += weights.consecutive * Math.abs(patternA.consecutiveGroups - patternB.consecutiveGroups) / 4;

    // 后区奇偶差异（归一化到0-2）
    distance += weights.backOddEven * Math.abs(patternA.backOddCount - patternB.backOddCount) / 2;

    // 后区跨度差异（归一化到0-11）
    distance += weights.backSpan * Math.abs(patternA.backSpan - patternB.backSpan) / 11;

    // 距离映射到相似度：距离0 → 相似度1，距离1 → 相似度0
    return Math.max(0, 1 - distance);
  }

  /**
   * 找历史中最相似的TopN开奖记录
   * @param {number[]} frontNumbers - 前区号码
   * @param {number[]} backNumbers - 后区号码
   * @param {Array} historyData - 历史数据 [{front, back}]
   * @param {number} topN - 返回前N条最相似记录
   * @returns {Object[]} [{draw, similarity, drawIndex}]
   */
  static findSimilarDraws(frontNumbers, backNumbers, historyData, topN = 5) {
    if (!historyData || historyData.length === 0) return [];

    const targetPattern = this.computePattern(frontNumbers, backNumbers);

    const similarities = historyData.map((draw, idx) => {
      const drawPattern = this.computePattern(draw.front, draw.back);
      const similarity = this.computeSimilarity(targetPattern, drawPattern);
      return { draw, similarity, drawIndex: idx };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topN);
  }

  /**
   * 计算单个号码的历史形态相似度加分
   * 如果号码出现在高相似度历史记录中，给予加分
   * @param {number} num - 待评分号码
   * @param {boolean} isFront - 是否前区号码
   * @param {number[]} currentNumbers - 当前已选号码
   * @param {number[]} currentBack - 当前后区号码
   * @param {Array} historyData - 历史数据
   * @returns {number} 相似度加分（0-1归一化）
   */
  static computeNumberSimilarityBonus(num, isFront, currentNumbers, currentBack, historyData) {
    if (!historyData || historyData.length < 30) return 0;

    // 构建假设组合：加入num后看形态
    const hypotheticalFront = isFront
      ? [...currentNumbers, num].sort((a, b) => a - b)
      : [...currentNumbers].sort((a, b) => a - b);
    const hypotheticalBack = isFront
      ? [...currentBack].sort((a, b) => a - b)
      : [...currentBack, num].sort((a, b) => a - b);

    // 找最相似的5条历史记录
    const similarDraws = this.findSimilarDraws(hypotheticalFront, hypotheticalBack, historyData, 5);

    if (similarDraws.length === 0) return 0;

    // 加分逻辑：号码在高相似度历史记录中出现频率越高，加分越多
    let appearanceScore = 0;
    for (const { draw, similarity } of similarDraws) {
      if (similarity < 0.5) continue; // 低相似度不计
      const appeared = isFront
        ? draw.front.includes(num)
        : draw.back.includes(num);
      if (appeared) {
        appearanceScore += similarity; // 相似度越高且号码出现，加分越多
      }
    }

    // 归一化到0-1（最大可能值 ≈ 5 * 1.0 = 5）
    return Math.min(1, appearanceScore / 5);
  }

  /**
   * 计算AC值
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
}