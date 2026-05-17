const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

console.log('Loading routes...');

const authRoutes = require('./routes/auth');
console.log('authRoutes type:', typeof authRoutes);
console.log('authRoutes:', authRoutes);

const fileRoutes = require('./routes/files');
console.log('fileRoutes type:', typeof fileRoutes);
console.log('fileRoutes:', fileRoutes);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

console.log('Setting up routes...');
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
