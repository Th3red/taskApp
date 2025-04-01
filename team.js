const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if the connection fails (optional)
  }
};
connectDB();
const TeamSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  members: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['member', 'lead'], default: 'member' }
  }]
});


module.exports = mongoose.model('Team', TeamSchema);
