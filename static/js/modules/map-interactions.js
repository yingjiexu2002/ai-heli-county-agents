/**
 * map-interactions.js - 地图交互模块
 * 负责：
 *  - 地图样式定义
 *  - 地图交互事件
 *  - 地图数据加载
 */

import { fetchGeoJSON, createOrUpdateGeoLayer, fitToLayer, resetFeatureStyle } from './map.js';
import { checkCountyHasAgent, getCountyAgentInfo } from './data.js';
import { showCountyDetails, setSelectedCounty, getSelectedCounty } from './ui.js';

/**
 * 县区域样式函数
 */
export function styleCounty(feature) {
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

/**
 * 为每个县添加交互
 */
export function onEachCounty(feature, layer) {
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
            // 有总代：显示为「总代：xxx」，其中"总代"是绿色，"xxx"保持黑色
            status.innerHTML = `<strong style="color: #27ae60;">总代：</strong>${agentInfo.name || '未知'}`;
        } else {
            // 无总代：显示为「总代：暂无」，其中"总代"是红色，"暂无"保持黑色
            status.innerHTML = `<strong style="color: #e74c3c;">总代：</strong>暂无`;
        }
        popupContent.appendChild(status);
        
        return popupContent;
    });
    
    // 添加点击事件
    layer.on({
        click: () => {
            // 重置之前选中的县样式
            const selectedCounty = getSelectedCounty();
            if (selectedCounty) {
                // 使用map.js模块提供的函数重置样式
                resetFeatureStyle(selectedCounty);
            }
            
            // 设置新选中的县样式
            layer.setStyle({
                weight: 3,
                color: '#3498db',
                dashArray: '',
                fillOpacity: 0.7
            });
            
            // 更新选中的县
            setSelectedCounty(layer);
            
            // 直接显示县详情，省略点击查看详情按钮的步骤
            // 传递feature参数以便使用GB代码匹配
            showCountyDetails(countyName, feature);
        }
    });
}

/**
 * 加载GeoJSON数据
 */
export async function loadGeoJSON() {
    try {
        const data = await fetchGeoJSON();
        // 创建/更新图层
        createOrUpdateGeoLayer(data, styleCounty, onEachCounty);
        fitToLayer();
    } catch (e) {
        console.error('加载GeoJSON数据失败:', e);
        alert('加载地图数据失败，请刷新页面重试');
    }
}