/**
 * This module defines a RESTful API endpoint to fetch a user's shopping cart.
 * It simulates database interactions for Products and Carts.
 */

// --- Mock Database / Data Models (Simulating actual database collections/tables) ---
// In a real application, these would be fetched from a database (e.g., MongoDB, PostgreSQL)
// using an ORM/ODM (e.g., Mongoose, Sequelize, Prisma).

const mockProductsDB = [
  {
    _id: 'prod101',
    name: 'Wireless Bluetooth Headphones',
    price: 79.99,
    imageUrl: 'https://example.com/images/headphones.jpg',
    stock: 50,
  },
  {
    _id: 'prod102',
    name: 'Ergonomic Office Chair',
    price: 249.00,
    imageUrl: 'https://example.com/images/chair.jpg',
    stock: 15,
  },
  {
    _id: 'prod103',
    name: '4K Ultra HD Monitor',
    price: 399.50,
    imageUrl: 'https://example.com/images/monitor.jpg',
    stock: 5,
  },
  {
    _id: 'prod104',
    name: 'Mechanical Gaming Keyboard',
    price: 120.00,
    imageUrl: 'https://example.com/images/keyboard.jpg',
    stock: 0, // Out of stock example
  },
];

const mockCartsDB = [
  {
    userId: 'user123', // This would typically be the authenticated user's ID
    items: [
      { productId: 'prod101', quantity: 2 },
      { productId: 'prod102', quantity: 1 },
      { productId: 'prod103', quantity: 1 },
    ],
  },
  {
    userId: 'user456',
    items: [
      { productId: 'prod101', quantity: 1 },
      { productId: 'prod104', quantity: 1 } // Item that's out of stock
    ]
  }
  // No cart for 'user789' to simulate an empty cart scenario
];

// --- Utility function to simulate fetching data from DB ---
const findProductById = (productId) => {
  return mockProductsDB.find(p => p._id === productId);
};

const findCartByUserId = (userId) => {
  return mockCartsDB.find(cart => cart.userId === userId);
};

/**
 * Controller function to fetch the active user's shopping cart.
 * This function would typically be used as an Express.js route handler:
 * `app.get('/api/cart', authenticateUser, getCart);`
 *
 * @param {object} req - The Express request object. Assumes `req.user.id` contains the active user's ID.
 * @param {object} res - The Express response object.
 */
async function getCart(req, res) {
  // In a real application, the user ID would come from an authentication middleware (e.g., req.user.id).
  // For this example, we'll simulate an active user ID.
  const activeUserId = 'user123'; // Example: req.user.id;

  try {
    const userCart = findCartByUserId(activeUserId);

    if (!userCart || userCart.items.length === 0) {
      return res.status(200).json({
        message: "Your cart is currently empty.",
        cartItems: [],
        grandTotal: 0.00,
      });
    }

    let grandTotal = 0.00;
    const processedCartItems = [];

    for (const cartItem of userCart.items) {
      const product = findProductById(cartItem.productId);

      if (!product) {
        // Handle case where product might have been deleted or is invalid.
        // For robustness, we might log this or offer to remove it from the cart.
        console.warn(`Product with ID ${cartItem.productId} not found for user ${activeUserId}'s cart.`);
        continue; // Skip this item
      }

      // Calculate total price for the current item
      const itemTotalPrice = parseFloat((product.price * cartItem.quantity).toFixed(2));

      processedCartItems.push({
        productId: product._id,
        name: product.name,
        price: parseFloat(product.price.toFixed(2)),
        imageUrl: product.imageUrl,
        stockLevel: product.stock,
        quantity: cartItem.quantity,
        itemTotalPrice: itemTotalPrice, // Total price for this specific quantity of the item
      });

      grandTotal += itemTotalPrice;
    }

    // Ensure grand total is formatted correctly
    grandTotal = parseFloat(grandTotal.toFixed(2));

    return res.status(200).json({
      cartItems: processedCartItems,
      grandTotal: grandTotal,
    });

  } catch (error) {
    console.error(`Error fetching cart for user ${activeUserId}:`, error);
    // In a real application, different error types might be handled more granularly.
    return res.status(500).json({
      message: "An internal server error occurred while fetching your cart.",
      error: error.message,
    });
  }
}

// --- Example Usage (Conceptual, for testing the function logic) ---
// In a real Express.js application, you would set up your routes like this:
// const express = require('express');
// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware to simulate authentication and attach user info to req.user
// const authenticateUser = (req, res, next) => {
//   // In a real app, this would verify JWT, session, etc.
//   req.user = { id: 'user123' }; // Simulate logged-in user
//   next();
// };

// app.get('/api/cart', authenticateUser, getCart);

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// To demonstrate the output without a full Express server,
// we can simulate `req` and `res` objects and call the function directly.

/*
// Simulate a request for 'user123' (who has items)
const mockReqWithItems = { user: { id: 'user123' } };
const mockResWithItems = {
  statusCode: 200,
  jsonData: {},
  status: function(code) { this.statusCode = code; return this; },
  json: function(data) { this.jsonData = data; }
};

console.log("--- Test Case: User with items in cart (user123) ---");
getCart(mockReqWithItems, mockResWithItems).then(() => {
  console.log("Status:", mockResWithItems.statusCode);
  console.log("Response:", JSON.stringify(mockResWithItems.jsonData, null, 2));
});

// Simulate a request for 'user789' (who has an empty cart)
const mockReqEmptyCart = { user: { id: 'user789' } };
const mockResEmptyCart = {
  statusCode: 200,
  jsonData: {},
  status: function(code) { this.statusCode = code; return this; },
  json: function(data) { this.jsonData = data; }
};

console.log("\n--- Test Case: User with empty cart (user789) ---");
getCart(mockReqEmptyCart, mockResEmptyCart).then(() => {
  console.log("Status:", mockResEmptyCart.statusCode);
  console.log("Response:", JSON.stringify(mockResEmptyCart.jsonData, null, 2));
});

// Simulate a request for 'user456' (who has an out-of-stock item)
const mockReqOutOfStock = { user: { id: 'user456' } };
const mockResOutOfStock = {
  statusCode: 200,
  jsonData: {},
  status: function(code) { this.statusCode = code; return this; },
  json: function(data) { this.jsonData = data; }
};

console.log("\n--- Test Case: User with out-of-stock item (user456) ---");
getCart(mockReqOutOfStock, mockResOutOfStock).then(() => {
  console.log("Status:", mockResOutOfStock.statusCode);
  console.log("Response:", JSON.stringify(mockResOutOfStock.jsonData, null, 2));
});
*/

// Export the function for use in a larger application (e.g., in a routes file)
module.exports = getCart;