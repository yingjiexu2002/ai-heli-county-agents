/**
 * auth.js - 认证相关功能模块
 * 包含登录、注销、权限检查等
 */
import { encryptPassword, getCsrfToken, getCurrentCsrfToken } from './utils.js';

let token = localStorage.getItem('token');
let isAdmin = localStorage.getItem('isAdmin') === 'true';
let csrfToken = getCurrentCsrfToken();

export function getToken() {
    return token;
}

export function getIsAdmin() {
    return isAdmin;
}

export async function login(username, password) {
    if (!username || !password) {
        throw new Error('请输入用户名和密码');
    }
    let encryptedPassword = encryptPassword(password);
    await getCsrfToken();
    csrfToken = window.csrfToken || getCurrentCsrfToken();
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
            username,
            password: encryptedPassword,
            csrf_token: csrfToken
        })
    });
    const result = await response.json();
    if (result.status === 'success') {
        token = result.token;
        isAdmin = result.is_admin;
        localStorage.setItem('token', token);
        localStorage.setItem('isAdmin', isAdmin);
        if (result.csrf_token) {
            csrfToken = result.csrf_token;
            localStorage.setItem('csrfToken', csrfToken);
        }
        return result;
    } else {
        throw new Error(result.message || '登录失败');
    }
}

export async function logout() {
    // 确保每次都从localStorage获取最新token和csrfToken
    const currentToken = localStorage.getItem('token');
    const currentCsrfToken = localStorage.getItem('csrfToken') || getCurrentCsrfToken();
    if (!currentToken || !currentCsrfToken) {
        throw new Error('未登录或CSRF令牌缺失');
    }
    const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCsrfToken,
            'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ token: currentToken, csrf_token: currentCsrfToken })
    });
    const result = await response.json();
    if (result.status === 'success') {
        token = null;
        isAdmin = false;
        localStorage.removeItem('token');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('csrfToken');
        return result;
    } else {
        throw new Error(result.message || '注销失败');
    }
}

export function checkAuthStatus() {
    token = localStorage.getItem('token');
    isAdmin = localStorage.getItem('isAdmin') === 'true';
    csrfToken = getCurrentCsrfToken();
    return { token, isAdmin, csrfToken };
}
