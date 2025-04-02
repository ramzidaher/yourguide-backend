const jwt = require('jsonwebtoken');


/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @function authenticateToken
 * @description Middleware to authenticate JWT tokens.
 * It checks the Authorization header for a bearer token and verifies it.
 * If valid, attaches the userId to the request; otherwise, responds with an error.
 */

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });

        console.log('Decoded Token:', decoded);  // Logs: { userId: 7, ... }
        req.userId = decoded.userId; // Attach userId to the request object
        next();
    });
};

module.exports = authenticateToken;
