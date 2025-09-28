/**
 * utils.js - 爱河狸地图管理系统工具模块
 * 包含通用工具函数，如Toast通知、加密工具和CSRF令牌处理等
 */

// 全局变量
let toastContainer = null;
let csrfToken = localStorage.getItem('csrfToken');

/**
 * 创建Toast通知容器
 */
export function createToastContainer() {
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

/**
 * 显示Toast通知
 * @param {string} message - 要显示的消息
 * @param {string} type - 通知类型 (success, error, info等)
 */
export function showToast(message, type = 'success') {
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
    
    // 添加animate类以触发动画
    toast.classList.add('animate');
    
    // 设置动画结束后移除
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * 获取CSRF令牌
 * @returns {Promise<string>} CSRF令牌
 */
export async function getCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        
        if (data.status === 'success') {
            csrfToken = data.csrf_token;
            localStorage.setItem('csrfToken', csrfToken);
            // 将令牌也导出到全局window对象，确保其他模块可以访问
            window.csrfToken = csrfToken;
            return csrfToken;
        } else {
            throw new Error('获取CSRF令牌失败: ' + (data.message || '未知错误'));
        }
    } catch (error) {
        console.error('获取CSRF令牌失败:', error);
        throw error;
    }
}

/**
 * 密码加密函数
 * @param {string} password - 要加密的密码
 * @returns {string} 加密后的密码
 */
export function encryptPassword(password) {
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

/**
 * 获取当前CSRF令牌
 * @returns {string} 当前存储的CSRF令牌
 */
export function getCurrentCsrfToken() {
    return csrfToken;
}