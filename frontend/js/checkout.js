// Checkout Process - Complete Fixed Version
// Prevents double submission, handles errors properly

// Module-level variables
let isSubmitting = false;
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN = 5000; // 5 seconds between submissions

/**
 * Get cart from localStorage
 */
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
}

/**
 * Clear cart
 */
function clearCart() {
    localStorage.removeItem('cart');
}

/**
 * Update cart count in header
 */
function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = count;
}

/**
 * Load checkout summary - EXPOSED GLOBALLY
 */
window.loadCheckoutSummary = function() {
    const cart = getCart();
    const container = document.getElementById('checkout-items');
    
    if (cart.length === 0) {
        window.location.href = 'cart.html';
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    const delivery = 300;
    const total = subtotal + delivery;
    
    if (container) {
        container.innerHTML = cart.map(item => `
            <div class="summary-item" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${item.image_url || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;object-fit:cover;border-radius:5px;" alt="${item.name}">
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
 * Validate checkout form
 * @returns {object|null} order data if valid, null if invalid
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
            quantity: item.quantity
        }))
    };
}

/**
 * Show/hide loading modal
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
    // Remove existing toasts
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    
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
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.style.transform = 'translateX(0)', 10);
    
    // Remove after delay
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Reset submit button state
 */
function resetSubmitButton() {
    isSubmitting = false;
    const btn = document.querySelector('#checkout-form button[type="submit"]');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Place Order <i class="fas fa-check"></i>';
    }
}

/**
 * Place order - EXPOSED GLOBALLY with duplicate protection
 */
window.placeOrder = async function() {
    // Prevent double submission - check flag
    if (isSubmitting) {
        console.log('Already submitting, please wait...');
        showToast('Please wait, processing your order...', 'info');
        return;
    }
    
    // Prevent rapid re-submission (5 second cooldown)
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN) {
        console.log('Submit too soon, blocking');
        showToast('Please wait a moment before trying again', 'warning');
        return;
    }
    
    // Set submission flag
    isSubmitting = true;
    lastSubmitTime = now;
    
    // Disable button immediately
    const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    // Check authentication
    if (typeof isTokenExpired === 'function' && isTokenExpired()) {
        showToast('Please login to place an order', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        resetSubmitButton();
        return;
    }
    
    // Validate form
    const orderData = validateCheckoutForm();
    if (!orderData) {
        resetSubmitButton();
        return;
    }
    
    // Show loading modal
    toggleLoading(true);
    
    console.log('Sending order:', orderData);
    
    try {
        // Use fetchWithAuth from auth.js (global) or fallback to regular fetch
        const fetchFn = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch;
        const apiUrl = window.API_BASE_URL || 'https://apiaro-backend.onrender.com';
        
        const response = await fetchFn(`${apiUrl}/orders/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        console.log('Order response:', result);
        
        toggleLoading(false);
        
        if (response.ok) {
            // Clear cart
            clearCart();
            updateCartCount();
            
            // Show success
            showSuccessModal(result.id);
        } else {
            // Handle specific errors
            const errorMsg = result.detail || 'Failed to place order';
            console.error('Order error:', result);
            
            if (response.status === 400 && errorMsg.includes('stock')) {
                alert('Stock Error: ' + errorMsg + '\n\nPlease adjust quantities and try again.');
            } else if (response.status === 422) {
                alert('Validation Error: ' + errorMsg);
            } else if (response.status === 401) {
                alert('Session expired. Please login again.');
                window.location.href = 'login.html';
            } else {
                alert('Error: ' + errorMsg);
            }
            
            // Re-enable button on error
            resetSubmitButton();
        }
    } catch (error) {
        toggleLoading(false);
        
        if (error.message === 'Unauthorized' || error.message === 'Token expired') {
            resetSubmitButton();
            return;
        }
        
        console.error('Order error:', error);
        alert('Network error. Please check your connection and try again.');
        
        // Re-enable button on error
        resetSubmitButton();
    }
};

/**
 * Show success modal or redirect
 */
function showSuccessModal(orderId) {
    const successModal = document.getElementById('success-modal');
    if (successModal) {
        const orderIdEl = document.getElementById('success-order-id');
        if (orderIdEl) orderIdEl.textContent = orderId;
        
        successModal.style.display = 'flex';
        
        // Auto redirect after 3 seconds
        setTimeout(() => {
            window.location.href = 'orders.html';
        }, 3000);
    } else {
        alert('Order placed successfully! Order #' + orderId);
        window.location.href = 'orders.html';
    }
}

/**
 * Initialize checkout page
 */
function initCheckout() {
    // Only run on checkout page
    if (!document.getElementById('checkout-items')) {
        console.log('Not on checkout page, skipping init');
        return;
    }
    
    console.log('Initializing checkout...');
    
    // Load summary
    loadCheckoutSummary();
    
    // Setup form with duplicate protection
    setupCheckoutForm();
}

/**
 * Setup form event listener with protection against double attachments
 */
function setupCheckoutForm() {
    const checkoutForm = document.getElementById('checkout-form');
    if (!checkoutForm) {
        console.error('Checkout form not found!');
        return;
    }
    
    // Clone and replace to remove ANY existing listeners (prevents duplicates)
    const newForm = checkoutForm.cloneNode(true);
    checkoutForm.parentNode.replaceChild(newForm, checkoutForm);
    
    // Add single submit listener
    newForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Form submitted, calling placeOrder...');
        window.placeOrder();
    });
    
    console.log('Checkout form initialized with duplicate protection');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
} else {
    // DOM already loaded
    initCheckout();
}

// Also expose functions globally for inline handlers
window.getCart = getCart;
window.clearCart = clearCart;
window.updateCartCount = updateCartCount;
window.toggleLoading = toggleLoading;
window.showSuccessModal = showSuccessModal;