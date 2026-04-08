// Authentication Utilities
const API_BASE_URL = 'https://apiaro-backend.onrender.com';

// Make it available globally
if (typeof window !== 'undefined') {
    window.API_BASE_URL = API_BASE_URL;
}

/**
 * Check if JWT token is expired
 * @returns {boolean} true if expired or invalid
 */
function isTokenExpired() {
    const token = localStorage.getItem('token');
    if (!token) return true;
    
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        
        // Add 10 second buffer
        const isExpired = (now + 10000) >= exp;
        
        if (isExpired) {
            console.log('Token expired:', new Date(exp), 'Current:', new Date(now));
        }
        
        return isExpired;
    } catch (e) {
        console.error('Error checking token expiry:', e);
        return true;
    }
}

/**
 * LOGIN FUNCTION - Stores token for 30 days
 */
async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.toLowerCase(), password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        // Store in localStorage (persists for 30 days until token expires)
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('Login successful, token stored for 30 days');
        
        // Redirect to home or intended page
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || 'index.html';
        window.location.href = redirect;
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

/**
 * Check authentication status and update UI
 */
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const authLinks = document.getElementById('auth-links');
    const userLinks = document.getElementById('user-links');
    
    // Check if token is expired
    if (token && isTokenExpired()) {
        console.log('Token expired during checkAuth, logging out');
        logout();
        return null;
    }
    
    if (token && user.full_name) {
        if (authLinks) authLinks.style.display = 'none';
        if (userLinks) {
            userLinks.style.display = 'flex';
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) userNameEl.textContent = user.full_name.split(' ')[0];
        }
        
        // Debug: Show token time remaining
        const minsRemaining = getTokenTimeRemaining();
        console.log(`Token valid for ${minsRemaining} more minutes (${Math.floor(minsRemaining/1440)} days)`);
        
        return token;
    } else {
        if (authLinks) authLinks.style.display = 'flex';
        if (userLinks) userLinks.style.display = 'none';
        return null;
    }
}

/**
 * Get time until token expires
 */
function getTokenTimeRemaining() {
    const token = localStorage.getItem('token');
    if (!token) return 0;
    
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        const exp = payload.exp * 1000;
        const now = Date.now();
        const remaining = Math.floor((exp - now) / 60000); // Minutes
        
        return Math.max(0, remaining);
    } catch (e) {
        return 0;
    }
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    
    showToast('Logged out successfully', 'success');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

/**
 * Fetch with authentication headers
 */
async function fetchWithAuth(url, options = {}) {
    if (isTokenExpired()) {
        showToast('Your session has expired. Please login again.', 'error');
        logout();
        throw new Error('Token expired');
    }
    
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    if (options.body instanceof FormData) {
        delete defaultOptions.headers['Content-Type'];
    }
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401) {
            const errorData = await response.json().catch(() => ({}));
            console.error('401 Unauthorized:', errorData);
            
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            showToast(errorData.detail || 'Session expired. Please login again.', 'error');
            
            setTimeout(() => {
                window.location.href = 'login.html?expired=true';
            }, 1500);
            
            throw new Error('Unauthorized');
        }
        
        if (response.status === 403) {
            showToast('Access denied.', 'error');
            throw new Error('Forbidden');
        }
        
        return response;
        
    } catch (error) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            throw error;
        }
        
        console.error('Network error:', error);
        showToast('Network error. Please check your connection.', 'error');
        throw error;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 5px;
        color: ${type === 'warning' ? '#333' : 'white'};
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background: ${colors[type] || colors.success};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Add toast animations
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    if (getUrlParam('expired') === 'true') {
        showToast('Your session expired. Please login again.', 'warning');
    }
});