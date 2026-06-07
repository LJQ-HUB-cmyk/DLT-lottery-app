#!/usr/bin/env python3
"""大乐透历史数据冷热号深度分析"""

# 解析所有211期数据
all_data = []
with open(r'd:\0.Code\0.发财大计\lottery-app\src\data\lottery-history.txt', 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        # 去掉行号前缀
        if '→' in line:
            line = line.split('→')[1]
        nums = line.split()
        front = [int(n) for n in nums[:5]]
        back = [int(n) for n in nums[5:7]]
        all_data.append({'front': front, 'back': back})

total = len(all_data)
print(f"总期数: {total}")
print(f"最新一期(第{total}期): 前区={all_data[-1]['front']} 后区={all_data[-1]['back']}")
print()

# ===== 分段分析 =====
# 最近50期 (期号162-211)
recent_50 = all_data[-50:]
# 前161期 (期号1-161)
early_161 = all_data[:161]
# 最近20期 (期号192-211)
recent_20 = all_data[-20:]
# 最近10期 (期号202-211)
recent_10 = all_data[-10:]
# 最近5期 (期号207-211)
recent_5 = all_data[-5:]

def count_freq(data_list, zone='front', max_num=35):
    freq = {}
    for i in range(1, max_num+1):
        freq[i] = 0
    for d in data_list:
        for n in d[zone]:
            freq[n] += 1
    return freq

# ===== 前区分析 (1-35) =====
print("=" * 80)
print("【前区号码深度分析】")
print("=" * 80)

early_front = count_freq(early_161, 'front', 35)
recent50_front = count_freq(recent_50, 'front', 35)
recent20_front = count_freq(recent_20, 'front', 35)
recent10_front = count_freq(recent_10, 'front', 35)
recent5_front = count_freq(recent_5, 'front', 35)

# 计算频率率 (每期出现概率)
# 期望值: 每期5/35 ≈ 0.143 (14.3%)
expected_rate_front = 5 / 35

print(f"\n前区期望频率(每期): {expected_rate_front:.3f} (约14.3%)")
print(f"前区近50期期望出现次数: {50 * expected_rate_front:.1f} (约7.1次)")
print()

# 分类冷热号
print("--- 近50期前区号码频率排名 ---")
freq_rank_50 = sorted(recent50_front.items(), key=lambda x: x[1], reverse=True)
for num, freq in freq_rank_50:
    rate = freq / 50
    early_freq = early_front[num]
    early_rate = early_freq / 161
    change = rate - early_rate
    recent5_f = recent5_front[num]
    recent10_f = recent10_front[num]
    recent20_f = recent20_front[num]
    # 判断冷热状态
    if rate >= expected_rate_front * 1.5:
        status = "🔥极热"
    elif rate >= expected_rate_front * 1.2:
        status = "热号"
    elif rate >= expected_rate_front * 0.8:
        status = "温号"
    elif rate >= expected_rate_front * 0.5:
        status = "冷号"
    else:
        status = "❄️极冷"
    
    # 判断冷→热或热→冷趋势
    trend = ""
    if early_rate < expected_rate_front * 0.8 and rate >= expected_rate_front * 1.2:
        trend = "⚡冷→热逆袭"
    elif early_rate < expected_rate_front * 0.8 and rate >= expected_rate_front:
        trend = "↑冷号升温"
    elif early_rate >= expected_rate_front * 1.2 and rate < expected_rate_front * 0.8:
        trend = "↓热号降温"
    elif early_rate >= expected_rate_front * 1.2 and rate >= expected_rate_front * 1.2:
        trend = "🔥持续热门"
    elif early_rate >= expected_rate_front and rate >= expected_rate_front * 1.2:
        trend = "↗升温加速"
    
    # 近期动量 (近5期 vs 近50期平均)
    momentum_5 = (recent5_f / 5) - rate
    
    print(f"  #{num:2d}: 近50期={freq}次({rate:.1%}) 近20期={recent20_f} 近10期={recent10_f} 近5期={recent5_f} "
          f"历史161期={early_freq}({early_rate:.1%}) 变化={change:+.1%} {status} {trend} 动量5期={momentum_5:+.2f}")

print()
print("=" * 80)
print("【冷号变热 详细分析】")
print("=" * 80)

cold_to_hot = []
for num in range(1, 36):
    early_rate = early_front[num] / 161
    recent_rate = recent50_front[num] / 50
    recent10_rate = recent10_front[num] / 10
    recent5_rate = recent5_front[num] / 5
    if early_rate < expected_rate_front * 0.9 and recent_rate >= expected_rate_front * 1.1:
        cold_to_hot.append({
            'num': num,
            'early_freq': early_front[num],
            'early_rate': early_rate,
            'recent50_freq': recent50_front[num],
            'recent50_rate': recent_rate,
            'recent10_freq': recent10_front[num],
            'recent10_rate': recent10_rate,
            'recent5_freq': recent5_front[num],
            'recent5_rate': recent5_rate,
            'boost': recent_rate - early_rate
        })

cold_to_hot.sort(key=lambda x: x['boost'], reverse=True)
if cold_to_hot:
    print(f"\n发现 {len(cold_to_hot)} 个冷→热逆袭号码:")
    for item in cold_to_hot:
        print(f"  #{item['num']:2d}: 历史161期频率={item['early_rate']:.1%}({item['early_freq']}次) "
              f"→ 近50期={item['recent50_rate']:.1%}({item['recent50_freq']}次) "
              f"近10期={item['recent10_rate']:.1%}({item['recent10_freq']}次) "
              f"近5期={item['recent5_rate']:.1%}({item['recent5_freq']}次) "
              f"提升={item['boost']:+.1%}")
else:
    print("\n没有发现明显的冷→热逆袭号码")

# 找升温但还没完全变热的号码
warming = []
for num in range(1, 36):
    early_rate = early_front[num] / 161
    recent_rate = recent50_front[num] / 50
    recent5_rate = recent5_front[num] / 5
    recent10_rate = recent10_front[num] / 10
    if early_rate < expected_rate_front * 0.9 and recent_rate >= expected_rate_front * 0.9 and recent5_rate > recent_rate:
        warming.append({
            'num': num,
            'early_rate': early_rate,
            'recent50_rate': recent_rate,
            'recent5_rate': recent5_rate,
            'recent10_rate': recent10_rate,
            'momentum': recent5_rate - recent_rate
        })

warming.sort(key=lambda x: x['momentum'], reverse=True)
if warming:
    print(f"\n发现 {len(warming)} 个正在升温的冷号:")
    for item in warming:
        print(f"  #{item['num']:2d}: 历史={item['early_rate']:.1%} → 近50期={item['recent50_rate']:.1%} "
              f"近10期={item['recent10_rate']:.1%} → 近5期={item['recent5_rate']:.1%} "
              f"动量加速={item['momentum']:+.2f}")

print()
print("=" * 80)
print("【持续热门号码 详细分析】")
print("=" * 80)

consistent_hot = []
for num in range(1, 36):
    early_rate = early_front[num] / 161
    recent_rate = recent50_front[num] / 50
    recent10_rate = recent10_front[num] / 10
    recent5_rate = recent5_front[num] / 5
    if early_rate >= expected_rate_front * 1.1 and recent_rate >= expected_rate_front * 1.1:
        consistent_hot.append({
            'num': num,
            'early_freq': early_front[num],
            'early_rate': early_rate,
            'recent50_freq': recent50_front[num],
            'recent50_rate': recent_rate,
            'recent10_freq': recent10_front[num],
            'recent10_rate': recent10_rate,
            'recent5_freq': recent5_front[num],
            'recent5_rate': recent5_rate,
        })

consistent_hot.sort(key=lambda x: x['recent50_rate'], reverse=True)
if consistent_hot:
    print(f"\n发现 {len(consistent_hot)} 个持续热门号码:")
    for item in consistent_hot:
        stability = "稳定" if item['recent5_rate'] >= item['recent50_rate'] * 0.8 else "轻微降温"
        print(f"  #{item['num']:2d}: 历史={item['early_rate']:.1%}({item['early_freq']}次) "
              f"近50期={item['recent50_rate']:.1%}({item['recent50_freq']}次) "
              f"近10期={item['recent10_rate']:.1%}({item['recent10_freq']}次) "
              f"近5期={item['recent5_rate']:.1%}({item['recent5_freq']}次) "
              f"状态={stability}")

print()
print("=" * 80)
print("【热号降温 详细分析】")
print("=" * 80)

cooling_hot = []
for num in range(1, 36):
    early_rate = early_front[num] / 161
    recent_rate = recent50_front[num] / 50
    recent5_rate = recent5_front[num] / 5
    if early_rate >= expected_rate_front * 1.1 and recent_rate < expected_rate_front * 0.9:
        cooling_hot.append({
            'num': num,
            'early_rate': early_rate,
            'recent50_rate': recent_rate,
            'recent5_rate': recent5_rate,
            'drop': early_rate - recent_rate
        })

cooling_hot.sort(key=lambda x: x['drop'], reverse=True)
if cooling_hot:
    print(f"\n发现 {len(cooling_hot)} 个热号降温号码:")
    for item in cooling_hot:
        print(f"  #{item['num']:2d}: 历史={item['early_rate']:.1%} → 近50期={item['recent50_rate']:.1%} "
              f"近5期={item['recent5_rate']:.1%} 降幅={item['drop']:.1%}")

print()
print("=" * 80)
print("【近5期极端高频号（动量加速）】")
print("=" * 80)

acceleration = []
for num in range(1, 36):
    recent5_rate = recent5_front[num] / 5
    recent50_rate = recent50_front[num] / 50
    acc = recent5_rate - recent50_rate
    acceleration.append({'num': num, 'rate_5': recent5_rate, 'rate_50': recent50_rate, 'acc': acc})

acceleration.sort(key=lambda x: x['acc'], reverse=True)
print("\n动量加速Top10 (近5期频率 - 近50期频率):")
for item in acceleration[:10]:
    print(f"  #{item['num']:2d}: 近5期={item['rate_5']:.1%} 近50期={item['rate_50']:.1%} 加速度={item['acc']:+.2f}")

print("\n动量减速Top10 (近5期频率 - 近50期频率):")
for item in acceleration[-10:]:
    print(f"  #{item['num']:2d}: 近5期={item['rate_5']:.1%} 近50期={item['rate_50']:.1%} 加速度={item['acc']:+.2f}")

# ===== 后区分析 (1-12) =====
print()
print("=" * 80)
print("【后区号码深度分析】")
print("=" * 80)

early_back = count_freq(early_161, 'back', 12)
recent50_back = count_freq(recent_50, 'back', 12)
recent20_back = count_freq(recent_20, 'back', 12)
recent10_back = count_freq(recent_10, 'back', 12)
recent5_back = count_freq(recent_5, 'back', 12)

expected_rate_back = 2 / 12  # ≈ 0.167

print(f"\n后区期望频率(每期): {expected_rate_back:.3f} (约16.7%)")
print(f"后区近50期期望出现次数: {50 * expected_rate_back:.1f} (约8.3次)")
print()

print("--- 近50期后区号码频率排名 ---")
freq_rank_50_back = sorted(recent50_back.items(), key=lambda x: x[1], reverse=True)
for num, freq in freq_rank_50_back:
    rate = freq / 50
    early_freq = early_back[num]
    early_rate = early_freq / 161
    recent5_f = recent5_back[num]
    recent10_f = recent10_back[num]
    recent20_f = recent20_back[num]
    
    if rate >= expected_rate_back * 1.5:
        status = "🔥极热"
    elif rate >= expected_rate_back * 1.2:
        status = "热号"
    elif rate >= expected_rate_back * 0.8:
        status = "温号"
    elif rate >= expected_rate_back * 0.5:
        status = "冷号"
    else:
        status = "❄️极冷"
    
    trend = ""
    if early_rate < expected_rate_back * 0.8 and rate >= expected_rate_back * 1.2:
        trend = "⚡冷→热逆袭"
    elif early_rate < expected_rate_back * 0.8 and rate >= expected_rate_back:
        trend = "↑冷号升温"
    elif early_rate >= expected_rate_back * 1.2 and rate < expected_rate_back * 0.8:
        trend = "↓热号降温"
    elif early_rate >= expected_rate_back * 1.2 and rate >= expected_rate_back * 1.2:
        trend = "🔥持续热门"
    
    momentum_5 = (recent5_f / 5) - rate
    
    print(f"  #{num:2d}: 近50期={freq}次({rate:.1%}) 近20期={recent20_f} 近10期={recent10_f} 近5期={recent5_f} "
          f"历史={early_freq}({early_rate:.1%}) {status} {trend} 动量={momentum_5:+.2f}")

# 后区冷→热
print()
print("--- 后区冷→热逆袭 ---")
for num in range(1, 13):
    early_rate = early_back[num] / 161
    recent_rate = recent50_back[num] / 50
    recent5_rate = recent5_back[num] / 5
    if early_rate < expected_rate_back * 0.9 and recent_rate >= expected_rate_back * 1.1:
        print(f"  #{num}: 历史={early_rate:.1%} → 近50期={recent_rate:.1%} 近5期={recent5_rate:.1%} ⚡冷→热")

# 后区持续热门
print()
print("--- 后区持续热门 ---")
for num in range(1, 13):
    early_rate = early_back[num] / 161
    recent_rate = recent50_back[num] / 50
    recent5_rate = recent5_back[num] / 5
    if early_rate >= expected_rate_back * 1.1 and recent_rate >= expected_rate_back * 1.1:
        stability = "稳定" if recent5_rate >= recent_rate * 0.8 else "轻微降温"
        print(f"  #{num}: 历史={early_rate:.1%} → 近50期={recent_rate:.1%} 近5期={recent5_rate:.1%} 🔥持续热门({stability})")

# 后区热→冷
print()
print("--- 后区热号降温 ---")
for num in range(1, 13):
    early_rate = early_back[num] / 161
    recent_rate = recent50_back[num] / 50
    recent5_rate = recent5_back[num] / 5
    if early_rate >= expected_rate_back * 1.1 and recent_rate < expected_rate_back * 0.9:
        print(f"  #{num}: 历史={early_rate:.1%} → 近50期={recent_rate:.1%} 近5期={recent5_rate:.1%} ↓降温")

# ===== 区间分析 =====
print()
print("=" * 80)
print("【前区7区间频率对比】")
print("=" * 80)

zones = {
    1: "01-05", 2: "06-10", 3: "11-15", 4: "16-20", 
    5: "21-25", 6: "26-30", 7: "31-35"
}

for z, range_str in zones.items():
    start = (z-1)*5 + 1
    end = z*5
    early_total = sum(early_front[n] for n in range(start, end+1))
    recent50_total = sum(recent50_front[n] for n in range(start, end+1))
    recent10_total = sum(recent10_front[n] for n in range(start, end+1))
    recent5_total = sum(recent5_front[n] for n in range(start, end+1))
    
    early_pct = early_total / (161 * 5) * 100
    recent50_pct = recent50_total / (50 * 5) * 100
    recent10_pct = recent10_total / (10 * 5) * 100
    recent5_pct = recent5_total / (5 * 5) * 100
    
    trend = ""
    if recent5_pct > recent50_pct * 1.2:
        trend = "↗升温"
    elif recent5_pct < recent50_pct * 0.8:
        trend = "↓降温"
    else:
        trend = "→稳定"
    
    print(f"  区{z}({range_str}): 历史={early_pct:.1f}% 近50期={recent50_pct:.1f}% 近10期={recent10_pct:.1f}% 近5期={recent5_pct:.1f}% {trend}")

# ===== 重号分析 =====
print()
print("=" * 80)
print("【近10期重号率分析】")
print("=" * 80)

repeat_count_front = 0
repeat_count_back = 0
for i in range(len(all_data)-10, len(all_data)-1):
    prev = all_data[i]
    curr = all_data[i+1]
    front_repeat = len(set(prev['front']) & set(curr['front']))
    back_repeat = len(set(prev['back']) & set(curr['back']))
    repeat_count_front += front_repeat
    repeat_count_back += back_repeat

avg_front_repeat = repeat_count_front / 9
avg_back_repeat = repeat_count_back / 9
print(f"近10期前区平均重号数: {avg_front_repeat:.2f}/期 (期望约1.5个)")
print(f"近10期后区平均重号数: {avg_back_repeat:.2f}/期 (期望约0.33个)")

# ===== 连号分析 =====
print()
print("=" * 80)
print("【近50期连号分析】")
print("=" * 80)

consecutive_count = 0
for d in recent_50:
    sorted_front = sorted(d['front'])
    for i in range(len(sorted_front)-1):
        if sorted_front[i+1] - sorted_front[i] == 1:
            consecutive_count += 1

avg_consecutive = consecutive_count / 50
print(f"近50期平均连号对数: {avg_consecutive:.2f}/期")

# 最近10期逐期详情
print()
print("=" * 80)
print("【最近10期逐期详情】")
print("=" * 80)

for i in range(len(all_data)-10, len(all_data)):
    d = all_data[i]
    period = i + 1
    prev = all_data[i-1] if i > 0 else None
    front_repeat = len(set(prev['front']) & set(d['front'])) if prev else 0
    back_repeat = len(set(prev['back']) & set(d['back'])) if prev else 0
    sorted_front = sorted(d['front'])
    has_consecutive = any(sorted_front[j+1] - sorted_front[j] == 1 for j in range(len(sorted_front)-1))
    sum_front = sum(d['front'])
    sum_back = sum(d['back'])
    odd_count = sum(1 for n in d['front'] if n % 2 != 0)
    
    print(f"  第{period}期: 前区={d['front']} 后区={d['back']} "
          f"和值={sum_front} 奇偶={odd_count}:{5-odd_count} "
          f"前区重号={front_repeat} 后区重号={back_repeat} "
          f"连号={'有' if has_consecutive else '无'}")