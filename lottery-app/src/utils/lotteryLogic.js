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
  BAYESIAN_CANDIDATE_FRONT: 10,  // 贝叶斯前区候选数量
  BAYESIAN_CANDIDATE_BACK: 4,    // 贝叶斯后区候选数量
  DISTRIBUTION_TRY_COUNT: 200,   // 分布策略尝试次数
  TIME_DECAY_FACTOR: 0.95,  // 时间衰减因子
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
   * 周易时空预测模型（优化版）
   * 基于用户点击生成的实际时间，结合周易卦象和开奖周期
   * 开奖时间：周一、周三、周六
   */
  generateZhouyiPrediction(iteration = 0) {
    const now = new Date();
    
    // 获取时间要素（用于卦象计算）
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
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
    
    // 上卦：年+月+日 除以8的余数
    const upperTrigram = (year + month + day) % 8;
    
    // 下卦：年+月+日+时 除以8的余数
    const lowerTrigram = (year + month + day + hour) % 8;
    
    // 动爻：年+月+日+时+分+距开奖天数 除以6的余数
    const movingLine = (year + month + day + hour + minute + daysToNextDraw + iteration) % 6;
    
    // 八卦对应的号码池（根据先天八卦数）
    // 乾1、兑2、离3、震4、巽5、坎6、艮7、坤8
    const trigramElements = {
      0: [1, 9, 17, 25, 33],      // 坤卦：大地之数
      1: [2, 10, 18, 26, 34],      // 乾卦：天行之数
      2: [3, 11, 19, 27, 35],      // 兑卦：泽润之数
      3: [4, 12, 20, 28],          // 离卦：火明之数
      4: [5, 13, 21, 29],          // 震卦：雷动之数
      5: [6, 14, 22, 30],          // 巽卦：风入之数
      6: [7, 15, 23, 31],          // 坎卦：水润之数
      7: [8, 16, 24, 32]           // 艮卦：山止之数
    };
    
    // 根据上卦和下卦组合选号
    const poolUpper = trigramElements[upperTrigram] || [];
    const poolLower = trigramElements[lowerTrigram] || [];
    
    // 合并两个卦象的号码池
    const combinedPool = [...new Set([...poolUpper, ...poolLower])];
    
    // 如果号码池不足，补充其他相关号码
    if (combinedPool.length < CONFIG.FRONT_COUNT) {
      // 添加动爻相关的号码
      const movingLineNumbers = [
        movingLine + 1,
        movingLine + 7,
        movingLine + 13,
        movingLine + 19,
        movingLine + 25,
        movingLine + 31
      ].filter(n => n >= 1 && n <= CONFIG.FRONT_RANGE);
      
      combinedPool.push(...movingLineNumbers);
    }
    
    // 从组合池中选取前区号码
    let front = this.randomSample(combinedPool, CONFIG.FRONT_COUNT);
    
    // 如果仍然不足，用随机号码补充
    if (front.length < CONFIG.FRONT_COUNT) {
      const remaining = this.frontNumbers.filter(n => !front.includes(n));
      front = [...front, ...this.randomSample(remaining, CONFIG.FRONT_COUNT - front.length)];
    }
    
    // 后区号码：根据时辰和动爻选择
    // 十二时辰对应后区号码
    const hourBackMap = {
      0: [1, 7],   // 子时
      1: [1, 7],   // 子时
      2: [2, 8],   // 丑时
      3: [2, 8],   // 丑时
      4: [3, 9],   // 寅时
      5: [3, 9],   // 寅时
      6: [4, 10],  // 卯时
      7: [4, 10],  // 卯时
      8: [5, 11],  // 辰时
      9: [5, 11],  // 辰时
      10: [6, 12], // 巳时
      11: [6, 12], // 巳时
      12: [1, 7],  // 午时
      13: [1, 7],  // 午时
      14: [2, 8],  // 未时
      15: [2, 8],  // 未时
      16: [3, 9],  // 申时
      17: [3, 9],  // 申时
      18: [4, 10], // 酉时
      19: [4, 10], // 酉时
      20: [5, 11], // 戌时
      21: [5, 11], // 戌时
      22: [6, 12], // 亥时
      23: [6, 12]  // 亥时
    };
    
    const backCandidates = hourBackMap[hour] || [1, 12];
    
    // 根据动爻调整
    if (movingLine < 3) {
      // 动爻在下，选较小的号码
      backCandidates.sort((a, b) => a - b);
    } else {
      // 动爻在上，选较大的号码
      backCandidates.sort((a, b) => b - a);
    }
    
    const back = backCandidates.slice(0, CONFIG.BACK_COUNT);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  /**
   * 贝叶斯动态预测模型（优化版）
   * 基于历史数据计算条件概率，动态调整预测权重
   * 性能优化：使用向量化计算，避免三层嵌套循环
   */
  generateBayesianPrediction() {
    const [frontCounter, backCounter] = this.analyzeFrequency();
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
    
    // 优化：使用后验概率选择号码（结合先验和时间加权）
    const posteriorFront = {};
    const posteriorBack = {};
    
    // 前区后验概率计算
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      let score = priorFront[i];
      // 考虑最近趋势（时间加权）- 近期数据权重更高
      for (let idx = 0; idx < this.historyData.length; idx++) {
        const draw = this.historyData[idx];
        if (draw.front.includes(i)) {
          // 指数时间加权：越近的数据权重越高
          const timeWeight = Math.exp((idx - this.historyData.length + 1) / this.historyData.length);
          score += timeWeight * 0.1;
        }
      }
      posteriorFront[i] = score;
    }
    
    // 后区后验概率计算
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      let score = priorBack[i];
      for (let idx = 0; idx < this.historyData.length; idx++) {
        const draw = this.historyData[idx];
        if (draw.back.includes(i)) {
          const timeWeight = Math.exp((idx - this.historyData.length + 1) / this.historyData.length);
          score += timeWeight * 0.1;
        }
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
   * 旋转矩阵优化模型
   * 使用组合数学方法生成覆盖度最优的号码组合
   */
  generateRotationMatrixPrediction(groups = 1) {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    
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
      .slice(0, 5);
    
    const allFrontPool = [...new Set([...sortedFrontNums, ...lowFreqFront])];
    const allBackPool = [...new Set([...sortedBackNums])];
    
    const results = [];
    
    for (let g = 0; g < groups; g++) {
      // 旋转策略：每组使用不同的号码分布
      let front;
      if (g % 3 === 0) {
        // 策略1：主要高频号
        front = this.randomSample(sortedFrontNums, CONFIG.FRONT_COUNT);
      } else if (g % 3 === 1) {
        // 策略2：混合高频和中频
        const midFreq = allFrontPool.filter(n => !sortedFrontNums.includes(n)).slice(0, 10);
        const mixed = [...sortedFrontNums.slice(0, 10), ...midFreq];
        front = this.randomSample(mixed, CONFIG.FRONT_COUNT);
      } else {
        // 策略3：包含冷门号
        const withCold = [...sortedFrontNums.slice(0, 12), ...lowFreqFront.slice(0, 3)];
        front = this.randomSample(withCold, CONFIG.FRONT_COUNT);
      }
      
      const back = this.randomSample(allBackPool, CONFIG.BACK_COUNT);
      
      front.sort((a, b) => a - b);
      back.sort((a, b) => a - b);
      results.push({ front, back });
    }
    
    return results;
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
}

export default LotteryAnalyzer;
