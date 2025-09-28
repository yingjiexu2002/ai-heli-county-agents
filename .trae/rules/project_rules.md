# 前端项目结构
static/js/
├── main.js - 应用入口文件
└── modules/
    ├── utils.js - 工具模块（通知、加密、CSRF等）
    ├── auth.js - 认证模块（登录、注销、权限管理）
    ├── map.js - 地图核心模块（地图初始化、图层管理）
    ├── data.js - 数据处理模块（数据加载、分类、API交互）
    ├── ui.js - UI组件模块（界面交互、抽屉、模态框）
    ├── search.js - 搜索功能模块（搜索逻辑、地图定位）
    ├── map-interactions.js - 地图交互模块（样式、事件处理）
    └── events.js - 事件处理模块（事件绑定、用户交互）