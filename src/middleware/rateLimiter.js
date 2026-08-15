const rateLimit = require('express-rate-limit');
const Story = require('../models/Story');

// Global API rate limiter for standard traffic protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address, please try again later.',
  },
});

// Auth endpoints rate limiter (anti-brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  message: {
    success: false,
    message: 'Too many login or registration attempts. Please try again after 15 minutes.',
  },
});

// Story generation rate limiter per user (24h sliding window)
const storyGenerationLimiter = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const DAILY_LIMIT = parseInt(process.env.DAILY_GENERATION_LIMIT, 10) || 12; // 12 stories / day default
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await Story.countDocuments({
      userId,
      createdAt: { $gte: oneDayAgo },
    });

    if (count >= DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Daily generation limit reached (${DAILY_LIMIT} storybooks per 24 hours). This protects AI compute resources. Please try again tomorrow!`,
        remaining: 0,
        limit: DAILY_LIMIT,
      });
    }

    req.remainingGenerations = DAILY_LIMIT - count - 1;
    next();
  } catch (error) {
    console.error('[RateLimiter Error]', error);
    next(); // Pass through on unexpected DB check error
  }
};

module.exports = {
  apiLimiter,
  authLimiter,
  storyGenerationLimiter,
};
