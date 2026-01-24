
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust Proxy for secure cookies behind load balancers (Netlify/Heroku)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", process.env.API_URL ? process.env.API_URL : "'self'"],
    }
}));

// CORS: Disable credentials to prevent CSRF (Bearer token only)
app.use(cors({ 
    origin: true, 
    credentials: false 
}));

app.use(bodyParser.json({ limit: '50mb' }));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Email Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify Email Configuration on Startup
transporter.verify(function (error, success) {
    if (error) {
        console.error("Email Service Error:", error);
        console.warn("Emails (Magic Links) will NOT work until EMAIL_USER and EMAIL_PASS are set correctly in Netlify.");
    } else {
        console.log("Email Service is ready to take messages. Connected as:", process.env.EMAIL_USER);
    }
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set');
  process.exit(1);
}

// Rate Limiter for Password Reset
const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Increased limit slightly for production usability
    message: { message: 'Too many reset attempts. Please try again after an hour.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// Database Initialization
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
      CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT REFERENCES users(id),
          receiver_id TEXT REFERENCES users(id),
          content TEXT,
          timestamp TEXT,
          is_read BOOLEAN DEFAULT FALSE
      );
    `;
    try {
      await pool.query(schema);
      console.log('Database tables checked/created successfully');
      
      // Seed Admin using Environment Variables
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

      if (adminEmail && adminPassword) {
        const adminCheck = await pool.query("SELECT * FROM users WHERE email = $1", [adminEmail]);
        if (adminCheck.rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);
            const id = 'admin-seed-001';
            await pool.query(`
                INSERT INTO users (
                    id, first_name, last_name, email, phone, password, role, status, 
                    category, business_name, business_address, business_state, date_joined, expiry_date
                ) VALUES (
                    $1, 'System', 'Admin', $2, '08000000000', $3, 'ADMIN', 'Active',
                    'HONORARY', 'RAN Headquarters', 'Abuja', 'FCT', $4, $5
                )
            `, [id, adminEmail, hashedPassword, new Date().toISOString().split('T')[0], '2099-12-31']);
            console.log(`Admin account seeded: ${adminEmail}`);
        }
      }

      dbInitialized = true;
    } catch (e) {
      console.error('Error initializing database tables:', e);
    }
};

app.use(async (req, res, next) => {
    try { await initDb(); next(); } catch (e) { console.error("DB Init Middleware Error:", e); next(); }
});

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
        business_category: row.business_category,
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
        password: row.password 
    };
};

const sanitizeUserForPublic = (user) => {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        category: user.category,
        businessName: user.businessName,
        businessAddress: user.businessAddress,
        businessState: user.businessState,
        businessCity: user.businessCity,
        businessCategory: user.businessCategory,
        materialTypes: user.materialTypes,
        dateJoined: user.dateJoined,
        profileImage: user.profileImage,
        statesOfOperation: user.statesOfOperation,
        // Redacted fields
        gender: null,
        email: null,
        phone: null,
        businessCommencement: null,
        machineryDeployed: [],
        monthlyVolume: null,
        employees: null,
        areasOfInterest: [],
        relatedAssociation: null,
        relatedAssociationName: null,
        dob: null,
        expiryDate: null, 
        documents: {},
        resetToken: null,
        resetTokenExpiry: null,
        token: null
    };
};

const checkExpiry = async (user) => {
    if (user.role === 'ADMIN') return user;
    const today = new Date().toISOString().split('T')[0];
    if (user.expiryDate && user.expiryDate < today && user.status === 'Active') {
        await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['Expired', user.id]);
        user.status = 'Expired';
    }
    return user;
};

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    // Only accept Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.status(401).json({ message: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
        req.user = user; // { id, role, email }
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
};

const router = express.Router();

router.get('/', (req, res) => { res.json({ message: "RAN Portal API is running." }); });

// --- AUTH (Public) ---
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = mapUser(result.rows[0]);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    user = await checkExpiry(user);
    if (user.status === 'Pending') return res.status(403).json({ message: 'Account pending approval.' });
    if (user.status === 'Suspended') return res.status(403).json({ message: 'Account suspended.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      const { password, ...userWithoutPassword } = user;
      
      // Token is sent only in the body
      res.json({ ...userWithoutPassword, token });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

router.post('/auth/request-reset', resetLimiter, async (req, res) => {
  const { email } = req.body;
  try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      
      // Generic response for security
      if (!user) return res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
      
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 900000; // 15 minutes
      
      await pool.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3', [token, expiry, email]);
      
      const clientUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:3000';
      const resetLink = `${clientUrl}/?page=reset-password&token=${token}&email=${encodeURIComponent(email)}`;

      // Strictly attempt to send email
      try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #166534;">Password Reset Request</h2>
                <p>You requested a password reset for your RAN Portal account.</p>
                <p>Click the button below to reset your password. This link is valid for 15 minutes.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p>Or manually enter this code: <strong style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${token}</strong></p>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">If the button doesn't work, copy and paste this link:</p>
                <p style="font-size: 12px; color: #16a34a; word-break: break-all;">${resetLink}</p>
            </div>
            `
        });
        console.log(`Reset email sent successfully to ${email}`);
        res.status(200).json({ message: 'Reset link sent to your email.' });
      } catch (emailError) {
          console.error("Failed to send email via Nodemailer:", emailError);
          res.status(500).json({ message: 'Failed to send email. Please contact support.' });
      }

  } catch (err) { 
      console.error("Reset Error:", err);
      res.status(500).json({ message: 'Error processing request' }); 
  }
});

router.post('/auth/confirm-reset', async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user || user.reset_token !== token || Number(user.reset_token_expiry) < Date.now()) return res.status(400).json({ message: 'Invalid or expired code.' });
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE email = $2', [hashedPassword, email]);
      res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/auth/register', async (req, res) => {
  const data = req.body;
  try {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'User already exists' });
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29) RETURNING *
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
    
    // Welcome Email
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: data.email,
            subject: 'Welcome to RAN',
            text: `Welcome ${data.firstName}, your registration is pending approval.`
        });
    } catch(e) { console.error("Welcome Email failed", e); }

    const token = jwt.sign({ id: safeUser.id, role: safeUser.role, email: safeUser.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ ...safeUser, token });
  } catch (error) { res.status(500).json({ message: 'Registration failed. ' + error.message }); }
});

// --- CONFIGURATION ---
router.get('/config/bank-details', authenticateToken, (req, res) => {
    res.json({
        bankName: process.env.BANK_NAME || 'Access Bank PLC',
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || '0785293332',
        accountName: process.env.BANK_ACCOUNT_NAME || 'Recyclers Association of Nigeria'
    });
});

// --- USER MANAGEMENT (Protected) ---

router.get('/users', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM users';
    
    // Members only see active users in directory
    if (req.user.role !== 'ADMIN') {
        query += " WHERE status = 'Active'";
    }
    
    const result = await pool.query(query);
    const users = result.rows.map(mapUser).map(u => { 
        const { password, ...safe } = u; 
        // Security: Sanitize data for non-admins to prevent IDOR/Info Leak
        if (req.user.role !== 'ADMIN') {
            return sanitizeUserForPublic(safe);
        }
        return safe; 
    });
    res.json(users);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// GET /user?id=... (Safe for slashed IDs)
router.get('/user', authenticateToken, async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: "Missing id query parameter" });
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    let user = mapUser(result.rows[0]);
    user = await checkExpiry(user);
    
    // Privacy check for non-admins looking at other users
    if (req.user.role !== 'ADMIN' && req.user.id !== user.id) {
        if (user.status !== 'Active') {
             return res.status(403).json({ message: 'Cannot view inactive member profile.' });
        }
        // Security: Redact sensitive info
        user = sanitizeUserForPublic(user);
    }

    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Changed from /users/:id to /user/update to avoid path parameter issues with slashed IDs (e.g. RAN/ASO/...)
router.put('/user/update', authenticateToken, async (req, res) => {
  // Use query param 'id' or body 'id', but verify security
  const id = req.query.id || req.body.id;
  
  if (!id) return res.status(400).json({ message: "Missing User ID for update" });

  // Security: Only Admin or the User themselves can update
  if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ message: 'Unauthorized to update this profile' });
  }

  const data = req.body;
  try {
    // Basic fields everyone can update
    const fields = [
        'first_name', 'last_name', 'phone', 'business_name',
        'business_address', 'business_state', 'business_city', 'business_commencement',
        'business_category', 'states_of_operation', 'material_types', 'machinery_deployed',
        'monthly_volume', 'employees', 'areas_of_interest', 'related_association', 
        'related_association_name', 'dob', 'profile_image', 'documents'
    ];
    
    // Admin only fields
    if (req.user.role === 'ADMIN') {
        fields.push('category', 'status', 'expiry_date');
    }

    const mappedData = {
        first_name: data.firstName, last_name: data.lastName, phone: data.phone,
        category: data.category, status: data.status, business_name: data.businessName,
        business_address: data.businessAddress, business_state: data.businessState,
        business_city: data.businessCity, business_commencement: data.businessCommencement,
        business_category: data.businessCategory, states_of_operation: data.statesOfOperation,
        material_types: data.materialTypes, machinery_deployed: data.machineryDeployed,
        monthly_volume: data.monthlyVolume, employees: data.employees,
        areas_of_interest: data.areasOfInterest, related_association: data.relatedAssociation,
        related_association_name: data.related_associationName, dob: data.dob,
        profile_image: data.profileImage, documents: JSON.stringify(data.documents),
        expiry_date: data.expiryDate
    };
    
    let setClause = [];
    let values = [];
    let idx = 1;
    for (const field of fields) {
        if (mappedData[field] !== undefined) {
            setClause.push(`${field} = $${idx}`);
            values.push(mappedData[field]);
            idx++;
        }
    }
    if (setClause.length === 0) return res.json(data);
    values.push(id);
    const query = `UPDATE users SET ${setClause.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);
    const updatedUser = mapUser(result.rows[0]);
    const { password, ...safeUser } = updatedUser;
    res.json(safeUser);
  } catch (error) { res.status(500).json({ message: 'Update failed' }); }
});

router.post('/users/update-id', authenticateToken, requireAdmin, async (req, res) => {
    const { currentId, newId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query('SELECT id FROM users WHERE id = $1', [newId]);
        if (check.rows.length > 0) throw new Error('ID already taken');
        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [currentId]);
        if (userRes.rows.length === 0) throw new Error('User not found');
        const originalEmail = userRes.rows[0].email;
        const tempEmail = `temp_${Date.now()}_${originalEmail}`;
        await client.query('UPDATE users SET email = $1 WHERE id = $2', [tempEmail, currentId]);
        const columns = ['first_name', 'last_name', 'phone', 'password', 'role', 'status', 'category', 'gender', 'business_name', 'business_address', 'business_state', 'business_city', 'business_commencement', 'business_category', 'states_of_operation', 'material_types', 'machinery_deployed', 'monthly_volume', 'employees', 'areas_of_interest', 'related_association', 'related_association_name', 'dob', 'date_joined', 'expiry_date', 'profile_image', 'reset_token', 'reset_token_expiry', 'documents'];
        const colsStr = columns.map(c => `"${c}"`).join(', ');
        const copyQuery = `INSERT INTO users (id, email, ${colsStr}) SELECT $1, $3, ${colsStr} FROM users WHERE id = $2`;
        await client.query(copyQuery, [newId, currentId, originalEmail]);
        await client.query('UPDATE payments SET user_id = $1 WHERE user_id = $2', [newId, currentId]);
        await client.query('UPDATE messages SET sender_id = $1 WHERE sender_id = $2', [newId, currentId]);
        await client.query('UPDATE messages SET receiver_id = $1 WHERE receiver_id = $2', [newId, currentId]);
        await client.query('DELETE FROM users WHERE id = $1', [currentId]);
        await client.query('COMMIT');
        res.json({ message: 'ID Updated successfully' });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Failed: ' + e.message }); } finally { client.release(); }
});

// --- ANNOUNCEMENTS ---
router.get('/announcements', async (req, res) => {
  // Public route for now, as it serves news
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY date DESC');
    res.json(result.rows.map(row => ({ id: row.id, title: row.title, content: row.content, date: row.date, isImportant: row.is_important })));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/announcements', authenticateToken, requireAdmin, async (req, res) => {
  const { title, content, date, isImportant } = req.body;
  const id = `ann-${Date.now()}`;
  try { await pool.query('INSERT INTO announcements (id, title, content, date, is_important) VALUES ($1, $2, $3, $4, $5)', [id, title, content, date, isImportant]); res.status(201).json({ id, title, content, date, isImportant }); } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- PAYMENTS (Protected) ---
router.get('/payments', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.query;
        let query = 'SELECT * FROM payments ORDER BY date DESC';
        let params = [];
        
        // Members can only see their own payments
        if (req.user.role !== 'ADMIN') {
            query = 'SELECT * FROM payments WHERE user_id = $1 ORDER BY date DESC';
            params = [req.user.id];
        } else if (userId) {
            // Admin can filter by specific user
            query = 'SELECT * FROM payments WHERE user_id = $1 ORDER BY date DESC';
            params = [userId];
        }

        const result = await pool.query(query, params);
        res.json(result.rows.map(row => ({
            id: row.id, userId: row.user_id, amount: Number(row.amount), currency: row.currency,
            date: row.date, description: row.description, status: row.status, reference: row.reference, receipt: row.receipt
        })));
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/payments', authenticateToken, async (req, res) => {
    const data = req.body;
    
    // Security: Users can only create payments for themselves
    if (req.user.role !== 'ADMIN' && data.userId !== req.user.id) {
         return res.status(403).json({ message: 'Unauthorized payment creation.' });
    }

    const id = `pay-${Date.now()}`;
    const reference = `REF-${Math.floor(Math.random() * 1000000)}`;
    try { await pool.query('INSERT INTO payments (id, user_id, amount, currency, date, description, status, reference, receipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, data.userId, data.amount, 'NGN', data.date || new Date().toISOString().split('T')[0], data.description, data.status || 'Pending', reference, data.receipt]); res.status(201).json({ ...data, id, reference, currency: 'NGN' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/payments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { await pool.query('UPDATE payments SET status = $1 WHERE id = $2', [req.body.status, req.params.id]); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/payments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- MESSAGES (Protected) ---

// 1. Get Chat History
router.get('/messages/chat', authenticateToken, async (req, res) => {
    const { userId, otherUserId } = req.query;
    if (!userId || !otherUserId) return res.status(400).json({ message: "Missing userId or otherUserId" });
    
    // Security: Must be participant
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const query = `
            SELECT * FROM messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY timestamp ASC
        `;
        const result = await pool.query(query, [userId, otherUserId]);
        const messages = result.rows.map(row => ({
            id: row.id, senderId: row.sender_id, receiverId: row.receiver_id,
            content: row.content, timestamp: row.timestamp, isRead: row.is_read
        }));
        res.json(messages);
    } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

// 2. Get Conversations
router.get('/messages/conversations', authenticateToken, async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId" });
    
    // Security
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }
    
    try {
        const messagesQuery = `
            SELECT sender_id, receiver_id, timestamp 
            FROM messages 
            WHERE sender_id = $1 OR receiver_id = $1
            ORDER BY timestamp DESC
        `;
        const messagesResult = await pool.query(messagesQuery, [userId]);
        const rows = messagesResult.rows;

        if (rows.length === 0) return res.json([]);

        const contactIds = new Set();
        rows.forEach(msg => {
            const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
            if (otherId && otherId !== userId) contactIds.add(otherId);
        });
        
        const uniqueIds = Array.from(contactIds);
        if (uniqueIds.length === 0) return res.json([]);

        const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');
        const usersQuery = `SELECT * FROM users WHERE id IN (${placeholders})`;
        const usersResult = await pool.query(usersQuery, uniqueIds);
        
        const usersMap = new Map();
        usersResult.rows.forEach(row => {
            const mapped = mapUser(row);
            if (mapped) {
                const { password, ...safe } = mapped;
                // Security: Sanitize if not admin and not self (though self logic handled above)
                if (req.user.role !== 'ADMIN' && req.user.id !== safe.id) {
                     usersMap.set(safe.id, sanitizeUserForPublic(safe));
                } else {
                     usersMap.set(safe.id, safe);
                }
            }
        });
        
        const sortedUsers = uniqueIds.map(id => usersMap.get(id)).filter(u => u !== undefined);
        res.json(sortedUsers);
    } catch (e) {
        console.error("Conversation Fetch Error:", e);
        res.status(500).json({ message: 'Server error: ' + e.message });
    }
});

// 3. Mark Read (Uses PUT Body)
router.put('/messages/read', authenticateToken, async (req, res) => {
    const { userId, otherUserId } = req.body;
    
    // Security
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        await pool.query(
            'UPDATE messages SET is_read = TRUE WHERE sender_id = $2 AND receiver_id = $1 AND is_read = FALSE',
            [userId, otherUserId]
        );
        res.json({ message: 'Marked read' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// 4. Unread Count
router.get('/messages/unread', authenticateToken, async (req, res) => {
    const { userId } = req.query;
    
    // Security
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// 5. Send Message (Standard POST)
router.post('/messages', authenticateToken, async (req, res) => {
    const { senderId, receiverId, content } = req.body;
    
    // Security: Sender must be the logged in user
    if (req.user.role !== 'ADMIN' && req.user.id !== senderId) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    const id = `msg-${Date.now()}`;
    const timestamp = new Date().toISOString();
    try {
        await pool.query(
            'INSERT INTO messages (id, sender_id, receiver_id, content, timestamp, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, senderId, receiverId, content, timestamp, false]
        );
        res.status(201).json({ id, senderId, receiverId, content, timestamp, isRead: false });
    } catch (e) { console.error("Send Message Error:", e); res.status(500).json({ message: 'Server error' }); }
});

app.use('/.netlify/functions/api', router);
app.use('/api', router);

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
