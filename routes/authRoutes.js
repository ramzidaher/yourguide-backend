const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({ connectionString: process.env.DB_URI });

// Register Route
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

// Login Route
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

// GET Route for fetching user details by username
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

// GET Route for fetching all users
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

// DELETE Route for deleting all users
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

// DELETE Route for deleting a user by username
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
