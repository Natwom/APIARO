// Checkout Process - COMPLETE FIXED VERSION
// Prevents ALL duplicate submissions

// State management
let isSubmitting = false;
let submitStartTime = 0;
const SUBMIT_LOCK_DURATION = 10000; // 10 seconds

/**
 * Get cart from localStorage
 */
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
}

/**
 * Clear cart completely
 */
function clearCart() {
    localStorage.removeItem('cart');
    updateCartCount();
}

/**
 * Update cart count badge
 */
function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = count;
}

/**
 * Load checkout summary
 */
window.loadCheckoutSummary = function() {
    const cart = getCart();
    const container = document.getElementById('checkout-items');
    
    if (cart.length === 0) {
        window.location.href = 'cart.html';
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const qty = parseInt(item.quantity) || 0;
        return sum + (price * qty);
    }, 0);
    
    const delivery = 300;
    const total = subtotal + delivery;
    
    if (container) {
        container.innerHTML = cart.map(item => `
            <div class="summary-item" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${item.image_url || 'https://via.placeholder.com/50'}" 
                         style="width:50px;height:50px;object-fit:cover;border-radius:5px;" 
                         alt="${item.name}">
                    <div>
                        <div style="font-weight:bold;">${item.name}</div>
                        <div style="color:#666;font-size:0.9em;">Qty: ${item.quantity}</div>
                    </div>
                </div>
                <span style="font-weight:bold;">KES ${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
            </div>
        `).join('');
        
        const subtotalEl = document.getElementById('checkout-subtotal');
        const totalEl = document.getElementById('checkout-total');
        if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `KES ${total.toFixed(2)}`;
    }
};

/**
 * Validate form fields
 */
function validateCheckoutForm() {
    const fullName = document.getElementById('full_name')?.value?.trim();
    const phone = document.getElementById('phone')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const county = document.getElementById('county')?.value?.trim();
    const town = document.getElementById('town')?.value?.trim();
    const location = document.getElementById('location')?.value?.trim();
    const terms = document.getElementById('terms')?.checked;
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
    const notes = document.getElementById('notes')?.value?.trim() || "";
    
    const errors = [];
    
    if (!fullName) errors.push('Full name is required');
    if (!phone) errors.push('Phone number is required');
    else if (!/^\+254\d{9}$/.test(phone)) errors.push('Phone must be in format +254XXXXXXXXX');
    
    if (!email) errors.push('Email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    
    if (!county) errors.push('County is required');
    if (!town) errors.push('Town is required');
    if (!location) errors.push('Specific location is required');
    if (!terms) errors.push('You must accept the Terms and Conditions');
    
    if (errors.length > 0) {
        alert('Please fix the following:\n\n' + errors.join('\n'));
        return null;
    }
    
    const cart = getCart();
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return null;
    }
    
    return {
        full_name: fullName,
        phone_number: phone,
        email: email,
        county: county,
        town: town,
        specific_location: location,
        notes: notes,
        payment_method: paymentMethod || "cod",
        terms_accepted: true,
        items: cart.map(item => ({
            product_id: item.product_id,
            quantity: parseInt(item.quantity) || 1
        }))
    };
}

/**
 * Toggle loading modal
 */
function toggleLoading(show) {
    const loadingModal = document.getElementById('loading-modal');
    if (loadingModal) {
        loadingModal.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    // Remove existing
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 10001;
        background: ${colors[type] || colors.success};
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        max-width: 350px;
        word-wrap: break-word;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * PLACE ORDER - Main function with maximum duplicate protection
 */
window.placeOrder = async function() {
    console.log('🚀 placeOrder called at:', new Date().toISOString());
    
    // GUARD 1: Check if already submitting
    if (isSubmitting) {
        console.log('⛔ BLOCKED: Already submitting');
        showToast('Please wait, processing your order...', 'info');
        return;
    }
    
    // GUARD 2: Check time since last submit (prevent double-click)
    const now = Date.now();
    const timeSinceLastSubmit = now - submitStartTime;
    if (timeSinceLastSubmit < SUBMIT_LOCK_DURATION) {
        console.log(`⛔ BLOCKED: ${timeSinceLastSubmit}ms since last submit`);
        showToast('Please wait, order is being processed...', 'warning');
        return;
    }
    
    // GUARD 3: Check if order was recently placed (localStorage)
    const lastOrderTime = localStorage.getItem('last_order_timestamp');
    const lastOrderTotal = localStorage.getItem('last_order_total');
    if (lastOrderTime) {
        const timeSinceLastOrder = now - parseInt(lastOrderTime);
        if (timeSinceLastOrder < 30000) { // 30 seconds
            console.log('⛔ BLOCKED: Recent order found in localStorage');
            showToast('You just placed an order! Please check your orders page.', 'info');
            window.location.href = 'orders.html';
            return;
        }
    }
    
    // Set submission lock
    isSubmitting = true;
    submitStartTime = now;
    
    // Disable submit button immediately
    const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitBtn.style.opacity = '0.7';
    }
    
    // Check auth
    if (typeof isTokenExpired === 'function' && isTokenExpired()) {
        showToast('Please login to place an order', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        resetSubmitState();
        return;
    }
    
    // Validate form
    const orderData = validateCheckoutForm();
    if (!orderData) {
        resetSubmitState();
        return;
    }
    
    // Show loading
    toggleLoading(true);
    
    try {
        const apiUrl = window.API_BASE_URL || 'https://apiaro-backend.onrender.com';
        const token = localStorage.getItem('token');
        
        console.log('📤 Sending order to:', `${apiUrl}/orders/`);
        
        const response = await fetch(`${apiUrl}/orders/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        console.log('📥 Response:', result);
        
        toggleLoading(false);
        
        if (response.ok) {
            // Store success timestamp to prevent re-submission
            localStorage.setItem('last_order_timestamp', Date.now().toString());
            localStorage.setItem('last_order_total', result.total_amount);
            
            // Clear cart
            clearCart();
            
            // Show success
            showSuccess(result);
        } else {
            // Error handling
            const errorMsg = result.detail || 'Failed to place order';
            
            if (response.status === 400 && errorMsg.includes('stock')) {
                alert('Stock Error: ' + errorMsg + '\nPlease adjust quantities and try again.');
            } else if (response.status === 401) {
                alert('Session expired. Please login again.');
                window.location.href = 'login.html';
            } else {
                alert('Error: ' + errorMsg);
            }
            
            resetSubmitState();
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        toggleLoading(false);
        
        if (error.message.includes('Unauthorized') || error.message.includes('Token')) {
            alert('Session expired. Please login again.');
            window.location.href = 'login.html';
        } else {
            alert('Network error. Please check your connection and try again.');
        }
        
        resetSubmitState();
    }
};

/**
 * Reset submit button and flags
 */
function resetSubmitState() {
    isSubmitting = false;
    const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Place Order <i class="fas fa-check"></i>';
        submitBtn.style.opacity = '1';
    }
}

/**
 * Show success and redirect
 */
function showSuccess(result) {
    const successModal = document.getElementById('success-modal');
    
    if (successModal) {
        const orderIdEl = document.getElementById('success-order-id');
        if (orderIdEl) orderIdEl.textContent = result.id;
        successModal.style.display = 'flex';
    } else {
        alert(`Order #${result.id} placed successfully!`);
    }
    
    // Redirect after delay
    setTimeout(() => {
        window.location.href = 'orders.html';
    }, 2500);
}

/**
 * Initialize checkout page - EXACTLY ONCE
 */
function initCheckout() {
    // Only run on checkout page
    if (!document.getElementById('checkout-items')) {
        console.log('Not on checkout page, skipping');
        return;
    }
    
    console.log('✅ Initializing checkout...');
    
    // Load cart summary
    loadCheckoutSummary();
    
    // Setup form with SINGLE event listener
    setupFormOnce();
}

/**
 * Setup form with guaranteed single listener
 */
function setupFormOnce() {
    const form = document.getElementById('checkout-form');
    if (!form) {
        console.error('Checkout form not found!');
        return;
    }
    
    // CRITICAL: Clone node to remove ALL existing listeners
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Add ONE submit listener
    newForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Extra protection
        
        console.log('Form submit event fired');
        window.placeOrder();
    });
    
    console.log('Form setup complete with single listener');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
} else {
    initCheckout();
}

// Expose globally
window.getCart = getCart;
window.clearCart = clearCart;
window.updateCartCount = updateCartCount;