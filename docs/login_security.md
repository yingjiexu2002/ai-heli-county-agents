# 爱河里系统登录安全流程文档

## 目录

1. [概述](#概述)
2. [安全机制](#安全机制)
3. [登录流程](#登录流程)
4. [安全防护措施](#安全防护措施)
5. [最佳实践](#最佳实践)

## 概述

本文档详细说明爱河里县总代地图系统的登录安全流程，包括身份验证机制、密码处理、会话管理和安全防护措施等内容。该系统采用了多层次的安全防护策略，确保只有授权用户能够访问和管理系统数据。

## 安全机制

### 1. 密码存储

系统使用 Werkzeug 的 `generate_password_hash` 和 `check_password_hash` 函数进行密码的安全存储和验证：

```python
# 密码存储使用 PBKDF2 算法，SHA256 哈希，15万次迭代
'password': generate_password_hash('123456', method='pbkdf2:sha256:150000')
```

- **PBKDF2 算法**：密钥派生函数，通过多次哈希来增加破解难度
- **SHA256**：安全的哈希算法
- **15万次迭代**：增加暴力破解的计算成本

### 2. CSRF 保护

系统实现了完整的跨站请求伪造(CSRF)保护机制：

```python
# 生成 CSRF 令牌
def generate_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

# 验证 CSRF 令牌
def validate_csrf_token(token):
    return token and 'csrf_token' in session and token == session['csrf_token']
```

- 每个会话生成唯一的 32 字节随机令牌
- 所有修改操作都需要验证 CSRF 令牌
- 令牌通过 HTTP 头和请求体双重传递

### 3. JWT 认证

系统使用 JSON Web Token (JWT) 进行用户认证和会话管理：

```python
token_payload = {
    'username': username,
    'is_admin': user['is_admin'],
    'iat': now,                 # 签发时间
    'nbf': now,                 # 生效时间
    'exp': now + timedelta(hours=24),  # 过期时间
    'jti': token_id            # 令牌唯一ID
}
```

- **iat (Issued At)**：令牌签发时间
- **nbf (Not Before)**：令牌生效时间
- **exp (Expiration)**：令牌过期时间，默认24小时
- **jti (JWT ID)**：令牌唯一标识符

## 登录流程

### 1. 前端流程

```javascript
// 1. 获取 CSRF 令牌
await getCsrfToken();

// 2. 发送登录请求
const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken  // CSRF 令牌放在请求头中
    },
    body: JSON.stringify({ 
        username, 
        password: password,
        csrf_token: csrfToken  // CSRF 令牌同时放在请求体中
    })
});

// 3. 处理登录响应
const result = await response.json();
if (result.status === 'success') {
    // 保存认证信息
    localStorage.setItem('token', result.token);
    localStorage.setItem('isAdmin', result.is_admin);
    
    // 更新 CSRF 令牌
    if (result.csrf_token) {
        csrfToken = result.csrf_token;
        localStorage.setItem('csrfToken', csrfToken);
    }
}
```

### 2. 后端流程

```python
# 1. 验证 CSRF 令牌
csrf_token = data.get('csrf_token')
if app.config.get('CSRF_ENABLED', True) and not validate_csrf_token(csrf_token):
    app.logger.warning(f'CSRF验证失败: IP {ip}')
    return jsonify({'status': 'error', 'message': 'CSRF验证失败'}), 403

# 2. 验证用户名和密码
user = users.get(username)
if not user or not check_password_hash(user['password'], raw_password):
    app.logger.warning(f'登录失败: 密码错误 - 用户 {username} 来自IP {ip}')
    return jsonify({'status': 'error', 'message': '用户名或密码错误'}), 401

# 3. 生成 JWT 令牌
token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')

# 4. 返回新的 CSRF 令牌
new_csrf_token = generate_csrf_token()
```

## 安全防护措施

### 1. 登录尝试限制

系统实现了登录尝试限制机制，防止暴力破解攻击：

```python
@limit_login_attempts
def login():
    # 登录逻辑
```

- 同一 IP 地址连续失败登录次数限制
- 超过限制后，临时锁定账户
- 锁定时间随失败次数增加而延长

### 2. 安全日志记录

系统对所有登录相关操作进行详细日志记录：

```python
app.logger.warning(f'登录失败: 密码错误 - 用户 {username} 来自IP {ip}')
app.logger.info(f'登录成功: 用户 {username} 来自IP {ip}')
```

- 记录登录成功和失败事件
- 记录关键操作的 IP 地址
- 记录可疑活动和安全事件

### 3. 安全退出机制

系统提供了安全的退出机制：

```python
@app.route('/api/logout', methods=['POST'])
@token_required
def logout(current_user, is_admin):
    # 验证 CSRF 令牌
    # 记录退出日志
    # 生成新的 CSRF 令牌
```

- 退出操作需要有效的认证令牌
- 退出操作需要验证 CSRF 令牌
- 退出后生成新的 CSRF 令牌

## 最佳实践

1. **定期更改密码**：管理员应定期更改密码，并使用强密码策略
2. **安全退出**：用户完成操作后应点击"退出"按钮安全退出系统
3. **避免公共设备**：避免在公共设备上登录系统，如必须使用，操作完成后务必安全退出
4. **保持系统更新**：定期更新系统依赖库，修复已知安全漏洞
5. **监控异常活动**：定期检查系统日志，监控异常登录活动

---

本文档最后更新时间：2023年9月17日