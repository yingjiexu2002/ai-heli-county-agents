import requests
from bs4 import BeautifulSoup
import json
import time

def get_administrative_divisions_nested():
    """
    爬取最新的行政区划代码并生成嵌套格式的JSON。
    """
    # 目标网页URL
    url = "https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html"
    
    # 设置请求头，模拟浏览器访问
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    print(f"正在从 {url} 获取数据...")

    try:
        # 发送HTTP GET请求
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
    except requests.exceptions.RequestException as e:
        print(f"错误：无法获取网页内容。 {e}")
        return None

    # 使用BeautifulSoup解析HTML
    soup = BeautifulSoup(response.text, 'html.parser')

    # --- 第一遍处理：构建代码到名称的映射 (此部分逻辑不变) ---
    code_to_name = {}
    table = soup.find('table')
    if not table:
        print("错误：在页面上未找到数据表格。")
        return None
        
    rows = table.find_all('tr')
    print(f"找到 {len(rows)} 行数据，开始解析...")

    for row in rows:
        cols = row.find_all('td')
        if len(cols) >= 3:
            code = cols[1].text.strip()
            name = cols[2].text.strip()
            if code.isdigit():
                code_to_name[code] = name

    if not code_to_name:
        print("错误：未能从表格中解析出任何有效数据。")
        return None

    # --- 第二遍处理：构建嵌套的JSON结构 (此部分逻辑已更新) ---
    result_json = {}
    
    for code, name in code_to_name.items():
        # 筛选出县级单位
        if not code.endswith('00') or (code.endswith('00') and len(code) > 4 and code[4] != '0'):
            province_code = code[:2] + '0000'
            city_code = code[:4] + '00'
            
            province_name = code_to_name.get(province_code)
            city_name = code_to_name.get(city_code)
            
            if not province_name:
                continue

            # 处理直辖市和省直辖县/市 (逻辑不变)
            if province_name in ["北京市", "上海市", "天津市", "重庆市"]:
                city_name = province_name
            elif not city_name:
                city_name = name

            # === 修改核心：创建嵌套字典 ===
            # setdefault(key, {}) 会获取key对应的字典，如果不存在，则创建一个空字典并返回
            # 这样可以优雅地实现三级嵌套赋值
            # === 修改核心：在赋值时为code加上"156"前缀 ===
            # 使用 f-string 格式化字符串
            prefixed_code = f"156{code}"
            result_json.setdefault(province_name, {}).setdefault(city_name, {})[name] = prefixed_code
            
    print("数据解析完成！")
    return result_json

if __name__ == '__main__':
    start_time = time.time()
    
    # 执行主函数
    divisions_data = get_administrative_divisions_nested()
    
    if divisions_data:
        output_filename = 'china_administrative_divisions_nested_2024.json'
        
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(divisions_data, f, ensure_ascii=False, indent=4)
        
        # --- 新增功能：计算并输出总数 ---
        # 使用列表推导式遍历二级字典（市）和三级字典（县），然后计算总和
        total_count = sum(len(counties) for cities in divisions_data.values() for counties in cities.values())
        
        end_time = time.time()
        
        print(f"\n成功！数据已保存到文件：{output_filename}")
        # 输出最终的计数结果
        print(f"共生成 {total_count} 条县级行政区划代码记录。")
        print(f"总耗时: {end_time - start_time:.2f} 秒。")