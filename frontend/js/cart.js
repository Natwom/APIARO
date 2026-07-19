// Shopping Cart Management
// Delivery Fee: KES 50 (FREE for orders above KES 5,000)

const CART_API_URL = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'https://apiaro-backend.onrender.com';
const DELIVERY_FEE = 50;
const FREE_DELIVERY_THRESHOLD = 5000;

function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    document.querySelectorAll('#cart-count').forEach(el => {
        el.textContent = count;
    });
}

function getCartImageUrl(imageUrl) {
    if (!imageUrl) {
        return 'https://via.placeholder.com/100';
    }
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    return `${CART_API_URL}${imageUrl}`;
}

function addToCart(product) {
    let cart = getCart();
    const existingItem = cart.find(item => item.product_id === product.id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            product_id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            quantity: 1
        });
    }

    saveCart(cart);
    showToast(`${product.name} added to cart!`, 'success');
}

function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.product_id !== productId);
    saveCart(cart);
    renderCart();
}

/**
 * Update quantity of a cart item
 * @param {number|string} productId - The product ID
 * @param {number|string} change - Amount to change (+1, -1) or new absolute value
 * @param {boolean} isAbsolute - If true, change is the new absolute quantity
 */
function updateQuantity(productId, change, isAbsolute = false) {
    let cart = getCart();
    const item = cart.find(item => item.product_id === productId);

    if (item) {
        // Parse change to number (handles string input from HTML)
        let numChange = parseInt(change, 10);
        if (isNaN(numChange)) numChange = 1;

        if (isAbsolute) {
            item.quantity = numChange;
        } else {
            item.quantity += numChange;
        }

        if (item.quantity <= 0) {
            cart = cart.filter(i => i.product_id !== productId);
        }
    }

    saveCart(cart);
    renderCart();
}

function clearCart() {
    localStorage.removeItem('cart');
    updateCartCount();
}

function calculateSubtotal(cart) {
    return cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
}

function calculateDelivery(subtotal) {
    return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}

function renderCart() {
    const cart = getCart();
    const container = document.getElementById('cart-items');
    const emptyDiv = document.getElementById('cart-empty');
    const contentDiv = document.getElementById('cart-content');

    if (cart.length === 0) {
        if (emptyDiv) emptyDiv.style.display = 'block';
        if (contentDiv) contentDiv.style.display = 'none';
        return;
    }

    if (emptyDiv) emptyDiv.style.display = 'none';
    if (contentDiv) contentDiv.style.display = 'grid';

    if (container) {
        container.innerHTML = cart.map(item => {
            const imageUrl = getCartImageUrl(item.image_url);
            // Ensure product_id is properly handled for onclick strings
            const pid = typeof item.product_id === 'string' ? item.product_id : item.product_id;

            return `
            <div class="cart-item">
                <img src="${imageUrl}" 
                     alt="${escapeHtml(item.name)}" 
                     class="cart-item-image"
                     onerror="this.src='https://via.placeholder.com/100'; this.onerror=null;">
                <div class="cart-item-details">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">KES ${parseFloat(item.price).toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button onclick='updateQuantity(${JSON.stringify(pid)}, -1)' aria-label="Decrease quantity">-</button>
                        <span>${item.quantity}</span>
                        <button onclick='updateQuantity(${JSON.stringify(pid)}, 1)' aria-label="Increase quantity">+</button>
                    </div>
                </div>
                <div class="remove-btn" onclick='removeFromCart(${JSON.stringify(pid)})' role="button" tabindex="0" aria-label="Remove item">
                    <i class="fas fa-trash"></i>
                </div>
            </div>
        `}).join('');

        // Calculate totals with dynamic delivery
        const subtotal = calculateSubtotal(cart);
        const delivery = calculateDelivery(subtotal);
        const total = subtotal + delivery;

        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        const deliveryEl = document.getElementById('delivery-fee');

        if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `KES ${total.toFixed(2)}`;
        if (deliveryEl) deliveryEl.textContent = delivery === 0 ? 'FREE' : `KES ${delivery.toFixed(2)}`;

        // Show free delivery notice
        const summary = document.querySelector('.cart-summary');
        if (summary) {
            let notice = summary.querySelector('.free-delivery-notice');
            if (subtotal >= FREE_DELIVERY_THRESHOLD) {
                if (!notice) {
                    notice = document.createElement('div');
                    notice.className = 'free-delivery-notice';
                    notice.style.cssText = 'background:#e8f5e9;color:#2e7d32;padding:10px 15px;border-radius:8px;font-size:0.9em;margin-bottom:15px;text-align:center;';
                    summary.insertBefore(notice, summary.firstChild);
                }
                notice.innerHTML = '<i class="fas fa-check-circle"></i> You qualify for FREE delivery!';
            } else if (notice) {
                notice.remove();
            }
        }
    }
}

/**
 * Escape HTML to prevent XSS in cart rendering
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show toast notification (fallback if not defined elsewhere)
function showToast(message, type = 'success') {
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Remove existing toasts
    document.querySelectorAll('.cart-toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    
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
    }, 3000);
}

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', updateCartCount);

// Expose functions globally for HTML onclick handlers
window.getCart = getCart;
window.saveCart = saveCart;
window.updateCartCount = updateCartCount;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.clearCart = clearCart;
window.calculateSubtotal = calculateSubtotal;
window.calculateDelivery = calculateDelivery;
window.renderCart = renderCart;