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
    
    // Show toast if available, otherwise alert
    if (typeof showToast === 'function') {
        showToast(`${product.name} added to cart!`, 'success');
    }
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
        container.innerHTML = cart.map((item, index) => {
            const imageUrl = getCartImageUrl(item.image_url);

            return `
            <div class="cart-item" style="animation-delay: ${index * 0.05}s">
                <div class="product-info">
                    <div class="product-image">
                        <img src="${imageUrl}" alt="${item.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>';">
                    </div>
                    <div class="product-details">
                        <h4>${item.name}</h4>
                        <div class="stock-status"><i class="fas fa-check-circle"></i> In Stock</div>
                    </div>
                </div>
                <div class="price">KES ${parseFloat(item.price).toLocaleString()}</div>
                <div class="quantity-control-wrapper">
                    <div class="quantity-control">
                        <button onclick="updateQuantity(${item.product_id}, -1)"><i class="fas fa-minus" style="font-size: 0.625rem;"></i></button>
                        <input type="number" value="${item.quantity}" min="1" onchange="updateQuantity(${item.product_id}, parseInt(this.value) - ${item.quantity})">
                        <button onclick="updateQuantity(${item.product_id}, 1)"><i class="fas fa-plus" style="font-size: 0.625rem;"></i></button>
                    </div>
                </div>
                <div class="item-total">KES ${(parseFloat(item.price) * item.quantity).toLocaleString()}</div>
                <button class="remove-btn" onclick="removeFromCart(${item.product_id})" title="Remove item">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `}).join('');

        // Calculate totals with dynamic delivery
        const subtotal = calculateSubtotal(cart);
        const delivery = calculateDelivery(subtotal);
        const total = subtotal + delivery;
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        const deliveryEl = document.getElementById('delivery-fee');
        const itemCountEl = document.getElementById('item-count');

        if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toLocaleString()}`;
        if (totalEl) totalEl.textContent = `KES ${total.toLocaleString()}`;
        if (deliveryEl) deliveryEl.textContent = delivery === 0 ? 'FREE' : `KES ${delivery.toLocaleString()}`;
        if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

        // Show free delivery notice
        const summary = document.querySelector('.cart-summary');
        if (summary) {
            let notice = summary.querySelector('.free-delivery-notice');
            if (subtotal >= FREE_DELIVERY_THRESHOLD) {
                if (!notice) {
                    notice = document.createElement('div');
                    notice.className = 'free-delivery-notice';
                    notice.style.cssText = 'background:linear-gradient(135deg, #d1fae5, #a7f3d0);color:#065f46;padding:10px 15px;border-radius:10px;font-size:0.875rem;margin-bottom:15px;text-align:center;font-weight:600;';
                    const header = summary.querySelector('.summary-header');
                    if (header && header.nextSibling) {
                        summary.insertBefore(notice, header.nextSibling);
                    } else {
                        summary.appendChild(notice);
                    }
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