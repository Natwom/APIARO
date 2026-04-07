// Authentication Utilities

// Define API base URL globally so other scripts can use it
const API_BASE_URL = 'https://apiaro-backend.onrender.com';

// Make it available globally for other scripts
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
        // Decode JWT payload (base64)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        const exp = payload.exp * 1000; // Convert seconds to milliseconds
        const now = Date.now();
        
        // Add 10 second buffer to prevent edge cases
        const isExpired = (now + 10000) >= exp;
        
        if (isExpired) {
            console.log('Token expired:', new Date(exp), 'Current:', new Date(now));
        }
        
        return isExpired;
    } catch (e) {
        console.error('Error checking token expiry:', e);
        return true; // Treat invalid tokens as expired
    }
}

/**
 * Get time until token expires in minutes
 * @returns {number} minutes until expiry, 0 if expired
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
        const remaining = Math.floor((exp - now) / 60000); // Convert to minutes
        
        return Math.max(0, remaining);
    } catch (e) {
        return 0;
    }
}

/**
 * Check authentication status and update UI
 * @returns {string|null} token if authenticated, null otherwise
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
        
        // Show token time remaining in console for debugging
        const minsRemaining = getTokenTimeRemaining();
        console.log(`Token valid for ${minsRemaining} more minutes`);
        
        return token;
    } else {
        if (authLinks) authLinks.style.display = 'flex';
        if (userLinks) userLinks.style.display = 'none';
        return null;
    }
}

/**
 * Logout user and clear storage
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    
    showToast('Logged out successfully', 'success');
    
    // Redirect to home page after short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

/**
 * Fetch with automatic authentication headers and error handling
 * Automatically logs out on 401 errors
 * 
 * @param {string} url - API endpoint
 * @param {object} options - fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithAuth(url, options = {}) {
    // Check token before making request
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
    
    // Don't override Content-Type if FormData (browser sets it automatically with boundary)
    if (options.body instanceof FormData) {
        delete defaultOptions.headers['Content-Type'];
    }
    
    // Merge options - headers are merged specially to not lose Authorization
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
        
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
            const errorData = await response.json().catch(() => ({}));
            console.error('401 Unauthorized:', errorData);
            
            // Clear invalid token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            showToast(errorData.detail || 'Session expired. Please login again.', 'error');
            
            // Redirect to login after short delay
            setTimeout(() => {
                window.location.href = 'login.html?expired=true';
            }, 1500);
            
            throw new Error('Unauthorized');
        }
        
        // Handle 403 Forbidden
        if (response.status === 403) {
            showToast('Access denied. Insufficient permissions.', 'error');
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
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'warning'
 */
function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    
    // Color based on type
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
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Parse URL parameters
 * @param {string} param - Parameter name
 * @returns {string|null} parameter value
 */
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Add toast animations to page
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

// Check auth status on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Check if redirected due to expired session
    if (getUrlParam('expired') === 'true') {
        showToast('Your session expired. Please login again.', 'warning');
    }
});