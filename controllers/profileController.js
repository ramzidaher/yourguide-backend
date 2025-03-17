const { Client } = require('pg');
const axios = require('axios');
const ogs = require('open-graph-scraper');

/**
 * Add a new question.
 * @param {string} questionText
 * @returns {number} New question ID
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
 * Add options for a given question.
 * @param {number} questionId
 * @param {Array<string>} options
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
 * Retrieve all questions with their options.
 * @returns {Array<Object>}
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
 * Save user answers.
 * @param {number} userId
 * @param {Array<Object>} answers - Each object should have questionId and answer (an array)
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
 * Delete a question (and cascade delete options/answers if set up in the DB).
 * @param {number} questionId
 * @returns {Object} Result object with success and message
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
