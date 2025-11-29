To implement the `POST /api/v1/login` endpoint with user authentication and JWT generation, we'll use a Node.js Express application.

**Assumptions for this implementation:**
1.  You have Node.js installed.
2.  You will install `express`, `bcrypt`, and `jsonwebtoken`.
3.  A user data store (e.g., a database) is available. For this example, we'll use a simple in-memory array to simulate user data. In a real application, you'd integrate with a database like MongoDB (via Mongoose), PostgreSQL (via Sequelize/Knex), etc.
4.  User passwords are stored as bcrypt hashes in the database.
5.  JWT secret and expiry time are configured (ideally from environment variables).

---

**Step 1: Project Setup (if you haven't already)**

Create a new directory for your project and initialize it:

mkdir user-auth-api
cd user-auth-api
npm init -y

Install necessary packages:

npm install express bcrypt jsonwebtoken dotenv

Create a `.env` file in the root of your project to store environment variables:

JWT_SECRET=YOUR_SUPER_STRONG_SECRET_KEY_HERE_REPLACE_ME_NOW
TOKEN_EXPIRY=1h
*Note: Replace `YOUR_SUPER_STRONG_SECRET_KEY_HERE_REPLACE_ME_NOW` with a long, random, and secure string. You can generate one using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.*

---

**Step 2: Create the `app.js` (main application file)**

This file will set up your Express server and integrate the login route.

// app.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth'); // Our login route

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json()); // To parse JSON request bodies

// Routes
app.use('/api/v1', authRoutes);

// Simple root route for testing if server is up
app.get('/', (req, res) => {
  res.send('Auth API is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Test login: POST /api/v1/login with { "username": "testuser", "password": "password123" }');
});


---

**Step 3: Create the `routes/auth.js` (authentication routes file)**

This file will contain the logic for your login endpoint.

// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// --- Configuration from environment variables ---
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '1h'; // Default to 1 hour if not specified

// Basic validation for JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in your .env file.');
  process.exit(1);
}

// --- Dummy User Database (for demonstration) ---
// In a real application, this would be a database model (e.g., Mongoose, Sequelize)
// For demonstration, we'll hash a sample password on startup.
const users = [];

async function initializeUsers() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10); // Hash 'password123' with salt rounds of 10
    users.push({
      id: 101,
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword, // Store the hashed password
    });
    console.log('Dummy user "testuser" added to in-memory store.');
    // console.log('Hashed password for testuser:', hashedPassword); // For debugging
  } catch (error) {
    console.error('Error initializing dummy user:', error);
  }
}
initializeUsers(); // Call to create our dummy user

// Helper function to find a user by username or email in our dummy store
async function findUserByUsernameOrEmail(identifier) {
  // Simulate async database call
  return new Promise(resolve => {
    setTimeout(() => {
      const user = users.find(
        u => u.username === identifier || u.email === identifier
      );
      resolve(user);
    }, 100); // Simulate a small delay
  });
}

// --- POST /api/v1/login Endpoint ---
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 1. Basic input validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // 2. Find the user in the database
    const user = await findUserByUsernameOrEmail(username);

    if (!user) {
      // Return a generic error message for security (don't reveal if user exists or not)
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 3. Verify the provided password against the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 4. If credentials are valid, generate a JSON Web Token (JWT)
    const payload = {
      userId: user.id,
      username: user.username,
      // You can add other non-sensitive user info here if needed
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    // 5. Return the generated JWT to the client
    res.status(200).json({
      message: 'Login successful',
      token: token,
      expiresIn: TOKEN_EXPIRY // Optionally inform the client about expiry
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

module.exports = router;

---

**Step 4: Run the Application**

From your project root directory, run:

node app.js

You should see output similar to:
Dummy user "testuser" added to in-memory store.
Server running on port 3000
Test login: POST /api/v1/login with { "username": "testuser", "password": "password123" }

---

**Step 5: Test the Endpoint**

You can use a tool like cURL, Postman, or Insomnia to test the endpoint.

**Example cURL request for successful login:**

curl -X POST \
  http://localhost:3000/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

**Expected Successful Response (status 200 OK):**

{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMSwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCIOjE3MDExMjY0MDUsImV4cCI6MTcwMTEzMDAwNX0.EXAMPLE_JWT_TOKEN_HERE_djasdkasda",
  "expiresIn": "1h"
}
(Your `token` will be different.)

**Example cURL request for invalid password:**

curl -X POST \
  http://localhost:3000/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser",
    "password": "wrongpassword"
  }'

**Expected Invalid Credentials Response (status 401 Unauthorized):**

{
  "message": "Invalid credentials."
}

**Example cURL request for missing fields:**

curl -X POST \
  http://localhost:3000/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser"
  }'

**Expected Bad Request Response (status 400 Bad Request):**

{
  "message": "Username and password are required."
}