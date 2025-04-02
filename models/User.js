const { Client } = require('pg');

/**
 * @swagger
 * /db/create-user-table:
 *   post:
 *     summary: Create the User Table.
 *     description: Creates the users table in the database if it does not already exist.
 *     tags: [Database]
 *     responses:
 *       200:
 *         description: User table created or already exists.
 */
const createUserTable = async () => {
  const client = new Client({
    connectionString: process.env.DB_URI,
  });
  await client.connect();

  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      forename VARCHAR(100) NOT NULL,
      family_name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await client.query(query);
  console.log('User table created or already exists');
  await client.end();
};

createUserTable();
