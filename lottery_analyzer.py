#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
彩票号码分析工具
基于历史数据进行统计分析和随机生成
注意：彩票是随机事件，此工具仅供娱乐和统计分析使用
"""

import random
from collections import Counter
import sys
from datetime import datetime
import os
import math
import time

class LotteryAnalyzer:
    def __init__(self, author="王正伟"):
        self.front_numbers = list(range(1, 36))  # 01-35
        self.back_numbers = list(range(1, 13))   # 01-12
        self.history_data = []
        self.author = author
        self.data_files = []
        
    def load_history_data(self, data_str, source_name="默认数据"):
        """加载历史数据"""
        lines = data_str.strip().split('\n')
        count = 0
        for line in lines:
            if line.strip():
                numbers = list(map(int, line.split()))
                if len(numbers) == 7:
                    front = numbers[:5]
                    back = numbers[5:]
                    self.history_data.append({
                        'front': front,
                        'back': back,
                        'full': numbers,
                        'source': source_name
                    })
                    count += 1
        print(f"从 [{source_name}] 加载了 {count} 组历史数据")
        return count
        
    def analyze_frequency(self):
        """分析号码出现频率"""
        front_counter = Counter()
        back_counter = Counter()
        
        for data in self.history_data:
            front_counter.update(data['front'])
            back_counter.update(data['back'])
            
        return front_counter, back_counter
    
    def get_hot_cold_numbers(self, top_n=10):
        """获取冷热号码"""
        front_counter, back_counter = self.analyze_frequency()
        
        # 前区热号（出现次数最多的）
        front_hot = front_counter.most_common(top_n)
        # 前区冷号（出现次数最少的）
        front_cold = front_counter.most_common()[:-top_n-1:-1] if len(front_counter) > top_n else []
        
        # 后区热号
        back_hot = back_counter.most_common(top_n)
        # 后区冷号
        back_cold = back_counter.most_common()[:-top_n-1:-1] if len(back_counter) > top_n else []
        
        return {
            'front_hot': front_hot,
            'front_cold': front_cold,
            'back_hot': back_hot,
            'back_cold': back_cold
        }
    
    def generate_random_combination(self, strategy='random'):
        """
        生成随机组合
        strategy: 'random' - 完全随机
                  'hot' - 偏向热号
                  'cold' - 偏向冷号
                  'balanced' - 平衡策略
        """
        front_counter, back_counter = self.analyze_frequency()
        
        if strategy == 'random':
            # 完全随机
            front = random.sample(self.front_numbers, 5)
            back = random.sample(self.back_numbers, 2)
            
        elif strategy == 'hot':
            # 偏向热号
            hot_front = [num for num, _ in front_counter.most_common(15)]
            hot_back = [num for num, _ in back_counter.most_common(6)]
            
            # 从热号中选取，但保留一定随机性
            front = random.sample(hot_front + self.front_numbers, 5)
            back = random.sample(hot_back + self.back_numbers, 2)
            
        elif strategy == 'cold':
            # 偏向冷号
            cold_front = [num for num, _ in front_counter.most_common()[:-16:-1]]
            cold_back = [num for num, _ in back_counter.most_common()[:-7:-1]]
            
            front = random.sample(cold_front + self.front_numbers, 5)
            back = random.sample(cold_back + self.back_numbers, 2)
            
        elif strategy == 'balanced':
            # 平衡策略：混合热号和随机号
            hot_front_nums = [num for num, _ in front_counter.most_common(10)]
            hot_back_nums = [num for num, _ in back_counter.most_common(4)]
            
            # 2个热号 + 3个随机号
            selected_hot_front = random.sample(hot_front_nums, min(2, len(hot_front_nums)))
            remaining_front = [n for n in self.front_numbers if n not in selected_hot_front]
            selected_random_front = random.sample(remaining_front, 5 - len(selected_hot_front))
            front = selected_hot_front + selected_random_front
            
            # 1个热号 + 1个随机号
            selected_hot_back = random.sample(hot_back_nums, min(1, len(hot_back_nums)))
            remaining_back = [n for n in self.back_numbers if n not in selected_hot_back]
            selected_random_back = random.sample(remaining_back, 2 - len(selected_hot_back))
            back = selected_hot_back + selected_random_back
        
        # 排序
        front.sort()
        back.sort()
        
        return front + back
    
    def load_from_file(self, file_path, source_name=None):
        """从文件加载历史数据"""
        if not os.path.exists(file_path):
            print(f"文件不存在: {file_path}")
            return 0
        
        if source_name is None:
            source_name = os.path.basename(file_path)
            
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        count = self.load_history_data(content, source_name)
        self.data_files.append(file_path)
        return count
    
    def display_statistics(self):
        """显示统计信息"""
        now = datetime.now()
        print("\n" + "="*60)
        print(f"彩票号码统计分析工具 v1.0 (统计学增强版)")
        print(f"作者: {self.author}")
        print(f"生成时间: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"数据来源: {len(self.data_files)} 个文件 + 内置数据")
        print(f"总数据量: {len(self.history_data)} 组")
        print("="*60)
        
        front_counter, back_counter = self.analyze_frequency()
        hot_cold = self.get_hot_cold_numbers()
        exp_front, exp_back = self.calculate_expected_value()
        variance = self.calculate_variance()
        
        print("\n【统计学核心指标】")
        print("-" * 40)
        print(f"前区数学期望值: {exp_front:.2f} (理论中心: 18.00)")
        print(f"前区标准差: {variance['front_std']:.2f}")
        print(f"后区数学期望值: {exp_back:.2f} (理论中心: 6.50)")
        print(f"后区标准差: {variance['back_std']:.2f}")
        
        print("\n【前区号码统计 (01-35)】")
        print("-" * 40)
        print("最热号码 (高频区):")
        for num, count in hot_cold['front_hot'][:5]:
            prob = (count / len(self.history_data)) * 100
            print(f"  {num:02d}: {count} 次 (概率: {prob:.1f}%)")
        
        print("\n最冷号码 (低频区):")
        for num, count in hot_cold['front_cold'][:5]:
            prob = (count / len(self.history_data)) * 100
            print(f"  {num:02d}: {count} 次 (概率: {prob:.1f}%)")
        
        print("\n【后区号码统计 (01-12)】")
        print("-" * 40)
        print("最热号码:")
        for num, count in hot_cold['back_hot'][:3]:
            prob = (count / len(self.history_data)) * 100
            print(f"  {num:02d}: {count} 次 (概率: {prob:.1f}%)")
        
        print("\n最冷号码:")
        for num, count in hot_cold['back_cold'][:3]:
            prob = (count / len(self.history_data)) * 100
            print(f"  {num:02d}: {count} 次 (概率: {prob:.1f}%)")

    def calculate_expected_value(self):
        """计算数学期望值（基于频率的加权平均）"""
        front_counter, back_counter = self.analyze_frequency()
        total_front = sum(front_counter.values())
        total_back = sum(back_counter.values())
        
        # 前区期望值
        exp_front = sum(num * count for num, count in front_counter.items()) / total_front if total_front > 0 else 18
        # 后区期望值
        exp_back = sum(num * count for num, count in back_counter.items()) / total_back if total_back > 0 else 6.5
        
        return exp_front, exp_back

    def calculate_variance(self):
        """计算方差和标准差，分析离散程度"""
        front_counter, back_counter = self.analyze_frequency()
        total_front = sum(front_counter.values())
        total_back = sum(back_counter.values())
        
        exp_front, exp_back = self.calculate_expected_value()
        
        var_front = sum(count * (num - exp_front) ** 2 for num, count in front_counter.items()) / total_front if total_front > 0 else 0
        var_back = sum(count * (num - exp_back) ** 2 for num, count in back_counter.items()) / total_back if total_back > 0 else 0
        
        return {
            'front_var': var_front,
            'front_std': math.sqrt(var_front),
            'back_var': var_back,
            'back_std': math.sqrt(var_back)
        }

    def calculate_omission(self):
        """计算每个号码的遗漏值（连续未出现的期数）"""
        front_omission = {num: 0 for num in self.front_numbers}
        back_omission = {num: 0 for num in self.back_numbers}
        
        # 从最新一期往前统计
        for data in reversed(self.history_data):
            for num in self.front_numbers:
                if num not in data['front']:
                    front_omission[num] += 1
                else:
                    break  # 出现了就停止计数
            
            for num in self.back_numbers:
                if num not in data['back']:
                    back_omission[num] += 1
                else:
                    break
        
        return front_omission, back_omission
    
    def calculate_time_decay_weights(self, decay_factor=0.95):
        """计算带时间衰减的权重（近期数据权重更高）"""
        front_weights = {num: 0 for num in self.front_numbers}
        back_weights = {num: 0 for num in self.back_numbers}
        
        total_periods = len(self.history_data)
        
        for i, data in enumerate(reversed(self.history_data)):
            # 时间衰减因子：越近的数据权重越高
            weight = decay_factor ** i
            
            for num in data['front']:
                front_weights[num] += weight
            
            for num in data['back']:
                back_weights[num] += weight
        
        return front_weights, back_weights
    
    def analyze_odd_even_ratio(self):
        """分析奇偶比"""
        odd_count = 0
        even_count = 0
        total = 0
        
        for data in self.history_data:
            for num in data['front']:
                if num % 2 == 0:
                    even_count += 1
                else:
                    odd_count += 1
                total += 1
        
        return {
            'odd_ratio': odd_count / total if total > 0 else 0.5,
            'even_ratio': even_count / total if total > 0 else 0.5,
            'odd_count': odd_count,
            'even_count': even_count
        }
    
    def analyze_zone_distribution(self):
        """分析区间分布（将35个号分成7个区）"""
        zones = {
            '01-05': 0,
            '06-10': 0,
            '11-15': 0,
            '16-20': 0,
            '21-25': 0,
            '26-30': 0,
            '31-35': 0
        }
        
        for data in self.history_data:
            for num in data['front']:
                if 1 <= num <= 5:
                    zones['01-05'] += 1
                elif 6 <= num <= 10:
                    zones['06-10'] += 1
                elif 11 <= num <= 15:
                    zones['11-15'] += 1
                elif 16 <= num <= 20:
                    zones['16-20'] += 1
                elif 21 <= num <= 25:
                    zones['21-25'] += 1
                elif 26 <= num <= 30:
                    zones['26-30'] += 1
                elif 31 <= num <= 35:
                    zones['31-35'] += 1
        
        return zones
    
    def generate_omission_based_prediction(self):
        """基于遗漏值的预测模型"""
        front_omission, back_omission = self.calculate_omission()
        
        # 选择遗漏值适中的号码（避免极热和极冷）
        # 策略：优先选择遗漏值在中等范围的号码
        sorted_front = sorted(front_omission.items(), key=lambda x: x[1])
        sorted_back = sorted(back_omission.items(), key=lambda x: x[1])
        
        # 取中间60%的号码作为候选池
        front_candidates = [num for num, _ in sorted_front[len(sorted_front)//5:-len(sorted_front)//5]]
        back_candidates = [num for num, _ in sorted_back[len(sorted_back)//5:-len(sorted_back)//5]]
        
        # 从候选池中随机选择
        if len(front_candidates) >= 5:
            front = random.sample(front_candidates, 5)
        else:
            front = random.sample(self.front_numbers, 5)
        
        if len(back_candidates) >= 2:
            back = random.sample(back_candidates, 2)
        else:
            back = random.sample(self.back_numbers, 2)
        
        front.sort()
        back.sort()
        return front + back
    
    def generate_time_decay_prediction(self, decay_factor=0.95):
        """基于时间衰减加权的预测模型"""
        front_weights, back_weights = self.calculate_time_decay_weights(decay_factor)
        
        # 使用权重进行加权抽样
        front_nums = list(front_weights.keys())
        front_w = list(front_weights.values())
        back_nums = list(back_weights.keys())
        back_w = list(back_weights.values())
        
        # 加权抽样（无放回）
        def weighted_sample_no_replacement(pool, weights, k):
            selected = []
            p_pool = list(pool)
            p_weights = list(weights)
            for _ in range(k):
                if not p_pool:
                    break
                idx = random.choices(range(len(p_pool)), weights=p_weights, k=1)[0]
                selected.append(p_pool[idx])
                del p_pool[idx]
                del p_weights[idx]
            return selected
        
        front = weighted_sample_no_replacement(front_nums, front_w, 5)
        back = weighted_sample_no_replacement(back_nums, back_w, 2)
        
        front.sort()
        back.sort()
        return front + back
    
    def generate_ensemble_prediction(self):
        """集成模型：结合多个模型的预测结果"""
        # 生成各个模型的预测
        predictions = []
        
        # 1. 频率加权随机
        pred1 = self.generate_statistical_prediction('weighted')
        predictions.append(pred1)
        
        # 2. 均值回归
        pred2 = self.generate_statistical_prediction('regression')
        predictions.append(pred2)
        
        # 3. 时间衰减加权
        pred3 = self.generate_time_decay_prediction()
        predictions.append(pred3)
        
        # 4. 遗漏值模型
        pred4 = self.generate_omission_based_prediction()
        predictions.append(pred4)
        
        # 统计每个号码出现的次数
        front_counter = Counter()
        back_counter = Counter()
        
        for pred in predictions:
            front_counter.update(pred[:5])
            back_counter.update(pred[5:])
        
        # 选择出现次数最多的号码
        front_top = [num for num, _ in front_counter.most_common(8)]  # 前8个高频
        back_top = [num for num, _ in back_counter.most_common(4)]    # 后4个高频
        
        # 从前8个中随机选5个，从后4个中随机选2个
        front = random.sample(front_top, min(5, len(front_top)))
        back = random.sample(back_top, min(2, len(back_top)))
        
        # 如果不够，补充随机号码
        while len(front) < 5:
            num = random.choice(self.front_numbers)
            if num not in front:
                front.append(num)
        
        while len(back) < 2:
            num = random.choice(self.back_numbers)
            if num not in back:
                back.append(num)
        
        front.sort()
        back.sort()
        return front + back
    
    def generate_statistical_prediction(self, strategy='weighted'):
        """
        基于统计学原理生成预测
        strategy: 'weighted' - 频率加权随机
                  'regression' - 均值回归（偏向期望值附近）
                  'distribution' - 正态分布模拟
        """
        front_counter, back_counter = self.analyze_frequency()
        exp_front, exp_back = self.calculate_expected_value()
        variance = self.calculate_variance()
        
        if strategy == 'weighted':
            # 频率加权抽样：出现频率越高的号码被选中的概率越大
            # 前区必须不重复，使用 sample 确保唯一性
            unique_front_nums = list(front_counter.keys())
            unique_front_weights = [front_counter[n] for n in unique_front_nums]
            for n in self.front_numbers:
                if n not in front_counter:
                    unique_front_nums.append(n)
                    unique_front_weights.append(1)
            
            unique_back_nums = list(back_counter.keys())
            unique_back_weights = [back_counter[n] for n in unique_back_nums]
            for n in self.back_numbers:
                if n not in back_counter:
                    unique_back_nums.append(n)
                    unique_back_weights.append(1)
            
            def weighted_sample_no_replacement(pool, weights, k):
                selected = []
                p_pool = list(pool)
                p_weights = list(weights)
                for _ in range(k):
                    if not p_pool: break
                    idx = random.choices(range(len(p_pool)), weights=p_weights, k=1)[0]
                    selected.append(p_pool[idx])
                    del p_pool[idx]
                    del p_weights[idx]
                return selected
            
            front = weighted_sample_no_replacement(unique_front_nums, unique_front_weights, 5)
            back = weighted_sample_no_replacement(unique_back_nums, unique_back_weights, 2)
            
        elif strategy == 'regression':
            # 均值回归：在期望值附近生成符合方差的随机数
            front = []
            while len(front) < 5:
                num = int(random.gauss(exp_front, variance['front_std']))
                if 1 <= num <= 35 and num not in front:
                    front.append(num)
            
            back = []
            while len(back) < 2:
                num = int(random.gauss(exp_back, variance['back_std']))
                if 1 <= num <= 12 and num not in back:
                    back.append(num)
                    
        elif strategy == 'distribution':
            # 模拟总体分布：确保生成的组合在统计特征上接近历史数据
            target_sum_front = int(exp_front * 5)
            target_sum_back = int(exp_back * 2)
            
            for _ in range(100):
                front = random.sample(self.front_numbers, 5)
                back = random.sample(self.back_numbers, 2)
                if abs(sum(front) - target_sum_front) < 10 and abs(sum(back) - target_sum_back) < 4:
                    break
        
        front.sort()
        back.sort()
        return front + back

    def generate_zhouyi_prediction(self, iteration=0):
        """基于周易与时空能量的预测模型"""
        now = datetime.now()
        # 获取时间因子：年、月、日、时、分、秒、微秒
        t_factor = now.year + now.month + now.day + now.hour + now.minute + now.second
        
        # 模拟卦象计算（简化版梅花易数逻辑）
        upper_trigram = (now.year + now.month + now.day) % 8
        lower_trigram = (now.year + now.month + now.day + now.hour) % 8
        moving_line = (t_factor + iteration) % 6
        
        # 根据时空能量设定种子偏移，加入微秒和迭代次数确保唯一性
        seed_offset = (upper_trigram * 1000 + lower_trigram * 100 + moving_line * 10 + now.microsecond % 100 + iteration)
        
        # 使用当前时间戳结合卦象作为随机种子
        current_seed = int(time.time() * 1000) ^ seed_offset
        rng = random.Random(current_seed)
        
        # 根据五行生克简单映射号码范围（模拟）
        # 乾兑属金(4,9), 震巽属木(3,8), 坎属水(1,6), 离属火(2,7), 坤艮属土(5,10)
        trigram_elements = {
            0: [5, 10, 15, 20, 25, 30, 35], # 坤土
            1: [1, 6, 11, 16, 21, 26, 31],   # 乾金
            2: [2, 7, 12, 17, 22, 27, 32],   # 兑金
            3: [3, 8, 13, 18, 23, 28, 33],   # 离火
            4: [4, 9, 14, 19, 24, 29, 34],   # 震木
            5: [5, 10, 15, 20, 25, 30, 35], # 巽木
            6: [1, 6, 11, 16, 21, 26, 31],   # 坎水
            7: [2, 7, 12, 17, 22, 27, 32]    # 艮土
        }
        
        # 从对应卦象的号码池中选取
        pool_u = trigram_elements.get(upper_trigram, self.front_numbers)
        pool_l = trigram_elements.get(lower_trigram, self.front_numbers)
        combined_pool = list(set(pool_u + pool_l))
        
        front = rng.sample(combined_pool if len(combined_pool) >= 5 else self.front_numbers, 5)
        back = rng.sample(self.back_numbers, 2)
        
        front.sort()
        back.sort()
        return front + back

    def generate_predictions(self, selected_models=None, count_per_model=5):
        """生成基于统计学的预测号码
        
        Args:
            selected_models: 要运行的模型列表，None 表示运行所有模型
            count_per_model: 每个模型生成的组数
        """
        all_strategies = {
            'weighted': ('频率加权随机', '利用历史出现频率作为权重，高频号更易被选中'),
            'regression': ('均值回归模型', '基于数学期望值和标准差，模拟号码向中心值回归的趋势'),
            'distribution': ('正态分布模拟', '控制总和与离散度，使组合符合历史数据的整体分布特征'),
            'balanced': ('混合平衡策略', '结合热号与随机号，在趋势与不确定性之间寻找平衡点'),
            'omission': ('遗漏值分析模型', '关注长期未出的号码，捕捉潜在的补号机会'),
            'time_decay': ('时间衰减加权模型', '赋予近期数据更高权重，更能反映近期的出号规律'),
            'zhouyi': ('周易时空能量模型', '结合当前运行时间与八卦五行，推演当下的时空能量场')
        }
        
        if selected_models is None:
            selected_models = list(all_strategies.keys())
        
        print("\n" + "="*60)
        print("基于统计学与概率论的预测结果")
        print("="*60)
        
        for strat_key in selected_models:
            if strat_key not in all_strategies:
                continue
                
            strat_name, strat_desc = all_strategies[strat_key]
            print(f"\n--- 模型: {strat_name} ---")
            print(f"   [优势]: {strat_desc}")
            
            for i in range(count_per_model):
                try:
                    if strat_key == 'balanced':
                        combination = self.generate_random_combination('balanced')
                    elif strat_key == 'omission':
                        combination = self.generate_omission_based_prediction()
                    elif strat_key == 'time_decay':
                        combination = self.generate_time_decay_prediction()
                    elif strat_key == 'zhouyi':
                        combination = self.generate_zhouyi_prediction(iteration=i)
                    else:
                        combination = self.generate_statistical_prediction(strat_key)
                    
                    front = combination[:5]
                    back = combination[5:]
                    
                    print(f"  [{i+1}] 前区: {' '.join(f'{n:02d}' for n in front)} (和值: {sum(front)}) | 后区: {' '.join(f'{n:02d}' for n in back)} (和值: {sum(back)})")
                except Exception as e:
                    print(f"  [!] 该模型生成出错: {e}")

def main():
    analyzer = LotteryAnalyzer(author="WZW")
    
    history_data_1 = """07 09 23 27 32 02 08
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
09 10 20 33 35 04 11
"""

    analyzer.load_history_data(history_data_1, "第一批历史数据")
    print(f"\n总共加载了 {len(analyzer.history_data)} 组历史数据用于分析")
    
    analyzer.display_statistics()
    
    # --- 命令行交互选择 ---
    all_models = {
        '1': ('weighted', '频率加权随机'),
        '2': ('regression', '均值回归模型'),
        '3': ('distribution', '正态分布模拟'),
        '4': ('balanced', '混合平衡策略'),
        '5': ('omission', '遗漏值分析模型'),
        '6': ('time_decay', '时间衰减加权模型'),
        '7': ('zhouyi', '周易时空能量模型')
    }
    
    print("\n请选择要运行的模型 (输入序号，多个用逗号分隔，如 1,3,5):")
    for k, (v, desc) in all_models.items():
        print(f"  {k}. {desc}")
    
    try:
        choice = input("\n请输入您的选择 (直接回车默认全选): ").strip()
        if not choice:
            models_to_run = [v for v, _ in all_models.values()]
        else:
            selected_keys = [x.strip() for x in choice.split(',')]
            models_to_run = [all_models[k][0] for k in selected_keys if k in all_models]
            
        count_input = input("每个模型生成几组数据? (直接回车默认5组): ").strip()
        groups_per_model = int(count_input) if count_input.isdigit() else 5
    except Exception:
        models_to_run = [v for v, _ in all_models.values()]
        groups_per_model = 5
    # ----------------------
    
    analyzer.generate_predictions(selected_models=models_to_run, count_per_model=groups_per_model)
    
    now = datetime.now()
    print("\n" + "="*60)
    print("重要提醒:")
    print("彩票是随机事件，任何预测都仅供参考娱乐")
    print("请理性购彩，切勿沉迷")
    print(f"分析完成时间: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"工具作者: {analyzer.author}")
    print("="*60)

if __name__ == "__main__":
    main()