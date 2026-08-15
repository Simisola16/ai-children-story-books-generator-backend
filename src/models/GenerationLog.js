const mongoose = require('mongoose');

const GenerationLogSchema = new mongoose.Schema(
  {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    step: {
      type: String,
      required: true,
      enum: ['init', 'sanitize', 'claude_text', 'image_generation', 'cloudinary_upload', 'pdf_render', 'complete', 'failure'],
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'success', 'failed'],
      required: true,
    },
    pageNumber: {
      type: Number,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GenerationLog', GenerationLogSchema);
