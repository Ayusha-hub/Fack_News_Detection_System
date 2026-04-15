// Admin Dashboard JavaScript

// API base URL
const API_BASE = '/api';

// Current state
let currentTab = 'dashboard';
let usersState = {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    pageSize: 10
};

// Charts
let charts = {};

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAdminAuth();
    
    // Load admin info
    loadAdminInfo();
    
    // Initialize tabs
    initializeTabs();
    
    // Load initial data
    loadDashboardStats();
    
    // Setup event listeners
    setupEventListeners();
});

// Check admin authentication
async function checkAdminAuth() {
    const token = localStorage.getItem('sachet_token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
        const data = await response.json();
        
        if (data.user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'dashboard.html';
            return;
        }
        
    } catch (error) {
        console.error('Admin auth error:', error);
        window.location.href = 'login.html';
    }
}

// Load admin info
async function loadAdminInfo() {
    const token = localStorage.getItem('sachet_token');
    const user = JSON.parse(localStorage.getItem('sachet_user') || '{}');
    
    if (user.name) {
        document.getElementById('adminName').textContent = user.name;
    }
}

// Initialize tabs
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.id.replace('Tab', '');
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('border-indigo-500', 'text-indigo-600');
        button.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTabButton = document.getElementById(tabName + 'Tab');
    activeTabButton.classList.remove('border-transparent', 'text-gray-500');
    activeTabButton.classList.add('border-indigo-500', 'text-indigo-600');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(tabName + 'TabContent').classList.add('active');
    
    // Load data based on tab
    switch (tabName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Broadcast form
    document.getElementById('broadcastForm').addEventListener('submit', handleBroadcast);
    
    // Subscription form
    document.getElementById('subscriptionForm').addEventListener('submit', handleSubscriptionUpdate);
    
    // User search and filters
    document.getElementById('userSearch').addEventListener('input', debounce(loadUsers, 500));
    document.getElementById('roleFilter').addEventListener('change', loadUsers);
    document.getElementById('subscriptionFilter').addEventListener('change', loadUsers);
}

// Load dashboard statistics
async function loadDashboardStats() {
    showLoading();
    
    try {
        const token = localStorage.getItem('sachet_token');
        const response = await fetch(`${API_BASE}/admin/stats?days=30`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateDashboardUI(data);
            createCharts(data);
        } else {
            throw new Error(data.error || 'Failed to load stats');
        }
        
    } catch (error) {
        console.error('Load stats error:', error);
        showError('Failed to load dashboard statistics');
    } finally {
        hideLoading();
    }
}

// Update dashboard UI
function updateDashboardUI(data) {
    const overview = data.overview;
    
    document.getElementById('totalUsers').textContent = overview.totalUsers.toLocaleString();
    document.getElementById('activeSubscriptions').textContent = overview.activeSubscriptions.toLocaleString();
    document.getElementById('totalAnalyses').textContent = overview.totalAnalyses.toLocaleString();
    document.getElementById('conversionRate').textContent = overview.conversionRate + '%';
}

// Create charts
function createCharts(data) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    // User Growth Chart
    const userGrowthCtx = document.getElementById('userGrowthChart').getContext('2d');
    charts.userGrowth = new Chart(userGrowthCtx, {
        type: 'line',
        data: {
            labels: data.userGrowth.map(item => item._id),
            datasets: [{
                label: 'New Users',
                data: data.userGrowth.map(item => item.count),
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Analyses Per Day Chart
    const analysesCtx = document.getElementById('analysesChart').getContext('2d');
    charts.analyses = new Chart(analysesCtx, {
        type: 'bar',
        data: {
            labels: data.analysesPerDay.map(item => item._id),
            datasets: [{
                label: 'Analyses',
                data: data.analysesPerDay.map(item => item.count),
                backgroundColor: 'rgba(147, 51, 234, 0.8)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Subscription Breakdown Chart
    const subscriptionCtx = document.getElementById('subscriptionChart').getContext('2d');
    charts.subscription = new Chart(subscriptionCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data.subscriptionBreakdown),
            datasets: [{
                data: Object.values(data.subscriptionBreakdown),
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(147, 51, 234, 0.8)',
                    'rgba(59, 130, 246, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
    
    // Verdict Breakdown Chart
    const verdictCtx = document.getElementById('verdictChart').getContext('2d');
    charts.verdict = new Chart(verdictCtx, {
        type: 'pie',
        data: {
            labels: data.verdictBreakdown.map(item => item._id),
            datasets: [{
                data: data.verdictBreakdown.map(item => item.count),
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(107, 114, 128, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// Load users
async function loadUsers(page = 1) {
    showLoading();
    
    try {
        const token = localStorage.getItem('sachet_token');
        const search = document.getElementById('userSearch').value;
        const role = document.getElementById('roleFilter').value;
        const subscription = document.getElementById('subscriptionFilter').value;
        
        const params = new URLSearchParams({
            page: page,
            limit: usersState.pageSize
        });
        
        if (search) params.append('search', search);
        if (role) params.append('role', role);
        if (subscription) params.append('subscriptionStatus', subscription);
        
        const response = await fetch(`${API_BASE}/admin/users?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            usersState.currentPage = page;
            usersState.totalPages = data.pagination.totalPages;
            usersState.totalItems = data.pagination.totalUsers;
            
            populateUsersTable(data.users);
            updateUsersPagination();
        } else {
            throw new Error(data.error || 'Failed to load users');
        }
        
    } catch (error) {
        console.error('Load users error:', error);
        showError('Failed to load users');
    } finally {
        hideLoading();
    }
}

// Populate users table
function populateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const subscriptionBadge = getSubscriptionBadge(user.subscriptionStatus, user.activeSubscription);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <i class="fas fa-user text-gray-500"></i>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${user.name}</div>
                        <div class="text-sm text-gray-500">${user.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                    ${user.role}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${subscriptionBadge}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(user.createdAt).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="openSubscriptionModal('${user._id}', '${user.email}', '${user.subscriptionStatus}')" class="text-indigo-600 hover:text-indigo-900 mr-3">
                    <i class="fas fa-crown"></i> Subscription
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Get subscription badge HTML
function getSubscriptionBadge(status, activeSubscription) {
    if (activeSubscription) {
        const daysRemaining = activeSubscription.daysRemaining;
        return `
            <div>
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                    ${status} (${daysRemaining} days left)
                </span>
            </div>
        `;
    }
    
    const colors = {
        free: 'bg-green-100 text-green-800',
        pro: 'bg-purple-100 text-purple-800',
        college: 'bg-blue-100 text-blue-800'
    };
    
    return `
        <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}">
            ${status}
        </span>
    `;
}

// Update users pagination
function updateUsersPagination() {
    const from = (usersState.currentPage - 1) * usersState.pageSize + 1;
    const to = Math.min(usersState.currentPage * usersState.pageSize, usersState.totalItems);
    
    document.getElementById('showingFrom').textContent = from;
    document.getElementById('showingTo').textContent = to;
    document.getElementById('totalUsersCount').textContent = usersState.totalItems;
    document.getElementById('currentPageUsers').textContent = usersState.currentPage;
    
    document.getElementById('prevUsersBtn').disabled = usersState.currentPage === 1;
    document.getElementById('nextUsersBtn').disabled = usersState.currentPage === usersState.totalPages;
}

// Load users page
function loadUsersPage(direction) {
    let newPage = usersState.currentPage;
    
    if (direction === 'prev' && usersState.currentPage > 1) {
        newPage--;
    } else if (direction === 'next' && usersState.currentPage < usersState.totalPages) {
        newPage++;
    }
    
    if (newPage !== usersState.currentPage) {
        loadUsers(newPage);
    }
}

// Handle broadcast
async function handleBroadcast(event) {
    event.preventDefault();
    
    const subject = document.getElementById('broadcastSubject').value;
    const message = document.getElementById('broadcastMessage').value;
    const targetAudience = document.getElementById('targetAudience').value;
    
    const channels = Array.from(document.querySelectorAll('input[name="channels"]:checked'))
        .map(cb => cb.value);
    
    if (!message.trim()) {
        showError('Message content is required');
        return;
    }
    
    if (channels.length === 0) {
        showError('At least one channel must be selected');
        return;
    }
    
    showLoading();
    
    try {
        const token = localStorage.getItem('sachet_token');
        const response = await fetch(`${API_BASE}/admin/broadcast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                subject,
                message,
                channels,
                targetAudience
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess(`Broadcast sent successfully! Reached ${data.totalUsers} users.`);
            document.getElementById('broadcastForm').reset();
        } else {
            throw new Error(data.error || 'Broadcast failed');
        }
        
    } catch (error) {
        console.error('Broadcast error:', error);
        showError('Broadcast failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Handle subscription update
async function handleSubscriptionUpdate(event) {
    event.preventDefault();
    
    const email = document.getElementById('userEmail').value;
    const plan = document.getElementById('subscriptionPlan').value;
    const status = document.getElementById('subscriptionStatus').value;
    const endDate = document.getElementById('subscriptionEndDate').value;
    const reason = document.getElementById('subscriptionReason').value;
    
    if (!email) {
        showError('User email is required');
        return;
    }
    
    showLoading();
    
    try {
        // First find user by email
        const token = localStorage.getItem('sachet_token');
        const usersResponse = await fetch(`${API_BASE}/admin/users?search=${email}&limit=1`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const usersData = await usersResponse.json();
        
        if (!usersResponse.ok || usersData.users.length === 0) {
            throw new Error('User not found');
        }
        
        const user = usersData.users[0];
        
        // Update subscription
        const response = await fetch(`${API_BASE}/admin/user/${user._id}/subscription`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                plan,
                status,
                endDate: endDate || null,
                reason
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Subscription updated successfully!');
            document.getElementById('subscriptionForm').reset();
            
            // Refresh users if on users tab
            if (currentTab === 'users') {
                loadUsers(usersState.currentPage);
            }
        } else {
            throw new Error(data.error || 'Subscription update failed');
        }
        
    } catch (error) {
        console.error('Subscription update error:', error);
        showError('Subscription update failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Open subscription modal for user
function openSubscriptionModal(userId, email, currentStatus) {
    // Switch to subscriptions tab
    switchTab('subscriptions');
    
    // Pre-fill form
    document.getElementById('userEmail').value = email;
    document.getElementById('subscriptionStatus').value = currentStatus;
    
    // Clear other fields
    document.getElementById('subscriptionPlan').value = '';
    document.getElementById('subscriptionEndDate').value = '';
    document.getElementById('subscriptionReason').value = '';
    
    // Scroll to form
    document.getElementById('subscriptionForm').scrollIntoView({ behavior: 'smooth' });
}

// Show loading
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

// Hide loading
function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Show success message
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50';
    successDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 5000);
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50';
    errorDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('sachet_token');
    localStorage.removeItem('sachet_user');
    window.location.href = 'login.html';
}

// Export functions for global access
window.switchTab = switchTab;
window.loadUsersPage = loadUsersPage;
window.openSubscriptionModal = openSubscriptionModal;
window.handleLogout = handleLogout;
