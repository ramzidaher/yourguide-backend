const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({ connectionString: process.env.DB_URI });

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user.
 *     description: >
 *       Registers a new user by accepting forename, family name, username, and password.
 *       The function calls `registerUser` which:
 *         - Hashes the password using bcrypt,
 *         - Inserts the new user into the database,
 *         - Handles duplicate username errors.
 *       This endpoint is the entry point for creating user accounts, ensuring the user record is saved securely.
 *     tags: [Auth]
 *     requestBody:
 *       description: User registration data.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - forename
 *               - family_name
 *               - username
 *               - password
 *             properties:
 *               forename:
 *                 type: string
 *               family_name:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully. The response confirms the registration and provides a success message.
 *       400:
 *         description: Missing required fields.
 *       500:
 *         description: Registration failed due to a database error or duplicate username.
 */
router.post('/register', async (req, res) => {
  const { registerUser } = require('../controllers/authController');
  const { forename, family_name, username, password } = req.body;
  if (!forename || !family_name || !username || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const result = await registerUser(forename, family_name, username, password);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user.
 *     description: >
 *       Authenticates a user by comparing the provided credentials against the stored hashed password.
 *       The function `loginUser` is invoked, which:
 *         - Retrieves the user record based on username,
 *         - Compares the provided password with the stored hash using bcrypt,
 *         - If successful, generates a JWT token (with a 1-hour expiry) and returns it along with user data (password excluded).
 *       This endpoint is crucial for generating the token that is required for accessing protected endpoints.
 *     tags: [Auth]
 *     requestBody:
 *       description: Login credentials including username and password.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully. Returns a JWT token and user details.
 *       500:
 *         description: Login failed due to incorrect credentials or server error.
 */
router.post('/login', async (req, res) => {
  const { loginUser } = require('../controllers/authController');
  const { username, password } = req.body;
  try {
    const result = await loginUser(username, password);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/user:
 *   get:
 *     summary: Get user details by username.
 *     description: >
 *       Retrieves specific user details based on the provided username query parameter.
 *       The endpoint executes a database query to fetch fields such as forename, family name, and username.
 *       It provides a minimal yet essential overview of the user's identity.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Username of the user.
 *     responses:
 *       200:
 *         description: User details retrieved successfully.
 *       400:
 *         description: Username query parameter is missing.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal Server Error.
 */
router.get('/user', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username query parameter is required.'
    });
  }
  try {
    const query = 'SELECT forename, family_name, username FROM users WHERE username = $1';
    const { rows } = await pool.query(query, [username]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }
    const user = rows[0];
    res.json({
      success: true,
      user: {
        username: user.username,
        email: user.email || null,
        forename: user.forename,
        familyName: user.family_name
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users.
 *     description: >
 *       Fetches a list of all users available in the system.
 *       This endpoint is useful for administrative purposes where an overview of all registered users is required.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Returns an array of user objects.
 *       500:
 *         description: Internal Server Error.
 */
router.get('/users', async (req, res) => {
  try {
    const query = 'SELECT forename, family_name, username FROM users';
    const { rows } = await pool.query(query);
    const users = rows.map(user => ({
      username: user.username,
      email: user.email || null,
      forename: user.forename,
      familyName: user.family_name
    }));
    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

/**
 * @swagger
 * /api/auth/users:
 *   delete:
 *     summary: Delete all users.
 *     description: >
 *       Deletes every user record along with related dependent records (such as user answers and summaries).
 *       This endpoint is typically used for testing or administrative resets.
 *       The deletion occurs within a transaction to ensure database integrity.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: All users and related records were deleted successfully.
 *       500:
 *         description: Internal Server Error.
 */
router.delete('/users', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_answers');
    await client.query('DELETE FROM summaries');
    const query = 'DELETE FROM users RETURNING *';
    const { rows } = await client.query(query);
    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'All users and related records deleted successfully.',
      deletedUsers: rows
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting all users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/auth/user:
 *   delete:
 *     summary: Delete a user by username.
 *     description: >
 *       Deletes a specific user based on the username query parameter.
 *       This endpoint executes a delete query and returns the details of the deleted user.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Username of the user to be deleted.
 *     responses:
 *       200:
 *         description: User deleted successfully with confirmation details.
 *       400:
 *         description: Username query parameter is missing.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal Server Error.
 */
router.delete('/user', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username query parameter is required.'
    });
  }
  try {
    const query = 'DELETE FROM users WHERE username = $1 RETURNING *';
    const { rows } = await pool.query(query, [username]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({
      success: true,
      message: 'User deleted successfully.',
      user: {
        username: rows[0].username,
        forename: rows[0].forename,
        familyName: rows[0].family_name
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
