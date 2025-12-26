const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for image uploads

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail', // Default to gmail, or configure host/port via env
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Database Initialization Logic
let dbInitialized = false;
const initDb = async () => {
    if (dbInitialized) return;
    
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'MEMBER',
        status TEXT DEFAULT 'Pending',
        category TEXT,
        gender TEXT,
        business_name TEXT,
        business_address TEXT,
        business_state TEXT,
        business_city TEXT,
        business_commencement TEXT,
        business_category TEXT,
        states_of_operation TEXT,
        material_types TEXT[],
        machinery_deployed TEXT[],
        monthly_volume TEXT,
        employees INTEGER,
        areas_of_interest TEXT[],
        related_association TEXT,
        related_association_name TEXT,
        dob TEXT,
        date_joined TEXT,
        expiry_date TEXT,
        profile_image TEXT,
        reset_token TEXT,
        reset_token_expiry BIGINT,
        documents JSONB
      );
  
      CREATE TABLE IF NOT EXISTS announcements (
          id TEXT PRIMARY KEY,
          title TEXT,
          content TEXT,
          date TEXT,
          is_important BOOLEAN
      );
  
      CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id),
          amount NUMERIC,
          currency TEXT,
          date TEXT,
          description TEXT,
          status TEXT,
          reference TEXT,
          receipt TEXT
      );
    `;
    
    try {
      await pool.query(schema);
      console.log('Database tables checked/created successfully');

      // --- SEED DEFAULT ADMIN ---
      const adminCheck = await pool.query("SELECT * FROM users WHERE email = 'admin@ran.org.ng'");
      if (adminCheck.rows.length === 0) {
          console.log('Seeding default admin user...');
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('Admin@123', salt);
          const id = 'admin-seed-001';
          
          await pool.query(`
              INSERT INTO users (
                  id, first_name, last_name, email, phone, password, role, status, 
                  category, business_name, business_address, business_state, date_joined, expiry_date
              ) VALUES (
                  $1, 'System', 'Admin', 'admin@ran.org.ng', '08000000000', $2, 'ADMIN', 'Active',
                  'HONORARY', 'RAN Headquarters', 'Abuja', 'FCT', $3, $4
              )
          `, [id, hashedPassword, new Date().toISOString().split('T')[0], '2099-12-31']);
      }
      dbInitialized = true;
    } catch (e) {
      console.error('Error initializing database tables:', e);
    }
};

// Middleware to ensure DB is initialized before handling request
app.use(async (req, res, next) => {
    try {
        await initDb();
        next();
    } catch (e) {
        console.error("DB Init Middleware Error:", e);
        next(); // Proceed even if init fails
    }
});

// Helper to convert snake_case DB columns to camelCase for frontend
const mapUser = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        status: row.status,
        category: row.category,
        gender: row.gender,
        businessName: row.business_name,
        businessAddress: row.business_address,
        businessState: row.business_state,
        businessCity: row.business_city,
        businessCommencement: row.business_commencement,
        businessCategory: row.business_category,
        statesOfOperation: row.states_of_operation,
        materialTypes: row.material_types || [],
        machineryDeployed: row.machinery_deployed || [],
        monthlyVolume: row.monthly_volume,
        employees: row.employees,
        areasOfInterest: row.areas_of_interest || [],
        relatedAssociation: row.related_association,
        relatedAssociationName: row.related_association_name,
        dob: row.dob,
        dateJoined: row.date_joined,
        expiryDate: row.expiry_date,
        profileImage: row.profile_image,
        documents: row.documents || {},
        password: row.password // internal use
    };
};

// Check Expiry Logic Middleware
const checkExpiry = async (user) => {
    if (user.role === 'ADMIN') return user;
    
    const today = new Date().toISOString().split('T')[0];
    if (user.expiryDate && user.expiryDate < today && user.status === 'Active') {
        // Update DB
        await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['Expired', user.id]);
        user.status = 'Expired';
    }
    return user;
};

// Routes via Router
const router = express.Router();

// Health Check Route
router.get('/', (req, res) => {
    res.json({ message: "RAN Portal API is running." });
});

// Login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = mapUser(result.rows[0]);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user = await checkExpiry(user);

    if (user.status === 'Pending') {
      return res.status(403).json({ message: 'Your account is currently pending approval.' });
    }
    if (user.status === 'Suspended') {
      return res.status(403).json({ message: 'Your account has been suspended.' });
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Request Password Reset
router.post('/auth/request-reset', async (req, res) => {
  const { email } = req.body;
  
  try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 3600000;

      await pool.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3', [token, expiry, email]);

      // Check if email credentials are provided. If not, return token in response (DEV MODE)
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.log("Mock Email (No Credentials):", token);
          return res.status(200).json({ 
              message: 'Email credentials not configured. Use this code to reset:', 
              debugToken: token 
          });
      }

      // Send Email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset - Recyclers Association of Nigeria',
        text: `Your password reset code is: ${token}. This code expires in 1 hour.`
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({ message: 'Reset code sent.' });
  } catch (err) {
      console.error("Reset Request Error:", err);
      // Fallback: If email fails, return error or mock token if needed, but here we error
      res.status(500).json({ message: 'Error processing reset request. ' + err.message });
  }
});

// Confirm Reset
router.post('/auth/confirm-reset', async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) return res.status(400).json({ message: 'Invalid request.' });
      if (user.reset_token !== token) return res.status(400).json({ message: 'Invalid code.' });
      if (Number(user.reset_token_expiry) < Date.now()) return res.status(400).json({ message: 'Code expired.' });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE email = $2', [hashedPassword, email]);

      res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
  }
});

// Register
router.post('/auth/register', async (req, res) => {
  const data = req.body;
  
  try {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    const id = `user-${Date.now()}`;
    const dateJoined = new Date().toISOString().split('T')[0];
    const expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

    const query = `
      INSERT INTO users (
        id, first_name, last_name, email, phone, password, role, status, 
        category, gender, business_name, business_address, business_state, business_city,
        business_commencement, business_category, states_of_operation, material_types,
        machinery_deployed, monthly_volume, employees, areas_of_interest,
        related_association, related_association_name, dob, date_joined, expiry_date,
        profile_image, documents
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, 
        $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29
      ) RETURNING *
    `;

    const values = [
        id, data.firstName, data.lastName, data.email, data.phone, hashedPassword, 'MEMBER', 'Pending',
        data.category, data.gender, data.businessName, data.businessAddress, data.businessState, data.businessCity,
        data.businessCommencement, data.businessCategory, data.statesOfOperation, data.materialTypes,
        data.machineryDeployed, data.monthlyVolume, data.employees, data.areasOfInterest,
        data.relatedAssociation, data.relatedAssociationName, data.dob, dateJoined, expiryDate,
        data.profileImage, JSON.stringify(data.documents)
    ];

    const newUser = await pool.query(query, values);
    const mappedUser = mapUser(newUser.rows[0]);
    const { password, ...safeUser } = mappedUser;
    
    res.status(201).json(safeUser);

  } catch (error) {