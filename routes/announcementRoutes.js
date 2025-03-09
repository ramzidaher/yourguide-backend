const express = require('express');
const { getAnnouncements, createAnnouncement } = require('../controllers/announcementController');  // Importing functions
const router = express.Router();

// Get all announcements
router.get('/', async (req, res) => {
    try {
        const announcements = await getAnnouncements();
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: "Error fetching announcements", error: error.message });
    }
});

// Create a new announcement
router.post('/', async (req, res) => {
    const { title, content } = req.body;
    try {
        await createAnnouncement(title, content);  // Calling createAnnouncement
        res.json({ message: 'Announcement created' });
    } catch (error) {
        res.status(500).json({ message: "Error creating announcement", error: error.message });
    }
});

module.exports = router;
