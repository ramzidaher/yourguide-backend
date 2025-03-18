const express = require('express');
const { saveManualCourse, saveUserCourses, getUserCourses } = require('../controllers/userCoursesController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// ✅ Use explicit paths for adding/saving courses before dynamic routes
router.post('/add', authenticateToken, saveManualCourse);
router.post('/save', authenticateToken, saveUserCourses);

// ✅ Change the GET route to `/user/:userId` to avoid conflicts
router.get('/user/:userId', authenticateToken, getUserCourses);

module.exports = router;
