const express = require('express');
const { Client } = require('pg'); // For direct DB access in our custom route
const {
    addQuestion,
    addQuestionOptions,
    getAllQuestionsWithOptions,
    saveUserAnswers,
    deleteQuestion
} = require('../controllers/qaController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/qa/add-question - Add a new question
router.post('/add-question', authenticateToken, async (req, res) => {
    const { questionText } = req.body;
    if (!questionText) {
        return res.status(400).json({ message: 'Question text is required' });
    }
    try {
        const questionId = await addQuestion(questionText);
        res.json({ message: 'Question added successfully', questionId });
    } catch (error) {
        res.status(500).json({ message: 'Error adding question', error: error.message });
    }
});

// POST /api/qa/add-options - Add options for a question
router.post('/add-options', authenticateToken, async (req, res) => {
    const { questionId, options } = req.body;
    if (!questionId || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ message: 'Invalid input: Question ID and options are required' });
    }
    try {
        await addQuestionOptions(questionId, options);
        res.json({ message: 'Options added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding options', error: error.message });
    }
});

// GET /api/qa/questions - Retrieve all questions with options
router.get('/questions', authenticateToken, async (req, res) => {
    try {
        const questions = await getAllQuestionsWithOptions();
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching questions', error: error.message });
    }
});

// DELETE /api/qa/delete-question/:id - Delete a question and its options
router.delete('/delete-question/:id', authenticateToken, async (req, res) => {
    const questionId = req.params.id;
    try {
        const result = await deleteQuestion(questionId);
        if (!result.success) {
            return res.status(404).json({ message: result.message });
        }
        res.json({ message: result.message });
    } catch (error) {
        res.status(500).json({ message: "Error deleting question", error: error.message });
    }
});

// GET /api/qa/question/:id - Retrieve a single question with its options
router.get('/question/:id', authenticateToken, async (req, res) => {
    const questionId = req.params.id;
    try {
        const client = new Client({ connectionString: process.env.DB_URI });
        await client.connect();

        // Retrieve the question by ID
        const questionRes = await client.query(
            'SELECT id, question_text FROM questions WHERE id = $1',
            [questionId]
        );

        if (questionRes.rows.length === 0) {
            await client.end();
            return res.status(404).json({ message: 'Question not found' });
        }

        const question = questionRes.rows[0];

        // Retrieve the options for the question
        const optionsRes = await client.query(
            'SELECT id, option_text FROM answer_options WHERE question_id = $1',
            [questionId]
        );

        await client.end();

        // Format the response
        const responseObject = {
            id: question.id,
            question: question.question_text,
            options: optionsRes.rows.map(option => ({
                id: option.id,
                text: option.option_text
            }))
        };

        res.json(responseObject);
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ message: 'Error fetching question', error: error.message });
    }
});

// POST /api/qa/add-answer - Submit an answer for a specific question
router.post('/add-answer', authenticateToken, async (req, res) => {
    let { questionId, answer } = req.body;
    const { userId } = req;
    if (!questionId || answer === undefined) {
        return res.status(400).json({ message: 'Missing question ID or answer' });
    }
    // Ensure the answer is always an array
    if (!Array.isArray(answer)) {
        answer = [answer];
    }
    try {
        await saveUserAnswers(userId, [{ questionId, answer }]);
        res.json({ message: 'Answer submitted successfully' });
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({ message: 'Error submitting answer', error: error.message });
    }
});


// GET /api/qa/topic-question/:industryId - Retrieve topic question based on industry
// GET /api/qa/topic-question/:industryId - Retrieve topic question based on industry
router.get('/topic-question/:industryId', authenticateToken, async (req, res) => {
    const { industryId } = req.params;  // Get the industryId from the request parameters

    try {
        const client = new Client({ connectionString: process.env.DB_URI });
        await client.connect();

        // Query the industry_question_map table to find the topic question based on the selected industry
        const query = `
            SELECT q.id, q.question_text
            FROM industry_question_map iqm
            JOIN questions q ON iqm.question_id = q.id
            WHERE iqm.industry_option_id = $1
        `;

        const result = await client.query(query, [industryId]);

        if (result.rows.length === 0) {
            await client.end();
            return res.status(404).json({ message: 'No topic question found for this industry' });
        }

        const topicQuestion = result.rows[0];

        // Fetch options for this specific topic question (Q3)
        const optionsQuery = `
            SELECT id, option_text
            FROM answer_options
            WHERE question_id = $1
        `;
        const optionsRes = await client.query(optionsQuery, [topicQuestion.id]);

        await client.end();

        // Send the topic question and its options in the response
        res.json({
            id: topicQuestion.id,
            question: topicQuestion.question_text,
            options: optionsRes.rows.map(option => ({
                id: option.id,
                text: option.option_text
            }))
        });
    } catch (error) {
        console.error('Error fetching topic question:', error);
        res.status(500).json({ message: 'Error fetching topic question', error: error.message });
    }
});






module.exports = router;
