// Checkout Process - Fixed Version (No Double Submission)

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
                    <img src="${item.image_url || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;object-fit:cover;border-radius:5px;">
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

// Flag to prevent double submission
let isSubmitting = false;

/**
 * Place order - EXPOSED GLOBALLY
 */
window.placeOrder = async function() {
    // Prevent double submission
    if (isSubmitting) {
        console.log('Already submitting, ignoring duplicate request');
        return;
    }
    
    isSubmitting = true;
    
    // Check authentication first
    if (typeof isTokenExpired === 'function' && isTokenExpired()) {
        showToast('Please login to place an order', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        isSubmitting = false;
        return;
    }
    
    // Validate form
    const orderData = validateCheckoutForm();
    if (!orderData) {
        isSubmitting = false;
        return;
    }
    
    // Show loading
    toggleLoading(true);
    
    console.log('Sending order:', orderData);
    
    try {
        const response = await fetchWithAuth(`${window.API_BASE_URL || 'https://apiaro-backend.onrender.com'}/orders/`, {
            method: 'POST',
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
            isSubmitting = false;
        }
    } catch (error) {
        toggleLoading(false);
        isSubmitting = false;
        
        if (error.message === 'Unauthorized' || error.message === 'Token expired') {
            return;
        }
        
        console.error('Order error:', error);
        alert('Network error. Please check your connection and try again.');
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
        
        setTimeout(() => {
            window.location.href = 'orders.html';
        }, 3000);
    } else {
        alert('Order placed successfully! Order #' + orderId);
        window.location.href = 'orders.html';
    }
}

// Initialize checkout page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
} else {
    initCheckout();
}

function initCheckout() {
    // Only run on checkout page
    if (!document.getElementById('checkout-items')) return;
    
    console.log('Initializing checkout...');
    loadCheckoutSummary();
    
    // IMPORTANT: Remove any existing listeners first
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        // Clone and replace to remove all existing listeners
        const newForm = checkoutForm.cloneNode(true);
        checkoutForm.parentNode.replaceChild(newForm, checkoutForm);
        
        // Add single listener
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.placeOrder();
        });
    }
}