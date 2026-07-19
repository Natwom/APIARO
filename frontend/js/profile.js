// Profile Page Logic

const API_BASE_URL = window.API_BASE_URL || 'https://apiaro-backend.onrender.com';

// Check auth immediately
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired()) {
        showToast('Please login to view your profile', 'error');
        setTimeout(() => {
            window.location.href = 'login.html?redirect=profile.html';
        }, 1500);
        return;
    }
    
    checkAuth();
    updateCartCount();
    loadProfile();
});

/**
 * Toggle loading overlay
 */
function toggleLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('active', show);
}

/**
 * Load user profile from API
 */
async function loadProfile() {
    toggleLoading(true);
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/me/profile`);
        const profile = await response.json();
        
        if (!response.ok) {
            throw new Error(profile.detail || 'Failed to load profile');
        }
        
        // Update avatar
        const avatarImg = document.getElementById('profile-avatar-img');
        if (avatarImg) {
            avatarImg.src = getAvatarUrl(profile.profile_picture);
            avatarImg.alt = profile.full_name;
        }
        
        // Update header info
        document.getElementById('profile-display-name').textContent = profile.full_name;
        document.getElementById('profile-display-email').textContent = profile.email;
        
        // Update stats
        document.getElementById('stat-orders').textContent = profile.total_orders || 0;
        const memberSince = profile.created_at 
            ? new Date(profile.created_at).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })
            : '-';
        document.getElementById('stat-member-since').textContent = memberSince;
        
        // Update form fields
        document.getElementById('full_name').value = profile.full_name || '';
        document.getElementById('phone_number').value = profile.phone_number || '';
        document.getElementById('bio').value = profile.bio || '';
        document.getElementById('county').value = profile.county || '';
        document.getElementById('town').value = profile.town || '';
        document.getElementById('address').value = profile.address || '';
        
        // Update bio counter
        const bioLength = profile.bio ? profile.bio.length : 0;
        document.getElementById('bio-count').textContent = `${bioLength} / 500`;
        
        // Update account info
        document.getElementById('info-email').textContent = profile.email;
        document.getElementById('info-id').textContent = `#${profile.id}`;
        document.getElementById('info-updated').textContent = profile.updated_at 
            ? new Date(profile.updated_at).toLocaleString('en-KE')
            : 'Never';
        
        // Update stored user data with new profile picture
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.profile_picture = profile.profile_picture;
        storedUser.full_name = profile.full_name;
        localStorage.setItem('user', JSON.stringify(storedUser));
        
        // Refresh navbar avatar
        checkAuth();
        
    } catch (error) {
        console.error('Load profile error:', error);
        showToast(error.message || 'Failed to load profile', 'error');
        
        if (error.message === 'Unauthorized') {
            setTimeout(() => {
                window.location.href = 'login.html?redirect=profile.html';
            }, 1500);
        }
    } finally {
        toggleLoading(false);
    }
}

/**
 * Save profile changes
 */
async function saveProfile() {
    const saveBtn = document.getElementById('save-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    const data = {
        full_name: document.getElementById('full_name').value.trim(),
        phone_number: document.getElementById('phone_number').value.trim(),
        bio: document.getElementById('bio').value.trim() || null,
        county: document.getElementById('county').value.trim() || null,
        town: document.getElementById('town').value.trim() || null,
        address: document.getElementById('address').value.trim() || null
    };
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/me/profile`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.detail || 'Failed to update profile');
        }
        
        // Update stored user
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.full_name = result.full_name;
        storedUser.phone_number = result.phone_number;
        localStorage.setItem('user', JSON.stringify(storedUser));
        
        // Refresh UI
        checkAuth();
        loadProfile();
        
        showToast('Profile updated successfully!', 'success');
        
    } catch (error) {
        console.error('Save profile error:', error);
        showToast(error.message || 'Failed to save profile', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

/**
 * Handle avatar upload
 */
async function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Please select a valid image (JPG, PNG, WEBP)', 'error');
        input.value = '';
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image too large. Max size: 5MB', 'error');
        input.value = '';
        return;
    }
    
    toggleLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/me/avatar`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.detail || 'Failed to upload avatar');
        }
        
        // Update stored user with new avatar
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.profile_picture = result.profile_picture;
        localStorage.setItem('user', JSON.stringify(storedUser));
        
        // Refresh UI
        checkAuth();
        loadProfile();
        
        showToast('Profile photo updated!', 'success');
        
    } catch (error) {
        console.error('Avatar upload error:', error);
        showToast(error.message || 'Failed to upload photo', 'error');
    } finally {
        toggleLoading(false);
        input.value = '';
    }
}

/**
 * Confirm and delete avatar
 */
function confirmDeleteAvatar() {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!storedUser.profile_picture) {
        showToast('No profile photo to remove', 'info');
        return;
    }
    
    if (!confirm('Are you sure you want to remove your profile photo?')) {
        return;
    }
    
    deleteAvatar();
}

/**
 * Delete avatar
 */
async function deleteAvatar() {
    toggleLoading(true);
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/me/avatar`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.detail || 'Failed to remove avatar');
        }
        
        // Update stored user
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.profile_picture = null;
        localStorage.setItem('user', JSON.stringify(storedUser));
        
        // Refresh UI
        checkAuth();
        loadProfile();
        
        showToast('Profile photo removed', 'success');
        
    } catch (error) {
        console.error('Delete avatar error:', error);
        showToast(error.message || 'Failed to remove photo', 'error');
    } finally {
        toggleLoading(false);
    }
}

/**
 * Get avatar URL with fallback
 */
function getAvatarUrl(profilePicture) {
    if (!profilePicture) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const name = user.full_name || 'User';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a56db&color=fff&size=256`;
    }
    if (profilePicture.startsWith('http')) {
        return profilePicture;
    }
    return `${API_BASE_URL}${profilePicture}`;
}