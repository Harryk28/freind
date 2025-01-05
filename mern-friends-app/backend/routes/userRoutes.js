const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Sign Up
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).send('User registered successfully');
  } catch (err) {
    res.status(400).send('Error creating user');
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send('Invalid credentials');
    }
    const token = jwt.sign({ id: user._id }, 'secretKey');
    res.json({ token });
  } catch (err) {
    res.status(500).send('Error logging in');
  }
});

// Search Users
router.get('/search', authenticateToken, async (req, res) => {
  const search = req.query.search || '';
  try {
    const users = await User.find({
      username: { $regex: search, $options: 'i' },
      _id: { $ne: req.user.id },
    });
    res.json(users);
  } catch (err) {
    res.status(500).send('Error fetching users');
  }
});

// Send Friend Request
router.post('/friend-request/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(req.user.id);
    const friend = await User.findById(id);
    if (!friend || user.friends.includes(id)) {
      return res.status(400).send('Invalid operation');
    }
    if (!friend.friendRequests.includes(req.user.id)) {
      friend.friendRequests.push(req.user.id);
      await friend.save();
    }
    res.send('Friend request sent');
  } catch (err) {
    res.status(500).send('Error sending friend request');
  }
});

// Accept Friend Request
router.post('/accept-request/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(req.user.id);
    const friend = await User.findById(id);
    if (!friend || !user.friendRequests.includes(id)) {
      return res.status(400).send('Invalid operation');
    }
    user.friends.push(id);
    friend.friends.push(req.user.id);
    user.friendRequests = user.friendRequests.filter(reqId => reqId !== id);
    await user.save();
    await friend.save();
    res.send('Friend request accepted');
  } catch (err) {
    res.status(500).send('Error accepting friend request');
  }
});

// Recommendations
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friends');
    const mutuals = {};

    user.friends.forEach(friend => {
      friend.friends.forEach(mutual => {
        if (mutual._id.toString() !== req.user.id && !user.friends.includes(mutual._id)) {
          mutuals[mutual._id] = (mutuals[mutual._id] || 0) + 1;
        }
      });
    });

    const recommendations = Object.keys(mutuals).map(id => ({
      id,
      mutualCount: mutuals[id],
    })).sort((a, b) => b.mutualCount - a.mutualCount);

    res.json(recommendations);
  } catch (err) {
    res.status(500).send('Error fetching recommendations');
  }
});

module.exports = router;
