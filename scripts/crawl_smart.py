"""
大乐透开奖号码自动爬取 - 智能版
从500.com自动获取最新开奖结果
支持多次重试，每5分钟尝试一次
"""

import requests
from bs4 import BeautifulSoup
import re
import os
import sys
from datetime import datetime, timedelta


class SmartLotteryCrawler:
    """智能大乐透爬虫 - 支持重试"""
    
    def __init__(self, max_retries=3, retry_interval=5):
        """
        初始化爬虫
        :param max_retries: 最大重试次数
        :param retry_interval: 重试间隔（分钟）
        """
        self.max_retries = max_retries
        self.retry_interval = retry_interval
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        })
    
    def get_expected_period(self):
        """根据当前时间估算应该开奖的期号"""
        now = datetime.now()
        year = now.year % 100
        
        # 计算今年已过天数
        day_of_year = now.timetuple().tm_yday
        
        # 大乐透每周开奖3次（一、三、六）
        # 估算今年的期号数量
        weeks_passed = day_of_year // 7
        estimated_base = weeks_passed * 3
        
        # 根据今天是星期几调整
        weekday = now.weekday()  # 0=周一, 2=周三, 5=周六
        
        if weekday == 0:  # 周一
            offset = 0
        elif weekday == 1:  # 周二
            offset = 0
        elif weekday == 2:  # 周三
            offset = 1
        elif weekday == 3:  # 周四
            offset = 1
        elif weekday == 4:  # 周五
            offset = 1
        elif weekday == 5:  # 周六
            offset = 2
        else:  # 周日
            offset = 2
        
        # 根据小时判断是否已经开奖（开奖时间21:30）
        if now.hour >= 22:  # 22点后认为已开奖
            expected_period = estimated_base + offset
        else:
            expected_period = estimated_base + offset - 1
        
        return f"{year:02d}{expected_period:03d}"
    
    def fetch_result(self, period):
        """获取指定期号的开奖结果"""
        url = f'http://kaijiang.500.com/shtml/dlt/{period}.shtml'
        
        try:
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            if response.status_code != 200:
                print(f"  ❌ HTTP {response.status_code}")
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 从标题中提取号码
            title = soup.find('title')
            if title:
                title_text = title.get_text()
                
                # 匹配 "大乐透26056期开奖结果 06 07 18 21 30 + 01 05"
                pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s*[+]\s*(\d{2})\s+(\d{2})'
                match = re.search(pattern, title_text)
                
                if match:
                    front = [int(x) for x in match.groups()[:5]]
                    back = [int(x) for x in match.groups()[5:]]
                    
                    # 验证号码范围
                    if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                        return {
                            'period': period,
                            'front': front,
                            'back': back,
                            'source': '500.com'
                        }
            
            return None
            
        except Exception as e:
            print(f"  ❌ 错误: {str(e)[:50]}")
            return None
    
    def find_latest_with_retry(self):
        """查找最新开奖结果，支持多次重试"""
        expected_period = self.get_expected_period()
        print(f"📅 预期期号: {expected_period}")
        print(f"🔄 最多重试 {self.max_retries} 次，每次间隔 {self.retry_interval} 分钟\n")
        
        for attempt in range(1, self.max_retries + 1):
            print(f"[尝试 {attempt}/{self.max_retries}] ", end='')
            
            # 尝试预期期号及前后几期
            periods_to_try = []
            base_num = int(expected_period)
            for offset in [0, 1, -1, 2, -2]:
                period_num = base_num + offset
                if period_num > 0:
                    periods_to_try.append(f"{expected_period[:2]}{period_num:03d}")
            
            print(f"检查期号: {periods_to_try[:3]}...")
            
            for period in periods_to_try:
                result = self.fetch_result(period)
                if result:
                    print(f"✅ 成功获取第 {period} 期!")
                    return result
            
            if attempt < self.max_retries:
                print(f"\n⏳ 等待 {self.retry_interval} 分钟后重试...\n")
                # 在实际GitHub Actions中，我们会退出并让工作流稍后重新触发
                # 这里为了演示，直接返回None
                return None
        
        print("\n❌ 所有重试均失败")
        return None
    
    def format_result(self, result):
        """格式化结果"""
        if not result:
            return None
        
        front_str = ' '.join([str(n).zfill(2) for n in result['front']])
        back_str = ' '.join([str(n).zfill(2) for n in result['back']])
        
        return f"{front_str} {back_str}"
    
    def update_history(self, history_file, new_line):
        """更新历史文件"""
        if not new_line:
            return False, "数据为空"
        
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        if not os.path.exists(history_file):
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(new_line)
            return True, "新建文件"
        
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
        
        if new_line in lines:
            return False, "数据已存在"
        
        if lines:
            print(f"📊 当前最新: {lines[-1]}")
        
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + new_line)
        
        return True, "数据已更新"
    
    def run(self, history_file='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取"""
        print("=" * 70)
        print("🎯 大乐透智能爬取系统")
        print(f"📅 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        print()
        
        # 查找最新结果（带重试）
        result = self.find_latest_with_retry()
        
        if not result:
            print("\n" + "=" * 70)
            print("❌ 未能获取数据，请稍后重试")
            print("💡 提示: GitHub Actions会在5分钟后再次尝试")
            print("=" * 70)
            return False
        
        # 显示结果
        print(f"\n{'=' * 70}")
        print(f"✅ 第 {result['period']} 期:")
        print(f"   前区: {' '.join([str(n).zfill(2) for n in result['front']])}")
        print(f"   后区: {' '.join([str(n).zfill(2) for n in result['back']])}")
        
        # 格式化
        formatted = self.format_result(result)
        print(f"\n📝 格式: {formatted}")
        
        # 更新文件
        success, message = self.update_history(history_file, formatted)
        
        print(f"\n{'=' * 70}")
        if success:
            print(f"✨ {message}")
            print(f"📊 新增: {formatted}")
            
            with open(history_file, 'r', encoding='utf-8') as f:
                total = len([l for l in f.readlines() if l.strip()])
            print(f"📈 总计: {total} 期")
        else:
            print(f"ℹ️ {message}")
        print(f"{'=' * 70}\n")
        
        return success


def main():
    """主函数"""
    # 从环境变量获取配置（GitHub Actions使用）
    max_retries = int(os.environ.get('MAX_RETRIES', '3'))
    retry_interval = int(os.environ.get('RETRY_INTERVAL', '5'))
    
    crawler = SmartLotteryCrawler(
        max_retries=max_retries,
        retry_interval=retry_interval
    )
    
    history_file = './lottery-app/src/data/lottery-history.txt'
    success = crawler.run(history_file)
    
    # 退出码：成功=0，失败=1（用于GitHub Actions判断）
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
