const express = require('express');
const session = require('express-session'); // For user-specific cart persistence
const app = express();
const PORT = 3000;

// --- Mock Database (Simulating product data) ---
// In a real application, this would be a database call.
const mockProducts = [
    { id: 'prod1', name: 'Laptop', price: 1200.00 },
    { id: 'prod2', name: 'Mouse', price: 25.00 },
    { id: 'prod3', name: 'Keyboard', price: 75.00 },
    { id: 'prod4', name: 'Monitor', price: 300.00 }
];

// Helper to find a product by ID (simulating a database lookup)
function findProductById(productId) {
    return mockProducts.find(p => p.id === productId);
}

// --- Middleware ---

// Use Express's built-in JSON body parser (modern alternative to body-parser)
app.use(express.json());

// Configure express-session for user-specific cart management
// WARNING: The default MemoryStore is NOT suitable for production environments
// as it leaks memory and doesn't scale. For production, use a dedicated
// session store like 'connect-mongo' or 'connect-redis'.
app.use(session({
    secret: 'supersecretkey123!@#', // Replace with a strong, random secret key from environment variables in production
    resave: false, // Don't save session if unmodified
    saveUninitialized: true, // Save new sessions even if not modified
    cookie: { secure: false } // Set to true if using HTTPS in production
}));

// --- Routes ---

/**
 * GET /api/cart
 * Optional endpoint to view the current user's cart state.
 * Useful for debugging and verification.
 */
app.get('/api/cart', (req, res) => {
    // Retrieve the cart from the current user's session, or an empty array if not initialized
    const cart = req.session.cart || [];
    res.status(200).json({ cart });
});


/**
 * POST /api/cart/items
 * Adds a product to the user's shopping cart or increments its quantity if it already exists.
 *
 * Request Body:
 * {
 *   "productId": "string",
 *   "quantity": number
 * }
 */
app.post('/api/cart/items', (req, res) => {
    const { productId, quantity } = req.body;

    // --- Input Validation ---
    if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ message: 'productId is required and must be a string.' });
    }
    if (!quantity || typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
        return res.status(400).json({ message: 'quantity is required, must be a positive integer.' });
    }

    // --- Product Existence Validation ---
    const product = findProductById(productId);
    if (!product) {
        return res.status(404).json({ message: `Product with ID '${productId}' not found.` });
    }

    // Initialize the user's cart in the session if it doesn't exist
    // This ensures each user has their own distinct cart.
    if (!req.session.cart) {
        req.session.cart = [];
    }

    let cartItem = req.session.cart.find(item => item.productId === productId);

    if (cartItem) {
        // If product already in cart, increment quantity
        cartItem.quantity += quantity;
        res.status(200).json({
            message: `Quantity for '${product.name}' updated in cart.`,
            item: cartItem
        });
    } else {
        // If product not in cart, add it as a new item
        cartItem = {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity
        };
        req.session.cart.push(cartItem);
        res.status(201).json({ // 201 Created for adding a new resource (cart item)
            message: `'${product.name}' added to cart.`,
            item: cartItem
        });
    }

    // In a real application, if `req.session.cart` was backed by an async store (e.g., database),
    // you would typically await `req.session.save()` here or configure the session middleware
    // to automatically save changes. For simple MemoryStore, changes are immediately reflected.
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`
    API Endpoints:
    - GET  /api/cart       (Optional: View current user's cart state)
    - POST /api/cart/items (Add/update product in cart)

    To Test:
    1. Start the server: node your_file_name.js
    2. Use a tool like cURL or Postman.

    Example POST request to add a product:
    curl -X POST -H "Content-Type: application/json" -d '{ "productId": "prod1", "quantity": 2 }' http://localhost:3000/api/cart/items

    Example POST request to increment quantity of an existing product:
    curl -X POST -H "Content-Type: application/json" -d '{ "productId": "prod1", "quantity": 1 }' http://localhost:3000/api/cart/items

    Example GET request to see the cart:
    curl -v --cookie-jar cookies.txt http://localhost:3000/api/cart
    (Note: You need to send the cookies back in subsequent requests to maintain the session.
    cURL with --cookie-jar and --cookie options handles this.)

    Example with Postman/Insomnia:
    - Make a POST request to http://localhost:3000/api/cart/items with JSON body.
    - Then make a GET request to http://localhost:3000/api/cart.
      The cart state will be maintained across requests for the same client due to session cookies.
    `);
});