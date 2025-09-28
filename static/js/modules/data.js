// data.js - 数据处理模块
import { showToast, getCsrfToken, getCurrentCsrfToken } from './utils.js';
import { createOrUpdateGeoLayer, getGeoJSONLayer, fitToLayer } from './map.js';

// 全局数据状态
let mappedCounties = []; // 已在地图上正确映射的县
let unmappedCounties = []; // 未在地图上正确映射的县
let csrfToken = getCurrentCsrfToken(); // 从utils模块获取CSRF令牌

/**
 * 加载县总代数据
 * @returns {Promise<void>}
 */
export async function loadAgentsData() {
    try {
        const headers = {};
        const token = localStorage.getItem('token');
        
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
                console.log('未授权访问，但保持当前登录状态不变');
                // 注释掉清除认证状态的代码，允许用户刷新后保持登录状态
                // 一般情况下，只有在明确的登出操作或token过期时才应该清除认证状态
                
                // 检查是否确实有token
                const hasToken = !!localStorage.getItem('token');
                if (!hasToken) {
                    // 如果本来就没有token，才触发未登录事件
                    const authEvent = new CustomEvent('authStatusChanged', { 
                        detail: { isAdmin: false, isLoggedIn: false, username: '' } 
                    });
                    window.dispatchEvent(authEvent);
                }
            }
            throw new Error(`请求失败: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // 存储县总代数据
            window.agentsData = result.data;
            
            // 如果返回了is_admin字段，更新本地状态并触发事件
            // 注意：只有当用户明确登录后，才应该设置isLoggedIn为true
            if (result.is_admin !== undefined) {
                const isAdmin = result.is_admin;
                localStorage.setItem('isAdmin', isAdmin);
                
                // 检查是否确实有token（已登录）
                const isLoggedIn = !!localStorage.getItem('token');
                
                // 触发认证状态变更事件
                const authEvent = new CustomEvent('authStatusChanged', { 
                    detail: { isAdmin: isAdmin, isLoggedIn: isLoggedIn, username: '' } 
                });
                window.dispatchEvent(authEvent);
            }
            
            // 更新GeoJSON图层，应用县总代数据
            updateGeoJSONWithAgents();
            // 如果第一次没有图层成功更新，尝试延迟重试一次
            if (!window.geojsonLayer || 
                (window.geojsonLayer && 
                 window.geojsonLayer.getLayers && 
                 window.geojsonLayer.getLayers().length === 0)) {
                setTimeout(() => {
                    updateGeoJSONWithAgents();
                }, 300);
            }
            
            // 分类县总代数据为已映射和未映射
            categorizeCountyData();
            
            // 触发数据更新事件
            const dataEvent = new CustomEvent('agentsDataUpdated', { 
                detail: { 
                    mappedCounties: mappedCounties, 
                    unmappedCounties: unmappedCounties 
                } 
            });
            window.dispatchEvent(dataEvent);
            
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

/**
 * 分类县总代数据为已映射和未映射
 */
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

/**
 * 更新GeoJSON图层，应用县总代数据
 */
export function updateGeoJSONWithAgents() {
    if (!window.geojsonData || !window.agentsData) return;
    
    // 获取geojsonLayer实例
    const geojsonLayer = getGeoJSONLayer();
    
    if (!geojsonLayer) {
        console.warn('geojsonLayer 尚未初始化，延迟更新');
        return; // 等待 loadGeoJSON 完成后再调用
    }
    
    try {
        geojsonLayer.clearLayers();
        geojsonLayer.addData(window.geojsonData);
        fitToLayer(); // 使用map.js提供的函数设置视图范围
    } catch (e) {
        console.error('更新GeoJSON图层失败:', e);
    }
}

/**
 * 检查县是否有县总代
 * @param {Object} feature - GeoJSON feature对象
 * @returns {boolean} 是否有县总代
 */
export function checkCountyHasAgent(feature) {
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

/**
 * 获取县总代信息
 * @param {string} countyName - 县名
 * @param {Object} feature - GeoJSON feature对象
 * @returns {Object|null} 县总代信息
 */
export function getCountyAgentInfo(countyName, feature) {
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
                    // 添加省份、城市和县名信息到返回数据中
                    countyData.province = province;
                    countyData.city = city;
                    countyData.county = county;
                    return countyData;
                }
            }
        }
    }
    
    return null;
}

/**
 * 查找县总代信息（按县名）
 * @param {string} countyName - 县名
 * @returns {Object|null} 县总代信息
 */
export function findCountyAgent(countyName) {
    if (!window.agentsData) return null;
    
    // 遍历所有省份、城市查找县
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            if (window.agentsData[province][city][countyName]) {
                const agentInfo = window.agentsData[province][city][countyName];
                agentInfo.province = province;
                agentInfo.city = city;
                agentInfo.county = countyName;
                return agentInfo;
            }
        }
    }
    return null;
}

/**
 * 更新县总代信息
 * @param {string} countyName - 县名
 * @param {string} agentName - 县总代姓名
 * @param {string} agentPhone - 县总代电话
 * @param {HTMLElement} tr - 表格行元素
 * @param {string} province - 省份
 * @param {string} city - 城市
 * @param {string} county - 县（用于重命名）
 * @returns {Promise<boolean>} 更新是否成功
 */
export async function updateCountyAgent(countyName, agentName, agentPhone, tr, province = '', city = '', county = '') {
    if (!agentName || !agentPhone) {
        showToast('请输入县总代姓名和电话', 'error');
        return false;
    }
    
    // 如果提供了省、市、县信息，则需要验证
    if ((province || city || county) && !(province && city && county)) {
        showToast('请完整填写省份、城市和县名', 'error');
        return false;
    }
    
    try {
        // 如果没有CSRF令牌，先获取
        if (!csrfToken) {
            await getCsrfToken();
        }
        
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        
        // 添加CSRF令牌到请求头
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
        
        // 构建请求数据
        const requestData = {
            agent_name: agentName,
            agent_phone: agentPhone,
            csrf_token: csrfToken
        };
        
        // 如果提供了省、市、县信息，则添加到请求数据中
        if (province && city && county) {
            requestData.province = province;
            requestData.city = city;
            requestData.county = county;
        }
        
        const response = await fetch(`/api/county/${countyName}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        // 如果返回了新的CSRF令牌，更新它
        if (result.csrf_token) {
            csrfToken = result.csrf_token;
            localStorage.setItem('csrfToken', csrfToken);
        }
        
        if (result.status === 'success') {
            showToast('更新成功', 'success');
            
            // 重新加载县总代数据
            await loadAgentsData();
            return true;
        } else {
            showToast(result.message || '更新失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('更新失败:', error);
        showToast('更新失败，请重试', 'error');
        return false;
    }
}

/**
 * 删除县总代函数
 * @param {string} countyName - 县名
 * @returns {Promise<boolean>} 删除是否成功
 */
export async function deleteCounty(countyName) {
    if (!confirm(`确定要删除县总代："${countyName}"吗？此操作不可恢复。`)) {
        return false;
    }

    try {
        const token = localStorage.getItem('token');
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
            showToast('删除成功', 'success');
            
            // 清除现有数据缓存
            window.agentsData = null;
            mappedCounties = [];
            unmappedCounties = [];
            
            // 重新加载数据以更新地图和表格
            await loadAgentsData();
            return true;
        } else {
            showToast(result.message || '删除失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('删除县总代失败:', error);
        showToast('删除县总代失败，请稍后重试', 'error');
        return false;
    }
}

/**
 * 添加新县总代
 * @param {Object} data - 新县总代数据
 * @returns {Promise<boolean>} 添加是否成功
 */
export async function addNewCountyAgent(data) {
    const { province, city, county, agentName, agentPhone, gdp, population } = data;

    if (!province || !city || !county || !agentName || !agentPhone) {
        showToast('所有必填字段均为必填项', 'error');
        return false;
    }

    try {
        // 如果没有CSRF令牌，先获取
        if (!csrfToken) {
            await getCsrfToken();
        }
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/county', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                province: province,
                city: city,
                county: county,
                agent_name: agentName,
                agent_phone: agentPhone,
                gdp: gdp,
                population: population,
                csrf_token: csrfToken // 在请求体中也包含CSRF令牌
            })
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            showToast('新增成功', 'success');
            await loadAgentsData(); // 重新加载数据
            return true;
        } else {
            showToast(`新增失败: ${result.message}`, 'error');
            return false;
        }
    } catch (error) {
        console.error('新增县总代失败:', error);
        showToast('新增县总代失败，请稍后重试', 'error');
        return false;
    }
}

/**
 * 获取已映射的县数据
 * @returns {Array} 已映射县数据数组
 */
export function getMappedCounties() {
    return mappedCounties;
}

/**
 * 获取未映射的县数据
 * @returns {Array} 未映射县数据数组
 */
export function getUnmappedCounties() {
    return unmappedCounties;
}

/**
 * 搜索县总代（按姓名）
 * @param {string} agentName - 县总代姓名
 * @returns {Object|null} 搜索结果
 */
export function searchAgentByName(agentName) {
    if (!window.agentsData) return null;
    
    // 在县总代数据中查找匹配的人名
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            for (const county in window.agentsData[province][city]) {
                const countyData = window.agentsData[province][city][county];
                if (countyData.name && countyData.name.includes(agentName)) {
                    return {
                        province,
                        city,
                        county,
                        ...countyData
                    };
                }
            }
        }
    }
    
    return null;
}

/**
 * 搜索县总代（按县名）
 * @param {string} countyName - 县名
 * @returns {Object|null} 搜索结果
 */
export function searchCountyByName(countyName) {
    if (!window.agentsData) return null;
    
    // 在县总代数据中查找匹配的县名
    for (const province in window.agentsData) {
        for (const city in window.agentsData[province]) {
            for (const county in window.agentsData[province][city]) {
                if (county.includes(countyName)) {
                    return {
                        province,
                        city,
                        county,
                        ...window.agentsData[province][city][county]
                    };
                }
            }
        }
    }
    
    return null;
}

/**
 * 初始化数据模块
 */
export function initData() {
    // 订阅事件监听
    window.addEventListener('csrfTokenUpdated', (event) => {
        csrfToken = event.detail.token;
    });
}
