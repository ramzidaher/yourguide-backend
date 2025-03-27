const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');
require('dotenv').config();

// Set the API base URL
const baseUrl = 'http://3.11.88.9:3000/api';

// Default placeholders for course images
const PLATFORM_PLACEHOLDERS = {
    "udemy.com": "https://www.udemy.com/staticx/udemy/images/v7/logo-udemy.svg",
    "coursera.org": "https://about.coursera.org/static/images/coursera-logo-full-rgb.png",
    "edx.org": "https://www.edx.org/sites/default/files/edx_hero.jpg",
    "linkedin.com": "https://static-exp1.licdn.com/sc/h/3ya5av77q5fi3g7uqlh7dlfl.png",
    "skillshare.com": "https://www.skillshare.com/assets/skillshare_brandmark_black.png",
    "default": "https://via.placeholder.com/150"
};

// 1️⃣ **Log in to get a JWT token**
const loginUser = async () => {
    try {
        const response = await axios.post(`${baseUrl}/auth/login`, {
            username: 'Shelly_Theingi',
            password: '2025'
        });
        console.log('✅ User logged in, JWT token received.');
        return response.data.token;
    } catch (error) {
        console.error('❌ Error logging in:', error.response?.data || error.message);
        throw error;
    }
};

// 2️⃣ **Fetch user profile & answers**
const fetchUserProfile = async (token) => {
    try {
        const response = await axios.get(`${baseUrl}/profile/`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const userProfile = response.data;
        console.log(`\n👤 User: ${userProfile.user.forename} ${userProfile.user.family_name}\n`);

        return userProfile;
    } catch (error) {
        console.error('❌ Error fetching profile:', error.response?.data || error.message);
        throw error;
    }
};

// 3️⃣ **Fetch OpenGraph image for course**
const fetchCourseImage = async (url) => {
    if (!url || typeof url !== "string") {
        console.warn("⚠️ Missing or invalid course URL, using default image.");
        return PLATFORM_PLACEHOLDERS["default"];
    }

    try {
        console.log(`🌐 Fetching image for: ${url}`);

        // Check predefined platform placeholders
        const platform = Object.keys(PLATFORM_PLACEHOLDERS).find(domain => url.includes(domain));
        if (platform) {
            console.log(`✅ Using predefined placeholder for ${platform}`);
            return PLATFORM_PLACEHOLDERS[platform];
        }

        // Try extracting OpenGraph image
        const response = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(response.data);
        const ogImage = $('meta[property="og:image"]').attr('content');

        if (ogImage) {
            console.log(`✅ OG Image found: ${ogImage}`);
            return ogImage;
        }

        throw new Error("No OG image found");
    } catch (error) {
        console.warn(`⚠️ Failed to fetch image for ${url}:`, error.message);
        return PLATFORM_PLACEHOLDERS["default"];
    }
};

// 4️⃣ **Ask ChatGPT for career recommendations**
const getChatGPTRecommendations = async (userProfile) => {
    const userName = `${userProfile.user.forename} ${userProfile.user.family_name}`;
    const userResponses = userProfile.questions.map(q => `${q.question}: ${q.answer.join(", ")}`).join('\n');

    console.log('🔍 Sending responses to ChatGPT for course recommendations...');

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert career advisor. Based on the user's name, responses, and interests, 
                        provide a career summary and recommend 5 online courses. Respond in JSON format ONLY with keys "summary" and "recommended_courses", 
                        ensuring each course contains "course_title", "provider", and "url".`
                    },
                    {
                        role: 'user',
                        content: `User Name: ${userName}\n\nUser Responses:\n${userResponses}`
                    }
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

        const chatGPTRawResponse = response.data.choices[0].message.content.trim();
        console.log('✅ Raw ChatGPT response:', chatGPTRawResponse);

        // Extract JSON part using regex (to prevent parsing errors)
        const jsonMatch = chatGPTRawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("ChatGPT response does not contain valid JSON.");
        }

        const chatGPTOutput = JSON.parse(jsonMatch[0]);

        // Ensure URL is always present
        for (let course of chatGPTOutput.recommended_courses) {
            if (!course.url || typeof course.url !== "string") {
                console.warn(`⚠️ Course "${course.course_title}" is missing a valid URL. Using placeholder.`);
                course.url = "https://via.placeholder.com/150"; // Fallback URL to prevent database error
            }
            course.image = await fetchCourseImage(course.url);
        }

        return chatGPTOutput;
    } catch (error) {
        console.error('❌ ChatGPT API failed:', error.message);
        return { summary: "⚠️ No summary provided by ChatGPT.", recommended_courses: [] };
    }
};

// 5️⃣ **Save recommended courses for the user**
const saveUserCourses = async (token, userId, courses) => {
    try {
        console.log(`💾 Saving recommended courses for userId: ${userId}`);

        // Ensure all courses have a valid URL before saving
        const sanitizedCourses = courses.map(course => ({
            course_title: course.course_title,
            provider: course.provider || "Unknown",
            url: course.url || "https://via.placeholder.com/150", // Ensure no null values
            image: course.image || PLATFORM_PLACEHOLDERS["default"]
        }));

        const response = await axios.post(
            `${baseUrl}/courses/save`,
            { userId, courses: sanitizedCourses },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        console.log("✅ Courses saved successfully:", response.data);
    } catch (error) {
        console.error("❌ Error saving courses:", error.response?.data || error.message);
    }
};

// 6️⃣ **Run the complete process**
const runProcess = async () => {
    try {
        // Step A: Log in and get token
        const token = await loginUser();

        // Step B: Fetch user profile & answers
        const userProfile = await fetchUserProfile(token);
        const userId = userProfile.user.id;

        // Step C: Get recommendations from ChatGPT
        const finalData = await getChatGPTRecommendations(userProfile);

        // Step D: Save recommended courses to the database via API
        await saveUserCourses(token, userId, finalData.recommended_courses);

        console.log("\n📌 **Career Summary:**", finalData.summary);
        console.log("\n📚 **Courses saved successfully!**");
    } catch (error) {
        console.error('❌ Process failed:', error.message);
    }
};

// Start the process
runProcess();
