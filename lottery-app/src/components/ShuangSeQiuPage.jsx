import { useState, useEffect } from 'react';
import ShuangSeQiuAnalyzer, { SSQ_DEFAULT_DATA } from '../utils/ShuangSeQiuAnalyzer.js';

// 算法模型名称映射
const ssqModelNames = {
  frequencyWeighted: '频率加权',
  bayesian: '贝叶斯动态',
  omissionAnalysis: '遗漏分析',
  timeDecay: '时间衰减',
  zoneFrequency: '区间频率',
  meanRegression: '均值回归',
  balancedStrategy: '平衡策略',
  normalDistribution: '正态分布',
  hybrid: '混合模型'
};

// 算法模型简短描述
const ssqModelDesc = {
  frequencyWeighted: '高频号码权重更高',
  bayesian: '动态调整后验概率',
  omissionAnalysis: '寻找遗漏回归号码',
  timeDecay: '近期号码权重更高',
  zoneFrequency: '三区间定位选号',
  meanRegression: '偏离均值号码回归',
  balancedStrategy: '热号与冷号均衡',
  normalDistribution: '频率正态分布选号',
  hybrid: '多模型投票机制'
};

// 福彩双色球玩法页面
function ShuangSeQiuPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('rules');
  const [expandedPrize, setExpandedPrize] = useState(null);
  const [ssqAnalyzer] = useState(new ShuangSeQiuAnalyzer());
  const [recommendation, setRecommendation] = useState(null);
  const [selectedModels, setSelectedModels] = useState(['frequencyWeighted', 'bayesian', 'hybrid']);
  const [groupsPerModel, setGroupsPerModel] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [latestDraw, setLatestDraw] = useState(null);
  const [recentDraws, setRecentDraws] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // 计算红球奇偶比（双色球6个红球的奇偶比分布：3:3最常见47%，4:2/2:4约32%，5:1/1:5约21%）
  const calcOddEvenRatio = (redNumbers) => {
    const oddCount = redNumbers.filter(n => n % 2 === 1).length;
    const evenCount = redNumbers.length - oddCount;
    // 理想比例：3:3、4:2、2:4 → 绿色标记
    // 偏态比例：5:1、1:5 → 警告标记
    // 极端比例：6:0、0:6 → 强警告
    const ratio = `${oddCount}:${evenCount}`;
    let quality = 'good';
    let symbol = '✓';
    if (oddCount === 3) { quality = 'ideal'; symbol = '✓'; }
    else if (oddCount === 2 || oddCount === 4) { quality = 'good'; symbol = '✓'; }
    else if (oddCount === 1 || oddCount === 5) { quality = 'warn'; symbol = '⚠'; }
    else { quality = 'extreme'; symbol = '⚠⚠'; }
    return { oddCount, evenCount, text: `${ratio} ${symbol}`, quality, symbol, plainText: `奇偶${ratio}${symbol}` };
  };

  // 初始化加载默认数据
  useEffect(() => {
    try {
      ssqAnalyzer.loadHistoryData(SSQ_DEFAULT_DATA, '双色球示例数据');
      setDataLoaded(true);
      
      // 获取最新开奖号码
      const history = ssqAnalyzer.dataLoader.historyData;
      if (history && history.length > 0) {
        const latest = history[history.length - 1];
        setLatestDraw({ red: latest.front, blue: latest.back, period: history.length });
        
        // 获取最近10期数据
        const recent = history.slice(-10).reverse().map((draw, idx) => ({
          period: history.length - idx,
          red: draw.front,
          blue: draw.back
        }));
        setRecentDraws(recent);
      }
      console.log('✅ 双色球示例数据已加载');
    } catch (e) {
      console.error('❌ 双色球数据加载失败:', e);
    }
    // 注意：不在 cleanup 中调用 destroy()，因为 React 开发模式会执行两次
    // return () => ssqAnalyzer.destroy();
  }, []);

  // 获取全部历史数据
  const getAllDraws = () => {
    const history = ssqAnalyzer.dataLoader.historyData;
    if (!history) return [];
    return history.map((draw, idx) => ({
      period: idx + 1,
      red: draw.front,
      blue: draw.back
    })).reverse();
  };

  // 生成智能推荐
  const handleGenerate = () => {
    if (!dataLoaded) { alert('数据未加载，请稍等'); return; }
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const result = ssqAnalyzer.generateRecommendation(groupsPerModel, selectedModels);
        setRecommendation(result);
      } catch (e) {
        console.error('❌ 生成失败:', e);
        alert('生成失败：' + e.message);
      }
      setIsGenerating(false);
    }, 200);
  };

  // 复制推荐号码
  const handleCopy = () => {
    if (!recommendation || recommendation.predictions.length === 0) { alert('请先生成推荐号码！'); return; }
    let text = '福彩双色球智能推荐\n';
    text += `生成时间: ${recommendation.generatedAt}\n========================================\n\n`;
    const grouped = {};
    recommendation.predictions.forEach(p => { if (!grouped[p.model]) grouped[p.model] = []; grouped[p.model].push(p); });
    Object.entries(grouped).forEach(([model, groups]) => {
      text += `[${ssqModelNames[model]}]\n`;
      groups.forEach((p, idx) => {
        const redStr = p.red.map(n => n.toString().padStart(2, '0')).join(' ');
        const blueStr = p.blue.map(n => n.toString().padStart(2, '0')).join(' '); 
        text += `第${idx + 1}组: ${redStr} | +${blueStr} (${calcOddEvenRatio(p.red).plainText})\n`;
      });
      text += '\n';
    });
    text += `========================================\n总计: ${recommendation.predictions.length} 组\n仅供参考，理性购彩`;
    navigator.clipboard.writeText(text).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }).catch(() => alert('复制失败，请手动复制')); 
  };

  const tabs = [
    { key: 'draws', label: '开奖号码', icon: '🎰' },
    { key: 'rules', label: '玩法规则', icon: '📖' },
    { key: 'prize', label: '奖级设置', icon: '🏆' },
    { key: 'methods', label: '投注方式', icon: '🎯' },
    { key: 'tips', label: '选号技巧', icon: '💡' },
    { key: 'recommend', label: '智能推荐', icon: '🔮' },
  ];

  // 奖级信息
  const prizeLevels = [
    {
      level: '一等奖',
      condition: '6个红球号码+1个蓝球号码全中',
      probability: '1/17,721,088',
      maxPrize: '1000万元（浮动）',
      color: '#ff4757',
      detail: '选中全部6个红球号码和1个蓝球号码，即中一等奖。一等奖为浮动奖金，最高封顶1000万元。当奖池资金累积超过1亿元时，一等奖奖金可达1000万元封顶。'
    },
    {
      level: '二等奖',
      condition: '6个红球号码全中',
      probability: '1/1,181,744',
      maxPrize: '浮动奖金',
      color: '#ff6b6b',
      detail: '选中全部6个红球号码，但蓝球号码未选中。二等奖为浮动奖金，与一等奖按比例分配。'
    },
    {
      level: '三等奖',
      condition: '5个红球+1个蓝球',
      probability: '1/109,546',
      maxPrize: '3000元（固定）',
      color: '#ffa502',
      detail: '选中5个红球号码和1个蓝球号码。三等奖为固定奖金3000元。'
    },
    {
      level: '四等奖',
      condition: '5个红球或4个红球+1个蓝球',
      probability: '1/4,574 / 1/6,580',
      maxPrize: '200元（固定）',
      color: '#ff9800',
      detail: '选中5个红球号码（蓝球未中）或选中4个红球号码+1个蓝球号码。四等奖为固定奖金200元。'
    },
    {
      level: '五等奖',
      condition: '4个红球或3个红球+1个蓝球',
      probability: '1/274 / 1/395',
      maxPrize: '10元（固定）',
      color: '#ffc107',
      detail: '选中4个红球号码（蓝球未中）或选中3个红球号码+1个蓝球号码。五等奖为固定奖金10元。'
    },
    {
      level: '六等奖',
      condition: '2个红球+1个蓝球 或 1个红球+1个蓝球 或 仅1个蓝球',
      probability: '1/51 / 1/18 / 1/12',
      maxPrize: '5元（固定）',
      color: '#8bc34a',
      detail: '选中2个红球+1个蓝球、1个红球+1个蓝球，或仅选中1个蓝球号码。六等奖为固定奖金5元。'
    },
  ];

  // 投注方式
  const bettingMethods = [
    {
      name: '单式投注',
      icon: '📝',
      desc: '从红球区选择6个号码，从蓝球区选择1个号码，组成一注进行投注。',
      example: '红球：03 08 15 22 28 33 | 蓝球：07',
      cost: '2元/注',
      tag: '最简单'
    },
    {
      name: '复式投注',
      icon: '🔄',
      desc: '在红球区或蓝球区选择超过规定个数的号码，组合成多注进行投注。',
      example: '红球7个+蓝球1个 = 7注，14元',
      cost: '按注数计算',
      tag: '覆盖面广'
    },
    {
      name: '胆拖投注',
      icon: '🎯',
      desc: '在红球区选择少于6个号码作为胆码（每注必含），再选择其他号码作为拖码，与胆码组合成多注。',
      example: '胆码3个+拖码5个 = C(5,3)=10注，20元',
      cost: '按注数计算',
      tag: '精准高效'
    },
    {
      name: '多期投注',
      icon: '📅',
      desc: '同一组号码连续投注多期，最多可连续投注15期。',
      example: '选好号码后选择投注期数',
      cost: '2元×期数',
      tag: '省心省力'
    },
  ];

  // 选号技巧
  const tips = [
    {
      title: '奇偶均衡',
      content: '红球6个号码中，奇偶比一般以3:3或4:2为主。完全偏奇或偏偶的组合出现概率很低。',
      type: 'basic'
    },
    {
      title: '大小搭配',
      content: '红球号码1-17为小号，18-33为大号。大小比以3:3或4:2居多，避免全大或全小。',
      type: 'basic'
    },
    {
      title: '和值区间',
      content: '红球6个号码的和值通常在70-130之间，极端高和值或低和值很少出现。',
      type: 'basic'
    },
    {
      title: '连号规律',
      content: '双色球开奖中约70%含有连号（相邻号码），但出现3连号以上的概率较低。',
      type: 'advanced'
    },
    {
      title: '区间分布',
      content: '红球1-33可分为3个区间：1-11、12-22、23-33。每区间至少选1个号码，避免空区。',
      type: 'advanced'
    },
    {
      title: '蓝球策略',
      content: '蓝球只有16个号码，命中概率约6.25%（1/16）。建议关注近期蓝球走势，冷热交替出现。',
      type: 'advanced'
    },
    {
      title: 'AC值分析',
      content: 'AC值反映号码的离散程度，双色球6个红球的AC值通常在4-8之间。AC值过低说明号码过于集中。',
      type: 'expert'
    },
    {
      title: '尾数分布',
      content: '6个红球的尾数（0-9）一般覆盖4-5个不同的尾数，同尾号码过多概率低。',
      type: 'expert'
    },
  ];

  const typeLabels = {
    basic: { label: '基础', color: '#409eff' },
    advanced: { label: '进阶', color: '#ff9800' },
    expert: { label: '专家', color: '#f56c6c' },
  };

  return (
    <div className="ssq-page">
      {/* 返回按钮 - 独立区域 */}
      <div className="ssq-back-bar">
        <button className="ssq-back-btn-new" onClick={onBack}>
          <span className="ssq-back-icon">←</span>
          <span className="ssq-back-text">返回</span>
        </button>
      </div>

      {/* 页面头部 */}
      <div className="ssq-header">
        <div className="ssq-header-bg"></div>
        <div className="ssq-logo">
          <div className="ssq-ball red-ball-lg">双色球</div>
          <div className="ssq-ball blue-ball-lg">福彩</div>
        </div>
        <h1 className="ssq-title">福彩双色球</h1>
        <p className="ssq-subtitle">中国福利彩票双色球玩法指南</p>
      </div>

      {/* 基础信息栏 */}
      <div className="ssq-info-bar">
        <div className="ssq-info-item">
          <span className="ssq-info-icon">🔴</span>
          <span className="ssq-info-text">红球区：1-33选6</span>
        </div>
        <div className="ssq-info-item">
          <span className="ssq-info-icon">🔵</span>
          <span className="ssq-info-text">蓝球区：1-16选1</span>
        </div>
        <div className="ssq-info-item">
          <span className="ssq-info-icon">💰</span>
          <span className="ssq-info-text">每注2元</span>
        </div>
        <div className="ssq-info-item">
          <span className="ssq-info-icon">📅</span>
          <span className="ssq-info-text">每周二四日开奖</span>
        </div>
      </div>

      {/* 最新开奖号码 */}
      {latestDraw && (
        <div className="ssq-latest-draw-card">
          <div className="ssq-latest-draw-header">
            <span className="ssq-latest-draw-title">最新开奖号码</span>
            <span className="ssq-latest-draw-period">第{latestDraw.period}期</span>
          </div>
          <div className="ssq-latest-draw-body">
            <div className="ssq-latest-red-row">
              <span className="ssq-zone-label">红球</span>
              {latestDraw.red.map((n, idx) => (
                <span key={idx} className="ssq-draw-ball red">{n.toString().padStart(2, '0')}</span>
              ))}
            </div>
            <div className="ssq-latest-blue-row">
              <span className="ssq-zone-label">蓝球</span>
              {latestDraw.blue.map((n, idx) => (
                <span key={idx} className="ssq-draw-ball blue">{n.toString().padStart(2, '0')}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="ssq-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`ssq-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="ssq-tab-icon">{tab.icon}</span>
            <span className="ssq-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div className="ssq-content">
        {/* 开奖号码 */}
        {activeTab === 'draws' && (
          <div className="ssq-section">
            <div className="ssq-card">
              <h2 className="ssq-section-title">开奖号码查询</h2>
              <p className="ssq-text">共 <strong>{ssqAnalyzer.dataLoader.historyData?.length || 0}</strong> 期历史数据</p>
            </div>

            {/* 最近10期 */}
            <div className="ssq-card">
              <h2 className="ssq-section-title">最近10期开奖号码</h2>
              <div className="ssq-history-list">
                {recentDraws.map((draw) => (
                  <div key={draw.period} className="ssq-history-row">
                    <span className="ssq-history-period">第{draw.period}期</span>
                    <div className="ssq-history-numbers">
                      <div className="ssq-history-red">
                        {draw.red.map((n, i) => (
                          <span key={i} className="ssq-draw-ball-sm red">{n.toString().padStart(2, '0')}</span>
                        ))}
                      </div>
                      <span className="ssq-history-plus">+</span>
                      <div className="ssq-history-blue">
                        {draw.blue.map((n, i) => (
                          <span key={i} className="ssq-draw-ball-sm blue">{n.toString().padStart(2, '0')}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 全部历史 */}
            <div className="ssq-card">
              <h2 className="ssq-section-title">全部历史数据</h2>
              <button className="ssq-toggle-btn" onClick={() => setShowAllHistory(!showAllHistory)}>
                {showAllHistory ? '🔼 收起全部数据' : '🔽 展开全部数据'}
              </button>
              {showAllHistory && (
                <div className="ssq-history-list ssq-history-all">
                  {getAllDraws().map((draw) => (
                    <div key={draw.period} className="ssq-history-row">
                      <span className="ssq-history-period">第{draw.period}期</span>
                      <div className="ssq-history-numbers">
                        <div className="ssq-history-red">
                          {draw.red.map((n, i) => (
                            <span key={i} className="ssq-draw-ball-sm red">{n.toString().padStart(2, '0')}</span>
                          ))}
                        </div>
                        <span className="ssq-history-plus">+</span>
                        <div className="ssq-history-blue">
                          {draw.blue.map((n, i) => (
                            <span key={i} className="ssq-draw-ball-sm blue">{n.toString().padStart(2, '0')}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 玩法规则 */}
        {activeTab === 'rules' && (
          <div className="ssq-section">
            <div className="ssq-card">
              <h2 className="ssq-section-title">🎯 玩法简介</h2>
              <p className="ssq-text">
                双色球是中国福利彩票的一种乐透型彩票游戏。投注者从<strong>红色球号码区（1-33）中选择6个号码</strong>，
                从<strong>蓝色球号码区（1-16）中选择1个号码</strong>，组合为一注投注号码。
              </p>
              <p className="ssq-text">
                每注投注金额为<strong>2元人民币</strong>。开奖时，从红色球号码区随机摇出6个号码，
                从蓝色球号码区随机摇出1个号码，共7个号码构成当期开奖号码。
              </p>
            </div>

            <div className="ssq-card">
              <h2 className="ssq-section-title">⏰ 开奖时间</h2>
              <div className="ssq-schedule">
                <div className="ssq-schedule-item">
                  <div className="ssq-schedule-day">周二</div>
                  <div className="ssq-schedule-time">21:15</div>
                </div>
                <div className="ssq-schedule-item">
                  <div className="ssq-schedule-day">周四</div>
                  <div className="ssq-schedule-time">21:15</div>
                </div>
                <div className="ssq-schedule-item">
                  <div className="ssq-schedule-day">周日</div>
                  <div className="ssq-schedule-time">21:15</div>
                </div>
              </div>
              <p className="ssq-note">开奖结果由中国福利彩票发行管理中心统一公布，可通过官方网站、新闻媒体等渠道查询。</p>
            </div>

            <div className="ssq-card">
              <h2 className="ssq-section-title">🔢 号码规则</h2>
              <div className="ssq-number-rules">
                <div className="ssq-zone-info red-zone">
                  <h3>红球区</h3>
                  <div className="ssq-numbers-grid">
                    {Array.from({ length: 33 }, (_, i) => i + 1).map(num => (
                      <span key={num} className="ssq-num-cell red">{num.toString().padStart(2, '0')}</span>
                    ))}
                  </div>
                  <p className="ssq-zone-desc">从1-33中选择<strong>6个号码</strong></p>
                </div>
                <div className="ssq-zone-info blue-zone">
                  <h3>蓝球区</h3>
                  <div className="ssq-numbers-grid blue-grid">
                    {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
                      <span key={num} className="ssq-num-cell blue">{num.toString().padStart(2, '0')}</span>
                    ))}
                  </div>
                  <p className="ssq-zone-desc">从1-16中选择<strong>1个号码</strong></p>
                </div>
              </div>
            </div>

            <div className="ssq-card">
              <h2 className="ssq-section-title">⚖️ 中奖判定</h2>
              <p className="ssq-text">
                根据投注号码与当期开奖号码的相符情况，确定中奖等级：
              </p>
              <ul className="ssq-list">
                <li>一等奖：6个红球+1个蓝球全部正确</li>
                <li>二等奖：6个红球全部正确</li>
                <li>三等奖：5个红球+1个蓝球正确</li>
                <li>四等奖：5个红球正确，或4个红球+1个蓝球正确</li>
                <li>五等奖：4个红球正确，或3个红球+1个蓝球正确</li>
                <li>六等奖：2个红球+1个蓝球，或1个红球+1个蓝球，或仅1个蓝球正确</li>
              </ul>
            </div>
          </div>
        )}

        {/* 奖级设置 */}
        {activeTab === 'prize' && (
          <div className="ssq-section">
            <div className="ssq-card">
              <h2 className="ssq-section-title">🏆 奖级与奖金</h2>
              <div className="ssq-prize-list">
                {prizeLevels.map((prize, idx) => (
                  <div
                    key={idx}
                    className={`ssq-prize-item ${expandedPrize === idx ? 'expanded' : ''}`}
                    style={{ borderLeftColor: prize.color }}
                    onClick={() => setExpandedPrize(expandedPrize === idx ? null : idx)}
                  >
                    <div className="ssq-prize-header">
                      <span className="ssq-prize-level" style={{ color: prize.color }}>{prize.level}</span>
                      <span className="ssq-prize-condition">{prize.condition}</span>
                      <span className="ssq-prize-amount">{prize.maxPrize}</span>
                      <span className="ssq-expand-icon">{expandedPrize === idx ? '▼' : '▶'}</span>
                    </div>
                    {expandedPrize === idx && (
                      <div className="ssq-prize-detail">
                        <p>{prize.detail}</p>
                        <p className="ssq-prob">中奖概率：{prize.probability}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="ssq-prize-note">
                <p>💡 一等奖和二等奖为浮动奖金，具体金额取决于当期奖池累积和中奖注数。</p>
                <p>💡 三等奖至六等奖为固定奖金，不受奖池影响。</p>
              </div>
            </div>
          </div>
        )}

        {/* 投注方式 */}
        {activeTab === 'methods' && (
          <div className="ssq-section">
            {bettingMethods.map((method, idx) => (
              <div key={idx} className="ssq-card ssq-method-card">
                <div className="ssq-method-header">
                  <span className="ssq-method-icon">{method.icon}</span>
                  <h3 className="ssq-method-name">{method.name}</h3>
                  <span className="ssq-method-tag">{method.tag}</span>
                </div>
                <p className="ssq-method-desc">{method.desc}</p>
                <div className="ssq-method-example">
                  <span className="ssq-example-label">示例：</span>
                  <span className="ssq-example-value">{method.example}</span>
                </div>
                <div className="ssq-method-cost">
                  <span className="ssq-cost-label">费用：</span>
                  <span className="ssq-cost-value">{method.cost}</span>
                </div>
              </div>
            ))}

            <div className="ssq-card">
              <h2 className="ssq-section-title">📊 复式投注注数速查</h2>
              <div className="ssq-table-container">
                <table className="ssq-table">
                  <thead>
                    <tr>
                      <th>红球个数</th>
                      <th>蓝球个数</th>
                      <th>总注数</th>
                      <th>总金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>7</td><td>1</td><td>7</td><td>14元</td></tr>
                    <tr><td>8</td><td>1</td><td>28</td><td>56元</td></tr>
                    <tr><td>9</td><td>1</td><td>84</td><td>168元</td></tr>
                    <tr><td>10</td><td>1</td><td>210</td><td>420元</td></tr>
                    <tr><td>6</td><td>2</td><td>2</td><td>4元</td></tr>
                    <tr><td>6</td><td>3</td><td>3</td><td>6元</td></tr>
                    <tr><td>6</td><td>4</td><td>4</td><td>8元</td></tr>
                    <tr><td>6</td><td>5</td><td>5</td><td>10元</td></tr>
                    <tr><td>7</td><td>2</td><td>14</td><td>28元</td></tr>
                    <tr><td>8</td><td>2</td><td>56</td><td>112元</td></tr>
                    <tr><td>9</td><td>2</td><td>168</td><td>336元</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ssq-card">
              <h2 className="ssq-section-title">🎯 胆拖投注注数计算</h2>
              <p className="ssq-text">
                胆拖投注注数 = <strong>C(拖码个数, 6-胆码个数)</strong>
              </p>
              <div className="ssq-table-container">
                <table className="ssq-table">
                  <thead>
                    <tr>
                      <th>胆码数</th>
                      <th>拖码数</th>
                      <th>需从拖码选</th>
                      <th>注数</th>
                      <th>金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>1</td><td>7</td><td>5</td><td>21</td><td>42元</td></tr>
                    <tr><td>1</td><td>8</td><td>5</td><td>56</td><td>112元</td></tr>
                    <tr><td>2</td><td>6</td><td>4</td><td>15</td><td>30元</td></tr>
                    <tr><td>2</td><td>7</td><td>4</td><td>35</td><td>70元</td></tr>
                    <tr><td>3</td><td>5</td><td>3</td><td>10</td><td>20元</td></tr>
                    <tr><td>3</td><td>6</td><td>3</td><td>20</td><td>40元</td></tr>
                    <tr><td>4</td><td>4</td><td>2</td><td>6</td><td>12元</td></tr>
                    <tr><td>5</td><td>3</td><td>1</td><td>3</td><td>6元</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 选号技巧 */}
        {activeTab === 'tips' && (
          <div className="ssq-section">
            <div className="ssq-card">
              <h2 className="ssq-section-title">💡 选号技巧与思路</h2>
              <p className="ssq-text ssq-warning-text">
                ⚠️ 以下技巧仅基于统计学规律提供参考思路，彩票开奖为随机事件，任何技巧都不能保证中奖。
              </p>
            </div>
            {tips.map((tip, idx) => (
              <div key={idx} className="ssq-card ssq-tip-card">
                <div className="ssq-tip-header">
                  <h3 className="ssq-tip-title">{tip.title}</h3>
                  <span
                    className="ssq-tip-type"
                    style={{ background: typeLabels[tip.type].color }}
                  >
                    {typeLabels[tip.type].label}
                  </span>
                </div>
                <p className="ssq-tip-content">{tip.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* 智能推荐 */}
        {activeTab === 'recommend' && (
          <div className="ssq-section">
            <div className="ssq-card">
              <h2 className="ssq-section-title">算法模型智能推荐</h2>
              <p className="ssq-text ssq-warning-text">
                ⚠️ 推荐号码由算法模型基于历史数据统计分析生成，仅供娱乐参考。彩票开奖为随机事件，任何算法都不能预测中奖号码。理性购彩，量力而行。
              </p>
              <p className="ssq-text" style={{marginTop: '10px'}}>
                使用专为双色球设计的9种独立算法（红球1-33选6，蓝球1-16选1），与大乐透算法完全独立，互不影响。
              </p>
            </div>

            {/* 模型选择 */}
            <div className="ssq-card">
              <h2 className="ssq-section-title">模型选择</h2>
              <div className="ssq-model-grid">
                {Object.keys(ssqModelNames).map(m => (
                  <label key={m} className={`ssq-model-item ${selectedModels.includes(m) ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(m)}
                      onChange={(e) => {
                        const newModels = e.target.checked ? [...selectedModels, m] : selectedModels.filter(x => x !== m);
                        setSelectedModels(newModels);
                      }}
                    />
                    <div className="ssq-model-info">
                      <strong>{ssqModelNames[m]}</strong>
                      <span className="ssq-model-desc-text">{ssqModelDesc[m]}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="ssq-gen-controls">
                <label>每组模型生成：</label>
                <select value={groupsPerModel} onChange={(e) => setGroupsPerModel(parseInt(e.target.value))}>
                  <option value={1}>1组</option>
                  <option value={2}>2组</option>
                  <option value={3}>3组</option>
                  <option value={5}>5组</option>
                </select>
                <span>组</span>
              </div>
              <button className="ssq-gen-btn" onClick={handleGenerate} disabled={isGenerating || selectedModels.length === 0}>
                {isGenerating ? '⏳ 生成中...' : '🚀 生成推荐号码'}
              </button>
            </div>

            {/* 冷热号统计 */}
            {recommendation && recommendation.hotCold && (
              <div className="ssq-card">
                <h2 className="ssq-section-title">冷热号统计</h2>
                <div className="ssq-hotcold-grid">
                  <div className="ssq-hotcold-section">
                    <h4>红球热号</h4>
                    <div className="ssq-numbers-row">
                      {recommendation.hotCold.redHot.slice(0, 6).map(n => (
                        <span key={n} className="ssq-num-ball red hot">{n.toString().padStart(2, '0')}</span>
                      ))}
                    </div>
                    <h4 style={{marginTop: '10px'}}>红球冷号</h4>
                    <div className="ssq-numbers-row">
                      {recommendation.hotCold.redCold.slice(0, 6).map(n => (
                        <span key={n} className="ssq-num-ball red cold">{n.toString().padStart(2, '0')}</span>
                      ))}
                    </div>
                  </div>
                  <div className="ssq-hotcold-section">
                    <h4>蓝球热号</h4>
                    <div className="ssq-numbers-row">
                      {recommendation.hotCold.blueHot.slice(0, 3).map(n => (
                        <span key={n} className="ssq-num-ball blue hot">{n.toString().padStart(2, '0')}</span>
                      ))}
                    </div>
                    <h4 style={{marginTop: '10px'}}>蓝球冷号</h4>
                    <div className="ssq-numbers-row">
                      {recommendation.hotCold.blueCold.slice(0, 3).map(n => (
                        <span key={n} className="ssq-num-ball blue cold">{n.toString().padStart(2, '0')}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 推荐号码结果 */}
            {recommendation && recommendation.predictions.length > 0 && (
              <div className="ssq-card">
                <h2 className="ssq-section-title">推荐号码结果</h2>
                <div className="ssq-results">
                  {Object.entries(
                    recommendation.predictions.reduce((acc, p) => {
                      if (!acc[p.model]) acc[p.model] = []; acc[p.model].push(p); return acc;
                    }, {})
                  ).map(([model, groups]) => (
                    <div key={model} className="ssq-result-card">
                      <div className="ssq-result-header">
                        <span className="ssq-result-tag">{ssqModelNames[model]}</span>
                        <span className="ssq-result-desc">{ssqModelDesc[model]}</span>
                      </div>
                      <div className="ssq-result-body">
                        {groups.map((p, idx) => (
                          <div key={idx} className="ssq-result-group">
                            <span className="ssq-group-index">#{idx + 1}</span>
                            <div className="ssq-group-red">
                              {p.red.map(n => n.toString().padStart(2, '0')).join(' ')}
                            </div>
                            <span className="ssq-group-plus">+</span>
                            <div className="ssq-group-blue">
                              {p.blue.map(n => n.toString().padStart(2, '0')).join(' ')}
                            </div>
                            <span className={`ssq-group-oddeven ssq-oddeven-${calcOddEvenRatio(p.red).quality}`}>奇偶 {calcOddEvenRatio(p.red).text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ssq-copy-section">
                  <button
                    className="ssq-copy-btn"
                    onClick={handleCopy}
                    style={{background: copySuccess ? 'linear-gradient(135deg, #67c23a, #5daf34)' : 'linear-gradient(135deg, #4facfe, #00f2fe)'}}
                  >
                    {copySuccess ? '✅ 已复制' : '📋 一键复制号码'}
                  </button>
                  <p className="ssq-copy-hint">复制后可粘贴到微信、QQ等分享</p>
                </div>
              </div>
            )}

            {/* 数据信息 */}
            {recommendation && (
              <div className="ssq-card ssq-data-info-card">
                <p className="ssq-data-info">生成时间: {recommendation.generatedAt}</p>
                <p className="ssq-data-info">基于 {recommendation.dataCount} 期历史数据</p>
                <p className="ssq-data-info">使用 {selectedModels.length} 个算法模型</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 页面底部 */}
      <div className="ssq-footer">
        <p>中国福利彩票 · 双色球</p>
        <p className="ssq-footer-note">理性购彩，量力而行</p>
      </div>
    </div>
  );
}

export default ShuangSeQiuPage;