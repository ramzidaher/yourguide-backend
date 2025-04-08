const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const baseUrl = 'http://3.11.88.9:3000/api';

const PLATFORM_PLACEHOLDERS = {
    "udemy.com": "https://www.udemy.com/staticx/udemy/images/v7/logo-udemy.svg",
    "coursera.org": "https://about.coursera.org/static/images/coursera-logo-full-rgb.png",
    "edx.org": "https://www.edx.org/sites/default/files/edx_hero.jpg",
    "linkedin.com": "https://static-exp1.licdn.com/sc/h/3ya5av77q5fi3g7uqlh7dlfl.png",
    "skillshare.com": "https://www.skillshare.com/assets/skillshare_brandmark_black.png",
    "futurelearn.com": "https://www.futurelearn.com/brand/futurelearn_brandmark_pink.png",
    "youtube.com": "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg",
    "default": "https://via.placeholder.com/150"
};

const loginUser = async () => {
    const response = await axios.post(`${baseUrl}/auth/login`, {
        username: 'Ramzi',
        password: '2003'
    });
    console.log('✅ User logged in, JWT token received.');
    return response.data.token;
};

const fetchUserProfile = async (token) => {
    const response = await axios.get(`${baseUrl}/profile/`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const userProfile = response.data;
    console.log(`\n👤 User: ${userProfile.user.forename} ${userProfile.user.family_name}\n`);
    return userProfile;
};

const fetchCourseImage = async (url) => {
    try {
        const platform = Object.keys(PLATFORM_PLACEHOLDERS).find(domain =>
            url.toLowerCase().includes(domain.toLowerCase())
        );
        return platform ? PLATFORM_PLACEHOLDERS[platform] : PLATFORM_PLACEHOLDERS["default"];
    } catch (error) {
        console.error("Error fetching course image:", error);
        return PLATFORM_PLACEHOLDERS["default"];
    }
};

const scrapeFirstCourseUrl = async (platform, searchUrl, selector, transformFn, headers = {}) => {
    try {
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                Accept: 'text/html',
                ...headers
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const links = $(selector).map((_, el) => $(el).attr('href')).get();

        for (const href of links.slice(0, 5)) {
            try {
                const finalUrl = transformFn(href);
                if (!finalUrl) continue;

                const domain = new URL(finalUrl).hostname.replace('www.', '');
                if (!domain.includes(platform.toLowerCase())) continue;

                if (!finalUrl.match(/course|learn|training|tutorial/i)) continue;

                const res = await axios.head(finalUrl, { timeout: 5000 });
                if (res.status >= 200 && res.status < 400) {
                    console.log(`✅ Found valid ${platform} course: ${finalUrl}`);
                    return finalUrl;
                }
            } catch (err) {
                continue;
            }
        }
    } catch (err) {
        console.warn(`⚠️ Failed to scrape from ${platform}:`, err.message);
    }
    return null;
};

const findCourseManually = async (title, preferredPlatform) => {
    const query = encodeURIComponent(title);
    const scrapers = [
        {
            platform: 'Coursera',
            domain: 'coursera.org',
            url: `https://www.coursera.org/search?query=${query}`,
            selector: 'a[data-click-key="search.search.click.search_card"]',
            transform: href => href.startsWith('http') ? href : `https://www.coursera.org${href}`,
            headers: {}
        },
        {
            platform: 'Udemy',
            domain: 'udemy.com',
            url: `https://www.udemy.com/courses/search/?q=${query}`,
            selector: 'a.udlite-custom-focus-visible',
            transform: href => href.startsWith('http') ? href : `https://www.udemy.com${href}`,
            headers: {
                'Referer': 'https://www.udemy.com/'
            }
        },
        {
            platform: 'edX',
            domain: 'edx.org',
            url: `https://www.edx.org/search?q=${query}`,
            selector: 'a.discovery-card-link',
            transform: href => href.startsWith('http') ? href : `https://www.edx.org${href}`,
            headers: {}
        },
        {
            platform: 'LinkedIn Learning',
            domain: 'linkedin.com',
            url: `https://www.linkedin.com/learning/search?keywords=${query}`,
            selector: 'a[data-tracking-control-name="learning-serp_course-card-click"]',
            transform: href => href.startsWith('http') ? href : `https://www.linkedin.com${href}`,
            headers: {
                'Accept': 'application/vnd.linkedin.normalized+json+2.1'
            }
        },
        {
            platform: 'Skillshare',
            domain: 'skillshare.com',
            url: `https://www.skillshare.com/search?query=${query}`,
            selector: 'a[class*="search-result__title"]',
            transform: href => href.startsWith('http') ? href : `https://www.skillshare.com${href}`,
            headers: {}
        },
        {
            platform: 'FutureLearn',
            domain: 'futurelearn.com',
            url: `https://www.futurelearn.com/search?q=${query}`,
            selector: 'a.m-card--link',
            transform: href => href.startsWith('http') ? href : `https://www.futurelearn.com${href}`,
            headers: {}
        },
        {
            platform: 'YouTube',
            domain: 'youtube.com',
            url: `https://www.youtube.com/results?search_query=${query}+certified+course`,
            selector: 'a#video-title',
            transform: href => href.startsWith('http') ? href : `https://www.youtube.com${href}`,
            headers: {}
        }
    ];

    for (const scraper of scrapers) {
        if (preferredPlatform && !scraper.domain.includes(preferredPlatform)) continue;
        const url = await scrapeFirstCourseUrl(
            scraper.platform,
            scraper.url,
            scraper.selector,
            scraper.transform,
            scraper.headers
        );
        if (url) return url;
    }

    return null;
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
    const userResponses = filtered.map(q => `${q.question}: ${q.answer?.join(", ") || "No answer"}`).join('\n');
    const userName = `${userProfile.user.forename} ${userProfile.user.family_name}`;

    const providerDomainMap = {
        "Coursera": "coursera.org",
        "edX": "edx.org",
        "LinkedIn Learning": "linkedin.com",
        "Skillshare": "skillshare.com",
        "FutureLearn": "futurelearn.com",
        "Udemy": "udemy.com",
        "YouTube": "youtube.com"
    };

    const validCourses = [];
    let summary = "", attempts = 0;

    while (validCourses.length < 8 && attempts < 5) {
        attempts++;

        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a career advisor. Recommend 8 real courses as JSON: { summary, recommended_courses: [ { course_title, provider } ] }. Only use platforms: Coursera, edX, LinkedIn Learning, Skillshare, FutureLearn, Udemy, YouTube.`
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
        summary = summary || parsed.summary;

        for (const course of parsed.recommended_courses) {
            if (validCourses.length >= 8) break;
            const platform = providerDomainMap[course.provider.trim()];
            if (!platform) continue;

            const url = await findCourseManually(course.course_title, platform);
            if (!url) continue;

            course.url = url;
            course.image = await fetchCourseImage(url);
            validCourses.push(course);
        }
    }

    return { summary, recommended_courses: validCourses };
};

const saveUserCourses = async (token, userId, courses) => {
    const payload = courses.map(course => ({
        course_title: course.course_title,
        provider: course.provider,
        url: course.url,
        image: course.image
    }));

    const res = await axios.post(
        `${baseUrl}/courses/save`,
        { userId, courses: payload },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("✅ Courses saved successfully:", res.data);
};

const runProcess = async () => {
    try {
        const token = await loginUser();
        const profile = await fetchUserProfile(token);
        const final = await getChatGPTRecommendations(profile);
        await saveUserCourses(token, profile.user.id, final.recommended_courses);

        console.log("\n📌 Career Summary:", final.summary);
        final.recommended_courses.forEach((c, i) => {
            console.log(`\n${i + 1}. ${c.course_title}`);
            console.log(`   🏫 ${c.provider}`);
            console.log(`   🔗 ${c.url}`);
            console.log(`   🖼️ ${c.image}`);
        });
    } catch (err) {
        console.error("❌ Failed:", err.message);
    }
};

runProcess();