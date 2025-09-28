import os
import sys
import json
import jwt
import uuid
import time
import hashlib
import csv
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, session, Response
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import secrets
from src.utils import get_data_path
from src.auth import (
    generate_csrf_token, validate_csrf_token, token_required, optional_token, 
    admin_required, limit_login_attempts, users, login_attempts, generate_auth_token,
    authenticate_user, update_user_login_info
)
from src.data_handler import load_agent_data, load_geojson_data



# 使用兼容打包路径的静态目录
app = Flask(__name__, static_folder=get_data_path('static'))
CORS(app, supports_credentials=True)

# 使用更安全且健壮的密钥生成方式（处理不可写目录等情况）
if not os.environ.get('SECRET_KEY'):
    try:
        # 如果环境变量中没有设置密钥，则尝试从.env文件读取
        if os.path.exists('.env'):
            try:
                with open('.env', 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.startswith('SECRET_KEY='):
                            os.environ['SECRET_KEY'] = line.strip().split('=', 1)[1].strip('\"\'')
                            break
            except Exception:
                pass

        # 若仍未得到，生成新密钥并尽量写入.env；写入失败时继续使用内存中的密钥
        if not os.environ.get('SECRET_KEY'):
            new_secret_key = secrets.token_hex(32)
            os.environ['SECRET_KEY'] = new_secret_key
            try:
                with open('.env', 'a+', encoding='utf-8') as f:
                    f.write(f'\nSECRET_KEY="{new_secret_key}"\n')
            except Exception:
                # 可能是目录不可写，忽略写入错误，继续使用环境变量中的密钥
                pass
    except Exception:
        # 兜底：仍然保证有密钥
        os.environ['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

# 配置密钥
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# 配置CSRF保护
app.config['WTF_CSRF_SECRET_KEY'] = os.environ.get('WTF_CSRF_SECRET_KEY', secrets.token_hex(16))

# 配置JSON编码，确保中文不会被转义为Unicode
app.config['JSON_AS_ASCII'] = False




# 路由：首页
@app.route('/')
def index():
    # 使用 Flask 内置的静态文件发送接口，自动基于 app.static_folder 定位
    return app.send_static_file('index.html')

# 路由：安全退出
@app.route('/api/logout', methods=['POST'])
@token_required
def logout(current_user, is_admin):
    data = request.get_json()
    
    # 验证CSRF令牌
    if app.config.get('CSRF_ENABLED', True):
        csrf_token = data.get('csrf_token')
        if not validate_csrf_token(csrf_token):
            app.logger.warning(f'退出时CSRF验证失败: 用户 {current_user}')
            return jsonify({'status': 'error', 'message': 'CSRF验证失败'}), 403
    
    # 在实际应用中，这里可以实现令牌黑名单
    # 例如将当前token添加到Redis黑名单，设置过期时间为token的剩余有效期
    # 这里简化处理，仅记录日志
    app.logger.info(f'用户安全退出: {current_user}')
    
    # 生成新的CSRF令牌供下次登录使用
    new_csrf_token = generate_csrf_token()
    
    return jsonify({
        'status': 'success',
        'message': '已安全退出',
        'csrf_token': new_csrf_token
    })

# 路由：获取CSRF令牌
@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    token = generate_csrf_token()
    return jsonify({
        'status': 'success',
        'csrf_token': token
    })

# 路由：登录
@app.route('/api/login', methods=['POST'])
@limit_login_attempts
def login():
    data = request.get_json()
    ip = request.remote_addr
    
    # 验证请求数据
    if not data:
        return jsonify({'status': 'error', 'message': '无效的请求数据'}), 400
    
    # 验证CSRF令牌（如果前端已实现）
    csrf_token = data.get('csrf_token')
    if app.config.get('CSRF_ENABLED', True) and not validate_csrf_token(csrf_token):
        app.logger.warning(f'CSRF验证失败: IP {ip}')
        return jsonify({'status': 'error', 'message': 'CSRF验证失败'}), 403
    
    # 验证用户名和密码
    if not data.get('username') or not data.get('password'):
        return jsonify({'status': 'error', 'message': '请提供用户名和密码'}), 400
    
    username = data.get('username')
    encrypted_password = data.get('password')
    
    # 记录登录尝试
    if ip not in login_attempts:
        login_attempts[ip] = {'attempts': 0, 'timestamp': time.time()}
    login_attempts[ip]['attempts'] += 1
    login_attempts[ip]['timestamp'] = time.time()
    
    # 验证用户和密码
    auth_success, auth_result = authenticate_user(username, encrypted_password)
    if not auth_success:
        app.logger.warning(f'登录失败: {auth_result} - 用户 {username} 来自IP {ip}')
        return jsonify({'status': 'error', 'message': auth_result}), 401
    
    user = auth_result
    
    # 登录成功，重置尝试次数并更新用户信息
    update_user_login_info(username, ip)
    
    # 生成认证令牌
    token = generate_auth_token(username)
    if not token:
        return jsonify({
            'status': 'error', 
            'message': '生成认证令牌失败',
            'csrf_token': generate_csrf_token()
        }), 500
    
    # 记录成功登录
    app.logger.info(f'登录成功: 用户 {username} 来自IP {ip}')
    
    # 返回新的CSRF令牌
    new_csrf_token = generate_csrf_token()
    
    # 记录登录成功的日志，包含加密方式信息
    app.logger.info(f'用户 {username} 使用增强加密方式成功登录，IP: {ip}')
    
    return jsonify({
        'status': 'success',
        'token': token,
        'is_admin': user['is_admin'],
        'csrf_token': new_csrf_token
    })

# 路由：获取所有县总代数据
@app.route('/api/agents', methods=['GET'])
@optional_token
def get_agents(current_user, is_admin):
    agents_data = load_agent_data()
    
    # 如果不是管理员，对数据进行脱敏处理
    if not is_admin:
        masked_agents_data = {}
        for province in agents_data:
            masked_agents_data[province] = {}
            for city in agents_data[province]:
                masked_agents_data[province][city] = {}
                for county in agents_data[province][city]:
                    county_data = agents_data[province][city][county]
                    # 复制县总代数据并进行脱敏
                    masked_county_data = county_data.copy()
                    if 'name' in masked_county_data and masked_county_data['name']:
                        # 只保留姓氏，其余用*替代
                        name = masked_county_data['name']
                        masked_county_data['name'] = name[0] + '*' * (len(name) - 1) if len(name) > 1 else name
                    
                    if 'phone' in masked_county_data and masked_county_data['phone']:
                        # 只保留手机号前3位，其余用*替代
                        phone = masked_county_data['phone']
                        masked_county_data['phone'] = phone[:3] + ' **** ****' if len(phone) >= 3 else phone
                    
                    masked_agents_data[province][city][county] = masked_county_data
        
        # 使用脱敏后的数据
        agents_data = masked_agents_data
    
    # 生成新的CSRF令牌
    new_csrf_token = generate_csrf_token()
    
    # 使用Flask的Response直接返回JSON，确保中文不被转义
    response_data = {
        'status': 'success',
        'data': agents_data,
        'is_admin': is_admin,
        'csrf_token': new_csrf_token
    }
    return Response(
        json.dumps(response_data, ensure_ascii=False),
        mimetype='application/json'
    )

# 路由：获取单个县信息
@app.route('/api/county/<county_name>', methods=['GET'])
@optional_token
def get_county(current_user, is_admin, county_name):
    try:
        from src.data_handler import get_county_info
        county_info = get_county_info(county_name)
        
        if county_info:
            agent_name = county_info['agent_name']
            agent_phone = county_info['agent_phone']
            
            # 如果不是管理员，对数据进行脱敏处理
            if not is_admin:
                if agent_name:
                    # 只保留姓氏，其余用*替代
                    agent_name = agent_name[0] + '*' * (len(agent_name) - 1) if len(agent_name) > 1 else agent_name
                
                if agent_phone:
                    # 只保留手机号前3位，其余用*替代
                    agent_phone = agent_phone[:3] + ' **** ****' if len(agent_phone) >= 3 else agent_phone
            
            # 使用Flask的Response直接返回JSON，确保中文不被转义
            response_data = {
                'status': 'success',
                'data': {
                    'name': county_name,
                    'agent_name': agent_name,
                    'agent_phone': agent_phone,
                    'has_agent': county_info['has_agent']
                },
                'is_admin': is_admin,
                'csrf_token': generate_csrf_token()
            }
            return Response(
                json.dumps(response_data, ensure_ascii=False),
                mimetype='application/json'
            )
        
        error_data = {
            'status': 'error',
            'message': f'未找到县: {county_name}',
            'csrf_token': generate_csrf_token()
        }
        return Response(
            json.dumps(error_data, ensure_ascii=False),
            mimetype='application/json',
            status=404
        )

    except Exception as e:
        error_data = {
            'status': 'error',
            'message': f'获取县信息失败: {str(e)}',
            'csrf_token': generate_csrf_token()
        }
        return Response(
            json.dumps(error_data, ensure_ascii=False),
            mimetype='application/json',
            status=500
        )

# 新增：删除县总代数据（需要管理员权限）
@app.route('/api/county/<string:county_name>', methods=['DELETE'])
@token_required
@admin_required
def delete_county(current_user, is_admin, county_name):
    data = request.get_json()

    # 验证CSRF令牌
    if app.config.get('CSRF_ENABLED', True):
        csrf_token = data.get('csrf_token')
        if not validate_csrf_token(csrf_token):
            app.logger.warning(f'删除县总代数据时CSRF验证失败: 用户 {current_user}')
            return jsonify({
                'status': 'error',
                'message': 'CSRF验证失败',
                'csrf_token': generate_csrf_token()
            }), 403

    try:
        from src.data_handler import delete_county_data
        deleted = delete_county_data(county_name)
        
        if deleted:
            return jsonify({
                'status': 'success',
                'message': f'已成功删除县: {county_name}',
                'csrf_token': generate_csrf_token()
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f'未找到要删除的县: {county_name}',
                'csrf_token': generate_csrf_token()
            }), 404

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'删除县信息失败: {str(e)}',
            'csrf_token': generate_csrf_token()
        }), 500

# 新增：添加新的县总代数据（需要管理员权限）
@app.route('/api/county', methods=['POST'])
@token_required
@admin_required
def add_county(current_user, is_admin):
    data = request.get_json()

    # 验证CSRF令牌
    if app.config.get('CSRF_ENABLED', True):
        csrf_token = data.get('csrf_token')
        if not validate_csrf_token(csrf_token):
            app.logger.warning(f'添加县总代数据时CSRF验证失败: 用户 {current_user}')
            return jsonify({
                'status': 'error',
                'message': 'CSRF验证失败',
                'csrf_token': generate_csrf_token()
            }), 403

    # 验证输入数据
    required_fields = ['province', 'city', 'county', 'agent_name', 'agent_phone']
    if not all(field in data for field in required_fields):
        return jsonify({
            'status': 'error',
            'message': '缺少必要的字段',
            'csrf_token': generate_csrf_token()
        }), 400

    province = data['province'] if data['province'] else '未知省份'
    city = data['city'] if data['city'] else '未知城市'
    county = data['county'] if data['county'] else '未知县'
    agent_name = data['agent_name']
    agent_phone = data['agent_phone']
    gdp = data.get('gdp', '')  # 获取GDP，默认为空
    population = data.get('population', '')  # 获取人口，默认为空

    # 检查省+市+县是否已存在
    agents_data = load_agent_data()
    if province in agents_data and city in agents_data[province] and county in agents_data[province][city]:
        existing_agent = agents_data[province][city][county]['name']
        if existing_agent:
            return jsonify({
                'status': 'error',
                'message': '当前县已有总代，禁止添加',
                'csrf_token': generate_csrf_token()
            }), 400

    try:
        # 记录操作日志
        app.logger.info(f'用户 {current_user} 正在添加新的县总代数据: {province}-{city}-{county}')

        # 使用数据处理模块添加数据
        from src.data_handler import add_county_data
        add_county_data(province, city, county, agent_name, agent_phone, gdp, population)

        # 返回成功响应
        return jsonify({
            'status': 'success',
            'message': '县总代数据添加成功',
            'csrf_token': generate_csrf_token()
        }), 201

    except Exception as e:
        app.logger.error(f'添加县总代数据时出错: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'添加县总代数据失败: {str(e)}',
            'csrf_token': generate_csrf_token()
        }), 500

# 路由：更新县总代信息（需要管理员权限）
@app.route('/api/county/<county_name>', methods=['PUT'])
@token_required
@admin_required
def update_county(current_user, is_admin, county_name):
    data = request.get_json()
    
    # 验证CSRF令牌
    if app.config.get('CSRF_ENABLED', True):
        csrf_token = data.get('csrf_token')
        if not validate_csrf_token(csrf_token):
            app.logger.warning(f'更新县总代信息时CSRF验证失败: 用户 {current_user}, 县 {county_name}')
            return jsonify({
                'status': 'error',
                'message': 'CSRF验证失败',
                'csrf_token': generate_csrf_token()
            }), 403
    
    if not data or not data.get('agent_name') or not data.get('agent_phone'):
        return jsonify({
            'status': 'error',
            'message': '请提供县总代姓名和电话',
            'csrf_token': generate_csrf_token()
        }), 400
    
    # 获取新的省、市、县信息
    new_province = data.get('province', '').strip()
    new_city = data.get('city', '').strip()
    new_county = data.get('county', '').strip()
    new_agent_name = data.get('agent_name', '').strip()
    new_agent_phone = data.get('agent_phone', '').strip()
    
    # 验证必要字段
    if not new_agent_name or not new_agent_phone:
        return jsonify({
            'status': 'error',
            'message': '请提供县总代姓名和电话',
            'csrf_token': generate_csrf_token()
        }), 400
    
    # 如果提供了新的省、市、县信息，则进行重复检查
    if new_province and new_city and new_county:
        # 检查是否与当前正在更新的县相同（允许更新当前县的信息）
        if new_county != county_name or new_province != data.get('old_province', '') or new_city != data.get('old_city', ''):
            # 检查新的省+市+县是否已存在
            agents_data = load_agent_data()
            if new_province in agents_data and new_city in agents_data[new_province] and new_county in agents_data[new_province][new_city]:
                existing_agent = agents_data[new_province][new_city][new_county]['name']
                if existing_agent:
                    return jsonify({
                        'status': 'error',
                        'message': '当前县已有总代，禁止编辑',
                        'csrf_token': generate_csrf_token()
                    }), 400
    
    try:
        app.logger.info(f'用户 {current_user} 正在更新县 {county_name} 的总代信息')
        
        # 使用数据处理模块更新数据
        from src.data_handler import update_county_data
        update_county_data(county_name, new_province, new_city, new_county, new_agent_name, new_agent_phone)
        
        new_csrf_token = generate_csrf_token()
        
        return jsonify({
            'status': 'success',
            'message': '更新成功',
            'csrf_token': new_csrf_token
        })
    except Exception as e:
        app.logger.error(f'更新县总代信息失败: 用户 {current_user}, 县 {county_name}, 错误: {str(e)}')
        
        return jsonify({
            'status': 'error',
            'message': f'更新县总代信息失败: {str(e)}',
            'csrf_token': generate_csrf_token()
        }), 500


# 路由：提供GeoJSON数据
@app.route('/api/geojson', methods=['GET'])
def get_geojson():
    try:
        # 使用数据处理模块加载GeoJSON数据
        geojson_data = load_geojson_data()
        
        # GeoJSON数据本身已经包含了GB代码，直接返回即可
        # 在响应头中添加CSRF令牌
        response = jsonify(geojson_data)
        response.headers['X-CSRF-Token'] = generate_csrf_token()
        return response
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'加载GeoJSON数据失败: {str(e)}',
            'csrf_token': generate_csrf_token()
        }), 500

if __name__ == '__main__':
    try:
        # 确保外部数据文件存在
        from utils.pack_utils import ensure_external_data_exists
        ensure_external_data_exists()
        # 配置SSL上下文以启用HTTPS
        ssl_context = (get_data_path('cert.pem'), get_data_path('key.pem'))
        app.run(debug=True, host='0.0.0.0', port=5000, ssl_context=ssl_context)
    except Exception as e:
        # 在打包环境下，控制台可能被隐藏，写一份启动异常到日志文件
        try:
            base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
            log_file = os.path.join(base_dir, 'startup_error.log')
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{datetime.now().isoformat()}] 启动异常: {repr(e)}\n")
        except Exception:
            pass
        # 仍然抛出以便在控制台可见
        raise