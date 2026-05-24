"""
大乐透开奖号码自动爬取脚本 v4
终极版本 - 多数据源智能切换
纯网页爬取，不使用任何API
"""

import requests
from bs4 import BeautifulSoup
import os
from datetime import datetime
import re
import time


class LotteryCrawlerV4:
    """终极版大乐透爬虫 - 多数据源"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })
        
        # 多个数据源，按优先级排序
        self.sources = [
            {
                'name': '500.com历史页面',
                'url_template': 'http://kaijiang.500.com/shtml/dlt/{period}.shtml',
                'method': 'parse_500com_period'
            },
            {
                'name': '彩吧助手',
                'url': 'https://m.55125.cn/tag/list-16-286.htm',
                'method': 'parse_55125'
            }
        ]
    
    def get_latest_period(self):
        """获取最新期号（从当前日期推算）"""
        now = datetime.now()
        
        # 大乐透期号格式：年份(2位) + 三位序号
        # 例如：26054 表示 2026年第054期
        
        year = now.year % 100  # 取年份后两位
        
        # 计算今年已经过了多少周
        # 大乐透每周开奖3次（一、三、六）
        day_of_year = now.timetuple().tm_yday
        weeks_passed = day_of_year // 7
        
        # 估算期号（每年约156期）
        estimated_period = weeks_passed * 3
        
        # 返回最近几期的期号列表（从新到旧）
        periods = []
        for i in range(10):  # 检查最近10期
            period_num = estimated_period - i
            if period_num > 0:
                periods.append(f"{year:02d}{period_num:03d}")
        
        return periods
    
    def try_fetch_from_500com(self, period):
        """尝试从500.com获取指定期号"""
        try:
            url = f"http://kaijiang.500.com/shtml/dlt/{period}.shtml"
            print(f"  尝试: {url}")
            
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找开奖号码
            # 500.com通常使用特定的class
            balls = soup.find_all('em', class_='ball')
            
            if len(balls) >= 7:
                numbers = []
                for ball in balls[:7]:
                    num_text = ball.get_text().strip()
                    if num_text.isdigit():
                        numbers.append(int(num_text))
                
                if len(numbers) == 7:
                    front = numbers[:5]
                    back = numbers[5:]
                    
                    # 验证
                    if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                        return {
                            'period': period,
                            'front': front,
                            'back': back,
                            'source': '500.com'
                        }
            
            # 备用方法：从文本中提取
            text = soup.get_text()
            pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})'
            matches = re.findall(pattern, text)
            
            if matches:
                first = matches[0]
                nums = [int(x) for x in first]
                front = nums[:5]
                back = nums[5:]
                
                if all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back):
                    return {
                        'period': period,
                        'front': front,
                        'back': back,
                        'source': '500.com(text)'
                    }
            
            return None
            
        except Exception as e:
            print(f"    失败: {e}")
            return None
    
    def fetch_latest_result(self):
        """获取最新一期开奖结果"""
        print("\n🔍 开始获取最新开奖结果...")
        
        # 获取可能的期号列表
        periods = self.get_latest_period()
        print(f"📅 将检查以下期号: {periods[:5]}")
        
        # 逐个尝试
        for period in periods:
            print(f"\n尝试期号: {period}")
            result = self.try_fetch_from_500com(period)
            
            if result:
                print(f"✅ 成功获取第 {period} 期!")
                return result
            
            # 短暂延迟，避免请求过快
            time.sleep(0.5)
        
        print("\n❌ 未能从任何期号获取数据")
        return None
    
    def format_result(self, result):
        """格式化结果为历史文件格式"""
        if not result or 'front' not in result or 'back' not in result:
            return None
        
        front_str = ' '.join([str(n).zfill(2) for n in result['front']])
        back_str = ' '.join([str(n).zfill(2) for n in result['back']])
        
        return f"{front_str} {back_str}"
    
    def check_and_update(self, history_file, new_line):
        """检查并更新历史文件"""
        if not new_line:
            return False, "数据为空"
        
        # 确保目录存在
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        # 检查文件是否存在
        if not os.path.exists(history_file):
            print(f"📝 创建新文件: {history_file}")
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(new_line)
            return True, "新建文件"
        
        # 读取现有内容
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
        
        # 检查是否已存在
        if new_line in lines:
            return False, "数据已存在"
        
        # 显示最后一行
        if lines:
            print(f"📊 当前最新: {lines[-1]}")
        
        # 追加新数据
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + new_line)
        
        return True, "数据已更新"
    
    def run(self, history_file='./lottery-app/src/data/lottery-history.txt'):
        """执行爬取任务"""
        print("=" * 70)
        print("🎯 大乐透开奖号码自动爬取 v4 - 终极版")
        print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        # 获取最新结果
        result = self.fetch_latest_result()
        
        if not result:
            print("\n❌ 爬取失败，所有数据源均无效")
            return False
        
        # 显示结果
        print(f"\n{'=' * 70}")
        print(f"✅ 成功获取第 {result['period']} 期数据:")
        print(f"   前区: {' '.join([str(n).zfill(2) for n in result['front']])}")
        print(f"   后区: {' '.join([str(n).zfill(2) for n in result['back']])}")
        print(f"   来源: {result['source']}")
        
        # 格式化
        formatted = self.format_result(result)
        print(f"\n📝 格式化: {formatted}")
        
        # 更新文件
        success, message = self.check_and_update(history_file, formatted)
        
        print(f"\n{'=' * 70}")
        if success:
            print(f"✨ {message}")
            print(f"📊 新增: {formatted}")
            
            # 统计
            with open(history_file, 'r', encoding='utf-8') as f:
                total = len([l for l in f.readlines() if l.strip()])
            print(f"📈 总计: {total} 期")
        else:
            print(f"ℹ️ {message}")
        print(f"{'=' * 70}\n")
        
        return success


def main():
    """主函数"""
    crawler = LotteryCrawlerV4()
    history_file = './lottery-app/src/data/lottery-history.txt'
    crawler.run(history_file)


if __name__ == '__main__':
    main()
