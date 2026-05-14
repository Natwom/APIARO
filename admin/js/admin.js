// Admin Utilities

const API_BASE_URL = 'https://apiaro-backend.onrender.com';

function checkAdminAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }
    return token;
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
}

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
        console.error('❌ No admin token found');
        window.location.href = 'login.html';
        return;
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    console.log('📤 Fetching:', url);
    console.log('🔑 Token:', token.substring(0, 20) + '...');
    
    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        console.log('📥 Response status:', response.status);
        
        if (response.status === 401) {
            console.error('❌ 401 Unauthorized - token expired');
            logout();
            return;
        }
        
        if (response.status === 403) {
            console.error('❌ 403 Forbidden - not admin');
            alert('Access denied. Admin only.');
            return;
        }
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Server error:', response.status, text);
            throw new Error(`Server error: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        console.error('❌ Network error:', error.message);
        throw error;
    }
}

async function loadDashboardStats() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/orders/admin/all`);
        if (!response) return;
        
        const orders = await response.json();
        console.log('📦 Orders loaded:', orders.length);
        
        document.getElementById('total-orders').textContent = orders.length;
        document.getElementById('pending-orders').textContent = 
            orders.filter(o => o.status === 'pending').length;
        document.getElementById('completed-orders').textContent = 
            orders.filter(o => o.status === 'delivered').length;
        
        const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        document.getElementById('total-revenue').textContent = `KES ${revenue.toFixed(2)}`;
        
        // Recent orders table
        const recentOrders = orders.slice(0, 5);
        const tbody = document.getElementById('recent-orders-body');
        if (tbody) {
            tbody.innerHTML = recentOrders.map(order => `
                <tr>
                    <td>#${order.id}</td>
                    <td>${order.full_name}</td>
                    <td>${order.phone_number}</td>
                    <td>KES ${order.total_amount}</td>
                    <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                    <td>${new Date(order.created_at).toLocaleDateString()}</td>
                    <td>${order.sms_sent ? '<i class="fas fa-check sms-sent"></i>' : '<i class="fas fa-times sms-pending"></i>'}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadAllOrders(status = '') {
    try {
        let url = `${API_BASE_URL}/orders/admin/all`;
        if (status) url += `?status=${status}`;
        
        const response = await fetchWithAuth(url);
        if (!response) return;
        
        const orders = await response.json();
        console.log('📦 All orders loaded:', orders.length);
        
        const tbody = document.getElementById('orders-table-body');
        if (tbody) {
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;">No orders found</td></tr>';
                return;
            }
            
            tbody.innerHTML = orders.map(order => `
                <tr>
                    <td>#${order.id}</td>
                    <td>${new Date(order.created_at).toLocaleDateString('en-KE')}</td>
                    <td>
                        <strong>${order.full_name}</strong><br>
                        <small>${order.email}</small>
                    </td>
                    <td>${order.phone_number}</td>
                    <td>${order.county}, ${order.town}</td>
                    <td>${order.payment_method ? order.payment_method.toUpperCase() : 'N/A'}</td>
                    <td>KES ${parseFloat(order.total_amount || 0).toFixed(2)}</td>
                    <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                    <td>${order.sms_sent ? '<i class="fas fa-check sms-sent"></i> Yes' : '<i class="fas fa-times sms-pending"></i> No'}</td>
                    <td>
                        <button onclick="openStatusModal(${order.id}, '${order.status}')" class="btn-primary btn-small">
                            Update
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('orders-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:red;">Failed to load orders. Check console.</td></tr>';
        }
    }
}

function openStatusModal(orderId, currentStatus) {
    // Placeholder - implement your modal logic
    const newStatus = prompt(`Update order #${orderId} status (current: ${currentStatus}):`, currentStatus);
    if (newStatus && newStatus !== currentStatus) {
        updateOrderStatus(orderId, newStatus);
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        if (response && response.ok) {
            alert('Status updated!');
            loadAllOrders();
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}
