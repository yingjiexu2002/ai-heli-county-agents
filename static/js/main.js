// 全局变量
let map;
let geojsonLayer;
let selectedCounty = null;
let isAdmin = false;
let token = localStorage.getItem('token');

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

// 初始化函数
async function init() {
    // 检查登录状态
    checkAuthStatus();
    
    // 初始化地图
    initMap();
    
    // 加载GeoJSON数据
    await loadGeoJSON();
    
    // 加载县总代数据
    await loadAgentsData();
    
    // 绑定事件
    bindEvents();
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
        }
    } else {
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
        adminPanel.classList.add('hidden');
    }
}

// 初始化地图
function initMap() {
    // 创建地图实例，设置中国的中心坐标和缩放级别
    map = L.map('map', {
        zoomControl: false,  // 禁用默认的缩放控件
        attributionControl: false  // 禁用默认的归属控件
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
        const response = await fetch('/api/geojson');
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
        const response = await fetch('/api/agents');
        const result = await response.json();
        
        if (result.status === 'success') {
            // 存储县总代数据
            window.agentsData = result.data;
            
            // 更新GeoJSON图层，应用县总代数据
            updateGeoJSONWithAgents();
        } else {
            console.error('加载县总代数据失败:', result.message);
        }
    } catch (error) {
        console.error('加载县总代数据失败:', error);
    }
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
    // 获取县名
    const countyName = feature.properties.name;
    
    // 检查是否有县总代
    const hasAgent = checkCountyHasAgent(countyName);
    
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
function checkCountyHasAgent(countyName) {
    if (!window.agentsData) return false;
    
    // 遍历所有省市县数据查找匹配
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            // 遍历该市下的所有县
            for (const county in window.agentsData[province][city]) {
                // 检查县名是否匹配
                if (county === countyName) {
                    return window.agentsData[province][city][county].has_agent;
                }
            }
        }
    }
    
    return false;
}

// 获取县总代信息
function getCountyAgentInfo(countyName) {
    if (!window.agentsData) return null;
    
    // 遍历所有省市县数据查找匹配
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            // 遍历该市下的所有县
            for (const county in window.agentsData[province][city]) {
                // 检查县名是否匹配
                if (county === countyName) {
                    return window.agentsData[province][city][county];
                }
            }
        }
    }
    
    return null;
}

// 为每个县添加交互
function onEachCounty(feature, layer) {
    const countyName = feature.properties.name;
    const agentInfo = getCountyAgentInfo(countyName);
    
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
            showCountyDetails(countyName);
        }
    });
}

// 显示县详细信息
function showCountyDetails(countyName) {
    // 显示信息面板
    infoPanel.classList.remove('hidden');
    
    // 设置县名
    document.getElementById('county-name').textContent = countyName || '未知';
    console.log('显示县详情:', countyName);
    
    // 获取县总代信息
    const agentInfo = getCountyAgentInfo(countyName);
    console.log('获取到的代理信息:', agentInfo);
    
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
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // 保存token和管理员状态
                localStorage.setItem('token', result.token);
                localStorage.setItem('isAdmin', result.is_admin);
                
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
            alert('登录失败，请重试');
        }
    });
    
    // 退出按钮点击事件
    logoutBtn.addEventListener('click', () => {
        // 清除token和管理员状态
        localStorage.removeItem('token');
        localStorage.removeItem('isAdmin');
        
        // 更新全局变量
        token = null;
        isAdmin = false;
        
        // 更新UI
        checkAuthStatus();
        
        // 隐藏信息面板
        infoPanel.classList.add('hidden');
        
        alert('已退出登录');
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);