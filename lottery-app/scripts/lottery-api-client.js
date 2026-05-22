/**
 * 彩票 API 客户端
 * 封装多个免费彩票数据源
 */

class LotteryAPIClient {
  constructor() {
    // 可用的 API 源
    this.sources = [
      {
        name: 'api100.duapp.com',
        type: 'GET',
        url: 'http://api100.duapp.com/lottery/',
        params: (lotteryType) => ({ type: lotteryType })
      },
      {
        name: 'api.xinti.com',
        type: 'POST',
        url: 'https://api.xinti.com/chart/queryPrizeHistoryByGameCode',
        body: (lotteryType) => ({
          ClientSource: 3,
          Param: { GameCode: lotteryType, IssuseCount: 1 },
          Date: Date.now(),
          Token: '',
          Sign: '4edaf737113b3411911c5b7a2ccd8640'
        })
      }
    ];
  }

  /**
   * 获取最新开奖结果
   * @param {string} lotteryType - 彩票类型 (DLT=大乐透, SSQ=双色球)
   * @returns {Object|null} 开奖数据 { expect, numbers, date }
   */
  async getLatestResult(lotteryType = 'DLT') {
    console.log(`\n正在获取 ${lotteryType} 最新开奖数据...`);

    for (const source of this.sources) {
      try {
        console.log(`[${source.name}] 尝试请求...`);

        let response;
        
        if (source.type === 'POST') {
          response = await fetch(source.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(source.body(lotteryType))
          });
        } else {
          const params = new URLSearchParams(source.params(lotteryType));
          response = await fetch(`${source.url}?${params}`);
        }

        if (!response.ok) {
          console.log(`  ❌ HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const result = this.parseResponse(source.name, data);

        if (result) {
          console.log(`  ✅ 成功获取数据`);
          console.log(`  期号: ${result.expect}`);
          console.log(`  号码: ${result.numbers}`);
          console.log(`  日期: ${result.date}`);
          return result;
        }

        console.log(`  ❌ 数据格式不匹配`);

      } catch (error) {
        console.log(`  ❌ 请求失败:`, error.message);
      }
    }

    console.log('\n⚠️  所有 API 源都不可用');
    return null;
  }

  /**
   * 解析不同 API 的响应数据
   */
  parseResponse(sourceName, data) {
    try {
      // api100.duapp.com 格式
      if (sourceName === 'api100.duapp.com' && data && data[1] && data[1].Title) {
        const titleStr = data[1].Title;
        const lines = titleStr.split('\n');

        let expect = '', date = '', numbers = '';

        for (const line of lines) {
          if (line.includes('第') && line.includes('期')) {
            const match = line.match(/第(\d+)期/);
            if (match) expect = match[1];
          } else if (line.includes('开奖时间')) {
            date = line.replace('开奖时间：', '').trim();
          } else if (line.includes('开奖号码')) {
            numbers = line.replace('开奖号码：', '').trim()
              .replace(/-/g, ' ')
              .replace('+', ' ');
          }
        }

        if (expect && numbers) {
          return { expect, numbers, date };
        }
      }

      // api.xinti.com 格式
      if (sourceName === 'api.xinti.com' && data.Value && data.Value.GameHistoryInfo) {
        const latest = data.Value.GameHistoryInfo[0];
        const numbers = latest.WinNumber.replace(/-/g, ' ');

        return {
          expect: latest.IssuseNumber,
          numbers,
          date: latest.PrizeTime
        };
      }

      return null;

    } catch (error) {
      console.error('解析数据失败:', error.message);
      return null;
    }
  }

  /**
   * 批量获取多期历史数据
   * @param {string} lotteryType - 彩票类型
   * @param {number} count - 获取期数
   */
  async getHistory(lotteryType = 'DLT', count = 10) {
    console.log(`\n正在获取 ${lotteryType} 最近 ${count} 期数据...`);

    // 目前只支持 api.xinti.com 的历史数据
    try {
      const source = this.sources[1]; // api.xinti.com
      const response = await fetch(source.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          ClientSource: 3,
          Param: { GameCode: lotteryType, IssuseCount: count },
          Date: Date.now(),
          Token: '',
          Sign: '4edaf737113b3411911c5b7a2ccd8640'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.Value || !data.Value.GameHistoryInfo) {
        throw new Error('数据格式错误');
      }

      const results = data.Value.GameHistoryInfo.map(item => ({
        expect: item.IssuseNumber,
        numbers: item.WinNumber.replace(/-/g, ' '),
        date: item.PrizeTime
      }));

      console.log(`  ✅ 成功获取 ${results.length} 期数据`);
      return results;

    } catch (error) {
      console.log(`  ❌ 请求失败:`, error.message);
      return [];
    }
  }
}

// 导出类
export default LotteryAPIClient;

// 测试代码（仅在 Node.js 环境运行）
if (typeof process !== 'undefined' && process.argv) {
  const test = async () => {
    const api = new LotteryAPIClient();
    
    console.log('=== 测试获取最新一期 ===');
    const latest = await api.getLatestResult('DLT');
    
    if (latest) {
      console.log('\n最终结果:', latest);
    }
  };

  // 只在直接运行此文件时执行测试
  if (process.argv[1] && process.argv[1].includes('lottery-api-client.js')) {
    test();
  }
}
