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

function updateQuantity(productId, change) {
    let cart = getCart();
    const item = cart.find(item => item.product_id === productId);

    if (item) {
        item.quantity += change;
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

            return `
            <div class="cart-item">
                <img src="${imageUrl}" 
                     alt="${item.name}" 
                     class="cart-item-image"
                     onerror="this.src='https://via.placeholder.com/100'; this.onerror=null;">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">KES ${parseFloat(item.price).toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button onclick="updateQuantity(${item.product_id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity(${item.product_id}, 1)">+</button>
                    </div>
                </div>
                <div class="remove-btn" onclick="removeFromCart(${item.product_id})">
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

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', updateCartCount);
