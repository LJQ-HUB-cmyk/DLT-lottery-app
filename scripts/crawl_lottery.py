"""
大乐透开奖号码自动爬取 - 备用方案
使用多种数据源确保成功率
"""

import requests
from bs4 import BeautifulSoup
import re
import os
import sys
from datetime import datetime


class LotteryCrawler:
    """大乐透爬虫 - 多数据源"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        })
    
    def fetch_from_500com(self, period):
        """从500.com获取"""
        url = f'http://kaijiang.500.com/shtml/dlt/{period}.shtml'
        try:
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                title = soup.find('title')
                if title:
                    match = re.search(r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s*[+]\s*(\d{2})\s+(\d{2})', title.get_text())
                    if match:
                        front = [int(x) for x in match.groups()[:5]]
                        back = [int(x) for x in match.groups()[5:]]
                        if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                            return {'period': period, 'front': front, 'back': back}
        except:
            pass
        return None
    
    def fetch_from_cz89(self):
        """从牛彩网获取最新一期"""
        try:
            response = self.session.get('https://m.cz89.com/kaijiang/dlt', timeout=10)
            response.encoding = 'utf-8'
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                text = soup.get_text()
                
                # 查找期号
                period_match = re.search(r'(\d{5})期', text)
                if period_match:
                    period = period_match.group(1)
                    
                    # 查找号码
                    match = re.search(r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})', text)
                    if match:
                        nums = [int(x) for x in match.groups()]
                        front = nums[:5]
                        back = nums[5:]
                        if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                            return {'period': period, 'front': front, 'back': back}
        except:
            pass
        return None
    
    def fetch_latest(self):
        """获取最新开奖结果"""
        now = datetime.now()
        year = now.year % 100
        day_of_year = now.timetuple().tm_yday
        weeks_passed = day_of_year // 7
        estimated = weeks_passed * 3
        
        weekday = now.weekday()
        if weekday in [0, 1]: offset = 0
        elif weekday in [2, 3, 4]: offset = 1
        else: offset = 2
        
        if now.hour >= 22:
            expected = estimated + offset
        else:
            expected = estimated + offset - 1
        
        # 尝试多个期号
        periods = []
        for i in range(5):
            p = expected - i
            if p > 0:
                periods.append(f"{year:02d}{p:03d}")
        
        print(f"尝试期号: {periods}")
        
        # 先尝试500.com
        for period in periods:
            print(f"  尝试500.com: {period}")
            result = self.fetch_from_500com(period)
            if result:
                print(f"  ✅ 成功从500.com获取 {period} 期")
                return result
        
        # 再尝试牛彩网
        print("  尝试牛彩网...")
        result = self.fetch_from_cz89()
        if result:
            print(f"  ✅ 成功从牛彩网获取 {result['period']} 期")
            return result
        
        return None
    
    def run(self, history_file='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取"""
        print("=" * 70)
        print("🎯 大乐透自动爬取")
        print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        result = self.fetch_latest()
        
        if not result:
            print("\n❌ 未能获取数据")
            return False
        
        # 格式化
        formatted = ' '.join([str(n).zfill(2) for n in result['front'] + result['back']])
        print(f"\n✅ 第 {result['period']} 期: {formatted}")
        
        # 更新文件
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        if not os.path.exists(history_file):
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(formatted)
            print("📝 创建新文件")
            return True
        
        with open(history_file, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
        
        if formatted in lines:
            print("ℹ️ 数据已存在")
            return False
        
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + formatted)
        
        print(f"✅ 已更新，总计 {len(lines) + 1} 期")
        return True


if __name__ == '__main__':
    crawler = LotteryCrawler()
    success = crawler.run()
    sys.exit(0 if success else 1)
