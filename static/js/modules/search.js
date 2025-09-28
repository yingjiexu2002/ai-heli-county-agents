/**
 * search.js - 搜索功能模块
 * 负责：
 *  - 执行搜索功能
 *  - 处理搜索结果
 *  - 在地图上定位搜索结果
 */

import { showSearchResult, showCountySelectionDialog, getSelectedSearchType } from './ui.js';
import { searchAgentByName, searchCountyByName } from './data.js';
import { getGeoJSONLayer } from './map.js';
import { styleCounty } from './map-interactions.js';

/**
 * 执行搜索
 */
export function performSearch() {
    const searchType = getSelectedSearchType();
    const searchInput = document.getElementById('search-input');
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

/**
 * 按人名搜索
 * @param {string} agentName - 县总代姓名
 */
export function searchByAgentName(agentName) {
    console.log('搜索县总代:', agentName);
    
    // 使用data模块的搜索函数
    const matchedAgentData = searchAgentByName(agentName);
    
    if (!matchedAgentData) {
        showSearchResult('未找到该县总代', 'error');
        return;
    }
    
    const countyName = matchedAgentData.county;
    const gbCode = matchedAgentData.gb_code;
    
    if (!countyName) {
        showSearchResult('该县总代未填写县级信息', 'error');
        return;
    }
    
    if (!gbCode || gbCode === '') {
        showSearchResult('县级信息映射错误，请检查', 'error');
        return;
    }
    
    // 检查GB代码是否能在GeoJSON数据中找到
    let foundInGeoJSON = false;
    let targetCountyName = null;
    
    if (window.geojsonData) {
        for (const feature of window.geojsonData.features) {
            if (feature.properties && feature.properties.gb === gbCode) {
                foundInGeoJSON = true;
                targetCountyName = feature.properties.name;
                break;
            }
        }
    }
    
    if (!foundInGeoJSON) {
        showSearchResult('县级信息映射错误，请检查', 'error');
        return;
    }
    
    // 在地图上查找并定位到对应的县，使用GB编号以确保准确性
    locateCountyOnMap(targetCountyName, gbCode);
}

/**
 * 按县名搜索
 * @param {string} countyName - 县名
 */
export function searchByCountyName(countyName) {
    if (!window.geojsonData) {
        showSearchResult('地图数据未加载', 'error');
        return;
    }
    
    // 查找匹配的县，使用精确匹配而不是模糊匹配
    const matchedCounties = window.geojsonData.features.filter(feature => 
        feature.properties && 
        feature.properties.name && 
        feature.properties.name === countyName
    );
    
    // 如果没有精确匹配，再尝试模糊匹配
    if (matchedCounties.length === 0) {
        const fuzzyMatchedCounties = window.geojsonData.features.filter(feature => 
            feature.properties && 
            feature.properties.name && 
            feature.properties.name.includes(countyName)
        );
        
        if (fuzzyMatchedCounties.length === 0) {
            showSearchResult('县名填写有误', 'error');
            return;
        } else {
            // 有模糊匹配结果，让用户选择
            showCountySelectionDialog(fuzzyMatchedCounties);
            return;
        }
    }
    
    if (matchedCounties.length === 1) {
        // 精确匹配，直接定位，使用GB编号以确保准确性
        locateCountyOnMap(matchedCounties[0].properties.name, matchedCounties[0].properties.gb);
        showSearchResult(`已定位到 ${matchedCounties[0].properties.name}`, 'success');
    } else {
        // 多个精确匹配结果，让用户选择
        showCountySelectionDialog(matchedCounties);
    }
}

/**
 * 在地图上定位县
 * @param {string} countyName - 县名
 * @param {string} gbCode - GB代码
 */
export function locateCountyOnMap(countyName, gbCode = null) {
    if (!window.geojsonData) return;
    
    // 获取geojsonLayer实例
    const geojsonLayer = getGeoJSONLayer();
    if (!geojsonLayer) return;
    
    // 遍历GeoJSON数据查找匹配的县
    window.geojsonData.features.some(feature => {
        // 如果提供了GB代码，优先使用GB代码匹配，否则使用县名匹配
        if (feature.properties && 
            ((gbCode && feature.properties.gb === gbCode) || 
            (!gbCode && feature.properties.name === countyName))) {
            
            // 获取图层 (GeoJSON数据中使用gb字段)
            const layer = geojsonLayer.getLayers().find(l => 
                l.feature.properties.gb === feature.properties.gb
            );
            
            if (layer) {
                // 重置所有图层样式
                geojsonLayer.eachLayer(l => {
                    l.setStyle(styleCounty(l.feature));
                });
                
                // 高亮显示匹配的图层
                layer.setStyle({
                    weight: 3,
                    color: '#3498db',
                    dashArray: '',
                    fillOpacity: 0.7
                });
                
                // 添加闪烁效果
                createBlinkEffect(layer);
                
                // 显示县详情
                import('./ui.js').then(ui => {
                    ui.showCountyDetails(feature.properties.name, feature);
                    // 更新选中的县
                    ui.setSelectedCounty(layer);
                });
                
                // 缩放到县位置，减小放大级别
                const bounds = layer.getBounds();
                // 使用map对象，避免使用window.map
                const mapObj = window.map || document.querySelector('#map').leaflet;
                if (mapObj) {
                    mapObj.fitBounds(bounds, {
                        padding: [100, 100], // 增加内边距，使缩放更合适
                        maxZoom: 8, // 降低最大缩放级别，避免放得太大
                        animate: true // 使用动画效果
                    });
                }
                
                return true; // 找到后停止遍历
            }
        }
        return false;
    });
}

/**
 * 创建闪烁效果
 * @param {Object} layer - Leaflet图层对象
 */
export function createBlinkEffect(layer) {
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

/**
 * 初始化搜索模块的事件监听器
 */
export function initSearchEvents() {
    // 搜索按钮点击事件
    const doSearchBtn = document.getElementById('do-search-btn');
    if (doSearchBtn) {
        doSearchBtn.addEventListener('click', performSearch);
    }
    
    // 搜索输入框回车事件
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}