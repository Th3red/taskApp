const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
const router = express.Router();
const User = require('./users');
const Task = require('./tasks');
const nodemailer = require('nodemailer');

router.post('/signup', async (req, res) => { // Use async/await
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
    }
  
    try {
      const user = new User({ // Create user directly with the data
        username: req.body.name,
        role: req.body.role,
        password: req.body.password,
        email: req.body.email   
      });
  
      await user.save(); // Use await with user.save()
  
      res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
    } catch (err) {
      if (err.code === 11000) { // Strict equality check (===)
        return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
      } else {
        console.error(err); // Log the error for debugging
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
      }
    }
  });
  
  
  router.post('/signin', async (req, res) => { // Use async/await
    try {
      const user = await User.findOne({ username: req.body.username }).select('name username password');
  
      if (!user) {
        return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
      }
  
      const isMatch = await user.comparePassword(req.body.password); // Use await
  
      if (isMatch) {
        const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
        const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
        res.json({ success: true, token: 'JWT ' + token });
      } else {
        res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
      }
    } catch (err) {
      console.error(err); // Log the error
      res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS
    }
  });

  router.post('/assign', async (req, res) => {
    const { title, description, section, assignmentNumber, assignedTo } = req.body;
  
    const user = await User.findById(assignedTo);
    if (!user) return res.status(404).json({ msg: 'User not found' });
  
    const conflict = await Task.findOne({ section, assignmentNumber, assignedTo: { $ne: user._id } });
    if (conflict) {
      return res.status(400).json({ msg: `Section ${section} for assignment ${assignmentNumber} is already assigned.` });
    }
  
    const task = new Task({ title, description, section, assignmentNumber, assignedTo: user._id });
    await task.save();
  
    // Send email notification
    transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.username,
      subject: 'New Task Assigned',
      text: `Hi ${user.name}, a new task "${title}" has been assigned to you.`
    });
  
    res.status(201).json({ msg: 'Task assigned', task });
  });
  
  // Update task status - requires approval
  router.put('/:id/status', async (req, res) => {
    const { status, userId } = req.body;
    const task = await Task.findById(req.params.id);
  
    if (!task) return res.status(404).json({ msg: 'Task not found' });
  
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
  
    if (status === 'completed' && (!task.approvedByLead || user.role !== 'lead')) {
      return res.status(403).json({ msg: 'Only team leads can approve completed tasks.' });
    }
  
    task.status = status;
    await task.save();
  
    res.json({ msg: 'Task status updated', task });
  });
  
  // Approve task completion (team lead)
  router.put('/:id/approve', async (req, res) => {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user || user.role !== 'lead') return res.status(403).json({ msg: 'Only team leads can approve tasks.' });
  
    const task = await Task.findById(req.params.id);
    task.approvedByLead = true;
    await task.save();
  
    res.json({ msg: 'Task approved by lead', task });
  });
  
  // Get task progress
  router.get('/progress', async (req, res) => {
    const tasks = await Task.find().populate('assignedTo', 'name');
    res.json(tasks);
  });

app.use('/', router);
const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only