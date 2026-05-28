"""
统一彩票爬虫 - 支持多彩种、多数据源
支持大乐透(DLT)、双色球(SSQ)等彩种
"""

import sys
import os
from datetime import datetime
from typing import Optional, Dict

# 添加scripts目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from data_source_manager import DataSourceManager


class UniversalLotteryCrawler:
    """通用彩票爬虫"""
    
    def __init__(self):
        """初始化爬虫"""
        self.manager = DataSourceManager()
        self.session = self.manager.session
    
    def parse_dlt_500com(self, content: str, source) -> Optional[Dict]:
        """解析大乐透 - 500.com"""
        try:
            from bs4 import BeautifulSoup
            import re
            
            soup = BeautifulSoup(content, 'html.parser')
            title = soup.find('title')
            
            if not title:
                return None
            
            title_text = title.get_text()
            # 匹配 "大乐透26056期开奖结果 06 07 18 21 30 + 01 05"
            pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s*[+]\s*(\d{2})\s+(\d{2})'
            match = re.search(pattern, title_text)
            
            if match:
                front = [str(int(x)).zfill(2) for x in match.groups()[:5]]
                back = [str(int(x)).zfill(2) for x in match.groups()[5:]]
                
                # 验证范围
                if all(1 <= int(n) <= 35 for n in front) and all(1 <= int(n) <= 12 for n in back):
                    return {
                        'lottery_type': 'dlt',
                        'front_numbers': front,
                        'back_numbers': back,
                        'source': source.name,
                        'format': ' '.join(front) + ' ' + ' '.join(back)
                    }
            
            return None
        except Exception as e:
            print(f"  解析失败: {e}")
            return None
    
    def parse_ssq_17500(self, content: str, source) -> Optional[Dict]:
        """解析双色球 - data.17500.cn"""
        try:
            import re
            
            data_list = []
            lines = content.strip().split('\n')
            
            for line in lines:
                if len(line) < 15:
                    continue
                
                parts = line.split(',', 1)
                if not parts:
                    continue
                
                first_part = parts[0].strip()
                fields = first_part.split()
                
                if len(fields) < 8:
                    continue
                
                try:
                    red_balls = [str(int(x)).zfill(2) for x in fields[2:8]]
                    blue_ball = str(int(fields[8])).zfill(2) if len(fields) > 8 else None
                    
                    if not blue_ball:
                        continue
                    
                    # 验证范围和去重
                    red_nums = [int(x) for x in red_balls]
                    blue_num = int(blue_ball)
                    
                    if all(1 <= n <= 33 for n in red_nums) and 1 <= blue_num <= 16:
                        if len(set(red_nums)) == 6:
                            data_list.append({
                                'red_balls': red_balls,
                                'blue_ball': blue_ball
                            })
                except (ValueError, IndexError):
                    continue
            
            if data_list:
                latest = data_list[-1]
                return {
                    'lottery_type': 'ssq',
                    'red_numbers': latest['red_balls'],
                    'blue_number': latest['blue_ball'],
                    'source': source.name,
                    'format': ' '.join(latest['red_balls']) + ' ' + latest['blue_ball'],
                    'total_records': len(data_list)
                }
            
            return None
        except Exception as e:
            print(f"  解析失败: {e}")
            return None
    
    def fetch_dlt(self) -> Optional[Dict]:
        """获取大乐透数据"""
        def callback(content, source):
            if '500.com' in source.name:
                return self.parse_dlt_500com(content, source)
            return None
        
        return self.manager.try_all_sources('dlt', callback)
    
    def fetch_ssq(self) -> Optional[Dict]:
        """获取双色球数据"""
        def callback(content, source):
            if '17500' in source.name:
                return self.parse_ssq_17500(content, source)
            # 可在此添加其他解析方法
            return None
        
        return self.manager.try_all_sources('ssq', callback)
    
    def update_history_file(self, lottery_type: str, data: Dict, history_file: str) -> bool:
        """更新历史文件"""
        if not data:
            return False
        
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        new_line = data['format']
        
        if not os.path.exists(history_file):
            with open(history_file, 'w', encoding='utf-8') as f:
                f.write(new_line)
            print(f"✅ 新建文件: {history_file}")
            return True
        
        with open(history_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
        
        if new_line in lines:
            print(f"ℹ️ 数据已存在")
            return False
        
        if lines:
            print(f"📊 当前最新: {lines[-1]}")
        
        with open(history_file, 'a', encoding='utf-8') as f:
            f.write('\n' + new_line)
        
        print(f"✅ 数据已更新: {new_line}")
        
        with open(history_file, 'r', encoding='utf-8') as f:
            total = len([l for l in f.readlines() if l.strip()])
        print(f"📈 总计: {total} 期")
        
        return True
    
    def run(self, lottery_type: str = 'all'):
        """运行爬虫"""
        print("=" * 70)
        print("🎯 统一彩票爬虫系统")
        print(f"📅 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        results = {}
        
        if lottery_type in ['all', 'dlt']:
            print("\n【大乐透 (DLT)】")
            dlt_data = self.fetch_dlt()
            if dlt_data:
                print(f"✅ 成功获取数据")
                print(f"   源: {dlt_data['source']}")
                print(f"   前区: {' '.join(dlt_data['front_numbers'])}")
                print(f"   后区: {' '.join(dlt_data['back_numbers'])}")
                
                history_file = './lottery-app/src/data/lottery-history.txt'
                self.update_history_file('dlt', dlt_data, history_file)
                results['dlt'] = True
            else:
                print("❌ 获取失败")
                results['dlt'] = False
        
        if lottery_type in ['all', 'ssq']:
            print("\n【双���球 (SSQ)】")
            ssq_data = self.fetch_ssq()
            if ssq_data:
                print(f"✅ 成功获取数据")
                print(f"   源: {ssq_data['source']}")
                print(f"   红球: {' '.join(ssq_data['red_numbers'])}")
                print(f"   蓝球: {ssq_data['blue_number']}")
                print(f"   记录总数: {ssq_data.get('total_records', 'N/A')}")
                
                history_file = './lottery-app/src/data/ssq-history.txt'
                self.update_history_file('ssq', ssq_data, history_file)
                results['ssq'] = True
            else:
                print("❌ 获取失败")
                results['ssq'] = False
        
        # 打印数据源状态
        print(self.manager.get_status_report())
        
        # 返回执行结果
        return all(results.values()) if results else False


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='统一彩票爬虫')
    parser.add_argument('--type', choices=['all', 'dlt', 'ssq'], default='all',
                       help='要爬取的彩种类型')
    
    args = parser.parse_args()
    
    crawler = UniversalLotteryCrawler()
    success = crawler.run(args.type)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
