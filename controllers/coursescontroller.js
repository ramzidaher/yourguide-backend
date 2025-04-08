const axios = require('axios');
require('dotenv').config();
const { URL } = require('url');

const baseUrl = 'http://3.11.88.9:3000/api';

const PLATFORM_PLACEHOLDERS = {
    "udemy.com": "https://cdn.brandfetch.io/idTqV2BNgX/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    "coursera.org": "https://cdn.brandfetch.io/idTHfL51P-/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    "edx.org": "https://cdn.brandfetch.io/idSP67A-c2/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    "linkedin.com": "https://cdn.brandfetch.io/idJFz6sAsl/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    "skillshare.com": "https://cdn.brandfetch.io/idPmqWnmuh/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    "futurelearn.com": "https://cdn.brandfetch.io/idEhEPzARD/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    "default": "https://via.placeholder.com/150"
};

const providerUrlPatterns = {
    "coursera": [
        "https://www.coursera.org/learn/",
        "https://www.coursera.org/specializations/",
        "https://www.coursera.org/professional-certificates/"
    ],
    "udemy": [
        "https://www.udemy.com/course/"
    ],
    "edx": [
        "https://www.edx.org/course/",
        "https://www.edx.org/professional-certificate/",
        "https://www.edx.org/learn/"
    ],
    "linkedin learning": [
        "https://www.linkedin.com/learning/"
    ],
    "skillshare": [
        "https://www.skillshare.com/en/classes/"
    ],
    "futurelearn": [
        "https://www.futurelearn.com/courses/",
        "https://www.futurelearn.com/degrees/"
    ]
};

const searchUrls = {
    "coursera": "https://www.coursera.org/search?query=",
    "udemy": "https://www.udemy.com/courses/search/?q=",
    "edx": "https://www.edx.org/search?q=",
    "linkedin learning": "https://www.linkedin.com/learning/search?keywords=",
    "skillshare": "https://www.skillshare.com/search?query=",
    "futurelearn": "https://www.futurelearn.com/search?q="
};

const slugify = (text) => {
    let slug = text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');

    const suffixes = ['specialization', 'course', 'masterclass', 'bootcamp', 'training', 'guide', 'fundamentals'];
    suffixes.forEach(suffix => {
        const regex = new RegExp(`-${suffix}$`, 'i');
        slug = slug.replace(regex, '');
    });

    return slug;
};

const validateUrl = async (url) => {
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5,
            validateStatus: () => true
        });

        const finalUrl = response.request.res.responseUrl || response.config.url;
        const requestedUrl = new URL(url);
        const finalUrlParsed = new URL(finalUrl);

        const requestedPath = requestedUrl.pathname.replace(/\/$/, '').toLowerCase();
        const finalPath = finalUrlParsed.pathname.replace(/\/$/, '').toLowerCase();

        const isSamePath = requestedPath === finalPath;
        const isValidStatus = response.status >= 200 && response.status < 400;

        return isSamePath && isValidStatus;
    } catch (err) {
        return false;
    }
};

const resolveCourseUrl = async (course) => {
    const provider = course.provider.toLowerCase();
    const patterns = providerUrlPatterns[provider] || [];
    const slug = slugify(course.course_title);

    let candidates = patterns.map(pattern => `${pattern}${slug}`);

    for (const candidate of candidates) {
        if (await validateUrl(candidate)) {
            return candidate;
        }
    }

    const searchUrl = searchUrls[provider]
        ? `${searchUrls[provider]}${encodeURIComponent(course.course_title)}`
        : PLATFORM_PLACEHOLDERS.default;

    console.warn(`⚠️ Using search URL for [${course.provider}] course: ${course.course_title}`);
    return searchUrl;
};

const fetchUserProfile = async (token) => {
    const response = await axios.get(`${baseUrl}/profile/`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const fetchCourseImage = async (url) => {
    const platform = Object.keys(PLATFORM_PLACEHOLDERS).find(domain =>
        url.toLowerCase().includes(domain.toLowerCase())
    );
    return platform ? PLATFORM_PLACEHOLDERS[platform] : PLATFORM_PLACEHOLDERS["default"];
};

const getChatGPTRecommendations = async (userProfile) => {
    const industryAnswer = userProfile.questions.find(q => q.id === 2)?.answer[0] || "";
    const dynamicQuestionId = {
        "Technology & Software Development": 3,
        "Retail & E-Commerce": 4,
        "Finance & Banking": 5,
        "Hospitality & Tourism": 6,
        "Business & Marketing": 7,
        "Language Studies": 8,
        "Media & Entertainment": 9
    }[industryAnswer] || null;

    const filtered = userProfile.questions.filter(q => [1, 2, 10, 11, 12, dynamicQuestionId].includes(q.id));
    const userResponses = filtered
        .map(q => `${q.question}: ${q.answer?.join(", ") || "No answer"}`)
        .join('\n');
    const userName = `${userProfile.user.forename} ${userProfile.user.family_name}`;

    const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a career advisor. Recommend 8 real courses (not just marketing) as JSON: { 
                        summary, 
                        recommended_courses: [ 
                            { 
                                course_title: string, 
                                provider: "Coursera" | "edX" | "LinkedIn Learning" | "Skillshare" | "FutureLearn" | "Udemy" 
                            } 
                        ] 
                    }. Only use these platforms: Coursera, edX, LinkedIn Learning, Skillshare, FutureLearn, Udemy.`
                },
                {
                    role: 'user',
                    content: `User Name: ${userName}\n\nResponses:\n${userResponses}`
                }
            ]
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    const raw = res.data.choices[0].message.content.trim();
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    let { summary, recommended_courses } = parsed;

    recommended_courses = await Promise.all(
        recommended_courses.map(async course => {
            course.url = await resolveCourseUrl(course);
            course.image = await fetchCourseImage(course.url);
            return course;
        })
    );

    return { summary, recommended_courses };
};

const deleteAllCoursesForUser = async (token, userId) => {
    await axios.delete(`${baseUrl}/courses/delete-all-courses`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { userId }
    });
    console.log("✅ All courses deleted successfully.");
};

const saveUserCourses = async (token, userId, courses) => {
    const payload = courses.map(course => ({
        course_title: course.course_title,
        provider: course.provider,
        url: course.url,
        image: course.image
    }));

    await Promise.all([
        deleteAllCoursesForUser(token, userId),
        axios.post(`${baseUrl}/courses/save`, { userId, courses: payload }, {
            headers: { Authorization: `Bearer ${token}` }
        })
    ]);

    console.log("✅ Courses saved successfully.");
};

const processUserCourses = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(400).json({ success: false, message: 'Authorization token is required.' });
        }

        const profile = await fetchUserProfile(token);
        const final = await getChatGPTRecommendations(profile);
        await saveUserCourses(token, profile.user.id, final.recommended_courses);

        res.json({
            success: true,
            message: 'Courses processed successfully',
            summary: final.summary,
            recommended_courses: final.recommended_courses
        });
    } catch (err) {
        console.error('Error during course processing:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to process courses',
            error: err.message
        });
    }
};

module.exports = {
    processUserCourses
};