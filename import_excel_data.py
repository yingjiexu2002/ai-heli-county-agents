#!/usr/bin/env python3
"""
Excel数据导入脚本
用于从Excel文件导入县级代理数据到JSON文件
"""

import openpyxl
import json
import os
import sys

EXCEL_FILE = '/Users/bytedance/python_src/ai-heli/爱河里数据_地址拆分.xlsx'
OUTPUT_FILE = 'agents_data.json'


def read_excel_data(file_path):
    """读取Excel文件数据"""
    try:
        # 读取Excel文件
        workbook = openpyxl.load_workbook(file_path, read_only=True)
        sheet = workbook.active
        
        # 获取所有数据
        data = []
        headers = []
        
        # 读取第一行作为列名
        for cell in sheet[1]:
            headers.append(cell.value)
        
        # 读取其余行数据
        for row in sheet.iter_rows(min_row=2):
            row_data = {}
            for i, cell in enumerate(row):
                if i < len(headers):
                    row_data[headers[i]] = cell.value
            data.append(row_data)
        
        print(f"成功读取Excel文件，共{len(data)}行数据")
        
        # 显示前5行数据，帮助理解数据结构
        print("\n数据预览：")
        for i in range(min(5, len(data))):
            print(f"第{i+1}行: {data[i]}")
        
        # 显示所有列名，帮助识别需要的列
        print("\n列名列表：")
        for col in headers:
            print(f"- {col}")
        
        return data, headers
    except Exception as e:
        print(f"读取Excel文件失败：{e}")
        return None, None


def transform_data(data, headers):
    """将Excel数据转换为agents_data.json格式"""
    agents_data = {}
    
    # 尝试识别县级名称列和代理信息列
    county_column = None
    agent_name_column = None
    phone_column = None
    email_column = None
    address_column = None
    notes_column = None
    gdp_column = None
    population_column = None
    province_column = None
    city_column = None
    
    # 首先专门查找'县'列，确保优先选择
    for col in headers:
        if col is None:
            continue
        col_lower = str(col).lower()
        if '县' in col_lower:
            county_column = col
            break
    
    # 如果没有找到'县'列，再查找'区'或'市'
    if not county_column:
        for col in headers:
            if col is None:
                continue
            col_lower = str(col).lower()
            if '区' in col_lower or '市' in col_lower:
                county_column = col
                break
    
    # 查找其他列
    for col in headers:
        if col is None:
            continue
        col_lower = str(col).lower()
        if '省' in col_lower and not province_column:
            province_column = col
        elif '市' in col_lower and not city_column:
            city_column = col
        elif ('代理' in col_lower or '负责人' in col_lower or '名字' in col_lower) and not agent_name_column:
            agent_name_column = col
        # 特别处理电话号码列 - 检查列名中是否有'phone'或'电话'或'手机'
        # 或者检查是否有包含数字的列（可能是电话号码）
        if not phone_column:
            if ('手机' in col_lower or '电话' in col_lower or 'phone' in col_lower):
                phone_column = col
            # 检查是否是'Unnamed: 3'列（根据数据预览，这可能是电话号码列）
            elif str(col) == 'Unnamed: 3':
                phone_column = col
        if '邮箱' in col_lower and not email_column:
            email_column = col
        elif ('地址' in col_lower or '联系地址' in col_lower) and not address_column:
            address_column = col
        elif ('备注' in col_lower or '说明' in col_lower) and not notes_column:
            notes_column = col
        elif ('gdp' in col_lower or '地区生产总值' in col_lower) and not gdp_column:
            gdp_column = col
        elif ('人口' in col_lower or '人口数' in col_lower) and not population_column:
            population_column = col
    
    # 显示识别的列名
    print("\n识别的列名：")
    print(f"- 省级名称列：{province_column}")
    print(f"- 市级名称列：{city_column}")
    print(f"- 县级名称列：{county_column}")
    print(f"- 代理姓名列：{agent_name_column}")
    print(f"- 电话列：{phone_column}")

    print(f"- GDP列：{gdp_column}")
    print(f"- 人口列：{population_column}")
    
    # 如果没有找到必要的列，请求用户输入
    if not county_column or not agent_name_column or not phone_column:
        print("\n无法自动识别所有必要的列名，请手动指定：")
        
        if not county_column:
            county_column = input("请输入包含县级名称的列名：")
        
        if not agent_name_column:
            agent_name_column = input("请输入包含代理姓名的列名：")
        
        if not phone_column:
            phone_column = input("请输入包含电话号码的列名：")
            
    # 如果没有找到GDP和人口列，尝试请求用户输入
    if not gdp_column:
        try:
            gdp_input = input("请输入包含GDP数据的列名（直接回车跳过）：")
            if gdp_input.strip():
                gdp_column = gdp_input
        except:
            pass
    
    if not population_column:
        try:
            pop_input = input("请输入包含人口数据的列名（直接回车跳过）：")
            if pop_input.strip():
                population_column = pop_input
        except:
            pass
    
    # 转换数据
    for row in data:
        # 获取县级名称
        county_name = row.get(county_column, '')
        if not county_name or str(county_name).lower() == 'nan':
            continue
        county_name = str(county_name).strip()
        
        # 构建代理信息
        agent_info = {
            'agent_name': str(row.get(agent_name_column, '')).strip(),
            'phone': str(row.get(phone_column, '')).strip(),
            'province': str(row.get(province_column, '')).strip() if province_column else '',
            'city': str(row.get(city_column, '')).strip() if city_column else '',
            'gdp': str(row.get(gdp_column, '')).strip() if gdp_column else '',
            'population': str(row.get(population_column, '')).strip() if population_column else ''
        }
        
        # 去除nan值和None值
        for key, value in agent_info.items():
            if isinstance(value, str) and (value.lower() == 'nan' or value == 'None'):
                agent_info[key] = ''
        
        # 添加到结果中
        agents_data[county_name] = agent_info
    
    return agents_data


def merge_with_existing_data(new_data):
    """将新数据与现有数据合并"""
    # 检查是否存在现有数据
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            
            print(f"\n发现现有数据，共{len(existing_data)}条记录")
            
            # 询问用户是替换还是合并
            choice = input("请选择：1. 替换现有数据 2. 合并新数据到现有数据（默认）: ")
            
            if choice.strip() == '1':
                print("选择替换现有数据")
                return new_data
            else:
                print("选择合并新数据到现有数据")
                # 合并数据（新数据覆盖旧数据）
                merged_data = existing_data.copy()
                merged_data.update(new_data)
                return merged_data
        except Exception as e:
            print(f"读取现有数据失败：{e}")
            print("将使用新数据创建文件")
            return new_data
    else:
        print("\n未发现现有数据，将创建新文件")
        return new_data


def save_to_json(data):
    """保存数据到JSON文件"""
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"\n成功保存{len(data)}条代理数据到{OUTPUT_FILE}")
        return True
    except Exception as e:
        print(f"保存数据失败：{e}")
        return False


def main():
    print("==== 爱河狸县级代理数据导入工具 ====")
    print(f"\n从Excel文件导入数据：{EXCEL_FILE}")
    
    # 读取Excel数据
    data, headers = read_excel_data(EXCEL_FILE)
    if data is None or headers is None:
        print("程序终止")
        sys.exit(1)
    
    # 转换数据格式
    new_data = transform_data(data, headers)
    print(f"\n成功转换{len(new_data)}条县级代理数据")
    
    # 合并现有数据
    final_data = merge_with_existing_data(new_data)
    
    # 保存数据
    if save_to_json(final_data):
        print("\n导入完成！")
        print(f"请重启Flask应用以查看更新后的代理分布地图")
    else:
        print("\n导入失败！")


if __name__ == '__main__':
    main()