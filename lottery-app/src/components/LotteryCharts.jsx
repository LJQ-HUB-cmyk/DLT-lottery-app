import React, { useMemo } from 'react';
import './LotteryCharts.css';

/**
 * 彩票数据分析图表组件
 * 包含7种可视化图表
 */
const LotteryCharts = ({ historyData, periodCount = 30 }) => {
  const recentData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    return historyData.slice(-periodCount);
  }, [historyData, periodCount]);

  // 1. 频率柱状图数据
  const frequencyData = useMemo(() => {
    const frontFreq = {};
    const backFreq = {};
    
    for (let i = 1; i <= 35; i++) frontFreq[i] = 0;
    for (let i = 1; i <= 12; i++) backFreq[i] = 0;
    
    recentData.forEach(draw => {
      draw.front.forEach(num => frontFreq[num]++);
      draw.back.forEach(num => backFreq[num]++);
    });
    
    return { front: frontFreq, back: backFreq };
  }, [recentData]);

  // 2. 遗漏折线图数据
  const omissionData = useMemo(() => {
    const frontOmission = {};
    const backOmission = {};
    
    for (let i = 1; i <= 35; i++) frontOmission[i] = recentData.length;
    for (let i = 1; i <= 12; i++) backOmission[i] = recentData.length;
    
    for (let idx = 0; idx < recentData.length; idx++) {
      recentData[idx].front.forEach(num => frontOmission[num] = 0);
      recentData[idx].back.forEach(num => backOmission[num] = 0);
      
      // 递增遗漏值
      if (idx < recentData.length - 1) {
        Object.keys(frontOmission).forEach(num => {
          if (!recentData[idx + 1].front.includes(Number(num))) {
            frontOmission[num]++;
          }
        });
        Object.keys(backOmission).forEach(num => {
          if (!recentData[idx + 1].back.includes(Number(num))) {
            backOmission[num]++;
          }
        });
      }
    }
    
    return { front: frontOmission, back: backOmission };
  }, [recentData]);

  // 3. 奇偶分布数据
  const oddEvenData = useMemo(() => {
    let frontOdd = 0, frontEven = 0;
    let backOdd = 0, backEven = 0;
    
    recentData.forEach(draw => {
      draw.front.forEach(num => {
        if (num % 2 === 0) frontEven++;
        else frontOdd++;
      });
      draw.back.forEach(num => {
        if (num % 2 === 0) backEven++;
        else backOdd++;
      });
    });
    
    return {
      front: { odd: frontOdd, even: frontEven },
      back: { odd: backOdd, even: backEven }
    };
  }, [recentData]);

  // 4. 区间分布热力图数据（前区7个区间）
  const zoneHeatmapData = useMemo(() => {
    const zones = Array(7).fill(0);
    
    recentData.forEach(draw => {
      draw.front.forEach(num => {
        const zoneIdx = Math.floor((num - 1) / 5);
        zones[zoneIdx]++;
      });
    });
    
    return zones;
  }, [recentData]);

  // 5. 连号统计数据
  const consecutiveData = useMemo(() => {
    let count2 = 0, count3 = 0, count4plus = 0;
    
    recentData.forEach(draw => {
      const sorted = [...draw.front].sort((a, b) => a - b);
      let consecutiveCount = 1;
      
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) {
          consecutiveCount++;
        } else {
          if (consecutiveCount >= 2) {
            if (consecutiveCount === 2) count2++;
            else if (consecutiveCount === 3) count3++;
            else count4plus++;
          }
          consecutiveCount = 1;
        }
      }
      if (consecutiveCount >= 2) {
        if (consecutiveCount === 2) count2++;
        else if (consecutiveCount === 3) count3++;
        else count4plus++;
      }
    });
    
    return { two: count2, three: count3, fourPlus: count4plus };
  }, [recentData]);

  // 6. 和值分布数据
  const sumDistributionData = useMemo(() => {
    const sums = [];
    const ranges = {
      '60-79': 0, '80-99': 0, '100-119': 0, 
      '120-139': 0, '140-159': 0, '160+': 0
    };
    
    recentData.forEach(draw => {
      const sum = draw.front.reduce((a, b) => a + b, 0);
      sums.push(sum);
      
      if (sum < 80) ranges['60-79']++;
      else if (sum < 100) ranges['80-99']++;
      else if (sum < 120) ranges['100-119']++;
      else if (sum < 140) ranges['120-139']++;
      else if (sum < 160) ranges['140-159']++;
      else ranges['160+']++;
    });
    
    return { ranges, avgSum: (sums.reduce((a, b) => a + b, 0) / sums.length).toFixed(1) };
  }, [recentData]);

  // 7. 跨度走势数据
  const spanTrendData = useMemo(() => {
    return recentData.map(draw => {
      const sorted = [...draw.front].sort((a, b) => a - b);
      return sorted[sorted.length - 1] - sorted[0];
    });
  }, [recentData]);

  // 获取频率柱状图颜色
  const getBarColor = (freq, maxFreq, isBack = false) => {
    const ratio = freq / maxFreq;
    if (ratio >= 0.8) return isBack ? '#4a90d9' : '#ff4444';
    if (ratio >= 0.6) return isBack ? '#6ba3e0' : '#ff8844';
    if (ratio >= 0.4) return isBack ? '#8db8e8' : '#ffaa66';
    if (ratio >= 0.2) return isBack ? '#b0ccef' : '#ffcc88';
    return isBack ? '#d0e0f5' : '#ffe0aa';
  };

  // 获取区间热力图颜色
  const getZoneColor = (count, maxCount) => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'rgba(255, 80, 80, 0.8)';
    if (ratio >= 0.6) return 'rgba(255, 160, 80, 0.7)';
    if (ratio >= 0.4) return 'rgba(255, 220, 80, 0.6)';
    if (ratio >= 0.2) return 'rgba(160, 220, 100, 0.5)';
    return 'rgba(100, 180, 255, 0.4)';
  };

  if (!historyData || historyData.length === 0) {
    return <div className="charts-empty">暂无数据</div>;
  }

  return (
    <div className="lottery-charts-container">
      {/* 1. 频率柱状图 */}
      <div className="chart-section">
        <h3 className="chart-title"> 号码出现频率</h3>
        <div className="chart-subtitle">前区35个号码出现次数（最近{recentData.length}期）</div>
        <div className="freq-chart-wrapper">
          {Object.entries(frequencyData.front).map(([num, freq]) => {
            const maxFreq = Math.max(...Object.values(frequencyData.front));
            const barHeight = maxFreq > 0 ? (freq / maxFreq) * 150 : 0;
            return (
              <div key={num} className="freq-bar-item" title={`号码${num}: ${freq}次`}>
                <div className="freq-bar-container">
                  <div 
                    className="freq-bar"
                    style={{ 
                      height: `${Math.max(barHeight, 5)}px`,
                      backgroundColor: getBarColor(freq, maxFreq, false)
                    }}
                  />
                </div>
                <div className="freq-num">{num.toString().padStart(2, '0')}</div>
                <div className="freq-count">{freq}</div>
              </div>
            );
          })}
        </div>
        
        <div className="chart-subtitle" style={{marginTop: '20px'}}>后区12个号码出现次数</div>
        <div className="freq-chart-wrapper freq-chart-back">
          {Object.entries(frequencyData.back).map(([num, freq]) => {
            const maxFreq = Math.max(...Object.values(frequencyData.back));
            const barHeight = maxFreq > 0 ? (freq / maxFreq) * 150 : 0;
            return (
              <div key={num} className="freq-bar-item" title={`号码${num}: ${freq}次`}>
                <div className="freq-bar-container">
                  <div 
                    className="freq-bar"
                    style={{ 
                      height: `${Math.max(barHeight, 5)}px`,
                      backgroundColor: getBarColor(freq, maxFreq, true)
                    }}
                  />
                </div>
                <div className="freq-num">{num.toString().padStart(2, '0')}</div>
                <div className="freq-count">{freq}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 遗漏折线图 */}
      <div className="chart-section">
        <h3 className="chart-title"> 前区号码遗漏值</h3>
        <div className="chart-subtitle">每个号码从最后一次出现到当前的期数（最近{recentData.length}期）</div>
        <div className="omission-grid">
          {Object.entries(omissionData.front).map(([num, omission]) => (
            <div key={num} className="omission-cell" title={`号码${num.toString().padStart(2, '0')}: 遗漏${omission}期`}>
              <div className="omission-num">{num.toString().padStart(2, '0')}</div>
              <div 
                className="omission-bar" 
                style={{ 
                  height: `${Math.min(omission * 3, 60)}px`,
                  backgroundColor: omission === 0 ? '#4CAF50' : omission <= 5 ? '#FF9800' : '#F44336'
                }}
              />
              <div className="omission-value">{omission}</div>
            </div>
          ))}
        </div>
        
        <div className="chart-subtitle" style={{marginTop: '20px'}}>后区号码遗漏值</div>
        <div className="omission-grid omission-back">
          {Object.entries(omissionData.back).map(([num, omission]) => (
            <div key={num} className="omission-cell" title={`号码${num.toString().padStart(2, '0')}: 遗漏${omission}期`}>
              <div className="omission-num">{num.toString().padStart(2, '0')}</div>
              <div 
                className="omission-bar" 
                style={{ 
                  height: `${Math.min(omission * 3, 60)}px`,
                  backgroundColor: omission === 0 ? '#4CAF50' : omission <= 5 ? '#FF9800' : '#F44336'
                }}
              />
              <div className="omission-value">{omission}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 奇偶分布饼图 */}
      <div className="chart-section">
        <h3 className="chart-title">⚖️ 奇偶分布</h3>
        <div className="odd-even-container">
          <div className="odd-even-box">
            <div className="oe-title">前区奇偶比</div>
            <div className="oe-stats">
              <div className="oe-stat odd">
                <span className="oe-label">奇数</span>
                <span className="oe-count">{oddEvenData.front.odd}</span>
                <span className="oe-percent">
                  {((oddEvenData.front.odd / (oddEvenData.front.odd + oddEvenData.front.even)) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="oe-stat even">
                <span className="oe-label">偶数</span>
                <span className="oe-count">{oddEvenData.front.even}</span>
                <span className="oe-percent">
                  {((oddEvenData.front.even / (oddEvenData.front.odd + oddEvenData.front.even)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="oe-ratio">
              奇偶比: {oddEvenData.front.odd}:{oddEvenData.front.even}
            </div>
          </div>
          
          <div className="odd-even-box">
            <div className="oe-title">后区奇偶比</div>
            <div className="oe-stats">
              <div className="oe-stat odd">
                <span className="oe-label">奇数</span>
                <span className="oe-count">{oddEvenData.back.odd}</span>
                <span className="oe-percent">
                  {((oddEvenData.back.odd / (oddEvenData.back.odd + oddEvenData.back.even)) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="oe-stat even">
                <span className="oe-label">偶数</span>
                <span className="oe-count">{oddEvenData.back.even}</span>
                <span className="oe-percent">
                  {((oddEvenData.back.even / (oddEvenData.back.odd + oddEvenData.back.even)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="oe-ratio">
              奇偶比: {oddEvenData.back.odd}:{oddEvenData.back.even}
            </div>
          </div>
        </div>
      </div>

      {/* 4. 区间出号密度 */}
      <div className="chart-section">
        <h3 className="chart-title">🗺️ 区间出号密度</h3>
        <div className="chart-subtitle">前区7个分区（每个分区5个号码）的出号次数（最近{recentData.length}期）</div>
        <div className="zone-chart-wrapper">
          {zoneHeatmapData.map((count, idx) => {
            const maxCount = Math.max(...zoneHeatmapData);
            const zoneStart = idx * 5 + 1;
            const zoneEnd = (idx + 1) * 5;
            const barHeight = maxCount > 0 ? (count / maxCount) * 150 : 0;
            const barColor = getZoneColor(count, maxCount);
            return (
              <div key={idx} className="zone-bar-item" title={`区间${zoneStart}-${zoneEnd}: ${count}次`}>
                <div className="zone-bar-container">
                  <div 
                    className="zone-bar"
                    style={{ 
                      height: `${Math.max(barHeight, 5)}px`,
                      backgroundColor: barColor
                    }}
                  />
                </div>
                <div className="zone-range-label">{zoneStart.toString().padStart(2, '0')}-{zoneEnd.toString().padStart(2, '0')}</div>
                <div className="zone-count-label">{count}次</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. 连号统计图 */}
      <div className="chart-section">
        <h3 className="chart-title"> 连号出现统计</h3>
        <div className="chart-subtitle">最近{recentData.length}期中连号出现的期数</div>
        <div className="consecutive-stats">
          <div className="cons-item">
            <div className="cons-label">2连号</div>
            <div className="cons-value">{consecutiveData.two}</div>
            <div className="cons-bar" style={{width: `${(consecutiveData.two / recentData.length) * 100}%`}} />
          </div>
          <div className="cons-item">
            <div className="cons-label">3连号</div>
            <div className="cons-value">{consecutiveData.three}</div>
            <div className="cons-bar" style={{width: `${(consecutiveData.three / recentData.length) * 100}%`}} />
          </div>
          <div className="cons-item">
            <div className="cons-label">4连号及以上</div>
            <div className="cons-value">{consecutiveData.fourPlus}</div>
            <div className="cons-bar" style={{width: `${(consecutiveData.fourPlus / recentData.length) * 100}%`}} />
          </div>
        </div>
      </div>

      {/* 6. 和值分布直方图 */}
      <div className="chart-section">
        <h3 className="chart-title">➕ 和值分布</h3>
        <div className="chart-subtitle">前区5个号码的和值范围统计（最近{recentData.length}期，平均值: {sumDistributionData.avgSum}）</div>
        <div className="sum-chart-wrapper">
          {Object.entries(sumDistributionData.ranges).map(([range, count]) => {
            const maxCount = Math.max(...Object.values(sumDistributionData.ranges));
            const barHeight = maxCount > 0 ? (count / maxCount) * 150 : 0;
            const barColor = count >= maxCount * 0.8 ? '#4a90d9' : count >= maxCount * 0.6 ? '#6ba3e0' : count >= maxCount * 0.3 ? '#8db8e8' : '#b0ccef';
            return (
              <div key={range} className="sum-bar-item" title={`和值${range}: ${count}期`}>
                <div className="sum-bar-container">
                  <div 
                    className="sum-bar"
                    style={{ 
                      height: `${Math.max(barHeight, 5)}px`,
                      backgroundColor: barColor
                    }}
                  />
                </div>
                <div className="sum-range-label">{range}</div>
                <div className="sum-count-label">{count}期</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. 跨度走势图 */}
      <div className="chart-section">
        <h3 className="chart-title">↔️ 跨度走势</h3>
        <div className="chart-subtitle">前区5个号码的跨度变化（最大号-最小号，最近{spanTrendData.length}期）</div>
        <div className="span-chart-wrapper">
          {spanTrendData.map((span, idx) => (
            <div key={idx} className="span-bar-item" title={`第${idx + 1}期: 跨度${span}`}>
              <div className="span-bar-container">
                <div 
                  className="span-bar"
                  style={{ 
                    height: `${(span / 35) * 150}px`,
                    backgroundColor: span >= 30 ? '#ff4444' : span >= 25 ? '#ff8844' : '#4CAF50'
                  }}
                />
              </div>
              <div className="span-period">#{idx + 1}</div>
              <div className="span-value">{span}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LotteryCharts;
