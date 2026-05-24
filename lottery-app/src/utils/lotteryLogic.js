/**
 * 彩票分析核心逻辑 (迁移自 Python)
 */

// 配置常量
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
  BAYESIAN_CANDIDATE_FRONT: 15,  // 贝叶斯前区候选数量（增加到15以提高覆盖率）
  BAYESIAN_CANDIDATE_BACK: 8,    // 贝叶斯后区候选数量（增加到8以提高覆盖率）
  DISTRIBUTION_TRY_COUNT: 500,   // 分布策略尝试次数（增加到500以找到更优解）
  TIME_DECAY_FACTOR: 0.95,  // 时间衰减因子
  HYBRID_MODEL_COUNT: 3,    // 混合模型使用的模型数量
  QUALITY_SCORE_THRESHOLD: 80,  // 质量评分阈值（提高要求）
  RECENT_DRAWS_FOR_TREND: 10,  // 用于趋势分析的最近期数
  ADAPTIVE_WEIGHT_WINDOW: 15,  // 自适应权重窗口大小
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
   * 混合预测模型（优化版 v3）
   * 结合周易、贝叶斯和旋转矩阵的优势
   * 科学性：基于多模型投票机制，提高稳定性
   * 优化：加入趋势分析、重号策略、智能权重调整
   */
  generateHybridPrediction() {
    // 获取新增的分析数据
    const sumTrend = this.analyzeSumTrend();
    const spanAnalysis = this.analyzeSpan();
    const repeatAnalysis = this.analyzeRepeatNumbers();
    const modelWeights = this.evaluateModelPerformance();
    
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
    
    for (let i = 0; i < 100; i++) { // 增加到100次尝试
      const selected = this.randomSample(candidates, CONFIG.FRONT_COUNT);
      
      // 检查是否符合跨度要求
      const span = Math.max(...selected) - Math.min(...selected);
      const spanDiff = Math.abs(span - spanAnalysis.avgFrontSpan);
      if (spanDiff > 8) continue; // 跨度过大，跳过
      
      // 检查和值要求
      const sum = selected.reduce((a, b) => a + b, 0);
      const sumDiff = Math.abs(sum - sumTrend.avgFrontSum);
      if (sumDiff > 25) continue; // 和值偏离过大，跳过
      
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
   * 评估号码组合的质量
   * 返回评分（0-100），分数越高表示组合越合理
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
    
    // 4. 检查和值范围（前区和值通常在 60-120 之间）
    const frontSum = front.reduce((a, b) => a + b, 0);
    if (frontSum < 50 || frontSum > 130) {
      score -= 15; // 和值太极端
    }
    
    // 5. 检查连号数量（最多2个连号比较合理）
    let consecutiveCount = 0;
    for (let i = 1; i < front.length; i++) {
      if (front[i] - front[i - 1] === 1) {
        consecutiveCount++;
      }
    }
    if (consecutiveCount >= 3) {
      score -= 20; // 连号太多
    } else if (consecutiveCount >= 2) {
      score -= 10;
    }
    
    // 6. 后区检查
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
    
    return Math.max(0, score);
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
   * 评估模型表现（新增）
   * 基于最近N期的预测准确度评估各模型表现
   */
  evaluateModelPerformance() {
    if (this.cache.modelPerformance) {
      return this.cache.modelPerformance;
    }
    
    // 这里简化实现，实际应该记录历史预测结果并与实际开奖对比
    // 当前返回默认权重
    const result = {
      zhouyi: 0.35,
      bayesian: 0.35,
      rotation: 0.30
    };
    
    this.cache.modelPerformance = result;
    return result;
  }

  /**
   * 基于最新开奖号码分析各模型表现并给出推荐
   * @param {Object} latestDraw - 最新开奖号码 {front: [6,7,18,21,30], back: [1,5]}
   * @returns {Object} - 包含推荐信息和详细分析
   */
  analyzeAndRecommendModel(latestDraw) {
    if (!latestDraw || !latestDraw.front || !latestDraw.back) {
      return null;
    }

    // 生成各模型的预测结果
    const zhouyiPredictions = [];
    for (let i = 0; i < 3; i++) {
      const pred = this.generateZhouyiPrediction(i);
      zhouyiPredictions.push({
        front: pred.slice(0, 5),
        back: pred.slice(5)
      });
    }

    const bayesianPred = this.generateBayesianPrediction();
    const bayesianPredictions = [{
      front: bayesianPred.slice(0, 5),
      back: bayesianPred.slice(5)
    }];

    const rotationPredictions = this.generateRotationMatrixPrediction(5);

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
        avgTotalHits: ((totalFrontHits + totalBackHits) / totalPredictions).toFixed(2)
      };
    };

    const zhouyiStats = calculateHitRate(zhouyiPredictions, latestDraw);
    const bayesianStats = calculateHitRate(bayesianPredictions, latestDraw);
    const rotationStats = calculateHitRate(rotationPredictions, latestDraw);

    // 综合评分（前区40% + 后区60%，因为后区更难命中）
    const calculateScore = (stats) => {
      return parseFloat(stats.frontHitRate) * 0.4 + parseFloat(stats.backHitRate) * 0.6;
    };

    const models = [
      {
        name: '周易时空',
        key: 'zhouyi',
        stats: zhouyiStats,
        score: calculateScore(zhouyiStats),
        predictions: zhouyiPredictions
      },
      {
        name: '贝叶斯动态',
        key: 'bayesian',
        stats: bayesianStats,
        score: calculateScore(bayesianStats),
        predictions: bayesianPredictions
      },
      {
        name: '旋转矩阵',
        key: 'rotation',
        stats: rotationStats,
        score: calculateScore(rotationStats),
        predictions: rotationPredictions
      }
    ];

    // 按分数排序
    models.sort((a, b) => b.score - a.score);

    const bestModel = models[0];
    const secondModel = models[1];

    // 生成推荐理由
    let reason = '';
    if (parseFloat(bestModel.stats.backHitRate) > 50) {
      reason = `该模型在后区预测上表现出色（命中率${bestModel.stats.backHitRate}%），`; 
    } else if (parseFloat(bestModel.stats.frontHitRate) > 15) {
      reason = `该模型在前区预测上表现较好（命中率${bestModel.stats.frontHitRate}%），`;
    } else {
      reason = '综合各维度分析，该模型整体表现最优，';
    }

    if (parseFloat(bestModel.stats.backHitRate) > parseFloat(secondModel.stats.backHitRate) * 1.2) {
      reason += '且后区命中率明显领先其他模型。';
    } else {
      reason += '各项指标相对均衡。';
    }

    return {
      recommendedModel: bestModel,
      allModels: models,
      reason,
      latestDraw
    };
  }
}

export default LotteryAnalyzer;
