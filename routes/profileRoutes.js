const express = require('express');
const { Client } = require('pg');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();
/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile data.
 *     description: Retrieves the user's profile details, answered questions, and saved courses.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     forename:
 *                       type: string
 *                     family_name:
 *                       type: string
 *                     username:
 *                       type: string
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       question:
 *                         type: string
 *                       answer:
 *                         type: string
 *                         nullable: true
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       link:
 *                         type: string
 *                       image:
 *                         type: string
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal Server Error.
 */
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
        const questions = questionsResult.rows.map(row => ({
            id: row.question_id,
            question: row.question_text,
            answer: row.answer ? JSON.parse(row.answer) : null
        }));

        // Retrieve saved courses for the user
        const coursesQuery = `
          SELECT course_title, provider, link, image_url 
          FROM user_courses 
          WHERE user_id = $1
          ORDER BY created_at DESC
        `;
        const coursesResult = await client.query(coursesQuery, [userId]);
        await client.end();

        const courses = coursesResult.rows.map(row => ({
            title: row.course_title,
            provider: row.provider,
            link: row.link,
            image: row.image_url
        }));

        // Send full response with user details, questions, and courses
        res.json({ user, questions, courses });
    } catch (error) {
        console.error('Error fetching profile data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
