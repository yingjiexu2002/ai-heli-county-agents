#!/usr/bin/env python3
"""
Excel数据转换为CSV格式脚本
用于将县级代理Excel数据转换为CSV格式
"""

import openpyxl
import csv
import os
import sys

EXCEL_FILE = '/Users/bytedance/python_src/ai-heli-v3/data/爱河里数据_地址拆分.xlsx'
OUTPUT_DIR = '/Users/bytedance/python_src/ai-heli-v3/data'


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
            row_data = []
            for cell in row:
                row_data.append(cell.value)
            data.append(row_data)
        
        print(f"成功读取Excel文件，共{len(data)}行数据")
        return data, headers
    except Exception as e:
        print(f"读取Excel文件失败：{e}")
        return None, None


def save_to_csv(data, headers, output_file):
    """保存数据到CSV文件"""
    try:
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            # 写入表头
            writer.writerow(headers)
            # 写入数据行
            writer.writerows(data)
        
        print(f"成功保存数据到CSV文件: {output_file}")
        print(f"共保存{len(data)}行数据")
        return True
    except Exception as e:
        print(f"保存CSV文件失败：{e}")
        return False


def main():
    print("==== 爱河狸县级代理Excel转CSV工具 ====")
    print(f"\n从Excel文件转换数据：{EXCEL_FILE}")
    
    # 读取Excel数据
    data, headers = read_excel_data(EXCEL_FILE)
    if data is None or headers is None:
        print("程序终止")
        sys.exit(1)
    
    # 显示数据预览
    print("\n数据预览（前5行）：")
    print("表头:", headers)
    for i in range(min(5, len(data))):
        print(f"第{i+1}行: {data[i]}")
    
    # 生成输出文件名
    base_name = os.path.splitext(os.path.basename(EXCEL_FILE))[0]
    output_file = os.path.join(OUTPUT_DIR, f"{base_name}.csv")
    
    # 保存为CSV
    if save_to_csv(data, headers, output_file):
        print("\n转换完成！")
        print(f"CSV文件已保存到: {output_file}")
    else:
        print("\n转换失败！")


if __name__ == '__main__':
    main()