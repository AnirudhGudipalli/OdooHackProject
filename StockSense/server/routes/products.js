const express = require('express');
const router = express.Router();
const { authenticate, requireManager } = require('../middleware/auth');
const ctrl = require('../controllers/productsController');

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', authenticate, requireManager, ctrl.create);
router.put('/:id', authenticate, requireManager, ctrl.update);
router.delete('/:id', authenticate, requireManager, ctrl.remove);

module.exports = router;
