# `app.py` 重构实现计划

本文档将 `app.py` 的重构过程分解为一系列可执行的编码任务。每个任务都旨在以增量、可验证的方式推进重构，确保在每个阶段应用都能保持稳定和功能完整。

## 任务清单

### 1. 基础结构搭建与工具模块迁移

*   [ ] **1.1. 创建项目目录结构**
    *   创建 `src/` 目录，用于存放所有重构后的应用模块。
    *   在 `src/` 目录下创建空的 `__init__.py`, `auth.py`, `agents.py`, `map_data.py`, `models.py`, `utils.py` 文件。
    *   创建空的顶层 `run.py` 文件。
    *   *需求引用: 2.3.1, 2.1.3, 2.1.4, 2.1.5, 2.3.2*

*   [ ] **1.2. 迁移 `get_data_path` 工具函数**
    *   将 `app.py` 中的 `get_data_path` 函数剪切并粘贴到 `src/utils.py` 文件中。
    *   确保 `src/utils.py` 包含所有必要的导入（如 `os`, `sys`, `logging`）。为了让 `app.logger` 能够继续工作，暂时先从 `flask` 导入 `current_app` 并在函数中使用 `current_app.logger`。
    *   *需求引用: 2.1.5*

*   [ ] **1.3. 更新 `app.py` 中的依赖**
    *   在 `app.py` 的顶部，添加 `from src.utils import get_data_path`，确保应用在重构过程中可以继续找到该函数。
    *   *需求引用: 2.2.1*

*   [ ] **1.4. 主动中断，让用户自行测试**
    *   提醒用户测试哪些功能
    *   *需求引用: 2.2.4*

### 2. 认证模块 (`auth`) 重构

*   [ ] **2.1. 迁移数据模型**
    *   将 `app.py` 中的用户数据（`users` 字典、`salt`、`hashed_salted_password`）剪切并粘贴到 `src/models.py` 文件中。
    *   确保 `src/models.py` 包含必要的导入（`generate_password_hash`, `hashlib`）。
    *   *需求引用: 2.1.3*

*   [ ] **2.2. 创建认证蓝图 (`auth_bp`)**
    *   在 `src/auth.py` 中，创建一个名为 `auth_bp` 的 `Blueprint`。
    *   将 `app.py` 中与认证相关的路由（`/api/login`, `/api/logout`, `/api/csrf-token`）及其处理函数迁移到 `src/auth.py`，并使用 `@auth_bp.route(...)` 进行注册。
    *   *需求引用: 2.1.4*

*   [ ] **2.3. 迁移认证辅助函数和装饰器**
    *   将 `app.py` 中的 `limit_login_attempts`, `token_required`, `optional_token`, `admin_required` 装饰器迁移到 `src/auth.py`。
    *   将 `generate_csrf_token`, `validate_csrf_token` 函数以及密码解密逻辑迁移到 `src/auth.py`。
    *   *需求引用: 2.1.4*

*   [ ] **2.4. 解决 `auth` 模块的依赖**
    *   在 `src/auth.py` 中添加所有必要的导入，例如 `Blueprint`, `request`, `jsonify`, `session`, `current_app` (用于访问 `config` 和 `logger`)，以及从 `src.models` 导入 `users`。
    *   将 `login_attempts` 字典的定义从 `app.py` 移到 `src/auth.py` 的模块级别。
    *   *需求引用: 2.2.1*

*   [ ] **2.5. 主动中断，让用户自行测试**
    *   提醒用户测试哪些功能
    *   *需求引用: 2.2.4*

### 3. 代理商模块 (`agents`) 重构

*   [ ] **3.1. 创建代理商蓝图 (`agents_bp`)**
    *   在 `src/agents.py` 中，创建一个名为 `agents_bp` 的 `Blueprint`。
    *   将 `app.py` 中与代理商数据相关的路由（`/api/agents`, `/api/county/...` 的 GET, POST, PUT, DELETE 方法）及其处理函数迁移到 `src/agents.py`，并使用 `@agents_bp.route(...)` 进行注册。
    *   *需求引用: 2.1.4*

*   [ ] **3.2. 迁移 `load_agent_data` 函数**
    *   将 `app.py` 中的 `load_agent_data` 函数迁移到 `src/agents.py`。
    *   *需求引用: 2.1.4*

*   [ ] **3.3. 解决 `agents` 模块的依赖**
    *   在 `src/agents.py` 中添加所有必要的导入，例如 `Blueprint`, `request`, `jsonify`, `Response`, `current_app`，以及从 `src.utils` 导入 `get_data_path`，从 `src.auth` 导入 `token_required`, `optional_token`, `admin_required`。
    *   *需求引用: 2.2.1*

### 4. 地图数据模块 (`map_data`) 重构

*   [ ] **4.1. 创建地图数据蓝图 (`map_data_bp`)**
    *   在 `src/map_data.py` 中，创建一个名为 `map_data_bp` 的 `Blueprint`。
    *   将 `app.py` 中的 `/api/geojson` 路由及其处理函数迁移到 `src/map_data.py`，并使用 `@map_data_bp.route(...)` 进行注册。
    *   *需求引用: 2.1.4*

*   [ ] **4.2. 解决 `map_data` 模块的依赖**
    *   在 `src/map_data.py` 中添加所有必要的导入，例如 `Blueprint`, `jsonify`, `current_app`，以及从 `src.utils` 导入 `get_data_path`，从 `src.auth` 导入 `generate_csrf_token`。
    *   *需求引用: 2.2.1*

### 5. 应用组装与收尾

*   [ ] **5.1. 实现应用工厂 `create_app`**
    *   在 `src/__init__.py` 中，定义 `create_app` 函数。
    *   将 `app.py` 中剩余的应用创建和配置逻辑（`Flask(...)`, `CORS(...)`, `app.config[...]`）移入 `create_app` 函数。
    *   在 `create_app` 中，导入并注册 `auth_bp`, `agents_bp`, `map_data_bp` 蓝图。
    *   将 `app.py` 中的首页路由 (`/`) 移到 `create_app` 中。
    *   *需求引用: 2.1.2*

*   [ ] **5.2. 实现启动脚本 `run.py`**
    *   在 `run.py` 中，从 `src` 导入 `create_app`，并调用它来创建应用实例。
    *   将 `app.py` 中的 `if __name__ == '__main__':` 启动块迁移到 `run.py`。
    *   确保 `run.py` 包含所有必要的导入（`os`, `sys`, `datetime`）以及对 `utils.pack_utils` 和 `get_data_path` 的调用。
    *   *需求引用: 2.3.2*

*   [ ] **5.3. 清理 `app.py`**
    *   此时 `app.py` 中的所有代码都应该已经被迁移。删除 `app.py` 文件。
    *   *需求引用: 2.1.1*

*   [ ] **5.4. 全局审查和最终验证**
    *   检查所有新文件中的导入路径是否正确（例如，确保所有模块间的导入都是绝对的，如 `from src.auth import ...`）。
    *   运行 `python run.py` 启动应用，并进行全面的手动测试，确保所有功能（登录、查看地图、增删改查代理商）都与重构前完全一致。
    *   *需求引用: 2.2.1, 2.2.2*