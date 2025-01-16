import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('username'));
  const [isRegistering, setIsRegistering] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isLoggedIn) {
      // Listen for new messages from the socket
      socket.on('newMessage', (message) => {
        // Check if the message is already in the state to prevent duplicates
        setMessages((prevMessages) => {
          if (!prevMessages.some(msg => msg._id === message._id)) {
            return [...prevMessages, message];
          }
          return prevMessages;
        });
      });
  
      // Fetch messages after login
      axios.get('http://localhost:5000/messages')
        .then(response => setMessages(response.data))
        .catch(err => console.log(err));
  
      // Emit user join event
      socket.emit('join', username);
    }
  
    return () => socket.off('newMessage');
  }, [isLoggedIn, username]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (username && content) {
      const newMessage = { username, content };

      // Add the message to the sender's state before emitting
      setMessages((prevMessages) => [...prevMessages, newMessage]);

      // Send the message to the server
      socket.emit('sendMessage', newMessage);

      // Clear the input field
      setContent('');
    }
  };

  const handleLogin = async () => {
    if (username.trim() && password.trim()) {
      try {
        const response = await axios.post('http://localhost:5000/login', { username, password });
        if (response.status === 200) {
          localStorage.setItem('username', username);
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('Login failed', err);
        alert('Login failed. Please check your credentials.');
      }
    } else {
      alert('Please enter both username and password.');
    }
  };

  const handleRegister = async () => {
    if (!username || !password) {
      alert('Both username and password are required!');
      return;
    }
  
    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
  
    try {
      const response = await axios.post('http://localhost:5000/register', { username, password });
      if (response.status === 201) {
        alert('Registration successful!');
        localStorage.setItem('username', username);
        setIsLoggedIn(true);
      }
    } catch (err) {
      alert(`Registration failed: ${err.response?.data?.message || 'An error occurred'}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    setUsername('');
    setPassword('');
    setIsLoggedIn(false);
    socket.emit('disconnect');
  };

  if (!isLoggedIn) {
    return (
      <div style={{ width:'600px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
        <h1>{isRegistering ? 'Register' : 'Login'}</h1>
        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: '10px', width: '60%', marginBottom: '10px' }}
        />
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px', width: '60%', marginBottom: '10px' }}
        />
        <button onClick={isRegistering ? handleRegister : handleLogin} style={{ padding: '10px' }}>
          {isRegistering ? 'Register' : 'Login'}
        </button>
        <button onClick={() => setIsRegistering(!isRegistering)} style={{ padding: '10px', marginTop: '10px' }}>
          {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ width:'600px', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Chat App</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Message"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ padding: '10px', marginRight: '10px' }}
        />
        <button onClick={sendMessage} style={{ padding: '10px' }}>Send</button>
        <button onClick={handleLogout} style={{ padding: '10px', marginLeft: '10px' }}>Logout</button>
      </div>
      <div ref={messagesEndRef} style={{ border: '1px solid #ddd', padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: msg.username === username ? 'flex-end' : 'flex-start',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                backgroundColor: msg.username === username ? '#DCF8C6' : '#E8E8E8',
                padding: '10px',
                borderRadius: '10px',
                maxWidth: '60%',
              }}
            >
              <strong>{msg.username}</strong>: {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
