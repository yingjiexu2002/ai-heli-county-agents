/**
 * ui.js - UI交互模块
 * 负责：
 *  - DOM元素初始化
 *  - 界面交互
 *  - 抽屉和表格管理
 *  - 模态框操作
 *  - 搜索UI
 */

import { showToast } from './utils.js';
import { resetFeatureStyle } from './map.js';
import { findCountyAgent, getCountyAgentInfo, getMappedCounties, getUnmappedCounties } from './data.js';

// DOM元素引用
let loginSection, userSection, userInfo, loginBtn, logoutBtn;
let infoPanel, countyName, agentName, agentPhone, adminPanel, infoPanelCloseBtn;
let editAgentName, editAgentPhone, updateBtn, editProvince, editCity, editCounty;
let drawerToggleBtn, adminDrawer, drawerCloseBtn, drawerResizer;
let mappedDataTable, unmappedDataTable, mappedDataSection, unmappedDataSection;
let addAgentModal, addNewBtn, modalCloseBtn, saveNewAgentBtn;
let searchBtn, searchModal, searchModalCloseBtn, searchInput, doSearchBtn, searchResult, searchResultText, searchTypeRadios;

// 用于存储当前选中的县
let selectedCounty = null;

/**
 * 初始化所有DOM元素引用
 */
export function initDOMElements() {
    // 认证相关元素
    loginSection = document.getElementById('login-section');
    userSection = document.getElementById('user-section');
    userInfo = document.getElementById('user-info');
    loginBtn = document.getElementById('login-btn');
    logoutBtn = document.getElementById('logout-btn');
    
    // 信息面板相关元素
    infoPanel = document.getElementById('info-panel');
    countyName = document.getElementById('county-name');
    agentName = document.getElementById('agent-name');
    agentPhone = document.getElementById('agent-phone');
    adminPanel = document.getElementById('admin-panel');
    editAgentName = document.getElementById('edit-agent-name');
    editAgentPhone = document.getElementById('edit-agent-phone');
    updateBtn = document.getElementById('update-btn');
    infoPanelCloseBtn = document.getElementById('info-panel-close-btn');
    
    // 编辑相关元素
    editProvince = document.getElementById('edit-province');
    editCity = document.getElementById('edit-city');
    editCounty = document.getElementById('edit-county');
    
    // 抽屉控件DOM元素
    drawerToggleBtn = document.getElementById('drawer-toggle-btn');
    adminDrawer = document.getElementById('admin-drawer');
    drawerCloseBtn = document.getElementById('drawer-close-btn');
    drawerResizer = document.getElementById('drawer-resizer');
    mappedDataTable = document.getElementById('mapped-data-table');
    unmappedDataTable = document.getElementById('unmapped-data-table');
    mappedDataSection = document.getElementById('mapped-data-section');
    unmappedDataSection = document.getElementById('unmapped-data-section');
    
    // 新增模态框DOM元素
    addAgentModal = document.getElementById('add-agent-modal');
    addNewBtn = document.getElementById('add-new-btn');
    modalCloseBtn = document.getElementById('modal-close-btn');
    saveNewAgentBtn = document.getElementById('save-new-agent-btn');
    
    // 搜索相关DOM元素
    searchBtn = document.getElementById('search-btn');
    searchModal = document.getElementById('search-modal');
    searchModalCloseBtn = document.getElementById('search-modal-close-btn');
    searchInput = document.getElementById('search-input');
    doSearchBtn = document.getElementById('do-search-btn');
    searchResult = document.getElementById('search-result');
    searchResultText = document.getElementById('search-result-text');
    searchTypeRadios = document.querySelectorAll('input[name="search-type"]');
    
    console.log('UI模块: DOM元素初始化完成');
}

/**
 * 初始化抽屉设置
 */
export function initDrawerSettings() {
    if (!adminDrawer) return;
    
    adminDrawer.classList.remove('active');
    
    // 设置抽屉部分的初始高度
    const drawerHeight = adminDrawer.offsetHeight;
    if (mappedDataSection && unmappedDataSection) {
        mappedDataSection.style.height = `${drawerHeight / 2}px`;
        unmappedDataSection.style.height = `${drawerHeight / 2}px`;
        mappedDataSection.style.flex = 'none';
        unmappedDataSection.style.flex = 'none';
    }
    
    console.log('UI模块: 抽屉初始化完成');
}

/**
 * 初始化抽屉分隔线拖拽功能
 */
export function initDrawerResizer() {
    if (!drawerResizer || !mappedDataSection || !unmappedDataSection) return;
    
    let isDragging = false;
    let startY = 0;
    let startHeightTop = 0;
    let startHeightBottom = 0;
    
    drawerResizer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeightTop = mappedDataSection.offsetHeight;
        startHeightBottom = unmappedDataSection.offsetHeight;
        
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = e.clientY - startY;
        const newHeightTop = startHeightTop + deltaY;
        const newHeightBottom = startHeightBottom - deltaY;
        
        if (newHeightTop > 50 && newHeightBottom > 50) {
            mappedDataSection.style.height = `${newHeightTop}px`;
            unmappedDataSection.style.height = `${newHeightBottom}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
        }
    });
    
    console.log('UI模块: 抽屉调整器初始化完成');
}

/**
 * 显示县详情
 * @param {string} countyNameVal - 县名
 * @param {Object} feature - GeoJSON feature对象
 */
export function showCountyDetails(countyNameVal, feature = null) {
    console.log('显示县详情:', countyNameVal);
    
    if (!infoPanel) {
        console.error('UI模块: infoPanel未初始化');
        return;
    }
    
    // 显示信息面板
    infoPanel.classList.remove('hidden');
    
    // 设置县名
    if (countyName) {
        countyName.textContent = countyNameVal || '未知县名';
    }
    
    // 查找县的代理信息
    let agentInfo = null;
    if (feature) {
        agentInfo = getCountyAgentInfo(countyNameVal, feature);
    } else {
        agentInfo = findCountyAgent(countyNameVal);
    }
    
    console.log('获取到的代理信息:', agentInfo);
    
    // 添加权限提示信息
    const permissionNote = document.getElementById('permission-note');
    if (permissionNote) {
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            permissionNote.textContent = '(普通用户只能查看脱敏数据)';
            permissionNote.classList.remove('hidden');
        } else {
            permissionNote.textContent = '(管理员可查看完整数据)';
            permissionNote.classList.remove('hidden');
        }
    }
    
    // 设置省份信息
    const provinceName = document.getElementById('province-name');
    if (provinceName) {
        if (agentInfo && agentInfo.province) {
            provinceName.textContent = agentInfo.province || '暂无';
        } else {
            provinceName.textContent = '暂无';
        }
    }
    
    // 更新县总代信息显示
    if (agentName && agentPhone) {
        if (agentInfo && agentInfo.has_agent) {
            agentName.textContent = agentInfo.name || '暂无';
            agentPhone.textContent = agentInfo.phone || '暂无';
            
            // 如果是管理员，设置编辑表单的值
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            if (isAdmin && editProvince && editCity && editCounty && editAgentName && editAgentPhone) {
                editProvince.value = agentInfo.province || '';
                editCity.value = agentInfo.city || '';
                editCounty.value = agentInfo.county || '';
                editAgentName.value = agentInfo.name || '';
                editAgentPhone.value = agentInfo.phone || '';
            }
        } else {
            agentName.textContent = '暂无';
            agentPhone.textContent = '暂无';
            
            // 如果是管理员，清空编辑表单
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            if (isAdmin && editProvince && editCity && editCounty && editAgentName && editAgentPhone) {
                editProvince.value = '';
                editCity.value = '';
                editCounty.value = countyNameVal || '';
                editAgentName.value = '';
                editAgentPhone.value = '';
            }
        }
    }
    
    // 检查管理员状态并显示/隐藏编辑面板
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (adminPanel) {
        if (isAdmin) {
            adminPanel.classList.remove('hidden');
        } else {
            adminPanel.classList.add('hidden');
        }
    }
}

/**
 * 更新抽屉中的数据表格
 */
export function updateDrawerTables() {
    if (!mappedDataTable || !unmappedDataTable) {
        console.error('UI模块: 表格元素未初始化');
        return;
    }
    
    // 获取数据
    const mappedCounties = getMappedCounties();
    const unmappedCounties = getUnmappedCounties();
    
    // 更新已映射数据表格
    updateTable(mappedDataTable, mappedCounties);
    
    // 更新未映射数据表格
    updateTable(unmappedDataTable, unmappedCounties);

    // 更新数据显示条数
    const mappedCountEl = document.getElementById('mapped-data-count');
    const unmappedCountEl = document.getElementById('unmapped-data-count');
    
    if (mappedCountEl) mappedCountEl.textContent = mappedCounties.length;
    if (unmappedCountEl) unmappedCountEl.textContent = unmappedCounties.length;
    
    console.log('UI模块: 表格更新完成');
}

/**
 * 更新表格数据
 * @param {HTMLElement} tableElement - 表格元素
 * @param {Array} dataArray - 数据数组
 */
function updateTable(tableElement, dataArray) {
    if (!tableElement) return;
    
    const tbody = tableElement.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    dataArray.forEach(data => {
        const tr = document.createElement('tr');
        tr.dataset.county = data.county;
        
        // 添加省份单元格
        const provinceTd = document.createElement('td');
        provinceTd.textContent = data.province;
        tr.appendChild(provinceTd);
        
        // 添加城市单元格
        const cityTd = document.createElement('td');
        cityTd.textContent = data.city;
        tr.appendChild(cityTd);
        
        // 添加县名单元格
        const countyTd = document.createElement('td');
        countyTd.textContent = data.county;
        tr.appendChild(countyTd);
        
        // 添加县总代单元格
        const agentNameTd = document.createElement('td');
        agentNameTd.textContent = data.name || '暂无';
        tr.appendChild(agentNameTd);
        
        // 添加联系电话单元格
        const phoneTd = document.createElement('td');
        phoneTd.textContent = data.phone || '暂无';
        tr.appendChild(phoneTd);
        
        // 添加操作单元格
        const actionTd = document.createElement('td');
        actionTd.className = 'action-cell';
        
        // 添加编辑按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', () => {
            // 将行切换为编辑模式
            toggleRowEditMode(tr, data);
        });
        
        actionTd.appendChild(editBtn);
        
        // 添加删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        
        // 这里注册事件但具体实现会委托给main.js
        deleteBtn.addEventListener('click', () => {
            // 触发自定义事件，传递要删除的县名
            const event = new CustomEvent('ui:deleteCounty', {
                detail: { county: data.county }
            });
            document.dispatchEvent(event);
        });
        
        actionTd.appendChild(deleteBtn);
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
    });
}

/**
 * 切换行的编辑模式
 * @param {HTMLElement} tr - 表格行
 * @param {Object} data - 行数据
 */
function toggleRowEditMode(tr, data) {
    const cells = tr.querySelectorAll('td');
    const isEditing = tr.classList.contains('editing');
    
    if (isEditing) {
        // 已经是编辑模式，切换回显示模式
        tr.classList.remove('editing');
        
        // 恢复单元格内容
        cells[0].textContent = data.province || '暂无'; // 省份
        cells[1].textContent = data.city || '暂无'; // 城市
        cells[2].textContent = data.county || '暂无'; // 县名
        cells[3].textContent = data.name || '暂无'; // 县总代
        cells[4].textContent = data.phone || '暂无'; // 联系电话
        
        // 恢复操作按钮
        const actionCell = cells[5];
        actionCell.innerHTML = '';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', () => toggleRowEditMode(tr, data));
        actionCell.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => {
            const event = new CustomEvent('ui:deleteCounty', {
                detail: { county: data.county }
            });
            document.dispatchEvent(event);
        });
        actionCell.appendChild(deleteBtn);
        
    } else {
        // 切换到编辑模式
        tr.classList.add('editing');
        
        // 替换单元格内容为输入框
        const provinceInput = document.createElement('input');
        provinceInput.value = data.province || '';
        provinceInput.placeholder = '省份';
        cells[0].innerHTML = '';
        cells[0].appendChild(provinceInput);
        
        const cityInput = document.createElement('input');
        cityInput.value = data.city || '';
        cityInput.placeholder = '城市';
        cells[1].innerHTML = '';
        cells[1].appendChild(cityInput);
        
        const countyInput = document.createElement('input');
        countyInput.value = data.county || '';
        countyInput.placeholder = '县名';
        cells[2].innerHTML = '';
        cells[2].appendChild(countyInput);
        
        const agentNameInput = document.createElement('input');
        agentNameInput.value = data.name || '';
        agentNameInput.placeholder = '县总代姓名';
        cells[3].innerHTML = '';
        cells[3].appendChild(agentNameInput);
        
        const phoneInput = document.createElement('input');
        phoneInput.value = data.phone || '';
        phoneInput.placeholder = '联系电话';
        cells[4].innerHTML = '';
        cells[4].appendChild(phoneInput);
        
        // 替换操作按钮
        const actionCell = cells[5];
        actionCell.innerHTML = '';
        
        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '保存';
        saveBtn.addEventListener('click', () => {
            // 获取输入的值
            const newProvince = provinceInput.value;
            const newCity = cityInput.value;
            const newCounty = countyInput.value;
            const newAgentName = agentNameInput.value;
            const newAgentPhone = phoneInput.value;
            
            // 触发自定义事件传递给main.js处理
            const event = new CustomEvent('ui:updateCounty', {
                detail: { 
                    oldCounty: data.county,
                    province: newProvince,
                    city: newCity,
                    county: newCounty,
                    agentName: newAgentName,
                    agentPhone: newAgentPhone,
                    tr: tr
                }
            });
            document.dispatchEvent(event);
        });
        actionCell.appendChild(saveBtn);
        
        // 取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', () => toggleRowEditMode(tr, data));
        actionCell.appendChild(cancelBtn);
    }
}

/**
 * 在地图上显示搜索结果
 * @param {string} message - 消息文本
 * @param {string} type - 消息类型 (success, error, info)
 */
export function showSearchResult(message, type = 'success') {
    if (!searchResult || !searchResultText) return;
    
    // 设置消息文本
    searchResultText.textContent = message;
    
    // 清除所有样式类
    searchResult.classList.remove('success', 'error', 'info');
    
    // 添加对应类型的样式
    searchResult.classList.add(type);
    
    // 显示结果区域
    searchResult.classList.remove('hidden');
}

/**
 * 打开添加新县总代模态框
 */
export function openAddAgentModal() {
    if (!addAgentModal) return;
    
    // 清空输入框
    const inputs = addAgentModal.querySelectorAll('input');
    inputs.forEach(input => input.value = '');
    
    // 显示模态框
    addAgentModal.classList.remove('hidden');
}

/**
 * 关闭添加新县总代模态框
 */
export function closeAddAgentModal() {
    if (!addAgentModal) return;
    
    // 隐藏模态框
    addAgentModal.classList.add('hidden');
}

/**
 * 打开或关闭搜索模态框
 * @param {boolean} open - true为打开，false为关闭
 */
export function toggleSearchModal(open) {
    if (!searchModal) return;
    
    if (open) {
        searchModal.classList.remove('hidden');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        if (searchResult) {
            searchResult.classList.add('hidden');
        }
    } else {
        searchModal.classList.add('hidden');
    }
}

/**
 * 打开或关闭管理员抽屉
 * @param {boolean} open - true为打开，false为关闭
 */
export function toggleAdminDrawer(open) {
    if (!adminDrawer) return;
    
    if (open) {
        adminDrawer.classList.add('active');
        // 触发窗口调整，确保表格正确显示
        window.dispatchEvent(new Event('resize'));
    } else {
        adminDrawer.classList.remove('active');
    }
}

/**
 * 设置选中的县
 * @param {Object} county - leaflet图层对象
 */
export function setSelectedCounty(county) {
    selectedCounty = county;
}

/**
 * 获取选中的县
 * @returns {Object} 当前选中的县
 */
export function getSelectedCounty() {
    return selectedCounty;
}

/**
 * 重置选中县的状态
 */
export function resetSelectedCounty() {
    if (selectedCounty) {
        resetFeatureStyle(selectedCounty);
        selectedCounty = null;
    }
}

/**
 * 更新认证UI状态
 * @param {Object} authInfo - 认证信息 {isLoggedIn, isAdmin, username}
 */
export function updateAuthUI(authInfo) {
    if (!loginSection || !userSection || !userInfo) return;
    
    const { isLoggedIn, isAdmin, username } = authInfo;
    
    console.log('更新认证UI状态:', { isLoggedIn, isAdmin, username });
    
    // 根据登录状态显示/隐藏相关区域
    if (isLoggedIn && isAdmin) {
        // 只有管理员才能真正登录
        loginSection.classList.add('hidden');
        userSection.classList.remove('hidden');
        userInfo.textContent = '管理员已登录';
        if (adminPanel) adminPanel.classList.remove('hidden');
        if (drawerToggleBtn) drawerToggleBtn.classList.remove('hidden');
    } else {
        // 未登录或非管理员（非管理员在本系统中视为未登录）
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
        userInfo.textContent = '请登录';
        if (adminPanel) adminPanel.classList.add('hidden');
        if (drawerToggleBtn) drawerToggleBtn.classList.add('hidden');
        
        // 不再主动清除token，避免刷新页面时丢失登录状态
        // 如果有问题的登录状态，让后端API来处理
        if (isLoggedIn && !isAdmin) {
            console.log('检测到非管理员登录，但保持状态不变');
            // 不再主动清除token
        }
    }
}

/**
 * 显示县选择对话框
 * @param {Array} counties - 匹配的县列表
 */
export function showCountySelectionDialog(counties) {
    // 创建对话框元素
    const dialog = document.createElement('div');
    dialog.className = 'county-selection-dialog';
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3>请选择县</h3>
            <span class="close-btn">&times;</span>
        </div>
        <div class="dialog-body">
            <ul class="county-list"></ul>
        </div>
    `;
    
    // 添加对话框到文档
    document.body.appendChild(dialog);
    
    // 获取列表元素
    const countyList = dialog.querySelector('.county-list');
    
    // 填充县列表
    counties.forEach(county => {
        const li = document.createElement('li');
        li.textContent = county.properties.name;
        li.addEventListener('click', () => {
            // 触发自定义事件
            const event = new CustomEvent('ui:countySelected', {
                detail: { 
                    name: county.properties.name,
                    gb: county.properties.gb
                }
            });
            document.dispatchEvent(event);
            
            // 关闭对话框
            document.body.removeChild(dialog);
        });
        countyList.appendChild(li);
    });
    
    // 添加关闭按钮事件
    const closeBtn = dialog.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
    
    // 点击对话框外部关闭
    document.addEventListener('click', function closeDialog(e) {
        if (!dialog.contains(e.target)) {
            document.body.removeChild(dialog);
            document.removeEventListener('click', closeDialog);
        }
    });
}

/**
 * 获取选中的搜索类型
 * @returns {string} 搜索类型 ('agent' 或 'county')
 */
export function getSelectedSearchType() {
    if (!searchTypeRadios) return 'agent';
    
    for (const radio of searchTypeRadios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'agent'; // 默认按人名搜索
}

/**
 * 初始化UI模块
 */
export function initUI() {
    // 订阅事件监听
    window.addEventListener('authStatusChanged', (event) => {
        updateAuthUI({
            isLoggedIn: event.detail.isLoggedIn || false,
            isAdmin: event.detail.isAdmin || false,
            username: event.detail.username || ''
        });
    });
    
    console.log('UI模块: 初始化完成');
}