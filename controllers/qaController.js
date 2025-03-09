// qaController.js
const { Client } = require('pg');
const axios = require('axios');

// Fetch all questions
const getQuestions = async () => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    const query = 'SELECT * FROM questions';
    const res = await client.query(query);
    await client.end();

    return res.rows;
};

// Save user answers to the DB
const saveUserAnswers = async (userId, answers) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    console.log('💾 Saving answers for userId:', userId);

    for (const { questionId, answer } of answers) {
        // 🛠 Ensure unique multi-choice answers are not inserted twice
        const checkQuery = `
            SELECT * FROM user_answers 
            WHERE user_id = $1 AND question_id = $2 AND answer = $3
        `;
        const existing = await client.query(checkQuery, [userId, questionId, JSON.stringify(answer)]);

        if (existing.rows.length === 0) {
            const insertQuery = `
                INSERT INTO user_answers(user_id, question_id, answer) 
                VALUES($1, $2, $3)
            `;
            await client.query(insertQuery, [userId, questionId, JSON.stringify(answer)]);
            console.log(`✅ Answer for question ${questionId} saved.`);
        } else {
            console.log(`🔄 Answer for question ${questionId} already exists. Skipping duplicate.`);
        }
    }

    await client.end();
};



// Summarize user answers using the Chat Completions API (gpt-3.5-turbo)
const ogs = require('open-graph-scraper'); // Import Open Graph Scraper

const getChatGPTSummary = async (userId) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    const query = `
    SELECT q.question_text, ua.answer
    FROM user_answers ua
    JOIN questions q ON ua.question_id = q.id
    WHERE ua.user_id = $1
  `;
    const res = await client.query(query, [userId]);

    // Convert multi-choice answers into readable text
    const userAnswers = res.rows.map(row => {
        let formattedAnswer = row.answer;
        try {
            const parsedAnswer = JSON.parse(row.answer);
            formattedAnswer = Array.isArray(parsedAnswer) ? parsedAnswer.join(", ") : parsedAnswer;
        } catch (e) { /* If it's a single string, leave as is */ }

        return `${row.question_text}: ${formattedAnswer}`;
    }).join('\n');

    console.log('📝 User answers:\n', userAnswers);

    try {
        // Request ChatGPT recommendations
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a career guidance AI. The user has answered career-related questions. 
                        Your task:
                        1️⃣ Summarize their responses into a career guidance profile.
                        2️⃣ Recommend **5 online courses** relevant to their interests.
                        3️⃣ Each recommendation must include:
                            - **Title** (course name)
                            - **Link** (course URL)
                        4️⃣ Format the response as JSON:
                        {
                            "summary": "Generated career profile here...",
                            "courses": [
                                {
                                    "title": "Course Name",
                                    "link": "https://example.com"
                                },
                                ...
                            ]
                        }`
                    },
                    { role: 'user', content: userAnswers }
                ],
                max_tokens: 700,  // Increased for detailed responses
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ ChatGPT response:', response.data);

        // Extract structured JSON from response
        const chatGPTOutput = JSON.parse(response.data.choices[0].message.content.trim());

        // **Step: Scrape OG Image for each course**
        for (const course of chatGPTOutput.courses) {
            try {
                const ogData = await ogs({ url: course.link });
                course.image = ogData.result.ogImage?.url || 'https://placekitten.com/150/150'; // Fallback if no OG image
            } catch (err) {
                console.error(`⚠️ Failed to fetch OG image for ${course.link}:`, err.message);
                course.image = 'https://placekitten.com/150/150'; // Use placeholder
            }
        }

        // Save **only** the summary in DB
        const insertQuery = 'INSERT INTO summaries(user_id, summary) VALUES($1, $2)';
        await client.query(insertQuery, [userId, chatGPTOutput.summary]);

        await client.end();

        return chatGPTOutput;  // Returning summary + courses with images for frontend
    } catch (error) {
        console.error('❌ ChatGPT API failed:', error.response?.data || error.message);
        await client.end();
        return {
            summary: "⚠️ Sorry, ChatGPT is currently unavailable. Please try again later.",
            courses: []
        };
    }
};



module.exports = {
    getQuestions,
    saveUserAnswers,
    getChatGPTSummary
};
