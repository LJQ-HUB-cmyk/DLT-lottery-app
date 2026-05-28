/**
 * 彩票分析核心逻辑 (迁移自 Python)
 */

// 配置常量（基于208期历史数据优化）
const CONFIG = {
  FRONT_COUNT: 5,           // 前区号码数量
  BACK_COUNT: 2,            // 后区号码数量
  FRONT_RANGE: 35,          // 前区号码范围 1-35
  BACK_RANGE: 12,           // 后区号码范围 1-12
  MAX_ITERATIONS: 1000,     // 最大迭代次数（防止无限循环）
  HOT_NUMBERS_COUNT: 10,    // 热号数量
  COLD_NUMBERS_COUNT: 10,   // 冷号数量
  ROTATION_HIGH_FREQ: 15,   // 旋转矩阵高频号数量
  ROTATION_LOW_FREQ: 6,     // 旋转矩阵后区高频号数量
  BAYESIAN_CANDIDATE_FRONT: 18,  // 贝叶斯前区候选数量（增加到18以提高覆盖率）
  BAYESIAN_CANDIDATE_BACK: 8,    // 贝叶斯后区候选数量
  DISTRIBUTION_TRY_COUNT: 500,   // 分布策略尝试次数
  TIME_DECAY_FACTOR: 0.95,  // 时间衰减因子
  HYBRID_MODEL_COUNT: 3,    // 混合模型使用的模型数量
  QUALITY_SCORE_THRESHOLD: 75,  // 质量评分阈值（从80降至75，提高通过率）
  RECENT_DRAWS_FOR_TREND: 15,  // 用于趋势分析的最近期数（从10增至15）
  ADAPTIVE_WEIGHT_WINDOW: 15,  // 自适应权重窗口大小
  // 基于208期数据的新增配置
  AC_VALUE_MIN: 3,          // AC值最小可接受值（从2提高到3）
  AC_VALUE_MAX: 7,          // AC值最大可接受值（从9降到7）
  AC_VALUE_IDEAL_MIN: 4,    // AC值理想范围下限
  AC_VALUE_IDEAL_MAX: 6,    // AC值理想范围上限
  CONSECUTIVE_GROUPS_MAX: 2, // 最大连号组数
  GAP_VARIANCE_MIN: 8,      // 间距方差最小值（从10降至8）
  GAP_VARIANCE_MAX: 55,     // 间距方差最大值（从50增至55）
  SUM_RANGE_MIN: 65,        // 和值合理范围下限（从50提高到65）
  SUM_RANGE_MAX: 115,       // 和值合理范围上限（从130降到115）
  SPAN_DIFF_THRESHOLD: 12,  // 跨度差异阈值（从10增至12）
  SUM_DIFF_THRESHOLD: 35,   // 和值差异阈值（从30增至35）
};

class LotteryAnalyzer {
  constructor() {
    this.frontNumbers = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1);
    this.backNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1);
    this.historyData = [];
    
    // 缓存机制
    this.cache = {
      frequency: null,
      expectedValue: null,
      variance: null,
      hotCold: null,
      omission: null,
      timeDecayWeights: null,
      sumTrend: null,        // 和值趋势缓存
      spanAnalysis: null,    // 跨度分析缓存
      repeatNumbers: null,   // 重号分析缓存
      modelPerformance: null, // 模型表现缓存
      dataVersion: 0
    };
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = {
      frequency: null,
      expectedValue: null,
      variance: null,
      hotCold: null,
      omission: null,
      timeDecayWeights: null,
      sumTrend: null,
      spanAnalysis: null,
      repeatNumbers: null,
      modelPerformance: null,
      dataVersion: this.cache.dataVersion + 1
    };
  }

  loadHistoryData(dataStr, sourceName = "默认数据") {
    this.historyData = []; // 清空历史数据
    this.clearCache(); // 清除缓存
    
    const lines = dataStr.trim().split('\n');
    let count = 0;
    for (const line of lines) {
      if (line.trim()) {
        const numbers = line.trim().split(/\s+/).map(Number);
        
        // 数据验证
        if (numbers.length !== 7) {
          console.warn(`跳过无效数据行: ${line} (号码数量不为7)`);
          continue;
        }
        
        const front = numbers.slice(0, 5);
        const back = numbers.slice(5);
        
        // 验证号码范围
        const isValidFront = front.every(n => n >= 1 && n <= CONFIG.FRONT_RANGE);
        const isValidBack = back.every(n => n >= 1 && n <= CONFIG.BACK_RANGE);
        
        if (!isValidFront || !isValidBack) {
          console.warn(`跳过无效数据行: ${line} (号码超出范围)`);
          continue;
        }
        
        // 验证重复
        const hasDuplicate = new Set(front).size !== front.length || new Set(back).size !== back.length;
        if (hasDuplicate) {
          console.warn(`跳过无效数据行: ${line} (存在重复号码)`);
          continue;
        }
        
        this.historyData.push({
          front,
          back,
          full: numbers,
          source: sourceName
        });
        count++;
      }
    }
    return count;
  }

  analyzeFrequency() {
    // 使用缓存
    if (this.cache.frequency) {
      return this.cache.frequency;
    }
    
    const frontCounter = {};
    const backCounter = {};
    
    // 初始化计数器
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      frontCounter[i] = 0;
    }
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      backCounter[i] = 0;
    }
    
    for (const data of this.historyData) {
      for (const num of data.front) {
        frontCounter[num]++;
      }
      for (const num of data.back) {
        backCounter[num]++;
      }
    }
    
    const result = [frontCounter, backCounter];
    this.cache.frequency = result;
    return result;
  }

  getHotColdNumbers(topN = CONFIG.HOT_NUMBERS_COUNT) {
    // 使用缓存
    if (this.cache.hotCold && this.cache.hotCold.topN === topN) {
      return this.cache.hotCold.result;
    }
    
    const [frontCounter, backCounter] = this.analyzeFrequency();
    
    const sortByCount = (counter) => Object.entries(counter).sort((a, b) => b[1] - a[1]);
    
    const frontSorted = sortByCount(frontCounter);
    const backSorted = sortByCount(backCounter);
    
    const result = {
      frontHot: frontSorted.slice(0, topN),
      frontCold: frontSorted.slice(-topN).reverse(),
      backHot: backSorted.slice(0, topN),
      backCold: backSorted.slice(-topN).reverse()
    };
    
    this.cache.hotCold = { topN, result };
    return result;
  }

  calculateExpectedValue() {
    // 使用缓存
    if (this.cache.expectedValue) {
      return this.cache.expectedValue;
    }
    
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const totalFront = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const totalBack = Object.values(backCounter).reduce((a, b) => a + b, 0);
    
    const expFront = totalFront > 0 
      ? Object.entries(frontCounter).reduce((sum, [num, count]) => sum + Number(num) * count, 0) / totalFront 
      : (CONFIG.FRONT_RANGE + 1) / 2; // 默认值为中间值 18
      
    const expBack = totalBack > 0 
      ? Object.entries(backCounter).reduce((sum, [num, count]) => sum + Number(num) * count, 0) / totalBack 
      : (CONFIG.BACK_RANGE + 1) / 2; // 默认值为中间值 6.5
      
    const result = [expFront, expBack];
    this.cache.expectedValue = result;
    return result;
  }

  calculateVariance() {
    // 使用缓存
    if (this.cache.variance) {
      return this.cache.variance;
    }
    
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const [expFront, expBack] = this.calculateExpectedValue();
    const totalFront = Object.values(frontCounter).reduce((a, b) => a + b, 0);
    const totalBack = Object.values(backCounter).reduce((a, b) => a + b, 0);
    
    const varFront = totalFront > 0 
      ? Object.entries(frontCounter).reduce((sum, [num, count]) => sum + count * Math.pow(Number(num) - expFront, 2), 0) / totalFront 
      : 0;
      
    const varBack = totalBack > 0 
      ? Object.entries(backCounter).reduce((sum, [num, count]) => sum + count * Math.pow(Number(num) - expBack, 2), 0) / totalBack 
      : 0;
      
    const result = {
      frontVar: varFront,
      frontStd: Math.sqrt(varFront),
      backVar: varBack,
      backStd: Math.sqrt(varBack)
    };
    
    this.cache.variance = result;
    return result;
  }

  /**
   * 计算和值概率分布
   */
  calculateSumProbability() {
    const sumCount = { front: {}, back: {} };
    
    // 统计历史数据中的和值分布
    for (const data of this.historyData) {
      const frontSum = data.front.reduce((a, b) => a + b, 0);
      const backSum = data.back.reduce((a, b) => a + b, 0);
      
      sumCount.front[frontSum] = (sumCount.front[frontSum] || 0) + 1;
      sumCount.back[backSum] = (sumCount.back[backSum] || 0) + 1;
    }
    
    // 计算概率
    const totalDraws = this.historyData.length || 1;
    const frontProb = {};
    const backProb = {};
    
    for (const [sum, count] of Object.entries(sumCount.front)) {
      frontProb[sum] = (count / totalDraws * 100).toFixed(1);
    }
    
    for (const [sum, count] of Object.entries(sumCount.back)) {
      backProb[sum] = (count / totalDraws * 100).toFixed(1);
    }
    
    return { front: frontProb, back: backProb };
  }

  generateStatisticalPrediction(strategy = 'weighted') {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const [expFront, expBack] = this.calculateExpectedValue();
    const variance = this.calculateVariance();
    
    let front = [], back = [];
    
    if (strategy === 'weighted') {
      const uniqueFrontNums = Object.keys(frontCounter).map(Number);
      const uniqueFrontWeights = Object.values(frontCounter);
      for (let n = 1; n <= CONFIG.FRONT_RANGE; n++) {
        if (!frontCounter[n]) {
          uniqueFrontNums.push(n);
          uniqueFrontWeights.push(1);
        }
      }
      
      const uniqueBackNums = Object.keys(backCounter).map(Number);
      const uniqueBackWeights = Object.values(backCounter);
      for (let n = 1; n <= CONFIG.BACK_RANGE; n++) {
        if (!backCounter[n]) {
          uniqueBackNums.push(n);
          uniqueBackWeights.push(1);
        }
      }
      
      front = this.weightedSampleNoReplacement(uniqueFrontNums, uniqueFrontWeights, CONFIG.FRONT_COUNT);
      back = this.weightedSampleNoReplacement(uniqueBackNums, uniqueBackWeights, CONFIG.BACK_COUNT);
      
    } else if (strategy === 'regression') {
      // 添加最大迭代次数限制，防止无限循环
      let iterations = 0;
      while (front.length < CONFIG.FRONT_COUNT && iterations < CONFIG.MAX_ITERATIONS) {
        const num = Math.round(this.gaussianRandom(expFront, variance.frontStd));
        if (num >= 1 && num <= CONFIG.FRONT_RANGE && !front.includes(num)) {
          front.push(num);
        }
        iterations++;
      }
      
      iterations = 0;
      while (back.length < CONFIG.BACK_COUNT && iterations < CONFIG.MAX_ITERATIONS) {
        const num = Math.round(this.gaussianRandom(expBack, variance.backStd));
        if (num >= 1 && num <= CONFIG.BACK_RANGE && !back.includes(num)) {
          back.push(num);
        }
        iterations++;
      }
      
      // 如果未能选够号码，用随机号码补充
      if (front.length < CONFIG.FRONT_COUNT) {
        const remaining = this.frontNumbers.filter(n => !front.includes(n));
        front = [...front, ...this.randomSample(remaining, CONFIG.FRONT_COUNT - front.length)];
      }
      if (back.length < CONFIG.BACK_COUNT) {
        const remaining = this.backNumbers.filter(n => !back.includes(n));
        back = [...back, ...this.randomSample(remaining, CONFIG.BACK_COUNT - back.length)];
      }
      
    } else if (strategy === 'distribution') {
      // 优化：使用更智能的选号策略，结合质量评估
      const targetSumFront = Math.round(expFront * CONFIG.FRONT_COUNT);
      const targetSumBack = Math.round(expBack * CONFIG.BACK_COUNT);
      
      let bestFront = null, bestBack = null;
      let bestScore = -Infinity;
      
      for (let i = 0; i < CONFIG.DISTRIBUTION_TRY_COUNT; i++) {
        const f = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
        const b = this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
        
        const sumF = f.reduce((a, b) => a + b, 0);
        const sumB = b.reduce((a, b) => a + b, 0);
        
        const diffF = Math.abs(sumF - targetSumFront);
        const diffB = Math.abs(sumB - targetSumBack);
        
        // 综合评分：和值接近度 + 组合质量
        const sumScore = 100 - (diffF / targetSumFront * 50 + diffB / targetSumBack * 50);
        const qualityScore = this.evaluateCombination(f, b);
        const totalScore = sumScore * 0.4 + qualityScore * 0.6;
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestFront = f;
          bestBack = b;
        }
        
        // 如果找到高质量组合，提前退出
        if (diffF < 10 && diffB < 4 && qualityScore >= 70) {
          front = f;
          back = b;
          break;
        }
      }
      
      // 使用最优解
      if (front.length === 0) front = bestFront || this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
      if (back.length === 0) back = bestBack || this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
      
    } else if (strategy === 'balanced') {
      // 平衡策略：混合热号、温号和冷号
      const sortedFront = Object.entries(frontCounter).sort((a, b) => b[1] - a[1]);
      const hotFrontNums = sortedFront.slice(0, CONFIG.HOT_NUMBERS_COUNT).map(x => Number(x[0]));
      const coldFrontNums = sortedFront.slice(-CONFIG.COLD_NUMBERS_COUNT).map(x => Number(x[0]));
      const warmFrontNums = sortedFront.slice(CONFIG.HOT_NUMBERS_COUNT, -CONFIG.COLD_NUMBERS_COUNT).map(x => Number(x[0]));
      
      const sortedBack = Object.entries(backCounter).sort((a, b) => b[1] - a[1]);
      const hotBackNums = sortedBack.slice(0, 4).map(x => Number(x[0]));
      const coldBackNums = sortedBack.slice(-4).map(x => Number(x[0]));
      const warmBackNums = sortedBack.slice(4, -4).map(x => Number(x[0]));
      
      // 前区：1个热号 + 2个温号 + 1个冷号 + 1个随机
      const selectedHotFront = this.randomSample(hotFrontNums, 1);
      const selectedWarmFront = this.randomSample(warmFrontNums, Math.min(2, warmFrontNums.length));
      const selectedColdFront = this.randomSample(coldFrontNums, Math.min(1, coldFrontNums.length));
      
      const usedNumbers = new Set([...selectedHotFront, ...selectedWarmFront, ...selectedColdFront]);
      const remainingFront = this.frontNumbers.filter(n => !usedNumbers.has(n));
      const neededCount = CONFIG.FRONT_COUNT - usedNumbers.size;
      const selectedRandomFront = neededCount > 0 ? this.randomSample(remainingFront, neededCount) : [];
      
      front = [...selectedHotFront, ...selectedWarmFront, ...selectedColdFront, ...selectedRandomFront];
      
      // 后区：1个热号 + 1个冷号（或温号）
      const selectedHotBack = this.randomSample(hotBackNums, 1);
      const usedBack = new Set(selectedHotBack);
      const remainingBack = this.backNumbers.filter(n => !usedBack.has(n));
      const selectedRandomBack = this.randomSample(remainingBack, CONFIG.BACK_COUNT - selectedHotBack.length);
      
      back = [...selectedHotBack, ...selectedRandomBack];
    }
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  generateOmissionBasedPrediction() {
    const omission = this.calculateOmission();
    
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
    
    // 选择遗漏值在均值附近 ±1 标准差范围内的号码（回归理论）
    const frontCandidates = Object.entries(omission.front)
      .filter(([_, val]) => Math.abs(val - frontMean) <= frontStd)
      .map(x => Number(x[0]));
    
    const backCandidates = Object.entries(omission.back)
      .filter(([_, val]) => Math.abs(val - backMean) <= backStd)
      .map(x => Number(x[0]));
    
    // 如果候选号码不足，扩大范围到 ±1.5 标准差
    const frontFinal = frontCandidates.length >= CONFIG.FRONT_COUNT 
      ? frontCandidates 
      : Object.entries(omission.front)
          .filter(([_, val]) => Math.abs(val - frontMean) <= frontStd * 1.5)
          .map(x => Number(x[0]));
    
    const backFinal = backCandidates.length >= CONFIG.BACK_COUNT 
      ? backCandidates 
      : Object.entries(omission.back)
          .filter(([_, val]) => Math.abs(val - backMean) <= backStd * 1.5)
          .map(x => Number(x[0]));
    
    const front = frontFinal.length >= CONFIG.FRONT_COUNT 
      ? this.randomSample(frontFinal, CONFIG.FRONT_COUNT) 
      : this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
    
    const back = backFinal.length >= CONFIG.BACK_COUNT 
      ? this.randomSample(backFinal, CONFIG.BACK_COUNT) 
      : this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  generateTimeDecayPrediction(decayFactor = CONFIG.TIME_DECAY_FACTOR) {
    const weights = this.calculateTimeDecayWeights(decayFactor);
    const frontNums = Object.keys(weights.front).map(Number);
    const frontW = Object.values(weights.front);
    const backNums = Object.keys(weights.back).map(Number);
    const backW = Object.values(weights.back);
    
    const front = this.weightedSampleNoReplacement(frontNums, frontW, CONFIG.FRONT_COUNT);
    const back = this.weightedSampleNoReplacement(backNums, backW, CONFIG.BACK_COUNT);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  /**
   * 周易时空预测模型（优化版 v2）
   * 基于用户点击生成的实际时间，结合周易卦象和开奖周期
   * 开奖时间：周一、周三、周六
   * 优化：增加卦象组合的多样性，改进后区选择策略
   */
  generateZhouyiPrediction(iteration = 0) {
    const now = new Date();
    
    // 获取时间要素（用于卦象计算）
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds(); // 新增秒数，增加随机性
    const weekday = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
    
    // 计算距离下次开奖的天数
    // 开奖日：周一(1)、周三(3)、周六(6)
    const drawDays = [1, 3, 6];
    let daysToNextDraw = 0;
    for (const drawDay of drawDays) {
      let diff = drawDay - weekday;
      if (diff < 0) diff += 7;
      if (diff === 0 && hour >= 20) { // 假设晚上8点后算第二天
        diff = 7;
      }
      if (diff > 0) {
        daysToNextDraw = diff;
        break;
      }
    }
    if (daysToNextDraw === 0) daysToNextDraw = 7;
    
    // 上卦：年+月+日+iteration 除以8的余数（加入iteration增加多样性）
    const upperTrigram = (year + month + day + iteration) % 8;
    
    // 下卦：年+月+日+时+分 除以8的余数
    const lowerTrigram = (year + month + day + hour + minute) % 8;
    
    // 动爻：年+月+日+时+分+秒+距开奖天数 除以6的余数（加入秒数）
    const movingLine = (year + month + day + hour + minute + second + daysToNextDraw) % 6;
    
    // 八卦对应的号码池（根据先天八卦数，优化分布）
    // 乾1、兑2、离3、震4、巽5、坎6、艮7、坤8
    const trigramElements = {
      0: [1, 8, 15, 22, 29],      // 坤卦：大地之数（均匀分布）
      1: [2, 9, 16, 23, 30],      // 乾卦：天行之数
      2: [3, 10, 17, 24, 31],     // 兑卦：泽润之数
      3: [4, 11, 18, 25, 32],     // 离卦：火明之数
      4: [5, 12, 19, 26, 33],     // 震卦：雷动之数
      5: [6, 13, 20, 27, 34],     // 巽卦：风入之数
      6: [7, 14, 21, 28, 35],     // 坎卦：水润之数
      7: [1, 9, 17, 25, 33]       // 艮卦：山止之数（与坤卦呼应）
    };
    
    // 根据上卦和下卦组合选号
    const poolUpper = trigramElements[upperTrigram] || [];
    const poolLower = trigramElements[lowerTrigram] || [];
    
    // 合并两个卦象的号码池
    const combinedPool = [...new Set([...poolUpper, ...poolLower])];
    
    // 如果号码池不足，补充其他相关号码
    if (combinedPool.length < CONFIG.FRONT_COUNT) {
      // 添加动爻相关的号码（扩大范围）
      const movingLineNumbers = [
        movingLine + 1,
        movingLine + 6,
        movingLine + 11,
        movingLine + 16,
        movingLine + 21,
        movingLine + 26,
        movingLine + 31
      ].filter(n => n >= 1 && n <= CONFIG.FRONT_RANGE);
      
      combinedPool.push(...movingLineNumbers);
    }
    
    // 从组合池中选取前区号码（使用加权采样，优先选择历史频率较高的号码）
    const [frontCounter] = this.analyzeFrequency();
    const poolWithWeights = combinedPool.map(num => ({
      num,
      weight: (frontCounter[num] || 0) + 1 // 基础权重+1避免为0
    }));
    
    const nums = poolWithWeights.map(x => x.num);
    const weights = poolWithWeights.map(x => x.weight);
    let front = this.weightedSampleNoReplacement(nums, weights, CONFIG.FRONT_COUNT);
    
    // 如果仍然不足，用随机号码补充
    if (front.length < CONFIG.FRONT_COUNT) {
      const remaining = this.frontNumbers.filter(n => !front.includes(n));
      front = [...front, ...this.randomSample(remaining, CONFIG.FRONT_COUNT - front.length)];
    }
    
    // 后区号码优化：结合时辰、动爻和历史频率
    const [_, backCounter] = this.analyzeFrequency();
    
    // 十二时辰对应后区号码（扩展候选池）
    const hourBackMap = {
      0: [1, 6, 7, 12],   // 子时
      1: [1, 6, 7, 12],   // 子时
      2: [2, 5, 8, 11],   // 丑时
      3: [2, 5, 8, 11],   // 丑时
      4: [3, 4, 9, 10],   // 寅时
      5: [3, 4, 9, 10],   // 寅时
      6: [1, 4, 7, 10],   // 卯时
      7: [1, 4, 7, 10],   // 卯时
      8: [2, 5, 8, 11],   // 辰时
      9: [2, 5, 8, 11],   // 辰时
      10: [3, 6, 9, 12],  // 巳时
      11: [3, 6, 9, 12],  // 巳时
      12: [1, 6, 7, 12],  // 午时
      13: [1, 6, 7, 12],  // 午时
      14: [2, 5, 8, 11],  // 未时
      15: [2, 5, 8, 11],  // 未时
      16: [3, 4, 9, 10],  // 申时
      17: [3, 4, 9, 10],  // 申时
      18: [1, 4, 7, 10],  // 酉时
      19: [1, 4, 7, 10],  // 酉时
      20: [2, 5, 8, 11],  // 戌时
      21: [2, 5, 8, 11],  // 戌时
      22: [3, 6, 9, 12],  // 亥时
      23: [3, 6, 9, 12]   // 亥时
    };
    
    const backCandidates = hourBackMap[hour] || [1, 6, 7, 12];
    
    // 根据动爻和后区历史频率选择
    const backWithWeights = backCandidates.map(num => ({
      num,
      weight: (backCounter[num] || 0) + 1
    }));
    
    const backNums = backWithWeights.map(x => x.num);
    const backWeights = backWithWeights.map(x => x.weight);
    const back = this.weightedSampleNoReplacement(backNums, backWeights, CONFIG.BACK_COUNT);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  /**
   * 贝叶斯动态预测模型（优化版 v3）
   * 基于历史数据计算条件概率，动态调整预测权重
   * 性能优化：使用向量化计算，避免三层嵌套循环
   * 优化：增加遗漏值因子、区间平衡因子、趋势分析、重号策略
   */
  generateBayesianPrediction() {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const omission = this.calculateOmission();
    const sumTrend = this.analyzeSumTrend();
    const repeatAnalysis = this.analyzeRepeatNumbers();
    const totalDraws = this.historyData.length;
    
    if (totalDraws === 0) {
      // 如果没有历史数据，返回随机号码
      const front = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
      const back = this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
      front.sort((a, b) => a - b);
      back.sort((a, b) => a - b);
      return [...front, ...back];
    }
    
    // 计算先验概率（每个号码出现的频率）
    const priorFront = {};
    const priorBack = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      priorFront[i] = (frontCounter[i] || 0) / totalDraws;
    }
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      priorBack[i] = (backCounter[i] || 0) / totalDraws;
    }
    
    // 优化：使用后验概率选择号码（结合先验、时间加权、遗漏值、趋势）
    const posteriorFront = {};
    const posteriorBack = {};
    
    // 计算平均遗漏值（用于回归分析）
    const frontOmissionValues = Object.values(omission.front);
    const backOmissionValues = Object.values(omission.back);
    const frontAvgOmission = frontOmissionValues.reduce((a, b) => a + b, 0) / frontOmissionValues.length;
    const backAvgOmission = backOmissionValues.reduce((a, b) => a + b, 0) / backOmissionValues.length;
    
    // 获取上期开奖号码（用于重号分析）
    const lastDraw = this.historyData.length > 0 ? this.historyData[this.historyData.length - 1] : null;
    
    // 前区后验概率计算
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      let score = priorFront[i] * 0.35; // 进一步降低先验权重
      
      // 时间加权：近期数据权重更高
      let timeScore = 0;
      for (let idx = 0; idx < this.historyData.length; idx++) {
        const draw = this.historyData[idx];
        if (draw.front.includes(i)) {
          const timeWeight = Math.exp((idx - this.historyData.length + 1) / this.historyData.length);
          timeScore += timeWeight * 0.2;
        }
      }
      score += timeScore;
      
      // 遗漏值因子：接近平均遗漏值的号码得分更高（均值回归理论）
      const currentOmission = omission.front[i] || 0;
      const omissionDiff = Math.abs(currentOmission - frontAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (frontAvgOmission * 2));
      score += omissionFactor * 0.25;
      
      // 区间平衡因子：确保号码分布均匀
      const zoneIndex = Math.floor((i - 1) / 5); // 7个区间
      const zoneBonus = (zoneIndex % 2 === 0) ? 0.05 : 0; // 交替加分
      score += zoneBonus;
      
      // 重号因子：上期出现的号码给予额外权重
      if (lastDraw && lastDraw.front.includes(i)) {
        score += repeatAnalysis.frontRepeatRate * 0.15; // 根据重号率调整
      }
      
      // 和值趋势因子：如果和值呈上升趋势，偏向大号
      if (sumTrend.trendFront > 5 && i > 18) {
        score += 0.05; // 上升趋势，大号加分
      } else if (sumTrend.trendFront < -5 && i <= 18) {
        score += 0.05; // 下降趋势，小号加分
      }
      
      posteriorFront[i] = score;
    }
    
    // 后区后验概率计算
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      let score = priorBack[i] * 0.35;
      
      let timeScore = 0;
      for (let idx = 0; idx < this.historyData.length; idx++) {
        const draw = this.historyData[idx];
        if (draw.back.includes(i)) {
          const timeWeight = Math.exp((idx - this.historyData.length + 1) / this.historyData.length);
          timeScore += timeWeight * 0.2;
        }
      }
      score += timeScore;
      
      // 遗漏值因子
      const currentOmission = omission.back[i] || 0;
      const omissionDiff = Math.abs(currentOmission - backAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (backAvgOmission * 2));
      score += omissionFactor * 0.25;
      
      // 奇偶平衡因子
      const oddEvenBonus = (i % 2 === 1) ? 0.05 : 0; // 奇数稍加分
      score += oddEvenBonus;
      
      // 重号因子（后区重号率通常较高）
      if (lastDraw && lastDraw.back.includes(i)) {
        score += repeatAnalysis.backRepeatRate * 0.2; // 后区重号加成更高
      }
      
      posteriorBack[i] = score;
    }
    
    // 选择后验概率最高的号码作为候选池
    const sortedFront = Object.entries(posteriorFront)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.BAYESIAN_CANDIDATE_FRONT)
      .map(x => Number(x[0]));
    
    const sortedBack = Object.entries(posteriorBack)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.BAYESIAN_CANDIDATE_BACK)
      .map(x => Number(x[0]));
    
    const front = this.randomSample(sortedFront, CONFIG.FRONT_COUNT);
    const back = this.randomSample(sortedBack, CONFIG.BACK_COUNT);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  /**
   * 旋转矩阵优化模型（优化版 v2）
   * 使用组合数学方法生成覆盖度最优的号码组合
   * 优化：增加更多策略，提高多样性
   */
  generateRotationMatrixPrediction(groups = 1) {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const omission = this.calculateOmission();
    
    // 根据频率排序，选择高频号码作为基础池
    const sortedFrontNums = Object.entries(frontCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.ROTATION_HIGH_FREQ)
      .map(x => Number(x[0]));
    
    const sortedBackNums = Object.entries(backCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.ROTATION_LOW_FREQ)
      .map(x => Number(x[0]));
    
    // 添加一些低频号以增加多样性
    const lowFreqFront = Object.entries(frontCounter)
      .filter(([_, count]) => count === 0 || count <= 2)
      .map(x => Number(x[0]))
      .slice(0, 8); // 增加到8个
    
    // 添加遗漏值较大的号码
    const highOmissionFront = Object.entries(omission.front)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(x => Number(x[0]));
    
    const allFrontPool = [...new Set([...sortedFrontNums, ...lowFreqFront, ...highOmissionFront])];
    const allBackPool = [...new Set([...sortedBackNums])];
    
    const results = [];
    
    for (let g = 0; g < groups; g++) {
      let front;
      
      // 5种不同的旋转策略
      if (g % 5 === 0) {
        // 策略1：主要高频号
        front = this.randomSample(sortedFrontNums, CONFIG.FRONT_COUNT);
      } else if (g % 5 === 1) {
        // 策略2：混合高频和中频
        const midFreq = allFrontPool.filter(n => !sortedFrontNums.includes(n)).slice(0, 12);
        const mixed = [...sortedFrontNums.slice(0, 10), ...midFreq];
        front = this.randomSample(mixed, CONFIG.FRONT_COUNT);
      } else if (g % 5 === 2) {
        // 策略3：包含冷门号
        const withCold = [...sortedFrontNums.slice(0, 10), ...lowFreqFront.slice(0, 5)];
        front = this.randomSample(withCold, CONFIG.FRONT_COUNT);
      } else if (g % 5 === 3) {
        // 策略4：遗漏值回归策略
        const withOmission = [...highOmissionFront.slice(0, 3), ...sortedFrontNums.slice(0, 12)];
        front = this.randomSample(withOmission, CONFIG.FRONT_COUNT);
      } else {
        // 策略5：全池随机（增加探索性）
        front = this.randomSample(allFrontPool, CONFIG.FRONT_COUNT);
      }
      
      // 后区也采用不同策略
      let back;
      if (g % 3 === 0) {
        back = this.randomSample(sortedBackNums, CONFIG.BACK_COUNT);
      } else if (g % 3 === 1) {
        // 混合高低频
        const allBackExpanded = [...sortedBackNums, ...this.backNumbers.filter(n => !sortedBackNums.includes(n)).slice(0, 4)];
        back = this.randomSample(allBackExpanded, CONFIG.BACK_COUNT);
      } else {
        // 基于遗漏值
        const backByOmission = Object.entries(omission.back)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(x => Number(x[0]));
        back = this.randomSample(backByOmission, CONFIG.BACK_COUNT);
      }
      
      front.sort((a, b) => a - b);
      back.sort((a, b) => a - b);
      results.push({ front, back });
    }
    
    return results;
  }

  /**
   * 混合预测模型（优化版 v4）
   * 结合周易、贝叶斯和旋转矩阵的优势
   * 科学性：基于多模型投票机制，提高稳定性
   * 优化：加入趋势分析、重号策略、智能权重调整、AC值、连号等特征
   */
  generateHybridPrediction() {
    // 获取新增的分析数据
    const sumTrend = this.analyzeSumTrend();
    const spanAnalysis = this.analyzeSpan();
    const repeatAnalysis = this.analyzeRepeatNumbers();
    const modelWeights = this.evaluateModelPerformance();
    const zoneRotation = this.analyzeZoneRotation(); // 区间轮动分析
    
    // 生成三个模型的预测结果
    const zhouyi = this.generateZhouyiPrediction();
    const bayesian = this.generateBayesianPrediction();
    const rotationResults = this.generateRotationMatrixPrediction(1);
    const rotation = rotationResults[0];
    
    // 前区：收集所有模型的候选号码，并根据模型权重加权投票
    const zhouyiFront = zhouyi.slice(0, 5);
    const bayesianFront = bayesian.slice(0, 5);
    const rotationFront = rotation.front;
    
    // 加权投票机制
    const voteCount = {};
    zhouyiFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + modelWeights.zhouyi;
    });
    bayesianFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + modelWeights.bayesian;
    });
    rotationFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + modelWeights.rotation;
    });
    
    // 按票数排序，票数相同则随机打乱
    const candidates = Object.entries(voteCount)
      .sort((a, b) => {
        if (Math.abs(b[1] - a[1]) > 0.01) return b[1] - a[1];
        return Math.random() - 0.5;
      })
      .map(x => Number(x[0]));
    
    // 如果候选号码不足，补充高质量号码
    if (candidates.length < CONFIG.FRONT_COUNT) {
      const [frontCounter] = this.analyzeFrequency();
      const remaining = this.frontNumbers
        .filter(n => !candidates.includes(n))
        .sort((a, b) => (frontCounter[b] || 0) - (frontCounter[a] || 0));
      candidates.push(...remaining.slice(0, CONFIG.FRONT_COUNT - candidates.length));
    }
    
    // 从候选中选择前区号码，并进行质量评估（增加尝试次数）
    let bestFront = null;
    let bestScore = -Infinity;
    
    for (let i = 0; i < 200; i++) { // 增加到200次尝试（数据充足）
      const selected = this.randomSample(candidates, CONFIG.FRONT_COUNT);
      
      // 检查是否符合跨度要求（放宽阈值）
      const span = Math.max(...selected) - Math.min(...selected);
      const spanDiff = Math.abs(span - spanAnalysis.avgFrontSpan);
      if (spanDiff > CONFIG.SPAN_DIFF_THRESHOLD) continue;
      
      // 检查和值要求（放宽阈值）
      const sum = selected.reduce((a, b) => a + b, 0);
      const sumDiff = Math.abs(sum - sumTrend.avgFrontSum);
      if (sumDiff > CONFIG.SUM_DIFF_THRESHOLD) continue;
      
      // 检查AC值（基于208期数据：93.3%在4-7之间）
      const acValue = this.calculateACValue(selected);
      if (acValue < CONFIG.AC_VALUE_MIN || acValue > CONFIG.AC_VALUE_MAX) continue;
      
      // 检查连号合理性（允许1-2组连号，49%的期数有连号）
      const consecutiveGroups = this.analyzeConsecutiveNumbers(selected);
      if (consecutiveGroups.length > CONFIG.CONSECUTIVE_GROUPS_MAX) continue;
      
      const score = this.evaluateCombination(selected, [1, 2]); // 临时后区
      
      if (score > bestScore) {
        bestScore = score;
        bestFront = selected;
      }
      
      // 如果找到高质量组合，提前退出
      if (score >= CONFIG.QUALITY_SCORE_THRESHOLD) {
        break;
      }
    }
    
    const front = bestFront || this.randomSample(candidates, CONFIG.FRONT_COUNT);
    
    // 后区：使用投票机制 + 重号策略
    const zhouyiBack = zhouyi.slice(5);
    const bayesianBack = bayesian.slice(5);
    const rotationBack = rotation.back;
    
    const backVoteCount = {};
    zhouyiBack.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + modelWeights.zhouyi;
    });
    bayesianBack.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + modelWeights.bayesian;
    });
    rotationBack.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + modelWeights.rotation;
    });
    
    // 如果有上期开奖数据，考虑重号策略
    if (this.historyData.length > 0) {
      const lastDraw = this.historyData[this.historyData.length - 1];
      lastDraw.back.forEach(num => {
        // 重号给予额外权重
        if (backVoteCount[num]) {
          backVoteCount[num] += 0.3; // 重号加成
        }
      });
    }
    
    const backCandidates = Object.entries(backVoteCount)
      .sort((a, b) => b[1] - a[1])
      .map(x => Number(x[0]));
    
    // 如果候选不足，补充
    if (backCandidates.length < CONFIG.BACK_COUNT) {
      const [_, backCounter] = this.analyzeFrequency();
      const remaining = this.backNumbers
        .filter(n => !backCandidates.includes(n))
        .sort((a, b) => (backCounter[b] || 0) - (backCounter[a] || 0));
      backCandidates.push(...remaining.slice(0, CONFIG.BACK_COUNT - backCandidates.length));
    }
    
    const back = backCandidates.slice(0, CONFIG.BACK_COUNT);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  // 辅助函数
  /**
   * 优化的加权采样（无放回）
   * 使用累积权重数组，时间复杂度从 O(n²) 降低到 O(n log n)
   */
  weightedSampleNoReplacement(pool, weights, k) {
    const selected = [];
    const poolCopy = [...pool];
    const weightsCopy = [...weights];
    
    for (let i = 0; i < k; i++) {
      if (poolCopy.length === 0) break;
      
      // 计算累积权重
      const cumulativeWeights = [];
      let sum = 0;
      for (const w of weightsCopy) {
        sum += w;
        cumulativeWeights.push(sum);
      }
      
      // 生成随机数并二分查找
      const random = Math.random() * sum;
      let left = 0, right = cumulativeWeights.length - 1;
      let idx = right;
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (cumulativeWeights[mid] >= random) {
          idx = mid;
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }
      
      selected.push(poolCopy[idx]);
      poolCopy.splice(idx, 1);
      weightsCopy.splice(idx, 1);
    }
    return selected;
  }

  randomSample(arr, k) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, k);
  }

  /**
   * 评估号码组合的质量（优化版 v4）
   * 返回评分（0-100），分数越高表示组合越合理
   * 新增：AC值、间距分布、连号合理性、冷热交替等特征
   */
  evaluateCombination(front, back) {
    let score = 100;
    
    // 1. 检查奇偶比（理想为 2:3 或 3:2）
    const oddCount = front.filter(n => n % 2 !== 0).length;
    const evenCount = CONFIG.FRONT_COUNT - oddCount;
    if (oddCount === 0 || evenCount === 0) {
      score -= 30; // 全奇或全偶，扣分
    } else if (Math.abs(oddCount - evenCount) > 2) {
      score -= 15; // 奇偶失衡
    }
    
    // 2. 检查大小比（以18为界，理想为 2:3 或 3:2）
    const smallCount = front.filter(n => n <= 18).length;
    const largeCount = CONFIG.FRONT_COUNT - smallCount;
    if (smallCount === 0 || largeCount === 0) {
      score -= 30; // 全大或全小，扣分
    } else if (Math.abs(smallCount - largeCount) > 2) {
      score -= 15; // 大小失衡
    }
    
    // 3. 检查区间分布（将35个号分为7个区间，每个区间5个数）
    const zones = new Array(7).fill(0);
    front.forEach(n => {
      const zoneIndex = Math.floor((n - 1) / 5);
      zones[zoneIndex]++;
    });
    const emptyZones = zones.filter(z => z === 0).length;
    if (emptyZones >= 4) {
      score -= 20; // 空区太多
    } else if (emptyZones >= 3) {
      score -= 10;
    }
    
    // 4. 检查和值范围（基于208期数据：平均86.8，高频区间70-110）
    const frontSum = front.reduce((a, b) => a + b, 0);
    if (frontSum < CONFIG.SUM_RANGE_MIN || frontSum > CONFIG.SUM_RANGE_MAX) {
      score -= 18; // 和值超出合理范围
    } else if (frontSum >= 75 && frontSum <= 105) {
      score += 10; // 和值在高频区间，加分
    }
    
    // 5. 检查连号数量（优化：允许1-2组连号，这是常见现象）
    const consecutiveGroups = this.analyzeConsecutiveNumbers(front);
    if (consecutiveGroups.length >= 3) {
      score -= 25; // 连号组数太多
    } else if (consecutiveGroups.length === 2) {
      score -= 5;  // 2组连号，轻微扣分
    } else if (consecutiveGroups.length === 1) {
      score += 5;  // 1组连号，符合常态，加分
    }
    // 0组连号也不扣分，保持中性
    
    // 6. AC值分析（数字复杂指数）- 基于208期数据优化
    const acValue = this.calculateACValue(front);
    if (acValue < CONFIG.AC_VALUE_MIN) {
      score -= 20; // AC值太低，号码太集中
    } else if (acValue > CONFIG.AC_VALUE_MAX) {
      score -= 15; // AC值太高，号码太分散
    } else if (acValue >= CONFIG.AC_VALUE_IDEAL_MIN && acValue <= CONFIG.AC_VALUE_IDEAL_MAX) {
      score += 15; // AC值在理想范围(4-6)，大幅加分
    } else if (acValue === 3 || acValue === 7) {
      score += 5;  // AC值在可接受边界，轻微加分
    }
    
    // 7. 号码间距分布分析 - 基于208期数据优化
    const gaps = this.calculateNumberGaps(front);
    const gapVariance = this.calculateVarianceOfArray(gaps);
    if (gapVariance > CONFIG.GAP_VARIANCE_MAX) {
      score -= 12; // 间距差异太大，分布不均
    } else if (gapVariance < CONFIG.GAP_VARIANCE_MIN) {
      score -= 8;  // 间距太均匀，不够自然
    } else if (gapVariance >= 12 && gapVariance <= 35) {
      score += 8;  // 间距方差在理想范围，加分
    }
    
    // 8. 后区检查
    if (back.length === 2) {
      // 后区最好一奇一偶
      const backOdd = back.filter(n => n % 2 !== 0).length;
      if (backOdd === 0 || backOdd === 2) {
        score -= 10;
      }
      
      // 后区和值在 3-15 之间较合理
      const backSum = back.reduce((a, b) => a + b, 0);
      if (backSum < 3 || backSum > 15) {
        score -= 10;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  gaussianRandom(mean, stdDev) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return mean + stdDev * Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  }

  calculateOmission() {
    // 使用缓存
    if (this.cache.omission) {
      return this.cache.omission;
    }
    
    const frontOmission = {};
    const backOmission = {};
    this.frontNumbers.forEach(n => frontOmission[n] = 0);
    this.backNumbers.forEach(n => backOmission[n] = 0);
    
    // 修复：正确计算每个号码的连续遗漏期数
    for (const num of this.frontNumbers) {
      let omission = 0;
      for (let i = this.historyData.length - 1; i >= 0; i--) {
        if (this.historyData[i].front.includes(num)) {
          break; // 找到最近一次出现，停止计数
        }
        omission++;
      }
      frontOmission[num] = omission;
    }
    
    for (const num of this.backNumbers) {
      let omission = 0;
      for (let i = this.historyData.length - 1; i >= 0; i--) {
        if (this.historyData[i].back.includes(num)) {
          break; // 找到最近一次出现，停止计数
        }
        omission++;
      }
      backOmission[num] = omission;
    }
    
    const result = { front: frontOmission, back: backOmission };
    this.cache.omission = result;
    return result;
  }

  calculateTimeDecayWeights(decayFactor = CONFIG.TIME_DECAY_FACTOR) {
    // 使用缓存（带decayFactor检查）
    const cacheKey = `${decayFactor}`;
    if (this.cache.timeDecayWeights && this.cache.timeDecayWeights.key === cacheKey) {
      return this.cache.timeDecayWeights.result;
    }
    
    const frontWeights = {};
    const backWeights = {};
    this.frontNumbers.forEach(n => frontWeights[n] = 0);
    this.backNumbers.forEach(n => backWeights[n] = 0);
    
    for (let i = 0; i < this.historyData.length; i++) {
      const data = this.historyData[this.historyData.length - 1 - i];
      const weight = Math.pow(decayFactor, i);
      for (const num of data.front) frontWeights[num] += weight;
      for (const num of data.back) backWeights[num] += weight;
    }
    
    const result = { front: frontWeights, back: backWeights };
    this.cache.timeDecayWeights = { key: cacheKey, result };
    return result;
  }

  /**
   * 计算数组的方差
   */
  calculateVarianceOfArray(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return variance;
  }

  /**
   * 分析连号组数
   * @param {number[]} numbers - 已排序的号码数组
   * @returns {Array} 连号组数组，每组是一个连号序列
   * 例如: [6,7,18,21,30] -> [[6,7]]
   */
  analyzeConsecutiveNumbers(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) {
        currentGroup.push(sorted[i]);
      } else {
        if (currentGroup.length >= 2) {
          groups.push(currentGroup);
        }
        currentGroup = [sorted[i]];
      }
    }
    
    // 处理最后一组
    if (currentGroup.length >= 2) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * 计算AC值（数字复杂指数）
   * AC值 = 不同差值的总数 - (号码个数 - 1)
   * AC值越大，号码组合越复杂、越分散
   * 理想范围：4-7
   */
  calculateACValue(numbers) {
    const diffs = new Set();
    
    // 计算所有两两之间的差值
    for (let i = 0; i < numbers.length; i++) {
      for (let j = i + 1; j < numbers.length; j++) {
        const diff = Math.abs(numbers[i] - numbers[j]);
        if (diff > 0) {
          diffs.add(diff);
        }
      }
    }
    
    const acValue = diffs.size - (numbers.length - 1);
    return acValue;
  }

  /**
   * 计算号码间距
   * @param {number[]} numbers - 已排序的号码数组
   * @returns {number[]} 间距数组
   * 例如: [6,7,18,21,30] -> [1, 11, 3, 9]
   */
  calculateNumberGaps(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const gaps = [];
    
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }
    
    return gaps;
  }

  /**
   * 质合比分析（新增）
   * 质数: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31
   * 合数: 其他号码
   */
  analyzePrimeComposite(numbers) {
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);
    let primeCount = 0;
    let compositeCount = 0;
    
    numbers.forEach(num => {
      if (primes.has(num)) {
        primeCount++;
      } else {
        compositeCount++;
      }
    });
    
    return {
      primeCount,
      compositeCount,
      ratio: `${primeCount}:${compositeCount}`,
      isBalanced: Math.abs(primeCount - compositeCount) <= 1
    };
  }

  /**
   * 012路分析（新增）
   * 0路: 能被3整除的号码 (3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33)
   * 1路: 除以3余1的号码 (1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34)
   * 2路: 除以3余2的号码 (2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35)
   */
  analyze012Path(numbers) {
    const path0 = numbers.filter(n => n % 3 === 0).length;
    const path1 = numbers.filter(n => n % 3 === 1).length;
    const path2 = numbers.filter(n => n % 3 === 2).length;
    
    return {
      path0,
      path1,
      path2,
      ratio: `${path0}:${path1}:${path2}`,
      isBalanced: Math.max(path0, path1, path2) - Math.min(path0, path1, path2) <= 1
    };
  }

  /**
   * 尾数分析（新增）
   * 分析号码的个位数分布
   */
  analyzeTailNumbers(numbers) {
    const tailCount = new Array(10).fill(0);
    
    numbers.forEach(num => {
      const tail = num % 10;
      tailCount[tail]++;
    });
    
    const uniqueTails = tailCount.filter(c => c > 0).length;
    const maxTailCount = Math.max(...tailCount);
    
    return {
      tailCount,
      uniqueTails,
      maxTailCount,
      hasRepeat: maxTailCount > 1,
      distribution: tailCount.map((count, tail) => ({ tail, count })).filter(x => x.count > 0)
    };
  }

  /**
   * 分析和值趋势（新增）
   * 计算最近N期的和值变化趋势
   */
  analyzeSumTrend() {
    if (this.cache.sumTrend) {
      return this.cache.sumTrend;
    }
    
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, this.historyData.length);
    const recentDraws = this.historyData.slice(-recentCount);
    
    const frontSums = recentDraws.map(d => d.front.reduce((a, b) => a + b, 0));
    const backSums = recentDraws.map(d => d.back.reduce((a, b) => a + b, 0));
    
    // 计算平均值和标准差
    const avgFrontSum = frontSums.reduce((a, b) => a + b, 0) / frontSums.length;
    const avgBackSum = backSums.reduce((a, b) => a + b, 0) / backSums.length;
    
    const frontStd = Math.sqrt(
      frontSums.reduce((sum, val) => sum + Math.pow(val - avgFrontSum, 2), 0) / frontSums.length
    );
    const backStd = Math.sqrt(
      backSums.reduce((sum, val) => sum + Math.pow(val - avgBackSum, 2), 0) / backSums.length
    );
    
    // 判断趋势（上升、下降、平稳）
    const firstHalfFront = frontSums.slice(0, Math.floor(frontSums.length / 2));
    const secondHalfFront = frontSums.slice(Math.floor(frontSums.length / 2));
    const trendFront = secondHalfFront.reduce((a, b) => a + b, 0) / secondHalfFront.length - 
                       firstHalfFront.reduce((a, b) => a + b, 0) / firstHalfFront.length;
    
    const result = {
      avgFrontSum,
      avgBackSum,
      frontStd,
      backStd,
      trendFront, // 正值表示上升趋势，负值表示下降趋势
      recentFrontSums: frontSums,
      recentBackSums: backSums
    };
    
    this.cache.sumTrend = result;
    return result;
  }

  /**
   * 跨度分析（新增）
   * 分析最大号与最小号的差值
   */
  analyzeSpan() {
    if (this.cache.spanAnalysis) {
      return this.cache.spanAnalysis;
    }
    
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, this.historyData.length);
    const recentDraws = this.historyData.slice(-recentCount);
    
    const frontSpans = recentDraws.map(d => Math.max(...d.front) - Math.min(...d.front));
    const backSpans = recentDraws.map(d => Math.max(...d.back) - Math.min(...d.back));
    
    const avgFrontSpan = frontSpans.reduce((a, b) => a + b, 0) / frontSpans.length;
    const avgBackSpan = backSpans.reduce((a, b) => a + b, 0) / backSpans.length;
    
    const result = {
      avgFrontSpan,
      avgBackSpan,
      recentFrontSpans: frontSpans,
      recentBackSpans: backSpans
    };
    
    this.cache.spanAnalysis = result;
    return result;
  }

  /**
   * 重号分析（新增）
   * 分析上期号码在本期重复的概率
   */
  analyzeRepeatNumbers() {
    if (this.cache.repeatNumbers) {
      return this.cache.repeatNumbers;
    }
    
    if (this.historyData.length < 2) {
      return { frontRepeatRate: 0, backRepeatRate: 0, commonRepeatCount: 0 };
    }
    
    let frontRepeatCount = 0;
    let backRepeatCount = 0;
    let comparisonCount = 0;
    
    for (let i = 1; i < this.historyData.length; i++) {
      const prevDraw = this.historyData[i - 1];
      const currDraw = this.historyData[i];
      
      // 前区重号
      const frontRepeats = prevDraw.front.filter(n => currDraw.front.includes(n)).length;
      frontRepeatCount += frontRepeats;
      
      // 后区重号
      const backRepeats = prevDraw.back.filter(n => currDraw.back.includes(n)).length;
      backRepeatCount += backRepeats;
      
      comparisonCount++;
    }
    
    const result = {
      frontRepeatRate: frontRepeatCount / comparisonCount,
      backRepeatRate: backRepeatCount / comparisonCount,
      commonRepeatCount: Math.round(frontRepeatCount / comparisonCount)
    };
    
    this.cache.repeatNumbers = result;
    return result;
  }

  /**
   * 冷热号交替周期分析（新增）
   * 分析热号和冷号的轮换规律
   */
  analyzeHotColdCycle(windowSize = 10) {
    if (this.historyData.length < windowSize * 2) {
      return { cycleDetected: false, hotColdPattern: '数据不足' };
    }
    
    const [frontCounter] = this.analyzeFrequency();
    const totalDraws = this.historyData.length;
    const avgFreq = totalDraws > 0 ? Object.values(frontCounter).reduce((a, b) => a + b, 0) / CONFIG.FRONT_RANGE : 0;
    
    // 分段分析热冷号变化
    const segments = [];
    const segmentCount = Math.floor(this.historyData.length / windowSize);
    
    for (let s = 0; s < segmentCount; s++) {
      const startIdx = s * windowSize;
      const endIdx = startIdx + windowSize;
      const segmentData = this.historyData.slice(startIdx, endIdx);
      
      // 计算该段的热号
      const segmentCounter = {};
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        segmentCounter[i] = 0;
      }
      
      segmentData.forEach(draw => {
        draw.front.forEach(num => {
          segmentCounter[num]++;
        });
      });
      
      // 识别热号（频率高于平均）
      const hotNumbers = Object.entries(segmentCounter)
        .filter(([_, count]) => count > avgFreq / segmentCount)
        .map(x => Number(x[0]));
      
      segments.push({
        segmentIndex: s,
        hotCount: hotNumbers.length,
        hotNumbers: hotNumbers
      });
    }
    
    // 分析热号重叠度，判断是否有周期性
    let overlapSum = 0;
    let overlapCount = 0;
    
    for (let i = 1; i < segments.length; i++) {
      const prevHot = new Set(segments[i - 1].hotNumbers);
      const currHot = new Set(segments[i].hotNumbers);
      
      let overlap = 0;
      currHot.forEach(num => {
        if (prevHot.has(num)) overlap++;
      });
      
      overlapSum += overlap;
      overlapCount++;
    }
    
    const avgOverlap = overlapCount > 0 ? overlapSum / overlapCount : 0;
    
    return {
      cycleDetected: avgOverlap < 3, // 重叠度低说明有轮换
      avgOverlap: avgOverlap.toFixed(2),
      segmentCount: segments.length,
      pattern: avgOverlap < 2 ? '明显轮换' : avgOverlap < 4 ? '部分轮换' : '相对稳定'
    };
  }

  /**
   * 区间轮动规律分析（新增）
   * 分析7个区间的出号轮动模式
   */
  analyzeZoneRotation() {
    if (this.historyData.length < 5) {
      return { rotationPattern: '数据不足', zoneActivity: {} };
    }
    
    const recentDraws = this.historyData.slice(-20); // 最近20期
    const zoneStats = {};
    
    // 初始化7个区间
    for (let z = 0; z < 7; z++) {
      zoneStats[z] = {
        totalHits: 0,
        consecutiveEmpty: 0,
        maxConsecutiveEmpty: 0,
        recentActivity: []
      };
    }
    
    // 统计每个区间的出号情况
    recentDraws.forEach((draw, idx) => {
      const activeZones = new Set();
      
      draw.front.forEach(num => {
        const zoneIndex = Math.floor((num - 1) / 5);
        zoneStats[zoneIndex].totalHits++;
        activeZones.add(zoneIndex);
      });
      
      // 记录活跃状态
      for (let z = 0; z < 7; z++) {
        const isActive = activeZones.has(z);
        zoneStats[z].recentActivity.push(isActive ? 1 : 0);
        
        if (!isActive) {
          zoneStats[z].consecutiveEmpty++;
          zoneStats[z].maxConsecutiveEmpty = Math.max(
            zoneStats[z].maxConsecutiveEmpty,
            zoneStats[z].consecutiveEmpty
          );
        } else {
          zoneStats[z].consecutiveEmpty = 0;
        }
      }
    });
    
    // 分析轮动模式
    const zoneActivity = {};
    let rotationScore = 0;
    
    for (let z = 0; z < 7; z++) {
      const stats = zoneStats[z];
      const activityRate = stats.totalHits / recentDraws.length;
      
      zoneActivity[z] = {
        range: `${z * 5 + 1}-${(z + 1) * 5}`,
        activityRate: (activityRate * 100).toFixed(1),
        currentEmptyStreak: stats.consecutiveEmpty,
        maxEmptyStreak: stats.maxConsecutiveEmpty,
        status: activityRate > 0.6 ? '热区' : activityRate > 0.3 ? '温区' : '冷区'
      };
      
      rotationScore += activityRate;
    }
    
    const uniformity = rotationScore / 7;
    const pattern = uniformity > 0.8 ? '均匀分布' : uniformity > 0.5 ? '轻度偏态' : '明显偏态';
    
    return {
      rotationPattern: pattern,
      zoneActivity,
      uniformity: (uniformity * 100).toFixed(1)
    };
  }

  /**
   * 评估模型表现（优化版 v2 - 动态权重系统）
   * 基于最近N期的预测准确度评估各模型表现
   * 使用滑动窗口计算各模型的命中率，动态调整权重
   */
  evaluateModelPerformance(windowSize = 20) {
    const cacheKey = `modelPerformance_${windowSize}`;
    if (this.cache.modelPerformance && this.cache.modelPerformance.key === cacheKey) {
      return this.cache.modelPerformance.result;
    }
    
    if (this.historyData.length < windowSize + 5) {
      // 数据不足，返回默认权重
      const defaultWeights = {
        zhouyi: 0.35,
        bayesian: 0.35,
        rotation: 0.30
      };
      this.cache.modelPerformance = { key: cacheKey, result: defaultWeights };
      return defaultWeights;
    }
    
    // 使用滑动窗口测试各模型表现
    const models = ['zhouyi', 'bayesian', 'rotation'];
    const modelScores = {
      zhouyi: 0,
      bayesian: 0,
      rotation: 0
    };
    
    let testCount = 0;
    
    // 从后往前测试最近windowSize期
    for (let i = this.historyData.length - windowSize; i < this.historyData.length; i++) {
      const actualDraw = this.historyData[i];
      
      // 使用该期之前的数据进行预测
      const tempAnalyzer = new LotteryAnalyzer();
      const historyForPrediction = this.historyData.slice(0, i);
      const dataStr = historyForPrediction.map(d => 
        `${d.front.join(' ')} ${d.back.join(' ')}`
      ).join('\n');
      tempAnalyzer.loadHistoryData(dataStr, '临时数据');
      
      // 生成各模型的预测
      try {
        const zhouyiPred = tempAnalyzer.generateZhouyiPrediction();
        const bayesianPred = tempAnalyzer.generateBayesianPrediction();
        const rotationPred = tempAnalyzer.generateRotationMatrixPrediction(1)[0];
        
        // 计算每个模型的命中数
        const zhouyiHits = this.calculateHits(zhouyiPred, actualDraw);
        const bayesianHits = this.calculateHits(bayesianPred, actualDraw);
        const rotationHits = this.calculateHits([...rotationPred.front, ...rotationPred.back], actualDraw);
        
        modelScores.zhouyi += zhouyiHits;
        modelScores.bayesian += bayesianHits;
        modelScores.rotation += rotationHits;
        
        testCount++;
      } catch (error) {
        console.warn('模型评估出错:', error.message);
      }
    }
    
    // 计算平均命中数
    const avgScores = {
      zhouyi: testCount > 0 ? modelScores.zhouyi / testCount : 0,
      bayesian: testCount > 0 ? modelScores.bayesian / testCount : 0,
      rotation: testCount > 0 ? modelScores.rotation / testCount : 0
    };
    
    // 归一化为权重（总和为1）
    const totalScore = avgScores.zhouyi + avgScores.bayesian + avgScores.rotation;
    
    let weights;
    if (totalScore > 0) {
      weights = {
        zhouyi: avgScores.zhouyi / totalScore,
        bayesian: avgScores.bayesian / totalScore,
        rotation: avgScores.rotation / totalScore
      };
    } else {
      // 如果所有模型都未命中，使用默认权重
      weights = {
        zhouyi: 0.35,
        bayesian: 0.35,
        rotation: 0.30
      };
    }
    
    // 添加平滑因子，避免权重波动过大
    const smoothingFactor = 0.7; // 70%新权重 + 30%旧权重
    const defaultWeights = { zhouyi: 0.35, bayesian: 0.35, rotation: 0.30 };
    
    const smoothedWeights = {
      zhouyi: weights.zhouyi * smoothingFactor + defaultWeights.zhouyi * (1 - smoothingFactor),
      bayesian: weights.bayesian * smoothingFactor + defaultWeights.bayesian * (1 - smoothingFactor),
      rotation: weights.rotation * smoothingFactor + defaultWeights.rotation * (1 - smoothingFactor)
    };
    
    // 再次归一化
    const smoothedTotal = smoothedWeights.zhouyi + smoothedWeights.bayesian + smoothedWeights.rotation;
    const finalWeights = {
      zhouyi: smoothedWeights.zhouyi / smoothedTotal,
      bayesian: smoothedWeights.bayesian / smoothedTotal,
      rotation: smoothedWeights.rotation / smoothedTotal
    };
    
    const result = finalWeights;
    this.cache.modelPerformance = { key: cacheKey, result };
    
    console.log('📊 动态权重更新:', {
      zhouyi: finalWeights.zhouyi.toFixed(3),
      bayesian: finalWeights.bayesian.toFixed(3),
      rotation: finalWeights.rotation.toFixed(3),
      testCount,
      avgScores
    });
    
    return result;
  }

  /**
   * 计算预测命中数
   */
  calculateHits(prediction, actualDraw) {
    const predFront = new Set(prediction.slice(0, 5));
    const predBack = new Set(prediction.slice(5));
    const actualFront = new Set(actualDraw.front);
    const actualBack = new Set(actualDraw.back);
    
    let hits = 0;
    predFront.forEach(num => {
      if (actualFront.has(num)) hits++;
    });
    predBack.forEach(num => {
      if (actualBack.has(num)) hits++;
    });
    
    return hits;
  }

  /**
   * 基于最新开奖号码分析各模型表现并给出推荐
   * @param {Object} latestDraw - 最新开奖号码 {front: [6,7,18,21,30], back: [1,5]}
   * @returns {Object} - 包含推荐信息和详细分析
   */
  analyzeAndRecommendModel(latestDraw, customSampleSize = null) {
    if (!latestDraw || !latestDraw.front || !latestDraw.back) {
      return null;
    }

    // 生成缓存键（基于最新开奖号码和样本量）
    const sampleSizeKey = customSampleSize || 'auto';
    const cacheKey = `recommendation_${latestDraw.front.join(',')}_${latestDraw.back.join(',')}_${sampleSizeKey}`;
    const now = Date.now();
    
    // 根据历史数据量动态调整缓存时间
    const dataVolume = this.historyData.length;
    let CACHE_DURATION;
    if (dataVolume >= 200) {
      CACHE_DURATION = 5 * 60 * 1000; // 200+期：缓存5分钟（更稳定）
    } else if (dataVolume >= 100) {
      CACHE_DURATION = 4 * 60 * 1000; // 100-200期：缓存4分钟
    } else {
      CACHE_DURATION = 3 * 60 * 1000; // <100期：缓存3分钟
    }

    // 检查缓存是否有效
    if (this.cache.recommendation && 
        this.cache.recommendation.key === cacheKey) {
      const cacheAge = now - this.cache.recommendation.timestamp;
      const cacheAgeMinutes = Math.floor(cacheAge / 60000);
      
      if (cacheAge < CACHE_DURATION) {
        console.log(`✅ 使用缓存的推荐结果（已缓存${cacheAgeMinutes}分钟，有效期3分钟）`);
        return this.cache.recommendation.data;
      } else {
        console.log(`⏰ 缓存已过期（${cacheAgeMinutes}分钟 > 3分钟），重新计算...`);
      }
    }

    console.log(`🔄 开始重新计算推荐结果（大样本分析，历史数据${dataVolume}期）...`);

    // 生成各模型的预测结果（根据用户选择或数据量动态调整样本数）
    let SAMPLE_COUNT;
    
    // 如果用户指定了样本量，使用用户的选择
    if (customSampleSize) {
      SAMPLE_COUNT = {
        zhouyi: customSampleSize,
        bayesian: customSampleSize,
        rotation: customSampleSize,
        hybrid: customSampleSize
      };
      console.log(`📊 使用用户指定的样本量: ${customSampleSize}组/模型`);
    } else {
      // 否则根据数据量自动调整
      if (dataVolume >= 200) {
        SAMPLE_COUNT = {
          zhouyi: 80,      // 周易：80组
          bayesian: 80,    // 贝叶斯：80组
          rotation: 80,    // 旋转矩阵：80组（16次×5组）
          hybrid: 80       // 混合模型：80组
        };
      } else if (dataVolume >= 100) {
        SAMPLE_COUNT = {
          zhouyi: 60,
          bayesian: 60,
          rotation: 60,
          hybrid: 60
        };
      } else {
        SAMPLE_COUNT = {
            zhouyi: 50,
          bayesian: 50,
          rotation: 50,
          hybrid: 50
        };
      }
      console.log(`📊 使用自动样本量: ${SAMPLE_COUNT.zhouyi}组/模型（基于${dataVolume}期数据）`);
    }

    const zhouyiPredictions = [];
    for (let i = 0; i < SAMPLE_COUNT.zhouyi; i++) {
      const pred = this.generateZhouyiPrediction(i);
      zhouyiPredictions.push({
        front: pred.slice(0, 5),
        back: pred.slice(5)
      });
    }

    const bayesianPredictions = [];
    for (let i = 0; i < SAMPLE_COUNT.bayesian; i++) {
      const pred = this.generateBayesianPrediction();
      bayesianPredictions.push({
        front: pred.slice(0, 5),
        back: pred.slice(5)
      });
    }

    // 旋转矩阵：根据目标样本数动态调整批次
    const rotationPredictions = [];
    const rotationBatches = Math.ceil(SAMPLE_COUNT.rotation / 5);
    for (let i = 0; i < rotationBatches; i++) {
      const batch = this.generateRotationMatrixPrediction(5);
      rotationPredictions.push(...batch);
    }

    // 生成混合模型预测（多次采样）
    const hybridPredictions = [];
    for (let i = 0; i < SAMPLE_COUNT.hybrid; i++) {
      const pred = this.generateHybridPrediction();
      hybridPredictions.push({
        front: pred.slice(0, 5),
        back: pred.slice(5)
      });
    }

    // 计算每个模型的命中率
    const calculateHitRate = (predictions, actual) => {
      let totalFrontHits = 0;
      let totalBackHits = 0;
      let totalPredictions = predictions.length;

      predictions.forEach(pred => {
        const frontSet = new Set(actual.front);
        const backSet = new Set(actual.back);
        
        pred.front.forEach(num => {
          if (frontSet.has(num)) totalFrontHits++;
        });
        
        pred.back.forEach(num => {
          if (backSet.has(num)) totalBackHits++;
        });
      });

      return {
        frontHitRate: (totalFrontHits / (totalPredictions * 5) * 100).toFixed(1),
        backHitRate: (totalBackHits / (totalPredictions * 2) * 100).toFixed(1),
        totalHits: totalFrontHits + totalBackHits,
        avgTotalHits: ((totalFrontHits + totalBackHits) / totalPredictions).toFixed(2),
        sampleCount: totalPredictions,
        // 理论期望值（随机选择）
        expectedFrontRate: 14.3,  // 5/35 = 14.3%
        expectedBackRate: 16.7    // 2/12 = 16.7%
      };
    };

    const zhouyiStats = calculateHitRate(zhouyiPredictions, latestDraw);
    const bayesianStats = calculateHitRate(bayesianPredictions, latestDraw);
    const rotationStats = calculateHitRate(rotationPredictions, latestDraw);
    const hybridStats = calculateHitRate(hybridPredictions, latestDraw);

    // 综合评分算法（优化版 v7 - 尊重混合模型的自然优势）
    // 考虑因素：前区命中率、后区命中率、稳定性、样本覆盖度、一致性
    const calculateScore = (stats) => {
      // 根据理论期望值调整权重（前区更难命中，给予更高权重）
      const frontWeight = 0.55;  // 前区权重55%（5/35=14.3%，难度更高）
      const backWeight = 0.45;   // 后区权重45%（2/12=16.7%，相对容易）
      
      // 基础分数（加权平均）
      const baseScore = parseFloat(stats.frontHitRate) * frontWeight + 
                       parseFloat(stats.backHitRate) * backWeight;
      
      // 稳定性因子（多样本时给予更高权重）
      // 80组以上为满分，鼓励更大样本
      const stabilityFactor = stats.sampleCount >= 80 ? 1.0 : 
                             stats.sampleCount >= 60 ? 0.99 : 
                             stats.sampleCount >= 50 ? 0.97 : 0.95;
      
      // 覆盖度因子（样本越多越可靠，80组为满分）
      const coverageFactor = Math.min(stats.sampleCount / 80, 1.0);
      
      // 超过期望值的奖励因子
      const expectedTotal = parseFloat(stats.expectedFrontRate) * frontWeight + 
                           parseFloat(stats.expectedBackRate) * backWeight;
      const performanceRatio = baseScore / expectedTotal;
      const bonusFactor = performanceRatio > 1.2 ? 1.05 :  // 超出期望20%以上，额外奖励5%
                         performanceRatio > 1.1 ? 1.03 :   // 超出期望10%以上，奖励3%
                         1.0;
      
      // 不设置混合模型惩罚，尊重其自然优势
      // 混合模型作为融合模型，理应表现更稳定
      return baseScore * stabilityFactor * (0.8 + 0.2 * coverageFactor) * bonusFactor;
    };

    const models = [
      {
        name: '周易时空',
        key: 'zhouyi',
        stats: zhouyiStats,
        score: calculateScore(zhouyiStats),
        predictions: zhouyiPredictions,
        characteristics: ['传统智慧', '时间因子', '卦象分析']
      },
      {
        name: '贝叶斯动态',
        key: 'bayesian',
        stats: bayesianStats,
        score: calculateScore(bayesianStats),
        predictions: bayesianPredictions,
        characteristics: ['概率统计', '动态调整', '遗漏分析']
      },
      {
        name: '旋转矩阵',
        key: 'rotation',
        stats: rotationStats,
        score: calculateScore(rotationStats),
        predictions: rotationPredictions,
        characteristics: ['组合数学', '多策略', '高覆盖']
      },
      {
        name: '混合模型',
        key: 'hybrid',
        stats: hybridStats,
        score: calculateScore(hybridStats),
        predictions: hybridPredictions,
        characteristics: ['多模融合', '投票机制', '智能加权']
      }
    ];

    // 按分数排序
    models.sort((a, b) => b.score - a.score);

    const bestModel = models[0];
    const secondModel = models[1];
    const thirdModel = models[2];
    const fourthModel = models[3];

    // 找出各维度的最佳模型
    const bestFrontModel = [...models].sort((a, b) => 
      parseFloat(b.stats.frontHitRate) - parseFloat(a.stats.frontHitRate)
    )[0];
    
    const bestBackModel = [...models].sort((a, b) => 
      parseFloat(b.stats.backHitRate) - parseFloat(a.stats.backHitRate)
    )[0];

    // 生成推荐理由（优化版 v5 - 强调混合模型的优势地位）
    let reason = '';
    const bestBackRate = parseFloat(bestModel.stats.backHitRate);
    const bestFrontRate = parseFloat(bestModel.stats.frontHitRate);
    const secondBackRate = parseFloat(secondModel.stats.backHitRate);
    const secondFrontRate = parseFloat(secondModel.stats.frontHitRate);
    
    // 检查是否是混合模型
    const isHybridBest = bestModel.key === 'hybrid';
    
    if (isHybridBest) {
      // 混合模型的特殊说明（正面肯定其优势）
      reason = `混合模型融合了三大基础模型的优势，通过投票机制和智能加权，`; 
      
      if (bestBackRate > 50) {
        reason += `在后区预测上表现卓越（${bestModel.stats.backHitRate}%），远超随机期望；`;
      } else if (bestBackRate > 40) {
        reason += `在后区预测上表现出色（${bestModel.stats.backHitRate}%），高于随机期望；`;
      } else if (bestFrontRate > 18) {
        reason += `在前区预测上相对稳定（${bestModel.stats.frontHitRate}%），优于随机选择；`;
      } else {
        reason += '整体表现均衡稳定，多模型融合有效降低单一模型的随机性偏差；';
      }
      
      // 说明为什么推荐混合模型
      const scoreDiff = ((bestModel.score - secondModel.score) / secondModel.score * 100).toFixed(1);
      reason += `\n📊 优势：比第二名高出${scoreDiff}%，集成学习的稳定性优势明显。`;
      
      // 提示用户可以尝试单一模型获取不同视角
      reason += '\n💡 建议：混合模型是最稳妥的选择，但也可尝试单一模型探索不同思路。';
      
      // 特别推荐第二名的单一模型
      reason += `\n🎯 备选：${secondModel.name}排名第二，可作为补充验证。`;
    } else {
      // 基础模型的推荐理由（罕见情况）
      if (bestBackRate > 55) {
        reason = `该模型在后区预测上表现卓越（命中率${bestModel.stats.backHitRate}%），远超随机期望（16.7%）；`;
      } else if (bestBackRate > 45) {
        reason = `该模型后区命中率较高（${bestModel.stats.backHitRate}%），明显优于随机选择；`;
      } else if (bestBackRate > 35) {
        reason = `该模型后区表现良好（${bestModel.stats.backHitRate}%），略高于随机期望；`;
      } else if (bestFrontRate > 20) {
        reason = `该模型在前区预测上表现出色（命中率${bestModel.stats.frontHitRate}%），远超随机期望（14.3%）；`;
      } else if (bestFrontRate > 16) {
        reason = `该模型前区表现较好（${bestModel.stats.frontHitRate}%），优于随机选择；`;
      } else {
        reason = `综合多维度分析，${bestModel.name}在${dataVolume}期历史数据中整体表现最优；`;
      }

      // 对比其他模型
      const scoreDiffPercent = ((bestModel.score - secondModel.score) / secondModel.score * 100).toFixed(1);
      
      if (bestBackRate > secondBackRate * 1.4) {
        reason += '且后区命中率大幅领先其他模型（优势超过40%）。';
      } else if (bestBackRate > secondBackRate * 1.2) {
        reason += '后区优势明显（领先第二名20%以上）。';
      } else if (scoreDiffPercent < 3) {
        reason += `与第二名差距微小（仅${scoreDiffPercent}%），建议结合使用或交替尝试。`;
      } else if (scoreDiffPercent < 8) {
        reason += `各项指标相对均衡，小幅领先其他模型（${scoreDiffPercent}%）。`;
      } else {
        reason += `综合得分显著领先（${scoreDiffPercent}%），各项指标表现稳定。`;
      }
      
      // 特别说明：这种情况很少见
      reason += '\n💡 注意：这是一个罕见的情况，单一模型超越了混合模型，值得重点关注！';
    }

    // 添加模型特色说明
    const charStr = bestModel.characteristics.join('、');
    reason += `\n💡 特色：${charStr}`;
    
    // 添加多维度推荐信息
    if (bestFrontModel.key !== bestModel.key) {
      reason += `\n🎯 前区最佳: ${bestFrontModel.name} (${bestFrontModel.stats.frontHitRate}%)`;
    }
    if (bestBackModel.key !== bestModel.key) {
      reason += `\n🎯 后区最佳: ${bestBackModel.name} (${bestBackModel.stats.backHitRate}%)`;
    }

    // 添加备选建议（更智能的推荐）
    let alternativeSuggestion = '';
    if (thirdModel && parseFloat(thirdModel.stats.backHitRate) > 45) {
      alternativeSuggestion = `\n🔄 备选方案：${thirdModel.name}在后区也有出色表现（${thirdModel.stats.backHitRate}%），可作为补充验证。`;
    } else if (thirdModel && parseFloat(thirdModel.stats.frontHitRate) > 17) {
      alternativeSuggestion = `\n🔄 备选方案：${thirdModel.name}在前区表现不错（${thirdModel.stats.frontHitRate}%），可交叉参考。`;
    } else if (fourthModel && Math.abs(fourthModel.score - bestModel.score) < 10) {
      alternativeSuggestion = `\n🔄 备选方案：${fourthModel.name}与最佳模型差距不大，也可尝试。`;
    }

    const result = {
      recommendedModel: bestModel,
      allModels: models,
      reason,
      alternativeSuggestion,
      latestDraw,
      analysisTime: new Date().toLocaleString('zh-CN'),
      dataVolume: dataVolume,  // 添加数据量信息
      sampleSize: SAMPLE_COUNT.zhouyi  // 添加样本量信息
    };

    // 缓存结果
    this.cache.recommendation = {
      key: cacheKey,
      timestamp: now,
      data: result
    };

    console.log(`✅ 推荐结果已缓存（有效期${CACHE_DURATION/60000}分钟，数据量${dataVolume}期）`);
    console.log(`📊 最佳模型: ${bestModel.name} (得分: ${bestModel.score.toFixed(2)})`);
    console.log(`📈 样本量: 各模型${SAMPLE_COUNT.zhouyi}组（总计${SAMPLE_COUNT.zhouyi * 4}组）`);
    console.log(`📋 各模型得分:`, models.map(m => `${m.name}:${m.score.toFixed(2)}`).join(', '));
    console.log(`💡 历史数据: ${dataVolume}期（已达到优秀水平，建议持续积累）`);

    return result;
  }

  /**
   * 胆拖玩法生成器（新增）
   * @param {number[]} danNumbers - 胆码数组（必选号码）
   * @param {number[]} tuoNumbers - 拖码数组（可选号码）
   * @param {number} frontCount - 前区需要选择的号码数（默认5）
   * @returns {Object} 包含所有组合和分析信息
   */
  generateDanTuo(danNumbers, tuoNumbers, frontCount = CONFIG.FRONT_COUNT) {
    // 验证输入
    if (!danNumbers || !tuoNumbers || danNumbers.length === 0 || tuoNumbers.length === 0) {
      throw new Error('胆码和拖码都不能为空');
    }

    const danCount = danNumbers.length;
    const needFromTuo = frontCount - danCount;

    if (danCount >= frontCount) {
      throw new Error(`胆码数量(${danCount})不能大于等于前区号码数(${frontCount})`);
    }

    if (needFromTuo > tuoNumbers.length) {
      throw new Error(`需要从拖码中选择${needFromTuo}个，但拖码只有${tuoNumbers.length}个`);
    }

    if (danCount < 1) {
      throw new Error('胆码至少需要1个');
    }

    // 检查胆码和拖码是否有重复
    const danSet = new Set(danNumbers);
    const hasOverlap = tuoNumbers.some(n => danSet.has(n));
    if (hasOverlap) {
      throw new Error('胆码和拖码不能有重复号码');
    }

    // 从拖码中选择needFromTuo个号码的所有组合
    const tuoCombinations = this.combinations(tuoNumbers, needFromTuo);
    
    // 生成所有完整组合
    const combinations = tuoCombinations.map(tuoSelection => {
      const fullCombination = [...danNumbers, ...tuoSelection].sort((a, b) => a - b);
      return {
        front: fullCombination,
        back: [1, 2], // 默认后区，可以后续优化
        danNumbers: danNumbers,
        tuoNumbers: tuoSelection,
        combinationType: '前区胆拖'
      };
    });

    // 计算注数
    const totalBets = combinations.length;

    // 分析胆码质量
    const danQuality = this.analyzeDanQuality(danNumbers, tuoNumbers);

    return {
      danNumbers: danNumbers.sort((a, b) => a - b),
      tuoNumbers: tuoNumbers.sort((a, b) => a - b),
      danCount,
      tuoCount: tuoNumbers.length,
      needFromTuo,
      totalBets,
      combinations,
      danQuality,
      cost: totalBets * 2, // 假设每注2元
      generatedAt: new Date().toLocaleString('zh-CN')
    };
  }

  /**
   * 分析胆码质量
   */
  analyzeDanQuality(danNumbers, tuoNumbers) {
    const allNumbers = [...danNumbers, ...tuoNumbers];
    
    // 胆码的冷热分析
    const hotColdAnalysis = this.getHotColdNumbers(10);
    const hotNumbers = hotColdAnalysis.frontHot.map(item => Number(item[0]));
    const coldNumbers = hotColdAnalysis.frontCold.map(item => Number(item[0]));

    let hotDanCount = 0;
    let coldDanCount = 0;
    danNumbers.forEach(num => {
      if (hotNumbers.includes(num)) hotDanCount++;
      if (coldNumbers.includes(num)) coldDanCount++;
    });

    // 胆码的AC值贡献
    const acValue = this.calculateACValue(danNumbers);

    // 胆码的和值贡献
    const danSum = danNumbers.reduce((a, b) => a + b, 0);

    // 胆码的奇偶比
    const oddCount = danNumbers.filter(n => n % 2 !== 0).length;
    const evenCount = danNumbers.length - oddCount;

    // 胆码的大小比（以18为界）
    const bigCount = danNumbers.filter(n => n > 18).length;
    const smallCount = danNumbers.length - bigCount;

    return {
      hotDanCount,
      coldDanCount,
      acValue,
      danSum,
      oddEvenRatio: `${oddCount}:${evenCount}`,
      bigSmallRatio: `${bigCount}:${smallCount}`,
      qualityScore: this.calculateDanQualityScore({
        hotDanCount,
        coldDanCount,
        acValue,
        oddCount,
        evenCount,
        bigCount,
        smallCount,
        danCount: danNumbers.length
      })
    };
  }

  /**
   * 计算胆码质量评分
   */
  calculateDanQualityScore(metrics) {
    let score = 70; // 基础分

    // 热号加分
    if (metrics.hotDanCount >= 1 && metrics.hotDanCount <= 2) {
      score += 10;
    } else if (metrics.hotDanCount > 2) {
      score -= 5; // 太多热号可能不好
    }

    // 冷号惩罚
    if (metrics.coldDanCount > 1) {
      score -= 10;
    }

    // AC值评分
    if (metrics.acValue >= 2 && metrics.acValue <= 4) {
      score += 10;
    } else if (metrics.acValue < 2 || metrics.acValue > 5) {
      score -= 5;
    }

    // 奇偶平衡
    const oddEvenDiff = Math.abs(metrics.oddCount - metrics.evenCount);
    if (oddEvenDiff <= 1) {
      score += 5;
    } else if (oddEvenDiff > 2) {
      score -= 5;
    }

    // 大小平衡
    const bigSmallDiff = Math.abs(metrics.bigCount - metrics.smallCount);
    if (bigSmallDiff <= 1) {
      score += 5;
    } else if (bigSmallDiff > 2) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 双区胆拖（前区+后区都使用胆拖）
   * @param {Object} params - 参数对象
   * @param {number[]} params.frontDan - 前区胆码
   * @param {number[]} params.frontTuo - 前区拖码
   * @param {number[]} params.backDan - 后区胆码（可选）
   * @param {number[]} params.backTuo - 后区拖码（可选）
   * @returns {Object} 胆拖结果
   */
  generateDoubleDanTuo(params) {
    const { frontDan, frontTuo, backDan, backTuo } = params;

    // 生成前区组合
    const frontResult = this.generateDanTuo(frontDan, frontTuo, CONFIG.FRONT_COUNT);

    // 处理后区
    let backCombinations = [];
    if (backDan && backDan.length > 0 && backTuo && backTuo.length > 0) {
      // 后区也使用胆拖
      const backNeed = CONFIG.BACK_COUNT - backDan.length;
      if (backNeed > 0) {
        const backTuoCombs = this.combinations(backTuo, backNeed);
        backCombinations = backTuoCombs.map(backSel => [...backDan, ...backSel].sort((a, b) => a - b));
      } else {
        backCombinations = [backDan.sort((a, b) => a - b)];
      }
    } else {
      // 后区不使用胆拖，使用默认值
      backCombinations = [[1, 2]];
    }

    // 组合前后区
    const fullCombinations = [];
    frontResult.combinations.forEach(frontComb => {
      backCombinations.forEach(back => {
        fullCombinations.push({
          front: frontComb.front,
          back: back,
          danNumbers: frontComb.danNumbers,
          tuoNumbers: frontComb.tuoNumbers,
          backDan: backDan || [],
          backTuo: backTuo || [],
          combinationType: '双区胆拖'
        });
      });
    });

    return {
      ...frontResult,
      backDan: backDan || [],
      backTuo: backTuo || [],
      backCombinations: backCombinations.length,
      totalBets: fullCombinations.length,
      combinations: fullCombinations,
      cost: fullCombinations.length * 2
    };
  }

  /**
   * 计算组合数 C(n, k)
   */
  combinations(arr, k) {
    if (k > arr.length || k <= 0) return [];
    if (k === arr.length) return [arr];
    if (k === 1) return arr.map(item => [item]);

    const result = [];
    const helper = (start, current) => {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        helper(i + 1, current);
        current.pop();
      }
    };
    helper(0, []);
    return result;
  }
}

export default LotteryAnalyzer;
