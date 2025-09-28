import csv
import json
import os
from src.utils import get_data_path


def load_agent_data():
    """加载县总代数据"""
    agents_data = {}
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    gb_code_path = get_data_path('data/china_administrative_divisions_nested_2024.json')
    
    # 加载GB代码数据
    gb_codes = {}
    try:
        with open(gb_code_path, 'r', encoding='utf-8') as f:
            gb_codes = json.load(f)
    except Exception as e:
        print(f'加载GB代码数据失败: {str(e)}')
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader)  # Skip header
            except StopIteration:
                return {} # Empty file

            # Assuming column order: 县总代, 联系电话, 省份, 城市, 县名, ...
            for row in reader:
                if not row or len(row) < 1:
                    continue

                agent_name = row[0].strip() if len(row) > 0 and row[0].strip() else ''
                phone = row[1].strip() if len(row) > 1 and row[1].strip() else ''
                province = row[2].strip() if len(row) > 2 and row[2].strip() else ''
                city = row[3].strip() if len(row) > 3 and row[3].strip() else ''
                county = row[4].strip() if len(row) > 4 and row[4].strip() else ''

                # 跳过完全没有姓名的数据
                if not agent_name:
                    continue

                if not county:
                    county = '未知'
                
                # 如果省份为空，使用"未知省份"
                if not province:
                    province = '未知'
                
                # 如果城市为空
                if not city:
                    city = '未知'

                if province not in agents_data:
                    agents_data[province] = {}
                
                if city not in agents_data[province]:
                    agents_data[province][city] = {}
                
                # 检查是否已存在相同省市县的数据，如果存在则记录日志提示数据覆盖
                if county in agents_data[province][city]:
                    existing_agent = agents_data[province][city][county]['name']
                    print(f'数据覆盖警告: 省份[{province}] 城市[{city}] 县[{county}] 的县总代数据从 [{existing_agent}] 被覆盖为 [{agent_name}]')
                
                # 查找GB代码
                gb_code = None
                if province in gb_codes and city in gb_codes[province] and county in gb_codes[province][city]:
                    gb_code = gb_codes[province][city][county]
                
                # 只要有姓名就算有县总代，包括只有姓名没有电话的情况
                agents_data[province][city][county] = {
                    'name': agent_name,
                    'phone': phone,
                    'has_agent': bool(agent_name),
                    'gb_code': gb_code
                }

    except FileNotFoundError:
        print(f"警告: 代理数据文件 {csv_path} 未找到。将创建一个空文件。")
        try:
            os.makedirs(os.path.dirname(csv_path), exist_ok=True)
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['县总代', '联系电话', '省份', '城市', '县名', 'GDP', '人口'])
        except Exception as e:
            print(f"创建代理数据文件 {csv_path} 失败: {e}")
        return {}
    except Exception as e:
        print(f"从CSV加载代理数据时出错: {e}")
        return {}
    
    return agents_data


def get_county_info(county_name):
    """获取单个县信息"""
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader) # skip header
            
            try:
                name_col = header.index('县总代')
                phone_col = header.index('联系电话')
                county_col = header.index('县名')
            except ValueError:
                # Fallback to hardcoded indices
                name_col, phone_col, county_col = 0, 1, 4

            for row in reader:
                if len(row) > county_col and row[county_col].strip() == county_name:
                    agent_name = row[name_col].strip() if len(row) > name_col and row[name_col].strip() else ''
                    agent_phone = row[phone_col].strip() if len(row) > phone_col and row[phone_col].strip() else ''
                    
                    return {
                        'name': county_name,
                        'agent_name': agent_name,
                        'agent_phone': agent_phone,
                        'has_agent': bool(agent_name)  # 只要有姓名就算有县总代
                    }
        
        return None

    except FileNotFoundError:
        raise Exception(f'代理数据文件不存在')
    except Exception as e:
        raise Exception(f'获取县信息失败: {str(e)}')


def add_county_data(province, city, county, agent_name, agent_phone, gdp='', population=''):
    """添加新的县总代数据"""
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    new_row = [agent_name, agent_phone, province, city, county, gdp, population]

    # 将新数据追加到CSV文件
    with open(csv_path, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(new_row)


def update_county_data(county_name, new_province, new_city, new_county, new_agent_name, new_agent_phone):
    """更新县总代信息"""
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    
    rows = []
    county_found = False
    
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        rows.append(header)
        
        try:
            name_col = header.index('县总代')
            phone_col = header.index('联系电话')
            county_col = header.index('县名')
            province_col = header.index('省份')
            city_col = header.index('城市')
        except ValueError:
            name_col, phone_col, county_col = 0, 1, 4
            province_col, city_col = 2, 3

        for row in reader:
            if len(row) > county_col and row[county_col].strip() == county_name:
                # 更新信息
                row[name_col] = new_agent_name
                row[phone_col] = new_agent_phone
                
                # 如果提供了新的省、市、县信息，则更新
                if new_province:
                    row[province_col] = new_province
                if new_city:
                    row[city_col] = new_city
                if new_county:
                    row[county_col] = new_county
                
                county_found = True
            rows.append(row)

    if not county_found:
        # 如果没有找到县，则添加新的记录
        province = new_province if new_province else '未知省份'
        city = new_city if new_city else '未知城市'
        county = new_county if new_county else county_name
        new_row = [new_agent_name, new_agent_phone, province, city, county, '', '']
        rows.append(new_row)

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(rows)


def delete_county_data(county_name):
    """删除县总代数据"""
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    temp_csv_path = csv_path + '.tmp'
    deleted = False

    with open(csv_path, 'r', encoding='utf-8') as infile, open(temp_csv_path, 'w', newline='', encoding='utf-8') as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)

        header = next(reader)
        writer.writerow(header)

        try:
            county_col = header.index('县名')
        except ValueError:
            county_col = 4 # Fallback

        for row in reader:
            if len(row) > county_col and row[county_col].strip() == county_name:
                deleted = True
            else:
                writer.writerow(row)

    if deleted:
        os.replace(temp_csv_path, csv_path)
        return True
    else:
        if os.path.exists(temp_csv_path):
            os.remove(temp_csv_path)
        return False


def load_geojson_data():
    """加载GeoJSON数据"""
    try:
        # 加载GeoJSON数据
        with open(get_data_path('data/中国_县.geojson'), 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        return geojson_data
    except Exception as e:
        raise Exception(f'加载GeoJSON数据失败: {str(e)}')