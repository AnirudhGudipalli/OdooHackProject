const express = require('express');
const router = express.Router();
const { authenticate, requireManager } = require('../middleware/auth');
const ctrl = require('../controllers/warehousesController');

// Public endpoint for signup form (no auth required)
router.get('/public', ctrl.getAll);

router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, requireManager, ctrl.create);
router.put('/:id', authenticate, requireManager, ctrl.update);

module.exports = router;
