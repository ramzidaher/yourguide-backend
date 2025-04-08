const express = require('express');
const cors = require('cors');
require('dotenv').config();

const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const authRoutes = require('./routes/authRoutes');
const qaRoutes = require('./routes/qaRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userCoursesRoutes = require('./routes/userCoursesRoutes');
const coursesRoutes = require('./routes/coursesRoutes'); // Import the new course processing route
const app = express();
app.use(express.json());
app.use(cors());

// 🔹 Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'React API Backend',
            version: '1.0.0',
            description: 'API documentation for React backend services',
        },
        servers: [
            {
                url: 'http://3.11.88.9:3000/',
            },
        ],
    },
    apis: ['./routes/*.js'], // adjust if routes are elsewhere
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // Swagger UI route

// 🔹 Routes
app.use('/api/auth/', authRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api', profileRoutes);
app.use('/api/courses', userCoursesRoutes); // New course routes
app.use('/api/courses', coursesRoutes); // New route for processing courses

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`📚 Swagger Docs: http://localhost:${PORT}/docs`);
});
