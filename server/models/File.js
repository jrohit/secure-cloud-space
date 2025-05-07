
const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: false, // The decrypted name of the file
    },
    type: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    thumbnailPath: {
      type: String,
      default: null,
    },
    thumbnailCache: {
      type: String, // Redis cache key for thumbnails
      default: null,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isTrash: {
      type: Boolean,
      default: false,
    },
    encryptionIV: {
      type: String, // Store IV for file content encryption
      default: null,
    },
    metadataEncrypted: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("File", FileSchema);
