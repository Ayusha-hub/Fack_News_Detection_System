// Authentication JavaScript

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Current form state
let currentForm = 'login';

// Tab switching
function switchTab(form) {
    currentForm = form;
    
    // Update tab buttons
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (form === 'login') {
        loginTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-l-lg bg-indigo-600 text-white transition-colors';
        signupTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-r-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors';
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    } else {
        signupTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-r-lg bg-indigo-600 text-white transition-colors';
        loginTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-l-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors';
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    }
    
    hideMessages();
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
}

// Show success message
function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
}

// Hide all messages
function hideMessages() {
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
}

// Set loading state
function setLoading(form, loading) {
    const buttonText = form === 'login' ? 'loginButtonText' : 'signupButtonText';
    const button = form === 'login' ? 
        document.querySelector('#loginForm button[type="submit"]') :
        document.querySelector('#signupForm button[type="submit"]');
    
    if (loading) {
        document.getElementById(buttonText).innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>Processing...';
        button.classList.add('loading');
    } else {
        document.getElementById(buttonText).textContent = form === 'login' ? 'Login' : 'Sign Up';
        button.classList.remove('loading');
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    hideMessages();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    setLoading('login', true);
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store JWT token
            localStorage.setItem('sachet_token', data.token);
            localStorage.setItem('sachet_user', JSON.stringify(data.user));
            
            showSuccess('Login successful! Redirecting...');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
    } finally {
        setLoading('login', false);
    }
}

// Handle signup
async function handleSignup(event) {
    event.preventDefault();
    hideMessages();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    if (!name || !email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    setLoading('signup', true);
    
    try {
        const response = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store JWT token
            localStorage.setItem('sachet_token', data.token);
            localStorage.setItem('sachet_user', JSON.stringify(data.user));
            
            showSuccess('Account created successfully! Redirecting...');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showError(data.error || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showError('Network error. Please try again.');
    } finally {
        setLoading('signup', false);
    }
}

// Handle Google OAuth
function handleGoogleLogin() {
    window.location.href = `${API_BASE}/auth/google`;
}

// Handle Microsoft OAuth
function handleMicrosoftLogin() {
    window.location.href = `${API_BASE}/auth/microsoft`;
}

// Handle demo login
async function handleDemoLogin() {
    hideMessages();
    
    const demoCredentials = {
        email: 'demo@sachet.edu',
        password: 'demo123'
    };
    
    setLoading('login', true);
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(demoCredentials)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store JWT token
            localStorage.setItem('sachet_token', data.token);
            localStorage.setItem('sachet_user', JSON.stringify(data.user));
            
            showSuccess('Demo login successful! Redirecting...');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showError(data.error || 'Demo login failed');
        }
    } catch (error) {
        console.error('Demo login error:', error);
        showError('Network error. Please try again.');
    } finally {
        setLoading('login', false);
    }
}

// Handle OAuth callback
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (error) {
        showError('OAuth login failed. Please try again.');
        return;
    }
    
    if (token) {
        localStorage.setItem('sachet_token', token);
        
        // Get user info
        fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.user) {
                localStorage.setItem('sachet_user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } else {
                showError('Failed to get user information');
            }
        })
        .catch(error => {
            console.error('Get user info error:', error);
            showError('Failed to get user information');
        });
    }
}

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('sachet_token');
    const user = localStorage.getItem('sachet_user');
    
    if (token && user) {
        // Verify token is still valid
        fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                window.location.href = 'dashboard.html';
            } else {
                // Token invalid, remove it
                localStorage.removeItem('sachet_token');
                localStorage.removeItem('sachet_user');
            }
        })
        .catch(error => {
            console.error('Auth check error:', error);
            // On network error, assume token is invalid
            localStorage.removeItem('sachet_token');
            localStorage.removeItem('sachet_user');
        });
    }
}

// Logout function
function handleLogout() {
    localStorage.removeItem('sachet_token');
    localStorage.removeItem('sachet_user');
    window.location.href = 'login.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if this is an OAuth callback
    if (window.location.search.includes('token=')) {
        handleOAuthCallback();
        return;
    }
    
    // Check if user is already logged in
    checkAuthStatus();
    
    // Add form validation
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const inputs = form.querySelectorAll('input[required]');
            let isValid = true;
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.classList.add('border-red-500');
                } else {
                    input.classList.remove('border-red-500');
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                showError('Please fill in all required fields');
            }
        });
    });
    
    // Add input event listeners to remove error styling
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('border-red-500');
        });
    });
});

// Export functions for global access
window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleLogin = handleGoogleLogin;
window.handleMicrosoftLogin = handleMicrosoftLogin;
window.handleDemoLogin = handleDemoLogin;
window.handleLogout = handleLogout;
