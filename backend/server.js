const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // Requires: npm install bcryptjs

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Mock Database
let users = [
  {
    id: 'admin-1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@ran.org.ng',
    password: 'password123', // Will be hashed on startup
    role: 'ADMIN',
    status: 'Active',
    category: 'Honorary Member',
    businessName: 'RAN HQ',
    businessAddress: 'Abuja',
    businessState: 'FCT',
    statesOfOperation: 'All',
    materialTypes: [],
    machineryDeployed: [],
    monthlyVolume: '0',
    employees: 10,
    dateJoined: '2020-01-01',
    expiryDate: '2099-12-31'
  }
];

// Initialize DB with hashed passwords for existing users
(async () => {
  console.log('Initializing database...');
  for (let user of users) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  console.log('Default users secured.');
})();

let announcements = [
  {
    id: '1',
    title: 'Annual General Meeting 2024',
    content: 'The AGM is scheduled for October 15th at the Lagos Civic Center.',
    date: '2024-09-01',
    isImportant: true,
  }
];

// Validation Helper
const validateRegistration = (data) => {
  const errors = [];
  
  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) errors.push('Invalid email format');

  // Phone (Simple check for 10-15 digits)
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  if (!phoneRegex.test(data.phone)) errors.push('Invalid phone number format');

  // Password Strength
  // Min 8 chars, 1 upper, 1 lower, 1 number, 1 special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(data.password)) errors.push('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');

  // Numeric Fields
  if (isNaN(Number(data.employees)) || Number(data.employees) < 0) errors.push('Number of employees must be a valid positive number');
  
  // Clean up monthly volume to check if it contains a number
  const volumeNum = parseFloat(data.monthlyVolume);
  if (isNaN(volumeNum) || volumeNum < 0) errors.push('Monthly volume must be a valid number');

  // Required Fields (Subset)
  const required = ['firstName', 'lastName', 'businessName', 'businessAddress', 'businessCategory'];
  required.forEach(field => {
    if (!data[field] || data[field].trim() === '') errors.push(`${field} is required`);
  });

  return errors;
};

// Routes

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check Status
    if (user.status === 'Pending') {
      return res.status(403).json({ message: 'Your account is currently pending approval. Please wait for admin confirmation.' });
    }
    if (user.status === 'Suspended') {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (isMatch) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const userData = req.body;
  
  // 1. Check if user exists
  if (users.find(u => u.email === userData.email)) {
    return res.status(400).json({ message: 'User already exists' });
  }

  // 2. Validate Inputs
  const validationErrors = validateRegistration(userData);
  if (validationErrors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors: validationErrors });
  }

  try {
    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    const newUser = {
      ...userData,
      id: `user-${Date.now()}`,
      role: 'MEMBER',
      status: 'Pending',
      dateJoined: new Date().toISOString().split('T')[0],
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      password: hashedPassword
    };

    users.push(newUser);
    const { password, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Get All Users (Admin)
app.get('/api/users', (req, res) => {
  // In production, verify Admin token here
  const safeUsers = users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Update User
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const index = users.findIndex(u => u.id === id);

  if (index !== -1) {
    // Prevent password overwrite via this route for simplicity, or implement re-hashing if strictly needed
    const existingPassword = users[index].password;
    
    // If password is being updated, it should be hashed, but let's restrict it for this basic endpoint
    const { password, ...safeUpdates } = updates;

    users[index] = { ...users[index], ...safeUpdates, password: existingPassword };
    const { password: _, ...userWithoutPassword } = users[index];
    res.json(userWithoutPassword);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Get Announcements
app.get('/api/announcements', (req, res) => {
  res.json(announcements);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});