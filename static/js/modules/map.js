/**
 * map.js - 地图核心模块
 * 负责：
 *  - 地图初始化
 *  - GeoJSON加载与图层创建
 *  - feature 样式、交互绑定
 */
import { getCurrentCsrfToken } from './utils.js';

let mapInstance = null;
let geojsonLayerInstance = null;
let csrfToken = getCurrentCsrfToken();

/**
 * 初始化地图
 * @returns {L.Map}
 */
export function initMap() {
    if (mapInstance) return mapInstance;
    mapInstance = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        maxBounds: [ [3.86, 73.55], [65.0, 135.09] ],
        maxBoundsViscosity: 1.0,
        wheelPxPerZoomLevel: 240,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelDebounceTime: 100
    }).setView([35.86166, 104.195397], 4);

    L.tileLayer('https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { maxZoom: 18 }).addTo(mapInstance);

    L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('© 高德地图').addTo(mapInstance);
    L.control.zoom({ position: 'bottomleft' }).addTo(mapInstance);

    // 暴露到window以兼容既有代码
    window.map = mapInstance;
    return mapInstance;
}

/**
 * 加载GeoJSON数据
 * @returns {Promise<object>} 返回解析后的GeoJSON对象
 */
export async function fetchGeoJSON() {
    const headers = {};
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const resp = await fetch('/api/geojson', { headers });
    const newCsrf = resp.headers.get('X-CSRF-Token');
    if (newCsrf) {
        csrfToken = newCsrf;
        localStorage.setItem('csrfToken', csrfToken);
        window.csrfToken = csrfToken;
    }
    const data = await resp.json();
    window.geojsonData = data;
    return data;
}

/**
 * 创建或更新GeoJSON图层
 * @param {object} geojsonData
 * @param {function} styleFn
 * @param {function} onEachFn
 */
export function createOrUpdateGeoLayer(geojsonData, styleFn, onEachFn) {
    if (!mapInstance) throw new Error('Map not initialized');
    if (geojsonLayerInstance) {
        geojsonLayerInstance.clearLayers();
        geojsonLayerInstance.addData(geojsonData);
    } else {
        geojsonLayerInstance = L.geoJSON(geojsonData, { style: styleFn, onEachFeature: onEachFn }).addTo(mapInstance);
    }
    window.geojsonLayer = geojsonLayerInstance;
    return geojsonLayerInstance;
}

export function fitToLayer() {
    if (geojsonLayerInstance) {
        mapInstance.fitBounds(geojsonLayerInstance.getBounds());
    }
}

/**
 * 获取GeoJSON图层实例
 * @returns {L.GeoJSON|null}
 */
export function getGeoJSONLayer() {
    return geojsonLayerInstance;
}

/**
 * 重置图层中某个feature的样式
 * @param {L.Layer} layer - 需要重置样式的图层
 */
export function resetFeatureStyle(layer) {
    if (geojsonLayerInstance && layer) {
        geojsonLayerInstance.resetStyle(layer);
    }
}
