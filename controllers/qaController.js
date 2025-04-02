const { Client } = require('pg');
const axios = require('axios');
const ogs = require('open-graph-scraper');


/**
 * @swagger
 * /db/add-question:
 *   post:
 *     summary: Add a new question.
 *     description: Inserts a new question into the database.
 *     tags: [Questions - Controller]
 *     requestBody:
 *       description: Question text to be added.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns the new question ID.
 */
const addQuestion = async (questionText) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    const query = 'INSERT INTO questions (question_text) VALUES ($1) RETURNING id';
    const res = await client.query(query, [questionText]);
    await client.end();
    return res.rows[0].id;
};

/**
 * @swagger
 * /db/add-question-options:
 *   post:
 *     summary: Add options for a question.
 *     description: Inserts answer options for a given question.
 *     tags: [Questions - Controller]
 *     requestBody:
 *       description: JSON payload containing the question ID and an array of option texts.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 */
const addQuestionOptions = async (questionId, options) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    for (const optionText of options) {
        const query = 'INSERT INTO answer_options (question_id, option_text) VALUES ($1, $2)';
        await client.query(query, [questionId, optionText]);
    }
    await client.end();
};

/**
 * @swagger
 * /db/get-all-questions-with-options:
 *   get:
 *     summary: Retrieve all questions with options.
 *     description: Fetches all questions and their corresponding options from the database.
 *     tags: [Questions - Controller]
 *     responses:
 *       200:
 *         description: An array of questions with options.
 */
const getAllQuestionsWithOptions = async () => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    const questionsQuery = 'SELECT * FROM questions';
    const questionsRes = await client.query(questionsQuery);
    const questions = [];
    for (const question of questionsRes.rows) {
        const optionsQuery = 'SELECT id, option_text FROM answer_options WHERE question_id = $1';
        const optionsRes = await client.query(optionsQuery, [question.id]);
        questions.push({
            id: question.id,
            question: question.question_text,
            options: optionsRes.rows.map(option => ({
                id: option.id,
                text: option.option_text
            }))
        });
    }
    await client.end();
    return questions;
};

/**
 * @swagger
 * /db/save-user-answers:
 *   post:
 *     summary: Save user answers.
 *     description: Inserts or updates user answers for given questions.
 *     tags: [Questions - Controller]
 *     requestBody:
 *       description: JSON payload containing the user ID and an array of answers.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: number
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: number
 *                     answer:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       200:
 *         description: Answers saved successfully.
 */
const saveUserAnswers = async (userId, answers) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    console.log('💾 Saving answers for userId:', userId);
    for (const { questionId, answer } of answers) {
        try {
            // Check if the question exists
            const questionCheckQuery = 'SELECT id FROM questions WHERE id = $1';
            const questionExists = await client.query(questionCheckQuery, [questionId]);
            if (questionExists.rows.length === 0) {
                console.error(`❌ Error: Question ID ${questionId} does not exist.`);
                continue;
            }
            // Check if an answer already exists
            const checkQuery = 'SELECT * FROM user_answers WHERE user_id = $1 AND question_id = $2';
            const existing = await client.query(checkQuery, [userId, questionId]);
            if (existing.rows.length > 0) {
                // Update existing answer
                const updateQuery = 'UPDATE user_answers SET answer = $3 WHERE user_id = $1 AND question_id = $2';
                await client.query(updateQuery, [userId, questionId, JSON.stringify(answer)]);
                console.log(`🔄 Updated answer for question ${questionId}`);
            } else {
                // Insert new answer
                const insertQuery = 'INSERT INTO user_answers(user_id, question_id, answer) VALUES($1, $2, $3)';
                await client.query(insertQuery, [userId, questionId, JSON.stringify(answer)]);
                console.log(`✅ Saved answer for question ${questionId}`);
            }
        } catch (error) {
            console.error(`❌ Error saving answer for question ${questionId}:`, error.message);
        }
    }
    await client.end();
};

/**
 * @swagger
 * /db/delete-question:
 *   delete:
 *     summary: Delete a question.
 *     description: Deletes a question from the database and cascades the delete to options.
 *     tags: [Questions - Controller]
 *     parameters:
 *       - in: query
 *         name: questionId
 *         schema:
 *           type: number
 *         required: true
 *         description: The ID of the question to delete.
 *     responses:
 *       200:
 *         description: Question deleted successfully.
 */
const deleteQuestion = async (questionId) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    try {
        const query = 'DELETE FROM questions WHERE id = $1 RETURNING *';
        const res = await client.query(query, [questionId]);
        if (res.rowCount === 0) {
            await client.end();
            return { success: false, message: "Question not found" };
        }
        console.log(`✅ Question ${questionId} deleted successfully.`);
        // Optional: Reset sequence if no questions remain
        const checkQuery = 'SELECT COUNT(*) FROM questions';
        const checkRes = await client.query(checkQuery);
        if (parseInt(checkRes.rows[0].count) === 0) {
            console.log("♻️ No questions left, resetting sequence...");
            await client.query('ALTER SEQUENCE questions_id_seq RESTART WITH 1');
        }
        await client.end();
        return { success: true, message: "Question and options deleted successfully" };
    } catch (error) {
        await client.end();
        console.error("❌ Error deleting question:", error.message);
        return { success: false, message: "Error deleting question" };
    }
};

module.exports = {
    addQuestion,
    addQuestionOptions,
    getAllQuestionsWithOptions,
    saveUserAnswers,
    deleteQuestion
};
