// Products Management - Uses API_BASE_URL from auth.js

// ========== ADDED: Search History Module ==========
const SearchHistory = {
    API_BASE: API_BASE_URL,
    
    init() {
        this.searchInput = document.getElementById('search-input');
        this.dropdown = document.getElementById('search-history-dropdown');
        this.historyList = document.getElementById('search-history-list');
        
        if (!this.searchInput) return;
        
        this.attachEventListeners();
        this.loadHistory();
    },
    
    attachEventListeners() {
        // Show dropdown on focus
        this.searchInput.addEventListener('focus', () => {
            this.showDropdown();
            this.loadHistory();
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) {
                this.hideDropdown();
            }
        });
        
        // Handle search submission
        const searchBtn = document.querySelector('.search-bar button');
        searchBtn?.addEventListener('click', () => {
            this.performSearch(this.searchInput.value);
        });
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(this.searchInput.value);
            }
        });
    },
    
    getToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    },
    
    isLoggedIn() {
        return !!this.getToken();
    },
    
    async loadHistory() {
        if (this.isLoggedIn()) {
            try {
                const response = await fetch(`${this.API_BASE}/search/history?limit=10`, {
                    headers: { 'Authorization': `Bearer ${this.getToken()}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    this.renderHistory(data.searches || []);
                    this.syncLocalToBackend();
                }
            } catch (err) {
                console.error('Failed to load search history:', err);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    },
    
    loadFromLocalStorage() {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        const formatted = history.map((item, index) => ({
            id: `local_${index}`,
            search_query: item.query,
            search_count: item.count || 1,
            last_searched: item.lastSearched
        }));
        this.renderHistory(formatted);
    },
    
    saveToLocalStorage(query) {
        let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        
        const existing = history.find(h => h.query.toLowerCase() === query.toLowerCase());
        if (existing) {
            existing.count = (existing.count || 1) + 1;
            existing.lastSearched = new Date().toISOString();
            history = history.filter(h => h.query.toLowerCase() !== query.toLowerCase());
            history.unshift(existing);
        } else {
            history.unshift({
                query: query,
                count: 1,
                lastSearched: new Date().toISOString()
            });
        }
        
        history = history.slice(0, 20);
        localStorage.setItem('searchHistory', JSON.stringify(history));
    },
    
    async syncLocalToBackend() {
        const token = this.getToken();
        const localHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        
        if (!token || localHistory.length === 0) return;
        
        for (const item of localHistory) {
            try {
                await fetch(`${this.API_BASE}/search/history?query=${encodeURIComponent(item.query)}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Sync failed for:', item.query);
            }
        }
        
        localStorage.removeItem('searchHistory');
    },
    
    async performSearch(query) {
        query = query.trim();
        if (!query) return;
        
        const token = this.getToken();
        
        if (token) {
            try {
                await fetch(`${this.API_BASE}/search/history?query=${encodeURIComponent(query)}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Failed to save search:', err);
            }
        } else {
            this.saveToLocalStorage(query);
        }
        
        this.hideDropdown();
        loadProducts(null, query);
    },
    
    renderHistory(searches) {
        if (!this.historyList) return;
        
        if (!searches || searches.length === 0) {
            this.historyList.innerHTML = '<li class="search-history-empty"><i class="fas fa-search" style="display:block; margin-bottom:8px; font-size:20px;"></i>No recent searches</li>';
            return;
        }
        
        this.historyList.innerHTML = searches.map(search => `
            <li data-query="${this.escapeHtml(search.search_query)}" data-id="${search.id}">
                <div class="search-text">
                    <i class="fas fa-history"></i>
                    <span>${this.escapeHtml(search.search_query)}</span>
                    ${search.search_count > 1 ? `<span class="search-count">(${search.search_count}x)</span>` : ''}
                </div>
                <button class="delete-search-btn" data-id="${search.id}" data-query="${this.escapeHtml(search.search_query)}" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `).join('');
        
        // Click on search item to search
        this.historyList.querySelectorAll('li[data-query]').forEach(li => {
            li.addEventListener('click', (e) => {
                if (e.target.closest('.delete-search-btn')) return;
                const query = li.dataset.query;
                this.searchInput.value = query;
                this.performSearch(query);
            });
        });
        
        // Delete individual search
        this.historyList.querySelectorAll('.delete-search-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const query = btn.dataset.query;
                await this.deleteSearch(id, query);
            });
        });
    },
    
    async deleteSearch(id, query) {
        const token = this.getToken();
        
        if (token && !String(id).startsWith('local_')) {
            try {
                await fetch(`${this.API_BASE}/search/history/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Failed to delete search:', err);
            }
        } else {
            let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            history = history.filter(h => h.query.toLowerCase() !== query.toLowerCase());
            localStorage.setItem('searchHistory', JSON.stringify(history));
        }
        
        this.loadHistory();
    },
    
    async clearAllSearchHistory() {
        const token = this.getToken();
        
        if (token) {
            try {
                await fetch(`${this.API_BASE}/search/history`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Failed to clear history:', err);
            }
        }
        
        localStorage.removeItem('searchHistory');
        this.loadHistory();
    },
    
    showDropdown() {
        if (this.dropdown) this.dropdown.style.display = 'block';
    },
    
    hideDropdown() {
        setTimeout(() => {
            if (this.dropdown) this.dropdown.style.display = 'none';
        }, 200);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make clearAllSearchHistory globally accessible for the HTML onclick
window.clearAllSearchHistory = () => SearchHistory.clearAllSearchHistory();

// ========== EXISTING: Categories & Products ==========

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/products/categories/all`);
        const data = await response.json();
        
        const categories = Array.isArray(data) ? data : (data.categories || []);
        
        const container = document.getElementById('category-filters');
        if (container && categories.length > 0) {
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
    if (!imageUrl) {
        return 'https://via.placeholder.com/300';
    }
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    
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
    document.querySelectorAll('.filters li').forEach(li => li.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    
    loadProducts(categoryId);
}

// Search functionality
function searchProducts() {
    const query = document.getElementById('search-input').value;
    SearchHistory.performSearch(query);
}

// Handle Enter key in search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchProducts();
        });
    }
    
    // Initialize search history
    SearchHistory.init();
});