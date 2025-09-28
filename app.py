import os
import sys
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, session, Response
from flask_cors import CORS
import secrets
from src.utils import get_data_path
from src.auth import (
    generate_csrf_token, validate_csrf_token, token_required, optional_token, 
    admin_required, limit_login_attempts, users, login_attempts, generate_auth_token,
    authenticate_user, update_user_login_info
)
from src.data_handler import load_agent_data, load_geojson_data
from src.routes import register_routes
from src.config import config



# 使用兼容打包路径的静态目录
app = Flask(__name__, static_folder=get_data_path('static'))
CORS(app, supports_credentials=True)

# 使用配置模块
config_obj = config['development']  # 默认使用开发配置
app.config.from_object(config_obj)

# 配置密钥（保留原有的密钥生成逻辑，但简化代码）
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


# 注册路由
register_routes(app)

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