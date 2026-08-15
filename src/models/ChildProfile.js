const mongoose = require('mongoose');

const AvatarSchema = new mongoose.Schema(
  {
    skinTone: {
      type: String,
      default: '#F5D0A9', // Hex or color name (e.g. Fair, Warm Peach, Golden, Deep Bronze, Rich Cocoa)
    },
    hairStyle: {
      type: String,
      default: 'curly', // 'curly', 'straight', 'wavy', 'short-crop', 'braids', 'pigtails', 'afro', 'spiky', 'bob'
    },
    hairColor: {
      type: String,
      default: '#3D2314', // 'black', 'dark brown', 'golden blonde', 'auburn', 'ginger', etc.
    },
    eyeColor: {
      type: String,
      default: '#4A2C18', // 'brown', 'hazel', 'blue', 'green', 'amber'
    },
    outfitColor: {
      type: String,
      default: '#F2A93B', // Marigold, Meadow Green, Berry Red, Sky Blue, Royal Purple, Sunny Yellow
    },
    accessory: {
      type: String,
      default: 'none', // 'glasses', 'cape', 'crown', 'flower', 'headband', 'bowtie', 'scarf', 'star-badge', 'none'
    },
  },
  { _id: false }
);

const ChildProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Please provide the child's name"],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    ageBand: {
      type: String,
      enum: ['3-5', '6-8', '9-11'],
      required: [true, 'Please select an age band'],
    },
    avatar: {
      type: AvatarSchema,
      required: true,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ChildProfile', ChildProfileSchema);
