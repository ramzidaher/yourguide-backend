const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

// Register User
// Register User
const registerUser = async (forename, family_name, username, password) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = 'INSERT INTO users(forename, family_name, username, password) VALUES($1, $2, $3, $4)';
    await client.query(insertQuery, [forename, family_name, username, hashedPassword]);

    await client.end();
    return { success: true, message: 'User registered successfully' };
};

// Login User
const loginUser = async (username, password) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    const query = 'SELECT * FROM users WHERE username = $1';
    const res = await client.query(query, [username]);

    if (res.rows.length === 0) {
        await client.end();
        return { success: false, message: 'User not found' };
    }

    const user = res.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        await client.end();
        return { success: false, message: 'Invalid credentials' };
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await client.end();
    return { success: true, token };
};

module.exports = { registerUser, loginUser };
