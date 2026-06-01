import { useState, useEffect } from 'react';
import LotteryAnalyzer from '../utils/LotteryAnalyzer.js';

/**
 * 数据可视化分析组件
 * 展示AC值、连号、和值、区间分布等特征的统计分析
 */
const DataVisualization = ({ historyData }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (historyData && historyData.length > 0) {
      analyzeData();
    }
  }, [historyData]);

  const analyzeData = () => {
    setLoading(true);
    
    const analyzer = new LotteryAnalyzer();
    // 将历史数据转换为字符串格式
    const dataStr = historyData.map(draw => 
      `${draw.front.join(' ')} ${draw.back.join(' ')}`
    ).join('\n');
    
    analyzer.loadHistoryData(dataStr, '可视化分析');
    
    // 执行各种分析
    const acValues = [];
    const consecutiveCounts = [];
    const sums = [];
    const oddEvenRatios = {};
    const smallLargeRatios = {};
    const zoneActivity = new Array(7).fill(0);
    
    analyzer.historyData.forEach(draw => {
      // AC值
      const acValue = analyzer.calculateACValue(draw.front);
      acValues.push(acValue);
      
      // 连号
      const groups = analyzer.analyzeConsecutiveNumbers(draw.front);
      consecutiveCounts.push(groups.length);
      
      // 和值
      const sum = draw.front.reduce((a, b) => a + b, 0);
      sums.push(sum);
      
      // 奇偶比
      const oddCount = draw.front.filter(n => n % 2 !== 0).length;
      const ratio = `${oddCount}:${5 - oddCount}`;
      oddEvenRatios[ratio] = (oddEvenRatios[ratio] || 0) + 1;
      
      // 大小比
      const smallCount = draw.front.filter(n => n <= 18).length;
      const slRatio = `${smallCount}:${5 - smallCount}`;
      smallLargeRatios[slRatio] = (smallLargeRatios[slRatio] || 0) + 1;
      
      // 区间活跃度
      draw.front.forEach(num => {
        const zoneIndex = Math.floor((num - 1) / 5);
        zoneActivity[zoneIndex]++;
      });
    });
    
    // 计算统计信息
    const avgAC = acValues.reduce((a, b) => a + b, 0) / acValues.length;
    const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;
    const hasConsecutiveRate = (consecutiveCounts.filter(c => c > 0).length / consecutiveCounts.length * 100).toFixed(1);
    
    // AC值分布
    const acDistribution = {};
    acValues.forEach(ac => {
      acDistribution[ac] = (acDistribution[ac] || 0) + 1;
    });
    
    // 和值分布（按10分组）
    const sumDistribution = {};
    sums.forEach(sum => {
      const group = Math.floor(sum / 10) * 10;
      sumDistribution[group] = (sumDistribution[group] || 0) + 1;
    });
    
    setStats({
      totalDraws: analyzer.historyData.length,
      acValues: {
        average: avgAC.toFixed(2),
        distribution: acDistribution,
        idealRange: acValues.filter(v => v >= 4 && v <= 6).length
      },
      consecutive: {
        rate: hasConsecutiveRate,
        oneGroup: consecutiveCounts.filter(c => c === 1).length,
        twoGroups: consecutiveCounts.filter(c => c === 2).length,
        none: consecutiveCounts.filter(c => c === 0).length
      },
      sum: {
        average: avgSum.toFixed(1),
        distribution: sumDistribution,
        highFreqRange: sums.filter(s => s >= 70 && s <= 110).length
      },
      oddEven: oddEvenRatios,
      smallLarge: smallLargeRatios,
      zoneActivity: zoneActivity.map((count, idx) => ({
        zone: idx,
        range: `${idx * 5 + 1}-${(idx + 1) * 5}`,
        count,
        rate: (count / (analyzer.historyData.length * 5) * 100).toFixed(1)
      }))
    });
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="visualization-loading">
        <div className="loading-spinner"></div>
        <p>正在分析数据...</p>
      </div>
    );
  }

  if (!stats) {
    return <div className="no-data">暂无数据</div>;
  }

  return (
    <div className="data-visualization">
      <h3>📊 数据统计分析</h3>
      
      {/* 基本信息 */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-value">{stats.totalDraws}</div>
          <div className="stat-label">总期数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.acValues.average}</div>
          <div className="stat-label">平均AC值</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.sum.average}</div>
          <div className="stat-label">平均和值</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.consecutive.rate}%</div>
          <div className="stat-label">含连号率</div>
        </div>
      </div>

      {/* AC值分布 */}
      <div className="chart-section">
        <h4>AC值分布</h4>
        <div className="bar-chart">
          {Object.entries(stats.acValues.distribution)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([ac, count]) => {
              const percentage = (count / stats.totalDraws * 100).toFixed(1);
              const isIdeal = Number(ac) >= 4 && Number(ac) <= 6;
              return (
                <div key={ac} className={`bar-item ${isIdeal ? 'ideal' : ''}`}>
                  <div className="bar-label">AC={ac}</div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="bar-value">{count}期 ({percentage}%)</div>
                  {isIdeal && <span className="bar-badge">理想</span>}
                </div>
              );
            })}
        </div>
        <div className="chart-note">
          理想范围(4-6): {stats.acValues.idealRange}期 ({(stats.acValues.idealRange / stats.totalDraws * 100).toFixed(1)}%)
        </div>
      </div>

      {/* 连号统计 */}
      <div className="chart-section">
        <h4>连号统计</h4>
        <div className="pie-chart-container">
          <div className="pie-stat">
            <div className="pie-segment no-consecutive">
              <div className="segment-value">{stats.consecutive.none}</div>
              <div className="segment-label">无连号</div>
            </div>
            <div className="pie-segment one-group">
              <div className="segment-value">{stats.consecutive.oneGroup}</div>
              <div className="segment-label">1组连号</div>
            </div>
            <div className="pie-segment two-groups">
              <div className="segment-value">{stats.consecutive.twoGroups}</div>
              <div className="segment-label">2组连号</div>
            </div>
          </div>
        </div>
        <div className="chart-note">
          历史数据显示 {(stats.consecutive.oneGroup + stats.consecutive.twoGroups) / stats.totalDraws * 100}% 的期数包含连号
        </div>
      </div>

      {/* 和值分布 */}
      <div className="chart-section">
        <h4>和值分布</h4>
        <div className="bar-chart horizontal">
          {Object.entries(stats.sum.distribution)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([range, count]) => {
              const percentage = (count / stats.totalDraws * 100).toFixed(1);
              const isHighFreq = Number(range) >= 70 && Number(range) <= 110;
              return (
                <div key={range} className={`bar-item ${isHighFreq ? 'high-freq' : ''}`}>
                  <div className="bar-label">{range}-{Number(range)+9}</div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${percentage * 2}%` }}
                    ></div>
                  </div>
                  <div className="bar-value">{count}期 ({percentage}%)</div>
                  {isHighFreq && <span className="bar-badge">高频</span>}
                </div>
              );
            })}
        </div>
        <div className="chart-note">
          高频区间(70-110): {stats.sum.highFreqRange}期 ({(stats.sum.highFreqRange / stats.totalDraws * 100).toFixed(1)}%)
        </div>
      </div>

      {/* 奇偶比 */}
      <div className="chart-section">
        <h4>奇偶比分布</h4>
        <div className="ratio-chart">
          {Object.entries(stats.oddEven)
            .sort((a, b) => b[1] - a[1])
            .map(([ratio, count]) => {
              const percentage = (count / stats.totalDraws * 100).toFixed(1);
              const isIdeal = ['2:3', '3:2'].includes(ratio);
              return (
                <div key={ratio} className={`ratio-item ${isIdeal ? 'ideal' : ''}`}>
                  <span className="ratio-label">{ratio}</span>
                  <span className="ratio-count">{count}期</span>
                  <span className="ratio-percentage">{percentage}%</span>
                  {isIdeal && <span className="ratio-badge">✓</span>}
                </div>
              );
            })}
        </div>
      </div>

      {/* 区间活跃度 */}
      <div className="chart-section">
        <h4>区间活跃度</h4>
        <div className="zone-heatmap">
          {stats.zoneActivity.map(zone => {
            const rate = parseFloat(zone.rate);
            const intensity = rate > 70 ? 'hot' : rate > 50 ? 'warm' : 'cold';
            return (
              <div key={zone.zone} className={`zone-cell ${intensity}`}>
                <div className="zone-range">{zone.range}</div>
                <div className="zone-rate">{zone.rate}%</div>
                <div className="zone-bar">
                  <div 
                    className="zone-fill" 
                    style={{ width: `${rate}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="chart-note">
          🔥 热区(&gt;70%) | ⚡ 温区(50-70%) | ❄️ 冷区(&lt;50%)
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;
