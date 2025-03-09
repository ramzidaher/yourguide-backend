const { Client } = require('pg');
require('dotenv').config();  // To load the environment variables from .env file

// Create a new client instance to connect to PostgreSQL
const client = new Client({
  connectionString: process.env.DB_URI, // DB connection string from .env
});

// Connect to the PostgreSQL database
client.connect()
  .then(() => {
    console.log('Connected to the PostgreSQL database successfully!');
    client.end(); // Close the connection after a successful test
  })
  .catch(err => {
    console.error('Error connecting to the database:', err.stack);
  });
