// Admin Utilities
const ADMIN_API_URL = 'https://apiaro-backend.onrender.com';

function checkAdminAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'login.html';
    }
    return token;
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
}

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    return fetch(url, { ...defaultOptions, ...options });
}

async function loadDashboardStats() {
    try {
        // Load products count
        const productsRes = await fetchWithAuth(`${ADMIN_API_URL}/products/`);
        const products = await productsRes.json();
        document.getElementById('total-products').textContent = products.length;

        // Load orders stats
        const ordersRes = await fetchWithAuth(`${ADMIN_API_URL}/orders/admin/all`);
        const orders = await ordersRes.json();
        
        document.getElementById('total-orders').textContent = orders.length;
        document.getElementById('pending-orders').textContent = 
            orders.filter(o => o.status === 'pending').length;
        document.getElementById('completed-orders').textContent = 
            orders.filter(o => o.status === 'delivered').length;
        
        const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
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
        let url = `${ADMIN_API_URL}/orders/admin/all`;
        if (status) url += `?status=${status}`;
        
        const response = await fetchWithAuth(url);
        const orders = await response.json();
        
        const tbody = document.getElementById('orders-table-body');
        if (tbody) {
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
                    <td>${order.payment_method.toUpperCase()}</td>
                    <td>KES ${parseFloat(order.total_amount).toFixed(2)}</td>
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
    }
}