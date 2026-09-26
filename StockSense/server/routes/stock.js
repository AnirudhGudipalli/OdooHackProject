const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/stockController');

router.get('/', authenticate, ctrl.getAll);
router.get('/:productId', authenticate, ctrl.getByProduct);

module.exports = router;
