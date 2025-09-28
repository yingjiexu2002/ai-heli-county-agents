import jwt
import secrets
import time
import hashlib
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from Crypto.Hash import MD5
import base64
import uuid
import os

# 登录尝试限制
login_attempts = {}
MAX_ATTEMPTS = 5
ATTEMPT_TIMEOUT = 300  # 5分钟

# 模拟用户数据库 - 使用更安全的密码哈希方法
# 注意：为了与前端加密流程匹配，我们需要存储密码+salt的SHA256哈希值
salt = "aiheliSalt2023"
salted_password = "890890" + salt
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


# 生成CSRF令牌
def generate_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


# 验证CSRF令牌
def validate_csrf_token(token):
    return token and 'csrf_token' in session and token == session['csrf_token']


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
                os.environ.get('SECRET_KEY'), 
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


# 允许未登录用户访问，但区分权限的装饰器
def optional_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        current_user = None
        is_admin = False
        
        # 从请求头中获取token
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        # 如果有token，尝试解析
        if token:
            try:
                # 解码token
                data = jwt.decode(
                    token, 
                    os.environ.get('SECRET_KEY'), 
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
                if current_user in users:
                    is_admin = users.get(current_user, {}).get('is_admin', False)
            except Exception as e:
                # 如果token解析失败，视为未登录用户
                pass
        
        # 无论token是否有效，都允许访问，但传递不同的用户状态
        return f(current_user, is_admin, *args, **kwargs)
    
    return decorated


# 验证管理员权限的装饰器
def admin_required(f):
    @wraps(f)
    def decorated(current_user, is_admin, *args, **kwargs):
        if not is_admin:
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


def decrypt_password(encrypted_password):
    """解密前端加密的密码"""
    try:
        # 前端使用CryptoJS进行了加密，这里需要解密
        # 使用与前端相同的盐值和密钥
        secret_key = "aiheli2023SecretKey"
        
        # 解码前端传来的Base64加密数据
        encrypted_data = base64.b64decode(encrypted_password)
        
        # 检查是否是CryptoJS的Salted格式
        if encrypted_data[:8] == b'Salted__':
            # 提取盐值
            salt_value = encrypted_data[8:16]
            ciphertext = encrypted_data[16:]
            
            # 使用EVP_BytesToKey派生密钥和IV（CryptoJS默认方式）
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
        
        return hashed_password
    except Exception as decrypt_error:
        # 如果解密失败，记录错误并返回错误信息
        raise Exception(f"密码解密失败: {str(decrypt_error)}")


def authenticate_user(username, encrypted_password):
    """验证用户身份"""
    user = users.get(username)
    
    if not user:
        return False, "用户名或密码错误"
    
    try:
        # 解密前端加密的密码
        hashed_password = decrypt_password(encrypted_password)
        
        # 验证密码是否正确
        # 现在数据库中存储的是密码+salt的SHA256哈希值的哈希
        # 而前端传来的hashed_password也是密码+salt的SHA256哈希值
        # 两者可以直接比较
        if not check_password_hash(user['password'], hashed_password):
            return False, "用户名或密码错误"
    except Exception as decrypt_error:
        return False, f"密码格式错误: {str(decrypt_error)}"
    
    return True, user


def generate_auth_token(username):
    """生成认证令牌"""
    user = users.get(username)
    if not user:
        return None
    
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
    
    token = jwt.encode(token_payload, os.environ.get('SECRET_KEY'), algorithm='HS256')
    return token


def update_user_login_info(username, ip):
    """更新用户登录信息"""
    # 登录成功，重置尝试次数
    if ip in login_attempts:
        login_attempts[ip]['attempts'] = 0
    
    # 更新用户最后登录时间
    if username in users:
        users[username]['last_login'] = datetime.utcnow()
        users[username]['login_attempts'] = 0