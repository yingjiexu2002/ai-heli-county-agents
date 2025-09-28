/**
 * main.js - 应用入口文件
 * 负责：
 *  - 导入各个功能模块
 *  - 初始化应用程序
 *  - 协调各模块启动
 */

// 导入工具模块
import { getCsrfToken, createToastContainer } from './modules/utils.js';

// 导入核心功能模块
import { initMap } from './modules/map.js';
import { loadAgentsData, initData } from './modules/data.js';

// 导入UI模块
import { initDOMElements, initUI, initDrawerSettings, initDrawerResizer } from './modules/ui.js';

// 导入地图交互模块
import { loadGeoJSON } from './modules/map-interactions.js';

// 导入事件处理模块
import { bindEvents, setupDataEventListeners, checkAuthStatus } from './modules/events.js';

// 导入搜索模块
import { initSearchEvents } from './modules/search.js';

// 全局变量
let map; // 地图实例

/**
 * 初始化应用程序
 */
async function init() {
    console.log('爱河狸地图管理系统启动...');
    
    try {
        // 1. 初始化DOM和UI组件
        console.log('初始化UI组件...');
        initDOMElements();
        initDrawerSettings();
        initDrawerResizer();
        initUI();
        
        // 2. 获取CSRF令牌
        console.log('获取CSRF令牌...');
        await getCsrfToken();
        
        // 3. 检查认证状态
        console.log('检查认证状态...');
        checkAuthStatus();
        
        // 4. 初始化地图
        console.log('初始化地图...');
        map = initMap();
        
        // 5. 初始化数据模块
        console.log('初始化数据模块...');
        initData();
        
        // 6. 设置事件监听
        console.log('设置事件监听...');
        setupDataEventListeners();
        
        // 7. 加载地图数据
        console.log('加载地图数据...');
        await loadGeoJSON();
        
        // 8. 加载县总代数据
        console.log('加载县总代数据...');
        await loadAgentsData();
        
        // 9. 绑定所有事件
        console.log('绑定事件处理器...');
        bindEvents();
        
        // 10. 初始化搜索功能
        console.log('初始化搜索功能...');
        initSearchEvents();
        
        // 11. 创建通知容器
        console.log('创建通知容器...');
        createToastContainer();
        
        console.log('应用程序初始化完成！');
        
    } catch (error) {
        console.error('应用程序初始化失败:', error);
        alert('系统初始化失败，请刷新页面重试');
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', init);