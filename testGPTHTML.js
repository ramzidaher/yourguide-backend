const express = require('express');
const axios = require('axios');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const ogs = require('open-graph-scraper');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = 8080;

// Set your server's base URL
const baseUrl = 'http://172.31.42.130:3000/api';

app.use(express.static('public')); // Serve static files (CSS, images, etc.)

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
                headers: { Authorization: `Bearer ${token}` }
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
const fetchCourseImage = async (url) => {
    try {
        console.log(`🌐 Fetching image for: ${url}`);

        if (url.includes("coursera.org")) {
            const courseraId = url.split("/").pop();
            const courseraApiUrl = `https://api.coursera.org/api/courses.v1?ids=${courseraId}&fields=photoUrl`;
            const response = await axios.get(courseraApiUrl);
            if (response.data.elements?.length > 0) {
                return response.data.elements[0].photoUrl;
            }
        }

        if (url.includes("udemy.com")) {
            const udemyCourseSlug = url.split("/course/")[1].split("/")[0];
            const udemyApiUrl = `https://www.udemy.com/api-2.0/courses/${udemyCourseSlug}/?fields[course]=image_480x270`;
            const response = await axios.get(udemyApiUrl);
            if (response.data.image_480x270) {
                return response.data.image_480x270;
            }
        }

        const htmlResponse = await axios.get(url);
        const $ = cheerio.load(htmlResponse.data);
        const ogImage = $('meta[property="og:image"]').attr('content');
        return ogImage || "https://via.placeholder.com/150";
    } catch (error) {
        console.error(`⚠️ Failed to fetch image for ${url}:`, error.message);
        return "https://via.placeholder.com/150";
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

    const userAnswers = res.rows.map(row => {
        let formattedAnswer = row.answer;
        try {
            const parsedAnswer = JSON.parse(row.answer);
            formattedAnswer = Array.isArray(parsedAnswer) ? parsedAnswer.join(", ") : parsedAnswer;
        } catch (e) { }
        return `${row.question_text}: ${formattedAnswer}`;
    }).join('\n');

    try {
        console.log("📝 Sending User Answers to ChatGPT:", userAnswers);

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `Summarize user answers into a career guidance profile and recommend 5 online courses in JSON format.`
                    },
                    { role: 'user', content: userAnswers }
                ],
                max_tokens: 700,
                response_format: { type: 'json_object' }
            },
            {
                headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
            }
        );

        console.log("✅ ChatGPT Raw Response:", response.data);

        if (!response.data || !response.data.choices || !response.data.choices[0].message.content) {
            throw new Error("ChatGPT returned an unexpected format!");
        }

        const chatGPTOutput = response.data.choices[0].message.content;
        console.log("📝 Parsed ChatGPT Response:", chatGPTOutput);

        // Fix the issue by using the correct key for courses
        const recommendedCourses = chatGPTOutput["Recommended Courses"];
        if (!Array.isArray(recommendedCourses)) {
            throw new Error("ChatGPT response does not contain a valid 'Recommended Courses' array.");
        }

        for (let course of recommendedCourses) {
            course.image = await fetchCourseImage(course["Link"]);
        }

        // Prepare structured response
        const formattedResponse = {
            summary: chatGPTOutput["Career Guidance Profile"],
            courses: recommendedCourses.map(course => ({
                title: course["Course Title"],
                link: course["Link"],
                image: course.image || "https://via.placeholder.com/150"
            }))
        };

        await client.end();
        return formattedResponse;
    } catch (error) {
        console.error("❌ ChatGPT API failed:", error.response?.data || error.message);
        await client.end();
        return { summary: "⚠️ ChatGPT API error. Try again later.", courses: [] };
    }
};



// 5️⃣ **Main route to display results**
app.get('/', async (req, res) => {
    try {
        const token = await loginUser();
        await submitAnswers(token);

        const decoded = jwt.decode(token);
        const userId = decoded.userId;

        const finalData = await getChatGPTSummary(userId);

        let htmlContent = `
            <html>
                <head>
                    <title>Career Guidance Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                        h1 { color: #333; }
                        .course { border: 1px solid #ddd; padding: 10px; margin: 10px; display: inline-block; width: 250px; }
                        img { width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    <h1>Career Guidance Summary</h1>
                    <p>${finalData.summary}</p>
                    <h2>Recommended Courses</h2>
                    ${finalData.courses.map(course => `
                        <div class="course">
                            <h3>${course.title}</h3>
                            <img src="${course.image}" alt="${course.title}" />
                            <p><a href="${course.link}" target="_blank">View Course</a></p>
                        </div>
                    `).join('')}
                </body>
            </html>
        `;

        res.send(htmlContent);
    } catch (error) {
        res.status(500).send("<h1>Error processing request</h1>");
    }
});

// 6️⃣ **Start Express Server**
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
