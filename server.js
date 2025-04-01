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
const mongoose = require('mongoose'); // if not already imported at top

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS
  }
});

// Create a team
/*router.post('/teams', async (req, res) => {
  try {
    let { name, description, leadID, members = [] } = req.body;

    // 1. Make sure members is an array
    if (typeof members === 'string') {
      members = members.split(',').map(u => u.trim());
    }

    // 2. Lookup the lead using the **username** passed as leadID
    //const leadUser = await User.findOne({ username: leadID });
    //if (!leadUser) {
    //  return res.status(404).json({ msg: `Lead user '${leadID}' not found.` });
    //}

    //const leadObjectId = leadUser._id;

    // 3. Convert all member usernames to their ObjectIds
   // const memberDocs = await User.find({ username: { $in: members } });
   // const memberIds = memberDocs.map(user => user._id);
    const membersData = [];
    const leadUsername = leadID; // assuming `leadID` is a username now

    for (const username of members) {
      const user = await User.findOne({ username });
      if (!user) continue;
    
      const role = (username === leadUsername) ? 'lead' : 'member'; // If using username as input
      membersData.push({ user: user._id, role });
    }
    
    // 4. Make sure the lead is also included in the members list
   // if (!memberIds.some(id => id.equals(leadObjectId))) {
    //  memberIds.unshift(leadObjectId);
    //}

    // 5. Create the team
   // const team = new Team({
    //  name,
     // description,
     // lead: leadObjectId,
     // members: memberIds
    //});
    const team = new Team({
      name,
      description,
      members: membersData
    });
       
    await team.save();
    // After saving the team, assign team to each user in membersData
    for (const member of membersData) {
      await User.findByIdAndUpdate(member.user, { team: team._id });
    }

    // 6. Update lead's role to "lead" and assign them the team
    //await User.findByIdAndUpdate(leadObjectId, {
    //  role: 'lead',
    //  team: team._id
    //});

    // 7. Assign the team to all other members
   // await User.updateMany(
   //   { _id: { $in: memberIds } },
    //  { $set: { team: team._id } }
    //);

    res.status(201).json(team);
  } catch (err) {
    console.error('Error creating team:', err);
    res.status(500).json({ msg: 'Error creating team', error: err.message });
  }
}); */
// Create a team using embedded roles in TeamSchema
router.post('/teams', async (req, res) => {
  try {
    let { name, description, leadUsername, members = [] } = req.body;

    // Ensure members is an array of usernames
    if (typeof members === 'string') {
      members = members.split(',').map(u => u.trim());
    }

    // 1. Find the lead user by username (email)
    const leadUser = await User.findOne({ username: leadUsername });
    if (!leadUser) {
      return res.status(404).json({ msg: `Lead user '${leadUsername}' not found.` });
    }

    const teamMembers = [];

    // 2. Add the lead to the teamMembers array with role 'lead'
    teamMembers.push({ user: leadUser._id, role: 'lead' });

    // 3. Find and add other members with role 'member'
    for (const username of members) {
      if (username === leadUsername) continue; // Already added as lead
      const user = await User.findOne({ username });
      if (user) {
        teamMembers.push({ user: user._id, role: 'member' });
      }
    }

    // 4. Create the team
    const team = new Team({
      name,
      description,
      members: teamMembers
    });

    await team.save();

    // 5. Update all users to reference this team
    const userIds = teamMembers.map(m => m.user);
    await User.updateMany({ _id: { $in: userIds } }, { $set: { team: team._id } });

    res.status(201).json(team);
  } catch (err) {
    console.error('Error creating team:', err);
    res.status(500).json({ msg: 'Error creating team', error: err.message });
  }
});




// get team members and lead
router.get('/teams/:id/members', async (req, res) => {
  const team = await Team.findById(req.params.id)
    .populate('members', 'username email role')
    .populate('lead', 'username email role');

  if (!team) return res.status(404).json({ msg: 'Team not found' });

  res.json({
    lead: team.lead,
    members: team.members
  });
});

// get team id by user id
router.get('/teams/user/:id', async (req, res) => {
  const user = await User.findById(req.params.id).populate('team', 'name');
  if (!user) return res.status(404).json({ msg: 'User not found' });

  res.json({
    team: user.team
  });
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
    const user = await User.findOne({ email: req.body.username }).select('username password role email team');

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

//  transporter.sendMail({
//    from: process.env.EMAIL_FROM,
//    to: user.username,
//    subject: 'New Task Assigned',
//    text: `Hi ${user.username}, a new task "${title}" has been assigned to you.`
//  }); 

  res.status(201).json({ msg: 'Task assigned', task });
});

// Update Task Status
router.put('/:id/status', async (req, res) => {
  const { status, userId } = req.body;

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ msg: 'Task not found' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });

  // ✅ Remove any lead approval checks
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
// Get Task Progress for a specific team
router.get('/progress/:teamId', async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const tasks = await Task.find({ team: teamId })
      .populate('assignedTo', 'username')
      .populate('team', 'name');

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ msg: 'Failed to load team tasks' });
  }
});

app.use('/', router);
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

module.exports = app;