// Tu Avec Frontend - API Integration
// Add this script to your HTML file

// Configuration
const API_URL = 'http://localhost:5000/api'; // Change this to your deployed backend URL

// ========== API HELPER FUNCTIONS ==========

async function apiRequest(endpoint, options = {}) {
    try {
        const token = localStorage.getItem('tuavec_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ========== PRODUCT API ==========

async function fetchProducts() {
    try {
        const data = await apiRequest('/products');
        products = data;
        renderProducts();
    } catch (error) {
        console.error('Failed to fetch products:', error);
        showToast('Failed to load products. Using cached data.', 'error');
        // Keep using hardcoded products as fallback
    }
}

async function fetchProduct(id) {
    try {
        return await apiRequest(`/products/${id}`);
    } catch (error) {
        console.error('Failed to fetch product:', error);
        return null;
    }
}

// ========== AUTH API ==========

async function register(name, email, password) {
    try {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
            skipAuth: true
        });
        
        // Save token and user data
        localStorage.setItem('tuavec_token', data.token);
        localStorage.setItem('tuavec_user', JSON.stringify(data.user));
        
        currentUser = data.user;
        updateAuthUI();
        
        showToast('Account created successfully!', 'success');
        return data;
    } catch (error) {
        showToast(error.message || 'Registration failed', 'error');
        throw error;
    }
}

async function login(email, password) {
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            skipAuth: true
        });
        
        // Save token and user data
        localStorage.setItem('tuavec_token', data.token);
        localStorage.setItem('tuavec_user', JSON.stringify(data.user));
        
        currentUser = data.user;
        updateAuthUI();
        
        showToast('Logged in successfully!', 'success');
        return data;
    } catch (error) {
        showToast(error.message || 'Login failed', 'error');
        throw error;
    }
}

function logout() {
    localStorage.removeItem('tuavec_token');
    localStorage.removeItem('tuavec_user');
    currentUser = null;
    updateAuthUI();
    showToast('Logged out successfully', 'success');
}

async function getCurrentUser() {
    try {
        const token = localStorage.getItem('tuavec_token');
        if (!token) return null;
        
        const data = await apiRequest('/auth/me');
        currentUser = data;
        return data;
    } catch (error) {
        console.error('Failed to get current user:', error);
        // Token might be invalid, clear it
        logout();
        return null;
    }
}

// ========== ORDER API ==========

async function placeOrder(orderData) {
    try {
        const data = await apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData),
            skipAuth: true // Allow guest checkout
        });
        
        // Clear cart after successful order
        cart = [];
        saveData();
        updateCartUI();
        
        showToast(`Order placed successfully! Order #${data.orderNumber}`, 'success');
        return data;
    } catch (error) {
        showToast(error.message || 'Failed to place order', 'error');
        throw error;
    }
}

async function getUserOrders() {
    try {
        const orders = await apiRequest('/orders');
        return orders;
    } catch (error) {
        console.error('Failed to fetch orders:', error);
        showToast('Failed to load orders', 'error');
        return [];
    }
}

async function trackOrder(orderNumber) {
    try {
        const order = await apiRequest(`/orders/track/${orderNumber}`, {
            skipAuth: true
        });
        return order;
    } catch (error) {
        showToast('Order not found', 'error');
        return null;
    }
}

// ========== UI UPDATE FUNCTIONS ==========

function updateAuthUI() {
    const authButton = document.getElementById('authButton');
    const userSection = document.getElementById('userSection');
    
    if (currentUser) {
        // User is logged in
        if (authButton) authButton.style.display = 'none';
        if (userSection) {
            userSection.style.display = 'flex';
            const userName = userSection.querySelector('.user-name');
            if (userName) userName.textContent = currentUser.name;
        }
    } else {
        // User is not logged in
        if (authButton) authButton.style.display = 'flex';
        if (userSection) userSection.style.display = 'none';
    }
}

// ========== ENHANCED CHECKOUT WITH API ==========

async function proceedToCheckout() {
    if (cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }
    
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('checkoutModal').classList.add('active');
    
    // Pre-fill user data if logged in
    if (currentUser) {
        const userEmail = document.getElementById('customerEmail');
        const userName = document.getElementById('customerName');
        
        if (userEmail) userEmail.value = currentUser.email;
        if (userName) userName.value = currentUser.name;
    }
    
    updateCheckoutSummary();
}

async function submitOrder() {
    if (!validateCheckoutForm()) {
        showToast('Please fill all required fields correctly', 'error');
        return;
    }
    
    // Disable submit button to prevent double submission
    const submitBtn = event.target;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    try {
        const orderData = {
            customer: {
                name: document.getElementById('customerName').value,
                email: document.getElementById('customerEmail').value,
                phone: document.getElementById('customerPhone').value,
                region: document.getElementById('customerRegion').value,
                address: document.getElementById('customerAddress').value
            },
            items: cart.map(item => ({
                productId: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity || 1
            })),
            subtotal: cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0),
            shipping: calculateShipping(),
            total: cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) + calculateShipping(),
            paymentMethod: document.getElementById('paymentMethod').value
        };
        
        const result = await placeOrder(orderData);
        
        // Show success message
        document.getElementById('checkoutModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        
        showToast(`Order placed successfully! Order #${result.orderNumber}`, 'success');
        
        // Optional: Show order confirmation modal with order number
        setTimeout(() => {
            alert(`Thank you for your order!\n\nOrder Number: ${result.orderNumber}\n\nYou will receive a confirmation email shortly.`);
        }, 500);
        
    } catch (error) {
        showToast('Failed to place order. Please try again.', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
    }
}

function calculateShipping() {
    const region = document.getElementById('customerRegion')?.value;
    const shippingRates = {
        'Dhaka': 60,
        'Chittagong': 100,
        'Sylhet': 120,
        'Rajshahi': 120,
        'Khulna': 120,
        'Barisal': 130,
        'Rangpur': 130,
        'Mymensingh': 100
    };
    
    const baseShipping = shippingRates[region] || 0;
    const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const additionalFee = Math.max(0, itemCount - 3) * 20;
    
    return baseShipping + additionalFee;
}

// ========== ENHANCED ORDER TRACKING ==========

async function trackOrderByNumber() {
    const orderNumber = document.getElementById('trackingNumber').value.trim();
    
    if (!orderNumber) {
        showToast('Please enter an order number', 'error');
        return;
    }
    
    const resultDiv = document.getElementById('trackingResult');
    resultDiv.innerHTML = '<p style="text-align:center;">Searching...</p>';
    
    try {
        const order = await trackOrder(orderNumber);
        
        if (order) {
            resultDiv.innerHTML = `
                <div class="tracking-success">
                    <h3>Order #${order.orderNumber}</h3>
                    <div class="order-status">
                        <div class="status-badge status-${order.status.toLowerCase()}">${order.status}</div>
                    </div>
                    <div class="order-details">
                        <p><strong>Customer:</strong> ${order.customer.name}</p>
                        <p><strong>Region:</strong> ${order.customer.region}</p>
                        <p><strong>Total:</strong> ৳${order.total.toLocaleString()}</p>
                        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div class="status-timeline">
                        <div class="timeline-step ${order.status === 'Pending' ? 'active' : 'completed'}">
                            <div class="step-icon">📦</div>
                            <div class="step-text">Order Placed</div>
                        </div>
                        <div class="timeline-step ${order.status === 'Processing' ? 'active' : order.status === 'Shipped' || order.status === 'Delivered' ? 'completed' : ''}">
                            <div class="step-icon">⚙️</div>
                            <div class="step-text">Processing</div>
                        </div>
                        <div class="timeline-step ${order.status === 'Shipped' ? 'active' : order.status === 'Delivered' ? 'completed' : ''}">
                            <div class="step-icon">🚚</div>
                            <div class="step-text">Shipped</div>
                        </div>
                        <div class="timeline-step ${order.status === 'Delivered' ? 'active completed' : ''}">
                            <div class="step-icon">✅</div>
                            <div class="step-text">Delivered</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = '<p class="error">Order not found. Please check the order number.</p>';
        }
    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Order not found. Please check the order number.</p>';
    }
}

// ========== INITIALIZATION ==========

// Initialize on page load
let currentUser = null;

async function initializeApp() {
    // Load saved theme
    applyTheme();
    
    // Load saved cart and wishlist
    loadData();
    
    // Try to restore user session
    const savedUser = localStorage.getItem('tuavec_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Verify token is still valid
            await getCurrentUser();
        } catch (error) {
            console.log('Session expired, please login again');
        }
    }
    
    updateAuthUI();
    
    // Fetch products from API
    await fetchProducts();
    
    console.log('✅ Tu Avec app initialized');
}

// Run initialization when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
