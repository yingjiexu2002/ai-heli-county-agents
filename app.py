import os
import json
import jwt
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='static')
CORS(app)

# 配置密钥
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_secret_key')

# 模拟用户数据库
users = {
    'admin': {
        'password': generate_password_hash('123456'),
        'is_admin': True
    }
}

# 加载县总代数据
def load_agent_data():
    try:
        # 从JSON文件读取县总代数据
        with open('agents_data.json', 'r', encoding='utf-8') as f:
            raw_agents_data = json.load(f)
        
        # 初始化数据结构
        agents_data = {}
        
        # 处理数据
        for county, info in raw_agents_data.items():
            province = info.get('province', '')
            city = info.get('city', '')
            agent_name = info.get('agent_name', '')
            phone = info.get('phone', '')
            
            # 确保省市县都有值
            if province and county:
                # 创建嵌套字典结构
                if province not in agents_data:
                    agents_data[province] = {}
                
                if city and city not in agents_data[province]:
                    agents_data[province][city] = {}
                
                # 添加县级代理信息
                if city:
                    if county not in agents_data[province][city]:
                        agents_data[province][city][county] = {
                            'name': agent_name,
                            'phone': phone,
                            'has_agent': bool(agent_name)
                        }
                else:
                    if county not in agents_data[province]:
                        agents_data[province][county] = {
                            'name': agent_name,
                            'phone': phone,
                            'has_agent': bool(agent_name)
                        }
        
        return agents_data
    except Exception as e:
        print(f"加载代理数据时出错: {e}")
        return {}

# 验证Token的装饰器
def token_required(f):
    def decorated(*args, **kwargs):
        token = None
        
        # 从请求头中获取token
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'status': 'error', 'message': '缺少认证令牌'}), 401
        
        try:
            # 解码token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['username']
            is_admin = users.get(current_user, {}).get('is_admin', False)
        except:
            return jsonify({'status': 'error', 'message': '无效的令牌'}), 401
        
        # 将用户信息传递给被装饰的函数
        return f(current_user, is_admin, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

# 验证管理员权限的装饰器
def admin_required(f):
    def decorated(current_user, is_admin, *args, **kwargs):
        if not is_admin:
            return jsonify({'status': 'error', 'message': '需要管理员权限'}), 403
        return f(current_user, is_admin, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

# 路由：首页
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# 路由：登录
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'status': 'error', 'message': '请提供用户名和密码'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    user = users.get(username)
    
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'status': 'error', 'message': '用户名或密码错误'}), 401
    
    # 生成token
    token = jwt.encode({
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'status': 'success',
        'token': token,
        'is_admin': user['is_admin']
    })

# 路由：获取所有县总代数据
@app.route('/api/agents', methods=['GET'])
def get_agents():
    agents_data = load_agent_data()
    return jsonify({
        'status': 'success',
        'data': agents_data
    })

# 路由：获取单个县信息
@app.route('/api/county/<county_name>', methods=['GET'])
def get_county(county_name):
    try:
        # 直接从JSON文件读取县总代数据
        with open('agents_data.json', 'r', encoding='utf-8') as f:
            raw_agents_data = json.load(f)
        
        # 检查县名是否存在
        if county_name in raw_agents_data:
            county_info = raw_agents_data[county_name]
            return jsonify({
                'status': 'success',
                'data': {
                    'name': county_name,
                    'agent_name': county_info.get('agent_name', ''),
                    'agent_phone': county_info.get('phone', ''),
                    'has_agent': bool(county_info.get('agent_name', ''))
                }
            })
        
        # 如果在agents_data.json中找不到，尝试使用原来的方法在结构化数据中查找
        agents_data = load_agent_data()
        for province, cities in agents_data.items():
            for city, counties in cities.items():
                if county_name in counties:
                    return jsonify({
                        'status': 'success',
                        'data': {
                            'name': county_name,
                            'agent_name': counties[county_name]['name'],
                            'agent_phone': counties[county_name]['phone'],
                            'has_agent': counties[county_name]['has_agent']
                        }
                    })
        
        return jsonify({
            'status': 'error',
            'message': f'未找到县: {county_name}'
        }), 404
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'获取县信息失败: {str(e)}'
        }), 500

# 路由：更新县总代信息（需要管理员权限）
@app.route('/api/county/<county_name>', methods=['PUT'])
@token_required
@admin_required
def update_county(current_user, is_admin, county_name):
    data = request.get_json()
    
    if not data or not data.get('agent_name') or not data.get('agent_phone'):
        return jsonify({
            'status': 'error',
            'message': '请提供县总代姓名和电话'
        }), 400
    
    try:
        # 读取当前JSON文件
        with open('agents_data.json', 'r', encoding='utf-8') as f:
            agents_data = json.load(f)
        
        # 检查县名是否存在
        if county_name in agents_data:
            # 更新县总代信息
            agents_data[county_name]['agent_name'] = data.get('agent_name')
            agents_data[county_name]['phone'] = data.get('agent_phone')
        else:
            # 如果县不存在，创建新记录
            agents_data[county_name] = {
                'agent_name': data.get('agent_name'),
                'phone': data.get('agent_phone'),
                'province': data.get('province', ''),
                'city': data.get('city', ''),
                'gdp': '',
                'population': ''
            }
        
        # 写入更新后的数据
        with open('agents_data.json', 'w', encoding='utf-8') as f:
            json.dump(agents_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'status': 'success',
            'message': '更新成功'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'更新县总代信息失败: {str(e)}'
        }), 500

# 路由：提供GeoJSON数据
@app.route('/api/geojson', methods=['GET'])
def get_geojson():
    try:
        with open('中国_县.geojson', 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        return jsonify(geojson_data)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'加载GeoJSON数据失败: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)