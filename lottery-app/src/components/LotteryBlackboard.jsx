import { useState, useMemo, useEffect } from 'react';
import LotteryCharts from './LotteryCharts';

/**
 * 体彩店小黑板 - 号码分布可视化组件
 * 
 * 模拟实体彩票店中的小黑板展示风格，
 * 一眼直观看到最近N期的号码分布状态。
 * 
 * 功能：
 * - 前区号码热力网格（1-35）
 * - 后区号码热力网格（1-12）
 * - 最近N期号码走势图
 * - 遗漏值标注
 * - 7种数据分析图表
 * - 支持横屏显示
 */

function LotteryBlackboard({ historyData, onBack }) {
  // 显示期数
  const [periodCount, setPeriodCount] = useState(30);
  // 是否横屏显示
  const [isLandscape, setIsLandscape] = useState(false);
  // 是否显示遗漏值
  const [showOmission, setShowOmission] = useState(true);
  // 显示模式: grid=热力网格, trend=走势图
  const [displayMode, setDisplayMode] = useState('grid');

  // 计算最近N期数据
  const recentData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    return historyData.slice(-periodCount);
  }, [historyData, periodCount]);

  // 计算前区号码频率（最近N期）
  const frontFreq = useMemo(() => {
    const freq = {};
    for (let i = 1; i <= 35; i++) freq[i] = 0;
    recentData.forEach(draw => {
      draw.front.forEach(num => {
        freq[num] = (freq[num] || 0) + 1;
      });
    });
    return freq;
  }, [recentData]);

  // 计算后区号码频率（最近N期）
  const backFreq = useMemo(() => {
    const freq = {};
    for (let i = 1; i <= 12; i++) freq[i] = 0;
    recentData.forEach(draw => {
      draw.back.forEach(num => {
        freq[num] = (freq[num] || 0) + 1;
      });
    });
    return freq;
  }, [recentData]);

  // 计算遗漏值（当前遗漏=从最近一期往回数，到该号码最后一次出现的期数）
  const frontOmission = useMemo(() => {
    const omission = {};
    for (let i = 1; i <= 35; i++) omission[i] = recentData.length;
    for (let periodIdx = recentData.length - 1; periodIdx >= 0; periodIdx--) {
      recentData[periodIdx].front.forEach(num => {
        if (omission[num] === recentData.length) {
          omission[num] = recentData.length - 1 - periodIdx;
        }
      });
    }
    // 从未出现的号码遗漏值=总期数
    return omission;
  }, [recentData]);

  const backOmission = useMemo(() => {
    const omission = {};
    for (let i = 1; i <= 12; i++) omission[i] = recentData.length;
    for (let periodIdx = recentData.length - 1; periodIdx >= 0; periodIdx--) {
      recentData[periodIdx].back.forEach(num => {
        if (omission[num] === recentData.length) {
          omission[num] = recentData.length - 1 - periodIdx;
        }
      });
    }
    return omission;
  }, [recentData]);

  // 最大频率值（用于热力颜色计算）
  const maxFrontFreq = useMemo(() => Math.max(...Object.values(frontFreq), 1), [frontFreq]);
  const maxBackFreq = useMemo(() => Math.max(...Object.values(backFreq), 1), [backFreq]);

  // 最新一期出现在网格中的标记集合
  const latestFrontSet = useMemo(() => {
    if (recentData.length === 0) return new Set();
    return new Set(recentData[recentData.length - 1].front);
  }, [recentData]);
  const latestBackSet = useMemo(() => {
    if (recentData.length === 0) return new Set();
    return new Set(recentData[recentData.length - 1].back);
  }, [recentData]);

  // 最近5期号码出现标记（用于网格中圆点标记）
  const recent5FrontSets = useMemo(() => {
    const sets = [];
    for (let i = 0; i < 5; i++) {
      const idx = recentData.length - 1 - i;
      if (idx >= 0) {
        sets.push({ periodIdx: idx, nums: new Set(recentData[idx].front) });
      }
    }
    return sets;
  }, [recentData]);

  const recent5BackSets = useMemo(() => {
    const sets = [];
    for (let i = 0; i < 5; i++) {
      const idx = recentData.length - 1 - i;
      if (idx >= 0) {
        sets.push({ periodIdx: idx, nums: new Set(recentData[idx].back) });
      }
    }
    return sets;
  }, [recentData]);

  // 根据频率计算热力颜色
  // 前区用暖色系（红→橙→黄），后区用冷色系（蓝→紫→靛）
  const getHeatColor = (freq, maxFreq, isBack = false) => {
    const ratio = freq / maxFreq;
    if (freq === 0) return isBack ? 'rgba(60,70,90,0.3)' : 'rgba(80,60,50,0.3)'; // 未出现
    if (isBack) {
      // 后区冷色系：蓝→紫→靛
      if (ratio >= 0.8) return 'rgba(30,144,255,0.9)'; // 极热 - 亮蓝
      if (ratio >= 0.6) return 'rgba(80,130,220,0.85)'; // 热 - 蓝紫
      if (ratio >= 0.4) return 'rgba(120,120,200,0.75)'; // 温 - 紫
      if (ratio >= 0.2) return 'rgba(80,100,160,0.6)'; // 冷 - 靛灰
      return 'rgba(60,80,120,0.5)'; // 极冷 - 深灰蓝
    } else {
      // 前区暖色系：红→橙→黄
      if (ratio >= 0.8) return 'rgba(255,60,30,0.9)'; // 极热 - 亮红
      if (ratio >= 0.6) return 'rgba(255,120,50,0.85)'; // 热 - 橙红
      if (ratio >= 0.4) return 'rgba(255,180,70,0.75)'; // 温 - 橙黄
      if (ratio >= 0.2) return 'rgba(180,160,100,0.6)'; // 冷 - 土黄灰
      return 'rgba(120,100,80,0.5)'; // 极冷 - 暗灰棕
    }
  };

  // 根据遗漏值获取标记样式
  const getOmissionStyle = (omission, total, isBack = false) => {
    if (omission === 0) return { text: '0', color: isBack ? '#4a90d9' : '#ff4444', label: '当期' };
    if (omission <= 3) return { text: String(omission), color: '#ffaa44', label: '近' };
    if (omission <= 8) return { text: String(omission), color: '#aacc88', label: '中' };
    if (omission <= 15) return { text: String(omission), color: '#88aacc', label: '远' };
    return { text: String(omission), color: '#6688aa', label: '冷' };
  };

  // 横屏切换处理
  const handleLandscapeToggle = () => {
    setIsLandscape(!isLandscape);
  };

  // 监听屏幕方向变化
  useEffect(() => {
    const handleOrientation = () => {
      if (window.innerWidth > window.innerHeight) {
        // 当前已经是横屏
      }
    };
    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  }, []);

  if (!historyData || historyData.length === 0) {
    return (
      <div className="blackboard-container">
        <div className="blackboard-empty">
          <p>暂无数据，请先加载历史数据</p>
          <button onClick={onBack} className="bb-back-btn">返回</button>
        </div>
      </div>
    );
  }

  const totalPeriods = historyData.length;
  // 期数选项
  const periodOptions = [5, 10, 20, 30, 50, 80, 100].filter(n => n <= totalPeriods);
  if (!periodOptions.includes(periodCount) && periodOptions.length > 0) {
    setPeriodCount(periodOptions[periodOptions.length - 1]);
  }

  return (
    <div className={`blackboard-container ${isLandscape ? 'landscape-mode' : ''}`}>
      {/* 横屏模式下的旋转包裹层 */}
      <div className={`blackboard-inner ${isLandscape ? 'landscape-rotated' : ''}`}>
        
        {/* 顶部控制栏 */}
        <div className="bb-toolbar">
          <button onClick={onBack} className="bb-back-btn">
            ← 返回
          </button>
          <div className="bb-toolbar-center">
            <span className="bb-title">📋 号码分布黑板</span>
            <span className="bb-subtitle">
              最近 {periodCount} 期 · 共 {totalPeriods} 期数据
            </span>
          </div>
          <div className="bb-toolbar-right">
            <button 
              className={`bb-mode-btn ${displayMode === 'grid' ? 'active' : ''}`}
              onClick={() => setDisplayMode('grid')}
            >
               热力图
            </button>
            <button 
              className={`bb-mode-btn ${displayMode === 'trend' ? 'active' : ''}`}
              onClick={() => setDisplayMode('trend')}
            >
              📈 走势图
            </button>
            <button 
              className={`bb-mode-btn ${displayMode === 'charts' ? 'active' : ''}`}
              onClick={() => setDisplayMode('charts')}
            >
              📊 图表分析
            </button>
          </div>
        </div>

        {/* 参数控制 */}
        <div className="bb-controls">
          <div className="bb-control-group">
            <label>显示期数：</label>
            <div className="bb-period-btns">
              {periodOptions.map(n => (
                <button 
                  key={n}
                  className={`bb-period-btn ${periodCount === n ? 'active' : ''}`}
                  onClick={() => setPeriodCount(n)}
                >
                  {n}期
                </button>
              ))}
              {totalPeriods > 100 && (
                <button 
                  className={`bb-period-btn ${periodCount === totalPeriods ? 'active' : ''}`}
                  onClick={() => setPeriodCount(totalPeriods)}
                >
                  全部
                </button>
              )}
            </div>
          </div>
          <div className="bb-control-group">
            <label>
              <input 
                type="checkbox" 
                checked={showOmission} 
                onChange={(e) => setShowOmission(e.target.checked)}
              />
              显示遗漏值
            </label>
          </div>
          <div className="bb-control-group">
            <button 
              className={`bb-landscape-btn ${isLandscape ? 'active' : ''}`}
              onClick={handleLandscapeToggle}
            >
              {isLandscape ? '🔄 竖屏' : '📱 横屏'}
            </button>
          </div>
        </div>

        {/* 最新一期开奖号码（黑板顶部醒目展示） */}
        {recentData.length > 0 && (
          <div className="bb-latest-draw">
            <div className="bb-latest-label">最新一期</div>
            <div className="bb-latest-numbers">
              <div className="bb-latest-front">
                {recentData[recentData.length - 1].front.map((num, idx) => (
                  <span key={idx} className="bb-ball bb-ball-front">
                    {num.toString().padStart(2, '0')}
                  </span>
                ))}
              </div>
              <span className="bb-latest-separator">+</span>
              <div className="bb-latest-back">
                {recentData[recentData.length - 1].back.map((num, idx) => (
                  <span key={idx} className="bb-ball bb-ball-back">
                    {num.toString().padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {displayMode === 'grid' ? (
          /* ========== 热力网格模式 ========== */
          <div className="bb-grid-mode">
            {/* 前区号码热力网格 */}
            <div className="bb-section">
              <div className="bb-section-header">
                <span className="bb-section-title">前区号码 (1-35)</span>
                <span className="bb-section-hint">
                  🔴极热 🟠热 🟡温 🟤冷 ⚪未出（暖色系）
                </span>
              </div>
              <div className="bb-number-grid bb-front-grid">
                {Array.from({ length: 35 }, (_, i) => i + 1).map(num => {
                  const freq = frontFreq[num] || 0;
                  const omission = frontOmission[num] || recentData.length;
                  const isLatest = latestFrontSet.has(num);
                  const heatColor = getHeatColor(freq, maxFrontFreq);
                  const omissionInfo = getOmissionStyle(omission, recentData.length);
                  // 最近5期出现标记：圆点数量表示最近几期出现了几次
                  const recentAppearCount = recent5FrontSets.filter(s => s.nums.has(num)).length;
                  
                  return (
                    <div 
                      key={num} 
                      className={`bb-number-cell ${isLatest ? 'latest-highlight' : ''} ${freq === 0 ? 'never-appeared' : ''}`}
                      style={{ backgroundColor: heatColor }}
                    >
                      <span className="bb-cell-num">{num.toString().padStart(2, '0')}</span>
                      {freq > 0 && (
                        <span className="bb-cell-freq">{freq}次</span>
                      )}
                      {showOmission && freq > 0 && (
                        <span className="bb-cell-omission" style={{ color: omissionInfo.color }}>
                          遗{omissionInfo.text}
                        </span>
                      )}
                      {freq === 0 && (
                        <span className="bb-cell-never">未出</span>
                      )}
                      {/* 最近5期出现次数圆点 */}
                      {recentAppearCount > 0 && (
                        <div className="bb-cell-dots">
                          {Array.from({ length: recentAppearCount }, (_, di) => (
                            <span key={di} className="bb-dot" />
                          ))}
                        </div>
                      )}
                      {/* 当期出现的对勾标记 */}
                      {isLatest && <span className="bb-cell-check">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 后区号码热力网格 */}
            <div className="bb-section">
              <div className="bb-section-header">
                <span className="bb-section-title">后区号码 (1-12)</span>
                <span className="bb-section-hint">
                  🔵极热 🟣热 🟣温 🔵冷 ⚪未出（冷色系）
                </span>
              </div>
              <div className="bb-number-grid bb-back-grid">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
                  const freq = backFreq[num] || 0;
                  const omission = backOmission[num] || recentData.length;
                  const isLatest = latestBackSet.has(num);
                  const heatColor = getHeatColor(freq, maxBackFreq, true);
                  const omissionInfo = getOmissionStyle(omission, recentData.length, true);
                  const recentAppearCount = recent5BackSets.filter(s => s.nums.has(num)).length;
                  
                  return (
                    <div 
                      key={num} 
                      className={`bb-number-cell bb-back-cell ${isLatest ? 'latest-highlight' : ''} ${freq === 0 ? 'never-appeared' : ''}`}
                      style={{ backgroundColor: heatColor }}
                    >
                      <span className="bb-cell-num">{num.toString().padStart(2, '0')}</span>
                      {freq > 0 && (
                        <span className="bb-cell-freq">{freq}次</span>
                      )}
                      {showOmission && freq > 0 && (
                        <span className="bb-cell-omission" style={{ color: omissionInfo.color }}>
                          遗{omissionInfo.text}
                        </span>
                      )}
                      {freq === 0 && (
                        <span className="bb-cell-never">未出</span>
                      )}
                      {recentAppearCount > 0 && (
                        <div className="bb-cell-dots">
                          {Array.from({ length: recentAppearCount }, (_, di) => (
                            <span key={di} className="bb-dot" />
                          ))}
                        </div>
                      )}
                      {isLatest && <span className="bb-cell-check">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 频率排名TOP10 */}
            <div className="bb-section">
              <div className="bb-section-header">
                <span className="bb-section-title">🔥 前区热号 TOP10</span>
              </div>
              <div className="bb-rank-row">
                {Object.entries(frontFreq)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([num, freq]) => (
                    <span key={num} className="bb-rank-item hot">
                      {Number(num).toString().padStart(2, '0')}({freq})
                    </span>
                  ))}
              </div>
              <div className="bb-section-header" style={{marginTop: '8px'}}>
                <span className="bb-section-title">❄️ 前区冷号 TOP10</span>
              </div>
              <div className="bb-rank-row">
                {Object.entries(frontFreq)
                  .sort(([,a], [,b]) => a - b)
                  .slice(0, 10)
                  .map(([num, freq]) => (
                    <span key={num} className="bb-rank-item cold">
                      {Number(num).toString().padStart(2, '0')}({freq})
                    </span>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          /* ========== 走势图模式 ========== */
          <div className="bb-trend-mode">
            <div className="bb-section">
              <div className="bb-section-header">
                <span className="bb-section-title">前区号码走势（最近{periodCount}期）</span>
                <span className="bb-section-hint">数字 = 当期出现号码</span>
              </div>
              <div className="bb-trend-table">
                {/* 表头：号码 + 1-35列 */}
                <div className="bb-trend-header">
                  <div className="bb-trend-period-col">号码</div>
                  {Array.from({ length: 35 }, (_, i) => i + 1).map(num => (
                    <div key={num} className="bb-trend-num-col">
                      {num.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
                {/* 数据行 */}
                <div className="bb-trend-body">
                  {recentData.map((draw, idx) => {
                    const actualPeriodIdx = totalPeriods - periodCount + idx;
                    const frontSet = new Set(draw.front);
                    return (
                      <div key={idx} className="bb-trend-row">
                        <div className="bb-trend-period-col bb-trend-draw-numbers">
                          {draw.front.map(n => n.toString().padStart(2, '0')).join(' ')}
                        </div>
                        {Array.from({ length: 35 }, (_, i) => i + 1).map(num => (
                          <div 
                            key={num} 
                            className={`bb-trend-num-col front-col ${frontSet.has(num) ? 'appeared' : ''}`}
                          >
                            {frontSet.has(num) ? (
                              <span className="bb-trend-number">{num.toString().padStart(2, '0')}</span>
                            ) : (
                              <span className="bb-trend-empty" />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 后区走势 */}
            <div className="bb-section">
              <div className="bb-section-header">
                <span className="bb-section-title">后区号码走势（最近{periodCount}期）</span>
                <span className="bb-section-hint">数字 = 当期出现号码</span>
              </div>
              <div className="bb-trend-table bb-back-trend">
                <div className="bb-trend-header">
                  <div className="bb-trend-period-col">号码</div>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                    <div key={num} className="bb-trend-num-col">
                      {num.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
                <div className="bb-trend-body">
                  {recentData.map((draw, idx) => {
                    const actualPeriodIdx = totalPeriods - periodCount + idx;
                    const backSet = new Set(draw.back);
                    return (
                      <div key={idx} className="bb-trend-row">
                        <div className="bb-trend-period-col bb-trend-draw-numbers">
                          {draw.back.map(n => n.toString().padStart(2, '0')).join(' ')}
                        </div>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                          <div 
                            key={num} 
                            className={`bb-trend-num-col back-col ${backSet.has(num) ? 'appeared' : ''}`}
                          >
                            {backSet.has(num) ? (
                              <span className="bb-trend-number">{num.toString().padStart(2, '0')}</span>
                            ) : (
                              <span className="bb-trend-empty" />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 图表分析模式 */}
        {displayMode === 'charts' && (
          <div className="bb-charts-mode">
            <LotteryCharts historyData={historyData} periodCount={periodCount} />
          </div>
        )}

        {/* 底部统计 */}
        <div className="bb-footer">
          <span>前区均值出现: {(Object.values(frontFreq).reduce((a,b) => a+b, 0) / 35).toFixed(1)}次/号</span>
          <span>后区均值出现: {(Object.values(backFreq).reduce((a,b) => a+b, 0) / 12).toFixed(1)}次/号</span>
          <span>数据范围: 最近{periodCount}期</span>
        </div>
      </div>
    </div>
  );
}

export default LotteryBlackboard;