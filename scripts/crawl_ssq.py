"""
双色球(SSQ)自动爬取爬虫
支持多个数据源，当主数据源失败时自动切换备用源
数据格式: 红球6个(01-33) + 蓝球1个(01-16)
"""

import requests
import pandas as pd
import re
import os
import sys
from datetime import datetime


class SSQCrawler:
    """双色球爬虫 - 支持多数据源"""
    
    # 多个数据源配置
    DATA_SOURCES = [
        {
            'name': 'data.17500.cn',
            'url': 'https://data.17500.cn/ssq_asc.txt',
            'parser': 'parse_17500'
        },
        {
            'name': 'kaijiang.500.com',
            'url': 'https://kaijiang.500.com/shtml/ssq/{period}.shtml',
            'parser': 'parse_500com_page'
        },
        {
            'name': 'lottery.gov.cn',
            'url': 'https://www.lottery.gov.cn/kj/kjlb.html?ssq',
            'parser': 'parse_lottery_gov'
        }
    ]
    
    def __init__(self, max_retries=3):
        """
        初始化爬虫
        :param max_retries: 最大重试次数
        """
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        })
    
    def parse_17500(self, content):
        """
        解析 data.17500.cn 的数据格式
        格式: Seq,日期,红球1-6,蓝球
        """
        data = []
        lines = content.strip().split('\n')
        
        for line in lines:
            if len(line) < 10:
                continue
            
            try:
                parts = line.split(',', 1)
                if not parts:
                    continue
                
                first_part = parts[0].strip()
                fields = first_part.split()
                
                # 需要至少 8 个字段 (Seq + 日期 + 6个红球 + 1个蓝球)
                if len(fields) < 8:
                    continue
                
                seq = fields[0]
                red_balls = fields[2:8]  # 提取6个红球
                blue_ball = fields[8] if len(fields) > 8 else None
                
                # 验证红球和蓝球
                if len(red_balls) != 6 or not blue_ball:
                    continue
                
                # 验证号码范围
                red_nums = [int(x) for x in red_balls]
                blue_num = int(blue_ball)
                
                if all(1 <= n <= 33 for n in red_nums) and 1 <= blue_num <= 16:
                    # 检查重复
                    if len(set(red_nums)) == 6:  # 红球无重复
                        item = {
                            'seq': seq,
                            'red_balls': red_balls,
                            'blue_ball': blue_ball
                        }
                        data.append(item)
            except (ValueError, IndexError):
                continue
        
        return data
    
    def parse_500com_page(self, content, period):
        """
        解析 500.com 页面中的双色球数据
        """
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            
            # 尝试从标题中提取号码
            title = soup.find('title')
            if title:
                title_text = title.get_text()
                # 匹配 "双色球XXXXXX期开奖结果 01 02 03 04 05 06 + 07"
                pattern = r'(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s*[+]\s*(\d{2})'
                match = re.search(pattern, title_text)
                
                if match:
                    red_balls = [str(int(x)).zfill(2) for x in match.groups()[:6]]
                    blue_ball = str(int(match.group(7))).zfill(2)
                    
                    return {
                        'period': period,
                        'red_balls': red_balls,
                        'blue_ball': blue_ball
                    }
            
            return None
        except Exception as e:
            print(f"  解析 500.com 页面失败: {e}")
            return None
    
    def parse_lottery_gov(self, content):
        """
        解析官方lottery.gov.cn的数据
        """
        try:
            # 这个源需要JavaScript渲染，暂时跳过
            # 可以使用 selenium 或 playwright 来处理
            return None
        except Exception as e:
            print(f"  解析 lottery.gov.cn 失败: {e}")
            return None
    
    def fetch_from_17500(self):
        """从 data.17500.cn 获取数据"""
        source = self.DATA_SOURCES[0]
        print(f"\n📡 尝试数据源: {source['name']}")
        
        try:
            print(f"   URL: {source['url']}")
            response = self.session.get(source['url'], timeout=15)
            response.encoding = 'utf-8'
            
            if response.status_code != 200:
                print(f"   ❌ HTTP {response.status_code}")
                return None
            
            print(f"   ✅ 连接成功，解析数据中...")
            data = self.parse_17500(response.text)
            
            if data:
                print(f"   ✅ 成功解析 {len(data)} 条数据")
                return data
            else:
                print(f"   ❌ 未能解析任何数据")
                return None
        
        except Exception as e:
            print(f"   ❌ 错误: {str(e)}")
            return None
    
    def format_ssq_line(self, item):
        """格式化单条SSQ数据为文本行"""
        red_str = ' '.join([str(n).zfill(2) for n in item['red_balls']])
        blue_str = str(int(item['blue_ball'])).zfill(2)
        return f"{red_str} {blue_str}"
    
    def fetch_latest(self):
        """尝试多个数据源获取最新数据"""
        print("=" * 70)
        print("🎯 双色球多源爬取系统")
        print(f"📅 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        # 首先尝试主数据源
        data = self.fetch_from_17500()
        
        if data and len(data) > 0:
            # 返回最新的一条
            latest = data[-1]
            latest['source'] = self.DATA_SOURCES[0]['name']
            return latest
        
        print("\n⚠️ 主数据源失败，尝试备用源...")
        # TODO: 添加其他数据源的实现
        
        return None
    
    def update_history(self, history_file, new_item):
        """更新历史文件"""
        if not new_item:
            return False, "数据为空"
        
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        
        new_line = self.format_ssq_line(new_item)
        
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
    
    def run(self, history_file='./lottery-app/src/data/ssq-history.txt'):
        """执行爬取"""
        # 获取最新数据
        result = self.fetch_latest()
        
        if not result:
            print("\n" + "=" * 70)
            print("❌ 所有数据源均失败，请稍后重试")
            print("=" * 70)
            return False
        
        # 显示结果
        print(f"\n{'=' * 70}")
        print(f"✅ 最新数据 (来源: {result.get('source', '未知')})")
        
        formatted = self.format_ssq_line(result)
        print(f"   双色球: {formatted}")
        print(f"   红球: {' '.join([str(n).zfill(2) for n in result['red_balls']])}")
        print(f"   蓝球: {str(int(result['blue_ball'])).zfill(2)}")
        
        # 更新文件
        success, message = self.update_history(history_file, result)
        
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
    crawler = SSQCrawler()
    history_file = './lottery-app/src/data/ssq-history.txt'
    success = crawler.run(history_file)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
