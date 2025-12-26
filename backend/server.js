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
    await initDb();
    next();
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
      console.error(err);
      res.status(500).json({ message: 'Error sending email' });
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
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Get User
router.get('/users/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({message: 'Not found'});
        
        let user = mapUser(result.rows[0]);
        user = await checkExpiry(user);
        const { password, ...safeUser } = user;
        res.json(safeUser);
    } catch (err) {
        res.status(500).json({message: 'Error'});
    }
});

// Get All Users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        const users = await Promise.all(result.rows.map(row => checkExpiry(mapUser(row))));
        const safeUsers = users.map(u => {
            const { password, resetToken, ...safe } = u;
            return safe;
        });
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({message: 'Error fetching users'});
    }
});

// Update User
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // Construct dynamic query
    const fields = [];
    const values = [];
    let idx = 1;

    // Mapping frontend camelCase to DB snake_case
    const fieldMap = {
        firstName: 'first_name', lastName: 'last_name', phone: 'phone', 
        status: 'status', expiryDate: 'expiry_date', documents: 'documents',
        profileImage: 'profile_image', businessAddress: 'business_address',
        monthlyVolume: 'monthly_volume'
    };

    // Special case for documents: ensure it's stringified if object
    if (updates.documents && typeof updates.documents === 'object') {
        updates.documents = JSON.stringify(updates.documents);
    }

    Object.keys(updates).forEach(key => {
        if (fieldMap[key] && updates[key] !== undefined) {
            fields.push(`${fieldMap[key]} = $${idx}`);
            values.push(updates[key]);
            idx++;
        }
    });

    if (fields.length === 0) return res.json({ message: 'No valid fields to update' });

    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({message: 'User not found'});
        res.json(mapUser(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Update failed'});
    }
});

// Announcements
router.get('/announcements', async (req, res) => {
    const result = await pool.query('SELECT * FROM announcements ORDER BY date DESC');
    const mapped = result.rows.map(r => ({
        id: r.id, title: r.title, content: r.content, date: r.date, isImportant: r.is_important
    }));
    res.json(mapped);
});

router.post('/announcements', async (req, res) => {
    const { title, content, date, isImportant } = req.body;
    const id = `ann-${Date.now()}`;
    await pool.query('INSERT INTO announcements (id, title, content, date, is_important) VALUES ($1, $2, $3, $4, $5)',
        [id, title, content, date, isImportant]);
    res.json({ id, title, content, date, isImportant });
});

router.delete('/announcements/:id', async (req, res) => {
    await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Payments
router.get('/payments', async (req, res) => {
    const result = await pool.query('SELECT * FROM payments ORDER BY date DESC');
    const mapped = result.rows.map(r => ({
        id: r.id, userId: r.user_id, amount: parseFloat(r.amount), currency: r.currency,
        date: r.date, description: r.description, status: r.status, reference: r.reference, receipt: r.receipt
    }));
    res.json(mapped);
});

router.get('/payments/:userId', async (req, res) => {
    const result = await pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY date DESC', [req.params.userId]);
    const mapped = result.rows.map(r => ({
        id: r.id, userId: r.user_id, amount: parseFloat(r.amount), currency: r.currency,
        date: r.date, description: r.description, status: r.status, reference: r.reference, receipt: r.receipt
    }));
    res.json(mapped);
});

router.post('/payments', async (req, res) => {
    const p = req.body;
    const id = `pay-${Date.now()}`;
    const ref = p.reference || `REF-${Math.floor(Math.random() * 1000000)}`;
    
    await pool.query(
        'INSERT INTO payments (id, user_id, amount, currency, date, description, status, reference, receipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [id, p.userId, p.amount, 'NGN', p.date, p.description, p.status, ref, p.receipt]
    );
    res.json({ id, ...p });
});

router.put('/payments/:id', async (req, res) => {
    const { status } = req.body;
    await pool.query('UPDATE payments SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
});

router.delete('/payments/:id', async (req, res) => {
    await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Update ID route
router.post('/users/update-id', async (req, res) => {
    const { currentId, newId } = req.body;
    
    const check = await pool.query('SELECT * FROM users WHERE id = $1', [newId]);
    if (check.rows.length > 0) return res.status(400).json({message: 'ID already taken'});

    try {
        await pool.query('BEGIN');
        await pool.query('UPDATE users SET id = $1 WHERE id = $2', [newId, currentId]);
        await pool.query('UPDATE payments SET user_id = $1 WHERE user_id = $2', [newId, currentId]);
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await pool.query('ROLLBACK');
        res.status(500).json({message: 'Failed to update ID'});
    }
});

// MOUNT ROUTER
// Important: Handle both local (/api) and Netlify Function (/.netlify/functions/api) paths
app.use(['/api', '/.netlify/functions/api'], router);

// Export for Netlify
module.exports = app;

// Keep listen for local dev
if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Local Server running on port ${PORT}`);
    });
}