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
  BAYESIAN_CANDIDATE_FRONT: 18,  // 贝叶斯前区候选数量
  BAYESIAN_CANDIDATE_BACK: 10,   // 贝叶斯后区候选数量（从8扩至10，增加多样性）
  DISTRIBUTION_TRY_COUNT: 500,   // 分布策略尝试次数
  TIME_DECAY_FACTOR: 0.95,  // 时间衰减因子
  HYBRID_MODEL_COUNT: 3,    // 混合模型使用的模型数量
  QUALITY_SCORE_THRESHOLD: 75,  // 质量评分阈值
  RECENT_DRAWS_FOR_TREND: 15,  // 用于趋势分析的最近期数
  ADAPTIVE_WEIGHT_WINDOW: 15,  // 自适应权重窗口大小
  // 后区多样性控制参数（新增 - 解决后区号码重复问题）
  BACK_WEIGHT_CAP: 3,       // 后区权重上限（防止热号权重过大）
  BACK_RANDOM_BONUS: 0.5,   // 后区随机加分（给冷号更多机会）
  BACK_NOISE_FACTOR: 0.3,   // 后区权重噪声因子（增加随机性）
  BACK_STRATIFIED_ODD: true, // 后区分层采样：保证奇偶分布
  // 前区多样性控制参数（新增）
  FRONT_WEIGHT_CAP: 5,      // 前区权重上限
  FRONT_RANDOM_BONUS: 0.3,  // 前区随机加分
  FRONT_NOISE_FACTOR: 0.15, // 前区权重噪声因子
  // 条件概率与关联性控制参数（自适应优化）
  // 注意：以下为基础权重，实际权重 = 基础权重 * confidence（自适应缩放）
  CONDITIONAL_WEIGHT: 0.15,      // 前区条件概率基础权重
  CORRELATION_WEIGHT: 0.10,      // 号码关联性权重
  BACK_CONDITIONAL_WEIGHT: 0.20, // 后区条件概率基础权重
  UNIQUE_BACK_ATTEMPTS: 15,      // 单组后区唯一性尝试次数
  UNIQUE_BACK_TOTAL_FACTOR: 30,  // 总尝试次数倍数因子
  // 基于208期数据的配置
  AC_VALUE_MIN: 3,          // AC值最小可接受值
  AC_VALUE_MAX: 7,          // AC值最大可接受值
  AC_VALUE_IDEAL_MIN: 4,    // AC值理想范围下限
  AC_VALUE_IDEAL_MAX: 6,    // AC值理想范围上限
  CONSECUTIVE_GROUPS_MAX: 2, // 最大连号组数
  GAP_VARIANCE_MIN: 8,      // 间距方差最小值
  GAP_VARIANCE_MAX: 55,     // 间距方差最大值
  SUM_RANGE_MIN: 65,        // 和值合理范围下限
  SUM_RANGE_MAX: 115,       // 和值合理范围上限
  SPAN_DIFF_THRESHOLD: 12,  // 跨度差异阈值
  SUM_DIFF_THRESHOLD: 35,   // 和值差异阈值
};

class LotteryAnalyzer {
  constructor() {
    this.frontNumbers = Array.from({ length: CONFIG.FRONT_RANGE }, (_, i) => i + 1);
    this.backNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1);
    this.historyData = [];
    this.dataWindow = 0; // 历史数据窗口：0=全部数据，N=最近N期数据
    
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
      backPairFrequency: null,
      conditionalProbability: null,
      numberCorrelation: null,
      dataVersion: 0
    };
  }

  /**
   * 设置历史数据窗口（控制统计分析使用多少期最新数据）
   * @param {number} window - 窗口大小：0=全部数据，N=最近N期
   */
  setDataWindow(window) {
    const newWindow = Math.max(0, Math.min(window, this.historyData.length));
    if (newWindow !== this.dataWindow) {
      this.dataWindow = newWindow;
      this.clearCache(); // 窗口变化时清缓存
      console.log(`📊 历史数据窗口已设置为: ${newWindow === 0 ? '全部' : `最近${newWindow}期`}（共${this.historyData.length}期数据）`);
    }
  }

  /**
   * 获取当前窗口内的活跃数据
   * @returns {Array} 用于统计分析的历史数据
   */
  getActiveData() {
    if (this.dataWindow > 0) {
      return this.historyData.slice(-this.dataWindow);
    }
    return this.historyData;
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
      backPairFrequency: null,
      conditionalProbability: null,
      numberCorrelation: null,
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
    
    for (const data of this.getActiveData()) {
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
    for (const data of this.getActiveData()) {
      const frontSum = data.front.reduce((a, b) => a + b, 0);
      const backSum = data.back.reduce((a, b) => a + b, 0);
      
      sumCount.front[frontSum] = (sumCount.front[frontSum] || 0) + 1;
      sumCount.back[backSum] = (sumCount.back[backSum] || 0) + 1;
    }
    
    // 计算概率
    const activeData = this.getActiveData();
    const totalDraws = activeData.length || 1;
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
    const conditionalProb = this.calculateConditionalProbability(); // 新增：条件概率
    
    let front = [], back = [];
    
    if (strategy === 'weighted') {
      // 优化：频率加权 + 条件概率融合
      // 将条件概率作为额外权重叠加到频率权重上
      const frontWeightsWithConditional = {};      
      for (let n = 1; n <= CONFIG.FRONT_RANGE; n++) {
        const freqWeight = (frontCounter[n] || 0) + 1;
        const condWeight = (conditionalProb.front[n] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        frontWeightsWithConditional[n] = freqWeight + condWeight;
      }
      
      const backWeightsWithConditional = {};      
      for (let n = 1; n <= CONFIG.BACK_RANGE; n++) {
        const freqWeight = (backCounter[n] || 0) + 1;
        const condWeight = (conditionalProb.back[n] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        backWeightsWithConditional[n] = freqWeight + condWeight;
      }
      
      front = this.smartFrontSample(frontWeightsWithConditional, CONFIG.FRONT_COUNT);
      back = this.smartBackSample(backWeightsWithConditional, 'weighted');
      
    } else if (strategy === 'regression') {
      // 均值回归模型 v2 - 完全重构
      // 核心思路：基于期望值的回归权重 + 条件概率融合 + smartFrontSample
      // 每个号码的权重 = 遗漏回归倾向（离期望值越远越容易回归） + 条件概率加成
      const omission = this.calculateOmission();
      const frontOmissionValues = Object.values(omission.front);
      const frontAvgOmission = frontOmissionValues.reduce((a, b) => a + b, 0) / frontOmissionValues.length;
      const backOmissionValues = Object.values(omission.back);
      const backAvgOmission = backOmissionValues.reduce((a, b) => a + b, 0) / backOmissionValues.length;
      
      // 前区：回归权重 = 遗漏偏差因子 + 期望值接近度 + 条件概率 + 频率基线
      const frontRegressionWeights = {};      
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        const freqBaseline = (frontCounter[i] || 0) + 1; // 频率基线
        // 遗漏回归因子：当前遗漏偏离平均遗漏越多，回归倾向越强
        const currentOmission = omission.front[i] || 0;
        const omissionDeviation = Math.abs(currentOmission - frontAvgOmission);
        const regressionFactor = 1 + omissionDeviation / frontAvgOmission;
        // 期望值接近度：号码值越接近期望值，权重略高（温和偏好）
        const distanceFromExp = Math.abs(i - expFront);
        const expFactor = 1 + (CONFIG.FRONT_RANGE - distanceFromExp) / CONFIG.FRONT_RANGE * 0.3;
        // 条件概率加成
        const condFactor = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
        frontRegressionWeights[i] = freqBaseline * regressionFactor * expFactor + condFactor;
      }
      
      // 后区：回归权重 + 条件概率融合
      const backRegressionWeights = {};      
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const freqBaseline = (backCounter[i] || 0) + 1;
        const currentOmission = omission.back[i] || 0;
        const omissionDeviation = Math.abs(currentOmission - backAvgOmission);
        const regressionFactor = 1 + omissionDeviation / backAvgOmission;
        const distanceFromExp = Math.abs(i - expBack);
        const expFactor = 1 + (CONFIG.BACK_RANGE - distanceFromExp) / CONFIG.BACK_RANGE * 0.2;
        const condFactor = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
        backRegressionWeights[i] = freqBaseline * regressionFactor * expFactor + condFactor;
      }
      
      front = this.smartFrontSample(frontRegressionWeights, CONFIG.FRONT_COUNT);
      back = this.smartBackSample(backRegressionWeights, 'regression');
      
    } else if (strategy === 'distribution') {
      // 分布策略优化版：引导式搜索替代暴力搜索
      // 先计算目标参数，然后用智能采样逐步逼近
      const targetSumFront = Math.round(expFront * CONFIG.FRONT_COUNT);
      const targetSumBack = Math.round(expBack * CONFIG.BACK_COUNT);
      
      let bestFront = null, bestBack = null;
      let bestScore = -Infinity;
      
      // 优化：用加权采样替代纯随机采样，提高命中率
      // 融合条件概率：频率权重 + 条件概率权重
      const frontFreqWeights = {};      
      const backFreqWeights = {};      
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        const freq = (frontCounter[i] || 0) + 1;
        const cond = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        frontFreqWeights[i] = freq + cond;
      }
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const freq = (backCounter[i] || 0) + 1;
        const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        backFreqWeights[i] = freq + cond;
      }
      
      for (let i = 0; i < CONFIG.DISTRIBUTION_TRY_COUNT; i++) {
        // 混合策略：80%用加权采样，20%用纯随机
        let f, b;
        if (i < CONFIG.DISTRIBUTION_TRY_COUNT * 0.8) {
          const frontNums = Object.keys(frontFreqWeights).map(Number);
          const frontWeights = Object.values(frontFreqWeights);
          f = this.weightedSampleNoReplacement(frontNums, frontWeights, CONFIG.FRONT_COUNT);
          b = this.smartBackSample(backFreqWeights, 'distribution');
        } else {
          f = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
          b = this.smartBackSample(backFreqWeights, 'distribution');
        }
        
        const sumF = f.reduce((a, b) => a + b, 0);
        const sumB = b.reduce((a, b) => a + b, 0);
        
        const diffF = Math.abs(sumF - targetSumFront);
        const diffB = Math.abs(sumB - targetSumBack);
        
        // 综合评分：和值接近度 + 组合质量 + 区间覆盖
        const sumScore = 100 - (diffF / targetSumFront * 50 + diffB / targetSumBack * 50);
        const qualityScore = this.evaluateCombination(f, b);
        // 区间覆盖加分
        const zones = new Set(f.map(n => Math.floor((n - 1) / 5)));
        const coverageBonus = zones.size >= 4 ? 5 : zones.size >= 3 ? 2 : -3;
        const totalScore = sumScore * 0.3 + qualityScore * 0.6 + coverageBonus;
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestFront = f;
          bestBack = b;
        }
        
        if (diffF < 10 && diffB < 4 && qualityScore >= 70 && zones.size >= 3) {
          front = f;
          back = b;
          break;
        }
      }
      
      // 使用最优解
      if (front.length === 0) front = bestFront || this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
      if (back.length === 0) back = bestBack || this.randomSample(this.backNumbers, CONFIG.BACK_COUNT);
      
    } else if (strategy === 'balanced') {
      // 平衡策略优化版：自适应冷热温比例
      // 根据历史数据量动态调整各类型号码数量
      const sortedFront = Object.entries(frontCounter).sort((a, b) => b[1] - a[1]);
      const hotFrontNums = sortedFront.slice(0, CONFIG.HOT_NUMBERS_COUNT).map(x => Number(x[0]));
      const coldFrontNums = sortedFront.slice(-CONFIG.COLD_NUMBERS_COUNT).map(x => Number(x[0]));
      const warmFrontNums = sortedFront.slice(CONFIG.HOT_NUMBERS_COUNT, -CONFIG.COLD_NUMBERS_COUNT).map(x => Number(x[0]));
      
      const sortedBack = Object.entries(backCounter).sort((a, b) => b[1] - a[1]);
      const hotBackNums = sortedBack.slice(0, 4).map(x => Number(x[0]));
      const coldBackNums = sortedBack.slice(-4).map(x => Number(x[0]));
      const warmBackNums = sortedBack.slice(4, -4).map(x => Number(x[0]));
      
      // 自适应分配：根据历史数据走势决定冷热温比例
      const sumTrend = this.analyzeSumTrend();
      let hotCount, warmCount, coldCount, randomCount;
      
      if (sumTrend.trendFront > 5) {
        // 近期和值上升，偏重热号
        hotCount = 2; warmCount = 2; coldCount = 0; randomCount = 1;
      } else if (sumTrend.trendFront < -5) {
        // 近期和值下降，偏重冷号和温号
        hotCount = 1; warmCount = 1; coldCount = 2; randomCount = 1;
      } else {
        // 势平稳，均衡分配
        hotCount = 1; warmCount = 2; coldCount = 1; randomCount = 1;
      }
      
      const selectedHotFront = this.randomSample(hotFrontNums, Math.min(hotCount, hotFrontNums.length));
      const selectedWarmFront = this.randomSample(warmFrontNums, Math.min(warmCount, warmFrontNums.length));
      const selectedColdFront = this.randomSample(coldFrontNums, Math.min(coldCount, coldFrontNums.length));
      
      const usedNumbers = new Set([...selectedHotFront, ...selectedWarmFront, ...selectedColdFront]);
      const remainingFront = this.frontNumbers.filter(n => !usedNumbers.has(n));
      const neededCount = CONFIG.FRONT_COUNT - usedNumbers.size;
      const selectedRandomFront = neededCount > 0 ? this.randomSample(remainingFront, neededCount) : [];
      
      front = [...selectedHotFront, ...selectedWarmFront, ...selectedColdFront, ...selectedRandomFront];
      
      // 后区：使用智能采样替代简单的热号+随机
      // 融合条件概率
      const backWeightsWithConditional = {};      
      for (let n = 1; n <= CONFIG.BACK_RANGE; n++) {
        const freq = (backCounter[n] || 0) + 1;
        const cond = (conditionalProb.back[n] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        backWeightsWithConditional[n] = freq + cond;
      }
      back = this.smartBackSample(backWeightsWithConditional, 'balanced');
    }
    
    front = this.enforceZoneCoverage(front, 4);
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    return [...front, ...back];
  }

  /**
   * 遗漏分析模型 v2 - 连续评分 + 条件概率融合
   * 核心改进：不再使用±std硬过滤，而是用连续评分函数
   * 遗漏评分 = 回归倾向（偏离均值越远分数越高） + 条件概率加成 + 频率基线
   */
  generateOmissionBasedPrediction() {
    const omission = this.calculateOmission();
    const conditionalProb = this.calculateConditionalProbability(); // 新增
    const correlation = this.calculateNumberCorrelation(); // 新增
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const totalDraws = this.getActiveData().length;
    
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
    
    // 前区：连续评分替代硬过滤
    // 评分 = 遗漏回归倾向（连续函数，平滑过渡） + 条件概率加成 + 频率基线
    const frontOmissionWeights = {};    
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const currentOmission = omission.front[i] || 0;
      // 连续回归评分：用sigmoid-like函数，遗漏值大于均值时分数高（回归倾向强）
      // 偏离均值越远 → 回归倾向越强 → 权重越高
      const deviation = (currentOmission - frontMean) / (frontStd || 1);
      const regressionScore = 1 + deviation * 0.5; // 线性回归倾向（偏离1std增加0.5权重）
      // 偏离2std以上的号码给予额外回归加成（极端遗漏即将回归）
      const extremeBonus = Math.abs(deviation) > 2 ? Math.abs(deviation) * 0.3 : 0;
      // 频率基线（避免纯遗漏导向，保持频率合理性）
      const freqBaseline = (frontCounter[i] || 0) / (totalDraws || 1) * 3;
      // 条件概率加成
      const condBonus = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      // 号码关联性加分
      const corrBonus = this.calculateCorrelationBonusForFront(i, correlation) * CONFIG.CORRELATION_WEIGHT;
      frontOmissionWeights[i] = regressionScore + extremeBonus + freqBaseline + condBonus + corrBonus + 1; // +1基线
    }
    
    // 后区：连续评分 + 条件概率融合
    const backOmissionWeights = {};    
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const currentOmission = omission.back[i] || 0;
      const deviation = (currentOmission - backMean) / (backStd || 1);
      const regressionScore = 1 + deviation * 0.5;
      const extremeBonus = Math.abs(deviation) > 2 ? Math.abs(deviation) * 0.3 : 0;
      const freqBaseline = (backCounter[i] || 0) / (totalDraws || 1) * 3;
      const condBonus = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      backOmissionWeights[i] = regressionScore + extremeBonus + freqBaseline + condBonus + 1;
    }
    
    let front = this.smartFrontSample(frontOmissionWeights, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backOmissionWeights, 'omission');
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    
    front = this.enforceZoneCoverage(front, 4);
    front.sort((a, b) => a - b);
    
    return [...front, ...back];
  }

  /**
   * 时间衰减模型 v2 - 条件概率 + 关联性增强
   * 核心改进：衰减权重 + 条件概率叠加 + 号码关联性加分
   */
  generateTimeDecayPrediction(decayFactor = CONFIG.TIME_DECAY_FACTOR) {
    const weights = this.calculateTimeDecayWeights(decayFactor);
    const conditionalProb = this.calculateConditionalProbability(); // 新增
    const correlation = this.calculateNumberCorrelation(); // 新增
    
    // 前区：衰减权重 + 条件概率叠加 + 关联性加分
    const frontEnhancedWeights = {};    
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const decayWeight = (weights.front[i] || 0) + 1; // 衰减权重基线
      const condBonus = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      const corrBonus = this.calculateCorrelationBonusForFront(i, correlation) * CONFIG.CORRELATION_WEIGHT;
      frontEnhancedWeights[i] = decayWeight + condBonus + corrBonus;
    }
    
    // 后区：衰减权重 + 条件概率叠加
    const backEnhancedWeights = {};    
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const decayWeight = (weights.back[i] || 0) + 1;
      const condBonus = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      backEnhancedWeights[i] = decayWeight + condBonus;
    }
    
    let front = this.smartFrontSample(frontEnhancedWeights, CONFIG.FRONT_COUNT);
    const back = this.smartBackSample(backEnhancedWeights, 'time_decay');
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    
    front = this.enforceZoneCoverage(front, 4);
    front.sort((a, b) => a - b);
    
    return [...front, ...back];
  }

  /**
   * 周易时空预测模型（优化版 v3 - 条件概率+关联性增强）
   * 基于用户点击生成的实际时间，结合周易卦象和开奖周期
   * 核心改进：卦象池权重融合条件概率 + 关联性优先选号
   */
  generateZhouyiPrediction(iteration = 0) {
    const now = new Date();
    const conditionalProb = this.calculateConditionalProbability(); // 新增
    const correlation = this.calculateNumberCorrelation(); // 新增
    
    // 获取时间要素（用于卦象计算）
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const weekday = now.getDay();
    
    // 计算距离下次开奖的天数
    const drawDays = [1, 3, 6];
    let daysToNextDraw = 0;
    for (const drawDay of drawDays) {
      let diff = drawDay - weekday;
      if (diff < 0) diff += 7;
      if (diff === 0 && hour >= 20) diff = 7;
      if (diff > 0) {
        daysToNextDraw = diff;
        break;
      }
    }
    if (daysToNextDraw === 0) daysToNextDraw = 7;
    
    const upperTrigram = (year + month + day + iteration) % 8;
    const lowerTrigram = (year + month + day + hour + minute) % 8;
    const movingLine = (year + month + day + hour + minute + second + daysToNextDraw) % 6;
    
    const trigramElements = {
      0: [1, 8, 15, 22, 29],
      1: [2, 9, 16, 23, 30],
      2: [3, 10, 17, 24, 31],
      3: [4, 11, 18, 25, 32],
      4: [5, 12, 19, 26, 33],
      5: [6, 13, 20, 27, 34],
      6: [7, 14, 21, 28, 35],
      7: [1, 9, 17, 25, 33]
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
    
    // 从组合池中选取前区号码（使用smartFrontSample替代weightedSampleNoReplacement）
    // smartFrontSample已内置条件概率和关联性感知，自动提升模型准确性
    // 构建卦象池权重：频率 + 条件概率 + 关联性
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const zhouyiFrontWeights = {};    
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const isInPool = combinedPool.includes(i);
      const freqWeight = isInPool ? ((frontCounter[i] || 0) + 1) * 2 : 1; // 池内号码权重加倍
      const condBonus = (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      const corrBonus = this.calculateCorrelationBonusForFront(i, correlation) * CONFIG.CORRELATION_WEIGHT;
      // 条件概率高的号码即使不在卦象池中也有机会（周易+科学的融合）
      const scienceBonus = isInPool ? 0 : (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
      zhouyiFrontWeights[i] = freqWeight + condBonus + corrBonus + scienceBonus;
    }
    
    let front = this.smartFrontSample(zhouyiFrontWeights, CONFIG.FRONT_COUNT);
    
    // 后区号码优化 v3：时辰候选 + 条件概率 + 关联性融合
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
    
    // 后区：时辰候选 + 条件概率融合
    const backCandidates = hourBackMap[hour] || [1, 6, 7, 12];
    const expandedBackWeights = {};    
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const isTimeCandidate = backCandidates.includes(i);
      // 时辰候选号码：高权重 + 频率 + 条件概率
      const timeWeight = isTimeCandidate ? 2.0 : 0.5; // 时辰号码权重加倍
      const freqWeight = (backCounter[i] || 0) + 1;
      const condWeight = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
      expandedBackWeights[i] = timeWeight * freqWeight + condWeight;
    }
    
    const back = this.smartBackSample(expandedBackWeights, 'zhouyi');
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    
    front = this.enforceZoneCoverage(front, 4);
    front.sort((a, b) => a - b);
    
    return [...front, ...back];
  }

  /**
   * 贝叶斯动态预测模型（优化版 v4 - 8维评分+条件概率）
   * 基于历史数据计算条件概率，动态调整预测权重
   * 新增：条件概率（马尔可夫转移）、号码关联性
   * 权重重平衡：先验15% + 时间12% + 趋势12% + 遗漏15% + 条件概率15% + 区间5% + 重号8% + 和值8%
   */
  generateBayesianPrediction() {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const omission = this.calculateOmission();
    const sumTrend = this.analyzeSumTrend();
    const repeatAnalysis = this.analyzeRepeatNumbers();
    const conditionalProb = this.calculateConditionalProbability(); // 新增
    const activeData = this.getActiveData();
    const totalDraws = activeData.length;
    
    if (totalDraws === 0) {
      // 如果没有历史数据，返回随机号码
      let front = this.randomSample(this.frontNumbers, CONFIG.FRONT_COUNT);
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
    // 上期开奖号码始终用全数据的最新期（不受窗口限制）
        const lastDraw = this.historyData.length > 0 ? this.historyData[this.historyData.length - 1] : null;
    
    // 1. 预计算时间加权得分（优化：从O(n²)降到O(n)，一次循环计算所有号码的时间得分）
    const frontTimeScores = {};
    const backTimeScores = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontTimeScores[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backTimeScores[i] = 0;
    
    // 使用窗口数据进行时间加权
    const timeData = this.getActiveData();
    for (let idx = 0; idx < timeData.length; idx++) {
      const draw = timeData[idx];
      const timeWeight = Math.exp((idx - timeData.length + 1) / timeData.length) * 0.2;
      for (const num of draw.front) frontTimeScores[num] += timeWeight;
      for (const num of draw.back) backTimeScores[num] += timeWeight;
    }
    
    // 2. 近期频率趋势（新增 - 优化贝叶斯动态性）
    // 计算最近15期的频率，与总频率对比
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, timeData.length);
    const recentFrontFreq = {};
    const recentBackFreq = {};
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) recentFrontFreq[i] = 0;
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) recentBackFreq[i] = 0;
    
    const recentDraws = timeData.slice(-recentCount);
    for (const draw of recentDraws) {
      for (const num of draw.front) recentFrontFreq[num]++;
      for (const num of draw.back) recentBackFreq[num]++;
    }
    
    // 前区后验概率计算（优化版 - 8维评分，新增条件概率）
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      let score = priorFront[i] * 0.15; // 先验权重降低到15%
      
      // 时间加权：使用预计算替代逐号码循环
      score += (frontTimeScores[i] || 0) * 0.12;
      
      // 近期频率趋势
      const recentRate = recentFrontFreq[i] / recentCount;
      const overallRate = (frontCounter[i] || 0) / totalDraws;
      const trendMomentum = recentRate - overallRate; // 上升动量
      score += trendMomentum * 0.12;
      
      // 条件概率（马尔可夫转移）（新增 - 核心准确性提升）
      score += (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence;
      
      // 遗漏值因子：接近平均遗漏值的号码得分更高
      const currentOmission = omission.front[i] || 0;
      const omissionDiff = Math.abs(currentOmission - frontAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (frontAvgOmission * 2));
      score += omissionFactor * 0.15;
      
      // 区间平衡因子
      const zoneIndex = Math.floor((i - 1) / 5);
      const zoneBonus = (zoneIndex % 2 === 0) ? 0.05 : 0;
      score += zoneBonus;
      
      // 重号因子
      if (lastDraw && lastDraw.front.includes(i)) {
        score += repeatAnalysis.frontRepeatRate * 0.08;
      }
      
      // 和值趋势因子
      if (sumTrend.trendFront > 5 && i > 18) {
        score += 0.04;
      } else if (sumTrend.trendFront < -5 && i <= 18) {
        score += 0.04;
      }
      
      posteriorFront[i] = score;
    }
    
    // 后区后验概率计算（优化版 - 加入条件概率）
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      let score = priorBack[i] * 0.15;
      
      score += (backTimeScores[i] || 0) * 0.12;
      
      // 近期频率趋势
      const recentRate = recentBackFreq[i] / recentCount;
      const overallRate = (backCounter[i] || 0) / totalDraws;
      const trendMomentum = recentRate - overallRate;
      score += trendMomentum * 0.12;
      
      // 条件概率（马尔可夫转移）（新增 - 核心准确性提升）
      score += (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence;
      
      // 遗漏值因子
      const currentOmission = omission.back[i] || 0;
      const omissionDiff = Math.abs(currentOmission - backAvgOmission);
      const omissionFactor = Math.max(0, 1 - omissionDiff / (backAvgOmission * 2));
      score += omissionFactor * 0.20;
      
      // 奇偶平衡因子
      const oddEvenBonus = (i % 2 === 1) ? 0.05 : 0;
      score += oddEvenBonus;
      
      // 重号因子
      if (lastDraw && lastDraw.back.includes(i)) {
        score += repeatAnalysis.backRepeatRate * 0.08;
      }
      
      posteriorBack[i] = score;
    }
    
    // 选择后验概率最高的号码作为候选池
    const sortedFront = Object.entries(posteriorFront)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.BAYESIAN_CANDIDATE_FRONT)
      .map(x => Number(x[0]));
    
    // 使用智能采样替代纯随机选择，增加多样性
    // 前区：从候选池中智能采样
    const frontCandidateWeights = {};    
    for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
      const isCandidate = sortedFront.includes(i);
      frontCandidateWeights[i] = isCandidate ? (posteriorFront[i] || 0) + 0.5 : (posteriorFront[i] || 0) + CONFIG.FRONT_RANDOM_BONUS;
    }
    let front = this.smartFrontSample(frontCandidateWeights, CONFIG.FRONT_COUNT);
    
    // 后区：使用后验概率作为权重基础，智能采样
    const backCandidateWeights = {};    
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      // 直接使用后验概率作为权重，无需sortedBack中间变量
      backCandidateWeights[i] = (posteriorBack[i] || 0) + CONFIG.BACK_RANDOM_BONUS;
    }
    const back = this.smartBackSample(backCandidateWeights, 'bayesian');
    
    front.sort((a, b) => a - b);
    back.sort((a, b) => a - b);
    
    front = this.enforceZoneCoverage(front, 4);
    front.sort((a, b) => a - b);
    
    return [...front, ...back];
  }

  /**
   * 旋转矩阵优化模型（优化版 v3 - 加权采样+条件概率融合）
   * 使用组合数学方法生成覆盖度最优的号码组合
   * 核心改进：5策略全部用加权采样替代纯随机，融入条件概率
   */
  generateRotationMatrixPrediction(groups = 1) {
    const [frontCounter, backCounter] = this.analyzeFrequency();
    const omission = this.calculateOmission();
    const conditionalProb = this.calculateConditionalProbability(); // 新增
    const correlation = this.calculateNumberCorrelation(); // 新增
    
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
      .slice(0, 8);
    
    // 添加遗漏值较大的号码
    const highOmissionFront = Object.entries(omission.front)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(x => Number(x[0]));
    
    const allFrontPool = [...new Set([...sortedFrontNums, ...lowFreqFront, ...highOmissionFront])];
    const allBackPool = [...new Set([...sortedBackNums])];
    
    // 辅助方法：为指定号码池构建加权权重（频率+条件概率+关联性）
    const buildStrategyWeights = (pool, isFront) => {
      const weights = {};      
      for (const num of pool) {
        const freq = (isFront ? frontCounter[num] : backCounter[num]) || 0;
        const cond = isFront
          ? (conditionalProb.front[num] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 8
          : (conditionalProb.back[num] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
        const corr = isFront
          ? this.calculateCorrelationBonusForFront(num, correlation) * CONFIG.CORRELATION_WEIGHT
          : 0;
        weights[num] = freq + 1 + cond + corr; // +1基线
      }
      // 确保池外号码也能被smartFrontSample考虑
      return weights;
    };
    
    const results = [];
    
    for (let g = 0; g < groups; g++) {
      let front;
      
      // 5种不同的旋转策略 - 全部改为加权采样
      if (g % 5 === 0) {
        // 策略1：主要高频号（频率加权采样）
        const weights = buildStrategyWeights(sortedFrontNums, true);
        // 扩展为全35个号码的权重字典，让smartFrontSample处理
        const fullWeights = {};        
        for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
          fullWeights[i] = sortedFrontNums.includes(i)
            ? (weights[i] || 0) * 2 // 高频号码加倍权重
            : CONFIG.FRONT_RANDOM_BONUS; // 其他号码基础权重
        }
        front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
      } else if (g % 5 === 1) {
        // 策略2：混合高频和中频（频率+条件概率加权）
        const midFreq = allFrontPool.filter(n => !sortedFrontNums.includes(n)).slice(0, 12);
        const mixedPool = [...sortedFrontNums.slice(0, 10), ...midFreq];
        const weights = buildStrategyWeights(mixedPool, true);
        const fullWeights = {};        
        for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
          fullWeights[i] = mixedPool.includes(i)
            ? (weights[i] || 0) * 1.5
            : CONFIG.FRONT_RANDOM_BONUS;
        }
        front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
      } else if (g % 5 === 2) {
        // 策略3：包含冷门号（遗漏加权+条件概率）
        const withCold = [...sortedFrontNums.slice(0, 10), ...lowFreqFront.slice(0, 5)];
        const weights = buildStrategyWeights(withCold, true);
        const fullWeights = {};        
        for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
          fullWeights[i] = withCold.includes(i)
            ? (weights[i] || 0)
            : CONFIG.FRONT_RANDOM_BONUS;
        }
        // 给冷门号额外加成（遗漏回归倾向）
        for (const num of lowFreqFront.slice(0, 5)) {
          if (num <= CONFIG.FRONT_RANGE) {
            const omissionVal = omission.front[num] || 0;
            fullWeights[num] = (fullWeights[num] || 0) + omissionVal * 0.3;
          }
        }
        front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
      } else if (g % 5 === 3) {
        // 策略4：遗漏值回归策略（遗漏加权+条件概率）
        const withOmission = [...highOmissionFront.slice(0, 3), ...sortedFrontNums.slice(0, 12)];
        const weights = buildStrategyWeights(withOmission, true);
        const fullWeights = {};        
        for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
          fullWeights[i] = withOmission.includes(i)
            ? (weights[i] || 0)
            : CONFIG.FRONT_RANDOM_BONUS;
        }
        // 遗漏号码额外回归加权
        for (const num of highOmissionFront.slice(0, 3)) {
          if (num <= CONFIG.FRONT_RANGE) {
            const omissionVal = omission.front[num] || 0;
            fullWeights[num] = (fullWeights[num] || 0) + omissionVal * 0.5; // 强回归倾向
          }
        }
        front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
      } else {
        // 策略5：全池探索（条件概率引导的全池加权）
        const weights = buildStrategyWeights(allFrontPool, true);
        const fullWeights = {};        
        for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
          fullWeights[i] = allFrontPool.includes(i)
            ? (weights[i] || 0)
            : (conditionalProb.front[i] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 5 + CONFIG.FRONT_RANDOM_BONUS;
        }
        front = this.smartFrontSample(fullWeights, CONFIG.FRONT_COUNT);
      }
      
      // 后区：全部使用smartBackSample（已内置条件概率）
      let back;
      if (g % 3 === 0) {
        // 策略1：频率+条件概率智能采样
        const backFreqWeights = {};        
        for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
          const freq = (backCounter[i] || 0) + 1;
          const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
          backFreqWeights[i] = freq + cond;
        }
        back = this.smartBackSample(backFreqWeights, 'rotation');
      } else if (g % 3 === 1) {
        // 策略2：遗漏值+条件概率智能采样
        const backOmissionWeights = {};        
        for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
          const omissionVal = (omission.back[i] || 0) + 1;
          const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 8;
          backOmissionWeights[i] = omissionVal + cond;
        }
        back = this.smartBackSample(backOmissionWeights, 'rotation');
      } else {
        // 策略3：条件概率引导采样（主要靠条件概率）
        const backCondWeights = {};        
        for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
          const cond = (conditionalProb.back[i] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
          backCondWeights[i] = cond + CONFIG.BACK_RANDOM_BONUS + 1;
        }
        back = this.smartBackSample(backCondWeights, 'rotation');
      }
      
      front.sort((a, b) => a - b);
      back.sort((a, b) => a - b);
      results.push({ front, back });
    }
    
    return results;
  }

  /**
   * 混合预测模型（优化版 v6 - 修复硬编码后区+增强评分）
   * 结合周易、贝叶斯和旋转矩阵的优势
   * 核心改进：修复evaluateCombination硬编码[1,2]后区，用条件概率最优后区替代
   */
  generateHybridPrediction() {
    // 获取新增的分析数据
    const sumTrend = this.analyzeSumTrend();
    const spanAnalysis = this.analyzeSpan();
    const repeatAnalysis = this.analyzeRepeatNumbers();
    const modelWeights = this.evaluateModelPerformance();
    const zoneRotation = this.analyzeZoneRotation();
    const conditionalProb = this.calculateConditionalProbability();
    const correlation = this.calculateNumberCorrelation();
    
    // 生成三个模型的预测结果
    const zhouyi = this.generateZhouyiPrediction();
    const bayesian = this.generateBayesianPrediction();
    const rotationResults = this.generateRotationMatrixPrediction(1);
    const rotation = rotationResults[0];
    
    // 前区：收集所有模型的候选号码，并根据模型权重加权投票
    const zhouyiFront = zhouyi.slice(0, 5);
    const bayesianFront = bayesian.slice(0, 5);
    const rotationFront = rotation.front;
    
    // 加权投票机制（优化：增加条件概率额外加成）
    const voteCount = {};
    zhouyiFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + modelWeights.zhouyi;
      // 条件概率加成：马尔可夫转移倾向高的号码额外加分
      voteCount[num] += (conditionalProb.front[num] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
    });
    bayesianFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + modelWeights.bayesian;
      voteCount[num] += (conditionalProb.front[num] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
    });
    rotationFront.forEach(num => {
      voteCount[num] = (voteCount[num] || 0) + modelWeights.rotation;
      voteCount[num] += (conditionalProb.front[num] || 0) * CONFIG.CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
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
    
    // 从候选中选择前区号码，使用加权采样+质量评估（优化版）
    let bestFront = null;
    let bestScore = -Infinity;
    
    // 优化1：先从候选中用加权采样（票数高优先）
    const candidateWeights = candidates.map(num => voteCount[num] || 1);
    
    for (let i = 0; i < 150; i++) { // 150次尝试
      // 使用加权采样替代纯随机，50%用加权，50%用随机
      let selected;
      if (i < 75) {
        selected = this.weightedSampleNoReplacement(candidates, candidateWeights, CONFIG.FRONT_COUNT);
      } else {
        selected = this.randomSample(candidates, CONFIG.FRONT_COUNT);
      }
      
      // 检查是否符合跨度要求
      const span = Math.max(...selected) - Math.min(...selected);
      const spanDiff = Math.abs(span - spanAnalysis.avgFrontSpan);
      if (spanDiff > CONFIG.SPAN_DIFF_THRESHOLD * 1.2) continue; // 稍微放宽
      
      // 检查和值要求
      const sum = selected.reduce((a, b) => a + b, 0);
      const sumDiff = Math.abs(sum - sumTrend.avgFrontSum);
      if (sumDiff > CONFIG.SUM_DIFF_THRESHOLD * 1.2) continue;
      
      // 检查AC值
      const acValue = this.calculateACValue(selected);
      if (acValue < CONFIG.AC_VALUE_MIN || acValue > CONFIG.AC_VALUE_MAX) continue;
      
      // 检查连号合理性
      const consecutiveGroups = this.analyzeConsecutiveNumbers(selected);
      if (consecutiveGroups.length > CONFIG.CONSECUTIVE_GROUPS_MAX) continue;
      
      // 区间覆盖检查（新增）
      const zones = new Set(selected.map(n => Math.floor((n - 1) / 5)));
      if (zones.size < 3) continue; // 覆盖不足3个区间，跳过
      
      // 计算条件概率最优后区号码（替代硬编码[1,2]）
      const probableBack = Object.entries(conditionalProb.back)
        .sort((a, b) => b[1] - a[1])
        .slice(0, CONFIG.BACK_COUNT)
        .map(x => Number(x[0]))
        .sort((a, b) => a - b);
      const score = this.evaluateCombination(selected, probableBack);
      
      if (score > bestScore) {
        bestScore = score;
        bestFront = selected;
      }
      
      if (score >= CONFIG.QUALITY_SCORE_THRESHOLD) break;
    }
    
    let front = bestFront || this.randomSample(candidates, CONFIG.FRONT_COUNT);
    
    // 后区：使用投票机制 + 重号策略 + 条件概率
    const zhouyiBack = zhouyi.slice(5);
    const bayesianBack = bayesian.slice(5);
    const rotationBack = rotation.back;
    
    const backVoteCount = {};
    zhouyiBack.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + modelWeights.zhouyi;
      backVoteCount[num] += (conditionalProb.back[num] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
    });
    bayesianBack.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + modelWeights.bayesian;
      backVoteCount[num] += (conditionalProb.back[num] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
    });
    rotationBack.forEach(num => {
      backVoteCount[num] = (backVoteCount[num] || 0) + modelWeights.rotation;
      backVoteCount[num] += (conditionalProb.back[num] || 0) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 3;
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
    
    // 后区：使用智能采样替代投票截取，增加多样性
    const backCandidateWeights = {};    
    // 将投票分数作为权重基础
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const voteScore = backVoteCount[i] || 0;
      // 候选号码保留投票权重，其他号码给予基础权重
      backCandidateWeights[i] = voteScore > 0 ? voteScore + 0.3 : CONFIG.BACK_RANDOM_BONUS;
    }
    
    const back = this.smartBackSample(backCandidateWeights, 'hybrid');
    
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

  /**
   * Fisher-Yates均匀随机采样（修复偏向性bug）
   * 原来的 sort(() => 0.5 - Math.random()) 不是均匀分布
   * Fisher-Yates shuffle 保证每个排列等概率出现
   */
  randomSample(arr, k) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, k);
  }

  /**
   * 后区智能采样（优化版 v4 - 修复双重计算bug）
   * 修复：不再内部叠加条件概率（各模型已在外层构建权重时加入）
   * 采样层只负责：权重上限、随机加分、噪声扰动、分层采样、配对回避
   */
  smartBackSample(weightsOrCounter, strategy = 'default') {
    const backNumbers = Array.from({ length: CONFIG.BACK_RANGE }, (_, i) => i + 1);
    
    // 计算历史配对频率
    const pairFrequency = this.calculateBackPairFrequency();
    
    // 注意：条件概率已由各模型在外层构建权重时加入
    // 此处不再重复叠加，避免双重计算导致权重失衡
    
    // 计算每个号码的调整后权重
    const adjustedWeights = {};    
    for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
      const rawWeight = weightsOrCounter[i] || 0;
      // 1. 权重上限：防止热号垄断
      const cappedWeight = Math.min(rawWeight, CONFIG.BACK_WEIGHT_CAP);
      // 2. 随机加分：每个号码都有基础机会
      const withBonus = cappedWeight + CONFIG.BACK_RANDOM_BONUS;
      // 3. 噪声扰动：每次采样都不同
      const noise = (Math.random() - 0.5) * 2 * CONFIG.BACK_NOISE_FACTOR;
      const finalWeight = Math.max(0.1, withBonus + noise);
      adjustedWeights[i] = finalWeight;
    }
    
    // 4. 分层采样策略：优先1奇1偶搭配
    const oddNums = backNumbers.filter(n => n % 2 !== 0);  // [1,3,5,7,9,11]
    const evenNums = backNumbers.filter(n => n % 2 === 0); // [2,4,6,8,10,12]
    
    // 5. 配对回避+和值合理性：尝试多次，避开高频配对且和值合理
    const maxPairAttempts = 15;
    let bestBack = null;
    let bestPairScore = -Infinity;
        
    for (let attempt = 0; attempt < maxPairAttempts; attempt++) {
      // 每次重新计算噪声（确保每次尝试结果不同）
      const attemptWeights = {};
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) {
        const reNoise = (Math.random() - 0.5) * 2 * CONFIG.BACK_NOISE_FACTOR;
        attemptWeights[i] = Math.max(0.1, adjustedWeights[i] + reNoise);
      }
          
      const oddWeights = oddNums.map(n => attemptWeights[n]);
      const evenWeights = evenNums.map(n => attemptWeights[n]);
          
      let back;
      if (CONFIG.BACK_STRATIFIED_ODD && strategy !== 'regression') {
        const oddPick = this.weightedSampleNoReplacement(oddNums, oddWeights, 1);
        const evenPick = this.weightedSampleNoReplacement(evenNums, evenWeights, 1);
        back = [...oddPick, ...evenPick];
      } else {
        const allNums = Object.keys(attemptWeights).map(Number);
        const allWeights = Object.values(attemptWeights);
        back = this.weightedSampleNoReplacement(allNums, allWeights, CONFIG.BACK_COUNT);
      }
          
      // 和值合理性检查（新增 - 拒绝和值>16或<3的配对）
      const backSum = back.reduce((a, b) => a + b, 0);
      if (backSum > 16 || backSum < 3) continue; // 跳过不合理的配对
          
      // 评估配对得分：配对频率越低越好 + 和值合理性加分
      const pairKey = [...back].sort((a, b) => a - b).join(',');
      const pairFreq = pairFrequency[pairKey] || 0;
      const uniquenessScore = pairFreq === 0 ? 20 : (10 - pairFreq * 3);
      // 和值在6-12范围加分
      const sumScore = (backSum >= 6 && backSum <= 12) ? 10 : (backSum >= 3 && backSum <= 16) ? 3 : -5;
      const pairScore = uniquenessScore + sumScore;
          
      if (pairScore > bestPairScore) {
        bestPairScore = pairScore;
        bestBack = back;
      }
    }
    
    bestBack.sort((a, b) => a - b);
    return bestBack;
  }

  /**
   * 区间覆盖强制修正（通用方法）
   * 确保前区号码覆盖至少 minZones 个区间
   * 区间划分: 1-5, 6-10, 11-15, 16-20, 21-25, 26-30, 31-35
   * @param {number[]} front - 前区号码数组
   * @param {number} minZones - 最少区间覆盖数
   * @returns {number[]} 修正后的前区号码数组（已排序）
   */
  enforceZoneCoverage(front, minZones = 4) {
    const frontZones = new Set(front.map(n => Math.floor((n - 1) / 5)));
    if (frontZones.size >= minZones) return front.sort((a, b) => a - b);
    
    const uncoveredZones = [0,1,2,3,4,5,6].filter(z => !frontZones.has(z));
    const frontCopy = [...front];
    
    while (frontZones.size < minZones && uncoveredZones.length > 0) {
      const targetZone = uncoveredZones[Math.floor(Math.random() * uncoveredZones.length)];
      const zoneNumbers = Array.from({ length: 5 }, (_, i) => targetZone * 5 + i + 1);
      
      // 找最拥挤的区间
      const zoneCount = {};
      frontCopy.forEach(n => { zoneCount[Math.floor((n-1)/5)] = (zoneCount[Math.floor((n-1)/5)] || 0) + 1; });
      const crowdedZone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0];
      const removeIdx = frontCopy.findIndex(n => Math.floor((n-1)/5) === Number(crowdedZone[0]));
      
      const replacement = zoneNumbers.filter(n => !frontCopy.includes(n));
      if (replacement.length > 0) {
        frontCopy[removeIdx] = replacement[Math.floor(Math.random() * replacement.length)];
        frontZones.add(targetZone);
        uncoveredZones.splice(uncoveredZones.indexOf(targetZone), 1);
      }
    }
    
    return frontCopy.sort((a, b) => a - b);
  }

  /**
   * 计算后区历史配对频率（新增 - 用于配对回避机制）
   * 统计历史数据中每种后区配对出现的次数
   */
  calculateBackPairFrequency() {
    if (this.cache.backPairFrequency) {
      return this.cache.backPairFrequency;
    }
    
    const pairFreq = {};
    for (const data of this.getActiveData()) {
      const pairKey = [...data.back].sort((a, b) => a - b).join(',');
      pairFreq[pairKey] = (pairFreq[pairKey] || 0) + 1;
    }
    
    this.cache.backPairFrequency = pairFreq;
    return pairFreq;
  }

  /**
   * 计算条件概率（马尔可夫转移矩阵）（优化版 v2 - Laplace平滑+时间衰减+自适应权重）
   * 给定上期开奖号码，计算下期每个号码出现的概率
   * 核心改进：Laplace平滑防止零概率、时间衰减让近期转移更重要、自适应置信度
   */
  calculateConditionalProbability() {
    if (this.cache.conditionalProbability) {
      return this.cache.conditionalProbability;
    }
      
    const activeData = this.getActiveData();
    if (activeData.length < 3) {
      const frontUniform = {};      
      const backUniform = {};      
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) frontUniform[i] = 1 / CONFIG.FRONT_RANGE;      
      for (let i = 1; i <= CONFIG.BACK_RANGE; i++) backUniform[i] = 1 / CONFIG.BACK_RANGE;      
      const result = { front: frontUniform, back: backUniform, confidence: 0 };      
      this.cache.conditionalProbability = result;      
      return result;      
    }
      
    const LAPLACE_ALPHA = 0.01; // Laplace平滑参数
    const TIME_DECAY = 0.98;     // 时间衰减因子
      
    // 构建转移矩阵：使用窗口数据 + 时间衰减权重
    const frontTransition = {};  // frontTransition[lastNum][nextNum] = weighted_count
    const backTransition = {};   // backTransition[lastNum][nextNum] = weighted_count
      
    for (let i = 1; i < activeData.length; i++) {
      const prevDraw = activeData[i - 1];
      const currDraw = activeData[i];
        
      // 时间衰减权重：越近期的转移权重越高
      const recencyIndex = activeData.length - i;
      const timeWeight = Math.pow(TIME_DECAY, recencyIndex);
      
      // 前区转移（带时间衰减权重）
      for (const prevNum of prevDraw.front) {
        if (!frontTransition[prevNum]) frontTransition[prevNum] = {};
        for (const currNum of currDraw.front) {
          frontTransition[prevNum][currNum] = (frontTransition[prevNum][currNum] || 0) + timeWeight;
        }
      }
      
      // 后区转移（带时间衰减权重）
      for (const prevNum of prevDraw.back) {
        if (!backTransition[prevNum]) backTransition[prevNum] = {};
        for (const currNum of currDraw.back) {
          backTransition[prevNum][currNum] = (backTransition[prevNum][currNum] || 0) + timeWeight;
        }
      }
    }
    
    // 条件概率的条件始终用全数据最新期（不受窗口限制）
    const lastDraw = this.historyData[this.historyData.length - 1];
    const frontConditional = {};
    const backConditional = {};
    
    // Laplace平滑转移概率函数
    const laplaceProb = (rawCount, rawTotal, numOutcomes) => {
      return (rawCount + LAPLACE_ALPHA) / (rawTotal + LAPLACE_ALPHA * numOutcomes);
    };    
    
    // 前区条件概率：P(Y appears | X appeared last draw) 的聚合
    for (let y = 1; y <= CONFIG.FRONT_RANGE; y++) {
      let score = 0;
      let weightSum = 0;
      
      for (const x of lastDraw.front) {
        const transitions = frontTransition[x] || {};
        const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
        const rawCount = transitions[y] || 0;
        const prob = laplaceProb(rawCount, rawTotal, CONFIG.FRONT_RANGE);
        score += prob;
        weightSum += 1;
      }
      
      frontConditional[y] = weightSum > 0 ? score / weightSum : 1 / CONFIG.FRONT_RANGE;
    }
    
    // 后区条件概率
    for (let y = 1; y <= CONFIG.BACK_RANGE; y++) {
      let score = 0;
      let weightSum = 0;
      
      for (const x of lastDraw.back) {
        const transitions = backTransition[x] || {};
        const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
        const rawCount = transitions[y] || 0;
        const prob = laplaceProb(rawCount, rawTotal, CONFIG.BACK_RANGE);
        score += prob;
        weightSum += 1;
      }
      
      backConditional[y] = weightSum > 0 ? score / weightSum : 1 / CONFIG.BACK_RANGE;
    }
    
    // 二阶马尔可夫增强：考虑最近2期的联合转移
    if (this.historyData.length >= 3) {
      const secondLastDraw = this.historyData[this.historyData.length - 2];
      
      // 傀区二阶增强
      for (let y = 1; y <= CONFIG.FRONT_RANGE; y++) {
        let secondOrderScore = 0;
        let secondOrderWeight = 0;
              
        for (const x of secondLastDraw.front) {
          const transitions = frontTransition[x] || {};
          const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
          const rawCount = transitions[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.FRONT_RANGE);
          secondOrderScore += prob;
          secondOrderWeight += 1;
        }
              
        // 一阶权重70% + 二阶权重30%
        const secondOrderContribution = secondOrderWeight > 0 ? secondOrderScore / secondOrderWeight : 0;
        frontConditional[y] = frontConditional[y] * 0.7 + secondOrderContribution * 0.3;
      }
            
      // 后区二阶增强
      for (let y = 1; y <= CONFIG.BACK_RANGE; y++) {
        let secondOrderScore = 0;
        let secondOrderWeight = 0;
              
        for (const x of secondLastDraw.back) {
          const transitions = backTransition[x] || {};
          const rawTotal = Object.values(transitions).reduce((a, b) => a + b, 0);
          const rawCount = transitions[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.BACK_RANGE);
          secondOrderScore += prob;
          secondOrderWeight += 1;
        }
              
        const secondOrderContribution = secondOrderWeight > 0 ? secondOrderScore / secondOrderWeight : 0;
        backConditional[y] = backConditional[y] * 0.7 + secondOrderContribution * 0.3;
      }
    }
    
    // 计算条件概率的置信度（自适应权重基础）
    const confidence = this.calculateConditionalConfidence(frontTransition, backTransition, LAPLACE_ALPHA);
      
    const result = { front: frontConditional, back: backConditional, confidence };    
    this.cache.conditionalProbability = result;    
    return result;
  }
    
  /**
   * 计算条件概率的置信度（自适应权重基础）
   * 基于历史回测：条件概率推荐的高概率号码的实际命中率 vs 随机基线
   * @returns {number} 置信度 0-1，越高说明条件概率越有预测力
   */
  calculateConditionalConfidence(frontTransition, backTransition, laplaceAlpha) {
    const activeData = this.getActiveData();
    if (activeData.length < 20) return 0.3;
      
    const testPeriods = Math.min(20, activeData.length - 1);
    let frontHits = 0;
    let backHits = 0;
    let frontRandomHits = 0;
    let backRandomHits = 0;
      
    const laplaceProb = (rawCount, rawTotal, numOutcomes) => {
      return (rawCount + laplaceAlpha) / (rawTotal + laplaceAlpha * numOutcomes);
    };    
      
    for (let t = activeData.length - testPeriods; t < activeData.length; t++) {
      const prevDraw = activeData[t - 1];
      const currDraw = activeData[t];
        
      const tempFrontCond = {};
      const tempBackCond = {};
        
      for (let y = 1; y <= CONFIG.FRONT_RANGE; y++) {
        let score = 0;
        let wSum = 0;
        for (const x of prevDraw.front) {
          const tr = frontTransition[x] || {};
          const rawTotal = Object.values(tr).reduce((a, b) => a + b, 0);
          const rawCount = tr[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.FRONT_RANGE);
          score += prob;
          wSum += 1;
        }
        tempFrontCond[y] = wSum > 0 ? score / wSum : 1 / CONFIG.FRONT_RANGE;
      }
        
      for (let y = 1; y <= CONFIG.BACK_RANGE; y++) {
        let score = 0;
        let wSum = 0;
        for (const x of prevDraw.back) {
          const tr = backTransition[x] || {};
          const rawTotal = Object.values(tr).reduce((a, b) => a + b, 0);
          const rawCount = tr[y] || 0;
          const prob = laplaceProb(rawCount, rawTotal, CONFIG.BACK_RANGE);
          score += prob;
          wSum += 1;
        }
        tempBackCond[y] = wSum > 0 ? score / wSum : 1 / CONFIG.BACK_RANGE;
      }
        
      // 取条件概率最高的top号码
      const topFront = Object.entries(tempFrontCond)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(x => Number(x[0]));
      const topBack = Object.entries(tempBackCond)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(x => Number(x[0]));
        
      // 统计命中
      frontHits += currDraw.front.filter(n => topFront.includes(n)).length;
      backHits += currDraw.back.filter(n => topBack.includes(n)).length;
        
      // 随机基线期望命中数
      frontRandomHits += CONFIG.FRONT_COUNT * 10 / CONFIG.FRONT_RANGE;
      backRandomHits += CONFIG.BACK_COUNT * 4 / CONFIG.BACK_RANGE;
    }
      
    // 置信度 = 实际命中率 / 随机命中率（归一化到0-1）
    const frontConfidence = frontRandomHits > 0
      ? Math.min(1, (frontHits / frontRandomHits) / 2)
      : 0.3;
    const backConfidence = backRandomHits > 0
      ? Math.min(1, (backHits / backRandomHits) / 2)
      : 0.3;
      
    const confidence = frontConfidence * 0.5 + backConfidence * 0.5;
    console.log(`📊 条件概率置信度: 前区${frontConfidence.toFixed(2)} 后区${backConfidence.toFixed(2)} 综合${confidence.toFixed(2)} (命中率: 前${frontHits}/${frontRandomHits.toFixed(1)} 后${backHits}/${backRandomHits.toFixed(1)})`);
    return confidence;
  }

  /**
   * 计算号码关联性（共现频率）（新增 - 提升选号准确性）
   * 统计哪些号码在同一期出现时，其他号码也经常出现
   * 用于选择"搭配性好"的号码组合
   */
  calculateNumberCorrelation() {
    if (this.cache.numberCorrelation) {
      return this.cache.numberCorrelation;
    }
    
    if (this.getActiveData().length < 5) {
      const emptyResult = { front: {}, back: {} };
      this.cache.numberCorrelation = emptyResult;
      return emptyResult;
    }
    
    // 前区共现统计（使用窗口数据）
    const activeData = this.getActiveData();
    const frontCoOccurrence = {};
    for (const draw of activeData) {
      for (let i = 0; i < draw.front.length; i++) {
        const a = draw.front[i];
        if (!frontCoOccurrence[a]) frontCoOccurrence[a] = {};
        for (let j = 0; j < draw.front.length; j++) {
          if (i === j) continue;
          const b = draw.front[j];
          frontCoOccurrence[a][b] = (frontCoOccurrence[a][b] || 0) + 1;
        }
      }
    }
    
    // 后区共现统计
    const backCoOccurrence = {};
    for (const draw of activeData) {
      for (let i = 0; i < draw.back.length; i++) {
        const a = draw.back[i];
        if (!backCoOccurrence[a]) backCoOccurrence[a] = {};
        for (let j = 0; j < draw.back.length; j++) {
          if (i === j) continue;
          const b = draw.back[j];
          backCoOccurrence[a][b] = (backCoOccurrence[a][b] || 0) + 1;
        }
      }
    }
    
    const result = { front: frontCoOccurrence, back: backCoOccurrence };
    this.cache.numberCorrelation = result;
    return result;
  }

  /**
   * 枚举所有可能的优质后区配对并评分（新增 - 硬性唯一性保证的基础）
   * C(12,2) = 66种配对，按条件概率+频率+和值+奇偶评分排序
   * @param {Set} usedBackKeys - 已使用的配对key集合，这些配对会被排除
   * @returns {Array} 评分排序后的配对数组
   */
  enumerateBackPairs(usedBackKeys = new Set()) {
    const pairs = [];
    const pairFrequency = this.calculateBackPairFrequency();
    const [_, backCounter] = this.analyzeFrequency();
    const conditionalProb = this.calculateConditionalProbability();
    
    for (let a = 1; a <= CONFIG.BACK_RANGE - 1; a++) {
      for (let b = a + 1; b <= CONFIG.BACK_RANGE; b++) {
        const pairKey = `${a},${b}`;
        if (usedBackKeys.has(pairKey)) continue; // 跳过已使用的配对
        
        let score = 0;
        
        // 1. 频率得分：频率越高越可能命中
        score += ((backCounter[a] || 0) + (backCounter[b] || 0)) * 0.2;
        
        // 2. 条件概率得分：马尔可夫转移概率
        score += ((conditionalProb.back[a] || 0) + (conditionalProb.back[b] || 0)) * CONFIG.BACK_CONDITIONAL_WEIGHT * conditionalProb.confidence * 10;
        
        // 3. 独特性得分：历史出现越少的配对越独特
        const freq = pairFrequency[pairKey] || 0;
        score += (5 - Math.min(freq, 5)) * 3;
        
        // 4. 和值合理性得分
        const sum = a + b;
        if (sum >= 6 && sum <= 12) score += 10;
        else if (sum >= 3 && sum <= 16) score += 3;
        else score -= 8;
        
        // 5. 奇偶平衡得分
        if (a % 2 !== b % 2) score += 5; // 1奇1偶加分
        else score -= 3; // 同奇同偶扣分
        
        // 6. 跨度得分
        const span = b - a;
        if (span >= 3 && span <= 8) score += 3; // 合理跨度加分
        else if (span <= 2) score += 1; // 相邻号轻微加分
        else score -= 2; // 跨度太大扣分
        
        pairs.push({ pair: [a, b], score, key: pairKey, sum, span });
      }
    }
    
    pairs.sort((a, b) => b.score - a.score);
    return pairs;
  }

  /**
   * 从遗漏数据构建权重（用于遗漏策略的智能采样）
   * 遗漏值大的号码权重越高（回归理论）
   */
  buildWeightsFromOmission(omissionData, candidateNums = null) {
    const weights = {};    
    const nums = candidateNums || Object.keys(omissionData).map(Number);
    const range = Object.keys(omissionData).length > CONFIG.FRONT_RANGE ? CONFIG.FRONT_RANGE : CONFIG.BACK_RANGE;
    const allNums = Array.from({ length: range }, (_, i) => i + 1);
      
    for (const n of allNums) {
      // 遗漏值越大，回归概率越高，权重越大
      weights[n] = (omissionData[n] || 0) + 1; // +1避免权重为0
    }
      
    return weights;
  }
  
  /**
   * 多组去重生成（优化版 v2 - 硬性唯一保证）
   * 对同一模型生成多组号码时，**绝对保证**后区组合不重复
   * 算法：先尝试模型自然生成去重，若失败则使用enumerateBackPairs强制枚举
   * @param {string} model - 模型名称
   * @param {number} groups - 生成组数
   * @returns {Array} 唯一的号码组合数组
   */
  generateUniqueGroups(model, groups) {
    const usedBackKeys = new Set(); // 已使用的后区组合key（硬性约束）
    const results = [];
    
    for (let i = 0; i < groups; i++) {
      let bestComb = null;
      let bestScore = -Infinity;
      
      // 尝试多次模型自然生成，寻找不重复且高质量的组合
      for (let attempt = 0; attempt < CONFIG.UNIQUE_BACK_ATTEMPTS; attempt++) {
        let comb;
        if (model === 'omission') comb = this.generateOmissionBasedPrediction();
        else if (model === 'time_decay') comb = this.generateTimeDecayPrediction();
        else if (model === 'bayesian') comb = this.generateBayesianPrediction();
        else if (model === 'zhouyi') comb = this.generateZhouyiPrediction(i + attempt);
        else if (model === 'hybrid') comb = this.generateHybridPrediction();
        else comb = this.generateStatisticalPrediction(model);
        
        const front = comb.slice(0, 5);
        const back = comb.slice(5);
        const backKey = [...back].sort((a, b) => a - b).join(',');
        
        // 硬性唯一约束：已使用的配对直接跳过
        if (usedBackKeys.has(backKey)) continue;
        
        // 评分：后区和值 + 前区质量
        let score = 0;
        const backSum = back.reduce((a, b) => a + b, 0);
        if (backSum >= 6 && backSum <= 12) score += 20;
        else if (backSum >= 3 && backSum <= 16) score += 5;
        else score -= 25;
        
        score += this.evaluateCombination(front, back) * 0.5;
        
        if (score > bestScore) {
          bestScore = score;
          bestComb = { front, back, backKey };        
        }
      }
      
      // 如果自然生成找到了不重复的配对
      if (bestComb && !usedBackKeys.has(bestComb.backKey)) {
        usedBackKeys.add(bestComb.backKey);
        results.push({ front: bestComb.front, back: bestComb.back });
        continue;
      }
      
      // 自然生成失败：使用enumerateBackPairs强制枚举最优配对
      const bestPairs = this.enumerateBackPairs(usedBackKeys);
      if (bestPairs.length > 0) {
        const chosenPair = bestPairs[0];
        usedBackKeys.add(chosenPair.key);
        
        // 生成前区号码（使用模型生成）
        let front;
        if (model === 'omission') front = this.generateOmissionBasedPrediction().slice(0, 5);
        else if (model === 'time_decay') front = this.generateTimeDecayPrediction().slice(0, 5);
        else if (model === 'bayesian') front = this.generateBayesianPrediction().slice(0, 5);
        else if (model === 'zhouyi') front = this.generateZhouyiPrediction(i).slice(0, 5);
        else if (model === 'hybrid') front = this.generateHybridPrediction().slice(0, 5);
        else front = this.generateStatisticalPrediction(model).slice(0, 5);
        
        front = this.enforceZoneCoverage(front, 4);
        results.push({ front, back: chosenPair.pair });
      } else {
        // 极端情况：所有66种配对都用完了（不可能出现，5组 < 66）
        // 但以防万一，用模型自然生成兜底
        let comb;
        if (model === 'omission') comb = this.generateOmissionBasedPrediction();
        else if (model === 'time_decay') comb = this.generateTimeDecayPrediction();
        else if (model === 'bayesian') comb = this.generateBayesianPrediction();
        else if (model === 'zhouyi') comb = this.generateZhouyiPrediction(i);
        else if (model === 'hybrid') comb = this.generateHybridPrediction();
        else comb = this.generateStatisticalPrediction(model);
        
        const front = comb.slice(0, 5);
        const back = comb.slice(5);
        results.push({ front, back });
      }
    }
      
    return results;
  }
  
  /**
   * 旋转矩阵多组去重生成（优化版 v2 - 硬性唯一保证）
   * 绝对保证后区组合不重复
   */
  generateUniqueRotationGroups(groups) {
    const usedBackKeys = new Set();
    const results = [];
    
    // 先尝试模型自然生成去重
    const rawResults = this.generateRotationMatrixPrediction(groups * 3); // 生成3倍数量
    
    for (const group of rawResults) {
      const backKey = [...group.back].sort((a, b) => a - b).join(',');
      const backSum = group.back.reduce((a, b) => a + b, 0);
      
      // 硬性唯一 + 和值合理性
      if (!usedBackKeys.has(backKey) && backSum >= 3 && backSum <= 16) {
        usedBackKeys.add(backKey);
        results.push(group);
        if (results.length >= groups) break;
      }
    }
    
    // 自然去重不足：使用enumerateBackPairs强制枚举
    if (results.length < groups) {
      const bestPairs = this.enumerateBackPairs(usedBackKeys);
      for (const pairInfo of bestPairs) {
        if (results.length >= groups) break;
        usedBackKeys.add(pairInfo.key);
        
        // 生成前区：用旋转矩阵策略
        const extraFrontResults = this.generateRotationMatrixPrediction(1);
        const front = extraFrontResults[0].front;
        results.push({ front, back: pairInfo.pair });
      }
    }
    
    // 最终兜底（不可能到达，因为66种配对远大于groups）
    while (results.length < groups) {
      const extra = this.generateRotationMatrixPrediction(1);
      results.push(extra[0]);
    }
      
    return results;
  }

  /**
   * 前区智能采样（优化版 v4 - 修复双重计算bug）
   * 修复：不再内部叠加条件概率和关联性（各模型已在外层构建权重时加入）
   * 采样层只负责：权重上限、随机加分、噪声扰动、区间覆盖
   * 区间划分: 1-5, 6-10, 11-15, 16-20, 21-25, 26-30, 31-35
   */
  smartFrontSample(weightsOrCounter, count = CONFIG.FRONT_COUNT) {
    // 注意：条件概率和关联性已由各模型在外层构建权重时加入
    // 此处不再重复叠加，避免双重计算导致权重失衡
    
    // 尝试多次，优先选择区间覆盖好的组合
    const maxAttempts = 15;
    let bestResult = null;
    let bestCoverageScore = -Infinity;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const adjustedWeights = {};    
      for (let i = 1; i <= CONFIG.FRONT_RANGE; i++) {
        const rawWeight = weightsOrCounter[i] || 0;
        // 1. 权重上限：防止热号垄断
        const cappedWeight = Math.min(rawWeight, CONFIG.FRONT_WEIGHT_CAP);
        // 2. 随机加分：每个号码都有基础机会
        const withBonus = cappedWeight + CONFIG.FRONT_RANDOM_BONUS;
        // 3. 噪声扰动：每次采样都不同
        const noise = (Math.random() - 0.5) * 2 * CONFIG.FRONT_NOISE_FACTOR;
        const finalWeight = Math.max(0.2, withBonus + noise);
        adjustedWeights[i] = finalWeight;
      }
      
      const allNums = Object.keys(adjustedWeights).map(Number);
      const allWeights = Object.values(adjustedWeights);
      const result = this.weightedSampleNoReplacement(allNums, allWeights, count);
      
      // 计算区间覆盖得分
      const zones = new Set(result.map(n => Math.floor((n - 1) / 5)));
      const coverageScore = zones.size * 10 + // 区间数越多越好（3区=30, 4区=40, 5区=50）
                           (zones.size >= 4 ? 15 : zones.size >= 3 ? 5 : -20); // 覆盖3区以上加分
      
      if (coverageScore > bestCoverageScore) {
        bestCoverageScore = coverageScore;
        bestResult = result;
      }
    }
    
    // 如果区间覆盖不足3个，强制调整
    const zones = new Set(bestResult.map(n => Math.floor((n - 1) / 5)));
    if (zones.size < 4) { // 提高标准到4个区间
      // 替换号码，增加新区间覆盖
      const uncoveredZones = [0,1,2,3,4,5,6].filter(z => !zones.has(z));
      while (zones.size < 4 && uncoveredZones.length > 0) {
        const targetZone = uncoveredZones[Math.floor(Math.random() * uncoveredZones.length)];
        const zoneNumbers = Array.from({ length: 5 }, (_, i) => targetZone * 5 + i + 1);
        
        // 从最拥挤的区间中移除一个号码，替换为新区间号码
        const zoneCount = {};
        bestResult.forEach(n => {
          const z = Math.floor((n - 1) / 5);
          zoneCount[z] = (zoneCount[z] || 0) + 1;
        });
        const crowdedZone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0];
        const removeIdx = bestResult.findIndex(n => Math.floor((n - 1) / 5) === Number(crowdedZone[0]));
        
        const replacement = zoneNumbers[Math.floor(Math.random() * zoneNumbers.length)];
        if (!bestResult.includes(replacement)) {
          bestResult[removeIdx] = replacement;
          uncoveredZones.splice(uncoveredZones.indexOf(targetZone), 1);
          // 重新计算区间覆盖
          zones.add(targetZone);
        } else {
          // 避免重复，换一个号码
          const altReplacement = zoneNumbers.filter(n => !bestResult.includes(n));
          if (altReplacement.length > 0) {
            bestResult[removeIdx] = altReplacement[Math.floor(Math.random() * altReplacement.length)];
            uncoveredZones.splice(uncoveredZones.indexOf(targetZone), 1);
            zones.add(targetZone);
          }
        }
      }
    }
    
    return bestResult;
  }

  /**
   * 计算前区号码i的关联性加分
   * 基于号码共现频率：如果号码i与历史中出现频率最高的号码有高共现度，加分
   */
  calculateCorrelationBonusForFront(num, correlation) {
    if (!correlation || !correlation.front) return 0;
    
    // 获取与号码num共现频率最高的几个号码的共现次数总和
    const coOccurrences = correlation.front[num] || {};
    let totalCorrelation = 0;
    
    // 取前5个最常共现的号码的共现次数
    const topCoOccurred = Object.entries(coOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    for (const [_, count] of topCoOccurred) {
      totalCorrelation += count;
    }
    
    // 归一化：共现5次以上开始有显著加分
    return totalCorrelation > 5 ? totalCorrelation / 10 : totalCorrelation / 20;
  }

  /**
   * 评估号码组合的质量（优化版 v6 - 14维评分）
   * 返回评分（0-100），分数越高表示组合越合理
   * 新增维度：AC值、间距分布、连号合理性、质合比、012路、尾数多样性
   *          历史相似度、条件概率聚合、号码关联性
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
      score -= 25; // 空区太多（更严格）
    } else if (emptyZones >= 3) {
      score -= 15;
    } else if (emptyZones <= 1) {
      score += 5; // 区间覆盖好加分
    }
    
    // 4. 检查和值范围
    const frontSum = front.reduce((a, b) => a + b, 0);
    if (frontSum < CONFIG.SUM_RANGE_MIN || frontSum > CONFIG.SUM_RANGE_MAX) {
      score -= 18;
    } else if (frontSum >= 75 && frontSum <= 105) {
      score += 10;
    }
    
    // 5. 检查连号数量
    const consecutiveGroups = this.analyzeConsecutiveNumbers(front);
    if (consecutiveGroups.length >= 3) {
      score -= 25;
    } else if (consecutiveGroups.length === 2) {
      score -= 5;
    } else if (consecutiveGroups.length === 1) {
      score += 5;
    }
    
    // 6. AC值分析
    const acValue = this.calculateACValue(front);
    if (acValue < CONFIG.AC_VALUE_MIN) {
      score -= 20;
    } else if (acValue > CONFIG.AC_VALUE_MAX) {
      score -= 15;
    } else if (acValue >= CONFIG.AC_VALUE_IDEAL_MIN && acValue <= CONFIG.AC_VALUE_IDEAL_MAX) {
      score += 15;
    } else if (acValue === 3 || acValue === 7) {
      score += 5;
    }
    
    // 7. 号码间距分布分析
    const gaps = this.calculateNumberGaps(front);
    const gapVariance = this.calculateVarianceOfArray(gaps);
    if (gapVariance > CONFIG.GAP_VARIANCE_MAX) {
      score -= 12;
    } else if (gapVariance < CONFIG.GAP_VARIANCE_MIN) {
      score -= 8;
    } else if (gapVariance >= 12 && gapVariance <= 35) {
      score += 8;
    }
    
    // 8. 质合比分析（新增 - 质数:合数理想为 2:3 或 3:2）
    const primeAnalysis = this.analyzePrimeComposite(front);
    if (!primeAnalysis.isBalanced) {
      score -= 8; // 质合比失衡扣分
    } else {
      score += 3; // 质合比平衡加分
    }
    
    // 9. 012路分析（新增 - 0路:1路:2路理想分布）
    const pathAnalysis = this.analyze012Path(front);
    if (pathAnalysis.isBalanced) {
      score += 3; // 012路平衡加分
    } else {
      const maxPath = Math.max(pathAnalysis.path0, pathAnalysis.path1, pathAnalysis.path2);
      if (maxPath >= 4) score -= 10; // 单路过度集中
      else if (maxPath === 0) score -= 5; // 单路空缺
    }
    
    // 10. 尾数多样性分析（新增 - 5个号码应覆盖4-5个不同尾数）
    const tailAnalysis = this.analyzeTailNumbers(front);
    if (tailAnalysis.uniqueTails >= 5) {
      score += 5; // 尾数完全覆盖加分
    } else if (tailAnalysis.uniqueTails >= 4) {
      score += 2; // 尾数基本覆盖加分
    } else if (tailAnalysis.uniqueTails < 3) {
      score -= 10; // 尾数太少扣分
    }
    if (tailAnalysis.maxTailCount >= 3) {
      score -= 8; // 同一尾数出现3次以上扣分
    }
    
    // 11. 后区检查
    if (back.length === 2) {
      const backOdd = back.filter(n => n % 2 !== 0).length;
      if (backOdd === 0 || backOdd === 2) {
        score -= 10;
      }
      const backSum = back.reduce((a, b) => a + b, 0);
      if (backSum < 3 || backSum > 15) {
        score -= 10;
      }
    }
    
    // 12. 历史相似度检查（新增 - 太相似于近3期历史开奖的扣分）
    // 彩票号码几乎不可能完全复现，太相似反而不合理
    if (this.historyData.length >= 3) {
      const recentDraws = this.historyData.slice(-3);
      let maxSimilarity = 0;
      
      for (const draw of recentDraws) {
        // 前区相似度 = 重合号码数
        const frontOverlap = front.filter(n => draw.front.includes(n)).length;
        // 后区相似度
        const backOverlap = back.filter(n => draw.back.includes(n)).length;
        const similarity = frontOverlap + backOverlap * 1.5; // 后区相似度权重更高
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      // 前区5个号码重合4+个或总相似度6+，不合理
      if (maxSimilarity >= 6) score -= 15;
      else if (maxSimilarity >= 5) score -= 8;
      // 相似度低（0-1个重合）加分，说明组合有独特性
      else if (maxSimilarity <= 2) score += 5;
    }
    
    // 13. 条件概率聚合检查（新增 - 号码的马尔可夫转移倾向）
    const conditionalProb = this.calculateConditionalProbability();
    let conditionalScore = 0;
    for (const num of front) {
      conditionalScore += (conditionalProb.front[num] || 0);
    }
    for (const num of back) {
      conditionalScore += (conditionalProb.back[num] || 0);
    }
    // 条件概率聚合在合理范围加分
    // 太低：号码不顺应转移趋势；太高：过度集中
    const avgConditional = conditionalScore / (front.length + back.length);
    if (avgConditional >= 0.1 && avgConditional <= 0.4) score += 8; // 合理范围
    else if (avgConditional >= 0.05) score += 3; // 轻微倾向
    else if (avgConditional < 0.02) score -= 5; // 无倾向
    else if (avgConditional > 0.5) score -= 5; // 过度集中
    
    // 14. 号码关联性检查（新增 - 号码搭配得好加分）
    const correlation = this.calculateNumberCorrelation();
    let correlationScore = 0;
    let pairCount = 0;
    
    for (let i = 0; i < front.length; i++) {
      for (let j = i + 1; j < front.length; j++) {
        const a = front[i], b = front[j];
        const coOccurrence = (correlation.front[a] && correlation.front[a][b]) || 0;
        correlationScore += coOccurrence;
        pairCount++;        
      }
    }
    
    if (pairCount > 0) {
      const avgCorrelation = correlationScore / pairCount;
      // 关联性在合理范围加分
      // 太低：号码搭配不默契；太高：过度依赖历史配对
      const avgDraws = this.getActiveData().length || 1;
      const expectedCorrelation = avgDraws * 5 / CONFIG.FRONT_RANGE; // 期望关联频率
      
      if (avgCorrelation > expectedCorrelation * 0.8 && avgCorrelation < expectedCorrelation * 2) score += 6;
      else if (avgCorrelation > expectedCorrelation * 0.5) score += 2;
      else if (avgCorrelation < expectedCorrelation * 0.3) score -= 5;
      else if (avgCorrelation > expectedCorrelation * 3) score -= 3; // 过度依赖
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
    
    // 遗漏计算使用窗口数据
    const activeData = this.getActiveData();
    
    // 修复：正确计算每个号码的连续遗漏期数（从窗口数据的最后一期往前搜索）
    for (const num of this.frontNumbers) {
      let omission = 0;
      for (let i = activeData.length - 1; i >= 0; i--) {
        if (activeData[i].front.includes(num)) {
          break; // 找到最近一次出现，停止计数
        }
        omission++;
      }
      frontOmission[num] = omission;
    }
    
    for (const num of this.backNumbers) {
      let omission = 0;
      for (let i = activeData.length - 1; i >= 0; i--) {
        if (activeData[i].back.includes(num)) {
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
    
    // 时间衰减使用窗口数据
    const activeData = this.getActiveData();
    for (let i = 0; i < activeData.length; i++) {
      const data = activeData[activeData.length - 1 - i];
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
    
    const activeData = this.getActiveData();
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentDraws = activeData.slice(-recentCount);
    
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
    
    const activeData = this.getActiveData();
    const recentCount = Math.min(CONFIG.RECENT_DRAWS_FOR_TREND, activeData.length);
    const recentDraws = activeData.slice(-recentCount);
    
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
    
    if (this.getActiveData().length < 2) {
      return { frontRepeatRate: 0, backRepeatRate: 0, commonRepeatCount: 0 };
    }
    
    let frontRepeatCount = 0;
    let backRepeatCount = 0;
    let comparisonCount = 0;
    
    // 重号分析使用窗口数据
    const activeData = this.getActiveData();
    for (let i = 1; i < activeData.length; i++) {
      const prevDraw = activeData[i - 1];
      const currDraw = activeData[i];
      
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
    const activeData = this.getActiveData();
    if (activeData.length < windowSize * 2) {
      return { cycleDetected: false, hotColdPattern: '数据不足' };
    }
    
    const [frontCounter] = this.analyzeFrequency();
    const totalDraws = activeData.length;
    const avgFreq = totalDraws > 0 ? Object.values(frontCounter).reduce((a, b) => a + b, 0) / CONFIG.FRONT_RANGE : 0;
    
    // 分段分析热冷号变化
    const segments = [];
    const segmentCount = Math.floor(activeData.length / windowSize);
    
    for (let s = 0; s < segmentCount; s++) {
      const startIdx = s * windowSize;
      const endIdx = startIdx + windowSize;
      const segmentData = activeData.slice(startIdx, endIdx);
      
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
    const activeData = this.getActiveData();
    if (activeData.length < 5) {
      return { rotationPattern: '数据不足', zoneActivity: {} };
    }
    
    const recentDraws = activeData.slice(-20); // 最近20期
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

    // 新增：评估最佳组合质量（取前3个组合的平均质量）
    let bestCombinationQuality = null;
    if (combinations.length > 0) {
      const sampleSize = Math.min(3, combinations.length);
      let totalQualityScore = 0;
      const qualityDetails = [];
      
      for (let i = 0; i < sampleSize; i++) {
        const quality = this.evaluateCombinationQuality(combinations[i], {
          lastDraw: this.historyData.length > 0 ? 
            this.historyData[this.historyData.length - 1] : null
        });
        totalQualityScore += quality.totalScore;
        qualityDetails.push(quality);
      }
      
      bestCombinationQuality = {
        averageScore: Math.round(totalQualityScore / sampleSize),
        samples: qualityDetails
      };
    }

    return {
      danNumbers: danNumbers.sort((a, b) => a - b),
      tuoNumbers: tuoNumbers.sort((a, b) => a - b),
      danCount,
      tuoCount: tuoNumbers.length,
      needFromTuo,
      totalBets,
      combinations,
      danQuality,
      bestCombinationQuality, // 新增：最佳组合质量评估
      cost: totalBets * 2, // 假设每注2元
      generatedAt: new Date().toLocaleString('zh-CN')
    };
  }

  /**
   * 智能胆码评分系统 - 综合多维度因素
   */
  calculateDanScore(number, context = {}) {
    const { 
      hotColdData, 
      omissionData, 
      trendData,
      conditionalProb,
      recentPatterns 
    } = context;
    
    // 动态权重调整：根据近期趋势调整各因子权重
    const weights = this.calculateDynamicWeights(context);
    
    let score = 0;
    
    // 1. 频率得分 (动态权重)
    if (hotColdData) {
      const freqRank = hotColdData.frontHot.findIndex(item => Number(item[0]) === number);
      if (freqRank !== -1) {
        score += weights.frequency * (1 - freqRank / 10); // 排名越靠前得分越高
      }
    }
    
    // 2. 遗漏值得分 (动态权重) - 适度遗漏最佳
    if (omissionData) {
      const omission = omissionData.front[number] || 0;
      const avgOmission = Object.values(omissionData.front).reduce((a,b) => a+b, 0) / 
                         Object.values(omissionData.front).length;
      
      // 遗漏值在平均值的0.8-1.2倍之间得满分
      const ratio = omission / avgOmission;
      let omissionScore = 0;
      if (ratio >= 0.8 && ratio <= 1.2) {
        omissionScore = weights.omission;
      } else if (ratio < 0.8) {
        omissionScore = weights.omission * (ratio / 0.8); // 遗漏太少递减
      } else {
        omissionScore = weights.omission * Math.max(0, 1 - (ratio - 1.2) / 2); // 遗漏太多递减
      }
      score += omissionScore;
    }
    
    // 3. 趋势得分 (动态权重)
    if (trendData && trendData.trendScores) {
      score += weights.trend * (trendData.trendScores[number] || 0) * 100; // 放大趋势影响
    }
    
    // 4. 条件概率得分 (动态权重)
    if (conditionalProb) {
      score += weights.conditional * (conditionalProb.front[number] || 0) * 100; // 放大条件概率影响
    }
    
    // 5. 近期模式匹配得分 (动态权重)
    if (recentPatterns && recentPatterns.patternMatch) {
      score += weights.pattern * (recentPatterns.patternMatch[number] || 0) * 100;
    }
    
    // 6. 位置偏好得分 (动态权重) - 某些号码在特定位置出现频率更高
    if (recentPatterns && recentPatterns.positionPreference) {
      score += weights.position * (recentPatterns.positionPreference[number] || 0) * 100;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算动态权重 - 根据近期趋势调整各因子的重要性
   */
  calculateDynamicWeights(context = {}) {
    // 默认权重
    const defaultWeights = {
      frequency: 25,      // 频率权重
      omission: 20,       // 遗漏权重
      trend: 20,          // 趋势权重
      conditional: 15,    // 条件概率权重
      pattern: 10,        // 模式匹配权重
      position: 10        // 位置偏好权重
    };
    
    // 如果有近期数据，根据趋势调整权重
    if (context.trendData && context.trendData.volatility) {
      const volatility = context.trendData.volatility;
      
      // 高波动期：增加趋势和条件概率的权重
      if (volatility > 0.7) {
        return {
          frequency: 20,
          omission: 15,
          trend: 25,
          conditional: 20,
          pattern: 10,
          position: 10
        };
      }
      // 低波动期：增加频率和遗漏的权重
      else if (volatility < 0.3) {
        return {
          frequency: 30,
          omission: 25,
          trend: 15,
          conditional: 10,
          pattern: 10,
          position: 10
        };
      }
    }
    
    // 正常情况使用默认权重
    return defaultWeights;
  }

  /**
   * 智能拖码评分系统
   */
  calculateTuoScore(number, danNumbers, context = {}) {
    const { 
      hotColdData,
      omissionData,
      diversityBonus = true,
      pairBonus = 0  // 搭档加分
    } = context;
    
    let score = 0;
    
    // 1. 基础频率得分 (25%权重)
    if (hotColdData) {
      const freqRank = hotColdData.frontHot.findIndex(item => Number(item[0]) === number);
      if (freqRank !== -1) {
        score += 25 * (1 - freqRank / 15); // 前15个热号都有分
      }
    }
    
    // 2. 与胆码的互补性得分 (20%权重)
    if (danNumbers && danNumbers.length > 0) {
      // 计算与胆码的数值距离，避免过于集中
      const avgDan = danNumbers.reduce((a,b) => a+b, 0) / danNumbers.length;
      const distance = Math.abs(number - avgDan);
      
      // 距离适中最好（5-15之间）
      if (distance >= 5 && distance <= 15) {
        score += 20;
      } else if (distance < 5) {
        score += 20 * (distance / 5); // 太近递减
      } else {
        score += 20 * Math.max(0, 1 - (distance - 15) / 20); // 太远递减
      }
    }
    
    // 3. 遗漏回补潜力 (15%权重)
    if (omissionData) {
      const omission = omissionData.front[number] || 0;
      const maxOmission = Math.max(...Object.values(omissionData.front));
      
      // 高遗漏号码有回补潜力，但不是越高越好
      const omissionRatio = omission / maxOmission;
      if (omissionRatio > 0.7) {
        score += 15 * omissionRatio;
      }
    }
    
    // 4. 多样性奖励 (15%权重)
    if (diversityBonus) {
      // 奇偶平衡奖励
      const danOddCount = danNumbers.filter(n => n % 2 !== 0).length;
      const danEvenCount = danNumbers.length - danOddCount;
      
      if ((danOddCount > danEvenCount && number % 2 === 0) || 
          (danEvenCount > danOddCount && number % 2 !== 0)) {
        score += 8;
      }
      
      // 大小平衡奖励 (以18为界)
      const danBigCount = danNumbers.filter(n => n > 18).length;
      const danSmallCount = danNumbers.length - danBigCount;
      
      if ((danBigCount > danSmallCount && number <= 18) || 
          (danSmallCount > danBigCount && number > 18)) {
        score += 7;
      }
    }
    
    // 5. AC值贡献 (10%权重)
    const testSet = [...danNumbers, number];
    if (testSet.length >= 3) {
      const acValue = this.calculateACValue(testSet);
      if (acValue >= 2 && acValue <= 4) {
        score += 10;
      } else if (acValue >= 1 && acValue <= 5) {
        score += 5;
      }
    }
    
    // 6. 历史搭档关系加分 (15%权重) - 新增
    score += Math.min(pairBonus, 15);
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 增强版拖码组合优化 - 考虑整体分布和多样性
   */
  optimizeTuoSelection(danNumbers, candidateTuoNumbers, targetCount = 10) {
    if (!candidateTuoNumbers || candidateTuoNumbers.length === 0) {
      return [];
    }
    
    // 如果候选拖码数量小于等于目标数量，直接返回
    if (candidateTuoNumbers.length <= targetCount) {
      return candidateTuoNumbers;
    }
    
    // 获取分析数据
    const hotColdData = this.getHotColdNumbers(15);
    const omissionData = this.calculateOmission();
    
    // 优化2：分析胆码与拖码的历史搭档关系
    const pairBonus = this.calculatePairBonus(danNumbers, candidateTuoNumbers);
    
    // 计算每个候选拖码的得分
    const scoredCandidates = candidateTuoNumbers.map(num => ({
      number: num,
      score: this.calculateTuoScore(num, danNumbers, {
        hotColdData: hotColdData,
        omissionData: omissionData,
        diversityBonus: true,
        pairBonus: pairBonus[num] || 0  // 搭档加分
      })
    }));
    
    // 按得分排序
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // 初步选择高分拖码
    let selectedTuo = scoredCandidates.slice(0, targetCount).map(item => item.number);
    
    // 多样性优化：确保奇偶、大小分布合理
    let optimizedTuo = this.enforceDiversity(selectedTuo, danNumbers, targetCount);
    
    // 优化3：区间覆盖检查，确保拖码补充胆码未覆盖的区间
    let zoneCoveredTuo = this.enforceZoneCoverage(optimizedTuo, danNumbers, targetCount);
    
    // 优化4：连号控制 - 拖码中最多允许2对连号
    let finalTuo = this.enforceNoConsecutivePairs(zoneCoveredTuo, danNumbers, targetCount);
    
    // 最终去重：移除重复号码和胆码
    finalTuo = [...new Set(finalTuo)].filter(n => !danNumbers.includes(n));
    
    // 如果去重后数量不足，补充高分号码
    if (finalTuo.length < targetCount) {
      const remaining = scoredCandidates
        .filter(item => !finalTuo.includes(item.number) && !danNumbers.includes(item.number))
        .slice(0, targetCount - finalTuo.length)
        .map(item => item.number);
      finalTuo = [...finalTuo, ...remaining];
    }
    
    return finalTuo.slice(0, targetCount);
  }

  /**
   * 计算号码对的历史搭档关系加分
   */
  calculatePairBonus(danNumbers, candidateNumbers) {
    const pairBonus = {};
    
    // 统计历史数据中每个号码与胆码同时出现的次数
    const activeData = this.getActiveData();
    
    candidateNumbers.forEach(tuoNum => {
      let bonus = 0;
      
      danNumbers.forEach(danNum => {
        // 计算这对号码在历史中同时出现的频率
        let coOccurrenceCount = 0;
        activeData.forEach(draw => {
          if (draw.front.includes(danNum) && draw.front.includes(tuoNum)) {
            coOccurrenceCount++;
          }
        });
        
        // 搭档次数越多，加分越高（但不超过上限）
        bonus += Math.min(coOccurrenceCount * 2, 10);
      });
      
      pairBonus[tuoNum] = bonus;
    });
    
    return pairBonus;
  }

  /**
   * 强制区间覆盖 - 确保号码分布在三个区间
   */
  enforceZoneCoverage(selectedNumbers, danNumbers, targetCount) {
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
      const zone1Candidates = Array.from({length: 12}, (_, i) => i + 1)
        .filter(n => !allNumbers.includes(n));
      if (zone1Candidates.length > 0) {
        result[0] = zone1Candidates[Math.floor(Math.random() * zone1Candidates.length)];
      }
    }
    
    if (zone2 === 0) {
      // 需要补充二区号码
      const zone2Candidates = Array.from({length: 12}, (_, i) => i + 13)
        .filter(n => !allNumbers.includes(n));
      if (zone2Candidates.length > 0) {
        result[1] = zone2Candidates[Math.floor(Math.random() * zone2Candidates.length)];
      }
    }
    
    if (zone3 === 0) {
      // 需要补充三区号码
      const zone3Candidates = Array.from({length: 11}, (_, i) => i + 25)
        .filter(n => !allNumbers.includes(n));
      if (zone3Candidates.length > 0) {
        result[2] = zone3Candidates[Math.floor(Math.random() * zone3Candidates.length)];
      }
    }
    
    return result.slice(0, targetCount);
  }

  /**
   * 连号控制 - 拖码中最多允许1对连号
   */
  enforceNoConsecutivePairs(selectedNumbers, danNumbers, targetCount) {
    if (selectedNumbers.length <= 1) {
      return selectedNumbers;
    }
    
    // 合并胆码和拖码
    const allNumbers = [...danNumbers, ...selectedNumbers];
    
    // 计算连号对数
    const countConsecutivePairs = (nums) => {
      const sorted = [...nums].sort((a, b) => a - b);
      let pairs = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          pairs++;
        }
      }
      return pairs;
    };
    
    let consecutivePairs = countConsecutivePairs(allNumbers);
    
    // 如果连号对数超过2对（胆码+拖码总共），则替换拖码中的连号
    while (consecutivePairs > 2 && selectedNumbers.length > 0) {
      // 找到拖码中的连号
      const sortedTuo = [...selectedNumbers].sort((a, b) => a - b);
      let foundConsecutive = false;
      
      for (let i = 1; i < sortedTuo.length; i++) {
        if (sortedTuo[i] === sortedTuo[i - 1] + 1) {
          // 找到一对连号，替换其中一个
          const replaceNum = sortedTuo[i];
          const keepNum = sortedTuo[i - 1];
          
          // 找一个不与其他号码连续的号码替换
          const candidates = Array.from({length: 35}, (_, idx) => idx + 1)
            .filter(n => 
              !allNumbers.includes(n) && 
              n !== replaceNum &&
              !allNumbers.includes(n - 1) && 
              !allNumbers.includes(n + 1)
            );
          
          if (candidates.length > 0) {
            const replaceIdx = selectedNumbers.indexOf(replaceNum);
            selectedNumbers[replaceIdx] = candidates[Math.floor(Math.random() * candidates.length)];
            foundConsecutive = true;
            break;
          }
        }
      }
      
      if (!foundConsecutive) break;
      
      // 重新计算连号
      const newAllNumbers = [...danNumbers, ...selectedNumbers];
      consecutivePairs = countConsecutivePairs(newAllNumbers);
    }
    
    return selectedNumbers.slice(0, targetCount);
  }

  /**
   * 强制多样性约束
   */
  enforceDiversity(selectedNumbers, danNumbers, targetCount) {
    if (selectedNumbers.length <= targetCount) {
      return selectedNumbers;
    }
    
    // 当前选中号码的统计
    const allSelected = [...danNumbers, ...selectedNumbers];
    const oddCount = allSelected.filter(n => n % 2 !== 0).length;
    const evenCount = allSelected.length - oddCount;
    const bigCount = allSelected.filter(n => n > 18).length;
    const smallCount = allSelected.length - bigCount;
    
    // 如果奇偶或大小严重不平衡，进行调整
    let result = [...selectedNumbers];
    
    // 奇偶平衡调整
    if (Math.abs(oddCount - evenCount) > 3) {
      // 需要调整奇偶比例
      const needMoreOdd = oddCount < evenCount;
      const candidates = Array.from({length: 35}, (_, i) => i + 1)
        .filter(n => !allSelected.includes(n) && (n % 2 !== 0) === needMoreOdd);
      
      if (candidates.length > 0) {
        // 替换一个号码来改善平衡
        const replaceIndex = Math.floor(Math.random() * result.length);
        result[replaceIndex] = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    
    // 大小平衡调整
    if (Math.abs(bigCount - smallCount) > 3) {
      const needMoreBig = bigCount < smallCount;
      const candidates = Array.from({length: 35}, (_, i) => i + 1)
        .filter(n => !allSelected.includes(n) && (n > 18) === needMoreBig);
      
      if (candidates.length > 0) {
        const replaceIndex = Math.floor(Math.random() * result.length);
        result[replaceIndex] = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    
    return result.slice(0, targetCount);
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
   * 增强版组合质量评估 - 多维度综合评价
   */
  evaluateCombinationQuality(combination, context = {}) {
    const { front, back } = combination;
    let qualityScore = 0;
    const details = {};

    // 1. AC值评估 (20%权重)
    const acValue = this.calculateACValue(front);
    details.acValue = acValue;
    if (acValue >= 2 && acValue <= 4) {
      qualityScore += 20;
    } else if (acValue >= 1 && acValue <= 5) {
      qualityScore += 10;
    } else {
      qualityScore += 5;
    }

    // 2. 和值评估 (15%权重)
    const sum = front.reduce((a, b) => a + b, 0);
    details.sum = sum;
    const expectedSum = 90; // 理论平均和值
    const sumDeviation = Math.abs(sum - expectedSum);
    if (sumDeviation <= 15) {
      qualityScore += 15;
    } else if (sumDeviation <= 25) {
      qualityScore += 10;
    } else {
      qualityScore += 5;
    }

    // 3. 奇偶比评估 (15%权重)
    const oddCount = front.filter(n => n % 2 !== 0).length;
    const evenCount = front.length - oddCount;
    details.oddEvenRatio = `${oddCount}:${evenCount}`;
    const oddEvenDiff = Math.abs(oddCount - evenCount);
    if (oddEvenDiff <= 1) {
      qualityScore += 15;
    } else if (oddEvenDiff <= 2) {
      qualityScore += 10;
    } else {
      qualityScore += 5;
    }

    // 4. 大小比评估 (15%权重)
    const bigCount = front.filter(n => n > 18).length;
    const smallCount = front.length - bigCount;
    details.bigSmallRatio = `${bigCount}:${smallCount}`;
    const bigSmallDiff = Math.abs(bigCount - smallCount);
    if (bigSmallDiff <= 1) {
      qualityScore += 15;
    } else if (bigSmallDiff <= 2) {
      qualityScore += 10;
    } else {
      qualityScore += 5;
    }

    // 5. 区间分布评估 (15%权重)
    const zone1 = front.filter(n => n >= 1 && n <= 12).length; // 一区
    const zone2 = front.filter(n => n >= 13 && n <= 24).length; // 二区
    const zone3 = front.filter(n => n >= 25 && n <= 35).length; // 三区
    details.zoneDistribution = `${zone1}:${zone2}:${zone3}`;
    
    // 理想分布是每个区都有号码，且分布相对均匀
    const hasAllZones = zone1 > 0 && zone2 > 0 && zone3 > 0;
    if (hasAllZones) {
      qualityScore += 15;
    } else if (zone1 > 0 && zone2 > 0 || zone2 > 0 && zone3 > 0 || zone1 > 0 && zone3 > 0) {
      qualityScore += 10; // 至少覆盖两个区
    } else {
      qualityScore += 5; // 只覆盖一个区
    }

    // 6. 连号评估 (10%权重)
    const consecutivePairs = this.countConsecutivePairs(front);
    details.consecutivePairs = consecutivePairs;
    if (consecutivePairs <= 1) {
      qualityScore += 10; // 最多1对连号为佳
    } else if (consecutivePairs <= 2) {
      qualityScore += 5;
    } else {
      qualityScore += 0; // 连号过多
    }

    // 7. 重号评估 (10%权重) - 与上期重复号码
    if (context.lastDraw && context.lastDraw.front) {
      const repeatCount = front.filter(n => context.lastDraw.front.includes(n)).length;
      details.repeatCount = repeatCount;
      if (repeatCount <= 2) {
        qualityScore += 10; // 0-2个重号为佳
      } else if (repeatCount <= 3) {
        qualityScore += 5;
      } else {
        qualityScore += 0; // 重号过多
      }
    } else {
      qualityScore += 5; // 无上期数据时给基础分
    }

    return {
      totalScore: Math.min(100, qualityScore),
      details,
      rating: this.getQualityRating(qualityScore)
    };
  }

  /**
   * 计算连号对数
   */
  countConsecutivePairs(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    let pairs = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        pairs++;
      }
    }
    return pairs;
  }

  /**
   * 获取质量评级
   */
  getQualityRating(score) {
    if (score >= 90) return 'S级 (极佳)';
    if (score >= 80) return 'A级 (优秀)';
    if (score >= 70) return 'B级 (良好)';
    if (score >= 60) return 'C级 (一般)';
    return 'D级 (较差)';
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
