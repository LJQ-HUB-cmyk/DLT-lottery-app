"""
彩票数据源管理模块
统一管理多彩种、多数据源的抓取与备份机制
"""

import requests
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Callable


class DataSource:
    """数据源配置"""
    
    def __init__(self, name: str, url: str, lottery_type: str, priority: int = 1, 
                 parser: Optional[Callable] = None):
        """
        初始化数据源
        :param name: 数据源名称
        :param url: 数据源URL
        :param lottery_type: 彩种类型 (dlt/ssq/etc)
        :param priority: 优先级 (1最高)
        :param parser: 解析函数
        """
        self.name = name
        self.url = url
        self.lottery_type = lottery_type
        self.priority = priority
        self.parser = parser
        self.last_success = None
        self.last_error = None
        self.failure_count = 0


class DataSourceManager:
    """数据源管理器"""
    
    def __init__(self, config_file: str = './scripts/data_sources.json'):
        """初始化管理器"""
        self.config_file = config_file
        self.sources: Dict[str, List[DataSource]] = {}
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        })
        self.load_config()
    
    def load_config(self):
        """从配置文件加载数据源"""
        if not os.path.exists(self.config_file):
            self.init_default_config()
        
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            for lottery_type, sources_list in config.get('sources', {}).items():
                self.sources[lottery_type] = []
                for src in sources_list:
                    source = DataSource(
                        name=src['name'],
                        url=src['url'],
                        lottery_type=lottery_type,
                        priority=src.get('priority', 1)
                    )
                    self.sources[lottery_type].append(source)
            
            # 按优先级排序
            for lottery_type in self.sources:
                self.sources[lottery_type].sort(key=lambda x: x.priority)
        
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            self.init_default_config()
    
    def init_default_config(self):
        """初始化默认配置"""
        config = {
            "sources": {
                "dlt": [
                    {
                        "name": "500.com",
                        "url": "http://kaijiang.500.com/shtml/dlt/{period}.shtml",
                        "priority": 1
                    },
                    {
                        "name": "lottery.gov.cn",
                        "url": "https://www.lottery.gov.cn/kj/kjlb.html?dlt",
                        "priority": 2
                    }
                ],
                "ssq": [
                    {
                        "name": "data.17500.cn",
                        "url": "https://data.17500.cn/ssq_asc.txt",
                        "priority": 1
                    },
                    {
                        "name": "500.com",
                        "url": "https://kaijiang.500.com/shtml/ssq/{period}.shtml",
                        "priority": 2
                    },
                    {
                        "name": "lottery.gov.cn",
                        "url": "https://www.lottery.gov.cn/kj/kjlb.html?ssq",
                        "priority": 3
                    }
                ]
            },
            "settings": {
                "timeout": 15,
                "max_retries": 3,
                "retry_interval": 300,
                "backup_enabled": True,
                "auto_switch_on_failure": True
            }
        }
        
        os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        self.load_config()
    
    def get_sources(self, lottery_type: str) -> List[DataSource]:
        """获取指定彩种的所有数据源"""
        return self.sources.get(lottery_type, [])
    
    def get_primary_source(self, lottery_type: str) -> Optional[DataSource]:
        """获取主数据源"""
        sources = self.get_sources(lottery_type)
        return sources[0] if sources else None
    
    def mark_success(self, source: DataSource):
        """标记数据源成功"""
        source.last_success = datetime.now().isoformat()
        source.failure_count = 0
    
    def mark_failure(self, source: DataSource, error: str):
        """标记数据源失败"""
        source.last_error = error
        source.failure_count += 1
    
    def fetch(self, source: DataSource, timeout: int = 15) -> Optional[str]:
        """
        从数据源获取数据
        :param source: 数据源
        :param timeout: 超时时间
        :return: 响应文本或None
        """
        try:
            print(f"  正在请求: {source.name} - {source.url}")
            response = self.session.get(source.url, timeout=timeout)
            response.encoding = 'utf-8'
            
            if response.status_code == 200:
                self.mark_success(source)
                return response.text
            else:
                error = f"HTTP {response.status_code}"
                self.mark_failure(source, error)
                return None
        
        except Exception as e:
            error = str(e)
            self.mark_failure(source, error)
            return None
    
    def try_all_sources(self, lottery_type: str, 
                       callback: Callable[[str, DataSource], Optional[Dict]]) -> Optional[Dict]:
        """
        尝试所有数据源
        :param lottery_type: 彩种类型
        :param callback: 处理响应的回调函数 (content, source) -> result
        :return: 成功的结果或None
        """
        sources = self.get_sources(lottery_type)
        
        if not sources:
            print(f"❌ 未找到彩种 {lottery_type} 的数据源")
            return None
        
        for source in sources:
            print(f"\n📡 尝试数据源: {source.name} (优先级: {source.priority})")
            
            content = self.fetch(source)
            if content:
                try:
                    result = callback(content, source)
                    if result:
                        return result
                except Exception as e:
                    print(f"  ❌ 解析失败: {e}")
                    self.mark_failure(source, str(e))
        
        print(f"\n❌ 所有数据源均失败")
        return None
    
    def get_status_report(self) -> str:
        """获取数据源状态报告"""
        report = []
        report.append("\n" + "=" * 70)
        report.append("📊 数据源状态报告")
        report.append(f"更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 70)
        
        for lottery_type, sources in self.sources.items():
            report.append(f"\n【{lottery_type.upper()}】")
            for source in sources:
                status = "✅ 正常" if source.failure_count < 3 else "❌ 异常"
                priority = f"优先级 {source.priority}"
                last_success = source.last_success or "未成功"
                failures = f"失败 {source.failure_count} 次"
                
                report.append(f"  {status} {source.name:<20} {priority:<10} {failures:<10}")
                if source.last_error:
                    report.append(f"      最后错误: {source.last_error}")
        
        report.append("\n" + "=" * 70)
        return "\n".join(report)
    
    def save_backup(self, lottery_type: str, data: str, data_dir: str = './lottery-app/src/data'):
        """
        保存数据备份
        :param lottery_type: 彩种类型
        :param data: 数据内容
        :param data_dir: 数据保存目录
        """
        backup_file = os.path.join(data_dir, f'{lottery_type}_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt')
        os.makedirs(data_dir, exist_ok=True)
        
        try:
            with open(backup_file, 'w', encoding='utf-8') as f:
                f.write(data)
            print(f"✅ 备份已保存: {backup_file}")
        except Exception as e:
            print(f"❌ 备份保存失败: {e}")


def main():
    """测试数据源管理器"""
    manager = DataSourceManager()
    
    # 打印状态报告
    print(manager.get_status_report())
    
    # 获取可用的数据源
    print("\n【可用数据源】")
    for lottery_type in ['dlt', 'ssq']:
        sources = manager.get_sources(lottery_type)
        print(f"\n{lottery_type.upper()}: {len(sources)} 个源")
        for source in sources:
            print(f"  - {source.name} (优先级 {source.priority}): {source.url[:50]}...")


if __name__ == '__main__':
    main()
