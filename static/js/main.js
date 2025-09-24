// 全局变量
let map;
let geojsonLayer;
let selectedCounty = null;
let isAdmin = false;
let token = localStorage.getItem('token');
let mappedCounties = []; // 已在地图上正确映射的县
let unmappedCounties = []; // 未在地图上正确映射的县
let csrfToken = localStorage.getItem('csrfToken'); // CSRF令牌

// Toast通知元素
let toastContainer = null;

// DOM元素
const loginSection = document.getElementById('login-section');
const userSection = document.getElementById('user-section');
const userInfo = document.getElementById('user-info');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const infoPanel = document.getElementById('info-panel');
const countyName = document.getElementById('county-name');
const agentName = document.getElementById('agent-name');
const agentPhone = document.getElementById('agent-phone');
const adminPanel = document.getElementById('admin-panel');
const editAgentName = document.getElementById('edit-agent-name');
const editAgentPhone = document.getElementById('edit-agent-phone');
const updateBtn = document.getElementById('update-btn');
const infoPanelCloseBtn = document.getElementById('info-panel-close-btn');

// 抽屉控件DOM元素
const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
const adminDrawer = document.getElementById('admin-drawer');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerResizer = document.getElementById('drawer-resizer');
const mappedDataTable = document.getElementById('mapped-data-table');
const unmappedDataTable = document.getElementById('unmapped-data-table');
const mappedDataSection = document.getElementById('mapped-data-section');
const unmappedDataSection = document.getElementById('unmapped-data-section');

// 新增模态框DOM元素
const addAgentModal = document.getElementById('add-agent-modal');
const addNewBtn = document.getElementById('add-new-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const saveNewAgentBtn = document.getElementById('save-new-agent-btn');

// 搜索相关DOM元素
let searchBtn, searchModal, searchModalCloseBtn, searchInput, doSearchBtn, searchResult, searchResultText, searchTypeRadios;

// 初始化DOM元素函数
function initDOMElements() {
    // 搜索相关DOM元素
    searchBtn = document.getElementById('search-btn');
    searchModal = document.getElementById('search-modal');
    searchModalCloseBtn = document.getElementById('search-modal-close-btn');
    searchInput = document.getElementById('search-input');
    doSearchBtn = document.getElementById('do-search-btn');
    searchResult = document.getElementById('search-result');
    searchResultText = document.getElementById('search-result-text');
    searchTypeRadios = document.getElementsByName('search-type');
    
    console.log('初始化DOM元素:');
    console.log('searchBtn:', searchBtn);
    console.log('searchModal:', searchModal);
    console.log('searchModalCloseBtn:', searchModalCloseBtn);
}

// 调试输出
console.log('搜索相关DOM元素:');
console.log('searchBtn:', searchBtn);
console.log('searchModal:', searchModal);
console.log('searchModalCloseBtn:', searchModalCloseBtn);
console.log('searchInput:', searchInput);
console.log('doSearchBtn:', doSearchBtn);
console.log('searchResult:', searchResult);
console.log('searchResultText:', searchResultText);
console.log('searchTypeRadios:', searchTypeRadios);

// 创建Toast通知容器
function createToastContainer() {
    // 如果已存在容器，则不重复创建
    if (document.querySelector('.toast-container')) {
        toastContainer = document.querySelector('.toast-container');
        return;
    }
    
    // 创建Toast容器
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
}

// 显示Toast通知
function showToast(message, type = 'success') {
    // 确保容器存在
    if (!toastContainer) {
        createToastContainer();
    }
    
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 强制重绘以触发动画
    void toast.offsetWidth;
    
    // 设置动画结束后移除
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 获取CSRF令牌
async function getCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        
        if (data.status === 'success') {
            csrfToken = data.csrf_token;
            localStorage.setItem('csrfToken', csrfToken);
        }
    } catch (error) {
        console.error('获取CSRF令牌失败:', error);
    }
}

// 密码加密函数
function encryptPassword(password) {
    try {
        // 检查CryptoJS是否存在
        if (typeof CryptoJS === 'undefined') {
            console.error('CryptoJS is not loaded');
            throw new Error('CryptoJS库未正确加载');
        }
        
        // 使用CryptoJS进行更安全的加密
        const salt = "aiheliSalt2023";
        const saltedPassword = password + salt;
        
        // 先进行SHA256哈希
        const hashedPassword = CryptoJS.SHA256(saltedPassword).toString();
        
        // 再进行AES加密，使用固定密钥
        const secretKey = "aiheli2023SecretKey";
        const encrypted = CryptoJS.AES.encrypt(hashedPassword, secretKey).toString();
        
        return encrypted;
    } catch (error) {
        console.error('加密密码时发生错误:', error);
        throw new Error('密码加密失败: ' + error.message);
    }
}

// 初始化抽屉状态和设置函数
function initDrawerSettings() {
    adminDrawer.classList.remove('active');
    
    // 设置抽屉部分的初始高度
    const drawerHeight = adminDrawer.offsetHeight;
    mappedDataSection.style.height = `${drawerHeight / 2}px`;
    unmappedDataSection.style.height = `${drawerHeight / 2}px`;
    mappedDataSection.style.flex = 'none';
    unmappedDataSection.style.flex = 'none';
}

// 检查认证状态
function checkAuthStatus() {
    if (token) {
        // 这里可以添加token验证逻辑
        // 简化处理：如果有token就认为已登录
        loginSection.classList.add('hidden');
        userSection.classList.remove('hidden');
        userInfo.textContent = '已登录';
        
        // 检查是否是管理员（从localStorage获取）
        isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (isAdmin) {
            userInfo.textContent = '管理员已登录';
            adminPanel.classList.remove('hidden');
            drawerToggleBtn.classList.remove('hidden'); // 显示管理数据按钮
        } else {
            drawerToggleBtn.classList.add('hidden'); // 隐藏管理数据按钮
        }
    } else {
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
        adminPanel.classList.add('hidden');
        drawerToggleBtn.classList.add('hidden'); // 隐藏管理数据按钮
    }
}

// 初始化地图
function initMap() {
    // 创建地图实例，设置中国的中心坐标和缩放级别
    map = L.map('map', {
        zoomControl: false,  // 禁用默认的缩放控件
        attributionControl: false,  // 禁用默认的归属控件
        maxBounds: [
            [3.86, 73.55],  // 西南角坐标（中国区域扩展一些）
            [65.0, 135.09]  // 东北角坐标（放宽北部边界，留出更多上方空间）
        ],
        maxBoundsViscosity: 1.0,  // 设置为1.0表示完全限制在边界内
        wheelPxPerZoomLevel: 240,  // 增大滚轮缩放的像素阈值，降低缩放灵敏度（默认值为60）
        zoomSnap: 0.25,  // 设置缩放级别的最小变化量（默认为1，降低可实现更平滑的缩放）
        zoomDelta: 0.25,  // 设置缩放按钮和滚轮每次缩放的级别变化量（默认为1）
        wheelDebounceTime: 100  // 增加滚轮事件的防抖时间，减少频繁触发（默认为40ms）
    }).setView([35.86166, 104.195397], 4);
    
    // 添加底图图层（使用高德地图）
    L.tileLayer('https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        maxZoom: 18
    }).addTo(map);
    
    // 添加自定义位置的归属控件（右下角但位置较高，避免被页脚遮挡）
    L.control.attribution({
        position: 'bottomright',
        prefix: false
    }).addAttribution('© 高德地图').addTo(map);
    
    // 添加自定义位置的缩放控件（左下角）
    L.control.zoom({
        position: 'bottomleft'
    }).addTo(map);
}

// 加载GeoJSON数据
async function loadGeoJSON() {
    try {
        const headers = {};
        
        // 如果有CSRF令牌，添加到请求头
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
        
        const response = await fetch('/api/geojson', { headers });
        
        // 检查并更新CSRF令牌（如果在响应头中）
        const newCsrfToken = response.headers.get('X-CSRF-Token');
        if (newCsrfToken) {
            csrfToken = newCsrfToken;
            localStorage.setItem('csrfToken', csrfToken);
        }
        
        const data = await response.json();
        
        // 创建GeoJSON图层但暂不添加数据
        geojsonLayer = L.geoJSON(null, {
            style: styleCounty,
            onEachFeature: onEachCounty
        }).addTo(map);
        
        // 存储GeoJSON数据以便后续使用
        window.geojsonData = data;
    } catch (error) {
        console.error('加载GeoJSON数据失败:', error);
        alert('加载地图数据失败，请刷新页面重试');
    }
}

// 加载县总代数据
async function loadAgentsData() {
    try {
        const headers = {};
        
        // 如果有token，添加认证头
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // 如果有CSRF令牌，添加到请求头
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
        
        // 添加时间戳参数防止缓存
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/agents?_t=${timestamp}`, { 
            headers,
            cache: 'no-cache' // 禁用缓存
        });
        
        if (!response.ok) {
            // 如果响应不成功，可能是权限问题
            if (response.status === 401) {
                console.log('未授权访问，可能需要重新登录');
                // 清除管理员状态
                isAdmin = false;
                localStorage.removeItem('isAdmin');
                // 更新UI
                adminPanel.classList.add('hidden');
                drawerToggleBtn.classList.add('hidden');
                userInfo.textContent = '请重新登录';
            }
            throw new Error(`请求失败: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // 存储县总代数据
            window.agentsData = result.data;
            
            // 如果返回了is_admin字段，更新本地状态
            if (result.is_admin !== undefined) {
                isAdmin = result.is_admin;
                localStorage.setItem('isAdmin', isAdmin);
                
                // 根据管理员权限更新UI
                if (isAdmin) {
                    adminPanel.classList.remove('hidden');
                    drawerToggleBtn.classList.remove('hidden');
                    userInfo.textContent = '管理员已登录';
                } else {
                    adminPanel.classList.add('hidden');
                    drawerToggleBtn.classList.add('hidden');
                    userInfo.textContent = '普通用户已登录';
                }
            }
            
            // 更新GeoJSON图层，应用县总代数据
            updateGeoJSONWithAgents();
            
            // 分类县总代数据为已映射和未映射
            categorizeCountyData();
            
            // 始终更新抽屉中的数据表格，不管抽屉是否打开
            // 这样可以确保数据始终是最新的，无论抽屉状态如何
            updateDrawerTables();
            
            // 如果返回了新的CSRF令牌，更新它
            if (result.csrf_token) {
                csrfToken = result.csrf_token;
                localStorage.setItem('csrfToken', csrfToken);
            }
        } else {
            console.error('加载县总代数据失败:', result.message);
        }
    } catch (error) {
        console.error('加载县总代数据失败:', error);
    }
}

// 分类县总代数据为已映射和未映射
function categorizeCountyData() {
    if (!window.agentsData || !window.geojsonData) return;
    
    // 重置数组
    mappedCounties = [];
    unmappedCounties = [];
    
    // 创建GeoJSON中所有GB代码的映射 (GeoJSON数据中使用gb字段)
    const geojsonGBCodes = {};
    window.geojsonData.features.forEach(feature => {
        if (feature.properties && feature.properties.gb) {
            geojsonGBCodes[feature.properties.gb] = true;
        }
    });
    
    // 遍历所有县总代数据
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            for (const county in window.agentsData[province][city]) {
                const countyData = {
                    province: province,
                    city: city,
                    county: county,
                    ...window.agentsData[province][city][county]
                };
                
                // 检查GB代码是否在GeoJSON中存在
                if (countyData.gb_code && geojsonGBCodes[countyData.gb_code]) {
                    mappedCounties.push(countyData);
                } else {
                    unmappedCounties.push(countyData);
                }
            }
        }
    }
    
    console.log(`已映射县总代数据: ${mappedCounties.length}个`);
    console.log(`未映射县总代数据: ${unmappedCounties.length}个`);
}

// 更新GeoJSON图层，应用县总代数据
function updateGeoJSONWithAgents() {
    if (!window.geojsonData || !window.agentsData) return;
    
    // 清空当前图层
    geojsonLayer.clearLayers();
    
    // 添加带有县总代信息的GeoJSON数据
    geojsonLayer.addData(window.geojsonData);
    
    // 调整地图视图以适应GeoJSON图层
    map.fitBounds(geojsonLayer.getBounds());
}

// 县区域样式函数
function styleCounty(feature) {
    // 检查是否有县总代，传递feature参数以便使用GB代码匹配
    const hasAgent = checkCountyHasAgent(feature);
    
    return {
        fillColor: hasAgent ? '#27ae60' : '#bdc3c7',
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// 检查县是否有县总代
function checkCountyHasAgent(feature) {
    if (!window.agentsData || !feature || !feature.properties) return false;
    
    // 从feature中获取GB代码 (GeoJSON数据中使用gb字段)
    const gbCode = feature.properties.gb;
    if (!gbCode) return false;
    
    // 遍历所有省市县数据查找匹配
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            // 遍历该市下的所有县
            for (const county in window.agentsData[province][city]) {
                // 只检查GB代码是否匹配
                const countyData = window.agentsData[province][city][county];
                if (countyData.gb_code && countyData.gb_code === gbCode) {
                    return countyData.has_agent;
                }
            }
        }
    }
    
    return false;
}

// 获取县总代信息
function getCountyAgentInfo(countyName, feature) {
    if (!window.agentsData || !feature || !feature.properties) return null;
    
    // 从feature中获取GB代码 (GeoJSON数据中使用gb字段)
    const gbCode = feature.properties.gb;
    if (!gbCode) return null;
    
    // 遍历所有省市县数据查找匹配
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            // 遍历该市下的所有县
            for (const county in window.agentsData[province][city]) {
                // 只检查GB代码是否匹配
                const countyData = window.agentsData[province][city][county];
                if (countyData.gb_code && countyData.gb_code === gbCode) {
                    // 添加省份信息到返回数据中
                    countyData.province = province;
                    countyData.city = city;
                    return countyData;
                }
            }
        }
    }
    
    return null;
}

// 为每个县添加交互
function onEachCounty(feature, layer) {
    const countyName = feature.properties.name;
    const agentInfo = getCountyAgentInfo(countyName, feature);
    
    // 添加弹出框
    layer.bindPopup(() => {
        const popupContent = document.createElement('div');
        popupContent.className = 'county-popup';
        
        const title = document.createElement('h3');
        title.textContent = countyName;
        popupContent.appendChild(title);
        
        const status = document.createElement('p');
        if (agentInfo && agentInfo.has_agent) {
            status.innerHTML = `<strong>状态：</strong><span style="color: #27ae60;">已有县总代</span>`;
        } else {
            status.innerHTML = `<strong>状态：</strong><span style="color: #e74c3c;">暂无县总代</span>`;
        }
        popupContent.appendChild(status);
        
        // 移除查看详情按钮，因为点击县区域时已经直接显示详情
        
        return popupContent;
    });
    
    // 添加点击事件
    layer.on({
        click: () => {
            // 重置之前选中的县样式
            if (selectedCounty) {
                geojsonLayer.resetStyle(selectedCounty);
            }
            
            // 设置新选中的县样式
            layer.setStyle({
                weight: 3,
                color: '#3498db',
                dashArray: '',
                fillOpacity: 0.7
            });
            
            selectedCounty = layer;
            
            // 直接显示县详情，省略点击查看详情按钮的步骤
            // 传递feature参数以便使用GB代码匹配
            showCountyDetails(countyName, feature);
        }
    });
}

// 显示县详细信息
function showCountyDetails(countyName, feature) {
    // 显示信息面板
    infoPanel.classList.remove('hidden');
    
    // 设置县名
    document.getElementById('county-name').textContent = countyName || '未知';
    console.log('显示县详情:', countyName);
    
    // 获取县总代信息，传递feature参数以便使用GB代码匹配
    const agentInfo = getCountyAgentInfo(countyName, feature);
    console.log('获取到的代理信息:', agentInfo);
    
    // 添加权限提示信息
    const permissionNote = document.getElementById('permission-note');
    if (permissionNote) {
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
    if (agentInfo && agentInfo.province) {
        provinceName.textContent = agentInfo.province || '暂无';
    } else {
        provinceName.textContent = '暂无';
    }
    
    if (agentInfo && agentInfo.has_agent) {
        document.getElementById('agent-name').textContent = agentInfo.name || '暂无';
        document.getElementById('agent-phone').textContent = agentInfo.phone || '暂无';
        
        // 如果是管理员，设置编辑表单的值
        if (isAdmin) {
            editAgentName.value = agentInfo.name || '';
            editAgentPhone.value = agentInfo.phone || '';
        }
    } else {
        document.getElementById('agent-name').textContent = '暂无';
        document.getElementById('agent-phone').textContent = '暂无';
        
        // 如果是管理员，清空编辑表单
        if (isAdmin) {
            editAgentName.value = '';
            editAgentPhone.value = '';
        }
    }
}

// 更新抽屉中的数据表格
function updateDrawerTables() {
    // 更新已映射数据表格
    updateTable(mappedDataTable, mappedCounties);
    
    // 更新未映射数据表格
    updateTable(unmappedDataTable, unmappedCounties);

    // 更新数据显示条数
    document.getElementById('mapped-data-count').textContent = mappedCounties.length;
    document.getElementById('unmapped-data-count').textContent = unmappedCounties.length;
}

// 更新表格数据
function updateTable(tableElement, dataArray) {
    const tbody = tableElement.querySelector('tbody');
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
        deleteBtn.addEventListener('click', () => {
            deleteCounty(data.county);
        });
        actionTd.appendChild(deleteBtn);
        
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
    });
}

// 切换行的编辑模式
function toggleRowEditMode(tr, data) {
    const cells = tr.querySelectorAll('td');
    const isEditing = tr.classList.contains('editing');
    
    if (isEditing) {
        // 已经是编辑模式，切换回显示模式
        tr.classList.remove('editing');
        
        // 恢复单元格内容
        cells[3].textContent = data.name || '暂无'; // 县总代
        cells[4].textContent = data.phone || '暂无'; // 联系电话
        
        // 恢复操作按钮
        cells[5].innerHTML = '';
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', () => {
            toggleRowEditMode(tr, data);
        });
        cells[5].appendChild(editBtn);

        // 添加删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => {
            deleteCounty(data.county);
        });
        cells[5].appendChild(deleteBtn);
    } else {
        // 切换到编辑模式
        tr.classList.add('editing');
        
        // 县总代单元格改为输入框
        const agentNameCell = cells[3];
        agentNameCell.innerHTML = '';
        agentNameCell.className = 'edit-cell';
        const agentNameInput = document.createElement('input');
        agentNameInput.type = 'text';
        agentNameInput.value = data.name || '';
        agentNameCell.appendChild(agentNameInput);
        
        // 联系电话单元格改为输入框
        const phoneCell = cells[4];
        phoneCell.innerHTML = '';
        phoneCell.className = 'edit-cell';
        const phoneInput = document.createElement('input');
        phoneInput.type = 'text';
        phoneInput.value = data.phone || '';
        phoneCell.appendChild(phoneInput);
        
        // 修改操作按钮
        const actionCell = cells[5];
        actionCell.innerHTML = '';
        
        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '保存';
        saveBtn.addEventListener('click', async () => {
            // 获取输入的值
            const newAgentName = agentNameInput.value;
            const newAgentPhone = phoneInput.value;
            
            // 调用API更新数据
            await updateCountyAgent(data.county, newAgentName, newAgentPhone, tr);
        });
        actionCell.appendChild(saveBtn);
        
        // 取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', () => {
            // 取消编辑
            toggleRowEditMode(tr, data);
        });
        
        actionCell.appendChild(saveBtn);
        actionCell.appendChild(cancelBtn);
    }
}

// 更新县总代信息
async function updateCountyAgent(countyName, agentName, agentPhone, tr) {
    if (!agentName || !agentPhone) {
        alert('请输入县总代姓名和电话');
        return;
    }
    
    try {
        // 如果没有CSRF令牌，先获取
        if (!csrfToken) {
            await getCsrfToken();
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        
        // 添加CSRF令牌到请求头
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
        
        const response = await fetch(`/api/county/${countyName}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                agent_name: agentName,
                agent_phone: agentPhone,
                csrf_token: csrfToken // 在请求体中也包含CSRF令牌
            })
        });
        
        const result = await response.json();
        
        // 如果返回了新的CSRF令牌，更新它
        if (result.csrf_token) {
            csrfToken = result.csrf_token;
            localStorage.setItem('csrfToken', csrfToken);
        }
        
        if (result.status === 'success') {
            alert('更新成功');
            
            // 重新加载县总代数据
            await loadAgentsData();
            
            // 如果当前选中的县是被更新的县，更新详情面板
            const currentCountyName = document.getElementById('county-name').textContent;
            if (currentCountyName === countyName) {
                showCountyDetails(countyName);
            }
        } else {
            alert(result.message || '更新失败');
        }
    } catch (error) {
        console.error('更新失败:', error);
        alert('更新失败，请重试');
    }
}

// 初始化抽屉分割线拖拽功能
function initDrawerResizer() {
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
        
        // 确保两个部分都有最小高度
        if (newHeightTop > 100 && newHeightBottom > 100) {
            mappedDataSection.style.flex = 'none';
            unmappedDataSection.style.flex = 'none';
            mappedDataSection.style.height = `${newHeightTop}px`;
            unmappedDataSection.style.height = `${newHeightBottom}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = '';
        }
    });
}

// 绑定事件
function bindEvents() {
    // 登录按钮点击事件
    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }
        
        
        try {
            // 使用加密函数处理密码
            let encryptedPassword;
            try {
                encryptedPassword = encryptPassword(password);
            } catch (encryptError) {
                console.error('密码加密失败:', encryptError);
                alert(encryptError.message || '密码加密失败，请检查网络连接后重试');
                return;
            }

            // 如果没有CSRF令牌，先获取
            if (!csrfToken) {
                await getCsrfToken();
            }
            
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken // 添加CSRF令牌到请求头
                },
                body: JSON.stringify({ 
                    username, 
                    password: encryptedPassword, // 发送加密后的密码
                    csrf_token: csrfToken // 同时在请求体中也包含CSRF令牌
                })
            });

            
            const result = await response.json();
            
            if (result.status === 'success') {
                // 保存token、管理员状态和新的CSRF令牌
                localStorage.setItem('token', result.token);
                localStorage.setItem('isAdmin', result.is_admin);
                
                // 更新CSRF令牌
                if (result.csrf_token) {
                    csrfToken = result.csrf_token;
                    localStorage.setItem('csrfToken', csrfToken);
                }
                
                // 更新全局变量
                token = result.token;
                isAdmin = result.is_admin;
                
                // 更新UI
                checkAuthStatus();
                
                alert('登录成功');
            } else {
                alert(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            alert('登录失败，请检查网络连接后重试');
        }
    });
    
    // 退出按钮点击事件
    logoutBtn.addEventListener('click', async () => {
        try {
            // 如果有CSRF令牌和token，尝试发送安全退出请求
            if (csrfToken && token) {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ csrf_token: csrfToken })
                }).catch(err => console.warn('退出请求发送失败:', err));
            }
        } catch (error) {
            console.warn('安全退出请求失败:', error);
        } finally {
            // 无论服务器响应如何，都清除本地存储
            // 清除token、管理员状态和CSRF令牌
            localStorage.removeItem('token');
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('csrfToken');
            
            // 更新全局变量
            token = null;
            isAdmin = false;
            csrfToken = null;
            
            // 更新UI
            checkAuthStatus();
            
            // 隐藏信息面板和抽屉
            infoPanel.classList.add('hidden');
            adminDrawer.classList.remove('active');
            
            alert('已退出登录');
        }
    });
    
    // 更新按钮点击事件
    updateBtn.addEventListener('click', async () => {
        if (!selectedCounty) {
            alert('请先选择一个县');
            return;
        }
        
        const countyNameValue = document.getElementById('county-name').textContent;
        const newAgentName = editAgentName.value;
        const newAgentPhone = editAgentPhone.value;
        
        if (!newAgentName || !newAgentPhone) {
            alert('请输入县总代姓名和电话');
            return;
        }
        
        try {
            const response = await fetch(`/api/county/${countyNameValue}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_name: newAgentName,
                    agent_phone: newAgentPhone
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                alert('更新成功');
                
                // 重新加载县总代数据
                await loadAgentsData();
                
                // 更新详情面板
                showCountyDetails(countyNameValue);
            } else {
                alert(result.message || '更新失败');
            }
        } catch (error) {
            console.error('更新失败:', error);
            alert('更新失败，请重试');
        }
    });
    
    // 抽屉开关按钮点击事件
    drawerToggleBtn.addEventListener('click', () => {
        adminDrawer.classList.toggle('active');
        
        // 如果抽屉被打开，加载数据
        if (adminDrawer.classList.contains('active')) {
            updateDrawerTables();
        }
    });
    
    // 抽屉关闭按钮点击事件
    drawerCloseBtn.addEventListener('click', () => {
        adminDrawer.classList.remove('active');
    });
    
    // 初始化抽屉分割线拖拽功能
    initDrawerResizer();

    // 新增按钮点击事件
    addNewBtn.addEventListener('click', () => {
        addAgentModal.classList.remove('hidden');
    });

    // 模态框关闭按钮点击事件
    modalCloseBtn.addEventListener('click', () => {
        addAgentModal.classList.add('hidden');
    });

    // 保存新县总代按钮点击事件
    saveNewAgentBtn.addEventListener('click', handleAddNewAgent);

    // 信息面板关闭按钮事件
    infoPanelCloseBtn.addEventListener('click', () => {
        infoPanel.classList.add('hidden');
        // 如果有选中的县，重置其样式
        if (selectedCounty) {
            geojsonLayer.resetStyle(selectedCounty);
            selectedCounty = null;
        }
    });
    
    // 搜索按钮点击事件
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchModal.classList.remove('hidden');
            searchInput.value = '';
            searchResult.classList.add('hidden');
            searchInput.focus();
        });
    }
    
    // 搜索浮窗关闭按钮点击事件
    if (searchModalCloseBtn) {
        searchModalCloseBtn.addEventListener('click', () => {
            searchModal.classList.add('hidden');
        });
    }
    
    // 搜索按钮点击事件
    if (doSearchBtn) {
        doSearchBtn.addEventListener('click', performSearch);
    }
    
    // 搜索输入框回车事件
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}

// 初始化函数
async function init() {
    console.log('init函数被调用');
    
    // 初始化DOM元素
    initDOMElements();
    
    // 获取CSRF令牌
    await getCsrfToken();
    
    // 检查登录状态
    checkAuthStatus();
    
    // 初始化地图
    initMap();
    
    // 加载GeoJSON数据
    await loadGeoJSON();
    
    // 加载县总代数据
    await loadAgentsData();
    
    // 初始化抽屉设置
    initDrawerSettings();
    
    // 绑定事件
    console.log('调用bindEvents函数');
    bindEvents();
    
    // 创建Toast容器
    createToastContainer();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 处理新增县总代
async function handleAddNewAgent() {
    const newProvince = document.getElementById('new-province').value.trim();
    const newCity = document.getElementById('new-city').value.trim();
    const newCounty = document.getElementById('new-county').value.trim();
    const newAgentName = document.getElementById('new-agent-name').value.trim();
    const newAgentPhone = document.getElementById('new-agent-phone').value.trim();
    const newGdp = document.getElementById('new-gdp').value.trim();
    const newPopulation = document.getElementById('new-population').value.trim();

    if (!newProvince || !newCity || !newCounty || !newAgentName || !newAgentPhone) {
        alert('所有字段均为必填项');
        return;
    }

    try {
        const response = await fetch('/api/county', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                province: newProvince,
                city: newCity,
                county: newCounty,
                agent_name: newAgentName,
                agent_phone: newAgentPhone,
                gdp: newGdp,
                population: newPopulation,
                csrf_token: csrfToken // 在请求体中也包含CSRF令牌
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('新增成功');
            addAgentModal.classList.add('hidden');
            loadAgentsData(); // 重新加载数据
        } else {
            alert(`新增失败: ${result.message}`);
        }
    } catch (error) {
        console.error('新增县总代失败:', error);
        alert('新增县总代失败，请稍后重试');
    }
}

// 处理抽屉拖动
function handleDrawerResize(e) {
    const drawerRect = adminDrawer.getBoundingClientRect();
}

// 删除县总代函数
async function deleteCounty(countyName) {
    if (!confirm(`确定要删除县总代："${countyName}"吗？此操作不可恢复。`)) {
        return;
    }

    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`/api/county/${countyName}`, {
            method: 'DELETE',
            headers: headers,
            body: JSON.stringify({ csrf_token: csrfToken }),
            cache: 'no-cache' // 禁用缓存
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast('删除成功');
            console.log('删除成功，开始重新加载数据...');
            
            // 清除现有数据缓存
            window.agentsData = null;
            mappedCounties = [];
            unmappedCounties = [];
            
            // 重新加载数据以更新地图和表格
            await loadAgentsData();
            
            // 强制更新抽屉表格
            updateDrawerTables();
            
            console.log('数据重新加载完成');
            console.log('已映射县数量:', mappedCounties.length);
            console.log('未映射县数量:', unmappedCounties.length);
            
            // 如果当前有选中的县，且是被删除的县，则关闭信息面板
            const currentCountyName = document.getElementById('county-name').textContent;
            if (currentCountyName === countyName) {
                infoPanel.classList.add('hidden');
                if (selectedCounty) {
                    geojsonLayer.resetStyle(selectedCounty);
                    selectedCounty = null;
                }
            }
        } else {
            showToast('删除失败: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('删除县总代失败:', error);
        showToast('删除县总代失败，请稍后重试', 'error');
    }
}

// 执行搜索
function performSearch() {
    const searchType = getSelectedSearchType();
    const searchText = searchInput.value.trim();
    
    if (!searchText) {
        showSearchResult('请输入搜索内容', 'error');
        return;
    }
    
    if (searchType === 'agent') {
        searchByAgentName(searchText);
    } else if (searchType === 'county') {
        searchByCountyName(searchText);
    }
}

// 获取选中的搜索类型
function getSelectedSearchType() {
    for (const radio of searchTypeRadios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'agent'; // 默认按人名搜索
}

// 按人名搜索
function searchByAgentName(agentName) {
    // 检查是否有县总代数据
    if (!window.agentsData || Object.keys(window.agentsData).length === 0) {
        showSearchResult('县总代数据加载失败，请刷新页面重试', 'error');
        return;
    }
    
    console.log('搜索县总代:', agentName);
    console.log('县总代数据类型:', typeof window.agentsData);
    
    // 在县总代数据中查找匹配的人名
    let found = false;
    let countyName = null;
    let provinceName = null;
    let cityName = null;
    
    // 遍历省份
    for (const province in window.agentsData) {
        // 遍历城市
        for (const city in window.agentsData[province]) {
            // 遍历县
            for (const county in window.agentsData[province][city]) {
                const countyData = window.agentsData[province][city][county];
                // 检查县总代姓名是否匹配
                if (countyData.name && countyData.name.includes(agentName)) {
                    found = true;
                    countyName = county;
                    provinceName = province;
                    cityName = city;
                    
                    console.log('找到县总代:', countyData.name, '所在县:', countyName);
                    // 找到匹配项后跳出循环
                    break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }
    
    if (!found) {
        showSearchResult('未找到该县总代', 'error');
        return;
    }
    
    if (!countyName) {
        showSearchResult('该县总代未填写县级信息', 'error');
        return;
    }
    
    // 在地图上查找并定位到对应的县
    locateCountyOnMap(countyName);
}

// 按县名搜索
function searchByCountyName(countyName) {
    if (!window.geojsonData) {
        showSearchResult('地图数据未加载', 'error');
        return;
    }
    
    // 查找匹配的县
    const matchedCounties = window.geojsonData.features.filter(feature => 
        feature.properties && 
        feature.properties.name && 
        feature.properties.name.includes(countyName)
    );
    
    if (matchedCounties.length === 0) {
        showSearchResult('未找到匹配的县', 'error');
        return;
    }
    
    if (matchedCounties.length === 1) {
        // 精确匹配，直接定位
        locateCountyOnMap(matchedCounties[0].properties.name);
        showSearchResult(`已定位到 ${matchedCounties[0].properties.name}`, 'success');
    } else {
        // 多个匹配结果，但只高亮第一个
        locateCountyOnMap(matchedCounties[0].properties.name);
        let resultText = `找到 ${matchedCounties.length} 个匹配的县，已定位到第一个:<br>`;
        matchedCounties.forEach((feature, index) => {
            resultText += `${index + 1}. ${feature.properties.name}<br>`;
        });
        resultText += '<br>请提供更具体的县名进行搜索。';
        showSearchResult(resultText, 'info');
    }
}

// 在地图上定位县
function locateCountyOnMap(countyName) {
    if (!window.geojsonData) return;
    
    // 遍历GeoJSON数据查找匹配的县
    window.geojsonData.features.some(feature => {
        if (feature.properties && 
            feature.properties.name === countyName) {
            
            // 获取图层 (GeoJSON数据中使用gb字段)
            const layer = window.geojsonLayer.getLayers().find(l => 
                l.feature.properties.gb === feature.properties.gb
            );
            
            if (layer) {
                // 重置所有图层样式
                window.geojsonLayer.eachLayer(l => {
                    l.setStyle(styleCounty(l.feature));
                });
                
                // 高亮显示匹配的图层
                layer.setStyle({
                    fillColor: '#ff0000',
                    color: '#ff0000',
                    weight: 2,
                    fillOpacity: 0.7
                });
                
                // 添加闪烁效果
                createBlinkEffect(layer);
                
                // 显示县详情
                showCountyDetails(feature.properties.name, feature);
                
                // 缩放到县位置
                map.fitBounds(layer.getBounds(), {
                    padding: [50, 50]
                });
                
                return true; // 找到后停止遍历
            }
        }
        return false;
    });
}

// 创建闪烁效果
function createBlinkEffect(layer) {
    const originalStyle = {
        weight: 3,
        color: '#3498db',
        dashArray: '',
        fillOpacity: 0.7
    };
    
    const highlightStyle = {
        weight: 3,
        color: '#2ecc71', // 更改为绿色，更符合页面风格
        dashArray: '',
        fillOpacity: 0.8
    };
    
    // 使用更平滑的动画效果
    let count = 0;
    const interval = setInterval(() => {
        if (count % 2 === 0) {
            layer.setStyle(highlightStyle);
        } else {
            layer.setStyle(originalStyle);
        }
        
        count++;
        if (count >= 4) { // 减少闪烁次数为2次
            clearInterval(interval);
            layer.setStyle(originalStyle);
        }
    }, 400); // 增加间隔时间，使动画更平滑
}

// 显示搜索结果
function showSearchResult(message, type = 'info') {
    searchResult.classList.remove('hidden', 'error', 'success');
    searchResult.classList.add(type);
    searchResultText.textContent = message;
}