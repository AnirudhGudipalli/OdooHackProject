const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDashboard, getProfile, updateProfile } = require('../controllers/dashboardController');

router.get('/', authenticate, getDashboard);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
