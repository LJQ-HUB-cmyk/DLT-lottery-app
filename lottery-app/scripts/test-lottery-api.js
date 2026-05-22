/**
 * 测试彩票 API 客户端
 */

import LotteryAPIClient from './lottery-api-client.js';

async function test() {
  console.log('========================================');
  console.log('  彩票 API 客户端测试');
  console.log('========================================\n');

  const api = new LotteryAPIClient();

  // 测试 1: 获取最新一期大乐透
  console.log('【测试 1】获取最新一期大乐透');
  console.log('----------------------------------------');
  const latest = await api.getLatestResult('DLT');
  
  if (latest) {
    console.log('\n✅ 测试通过！');
    console.log('数据:', JSON.stringify(latest, null, 2));
  } else {
    console.log('\n❌ 测试失败：无法获取数据');
  }

  console.log('\n\n');

  // 测试 2: 获取历史数据（可选）
  console.log('【测试 2】获取最近 5 期历史数据');
  console.log('----------------------------------------');
  const history = await api.getHistory('DLT', 5);
  
  if (history && history.length > 0) {
    console.log(`\n✅ 成功获取 ${history.length} 期数据`);
    history.forEach((item, index) => {
      console.log(`${index + 1}. 期号: ${item.expect}, 号码: ${item.numbers}`);
    });
  } else {
    console.log('\n❌ 无法获取历史数据');
  }

  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
}

test().catch(error => {
  console.error('\n❌ 测试出错:', error.message);
  console.error(error.stack);
  process.exit(1);
});
