const express = require('express');
const { saveManualCourse, saveUserCourses, getUserCourses, deleteAllCourses } = require('../controllers/userCoursesController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/courses/add:
 *   post:
 *     summary: Add a manual course for a user.
 *     description: Save or update a manually added course for a specific user.
 *     tags: [User Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Manual course data.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - course_title
 *               - link
 *             properties:
 *               userId:
 *                 type: number
 *               course_title:
 *                 type: string
 *               provider:
 *                 type: string
 *                 default: "Unknown"
 *               link:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 default: "https://via.placeholder.com/150"
 *     responses:
 *       200:
 *         description: Course added successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields.
 *       500:
 *         description: Error adding course.
 */
router.post('/add', authenticateToken, saveManualCourse);

/**
 * @swagger
 * /api/courses/save:
 *   post:
 *     summary: Save user courses.
 *     description: Save or update recommended courses for a user.
 *     tags: [User Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Array of courses to be saved for the user.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - courses
 *             properties:
 *               userId:
 *                 type: number
 *               courses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - course_title
 *                     - link
 *                   properties:
 *                     course_title:
 *                       type: string
 *                     provider:
 *                       type: string
 *                       default: "Unknown"
 *                     url:
 *                       type: string
 *                     image:
 *                       type: string
 *                       default: "https://via.placeholder.com/150"
 *     responses:
 *       200:
 *         description: Courses saved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Error saving courses.
 */
router.post('/save', authenticateToken, saveUserCourses);

/**
 * @swagger
 * /api/courses/user/{userId}:
 *   get:
 *     summary: Retrieve saved courses for a user.
 *     description: Get the saved courses for a specific user by their ID.
 *     tags: [User Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: number
 *         required: true
 *         description: The ID of the user.
 *     responses:
 *       200:
 *         description: A list of saved courses.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       course_title:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       link:
 *                         type: string
 *                       image_url:
 *                         type: string
 *       400:
 *         description: User ID is required.
 *       500:
 *         description: Error fetching courses.
 */
router.get('/user/:userId', authenticateToken, getUserCourses);

// New route to delete all courses
router.delete('/delete-all-courses', deleteAllCourses);

module.exports = router;


