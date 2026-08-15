const ChildProfile = require('../models/ChildProfile');
const Story = require('../models/Story');

// @desc    Create a new child profile with illustrated avatar
// @route   POST /api/children
// @access  Private
const createChildProfile = async (req, res) => {
  try {
    const { name, ageBand, avatar } = req.body;

    if (!name || !ageBand) {
      return res.status(400).json({
        success: false,
        message: "Please provide both the child's name and age band ('3-5', '6-8', '9-11')",
      });
    }

    if (!['3-5', '6-8', '9-11'].includes(ageBand)) {
      return res.status(400).json({
        success: false,
        message: "Age band must be '3-5', '6-8', or '9-11'",
      });
    }

    // Ensure avatar is purely illustrated traits (no photo URLs)
    const sanitizedAvatar = {
      skinTone: avatar?.skinTone || '#F5D0A9',
      hairStyle: avatar?.hairStyle || 'curly',
      hairColor: avatar?.hairColor || '#3D2314',
      eyeColor: avatar?.eyeColor || '#4A2C18',
      outfitColor: avatar?.outfitColor || '#F2A93B',
      accessory: avatar?.accessory || 'none',
    };

    const child = await ChildProfile.create({
      userId: req.user._id,
      name: name.trim(),
      ageBand,
      avatar: sanitizedAvatar,
    });

    return res.status(201).json({
      success: true,
      message: 'Child profile created successfully',
      child,
    });
  } catch (error) {
    console.error('[Child Create Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create child profile',
    });
  }
};

// @desc    Get all child profiles for the logged-in user
// @route   GET /api/children
// @access  Private
const getChildProfiles = async (req, res) => {
  try {
    const children = await ChildProfile.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json({
      success: true,
      count: children.length,
      children,
    });
  } catch (error) {
    console.error('[Child List Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch child profiles',
    });
  }
};

// @desc    Get single child profile by ID
// @route   GET /api/children/:id
// @access  Private
const getChildProfileById = async (req, res) => {
  try {
    const child = await ChildProfile.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child profile not found',
      });
    }

    return res.json({
      success: true,
      child,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve child profile',
    });
  }
};

// @desc    Update child profile
// @route   PATCH /api/children/:id
// @access  Private
const updateChildProfile = async (req, res) => {
  try {
    const { name, ageBand, avatar } = req.body;
    const child = await ChildProfile.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child profile not found',
      });
    }

    if (name) child.name = name.trim();
    if (ageBand && ['3-5', '6-8', '9-11'].includes(ageBand)) child.ageBand = ageBand;
    if (avatar) {
      child.avatar = {
        skinTone: avatar.skinTone || child.avatar.skinTone,
        hairStyle: avatar.hairStyle || child.avatar.hairStyle,
        hairColor: avatar.hairColor || child.avatar.hairColor,
        eyeColor: avatar.eyeColor || child.avatar.eyeColor,
        outfitColor: avatar.outfitColor || child.avatar.outfitColor,
        accessory: avatar.accessory !== undefined ? avatar.accessory : child.avatar.accessory,
      };
    }

    await child.save();

    return res.json({
      success: true,
      message: 'Child profile updated successfully',
      child,
    });
  } catch (error) {
    console.error('[Child Update Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update child profile',
    });
  }
};

// @desc    Delete child profile and optionally related stories
// @route   DELETE /api/children/:id
// @access  Private
const deleteChildProfile = async (req, res) => {
  try {
    const child = await ChildProfile.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child profile not found',
      });
    }

    return res.json({
      success: true,
      message: 'Child profile deleted successfully',
    });
  } catch (error) {
    console.error('[Child Delete Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete child profile',
    });
  }
};

module.exports = {
  createChildProfile,
  getChildProfiles,
  getChildProfileById,
  updateChildProfile,
  deleteChildProfile,
};
