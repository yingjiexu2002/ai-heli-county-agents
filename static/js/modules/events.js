/**
 * events.js - 事件处理模块
 * 负责：
 *  - 绑定所有DOM事件
 *  - 处理用户交互事件
 *  - 协调模块间通信
 */

import { updateCountyAgent, deleteCounty, addNewCountyAgent } from './data.js';
import { getSelectedCounty, resetSelectedCounty, 
         showCountyDetails, updateDrawerTables, updateAuthUI, 
         toggleAdminDrawer, toggleSearchModal, openAddAgentModal, 
         closeAddAgentModal } from './ui.js';
import { resetFeatureStyle } from './map.js';
import { locateCountyOnMap } from './search.js';

/**
 * 处理新增县总代
 */
async function handleAddNewAgent() {
    const newProvince = document.getElementById('new-province').value.trim();
    const newCity = document.getElementById('new-city').value.trim();
    const newCounty = document.getElementById('new-county').value.trim();
    const newAgentName = document.getElementById('new-agent-name').value.trim();
    const newAgentPhone = document.getElementById('new-agent-phone').value.trim();
    const newGdp = document.getElementById('new-gdp').value.trim();
    const newPopulation = document.getElementById('new-population').value.trim();

    const result = await addNewCountyAgent({
        province: newProvince,
        city: newCity,
        county: newCounty,
        agentName: newAgentName,
        agentPhone: newAgentPhone,
        gdp: newGdp,
        population: newPopulation
    });
    
    if (result) {
        closeAddAgentModal();
        // 数据更新已经由 addNewCountyAgent 处理
    }
}

/**
 * 检查认证状态
 */
function checkAuthStatus() {
    // 每次刷新UI前都从localStorage同步token和isAdmin
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    // 更新UI状态
    updateAuthUI({
        isLoggedIn: !!token,
        isAdmin,
        username: ''
    });
}

/**
 * 处理县总代被删除后的UI更新
 */
function handleDeletedCounty(countyName) {
    // 如果当前有选中的县，且是被删除的县，则关闭信息面板
    const currentCountyName = document.getElementById('county-name').textContent;
    if (currentCountyName === countyName) {
        document.getElementById('info-panel').classList.add('hidden');
        const selectedCounty = getSelectedCounty();
        if (selectedCounty) {
            resetFeatureStyle(selectedCounty);
            resetSelectedCounty();
        }
    }
    
    // 更新抽屉表格
    updateDrawerTables();
}

/**
 * 绑定所有事件
 */
export function bindEvents() {
    // 登录按钮点击事件
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            try {
                const result = await import('./auth.js').then(auth => auth.login(username, password));
                // 登录成功后刷新UI
                checkAuthStatus();
                
                // 显式触发认证状态变更事件
                const isAdmin = localStorage.getItem('isAdmin') === 'true';
                const authEvent = new CustomEvent('authStatusChanged', { 
                    detail: { isAdmin: isAdmin, isLoggedIn: true, username: username } 
                });
                window.dispatchEvent(authEvent);
                
                alert('登录成功');
            } catch (error) {
                alert(error.message || '登录失败');
            }
        });
    }
    
    // 退出按钮点击事件
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await import('./auth.js').then(auth => auth.logout());
                // 退出成功后刷新UI
                checkAuthStatus();
                
                // 显式触发认证状态变更事件
                const authEvent = new CustomEvent('authStatusChanged', { 
                    detail: { isAdmin: false, isLoggedIn: false, username: '' } 
                });
                window.dispatchEvent(authEvent);
                
                alert('已安全退出');
            } catch (error) {
                alert(error.message || '注销失败');
            }
        });
    }
    
    // 更新按钮点击事件
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            const selectedCounty = getSelectedCounty();
            if (!selectedCounty) {
                alert('请先选择一个县');
                return;
            }
            
            const countyNameValue = document.getElementById('county-name').textContent;
            const newProvince = document.getElementById('edit-province').value.trim();
            const newCity = document.getElementById('edit-city').value.trim();
            const newCounty = document.getElementById('edit-county').value.trim();
            const newAgentName = document.getElementById('edit-agent-name').value.trim();
            const newAgentPhone = document.getElementById('edit-agent-phone').value.trim();
            
            if (!newAgentName || !newAgentPhone) {
                alert('请输入县总代姓名和电话');
                return;
            }
            
            // 如果提供了省、市、县信息，则需要验证
            if ((newProvince || newCity || newCounty) && !(newProvince && newCity && newCounty)) {
                alert('请完整填写省份、城市和县名');
                return;
            }
            
            try {
                // 使用 data.js 模块的更新功能
                const result = await updateCountyAgent(countyNameValue, newAgentName, newAgentPhone, null, newProvince, newCity, newCounty);
                
                if (result) {
                    alert('更新成功');
                    // 更新详情面板
                    showCountyDetails(countyNameValue);
                }
            } catch (error) {
                console.error('更新失败:', error);
                alert('更新失败，请重试');
            }
        });
    }
    
    // 抽屉开关按钮点击事件
    const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
    if (drawerToggleBtn) {
        drawerToggleBtn.addEventListener('click', () => {
            const adminDrawer = document.getElementById('admin-drawer');
            const isActive = adminDrawer.classList.contains('active');
            toggleAdminDrawer(!isActive);
            
            // 如果抽屉被打开，加载数据
            if (!isActive) {
                updateDrawerTables();
            }
        });
    }
    
    // 抽屉关闭按钮点击事件
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    if (drawerCloseBtn) {
        drawerCloseBtn.addEventListener('click', () => {
            toggleAdminDrawer(false);
        });
    }

    // 新增按钮点击事件
    const addNewBtn = document.getElementById('add-new-btn');
    if (addNewBtn) {
        addNewBtn.addEventListener('click', () => {
            openAddAgentModal();
        });
    }

    // 模态框关闭按钮点击事件
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            closeAddAgentModal();
        });
    }

    // 保存新县总代按钮点击事件
    const saveNewAgentBtn = document.getElementById('save-new-agent-btn');
    if (saveNewAgentBtn) {
        saveNewAgentBtn.addEventListener('click', handleAddNewAgent);
    }

    // 信息面板关闭按钮事件
    const infoPanelCloseBtn = document.getElementById('info-panel-close-btn');
    if (infoPanelCloseBtn) {
        infoPanelCloseBtn.addEventListener('click', () => {
            document.getElementById('info-panel').classList.add('hidden');
            // 如果有选中的县，重置其样式
            const selectedCounty = getSelectedCounty();
            if (selectedCounty) {
                resetFeatureStyle(selectedCounty);
                resetSelectedCounty();
            }
        });
    }
    
    // 搜索按钮点击事件
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            toggleSearchModal(true);
        });
    }
    
    // 搜索浮窗关闭按钮点击事件
    const searchModalCloseBtn = document.getElementById('search-modal-close-btn');
    if (searchModalCloseBtn) {
        searchModalCloseBtn.addEventListener('click', () => {
            toggleSearchModal(false);
        });
    }
    
    // 监听自定义事件
    document.addEventListener('ui:updateCounty', async (e) => {
        const { oldCounty, province, city, county, agentName, agentPhone, tr } = e.detail;
        
        // 调用API更新数据
        const result = await updateCountyAgent(oldCounty, agentName, agentPhone, tr, province, city, county);
        if (result) {
            // 如果当前选中的县是被更新的县，更新详情面板
            const currentCountyName = document.getElementById('county-name').textContent;
            if (currentCountyName === oldCounty) {
                showCountyDetails(county || oldCounty);
            }
        }
    });
    
    document.addEventListener('ui:deleteCounty', async (e) => {
        const { county } = e.detail;
        const result = await deleteCounty(county);
        if (result) {
            handleDeletedCounty(county);
        }
    });
    
    document.addEventListener('ui:countySelected', (e) => {
        const { name, gb } = e.detail;
        locateCountyOnMap(name, gb);
        // 使用 ui.js 的 showSearchResult 函数
        import('./ui.js').then(ui => {
            ui.showSearchResult(`已定位到 ${name}`, 'success');
        });
    });
}

/**
 * 设置数据事件监听
 */
export function setupDataEventListeners() {
    // 监听数据更新事件
    window.addEventListener('agentsDataUpdated', (event) => {
        console.log('收到数据更新事件', event.detail);
        // 更新抽屉表格
        updateDrawerTables();
    });
}

/**
 * 导出认证状态检查函数供外部使用
 */
export { checkAuthStatus };