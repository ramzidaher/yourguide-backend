const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const ogs = require('open-graph-scraper'); // Import Open Graph Scraper

// Set your server's base URL
const baseUrl = 'http://172.31.42.130:3000/api';

// 1️⃣ **Log in to get a JWT token**
const loginUser = async () => {
    try {
        const response = await axios.post(`${baseUrl}/auth/login`, {
            username: 'ramzi',
            password: 'password123'
        });
        console.log('✅ User logged in, JWT token:', response.data.token);
        return response.data.token;
    } catch (error) {
        console.error('❌ Error logging in:', error.response?.data || error.message);
        throw error;
    }
};

// 2️⃣ **Submit user answers**
const submitAnswers = async (token) => {
    try {
        const answers = [
            { questionId: 1, answer: ["School student (13-18)"] },
            { questionId: 2, answer: ["Computer Science"] },
            { questionId: 3, answer: ["Artificial Intelligence", "Data Science"] },
            { questionId: 4, answer: ["Intermediate"] },
            { questionId: 5, answer: ["7-10 hours (1hr per day)"] },
            { questionId: 6, answer: ["Career change"] },
            { questionId: 7, answer: ["Time management", "Consistency"] }
        ];

        const response = await axios.post(
            `${baseUrl}/qa/submit`,
            { answers },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        console.log('✅ Answers submitted:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Error submitting answers:', error.response?.data || error.message);
        throw error;
    }
};

// 3️⃣ **Fetch OpenGraph metadata for course images (with retries)**
const cheerio = require('cheerio');  // Import Cheerio for HTML parsing

const fetchCourseImage = async (url) => {
    try {
        console.log(`🌐 Fetching image for: ${url}`);

        // 1️⃣ **Try Coursera API (if applicable)**
        if (url.includes("coursera.org")) {
            const courseraId = url.split("/").pop();  // Extract Course ID from URL
            const courseraApiUrl = `https://api.coursera.org/api/courses.v1?ids=${courseraId}&fields=photoUrl`;
            const response = await axios.get(courseraApiUrl);
            if (response.data.elements?.length > 0) {
                const imageUrl = response.data.elements[0].photoUrl;
                console.log(`✅ Coursera API Image: ${imageUrl}`);
                return imageUrl;
            }
        }

        // 2️⃣ **Try Udemy API (replace with your Udemy API key if needed)**
        if (url.includes("udemy.com")) {
            const udemyCourseSlug = url.split("/course/")[1].split("/")[0]; // Extract Course Slug
            const udemyApiUrl = `https://www.udemy.com/api-2.0/courses/${udemyCourseSlug}/?fields[course]=image_480x270`;
            const response = await axios.get(udemyApiUrl);
            if (response.data.image_480x270) {
                console.log(`✅ Udemy API Image: ${response.data.image_480x270}`);
                return response.data.image_480x270;
            }
        }

        // 3️⃣ **Fallback: Extract Image from HTML using Cheerio**
        const htmlResponse = await axios.get(url);
        const $ = cheerio.load(htmlResponse.data);
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
            console.log(`✅ Fetched OG Image from HTML: ${ogImage}`);
            return ogImage;
        }

        throw new Error("No image found");
    } catch (error) {
        console.error(`⚠️ Failed to fetch image for ${url}:`, error.message);
        return "https://via.placeholder.com/150";  // Fallback placeholder image
    }
};


// 4️⃣ **Retrieve and summarize user answers using ChatGPT**
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
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a career guidance AI. The user has answered career-related questions. 
                        🔹 **Your task:**
                        1️⃣ Summarize their responses into a **career guidance profile**.
                        2️⃣ Recommend **5 online courses** relevant to their interests.
                        3️⃣ Each recommendation must include:
                            - **Title** (course name)
                            - **Link** (course URL)
                            - **Image URL** (leave empty, we will fetch it)
                        4️⃣ **Respond only in JSON format.** No extra explanations, no markdown.

                        **Format:**
                        {
                            "summary": "Generated career profile...",
                            "courses": [
                                {
                                    "title": "Course Name",
                                    "link": "https://example.com",
                                    "image": ""
                                },
                                ...
                            ]
                        }`
                    },
                    { role: 'user', content: userAnswers }
                ],
                max_tokens: 700,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ ChatGPT raw response:', JSON.stringify(response.data, null, 2));

        // Parse the JSON response from ChatGPT
        const chatGPTOutput = JSON.parse(response.data.choices[0].message.content.trim());
        console.log("📝 Parsed ChatGPT Response:", chatGPTOutput);

        // Fetch images for each course
        for (let course of chatGPTOutput.courses) {
            course.image = await fetchCourseImage(course.link);
        }

        // Save the summary in the database
        const insertQuery = 'INSERT INTO summaries(user_id, summary) VALUES($1, $2)';
        await client.query(insertQuery, [userId, chatGPTOutput.summary]);

        await client.end();

        return chatGPTOutput; // Returning summary + courses for frontend use
    } catch (error) {
        console.error('❌ ChatGPT API failed:', error.response?.data || error.message);
        await client.end();
        return {
            summary: "⚠️ Sorry, ChatGPT is currently unavailable. Please try again later.",
            courses: []
        };
    }
};


// 5️⃣ **Run the full test**
const runTest = async () => {
    try {
        // A. Log in, get token
        const token = await loginUser();

        // B. Submit answers
        await submitAnswers(token);

        // C. Decode the token to get user ID
        const decoded = jwt.decode(token);
        const userId = decoded.userId;

        // D. Summarize and fetch metadata
        const finalData = await getChatGPTSummary(userId);

        console.log("🎯 Final Output (Summary + Courses):", JSON.stringify(finalData, null, 2));
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

// Start the test
runTest();
