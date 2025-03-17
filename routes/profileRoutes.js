const express = require('express');
const { Client } = require('pg');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
    const userId = req.userId;
    try {
        const client = new Client({ connectionString: process.env.DB_URI });
        await client.connect();
        // Retrieve user details
        const userQuery = 'SELECT id, forename, family_name, username FROM users WHERE id = $1';
        const userResult = await client.query(userQuery, [userId]);
        if (userResult.rows.length === 0) {
            await client.end();
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userResult.rows[0];
        // Retrieve questions with the user's answers (if any)
        const questionsQuery = `
      SELECT q.id AS question_id, q.question_text, ua.answer
      FROM questions q
      LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.user_id = $1
      ORDER BY q.id ASC
    `;
        const questionsResult = await client.query(questionsQuery, [userId]);
        await client.end();
        const questions = questionsResult.rows.map(row => ({
            id: row.question_id,
            question: row.question_text,
            answer: row.answer ? JSON.parse(row.answer) : null
        }));
        res.json({ user, questions });
    } catch (error) {
        console.error('Error fetching profile data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
