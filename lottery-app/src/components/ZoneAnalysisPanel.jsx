import { useState, useEffect } from 'react';

// 区间分布分析面板 - 展示最近60期前区5小区离散分布
export default function ZoneAnalysisPanel({ historyData }) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (!historyData || historyData.length < 10) return;
    computeAnalysis();
  }, [historyData]);

  const computeAnalysis = () => {
    const N = Math.min(60, historyData.length);
    const lastN = historyData.slice(-N);
    const startPeriod = historyData.length - N + 1;

    const zones = [[1,7],[8,14],[15,21],[22,28],[29,35]];
    const zoneNames = ['一区(1-7)','二区(8-14)','三区(15-21)','四区(22-28)','五区(29-35)'];
    const zoneColors = ['#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7'];

    const zoneTotals = [0,0,0,0,0];
    const zoneCountDist = zones.map(() => ({}));
    const numFreq = {};
    const backFreq = {};
    const distributions = [];
    const patternFreq = {};
    const emptyZoneCount = {};
    const maxInZone = {};

    lastN.forEach((draw) => {
      const front = draw.full.slice(0, 5);
      const back = draw.full.slice(5, 7);
      const counts = zones.map(([lo,hi]) => front.filter(n => n >= lo && n <= hi).length);

      distributions.push({ counts, front, back });

      counts.forEach((c, zi) => {
        zoneTotals[zi] += c;
        zoneCountDist[zi][c] = (zoneCountDist[zi][c] || 0) + 1;
      });

      const key = counts.join(':');
      patternFreq[key] = (patternFreq[key] || 0) + 1;

      const emptyCount = counts.filter(c => c === 0).length;
      emptyZoneCount[emptyCount] = (emptyZoneCount[emptyCount] || 0) + 1;

      const maxVal = Math.max(...counts);
      maxInZone[maxVal] = (maxInZone[maxVal] || 0) + 1;

      front.forEach(n => { numFreq[n] = (numFreq[n] || 0) + 1; });
      back.forEach(n => { backFreq[n] = (backFreq[n] || 0) + 1; });
    });

    // 后区区间分布
    const backZoneRanges = [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12]];
    const backZoneData = backZoneRanges.map(([lo,hi]) => {
      let total = 0;
      for(let n=lo;n<=hi;n++) total += (backFreq[n]||0);
      return { range: `${lo}-${hi}`, total, percent: (total/(N*2)*100).toFixed(1) };
    });

    // 各区奇偶
    const zoneOddEven = zones.map(([lo,hi]) => {
      let oddF = 0, evenF = 0;
      for(let n=lo;n<=hi;n++){
        if(n%2===1) oddF += (numFreq[n]||0);
        else evenF += (numFreq[n]||0);
      }
      return { odd: oddF, even: evenF };
    });

    // 各区热号冷号
    const zoneHotCold = zones.map(([lo,hi]) => {
      const nums = [];
      for(let n=lo;n<=hi;n++) nums.push({ num: n, freq: numFreq[n]||0 });
      nums.sort((a,b) => b.freq - a.freq);
      const hot = nums.filter(x => x.freq >= 7).map(x => `${x.num}(${x.freq})`);
      const cold = nums.filter(x => x.freq <= 4).map(x => `${x.num}(${x.freq})`);
      return { hot, cold };
    });

    // 连断统计
    const consecutiveEmpty = zones.map(([lo,hi], zi) => {
      let maxCon = 0, cur = 0;
      distributions.forEach(d => {
        if(d.counts[zi]===0){ cur++; maxCon=Math.max(maxCon,cur); }
        else { cur=0; }
      });
      return maxCon;
    });

    setAnalysis({
      N, startPeriod, totalPeriods: historyData.length,
      zoneTotals, zoneNames, zoneColors, zoneCountDist, numFreq, backFreq,
      patternFreq, emptyZoneCount, maxInZone, distributions,
      backZoneData, zoneOddEven, zoneHotCold, consecutiveEmpty
    });
  };

  if (!analysis) return null;

  const { N, startPeriod, totalPeriods, zoneTotals, zoneNames, zoneColors,
    zoneCountDist, numFreq, patternFreq, emptyZoneCount, maxInZone,
    distributions, backZoneData, zoneOddEven, zoneHotCold, consecutiveEmpty } = analysis;

  // 状态标签
  const getStatus = (total, expected) => {
    const dev = ((total - expected)/expected*100);
    if(dev >= 10) return { text:'偏热', color:'#ff6b6b', icon:'🔥' };
    if(dev <= -10) return { text:'偏冷', color:'#4ecdc4', icon:'❄️' };
    return { text:'正常', color:'#96ceb4', icon:'✓' };
  };

  // 常见形态排序
  const topPatterns = Object.entries(patternFreq)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 8);

  return (
    <section className="card zone-analysis-card">
      <h2>📊 近{N}期区间分布分析</h2>
      <div className="zone-analysis-subtitle">
        第{startPeriod}期 ~ 第{totalPeriods}期 · 前区5小区离散分布状态
      </div>

      {/* 1. 各区总出号频次 - 横向柱状图 */}
      <div className="zone-section">
        <h3>各区出号频次</h3>
        <div className="zone-bar-chart">
          {zoneTotals.map((total, i) => {
            const expected = N;
            const status = getStatus(total, expected);
            const barWidth = Math.max(20, (total / Math.max(...zoneTotals)) * 100);
            return (
              <div key={i} className="zone-bar-row">
                <span className="zone-bar-label">{zoneNames[i]}</span>
                <div className="zone-bar-track">
                  <div className="zone-bar-fill" style={{
                    width: `${barWidth}%`,
                    background: zoneColors[i],
                    borderRadius: '4px'
                  }}>
                    <span className="zone-bar-value">{total}次</span>
                  </div>
                </div>
                <span className="zone-bar-status" style={{color: status.color}}>
                  {status.icon} {status.text} ({((total-expected)/expected*100).toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 各区出号个数分布 */}
      <div className="zone-section">
        <h3>各区出号个数分布</h3>
        <div className="zone-count-grid">
          {zoneNames.map((name, i) => {
            const dist = zoneCountDist[i];
            const entries = Object.entries(dist).sort((a,b) => parseInt(a[0])-parseInt(b[0]));
            return (
              <div key={i} className="zone-count-item" style={{borderLeft: `3px solid ${zoneColors[i]}`}}>
                <div className="zone-count-name">{name}</div>
                <div className="zone-count-bars">
                  {entries.map(([count, freq]) => (
                    <div key={count} className="zone-count-bar-row">
                      <span className="count-label">{count}个</span>
                      <div className="count-bar-track">
                        <div className="count-bar-fill" style={{
                          width: `${(freq/N*100)}%`,
                          background: zoneColors[i],
                          minWidth: count==='0' ? '0%' : '4px'
                        }} />
                      </div>
                      <span className="count-freq">{freq}次</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 断区与集中度 */}
      <div className="zone-section">
        <div className="zone-stats-row">
          <div className="zone-stat-block">
            <h3>断区情况</h3>
            {Object.entries(emptyZoneCount).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([k,v]) => (
              <div key={k} className="stat-item-row">
                <span className="stat-label">{k}个空区</span>
                <span className="stat-val">{v}次 ({(v/N*100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
          <div className="zone-stat-block">
            <h3>单区集中度</h3>
            {Object.entries(maxInZone).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([k,v]) => (
              <div key={k} className="stat-item-row">
                <span className="stat-label">最多{k}个</span>
                <span className="stat-val">{v}次 ({(v/N*100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
          <div className="zone-stat-block">
            <h3>最长连断</h3>
            {zoneNames.map((name, i) => (
              <div key={i} className="stat-item-row">
                <span className="stat-label" style={{color: zoneColors[i]}}>{name}</span>
                <span className="stat-val">{consecutiveEmpty[i]}期</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 常见分布形态 */}
      <div className="zone-section">
        <h3>常见分布形态 (TOP{topPatterns.length})</h3>
        <div className="pattern-list">
          {topPatterns.map(([pattern, count]) => (
            <div key={pattern} className="pattern-item">
              <span className="pattern-key">{pattern}</span>
              <span className="pattern-bar-inline" style={{
                width: `${(count/N*100)*3}px`,
                background: '#667eea',
                borderRadius: '3px',
                display: 'inline-block',
                height: '14px',
                minWidth: '4px'
              }} />
              <span className="pattern-count">{count}次 ({(count/N*100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. 各区热号冷号 */}
      <div className="zone-section">
        <h3>各区热号 / 冷号</h3>
        <div className="zone-hotcold-grid">
          {zoneNames.map((name, i) => (
            <div key={i} className="zone-hotcold-item" style={{borderLeft: `3px solid ${zoneColors[i]}`}}>
              <div className="zhc-name">{name}</div>
              <div className="zhc-row">
                <span className="zhc-label hot">🔥</span>
                <span className="zhc-nums">{zoneHotCold[i].hot.join(', ') || '无'}</span>
              </div>
              <div className="zhc-row">
                <span className="zhc-label cold">❄️</span>
                <span className="zhc-nums">{zoneHotCold[i].cold.join(', ') || '无'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. 各区奇偶特征 */}
      <div className="zone-section">
        <h3>各区奇偶特征</h3>
        <div className="zone-odd-even-grid">
          {zoneNames.map((name, i) => {
            const oe = zoneOddEven[i];
            const bias = oe.odd > oe.even ? '偏奇' : oe.odd < oe.even ? '偏偶' : '均衡';
            const biasColor = oe.odd > oe.even ? '#ff6b6b' : oe.odd < oe.even ? '#4ecdc4' : '#96ceb4';
            return (
              <div key={i} className="zone-oe-item" style={{borderLeft: `3px solid ${zoneColors[i]}`}}>
                <span className="oe-name">{name}</span>
                <span className="oe-ratio">奇{oe.odd} : 偶{oe.even}</span>
                <span className="oe-bias" style={{color: biasColor}}>{bias}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. 后区分布 */}
      <div className="zone-section">
        <h3>后区区间分布</h3>
        <div className="back-zone-grid">
          {backZoneData.map((bz, i) => {
            const isHot = parseFloat(bz.percent) > 18;
            const isCold = parseFloat(bz.percent) < 13;
            const color = isHot ? '#ff6b6b' : isCold ? '#4ecdc4' : '#667eea';
            return (
              <div key={i} className="back-zone-item" style={{borderColor: color}}>
                <div className="bz-range">{bz.range}</div>
                <div className="bz-total">{bz.total}次</div>
                <div className="bz-percent" style={{color}}>
                  {bz.percent}%
                  {isHot && ' 🔥'}{isCold && ' ❄️'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. 最近15期走势 */}
      <div className="zone-section">
        <h3>最近15期走势</h3>
        <div className="zone-trend-table">
          {distributions.slice(-15).map((d, idx) => {
            const periodNum = startPeriod + N - 15 + idx;
            return (
              <div key={idx} className="zone-trend-row">
                <span className="trend-period">第{periodNum}期</span>
                <div className="trend-zones">
                  {d.counts.map((c, zi) => (
                    <span key={zi} className={`trend-zone-cell ${c===0?'empty':''}`} style={{
                      background: c===0 ? '#f0f0f0' : zoneColors[zi],
                      color: c===0 ? '#999' : '#fff'
                    }}>
                      {c}
                    </span>
                  ))}
                </div>
                <span className="trend-back">{d.back.map(n => n.toString().padStart(2,'0')).join(' ')}</span>
              </div>
            );
          })}
        </div>
        <div className="trend-zone-legend">
          {zoneNames.map((name, i) => (
            <span key={i} className="legend-item" style={{background: zoneColors[i]}}>{name}</span>
          ))}
          <span className="legend-item" style={{background:'#f0f0f0', color:'#999'}}>空区</span>
        </div>
      </div>
    </section>
  );
}