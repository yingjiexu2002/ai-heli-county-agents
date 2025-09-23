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

# 添加这个函数来获取正确的资源路径（优先外部，其次打包内部，最后项目目录）
def get_data_path(relative_path):
    """获取资源文件的路径，优先使用exe所在目录下的外部文件，否则退回到PyInstaller打包内资源，再否则使用项目目录。

    示例：get_data_path('data/中国_县.geojson') 或 get_data_path('cert.pem')
    """
    # 首先检查exe所在目录
    try:
        base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    except Exception:
        base_dir = os.path.abspath('.')

    external_path = os.path.join(base_dir, relative_path)
    if os.path.exists(external_path):
        # 调试提示：优先使用外部资源
        try:
            app.logger.debug(f"使用外部资源路径: {external_path}")
        except Exception:
            pass
        return external_path

    # 如果外部文件不存在，则使用打包内的资源
    try:
        # pylint: disable=protected-access,no-member
        base_path = sys._MEIPASS  # PyInstaller临时目录
        internal_path = os.path.join(base_path, relative_path)
        if os.path.exists(internal_path):
            try:
                app.logger.debug(f"使用打包内资源路径: {internal_path}")
            except Exception:
                pass
            return internal_path
    except Exception:
        pass

    # 不是通过PyInstaller运行或内部资源不存在时，使用项目目录
    fallback = os.path.join(os.path.abspath('.'), relative_path)
    try:
        app.logger.debug(f"使用项目目录路径: {fallback}")
    except Exception:
        pass
    return fallback

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

# 登录尝试限制
login_attempts = {}
MAX_ATTEMPTS = 5
ATTEMPT_TIMEOUT = 300  # 5分钟

# 模拟用户数据库 - 使用更安全的密码哈希方法
# 注意：为了与前端加密流程匹配，我们需要存储密码+salt的SHA256哈希值
import hashlib
salt = "aiheliSalt2023"
salted_password = "123456" + salt
hashed_salted_password = hashlib.sha256(salted_password.encode('utf-8')).hexdigest()

users = {
    'admin': {
        # 使用更强的哈希算法和随机盐值
        'password': generate_password_hash(hashed_salted_password, method='pbkdf2:sha256:150000'),
        'is_admin': True,
        'last_login': None,
        'login_attempts': 0
    }
}

# 注意：get_data_path 已上移到文件顶部，避免重复定义

# 生成CSRF令牌
def generate_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

# 验证CSRF令牌
def validate_csrf_token(token):
    return token and 'csrf_token' in session and token == session['csrf_token']

# 加载县总代数据
def load_agent_data():
    agents_data = {}
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # print(f"读取文件 {csv_path}，共 {sum(1 for row in reader)} 行数据")
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
                
                # 只要有姓名就算有县总代，包括只有姓名没有电话的情况
                agents_data[province][city][county] = {
                    'name': agent_name,
                    'phone': phone,
                    'has_agent': bool(agent_name)
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


# 验证Token的装饰器
def token_required(f):
    @wraps(f)
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
            # 解码token，添加更多验证选项
            data = jwt.decode(
                token, 
                app.config['SECRET_KEY'], 
                algorithms=['HS256'],
                options={
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_nbf': True,
                    'verify_iat': True,
                    'require': ['exp', 'iat', 'username']
                }
            )
            
            current_user = data['username']
            
            # 检查用户是否存在
            if current_user not in users:
                return jsonify({'status': 'error', 'message': '用户不存在'}), 401
                
            is_admin = users.get(current_user, {}).get('is_admin', False)
            
            # 检查令牌是否在黑名单中（如果实现了令牌撤销功能）
            # 这里可以添加令牌黑名单检查逻辑
            
        except jwt.ExpiredSignatureError:
            return jsonify({'status': 'error', 'message': '令牌已过期，请重新登录'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'status': 'error', 'message': '无效的令牌'}), 401
        except Exception as e:
            return jsonify({'status': 'error', 'message': f'认证失败: {str(e)}'}), 401
        
        # 将用户信息传递给被装饰的函数
        return f(current_user, is_admin, *args, **kwargs)
    
    return decorated

# 验证管理员权限的装饰器
def admin_required(f):
    @wraps(f)
    def decorated(current_user, is_admin, *args, **kwargs):
        if not is_admin:
            # 记录未授权访问尝试
            app.logger.warning(f'未授权的管理员访问尝试: 用户 {current_user} 尝试访问 {request.path}')
            return jsonify({'status': 'error', 'message': '需要管理员权限'}), 403
        return f(current_user, is_admin, *args, **kwargs)
    
    return decorated

# 请求限制装饰器 - 防止暴力破解
def limit_login_attempts(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        ip = request.remote_addr
        current_time = time.time()
        
        # 清理过期的尝试记录
        for attempt_ip in list(login_attempts.keys()):
            if current_time - login_attempts[attempt_ip]['timestamp'] > ATTEMPT_TIMEOUT:
                del login_attempts[attempt_ip]
        
        # 检查IP是否被锁定
        if ip in login_attempts and login_attempts[ip]['attempts'] >= MAX_ATTEMPTS:
            if current_time - login_attempts[ip]['timestamp'] < ATTEMPT_TIMEOUT:
                # 计算剩余锁定时间
                remaining = int(ATTEMPT_TIMEOUT - (current_time - login_attempts[ip]['timestamp']))
                return jsonify({
                    'status': 'error',
                    'message': f'登录尝试次数过多，请在{remaining}秒后重试'
                }), 429
            else:
                # 锁定时间已过，重置尝试次数
                login_attempts[ip]['attempts'] = 0
        
        return f(*args, **kwargs)
    
    return decorated

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
    
    # 获取用户信息
    user = users.get(username)
    
    # 验证用户和密码
    if not user:
        app.logger.warning(f'登录失败: 用户名不存在 - {username} 来自IP {ip}')
        return jsonify({'status': 'error', 'message': '用户名或密码错误'}), 401
    
    # 解密前端加密的密码
    try:
        # 前端使用CryptoJS进行了加密，这里需要解密
        # 使用与前端相同的盐值和密钥
        salt = "aiheliSalt2023"
        secret_key = "aiheli2023SecretKey"
        
        # 尝试解密前端加密的密码
        try:
            # 使用pycryptodome库解密AES加密的密码
            from Crypto.Cipher import AES
            from Crypto.Util.Padding import unpad
            import base64
            
            # CryptoJS AES加密默认使用CBC模式和随机生成的IV
            # 加密后的数据格式为: Salted__ + 8字节盐值 + 加密数据
            
            # 解码前端传来的Base64加密数据
            encrypted_data = base64.b64decode(encrypted_password)
            
            # 检查是否是CryptoJS的Salted格式
            if encrypted_data[:8] == b'Salted__':
                # 提取盐值
                salt_value = encrypted_data[8:16]
                ciphertext = encrypted_data[16:]
                
                # 使用EVP_BytesToKey派生密钥和IV（CryptoJS默认方式）
                from Crypto.Hash import MD5
                key_iv = b""
                while len(key_iv) < 32 + 16:  # 32字节密钥 + 16字节IV
                    h = MD5.new()
                    h.update(key_iv[-MD5.digest_size:] if key_iv else b"")
                    h.update(secret_key.encode('utf-8'))
                    h.update(salt_value)
                    key_iv += h.digest()
                
                key = key_iv[:32]  # 32字节密钥用于AES-256
                iv = key_iv[32:32+16]  # 16字节IV
                
                # 创建AES解密器
                cipher = AES.new(key, AES.MODE_CBC, iv)
                
                # 解密并去除填充
                decrypted_data = unpad(cipher.decrypt(ciphertext), AES.block_size)
                
                # 获取解密后的哈希值
                hashed_password = decrypted_data.decode('utf-8')
            else:
                # 如果不是Salted格式，尝试使用旧的解密方式
                # AES解密需要16字节的密钥
                # 使用与前端相同的密钥处理方式
                key = secret_key.encode('utf-8')
                # 如果密钥长度不是16/24/32字节，需要调整
                if len(key) > 32:
                    key = key[:32]
                elif len(key) > 24:
                    key = key[:24]
                elif len(key) > 16:
                    key = key[:16]
                
                # 提取IV（前16字节）和加密数据
                iv = encrypted_data[:16]
                ciphertext = encrypted_data[16:]
                
                # 创建AES解密器
                cipher = AES.new(key, AES.MODE_CBC, iv)
                
                # 解密并去除填充
                decrypted_data = unpad(cipher.decrypt(ciphertext), AES.block_size)
                
                # 获取解密后的哈希值
                hashed_password = decrypted_data.decode('utf-8')
            
            # 验证密码是否正确
            # 现在数据库中存储的是密码+salt的SHA256哈希值的哈希
            # 而前端传来的hashed_password也是密码+salt的SHA256哈希值
            # 两者可以直接比较
            if not check_password_hash(user['password'], hashed_password):
                app.logger.warning(f'登录失败: 密码错误 - 用户 {username} 来自IP {ip}')
                return jsonify({'status': 'error', 'message': '用户名或密码错误'}), 401
        except Exception as decrypt_error:
            # 如果解密失败，记录错误并返回错误信息
            app.logger.error(f'密码解密失败: {str(decrypt_error)}')
            return jsonify({
                'status': 'error', 
                'message': '密码格式错误',
                'csrf_token': generate_csrf_token()
            }), 400
    except Exception as e:
        app.logger.error(f'密码验证错误: {str(e)}')
        app.logger.error(f'密码解密或验证失败，可能是加密算法不匹配: {str(e)}')
        return jsonify({
            'status': 'error', 
            'message': '登录处理失败',
            'csrf_token': generate_csrf_token() # 返回新的CSRF令牌以便前端继续使用
        }), 500
    
    # 登录成功，重置尝试次数
    if ip in login_attempts:
        login_attempts[ip]['attempts'] = 0
    
    # 更新用户最后登录时间
    users[username]['last_login'] = datetime.utcnow()
    users[username]['login_attempts'] = 0
    
    # 生成更安全的token
    now = datetime.utcnow()
    token_id = str(uuid.uuid4())
    token_payload = {
        'username': username,
        'is_admin': user['is_admin'],
        'iat': now,
        'nbf': now,  # Not Before
        'exp': now + timedelta(hours=24),
        'jti': token_id  # JWT ID
    }
    
    token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')
    
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
@app.route('/api/agents')
def get_agents():
    agents_data = load_agent_data()
    
    # 生成新的CSRF令牌
    new_csrf_token = generate_csrf_token()
    
    # 使用Flask的Response直接返回JSON，确保中文不被转义
    response_data = {
        'status': 'success',
        'data': agents_data,
        'csrf_token': new_csrf_token
    }
    return Response(
        json.dumps(response_data, ensure_ascii=False),
        mimetype='application/json'
    )

# 路由：获取单个县信息
@app.route('/api/county/<county_name>', methods=['GET'])
def get_county(county_name):
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
                    # 使用Flask的Response直接返回JSON，确保中文不被转义
                    response_data = {
                        'status': 'success',
                        'data': {
                            'name': county_name,
                            'agent_name': agent_name,
                            'agent_phone': agent_phone,
                            'has_agent': bool(agent_name)  # 只要有姓名就算有县总代
                        },
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

    except FileNotFoundError:
        error_data = {
            'status': 'error',
            'message': f'代理数据文件不存在',
            'csrf_token': generate_csrf_token()
        }
        return Response(
            json.dumps(error_data, ensure_ascii=False),
            mimetype='application/json',
            status=500
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

    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    temp_csv_path = csv_path + '.tmp'
    deleted = False

    try:
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
            return jsonify({
                'status': 'success',
                'message': f'已成功删除县: {county_name}',
                'csrf_token': generate_csrf_token()
            })
        else:
            os.remove(temp_csv_path)
            return jsonify({
                'status': 'error',
                'message': f'未找到要删除的县: {county_name}',
                'csrf_token': generate_csrf_token()
            }), 404

    except FileNotFoundError:
        return jsonify({
            'status': 'error',
            'message': '代理数据文件不存在',
            'csrf_token': generate_csrf_token()
        }), 500
    except Exception as e:
        if os.path.exists(temp_csv_path):
            os.remove(temp_csv_path)
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

    province = data['province']
    city = data['city']
    county = data['county']
    agent_name = data['agent_name']
    agent_phone = data['agent_phone']
    gdp = data.get('gdp', '')  # 获取GDP，默认为空
    population = data.get('population', '')  # 获取人口，默认为空

    try:
        # 记录操作日志
        app.logger.info(f'用户 {current_user} 正在添加新的县总代数据: {province}-{city}-{county}')

        # 读取现有的CSV文件
        csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
        new_row = [agent_name, agent_phone, province, city, county, '', ''] # GDP和人口留空

        # 将新数据追加到CSV文件
        with open(csv_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(new_row)

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
    
    csv_path = get_data_path('data/爱河狸数据_地址拆分.csv')
    try:
        app.logger.info(f'用户 {current_user} 正在更新县 {county_name} 的总代信息')
        
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
            except ValueError:
                name_col, phone_col, county_col = 0, 1, 4

            for row in reader:
                if len(row) > county_col and row[county_col].strip() == county_name:
                    row[name_col] = data['agent_name']
                    row[phone_col] = data['agent_phone']
                    county_found = True
                rows.append(row)

        if not county_found:
            province = data.get('province', '')
            city = data.get('city', '')
            new_row = [data['agent_name'], data['agent_phone'], province, city, county_name, '', '']
            rows.append(new_row)

        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        new_csrf_token = generate_csrf_token()
        
        return jsonify({
            'status': 'success',
            'message': '更新成功',
            'csrf_token': new_csrf_token
        })
    except FileNotFoundError:
        return jsonify({
            'status': 'error',
            'message': f'代理数据文件不存在',
            'csrf_token': generate_csrf_token()
        }), 500
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
        with open(get_data_path('data/中国_县.geojson'), 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        # 为了保持前端兼容性，直接返回GeoJSON数据
        # 但在响应头中添加CSRF令牌
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