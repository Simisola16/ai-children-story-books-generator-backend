const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema(
  {
    pageNumber: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
      default: '',
    },
    imagePrompt: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    imagePublicId: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const StorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    childProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChildProfile',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'An Enchanted Adventure',
    },
    moral: {
      type: String,
      trim: true,
      default: '',
    },
    theme: {
      type: String,
      required: [true, 'Story theme is required'],
      trim: true,
    },
    ageBand: {
      type: String,
      enum: ['3-5', '6-8', '9-11'],
      required: true,
    },
    pageCount: {
      type: Number,
      enum: [4, 8, 12],
      default: 4,
      required: true,
    },
    artStyle: {
      type: String,
      default: 'watercolor', // 'watercolor', 'soft cartoon', 'paper-cutout', 'whimsical gouache', 'claymation', 'digital picture book'
    },
    language: {
      type: String,
      default: 'en',
    },
    customDetails: {
      type: String,
      trim: true,
      maxlength: [300, 'Custom details cannot exceed 300 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['queued', 'writing', 'illustrating', 'complete', 'failed'],
      default: 'queued',
      index: true,
    },
    pages: {
      type: [PageSchema],
      default: [],
    },
    coverImageUrl: {
      type: String,
      default: '',
    },
    errorReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Story', StorySchema);
