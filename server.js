require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEST_FILE = path.join(DATA_DIR, 'destinations.json');
const REV_FILE = path.join(DATA_DIR, 'reviews.json');

function readJSON(fn) {
  try { return JSON.parse(fs.readFileSync(fn)); }
  catch(e){ return []; }
}
function writeJSON(fn, data) {
  fs.writeFileSync(fn, JSON.stringify(data, null, 2));
}

// Attempt MongoDB connection; if it fails we'll fall back to file storage
let useDb = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/travel_db';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    useDb = true;
    console.log('MongoDB connected');
  })
  .catch(err => {
    useDb = false;
    console.warn('MongoDB connection failed, falling back to JSON files:', err.message);
  });

// Define Mongoose models
const userSchema = new mongoose.Schema({ username: { type: String, unique: true, required: true }, password: { type: String, required: true } }, { timestamps: true });
const reviewSchema = new mongoose.Schema({ name: String, place: String, rating: Number, comment: String, date: { type: Date, default: Date.now } });
const destSchema = new mongoose.Schema({ id: Number, name: String, description: String, image: String });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
const Destination = mongoose.models.Destination || mongoose.model('Destination', destSchema);

// GET all destinations
app.get('/api/destinations', async (req, res) => {
  if(useDb){
    try{ const d = await Destination.find().sort({ id: 1 }); return res.json(d); }
    catch(e){ console.error(e); return res.status(500).json([]); }
  }
  return res.json(readJSON(DEST_FILE));
});

// GET reviews
// GET reviews
app.get('/api/reviews', async (req, res) => {
  if(useDb){
    try{ const r = await Review.find().sort({ date: -1 }); return res.json(r); }
    catch(e){ console.error(e); return res.status(500).json([]); }
  }
  return res.json(readJSON(REV_FILE));
});

// POST a review (stores in reviews.json)
app.post('/api/reviews', async (req, res) => {
  const { name, place, rating, comment } = req.body;
  if(!name || !comment) return res.status(400).json({ message: 'Missing fields' });
  if(useDb){
    try{
      const newRev = new Review({ name, place: place||null, rating: rating||null, comment });
      await newRev.save();
      return res.json({ message: 'Review saved', review: newRev });
    }catch(e){ console.error(e); return res.status(500).json({ message: 'Could not save review' }); }
  }
  const reviews = readJSON(REV_FILE);
  const id = reviews.length ? reviews[reviews.length-1].id + 1 : 1;
  const newRev = { id, name, place: place||null, rating: rating||null, comment, date: new Date().toISOString() };
  reviews.push(newRev);
  writeJSON(REV_FILE, reviews);
  res.json({ message: 'Review saved', review: newRev });
});

// Dummy weather endpoint
app.get('/api/weather/:place', (req, res) => {
  const place = req.params.place || 'Unknown';
  res.json({
    place,
    temperature_c: 26,
    condition: 'Partly Cloudy',
    humidity: 60
  });
});

// Register user (appends to users.json)
// Register user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ message: 'Missing fields' });
  if(useDb){
    try{
      const existing = await User.findOne({ username });
      if(existing) return res.status(400).json({ message: 'Already exists' });
      const hash = await bcrypt.hash(password, 10);
      const u = new User({ username, password: hash });
      await u.save();
      return res.json({ message: 'Registered', user: { id: u._id, username: u.username }});
    }catch(e){ console.error(e); return res.status(500).json({ message: 'Server error' }); }
  }
  const users = readJSON(USERS_FILE);
  if(users.find(u => u.username === username)) return res.status(400).json({ message: 'Already exists' });
  const id = users.length ? users[users.length-1].id + 1 : 1;
  const newUser = { id, username, password };
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  res.json({ message: 'Registered', user: { id, username }});
});

// Login
// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if(useDb){
    try{
      const user = await User.findOne({ username });
      if(!user) return res.json({ success: false, message: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.password);
      if(!ok) return res.json({ success: false, message: 'Invalid credentials' });
      return res.json({ success: true, message: 'Login successful', user: { id: user._id, username: user.username }});
    }catch(e){ console.error(e); return res.status(500).json({ success: false, message: 'Server error' }); }
  }
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if(user) return res.json({ success: true, message: 'Login successful', user: { id: user.id, username: user.username }});
  return res.json({ success: false, message: 'Invalid credentials' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));



