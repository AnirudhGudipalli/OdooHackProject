const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/adjustmentsController');

router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, ctrl.create);
router.post('/:id/validate', authenticate, ctrl.validate);
router.post('/:id/cancel', authenticate, ctrl.cancel);

module.exports = router;
