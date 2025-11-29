const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// --- Mock Data Store (In-memory for demonstration) ---
// In a real application, this would interact with a database.
// Structure: { userId: [{ productId: string, quantity: number }] }
const userCarts = {
  'user123': [ // Example cart for an active user
    { productId: 'prod001', quantity: 2 },
    { productId: 'prod002', quantity: 1 },
    { productId: 'prod003', quantity: 5 }
  ],
  'user456': [
    { productId: 'prod010', quantity: 3 }
  ]
};

// --- Mock Authentication Middleware (for demonstration) ---
// In a real application, this would extract the user ID from a JWT or session.
app.use((req, res, next) => {
  // For this example, we'll hardcode 'user123' as the active user.
  // In a real scenario, this would come from an authentication token.
  req.userId = 'user123';
  next();
});

// --- RESTful API Endpoint: DELETE /api/cart/items/{productId} ---
app.delete('/api/cart/items/:productId', (req, res) => {
  const { productId } = req.params;
  const activeUserId = req.userId; // Get the active user's ID from the mock auth

  console.log(`Attempting to remove product ${productId} from cart for user ${activeUserId}`);

  // 1. Validate productId
  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    console.warn(`Invalid productId received: ${productId}`);
    return res.status(400).json({ message: 'Invalid productId provided. Product ID cannot be empty.' });
  }

  // Retrieve the active user's cart
  let userCart = userCarts[activeUserId];

  // 2. Confirm the cart exists for the user
  if (!userCart) {
    console.log(`Cart not found for user ${activeUserId}.`);
    return res.status(404).json({ message: `Cart not found for user ${activeUserId}.` });
  }

  // 3. Confirm the item exists in the cart before removal
  const initialCartLength = userCart.length;
  const updatedCart = userCart.filter(item => item.productId !== productId);

  if (updatedCart.length === initialCartLength) {
    // If the length didn't change, the product was not found in the cart
    console.log(`Product with ID ${productId} not found in cart for user ${activeUserId}.`);
    return res.status(404).json({ message: `Product with ID '${productId}' not found in the active user's cart.` });
  }

  // 4. Persist the updated cart state
  userCarts[activeUserId] = updatedCart;
  console.log(`Product ${productId} successfully removed from cart for user ${activeUserId}.`);
  console.log('Updated Cart:', userCarts[activeUserId]);

  // 5. Return appropriate success status (204 No Content)
  // No content is sent back with 204.
  res.status(204).send();
});

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Cart API running on http://localhost:${PORT}`);
  console.log('Test with:');
  console.log(`  DELETE http://localhost:${PORT}/api/cart/items/prod001`);
  console.log(`  DELETE http://localhost:${PORT}/api/cart/items/prod005 (for not found test)`);
  console.log(`  DELETE http://localhost:${PORT}/api/cart/items/  (for invalid productId test)`);
});