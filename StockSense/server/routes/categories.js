const express = require('express');
const router = express.Router();
const { authenticate, requireManager } = require('../middleware/auth');
const ctrl = require('../controllers/categoriesController');

router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, requireManager, ctrl.create);

module.exports = router;
