const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');  // Ensure correct path
const qaRoutes = require('./routes/qaRoutes');      // Ensure correct path

const app = express();
app.use(express.json());
app.use(cors());

// Correct middleware usage
app.use('/api/auth', authRoutes);
app.use('/api/qa', qaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});
