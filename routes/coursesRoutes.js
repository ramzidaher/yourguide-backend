const express = require('express');
const router = express.Router();
const { processUserCourses } = require('../controllers/coursescontroller'); // Import the function from controller

// Route to process user courses
router.post('/process-courses', processUserCourses);

module.exports = router;
