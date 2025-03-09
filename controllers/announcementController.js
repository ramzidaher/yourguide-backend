const { Client } = require('pg');

// Get all announcements
const getAnnouncements = async () => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    const query = 'SELECT * FROM announcements ORDER BY created_at DESC';
    const res = await client.query(query);
    await client.end();
    return res.rows;
};

// Create a new announcement
const createAnnouncement = async (title, content) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    const query = 'INSERT INTO announcements(title, content) VALUES($1, $2)';
    await client.query(query, [title, content]);

    console.log('Announcement created');
    await client.end();
};

// Export both functions
module.exports = { getAnnouncements, createAnnouncement };
