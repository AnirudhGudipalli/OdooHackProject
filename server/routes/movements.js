const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/movementsController');

router.get('/', authenticate, ctrl.getAll);

module.exports = router;
