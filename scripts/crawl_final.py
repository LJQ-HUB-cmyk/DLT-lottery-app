"""
大乐透开奖号码自动爬取 - 最终版
从500.com自动获取最新开奖结果
完全自动化，无需手动操作
"""

import requests
from bs4 import BeautifulSoup
import re
import os
from datetime import datetime


class LotteryCrawlerFinal:
    """最终版大乐透爬虫"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        })
    
    def get_latest_period(self):
        """获取最新期号（从当前日期估算）"""
        now = datetime.now()
        year = now.year % 100
        
        # 计算今年已过周数
        day_of_year = now.timetuple().tm_yday
        weeks_passed = day_of_year // 7
        
        # 估算期号（每周3期）
        estimated = weeks_passed * 3
        
        # 返回最近几期（从新到旧）
        periods = []
        for i in range(20):  # 检查最近20期
            period_num = estimated + 5 - i  # +5作为缓冲
            if period_num > 0:
                periods.append(f"{year:02d}{period_num:03d}")
        
        return periods
    
    def fetch_result(self, period):
        """获取指定期号的开奖结果"""
        url = f'http://kaijiang.500.com/shtml/dlt/{period}.shtml'
        
        try:
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            if response.status_code != 200:
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
                    
                    # 验证
                    if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                        return {
                            'period': period,
                            'front': front,
                            'back': back,
                            'source': '500.com'
                        }
            
            return None
            
        except Exception as e:
            print(f"  失败: {e}")
            return None
    
    def find_latest_result(self):
        """查找最新的开奖结果"""
        print("\n🔍 正在查找最新期号...")
        
        periods = self.get_latest_period()
        print(f"📅 将检查: {periods[:5]}...")
        
        for period in periods:
            print(f"\n尝试: {period}", end=' ')
            result = self.fetch_result(period)
            
            if result:
                print("✅ 成功!")
                return result
            else:
                print("❌")
        
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
        print("🎯 大乐透自动爬取 - 最终版")
        print(f"📅 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        # 查找最新结果
        result = self.find_latest_result()
        
        if not result:
            print("\n❌ 未能获取数据")
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
    crawler = LotteryCrawlerFinal()
    history_file = './lottery-app/src/data/lottery-history.txt'
    crawler.run(history_file)


if __name__ == '__main__':
    main()
