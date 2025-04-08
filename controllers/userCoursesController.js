const { Client } = require('pg');

/**
 * @swagger
 * /db/save-user-courses:
 *   post:
 *     summary: Save or update recommended courses for a user.
 *     description: Saves a list of courses for a given user in the database.
 *     tags: [User Courses - Controller]
 *     requestBody:
 *       description: JSON payload containing userId and courses array.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: number
 *               courses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     course_title:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     url:
 *                       type: string
 *                     image:
 *                       type: string
 *     responses:
 *       200:
 *         description: Courses saved successfully.
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
 * @swagger
 * /db/get-user-courses:
 *   get:
 *     summary: Get saved courses for a user.
 *     description: Retrieves saved courses for a specified user from the database.
 *     tags: [User Courses - Controller]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: number
 *         required: true
 *         description: ID of the user.
 *     responses:
 *       200:
 *         description: List of saved courses.
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

/**
 * @swagger
 * /db/save-manual-course:
 *   post:
 *     summary: Save a manually added course for a user.
 *     description: Inserts or updates a manual course entry for a user in the database.
 *     tags: [User Courses - Controller]
 *     requestBody:
 *       description: JSON payload containing userId, course_title, provider, link, and image_url.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: number
 *               course_title:
 *                 type: string
 *               provider:
 *                 type: string
 *               link:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Course added successfully.
 */

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

/**
 * @swagger
 * /db/delete-all-courses:
 *   delete:
 *     summary: Delete all courses for all users.
 *     description: Deletes all courses from the database.
 *     tags: [User Courses - Controller]
 *     responses:
 *       200:
 *         description: All courses deleted successfully.
 *       500:
 *         description: Error occurred while deleting courses.
 */

const deleteAllCourses = async (req, res) => {
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();

    try {
        console.log('🗑️ Deleting all courses from the database');

        const query = `
            DELETE FROM user_courses;
        `;

        await client.query(query);

        res.json({ success: true, message: 'All courses deleted successfully.' });
    } catch (error) {
        console.error('❌ Error deleting courses:', error.message);
        res.status(500).json({ success: false, message: 'Error deleting courses.', error: error.message });
    } finally {
        await client.end();
    }
};


module.exports = {
    saveUserCourses,
    getUserCourses,
    saveManualCourse,
    deleteAllCourses
};
