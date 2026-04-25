// Admin Utilities - CLOUDINARY FIXED
const ADMIN_API_URL = 'https://apiaro-backend.onrender.com';

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

/**
 * Fetch with auth - FIXED to handle FormData (file uploads)
 */
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    
    const headers = {
        'Authorization': `Bearer ${token}`
    };
    
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    if (options.headers) {
        Object.assign(headers, options.headers);
    }
    
    const response = await fetch(url, {
        ...options,
        headers: headers
    });
    
    return response;
}

/**
 * UPLOAD IMAGE - Uploads to Cloudinary via backend
 */
async function uploadProductImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetchWithAuth(`${ADMIN_API_URL}/products/admin/upload-image`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }
        
        const data = await response.json();
        return data.image_url; // Returns full Cloudinary URL
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload image: ' + error.message);
        return null;
    }
}

// ============== DASHBOARD FUNCTIONS ==============

async function loadDashboardStats() {
    try {
        const productsRes = await fetchWithAuth(`${ADMIN_API_URL}/products/admin/all`);
        if (!productsRes.ok) throw new Error('Failed to load products');
        const products = await productsRes.json();
        
        const totalProductsEl = document.getElementById('total-products');
        if (totalProductsEl) totalProductsEl.textContent = products.length;

        const ordersRes = await fetchWithAuth(`${ADMIN_API_URL}/orders/admin/all`);
        if (!ordersRes.ok) throw new Error('Failed to load orders');
        const orders = await ordersRes.json();
        
        const totalOrdersEl = document.getElementById('total-orders');
        const pendingOrdersEl = document.getElementById('pending-orders');
        const completedOrdersEl = document.getElementById('completed-orders');
        const totalRevenueEl = document.getElementById('total-revenue');
        
        if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
        if (pendingOrdersEl) pendingOrdersEl.textContent = orders.filter(o => o.status === 'pending').length;
        if (completedOrdersEl) completedOrdersEl.textContent = orders.filter(o => o.status === 'delivered').length;
        
        const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        if (totalRevenueEl) totalRevenueEl.textContent = `KES ${revenue.toFixed(2)}`;
        
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
        if (error.message.includes('Unauthorized')) {
            logout();
        }
    }
}

// ============== PRODUCT FUNCTIONS ==============

async function loadProducts() {
    try {
        const response = await fetchWithAuth(`${ADMIN_API_URL}/products/admin/all`);
        if (!response.ok) throw new Error('Failed to load products');
        
        const products = await response.json();
        const tbody = document.getElementById('products-table-body');
        
        if (tbody) {
            tbody.innerHTML = products.map(product => `
                <tr>
                    <td><img src="${product.image_url || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;object-fit:cover;border-radius:5px;" onerror="this.src='https://via.placeholder.com/50'"></td>
                    <td>${product.name}</td>
                    <td>KES ${parseFloat(product.price).toFixed(2)}</td>
                    <td>${product.stock_quantity}</td>
                    <td><span class="status-badge ${product.is_active ? 'status-delivered' : 'status-cancelled'}">${product.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button onclick="editProduct(${product.id})" class="btn-primary btn-small">Edit</button>
                        <button onclick="deleteProduct(${product.id})" class="btn-danger btn-small">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function saveProduct(event) {
    event.preventDefault();
    
    const productId = document.getElementById('product-id').value;
    const productData = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price: parseFloat(document.getElementById('product-price').value),
        stock_quantity: parseInt(document.getElementById('product-stock').value),
        image_url: document.getElementById('product-image').value,
        category_id: parseInt(document.getElementById('product-category').value) || null,
        is_active: true
    };
    
    try {
        const url = productId 
            ? `${ADMIN_API_URL}/products/admin/${productId}`
            : `${ADMIN_API_URL}/products/admin`;
            
        const method = productId ? 'PUT' : 'POST';
        
        const response = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            alert(productId ? 'Product updated!' : 'Product created!');
            closeProductModal();
            loadProducts();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.detail || 'Failed to save product'));
        }
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Failed to save product');
    }
}

// FIXED: Cloudinary URLs are already full URLs - no prefix needed
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Preview
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('image-preview').src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // Upload
    uploadProductImage(file).then(url => {
        if (url) {
            document.getElementById('product-image').value = url;
            document.getElementById('image-preview').src = url; // FIXED: was ADMIN_API_URL + url
        }
    });
}

// ============== ORDER FUNCTIONS ==============

async function loadAllOrders(status = '') {
    try {
        let url = `${ADMIN_API_URL}/orders/admin/all`;
        if (status) url += `?status=${status}`;
        
        const response = await fetchWithAuth(url);
        if (!response.ok) throw new Error('Failed to load orders');
        
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
                        <button onclick="openStatusModal(${order.id}, '${order.status}')" class="btn-primary btn-small">Update</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetchWithAuth(`${ADMIN_API_URL}/orders/admin/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            alert('Status updated!');
            closeStatusModal();
            loadAllOrders();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.detail || 'Failed to update status'));
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// ============== MODAL FUNCTIONS ==============

function openProductModal(productId = null) {
    document.getElementById('product-modal').style.display = 'block';
    document.getElementById('modal-title').textContent = productId ? 'Edit Product' : 'Add Product';
    
    if (productId) {
        fetchWithAuth(`${ADMIN_API_URL}/products/${productId}`)
            .then(res => res.json())
            .then(product => {
                document.getElementById('product-id').value = product.id;
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-description').value = product.description || '';
                document.getElementById('product-price').value = product.price;
                document.getElementById('product-stock').value = product.stock_quantity;
                document.getElementById('product-image').value = product.image_url || '';
                document.getElementById('image-preview').src = product.image_url || 'https://via.placeholder.com/200';
            });
    } else {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('image-preview').src = 'https://via.placeholder.com/200';
    }
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

function openStatusModal(orderId, currentStatus) {
    document.getElementById('status-modal').style.display = 'block';
    document.getElementById('status-order-id').value = orderId;
    document.getElementById('new-status').value = currentStatus;
}

function closeStatusModal() {
    document.getElementById('status-modal').style.display = 'none';
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        const response = await fetchWithAuth(`${ADMIN_API_URL}/products/admin/${productId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Product deleted!');
            loadProducts();
        } else {
            alert('Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
    }
}

// ============== INIT ==============

document.addEventListener('DOMContentLoaded', () => {
    const token = checkAdminAuth();
    if (!token) return;
    
    if (document.getElementById('recent-orders-body')) {
        loadDashboardStats();
    }
    if (document.getElementById('products-table-body')) {
        loadProducts();
    }
    if (document.getElementById('orders-table-body')) {
        loadAllOrders();
    }
    
    const imageInput = document.getElementById('product-image-file');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelect);
    }
});