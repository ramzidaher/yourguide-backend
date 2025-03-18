const { Client } = require('pg');

/**
 * Save or update recommended courses for a user.
 */
const saveUserCourses = async (req, res) => {
    const { userId, courses } = req.body;

    if (!userId || !Array.isArray(courses) || courses.length === 0) {
        return res.status(400).json({ message: 'User ID and valid courses array are required.' });
    }

    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    try {
        console.log(`💾 Saving courses for user ${userId}`);

        for (const course of courses) {
            const query = `
                INSERT INTO user_courses (user_id, course_title, provider, link, image_url)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, course_title) 
                DO UPDATE SET provider = EXCLUDED.provider, link = EXCLUDED.link, image_url = EXCLUDED.image_url;
            `;

            await client.query(query, [
                userId,
                course.course_title,
                course.provider || "Unknown",
                course.url,
                course.image || "https://via.placeholder.com/150"
            ]);

            console.log(`✅ Saved course: ${course.course_title}`);
        }

        res.json({ success: true, message: 'Courses saved successfully.' });
    } catch (error) {
        console.error('❌ Error saving courses:', error.message);
        res.status(500).json({ success: false, message: 'Error saving courses.', error: error.message });
    } finally {
        await client.end();
    }
};

/**
 * Get saved courses for a user.
 */
const getUserCourses = async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    try {
        const query = `
            SELECT course_title, provider, link, image_url 
            FROM user_courses 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        const coursesResult = await client.query(query, [userId]);
        await client.end();

        res.json({ success: true, courses: coursesResult.rows });
    } catch (error) {
        console.error('❌ Error fetching courses:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching courses.', error: error.message });
    }
};

const saveManualCourse = async (req, res) => {
    const { userId, course_title, provider, link, image_url } = req.body;

    if (!userId || !course_title || !link) {
        return res.status(400).json({ message: 'User ID, course title, and link are required.' });
    }

    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    try {
        const query = `
            INSERT INTO user_courses (user_id, course_title, provider, link, image_url)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, course_title) 
            DO UPDATE SET provider = EXCLUDED.provider, link = EXCLUDED.link, image_url = EXCLUDED.image_url;
        `;

        await client.query(query, [
            userId,
            course_title,
            provider || "Unknown",
            link,
            image_url || "https://via.placeholder.com/150"
        ]);

        res.json({ success: true, message: 'Course added successfully.' });
    } catch (error) {
        console.error('❌ Error adding course:', error.message);
        res.status(500).json({ success: false, message: 'Error adding course.', error: error.message });
    } finally {
        await client.end();
    }
};

module.exports = {
    saveUserCourses,
    getUserCourses,
    saveManualCourse
};
