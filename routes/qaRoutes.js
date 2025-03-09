const express = require('express');
const { saveUserAnswers, getChatGPTSummary } = require('../controllers/qaController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Submit answers
router.post('/submit', authenticateToken, async (req, res) => {
    const { answers } = req.body;
    const { userId } = req;

    try {
        if (!answers || answers.length === 0) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        await saveUserAnswers(userId, answers);
        res.json({ message: '✅ Answers submitted successfully' });
    } catch (error) {
        console.error('❌ Error processing answers:', error);
        res.status(500).json({ message: 'Error processing answers', error: error.message });
    }
});

// Get ChatGPT summary
router.get('/summary', authenticateToken, async (req, res) => {
    const { userId } = req;
    try {
        const summary = await getChatGPTSummary(userId);
        res.json({ summary });
    } catch (error) {
        res.status(500).json({ message: 'Error generating summary', error: error.message });
    }
});

module.exports = router;  // ✅ Ensure this is exporting properly
