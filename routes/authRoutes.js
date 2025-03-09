const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  const { forename, family_name, username, password } = req.body;  // Extract values from body
  if (!password || !username || !forename || !family_name) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const result = await registerUser(forename, family_name, username, password);
  res.json(result);
});

// Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await loginUser(username, password);
  res.json(result);
});

module.exports = router;
