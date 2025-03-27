const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const qaRoutes = require('./routes/qaRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userCoursesRoutes = require('./routes/userCoursesRoutes');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/auth/', authRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api', profileRoutes);
app.use('/api/courses', userCoursesRoutes); // New course routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});
