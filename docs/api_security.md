# 爱河里系统API安全文档

## 目录

1. [概述](#概述)
2. [API认证机制](#api认证机制)
3. [权限控制](#权限控制)
4. [数据传输安全](#数据传输安全)
5. [API端点安全](#api端点安全)
6. [最佳实践](#最佳实践)

## 概述

本文档详细说明爱河里县总代地图系统的API安全机制，包括认证方式、权限控制、数据传输安全和API端点保护等内容。系统API采用了多层次的安全防护策略，确保数据的安全性和完整性。

## API认证机制

### 1. Token认证

系统使用JWT（JSON Web Token）进行API认证：

```python
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
            is_admin = data.get('is_admin', False)
            
            return f(current_user, is_admin, *args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'status': 'error', 'message': '令牌已过期'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'status': 'error', 'message': '无效的令牌'}), 401
    
    return decorated
```

- **Bearer认证**：使用标准的Bearer认证方案
- **多重验证**：验证签名、过期时间、生效时间和签发时间
- **必要字段检查**：确保token包含所有必要字段

### 2. CSRF保护

所有API端点都受到CSRF保护：

```python
# 验证CSRF令牌
if app.config.get('CSRF_ENABLED', True):
    csrf_token = data.get('csrf_token')
    if not validate_csrf_token(csrf_token):
        app.logger.warning(f'操作时CSRF验证失败: 用户 {current_user}')
        return jsonify({'status': 'error', 'message': 'CSRF验证失败'}), 403
```

- 所有修改操作都需要有效的CSRF令牌
- CSRF令牌通过请求头和请求体双重传递
- 令牌验证失败会记录安全日志

## 权限控制

### 1. 管理员权限

系统实现了基于角色的访问控制：

```python
# 检查管理员权限
def admin_required(f):
    @wraps(f)
    def decorated(current_user, is_admin, *args, **kwargs):
        if not is_admin:
            app.logger.warning(f'权限不足: 用户 {current_user} 尝试访问管理员功能')
            return jsonify({'status': 'error', 'message': '权限不足'}), 403
        return f(current_user, is_admin, *args, **kwargs)
    return decorated
```

- 管理员权限信息存储在JWT令牌中
- 修改操作需要管理员权限
- 非管理员用户只能查看数据，不能修改

### 2. 操作审计

系统对所有关键操作进行审计记录：

```python
# 记录更新操作
app.logger.info(f'更新县总代信息: 用户 {current_user}, 县 {county_name}, 新代理 {agent_name}')
```

- 记录操作类型、操作用户和操作内容
- 记录操作时间和IP地址
- 便于安全审计和问题追踪

## 数据传输安全

### 1. HTTPS传输

系统应部署在启用HTTPS的环境中：

- 所有API通信通过HTTPS加密传输
- 防止中间人攻击和数据窃听
- 确保数据传输的机密性和完整性

### 2. 数据验证

系统对所有输入数据进行严格验证：

```python
# 验证请求数据
if not data:
    return jsonify({'status': 'error', 'message': '无效的请求数据'}), 400

# 验证必要字段
if not data.get('agent_name'):
    return jsonify({'status': 'error', 'message': '缺少必要字段'}), 400
```

- 验证数据格式和必要字段
- 防止注入攻击和恶意数据
- 确保数据的有效性和一致性

## API端点安全

### 1. 更新县总代信息

```python
@app.route('/api/county/<county_name>', methods=['PUT'])
@token_required
@admin_required
def update_county(current_user, is_admin, county_name):
    # 验证CSRF令牌
    # 验证请求数据
    # 更新数据
    # 记录操作日志
```

- 需要有效的认证令牌
- 需要管理员权限
- 需要有效的CSRF令牌
- 记录详细的操作日志

### 2. 获取县总代数据

```python
@app.route('/api/agents', methods=['GET'])
def get_agents():
    # 加载县总代数据
    # 返回数据
```

- 公开接口，无需认证
- 只返回必要的数据字段
- 不返回敏感信息

### 3. 获取单个县信息

```python
@app.route('/api/county/<county_name>', methods=['GET'])
def get_county(county_name):
    # 查找县信息
    # 返回数据
```

- 公开接口，无需认证
- 只返回必要的数据字段
- 不返回敏感信息

## 最佳实践

1. **定期轮换密钥**：定期更换JWT签名密钥和CSRF令牌密钥
2. **限制API请求频率**：实现API请求频率限制，防止DoS攻击
3. **监控异常请求**：监控并记录异常API请求，及时发现潜在攻击
4. **最小权限原则**：API只提供完成任务所需的最小权限
5. **安全响应头**：设置适当的安全响应头，如Content-Security-Policy和X-Content-Type-Options
6. **定期安全审计**：定期审查API安全配置和访问日志

---

本文档最后更新时间：2023年9月17日