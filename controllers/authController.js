const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

/**
 * @swagger
 * /db/register-user:
 *   post:
 *     summary: Internal function to register a user.
 *     description: >
 *       This function is used internally to register a new user.
 *       It performs the following steps:
 *         - Hashes the provided password using bcrypt,
 *         - Inserts the user details into the 'users' table,
 *         - Catches errors such as duplicate entries.
 *       Though not exposed as an API endpoint, this function's logic is critical to the registration process.
 *     tags: [Auth - Controller, Internal]
 *     requestBody:
 *       description: JSON payload containing user details.
 *       required: true
 *     responses:
 *       200:
 *         description: User registered successfully.
 */
const registerUser = async (forename, family_name, username, password) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertQuery =
            'INSERT INTO users(forename, family_name, username, password) VALUES($1, $2, $3, $4)';
        await client.query(insertQuery, [forename, family_name, username, hashedPassword]);
        console.log('User registered successfully');
        return { success: true, message: 'User registered successfully' };
    } catch (error) {
        if (error.code === '23505') {
            console.log('User already exists');
            return { success: false, message: 'User already exists' };
        }
        console.error('Registration error:', error);
        return { success: false, message: 'Registration failed' };
    } finally {
        await client.end();
    }
};

/**
 * @swagger
 * /db/login-user:
 *   post:
 *     summary: Internal function to authenticate a user.
 *     description: >
 *       This function verifies user credentials by:
 *         - Retrieving user data from the database,
 *         - Comparing the provided password with the stored hash,
 *         - Generating a JWT token upon successful authentication.
 *       It ensures that the user's password remains secure and is not exposed in the response.
 *     tags: [Auth - Controller, Internal]
 *     requestBody:
 *       description: JSON payload containing username and password.
 *       required: true
 *     responses:
 *       200:
 *         description: User authenticated successfully, returns a token.
 */
const loginUser = async (username, password) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    try {
        const query = 'SELECT * FROM users WHERE username = $1';
        const res = await client.query(query, [username]);
        if (res.rows.length === 0) {
            console.log('User not found');
            return { success: false, message: 'User not found' };
        }
        const user = res.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Invalid credentials');
            return { success: false, message: 'Invalid credentials' };
        }
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('User logged in successfully');
        // Remove password field before returning user data
        const { password: _ignored, ...userWithoutPassword } = user;
        return { success: true, token, user: userWithoutPassword };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Login failed' };
    } finally {
        await client.end();
    }
};

module.exports = { registerUser, loginUser };
