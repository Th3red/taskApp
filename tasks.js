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

const TaskSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  section: { type: Number},
  assignmentNumber: {type: Number},
  assignedTo: {type: Schema.Types.ObjectId, ref: 'User'},
  status: { type: String, enum: ['Backlog', 'Todo', 'Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
  approvalByLead: { type: Boolean, default: false},
  dueDate: { type: Date},
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Task', TaskSchema);