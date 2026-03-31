// Products Management - Uses API_BASE_URL from auth.js

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/products/categories/all`);
        const data = await response.json();
        
        // Handle both array and object response formats
        const categories = Array.isArray(data) ? data : (data.categories || []);
        
        const container = document.getElementById('category-filters');
        if (container && categories.length > 0) {
            // Clear existing except "All Products"
            const allProductsLi = container.querySelector('li:first-child');
            container.innerHTML = '';
            if (allProductsLi) container.appendChild(allProductsLi);
            
            categories.forEach(cat => {
                const li = document.createElement('li');
                li.textContent = cat.name;
                li.onclick = () => filterByCategory(cat.id);
                container.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Don't break the page if categories fail to load
    }
}

async function loadProducts(categoryId = null, searchQuery = null) {
    try {
        let url = `${API_BASE_URL}/products/`;
        const params = new URLSearchParams();
        
        if (categoryId) params.append('category_id', categoryId);
        if (searchQuery) params.append('search', searchQuery);
        
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        // Handle both array and object response formats
        const products = Array.isArray(data) ? data : (data.products || []);
        
        renderProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        const container = document.getElementById('products-container');
        if (container) {
            container.innerHTML = '<p class="error">Failed to load products. Please try again.</p>';
        }
    }
}

function getImageUrl(imageUrl) {
    // If no image, return placeholder
    if (!imageUrl) {
        return 'https://via.placeholder.com/300';
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
    return `${API_BASE_URL}${imageUrl}`;
}

function renderProducts(products) {
    const container = document.getElementById('products-container');
    
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = '<p class="no-products">No products found.</p>';
        return;
    }
    
    container.innerHTML = products.map(product => {
        const imageUrl = getImageUrl(product.image_url);
        
        // Truncate description to 100 characters
        const description = product.description 
            ? product.description.substring(0, 100) + (product.description.length > 100 ? '...' : '')
            : '';
        
        return `
        <div class="product-card" style="border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s; display: flex; flex-direction: column; height: 100%;">
            <img src="${imageUrl}" 
                 alt="${product.name}" 
                 class="product-image" 
                 style="width: 100%; height: 200px; object-fit: cover;"
                 onerror="this.src='https://via.placeholder.com/300'; this.onerror=null;">
            <div class="product-info" style="padding: 15px; display: flex; flex-direction: column; flex-grow: 1;">
                <h3 class="product-title" style="margin: 0 0 8px 0; font-size: 1.1em; color: #333;">${product.name}</h3>
                ${description ? `<p class="product-description" style="color: #666; font-size: 0.9em; margin: 0 0 12px 0; line-height: 1.4; flex-grow: 1;">${description}</p>` : '<div style="flex-grow: 1;"></div>'}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid #eee;">
                    <p class="product-price" style="font-weight: bold; color: #e74c3c; font-size: 1.2em; margin: 0;">KES ${parseFloat(product.price).toFixed(2)}</p>
                    <button class="btn-add-cart" onclick='addToCart(${JSON.stringify(product).replace(/'/g, "&apos;")})' style="background: #2c5aa0; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

function filterByCategory(categoryId) {
    // Update active state
    document.querySelectorAll('.filters li').forEach(li => li.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    
    loadProducts(categoryId);
}

// Search functionality
function searchProducts() {
    const query = document.getElementById('search-input').value;
    loadProducts(null, query);
}

// Handle Enter key in search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchProducts();
        });
    }
});