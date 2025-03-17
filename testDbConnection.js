const { Client } = require('pg');
require('dotenv').config(); // Load environment variables

// Debugging: Log environment variables
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "******" : "MISSING");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);

const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

client.connect()
  .then(() => {
    console.log('✅ Connected to the PostgreSQL database successfully!');
    client.end();
  })
  .catch(err => {
    console.error('❌ Error connecting to the database:', err.stack);
  });
