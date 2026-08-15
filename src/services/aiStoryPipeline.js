const Story = require('../models/Story');
const ChildProfile = require('../models/ChildProfile');
const GenerationLog = require('../models/GenerationLog');
const { generateStoryScript } = require('./claudeService');
const { generateStoryImage } = require('./imageProvider');
const { uploadToCloudinary } = require('./cloudinaryService');
const {
  emitStoryStatus,
  emitStoryComplete,
  emitStoryError,
} = require('../socket/socketHandler');

/**
 * Runs the complete asynchronous AI Story generation pipeline
 */
async function runStoryPipeline(storyId) {
  let story;
  try {
    story = await Story.findById(storyId);
    if (!story) {
      console.error(`[StoryPipeline] Story ${storyId} not found`);
      return;
    }

    const child = await ChildProfile.findById(story.childProfileId);
    if (!child) {
      throw new Error("Child profile not found for this story");
    }

    console.log(`[StoryPipeline] Starting pipeline for Story ${story._id} ("${story.theme}" for ${child.name})...`);

    // Log initialization
    await GenerationLog.create({
      storyId: story._id,
      step: 'init',
      status: 'success',
      metadata: { childName: child.name, ageBand: story.ageBand, pageCount: story.pageCount },
    });

    // ==========================================
    // STEP 1: TEXT GENERATION (Claude API)
    // ==========================================
    story.status = 'writing';
    await story.save();

    emitStoryStatus({
      storyId: story._id,
      status: 'writing',
      message: `Writing an age-appropriate story about "${story.theme}" for ${child.name}...`,
      totalPages: story.pageCount,
    });

    await GenerationLog.create({
      storyId: story._id,
      step: 'claude_text',
      status: 'in_progress',
    });

    const scriptResult = await generateStoryScript({
      childName: child.name,
      ageBand: story.ageBand,
      avatar: child.avatar || {},
      theme: story.theme,
      artStyle: story.artStyle,
      pageCount: story.pageCount,
      customDetails: story.customDetails,
    });

    story.title = scriptResult.title || `${child.name}'s Adventure`;
    story.moral = scriptResult.moral || '';
    
    // Initialize pages
    story.pages = scriptResult.pages.map((p, idx) => ({
      pageNumber: idx + 1,
      text: p.text,
      imagePrompt: p.imagePrompt,
      imageUrl: '',
      imagePublicId: '',
    }));

    await story.save();

    await GenerationLog.create({
      storyId: story._id,
      step: 'claude_text',
      status: 'success',
      metadata: { title: story.title, pagesCount: story.pages.length },
    });

    emitStoryStatus({
      storyId: story._id,
      status: 'writing',
      message: `Finished writing "${story.title}". Now creating the illustrations...`,
      totalPages: story.pageCount,
    });

    // ==========================================
    // STEP 2: ILLUSTRATION GENERATION (Per Page)
    // ==========================================
    story.status = 'illustrating';
    await story.save();

    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const pageNum = page.pageNumber;

      console.log(`[StoryPipeline] Illustrating Page ${pageNum}/${story.pageCount}...`);

      emitStoryStatus({
        storyId: story._id,
        status: 'illustrating',
        pageNumber: pageNum,
        totalPages: story.pageCount,
        message: `Creating illustration for Page ${pageNum} (${story.artStyle} style)...`,
      });

      // 1. Generate image with consistent character sheet
      const imageResult = await generateStoryImage({
        pageNumber: pageNum,
        pageImagePrompt: page.imagePrompt,
        avatar: child.avatar,
        childName: child.name,
        artStyle: story.artStyle,
        theme: story.theme,
      });

      // 2. Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(imageResult.url, `storybook_${story._id}`);

      page.imageUrl = uploadResult.secure_url;
      page.imagePublicId = uploadResult.public_id;

      // Cover image defaults to first page illustration
      if (pageNum === 1) {
        story.coverImageUrl = uploadResult.secure_url;
      }

      await story.save();

      await GenerationLog.create({
        storyId: story._id,
        step: 'image_generation',
        status: 'success',
        pageNumber: pageNum,
        metadata: {
          prompt: imageResult.prompt,
          imageUrl: uploadResult.secure_url,
          provider: imageResult.provider,
        },
      });

      // Emit real-time status with newly completed page data
      emitStoryStatus({
        storyId: story._id,
        status: 'illustrating',
        pageNumber: pageNum,
        totalPages: story.pageCount,
        message: `Page ${pageNum} illustration complete!`,
        pageData: page,
      });
    }

    // ==========================================
    // STEP 3: ASSEMBLE & COMPLETE
    // ==========================================
    story.status = 'complete';
    await story.save();

    await GenerationLog.create({
      storyId: story._id,
      step: 'complete',
      status: 'success',
      metadata: { finalStatus: 'complete', pagesGenerated: story.pages.length },
    });

    console.log(`[StoryPipeline] Story ${story._id} completed successfully!`);

    emitStoryComplete({
      storyId: story._id,
      story: story,
    });
  } catch (error) {
    console.error(`[StoryPipeline Error] Story ${storyId} failed:`, error);

    if (story) {
      story.status = 'failed';
      story.errorReason = error.message;
      await story.save();

      await GenerationLog.create({
        storyId: story._id,
        step: 'failure',
        status: 'failed',
        error: error.message,
      });

      emitStoryError({
        storyId: story._id,
        message: "We encountered an issue creating your storybook. Don't worry, you can try again!",
      });
    }
  }
}

module.exports = {
  runStoryPipeline,
};
