const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB);
    console.log("MongoDB is connected");
    } catch (error) {
    console.error("MongoDB connection failed", error);
    process.exit(1);
    }
};
connectDB();

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['member', 'lead'],
        default: 'member'
    },
    password: {
        type: String,
        required: true
    },
    team: { type: Schema.Types.ObjectId, ref: 'Team' },
    email: {
        type: String,
        required: true
    }
    });
    UserSchema.pre('save', async function(next) {  // Use async/await for cleaner code
        const user = this;
    
        if (!user.isModified('password')) return next();
    
        try {
            const hash = await bcrypt.hash(user.password, 10); // 10 is the salt rounds (adjust as needed)
            user.password = hash;
            next();
        } catch (err) {
            return next(err);
        }
    });
    UserSchema.methods.comparePassword = async function(password) { // Use async/await
        try {
            return await bcrypt.compare(password, this.password);
        } catch (err) {
            return false; // Or handle the error as you see fit
        }
    };
module.exports = mongoose.model('User', UserSchema);