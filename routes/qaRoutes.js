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

/**
 * @swagger
 * /api/qa/add-question:
 *   post:
 *     summary: Add a new question.
 *     description: >
 *       This endpoint allows an authenticated user to add a new question to the system.
 *       Internally, the function `addQuestion`:
 *         - Connects to the database,
 *         - Executes an INSERT query into the questions table,
 *         - Returns the newly created question's ID.
 *       It is a crucial function that lays the foundation for further question options and user answers.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: JSON payload containing the questionText.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionText
 *             properties:
 *               questionText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question added successfully with the new question ID.
 *       400:
 *         description: Question text is required.
 *       500:
 *         description: Error adding question.
 */
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

/**
 * @swagger
 * /api/qa/add-options:
 *   post:
 *     summary: Add options for a question.
 *     description: >
 *       This endpoint allows an authenticated user to add answer options for a previously added question.
 *       The function `addQuestionOptions` is called, which:
 *         - Iterates through the provided options array,
 *         - Inserts each option into the answer_options table linked by questionId.
 *       This detailed process ensures each question can have multiple possible answers.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: JSON payload containing the questionId and an array of options.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *               - options
 *             properties:
 *               questionId:
 *                 type: number
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Options added successfully.
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Error adding options.
 */
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

/**
 * @swagger
 * /api/qa/questions:
 *   get:
 *     summary: Retrieve all questions with options.
 *     description: >
 *       Fetches all questions from the database along with their corresponding options.
 *       Internally, the function `getAllQuestionsWithOptions`:
 *         - Connects to the database,
 *         - Retrieves all question records,
 *         - For each question, performs an additional query to gather associated answer options,
 *         - Combines the data into a structured response.
 *       This endpoint is critical for displaying a full list of Q&A for the application.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of questions with their options.
 *       500:
 *         description: Error fetching questions.
 */
router.get('/questions', authenticateToken, async (req, res) => {
    try {
        const questions = await getAllQuestionsWithOptions();
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching questions', error: error.message });
    }
});

/**
 * @swagger
 * /api/qa/delete-question/{id}:
 *   delete:
 *     summary: Delete a question.
 *     description: >
 *       Deletes a question based on its ID. The internal function `deleteQuestion`:
 *         - Connects to the database,
 *         - Executes a DELETE query,
 *         - Checks if the question exists and resets the sequence if no questions remain.
 *       This endpoint is useful for removing outdated or erroneous questions from the system.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: number
 *         required: true
 *         description: ID of the question to delete.
 *     responses:
 *       200:
 *         description: Question deleted successfully.
 *       404:
 *         description: Question not found.
 *       500:
 *         description: Error deleting question.
 */
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

/**
 * @swagger
 * /api/qa/question/{id}:
 *   get:
 *     summary: Retrieve a single question.
 *     description: >
 *       Retrieves a specific question and its associated answer options by question ID.
 *       This endpoint uses a direct database query and demonstrates how to:
 *         - Connect to the database,
 *         - Fetch the question record,
 *         - Fetch related options from the answer_options table,
 *         - Format and return the consolidated response.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: number
 *         required: true
 *         description: The ID of the question to retrieve.
 *     responses:
 *       200:
 *         description: The question and its options.
 *       404:
 *         description: Question not found.
 *       500:
 *         description: Error fetching question.
 */
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

/**
 * @swagger
 * /api/qa/add-answer:
 *   post:
 *     summary: Submit an answer.
 *     description: >
 *       Submits an answer for a specific question.
 *       The process involves:
 *         - Validating the question ID and answer data,
 *         - Converting the answer to an array if it isn’t already,
 *         - Calling `saveUserAnswers` to update or insert the user's answer in the database.
 *       This endpoint is key for capturing user responses to questions.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: JSON payload with the question ID and answer(s).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *               - answer
 *             properties:
 *               questionId:
 *                 type: number
 *               answer:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array containing one or more answers.
 *     responses:
 *       200:
 *         description: Answer submitted successfully.
 *       400:
 *         description: Missing question ID or answer.
 *       500:
 *         description: Error submitting answer.
 */
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


/**
 * @swagger
 * /api/qa/topic-question/{industryId}:
 *   get:
 *     summary: Retrieve topic question based on industry.
 *     description: >
 *       This endpoint retrieves a topic-specific question based on the provided industry ID.
 *       Internally, it uses a switch-case mechanism to determine the next question's ID for the given industry.
 *       Then, it fetches the question and its options directly from the database.
 *       The detailed logic includes:
 *         - Mapping industry IDs to question IDs,
 *         - Executing two sequential database queries (one for the question, another for its options),
 *         - Returning the consolidated data as a JSON response.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: industryId
 *         schema:
 *           type: string
 *         required: true
 *         description: Industry ID used to determine the corresponding topic question.
 *     responses:
 *       200:
 *         description: The topic question with its options.
 *       404:
 *         description: No question found for this industry.
 *       500:
 *         description: Error fetching topic question.
 */
router.get('/topic-question/:industryId', authenticateToken, async (req, res) => {
    const { industryId } = req.params;  // Get the industryId from the request parameters

    try {
        const client = new Client({ connectionString: process.env.DB_URI });
        await client.connect();

        // Determine the next question based on the selected industry
        let nextQuestionId;
        switch (industryId) {
            case '1': // Finance & Banking
                nextQuestionId = 5;
                break;
            case '2': // Technology & Software Development
                nextQuestionId = 3;
                break;
            case '3': // Hospitality & Tourism
                nextQuestionId = 6;
                break;
            case '4': // Business & Marketing
                nextQuestionId = 7;
                break;
            case '5': // Language Studies
                nextQuestionId = 8;
                break;
            case '6': // Media & Entertainment
                nextQuestionId = 9;
                break;
            default:
                nextQuestionId = 2; // Default to the next general question (Industry Selection)
        }

        // Fetch the next question based on nextQuestionId
        const questionQuery = `
            SELECT id, question_text
            FROM questions
            WHERE id = $1
        `;
        const questionRes = await client.query(questionQuery, [nextQuestionId]);

        if (questionRes.rows.length === 0) {
            await client.end();
            return res.status(404).json({ message: 'No question found for this industry' });
        }

        const topicQuestion = questionRes.rows[0];

        // Fetch the options for this specific topic question (Q3)
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
