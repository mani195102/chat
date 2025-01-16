const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(bodyParser.json());
const MONGO_URI = 'mongodb://localhost:27017/appchat';

// MongoDB Connection
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// User Schema for Login
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  username: String,
  content: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

// In-memory storage for socket.id and usernames
const users = {};

// Routes
// Message Routes
app.get('/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 });
  res.json(messages);
});

app.post('/messages', async (req, res) => {
  const newMessage = new Message(req.body);
  await newMessage.save();
  res.json(newMessage);
  io.emit('newMessage', newMessage); // Emit to all clients
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const user = await User.findOne({ username });

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: 'Invalid password' });
  }

  return res.status(200).json({ message: 'Login successful', username });
});

// Register Route (for new users)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();

  return res.status(201).json({ message: 'User created and logged in', username });
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
  
    // Handle user joining
    socket.on('join', (username) => {
      if (username) {
        users[socket.id] = username; // Store username with socket id
        console.log(`${username} joined with socket ID: ${socket.id}`);
        socket.emit('welcome', { message: `Welcome ${username}` });
      } else {
        console.log(`Received join event without username for socket ID: ${socket.id}`);
      }
    });
  
    // Handle message sending
    socket.on('sendMessage', async (data) => {
      const { username, content } = data;
      const newMessage = new Message({ username, content });
      await newMessage.save();
  
      // Emit to all clients, including the sender
      io.emit('newMessage', newMessage); // Emit to all clients
    });
  
    // Handle user disconnecting
    socket.on('disconnect', () => {
      const username = users[socket.id];
      if (username) {
        console.log(`${username} (${socket.id}) disconnected`);
        delete users[socket.id]; // Remove the user from the users object
      } else {
        console.log(`User with socket ID ${socket.id} disconnected without a stored username`);
      }
    });
  });
  
  

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
