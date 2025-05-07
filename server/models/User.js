const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    bucketId: {
      type: String,
      required: true,
      unique: true,
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
    storageLimit: {
      type: Number,
      default: 5 * 1024 * 1024 * 1024, // 5GB in bytes
    },
    storageType: {
      type: String,
      enum: ["free", "20gb", "30gb", "50gb", "80gb", "100gb"],
      default: "free",
    },
    avatar: {
      type: String,
      default: null,
    },
    encryptedMasterKey: {
      type: String,
      required: true, // Stored as hex
    },
    salt: {
      type: String,
      required: true, // Stored as hex (used for key derivation)
    },
    iv: {
      type: String,
      required: true, // IV used for AES-GCM, stored as hex
    },
    tag: {
      type: String,
      required: true, // Auth tag from AES-GCM, stored as hex
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
