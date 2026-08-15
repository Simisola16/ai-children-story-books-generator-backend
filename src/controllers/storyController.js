const Story = require('../models/Story');
const ChildProfile = require('../models/ChildProfile');
const GenerationLog = require('../models/GenerationLog');
const { runStoryPipeline } = require('../services/aiStoryPipeline');
const { generateStoryPDF } = require('../services/pdfService');
const { deleteFromCloudinary } = require('../services/cloudinaryService');

// @desc    Create a new story (Async Generation)
// @route   POST /api/stories
// @access  Private
const createStory = async (req, res) => {
  try {
    const { childProfileId, theme, pageCount = 4, artStyle = 'watercolor', customDetails = '' } = req.body;

    if (!childProfileId || !theme) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both childProfileId and theme',
      });
    }

    const validPageCounts = [4, 8, 12];
    const parsedPageCount = parseInt(pageCount, 10);
    if (!validPageCounts.includes(parsedPageCount)) {
      return res.status(400).json({
        success: false,
        message: 'Page count must be 4, 8, or 12',
      });
    }

    // Verify child profile exists and belongs to user
    const child = await ChildProfile.findOne({
      _id: childProfileId,
      userId: req.user._id,
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child profile not found',
      });
    }

    // Create story entry at status "queued"
    const story = await Story.create({
      userId: req.user._id,
      childProfileId: child._id,
      title: `${child.name}'s ${theme} Adventure`,
      theme: theme.trim(),
      ageBand: child.ageBand,
      pageCount: parsedPageCount,
      artStyle: artStyle || 'watercolor',
      customDetails: customDetails || '',
      status: 'queued',
      pages: [],
    });

    // 1. Respond IMMEDIATELY with the new story at status "queued"
    res.status(202).json({
      success: true,
      message: 'Storybook generation has been queued.',
      storyId: story._id,
      story: {
        _id: story._id,
        title: story.title,
        status: story.status,
        pageCount: story.pageCount,
        childName: child.name,
        theme: story.theme,
        artStyle: story.artStyle,
        createdAt: story.createdAt,
      },
    });

    // 2. Run the generation pipeline asynchronously in background (Non-blocking)
    setImmediate(() => {
      runStoryPipeline(story._id).catch((err) => {
        console.error(`[StoryController] Unhandled pipeline error for story ${story._id}:`, err);
      });
    });
  } catch (error) {
    console.error('[Story Create Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate story generation',
    });
  }
};

// @desc    Get current user's stories (paginated + filterable by child)
// @route   GET /api/stories
// @access  Private
const getStories = async (req, res) => {
  try {
    const { childId, page = 1, limit = 12 } = req.query;
    const query = { userId: req.user._id };

    if (childId) {
      query.childProfileId = childId;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const [stories, total] = await Promise.all([
      Story.find(query)
        .populate('childProfileId', 'name ageBand avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Story.countDocuments(query),
    ]);

    return res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      stories,
    });
  } catch (error) {
    console.error('[Get Stories Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stories',
    });
  }
};

// @desc    Get single story by ID (full details + pages)
// @route   GET /api/stories/:id
// @access  Private
const getStoryById = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('childProfileId', 'name ageBand avatar');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Storybook not found',
      });
    }

    return res.json({
      success: true,
      story,
    });
  } catch (error) {
    console.error('[Get Story By ID Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch story details',
    });
  }
};

// @desc    Stream print-ready PDF for a story
// @route   GET /api/stories/:id/pdf
// @access  Private
const getStoryPDF = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('childProfileId');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Storybook not found',
      });
    }

    if (story.status !== 'complete') {
      return res.status(400).json({
        success: false,
        message: 'Storybook is still generating. Please wait until generation completes before downloading the PDF.',
      });
    }

    const pdfBuffer = await generateStoryPDF(story, story.childProfileId);

    const safeFilename = `${story.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Storybook.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF Export Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate printable PDF',
    });
  }
};

// @desc    Delete story and associated Cloudinary images
// @route   DELETE /api/stories/:id
// @access  Private
const deleteStory = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Storybook not found',
      });
    }

    // Clean up Cloudinary assets
    if (story.pages && story.pages.length > 0) {
      for (const page of story.pages) {
        if (page.imagePublicId) {
          deleteFromCloudinary(page.imagePublicId).catch((e) =>
            console.warn('[Cloudinary Cleanup Warning]', e.message)
          );
        }
      }
    }

    // Delete GenerationLogs and Story document
    await GenerationLog.deleteMany({ storyId: story._id });
    await Story.findByIdAndDelete(story._id);

    return res.json({
      success: true,
      message: 'Storybook and assets deleted successfully',
    });
  } catch (error) {
    console.error('[Delete Story Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete storybook',
    });
  }
};

// @desc    Get generation logs for debugging
// @route   GET /api/stories/:id/logs
// @access  Private
const getStoryLogs = async (req, res) => {
  try {
    const logs = await GenerationLog.find({ storyId: req.params.id }).sort({ createdAt: 1 });
    return res.json({
      success: true,
      logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
    });
  }
};

module.exports = {
  createStory,
  getStories,
  getStoryById,
  getStoryPDF,
  deleteStory,
  getStoryLogs,
};
