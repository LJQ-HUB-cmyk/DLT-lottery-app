import { useState, useEffect } from 'react';
import LotteryAnalyzer from './utils/lotteryLogic';
import { trackNumberGeneration, trackCopy, trackSave, trackDataUpdate, trackModelSelection } from './utils/baiduAnalytics';
import './App.css';

const defaultData = `07 09 23 27 32 02 08
04 08 15 20 31 07 08
02 09 11 15 16 02 04
05 18 23 25 32 05 09
02 04 16 23 35 06 11
05 12 18 23 35 06 12
01 03 13 20 26 03 10
03 06 17 21 33 05 11
05 12 13 14 33 05 08
02 03 13 18 26 02 09
14 21 23 29 33 02 10
01 02 09 22 25 01 06
03 05 06 23 26 01 04
16 18 23 34 35 01 06
01 04 10 13 17 03 11
08 09 12 19 24 01 06
04 05 10 23 31 07 12
09 11 19 30 35 01 12
12 13 14 16 31 04 12
01 10 21 23 29 10 12
05 08 12 14 17 04 05
05 09 10 18 26 05 06
09 25 26 27 28 01 08
02 04 08 10 21 09 12
03 15 24 28 29 03 07
10 11 22 26 32 01 08
09 10 11 12 16 01 11
15 27 29 30 34 01 10
03 05 17 33 35 05 07
02 13 22 28 34 05 12
06 08 22 29 34 05 07
03 04 19 26 32 01 12
03 05 07 09 18 02 10
11 12 25 26 27 08 11
02 22 30 33 34 08 12
04 07 16 26 32 05 08
07 12 13 28 32 06 08
08 17 21 33 35 06 07
09 11 20 26 27 06 09
06 12 12 21 34 08 09
24 25 27 29 34 02 06
02 07 13 19 24 03 08
08 12 14 19 22 11 12
03 08 22 26 29 07 10
01 15 21 26 33 04 07
01 13 18 27 33 04 07
09 20 21 23 28 06 11
11 17 20 23 35 01 10
01 06 14 15 17 02 03
06 10 14 23 33 08 10
13 18 28 32 33 02 11
02 03 20 28 33 02 12
02 09 14 20 31 05 09
02 06 14 22 24 08 11
09 10 20 33 35 04 11`;

const modelNames = {
  weighted: '频率加权',
  regression: '均值回归',
  distribution: '正态分布',
  balanced: '平衡策略',
  omission: '遗漏分析',
  time_decay: '时间衰减',
  bayesian: '贝叶斯动态',
  rotation: '旋转矩阵',
  zhouyi: '周易时空'
};

const modelDescriptions = {
  weighted: '根据历史出现频率加权，高频号码有更高概率被选中。通过统计每个号码在历史数据中的总出现次数，赋予其相应的权重，模拟“热号恒热”的趋势。',
  regression: '基于期望值和标准差，模拟均值回归现象。认为号码的出现会围绕一个平均值波动，当某个号码长期未出时，其出现的理论概率会逐渐增加。',
  distribution: '利用正态分布特性，生成符合统计规律的号码。通过分析历史号码的分布曲线，优先选择落在大概率区间内的数值组合。',
  balanced: '混合热号和随机号，平衡稳定性与多样性。在保留高频号码的基础上，引入一定比例的随机冷门号码，防止预测结果过于单一。',
  omission: '分析遗漏期数，选择处于合理遗漏区间的号码。追踪每个号码自上次出现以来的间隔期数，寻找那些即将结束“休眠期”的潜力号码。',
  time_decay: '考虑时间因素，近期出现的号码权重更高。采用指数衰减算法，让最近几期的开奖数据对预测结果产生更大的影响力。',
  bayesian: '使用贝叶斯定理计算条件概率，动态调整预测权重。结合先验知识（如冷热状态）和新的开奖数据，不断修正每个号码的后验概率。',
  rotation: '运用组合数学旋转矩阵，多策略轮换提高覆盖度。通过特定的数学矩阵排列，确保在投入相同注数的情况下，尽可能覆盖更多的中奖组合。',
  zhouyi: '结合周易卦象与时空因子，传统智慧与现代算法融合。将开奖日期、期号等转化为易学参数，配合五行生克原理进行选号。'
};

function App() {
  const [analyzer] = useState(new LotteryAnalyzer());
  const [dataInput, setDataInput] = useState(defaultData);
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['weighted', 'regression']);
  const [newNumber, setNewNumber] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [groupsPerModel, setGroupsPerModel] = useState(5);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    analyzer.loadHistoryData(dataInput, "用户数据");
    const hotCold = analyzer.getHotColdNumbers();
    const [expFront, expBack] = analyzer.calculateExpectedValue();
    const variance = analyzer.calculateVariance();
    const sumProb = analyzer.calculateSumProbability();
    setStats({ hotCold, expFront, expBack, variance, sumProb });
    localStorage.setItem('lottery_data', dataInput);
    
    // 追踪数据加载
    trackDataUpdate(analyzer.historyData.length);
  };

  const clearCache = () => {
    localStorage.removeItem('lottery_data');
    setDataInput(defaultData);
  };

  const handleGenerate = () => {
    const groups = groupsPerModel || 5;
    const results = [];
    selectedModels.forEach(model => {
      // 旋转矩阵特殊处理：一次性生成多组
      if (model === 'rotation') {
        const rotationResults = analyzer.generateRotationMatrixPrediction(groups);
        if (Array.isArray(rotationResults)) {
          rotationResults.forEach((group, idx) => {
            results.push({
              model,
              groupNum: idx + 1,
              front: group.front,
              back: group.back
            });
          });
        }
      } else {
        // 其他模型：按组数循环生成
        for (let i = 0; i < groups; i++) {
          let comb;
          if (model === 'omission') comb = analyzer.generateOmissionBasedPrediction();
          else if (model === 'time_decay') comb = analyzer.generateTimeDecayPrediction();
          else if (model === 'bayesian') comb = analyzer.generateBayesianPrediction();
          else if (model === 'zhouyi') comb = analyzer.generateZhouyiPrediction(i);
          else comb = analyzer.generateStatisticalPrediction(model);
          
          results.push({
            model,
            groupNum: i + 1,
            front: comb.slice(0, 5),
            back: comb.slice(5)
          });
        }
      }
      
      // 追踪每个模型的生成
      trackNumberGeneration(model, groups);
    });
    setPredictions(results);
    setCopySuccess(false);
  };

  const formatPredictions = () => {
    if (predictions.length === 0) return '';
    
    let text = `🧧 发财大计 - 号码预测\n`;
    text += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    text += `========================================\n\n`;
    
    // 按模型分组
    const grouped = predictions.reduce((acc, p) => {
      if (!acc[p.model]) acc[p.model] = [];
      acc[p.model].push(p);
      return acc;
    }, {});
    
    Object.entries(grouped).forEach(([model, groups]) => {
      text += `【${modelNames[model]}】\n`;
      groups.forEach((p, idx) => {
        const frontStr = p.front.map(n => n.toString().padStart(2, '0')).join(' ');
        const backStr = p.back.map(n => n.toString().padStart(2, '0')).join(' ');
        const frontSum = p.front.reduce((a, b) => a + b, 0);
        const backSum = p.back.reduce((a, b) => a + b, 0);
        text += `第${idx + 1}组: ${frontStr} | ${backStr} (前区和值:${frontSum}, 后区和值:${backSum})\n`;
      });
      text += '\n';
    });
    
    text += `========================================\n`;
    text += `总计: ${predictions.length} 组号码\n`;
    
    return text;
  };

  const handleCopy = async () => {
    if (predictions.length === 0) {
      alert('请先生成号码！');
      return;
    }
    
    const text = formatPredictions();
    
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      
      // 追踪复制操作
      trackCopy();
    } catch (err) {
      // 降级方案：使用传统方法
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        trackCopy();
      } catch (err) {
        alert('复制失败，请手动复制');
      }
      document.body.removeChild(textarea);
    }
  };

  const handleSave = () => {
    if (predictions.length === 0) {
      alert('请先生成号码！');
      return;
    }
    
    const text = formatPredictions();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `发财大计_号码预测_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // 追踪保存操作
    trackSave();
  };

  return (
    <div className="app">
      {/* 烟花背景层 */}
      <div className="fireworks-layer"></div>
      
      <header>
        <div className="header-watermark wm-1">王正伟</div>
        <div className="header-watermark wm-2">发财大计</div>
        <div className="header-watermark wm-3">王正伟</div>
        <div className="header-watermark wm-4">发财大计</div>
        <div className="header-watermark wm-5">王正伟</div>
        <div className="header-watermark wm-6">发财大计</div>
        <h1>🧧 发财大计</h1>
        <p>苟富贵，勿相忘！</p>
      </header>

      <main>
        <section className="card">
          <h2>📊 统计概览</h2>
          {stats && (
            <div className="stats-container">
              <div className="stats-section">
                <h3>基础统计</h3>
                <div className="stats-grid">
                  <div><span className="label">前区期望:</span> {stats.expFront.toFixed(2)} <span className="stat-hint">(平均出现位置)</span></div>
                  <div><span className="label">后区期望:</span> {stats.expBack.toFixed(2)} <span className="stat-hint">(平均出现位置)</span></div>
                  <div><span className="label">前区标准差:</span> {stats.variance.frontStd.toFixed(2)} <span className="stat-hint">(号码离散程度)</span></div>
                  <div><span className="label">后区标准差:</span> {stats.variance.backStd.toFixed(2)} <span className="stat-hint">(号码离散程度)</span></div>
                </div>
              </div>
              
              <div className="stats-section">
                <h3>冷热号码</h3>
                <div className="stats-grid">
                  <div><span className="label">最热前区:</span> {stats.hotCold.frontHot.slice(0, 3).map(x => x[0]).join(', ')}</div>
                  <div><span className="label">最冷前区:</span> {stats.hotCold.frontCold.slice(0, 3).map(x => x[0]).join(', ')}</div>
                  <div><span className="label">最热后区:</span> {stats.hotCold.backHot.slice(0, 2).map(x => x[0]).join(', ')}</div>
                  <div><span className="label">最冷后区:</span> {stats.hotCold.backCold.slice(0, 2).map(x => x[0]).join(', ')}</div>
                </div>
              </div>
              
              <div className="stats-section">
                <h3>和值概率 TOP10</h3>
                <div className="sum-prob-grid">
                  <div>
                    <div className="prob-title">前区和值</div>
                    <div className="prob-items">
                      {Object.entries(stats.sumProb.front)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([sum, prob]) => (
                          <span key={sum} className="prob-item">{sum} ({prob}%)</span>
                        ))}
                    </div>
                  </div>
                  <div>
                    <div className="prob-title">后区和值</div>
                    <div className="prob-items">
                      {Object.entries(stats.sumProb.back)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([sum, prob]) => (
                          <span key={sum} className="prob-item">{sum} ({prob}%)</span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>📝 数据管理</h2>
          <div className="add-number-form">
            <input 
              type="text" 
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="输入新数据 (如: 01 02 03 04 05 06 07)"
            />
            <button 
              className="secondary" 
              style={{width: 'auto', marginTop: 0}}
              onClick={() => {
                if (newNumber.trim()) {
                  const newData = dataInput + '\n' + newNumber;
                  setDataInput(newData);
                  setNewNumber('');
                  analyzer.loadHistoryData(newData, "用户数据");
                  // 重新计算统计
                  const hotCold = analyzer.getHotColdNumbers();
                  const [expFront, expBack] = analyzer.calculateExpectedValue();
                  const variance = analyzer.calculateVariance();
                  const sumProb = analyzer.calculateSumProbability();
                  setStats({ hotCold, expFront, expBack, variance, sumProb });
                  localStorage.setItem('lottery_data', newData);
                }
              }}
            >添加数据</button>
          </div>
          
          <div className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? '收起历史数据' : `查看历史数据 (${analyzer.historyData.length}组)`}
          </div>
          
          {showHistory && (
            <div className="history-list">
              {analyzer.historyData.map((item, index) => (
                <div key={index} className="history-item">
                  <span className="index">#{index + 1}</span>
                  <span className="nums">{item.full.map(n => n.toString().padStart(2, '0')).join(' ')}</span>
                </div>
              ))}
            </div>
          )}

          <textarea 
            value={dataInput} 
            onChange={(e) => setDataInput(e.target.value)}
            placeholder="或者在这里批量粘贴历史数据..."
          />
          <button onClick={loadData} className="secondary">更新分析</button>
          <button onClick={clearCache} className="secondary" style={{backgroundColor: '#909399'}}>重置数据</button>
        </section>

        <section className="card">
          <h2> 智能预测</h2>
          
          <div className="model-descriptions">
            {Object.keys(modelNames).map(m => (
              <div key={m} className={`model-desc-item ${selectedModels.includes(m) ? 'active' : ''}`}>
                <label className="model-desc-label">
                  <input 
                    type="checkbox" 
                    checked={selectedModels.includes(m)}
                    onChange={(e) => {
                      let newModels;
                      if (e.target.checked) {
                        newModels = [...selectedModels, m];
                      } else {
                        newModels = selectedModels.filter(x => x !== m);
                      }
                      setSelectedModels(newModels);
                      // 追踪模型选择变化
                      trackModelSelection(newModels);
                    }}
                  />
                  <div className="model-desc-content">
                    <strong>{modelNames[m]}</strong>：{modelDescriptions[m]}
                  </div>
                </label>
              </div>
            ))}
          </div>
          
          <div className="generate-control">
            <label>每组模型生成：</label>
            <input 
              type="number" 
              value={groupsPerModel || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setGroupsPerModel('');
                } else {
                  const num = parseInt(val);
                  if (!isNaN(num) && num > 0) {
                    setGroupsPerModel(num);
                  }
                }
              }}
              min="1"
              placeholder="输入组数"
            />
            <span>组</span>
          </div>
          
          <button onClick={handleGenerate} style={{backgroundColor: '#67c23a', boxShadow: '0 2px 4px rgba(103, 194, 58, 0.3)'}}>一键生成号码</button>
          
          {predictions.length > 0 && (
            <div className="action-buttons">
              <button 
                onClick={handleCopy} 
                className={`secondary ${copySuccess ? 'success' : ''}`}
                style={{
                  backgroundColor: copySuccess ? '#67c23a' : '#409eff',
                  boxShadow: copySuccess ? '0 2px 4px rgba(103, 194, 58, 0.3)' : '0 2px 4px rgba(64, 158, 255, 0.3)'
                }}
              >
                {copySuccess ? '✓ 已复制' : '📋 一键复制'}
              </button>
              <button 
                onClick={handleSave} 
                className="secondary"
                style={{
                  backgroundColor: '#e6a23c',
                  boxShadow: '0 2px 4px rgba(230, 162, 60, 0.3)'
                }}
              >
                💾 保存为文件
              </button>
            </div>
          )}
          
          <div className="results">
            {Object.entries(
              predictions.reduce((acc, p) => {
                if (!acc[p.model]) acc[p.model] = [];
                acc[p.model].push(p);
                return acc;
              }, {})
            ).map(([model, groups]) => (
              <div key={model} className="model-result-card">
                <div className="result-header">
                  <span className="tag">{modelNames[model]}</span>
                </div>
                <div className="result-body">
                  {groups.map((p, idx) => (
                    <div key={idx} className="prediction-group">
                      <div className="group-row">
                        <div className="group-numbers">
                          <div className="nums front">{p.front.map(n => n.toString().padStart(2, '0')).join(' ')}</div>
                          <div className="nums back">{p.back.map(n => n.toString().padStart(2, '0')).join(' ')}</div>
                        </div>
                      </div>
                      <div className="group-sums">
                        <div className="sum-item">
                          <span className="sum-label">前区和值</span>
                          <span className="sum-number">{p.front.reduce((a, b) => a + b, 0)}</span>
                        </div>
                        <div className="sum-item">
                          <span className="sum-label">后区和值</span>
                          <span className="sum-number">{p.back.reduce((a, b) => a + b, 0)}</span>
                        </div>
                      </div>
                      {groups.length > 1 && <div className="group-separator"></div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
