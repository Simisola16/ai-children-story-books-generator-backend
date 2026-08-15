const express = require('express');
const router = express.Router();
const {
  createStory,
  getStories,
  getStoryById,
  getStoryPDF,
  deleteStory,
  getStoryLogs,
} = require('../controllers/storyController');
const { protect } = require('../middleware/auth');
const { storyGenerationLimiter } = require('../middleware/rateLimiter');
const { sanitizeStoryInput } = require('../middleware/sanitize');

router.use(protect); // All story routes require authentication

router.route('/')
  .post(storyGenerationLimiter, sanitizeStoryInput, createStory)
  .get(getStories);

router.route('/:id')
  .get(getStoryById)
  .delete(deleteStory);

router.get('/:id/pdf', getStoryPDF);
router.get('/:id/logs', getStoryLogs);

module.exports = router;
