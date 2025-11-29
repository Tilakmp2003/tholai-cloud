const jwt = require('jsonwebtoken');

/**
 * Middleware function to authenticate JWT tokens for protected routes.
 *
 * This middleware expects a JWT in the 'Authorization' header in the format: 'Bearer <token>'.
 * It verifies the token's signature and expiration using a secret key.
 * If valid, it decodes the token's payload and attaches it to `req.user`.
 * If invalid, missing, or expired, it terminates the request with a 401 Unauthorized status.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The Express next middleware function.
 */
function authenticateJWT(req, res, next) {
    // In a real application, the secret key should be loaded from environment variables
    // (e.g., process.env.JWT_SECRET) and NOT hardcoded.
    const secretKey = process.env.JWT_SECRET || 'your_super_secret_jwt_key_please_change_this_in_production';

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization token missing' });
    }

    const tokenParts = authHeader.split(' ');

    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({ message: 'Invalid Authorization header format. Expected: Bearer <token>' });
    }

    const token = tokenParts[1];

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            // Handle specific JWT errors for more informative messages
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Unauthorized: Token has expired' });
            }
            if (err.name === 'JsonWebTokenError') {
                // This covers invalid signature, malformed token, etc.
                return res.status(401).json({ message: 'Unauthorized: Invalid token' });
            }
            // General catch-all for other unexpected errors during verification
            return res.status(401).json({ message: 'Unauthorized: Token verification failed' });
        }

        // Token is valid. Attach the decoded user payload to the request object.
        req.user = user;
        next(); // Proceed to the next middleware or route handler
    });
}

module.exports = authenticateJWT;