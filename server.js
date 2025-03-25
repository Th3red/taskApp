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
const Team = require('./team');
const nodemailer = require('nodemailer');
// create a team
router.post('/teams', async (req, res) => {
  try {
    const team = new Team({
      name: req.body.name,
      description: req.body.description,
      lead: req.body.leadId
    });

    await team.save();
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ msg: 'Error creating team', error: err.message });
  }
});
// get team members
router.get('/teams/:id/members', async (req, res) => {
  const team = await Team.findById(req.params.id).populate('members', 'username email role');
  if (!team) return res.status(404).json({ msg: 'Team not found' });
  res.json(team.members);
});

// Signup route with optional team assignment
router.post('/signup', async (req, res) => {
  const { username, password, email, role, teamId } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ success: false, msg: 'Please include username, email, and password.' });
  }

  try {
    const user = new User({
      username,
      email,
      password,
      role: role || 'member',
      team: teamId || null
    });

    await user.save();

    // If a team ID is provided, add this user to the team's members list
    if (teamId) {
      await Team.findByIdAndUpdate(teamId, { $push: { members: user._id } });
    }

    res.status(201).json({ success: true, msg: 'Successfully created new user.' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' });
    } else {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
    }
  }
});

// Signin
router.post('/signin', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username }).select('username password role email team');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' });
    }

    const isMatch = await user.comparePassword(req.body.password);

    if (isMatch) {
      const tokenPayload = { id: user._id, username: user.username, role: user.role };
      const token = jwt.sign(tokenPayload, process.env.SECRET_KEY, { expiresIn: '1h' });

      res.json({
        success: true,
        token: 'JWT ' + token,
        user: {
          _id: user._id,
          username: user.username,
          role: user.role,
          email: user.email,
          team: user.team
        }
      });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
});


// Assign Task to a team member
router.post('/assign', async (req, res) => {
  const { title, description, section, assignmentNumber, assignedTo } = req.body;
  const user = await User.findById(assignedTo).populate('team');
  if (!user) return res.status(404).json({ msg: 'User not found' });

  // Prevent multiple users assigned to same section+assignmentNumber in the same team
  const conflict = await Task.findOne({
    section,
    assignmentNumber,
    team: user.team?._id
  });

  if (conflict) {
    return res.status(400).json({ msg: `Section ${section} for assignment ${assignmentNumber} is already assigned within this team.` });
  }

  const task = new Task({
    title,
    description,
    section,
    assignmentNumber,
    assignedTo: user._id,
    team: user.team?._id
  });
  await task.save();

  transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.username,
    subject: 'New Task Assigned',
    text: `Hi ${user.username}, a new task "${title}" has been assigned to you.`
  });

  res.status(201).json({ msg: 'Task assigned', task });
});

// Update Task Status
router.put('/:id/status', async (req, res) => {
  const { status, userId } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ msg: 'Task not found' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });

  if (status === 'Completed' && (!task.approvedByLead || user.role !== 'lead')) {
    return res.status(403).json({ msg: 'Only team leads can approve completed tasks.' });
  }

  task.status = status;
  await task.save();

  res.json({ msg: 'Task status updated', task });
});

// Approve Task Completion
router.put('/:id/approve', async (req, res) => {
  const { userId } = req.body;
  const user = await User.findById(userId);
  if (!user || user.role !== 'lead') return res.status(403).json({ msg: 'Only team leads can approve tasks.' });

  const task = await Task.findById(req.params.id);
  task.approvedByLead = true;
  await task.save();

  res.json({ msg: 'Task approved by lead', task });
});

// Get Task Progress for Team
router.get('/progress', async (req, res) => {
  const tasks = await Task.find().populate('assignedTo', 'username').populate('team', 'name');
  res.json(tasks);
});

app.use('/', router);
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

module.exports = app;