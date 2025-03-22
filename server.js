const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
const router = express.Router();

router.post('/signup', async (req, res) => { // Use async/await
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
    }
  
    try {
      const user = new User({ // Create user directly with the data
        name: req.body.name,
        username: req.body.username,
        password: req.body.password,
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