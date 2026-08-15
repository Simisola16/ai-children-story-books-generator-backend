const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

/**
 * Uploads an image (URL, base64, or data URI) to Cloudinary.
 * If Cloudinary is not configured or in testing, safely returns the original URL / data URI.
 */
async function uploadToCloudinary(imageSource, folder = 'storybook_pages') {
  if (!isCloudinaryConfigured()) {
    return {
      secure_url: imageSource,
      public_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(imageSource, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });

    return {
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    };
  } catch (error) {
    console.error('[Cloudinary Upload Error]', error.message);
    // Graceful fallback to avoid halting the user pipeline
    return {
      secure_url: imageSource,
      public_id: `fallback_${Date.now()}`,
      error: error.message,
    };
  }
}

/**
 * Deletes an image from Cloudinary by its publicId
 */
async function deleteFromCloudinary(publicId) {
  if (!publicId || publicId.startsWith('local_') || publicId.startsWith('fallback_') || !isCloudinaryConfigured()) {
    return { result: 'skipped' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.warn(`[Cloudinary Delete Warning] Failed to delete ${publicId}:`, error.message);
    return { result: 'failed', error: error.message };
  }
}

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
