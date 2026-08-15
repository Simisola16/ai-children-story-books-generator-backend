const express = require('express');
const router = express.Router();
const {
  createChildProfile,
  getChildProfiles,
  getChildProfileById,
  updateChildProfile,
  deleteChildProfile,
} = require('../controllers/childController');
const { protect } = require('../middleware/auth');

router.use(protect); // All child profile routes require authentication

router.route('/')
  .post(createChildProfile)
  .get(getChildProfiles);

router.route('/:id')
  .get(getChildProfileById)
  .patch(updateChildProfile)
  .delete(deleteChildProfile);

module.exports = router;
