// Shopping Cart Management

// Use global API_BASE_URL from auth.js or define fallback
const CART_API_URL = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:8000';

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
    // If no image, return placeholder
    if (!imageUrl) {
        return 'https://via.placeholder.com/100';
    }
    
    // If it's already a full URL, use it as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    
    // If it's a data URI, use it as is
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    
    // Otherwise, prepend the API base URL
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
        
        // Calculate totals
        const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        const delivery = 300;
        const total = subtotal + delivery;
        
        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `KES ${total.toFixed(2)}`;
    }
}

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', updateCartCount);