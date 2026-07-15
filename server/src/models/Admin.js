const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "Nastro Blu Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
