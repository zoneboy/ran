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
const cookieParser = require('cookie-parser');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();


// Configure Cloudinary using the Netlify Environment Variables
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Trust Proxy for secure cookies behind load balancers (Netlify/Heroku)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'none'"], // API shouldn't load anything by default
        scriptSrc: ["'none'"],  // API shouldn't execute scripts
        styleSrc: ["'none'"],   // API has no styles
        imgSrc: ["'none'"],     // API renders no images
        connectSrc: ["'self'"], 
        frameAncestors: ["'none'"], // Prevents Clickjacking
        formAction: ["'none'"]
    }
}));
app.use(cookieParser());

// --- STRICT CORS CONFIGURATION ---
const allowedOrigins = [
    'http://localhost:3000',         // Local Vite development
    'https://ranified.netlify.app'   // Production Netlify app
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g., Postman, curl, or server-to-server)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            const msg = `CORS Policy Violation: The origin ${origin} is not allowed to access this API.`;
            return callback(new Error(msg), false);
        }
    },
    credentials: true // Still required so your JWT cookies work
}));

app.use(bodyParser.json({ limit: '50mb' }));

// Database Connection - SERVERLESS OPTIMIZATION
// Database Connection - SERVERLESS OPTIMIZATION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 1, // Keep this at 1: Each serverless container gets exactly 1 connection
  idleTimeoutMillis: 1000, // Aggressively drop idle connections after 1 second (down from 3s)
  connectionTimeoutMillis: 5000, // Fail fast if the DB is unreachable
  allowExitOnIdle: true, // CRITICAL: Allows the Node.js event loop to clear so the Lambda can freeze gracefully
});

// --- SMART QUERY WRAPPER WITH RETRY LOGIC ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const query = async (text, params) => {
  let retries = 3;
  while (retries > 0) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      // Error codes: 53300 (too_many_connections), 57P03 (cannot_connect_now), or timeouts
      if (['53300', '57P03', '08006', '08001', 'ECONNREFUSED', 'ETIMEDOUT'].includes(err.code) || err.message.includes('timeout')) {
        retries--;
        if (retries === 0) throw err; 
        const delay = 200 + Math.random() * 500;
        await sleep(delay);
        continue;
      }
      throw err; 
    }
  }
};

// Email Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify Email Configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error("Email Service Error:", error);
    } else {
        console.log("Email Service is ready.");
    }
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set');
  process.exit(1);
}

// Rate Limiter
const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, 
    message: { message: 'Too many reset attempts. Please try again after an hour.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// Rate Limiter for Public Uploads (Registration)
const publicUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Max 10 uploads per IP per hour to prevent spam
    message: { message: 'Upload limit reached. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Database Initialization
let dbInitialized = false;
const initDb = async () => {
    if (dbInitialized) return;
    
    let client;
    try {
       let retries = 3;
       while(retries > 0) {
           try {
               client = await pool.connect();
               break;
           } catch(e) {
               retries--;
               if(retries === 0) throw e;
               await sleep(500);
           }
       }
    } catch (e) {
        console.error("Could not acquire client for DB Init (Skipping):", e.message);
        return; 
    }
    
    try {
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
          documents JSONB,
          token_version INTEGER DEFAULT 0,
          mfa_secret TEXT,
          mfa_enabled BOOLEAN DEFAULT FALSE
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
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            month TEXT,
            year TEXT,
            material TEXT,
            weight NUMERIC,
            images TEXT[],
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS material_prices (
            id TEXT PRIMARY KEY,
            material_name TEXT UNIQUE,
            price NUMERIC DEFAULT 0,
            co2_rate NUMERIC DEFAULT 0,
            last_updated TEXT
        );
      `;
      
      await client.query(schema);
      
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE');
      await client.query('ALTER TABLE material_prices ADD COLUMN IF NOT EXISTS co2_rate NUMERIC DEFAULT 0');
      
      console.log('Database tables checked/created successfully');
      
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

      if (adminEmail && adminPassword) {
        const adminCheck = await client.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [adminEmail]);
        if (adminCheck.rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);
            const id = 'admin-seed-001';
            await client.query(`
                INSERT INTO users (
                    id, first_name, last_name, email, phone, password, role, status, 
                    category, business_name, business_address, business_state, date_joined, expiry_date, token_version
                ) VALUES (
                    $1, 'System', 'Admin', $2, '08000000000', $3, 'ADMIN', 'Active',
                    'HONORARY', 'RAN Headquarters', 'Abuja', 'FCT', $4, $5, 0
                )
            `, [id, adminEmail.toLowerCase(), hashedPassword, new Date().toISOString().split('T')[0], '2099-12-31']);
            console.log(`Admin account seeded: ${adminEmail}`);
        }
      }

      // Synchronized with the UserDashboard collection types
// Synchronized with the UserDashboard collection types
      const requiredMaterials = [
        'PET Plastics', 'HDPE', 'PVC', 'PP', 'PS', 'Other Plastics', 
        'Paper/Cartons', 'UBC', 'Aluminium', 'Copper', 'Metals', 'Glass', 
        'E-waste', 'Nylon', 'Baled B/W Pets', 'Baled Green Pets', 
        'Baled Brown Pets', 'Caps'
      ];

      for (const material of requiredMaterials) {
        const check = await client.query('SELECT id FROM material_prices WHERE material_name = $1', [material]);
        if (check.rows.length === 0) {
            const id = `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const today = new Date().toISOString().split('T')[0];
            await client.query(
                'INSERT INTO material_prices (id, material_name, price, co2_rate, last_updated) VALUES ($1, $2, 0, 0, $3)',
                [id, material, today]
            );
        }
      }

      dbInitialized = true;
    } catch (e) {
      console.error('Error initializing database tables:', e);
    } finally {
        if(client) client.release();
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
        token_version: row.token_version,
        password: row.password,
        mfa_enabled: row.mfa_enabled,
        mfa_secret: row.mfa_secret
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
        token: null,
        mfa_secret: null
    };
};

const checkExpiry = async (user) => {
    if (user.role === 'ADMIN') return user;
    if (user.expiryDate && user.status === 'Active') {
        const expiryDate = new Date(user.expiryDate);
        const today = new Date();
        expiryDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - expiryDate.getTime();
        const daysPastExpiry = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (daysPastExpiry >= 1) {
            await query('UPDATE users SET status = $1 WHERE id = $2', ['Expired', user.id]);
            user.status = 'Expired';
        }
    }
    return user;
};

// --- AUTH MIDDLEWARE ---
// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    
    if (token == null) return res.status(401).json({ message: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
        
        try {
            const result = await query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);
            if (result.rows.length === 0) return res.status(403).json({ message: 'User not found' });
            
            // FIX: Safely handle 'null' database values by defaulting both sides to 0
            const currentVersion = result.rows[0].token_version || 0;
            const tokenVersion = decoded.token_version || 0;

            if (tokenVersion !== currentVersion) {
                res.clearCookie('token');
                return res.status(401).json({ message: 'Session expired. Please login again.' });
            }

            if (decoded.partial && !['/auth/mfa/setup', '/auth/mfa/confirm', '/auth/mfa/login', '/auth/logout'].some(p => req.url.includes(p))) {
                return res.status(403).json({ message: 'MFA verification required.' });
            }

            req.user = decoded;
            next();
        } catch (e) {
            console.error("Auth Middleware Error:", e);
            res.status(500).json({ message: 'Server error' });
        }
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden: Admin access required' });
    next();
};

const verifyOwnership = (req, res, next) => {
    const resourceUserId = req.body.userId || req.query.userId || req.body.senderId;
    if (resourceUserId && req.user.role !== 'ADMIN' && req.user.id !== resourceUserId) {
        return res.status(403).json({ message: 'Forbidden: You can only access your own resources' });
    }
    next();
};

const router = express.Router();

router.get('/', (req, res) => { res.json({ message: "RAN Portal API is running." }); });

// --- AUTH (Public) ---
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    let user = mapUser(result.rows[0]);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    user = await checkExpiry(user);
    if (user.status === 'Pending') return res.status(403).json({ message: 'Account pending approval.' });
    if (user.status === 'Suspended') return res.status(403).json({ message: 'Account suspended.' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      if (user.role === 'ADMIN') {
          const tempToken = jwt.sign({ id: user.id, role: user.role, email: user.email, token_version: user.token_version || 0, partial: true }, JWT_SECRET, { expiresIn: '15m' });
          res.cookie('token', tempToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });
          return res.json(user.mfa_enabled ? { mfaRequired: true } : { mfaSetupRequired: true });
      }
      const token = jwt.sign({ id: user.id, role: user.role, email: user.email, token_version: user.token_version || 0, partial: false }, JWT_SECRET, { expiresIn: '7d' });
      const { password, mfa_secret, ...safeUser } = user;
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json(safeUser);
    } else { res.status(401).json({ message: 'Invalid credentials' }); }
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/auth/mfa/setup', authenticateToken, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({ name: `RAN Portal (${req.user.email})` });
        QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) return res.status(500).json({ message: 'Error generating QR code' });
            res.json({ secret: secret.base32, qrCode: data_url });
        });
    } catch (e) { res.status(500).json({ message: 'MFA setup error' }); }
});

router.post('/auth/mfa/confirm', authenticateToken, async (req, res) => {
    const { token, secret } = req.body;
    try {
        if (speakeasy.totp.verify({ secret: secret, encoding: 'base32', token: token, window: 1 })) {
            await query('UPDATE users SET mfa_secret = $1, mfa_enabled = TRUE WHERE id = $2', [secret, req.user.id]);
            const fullToken = jwt.sign({ id: req.user.id, role: req.user.role, email: req.user.email, token_version: req.user.token_version, partial: false }, JWT_SECRET, { expiresIn: '7d' });
            res.cookie('token', fullToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
            const userRes = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            const { password, mfa_secret, ...safeUser } = mapUser(userRes.rows[0]);
            res.json(safeUser);
        } else { res.status(400).json({ message: 'Invalid code. Please try again.' }); }
    } catch(e) { res.status(500).json({ message: 'Verification error' }); }
});

router.post('/auth/mfa/login', authenticateToken, async (req, res) => {
    const { token } = req.body;
    try {
        const userRes = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = mapUser(userRes.rows[0]);
        if (!user.mfa_secret) return res.status(500).json({ message: 'MFA is enabled but secret is missing.' });
        if (speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: token, window: 1 })) {
             const fullToken = jwt.sign({ id: user.id, role: user.role, email: user.email, token_version: user.token_version, partial: false }, JWT_SECRET, { expiresIn: '7d' });
            res.cookie('token', fullToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
            const { password, mfa_secret, ...safeUser } = user;
            res.json(safeUser);
        } else { res.status(400).json({ message: 'Invalid code. Please try again.' }); }
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

router.post('/auth/request-reset', resetLimiter, async (req, res) => {
  const { email } = req.body;
  try {
      const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      const user = result.rows[0];
      if (!user) return res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 900000;
      await query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE LOWER(email) = LOWER($3)', [code, expiry, email]);
      try {
        await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: 'Password Reset Code - RAN Portal', html: `<p>Your reset code: <b>${code}</b></p>` });
        res.status(200).json({ message: 'Reset code sent to your email.' });
      } catch (emailError) { res.status(500).json({ message: 'Failed to send email. Please contact support.' }); }
  } catch (err) { res.status(500).json({ message: 'Error processing request' }); }
});

router.post('/auth/confirm-reset', async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
      const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      const user = result.rows[0];
      if (!user || user.reset_token !== token || Number(user.reset_token_expiry) < Date.now()) return res.status(400).json({ message: 'Invalid or expired code.' });
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL, token_version = COALESCE(token_version, 0) + 1 WHERE LOWER(email) = LOWER($2)', [hashedPassword, email]);
      res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/auth/register', async (req, res) => {
  const data = req.body;
  try {
    const existing = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [data.email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'User already exists' });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    const id = `user-${Date.now()}`;
    const dateJoined = new Date().toISOString().split('T')[0];
    const expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
    const q = `INSERT INTO users (id, first_name, last_name, email, phone, password, role, status, category, gender, business_name, business_address, business_state, business_city, business_commencement, business_category, states_of_operation, material_types, machinery_deployed, monthly_volume, employees, areas_of_interest, related_association, related_association_name, dob, date_joined, expiry_date, profile_image, documents, token_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, 0) RETURNING *`;
    const values = [id, data.firstName, data.lastName, data.email.toLowerCase(), data.phone, hashedPassword, 'MEMBER', 'Pending', data.category, data.gender, data.businessName, data.businessAddress, data.businessState, data.businessCity, data.businessCommencement, data.businessCategory, data.statesOfOperation, data.materialTypes, data.machineryDeployed, data.monthlyVolume, data.employees, data.areasOfInterest, data.relatedAssociation, data.relatedAssociationName, data.dob, dateJoined, expiryDate, data.profileImage, JSON.stringify(data.documents)];
    const newUser = await query(q, values);
    const mappedUser = mapUser(newUser.rows[0]);
    const { password, mfa_secret, ...safeUser } = mappedUser;
    try { await transporter.sendMail({ from: process.env.EMAIL_USER, to: data.email, subject: 'Welcome to RAN', text: `Welcome ${data.firstName}, your registration is pending approval.` }); } catch(e) {}
    const token = jwt.sign({ id: safeUser.id, role: safeUser.role, email: safeUser.email, token_version: 0, partial: false }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ ...safeUser });
  } catch (error) { res.status(500).json({ message: 'Registration failed. ' + error.message }); }
});

// --- SECURE FILE UPLOAD ROUTE ---
router.post('/upload', authenticateToken, async (req, res) => {
    try {
        const { file } = req.body;
        
        if (!file) {
            return res.status(400).json({ message: 'No file provided' });
        }

        // Upload to Cloudinary securely from the backend
        const result = await cloudinary.uploader.upload(file, {
            folder: 'ran_portal_secure', // Keeps the RAN portal uploads organized
            resource_type: 'auto',       // Automatically handles images or PDFs
            use_filename: false,         // Ignore original file names
            unique_filename: true        // Generate unguessable, secure URLs
        });

        res.status(200).json({ secure_url: result.secure_url });
    } catch (error) {
        console.error("Cloudinary Backend Upload Error:", error);
        res.status(500).json({ message: 'Failed to upload file to storage.' });
    }
});

// --- PUBLIC FILE UPLOAD ROUTE (FOR REGISTRATION) ---
router.post('/upload/public', publicUploadLimiter, async (req, res) => {
    try {
        const { file } = req.body;
        
        if (!file) {
            return res.status(400).json({ message: 'No file provided' });
        }

        // Upload to a specific registration folder
        const result = await cloudinary.uploader.upload(file, {
            folder: 'ran_portal_registration', 
            resource_type: 'auto',       
            use_filename: false,         
            unique_filename: true        
        });

        res.status(200).json({ secure_url: result.secure_url });
    } catch (error) {
        console.error("Cloudinary Public Upload Error:", error);
        res.status(500).json({ message: 'Failed to upload file.' });
    }
});

router.get('/config/bank-details', authenticateToken, (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ bankName: process.env.BANK_NAME || 'Access Bank PLC', accountNumber: process.env.BANK_ACCOUNT_NUMBER || '0785293332', accountName: process.env.BANK_ACCOUNT_NAME || 'Recyclers Association of Nigeria' });
});

router.get('/users', authenticateToken, async (req, res) => {
  try {
    let q = req.user.role !== 'ADMIN' ? `SELECT id, first_name, last_name, business_name, business_address, business_state, category, material_types, profile_image, date_joined, role, status FROM users WHERE status = 'Active'` : 'SELECT * FROM users';
    const result = await query(q);
    const users = result.rows.map(mapUser).map(u => { 
        if(!u) return null;
        const { password, mfa_secret, ...safe } = u; 
        return req.user.role !== 'ADMIN' ? sanitizeUserForPublic(safe) : safe; 
    }).filter(Boolean);
    res.json(users);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/user', authenticateToken, async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: "Missing id query parameter" });
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    let user = mapUser(result.rows[0]);
    user = await checkExpiry(user);
    if (req.user.role !== 'ADMIN' && req.user.id !== user.id) {
        if (user.status !== 'Active') return res.status(403).json({ message: 'Cannot view inactive member profile.' });
        user = sanitizeUserForPublic(user);
    }
    const { password, mfa_secret, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/user/update', authenticateToken, async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ message: "Missing User ID for update" });
  if (req.user.role !== 'ADMIN' && req.user.id !== id) return res.status(403).json({ message: 'Unauthorized to update this profile' });
  const data = req.body;
  try {
    const fields = [ 'first_name', 'last_name', 'phone', 'business_name', 'business_address', 'business_state', 'business_city', 'business_commencement', 'business_category', 'states_of_operation', 'material_types', 'machinery_deployed', 'monthly_volume', 'employees', 'areas_of_interest', 'related_association', 'related_association_name', 'dob', 'profile_image', 'documents' ];
    if (req.user.role === 'ADMIN') { fields.push('category', 'status', 'expiry_date'); }
    const mappedData = { first_name: data.firstName, last_name: data.lastName, phone: data.phone, category: data.category, status: data.status, business_name: data.businessName, business_address: data.businessAddress, business_state: data.businessState, business_city: data.businessCity, business_commencement: data.businessCommencement, business_category: data.businessCategory, states_of_operation: data.statesOfOperation, material_types: data.materialTypes, machinery_deployed: data.machineryDeployed, monthly_volume: data.monthlyVolume, employees: data.employees, areas_of_interest: data.areasOfInterest, related_association: data.relatedAssociation, related_association_name: data.related_associationName, dob: data.dob, profile_image: data.profileImage, documents: JSON.stringify(data.documents), expiry_date: data.expiryDate };
    let setClause = []; let values = []; let idx = 1;
    for (const field of fields) { if (mappedData[field] !== undefined) { setClause.push(`${field} = $${idx}`); values.push(mappedData[field]); idx++; } }
    if (setClause.length === 0) return res.json(data);
    values.push(id);
    const q = `UPDATE users SET ${setClause.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await query(q, values);
    const updatedUser = mapUser(result.rows[0]);
    const { password, mfa_secret, ...safeUser } = updatedUser;
    res.json(safeUser);
  } catch (error) { res.status(500).json({ message: 'Update failed' }); }
});

router.post('/users/update-id', authenticateToken, requireAdmin, async (req, res) => {
    const { currentId, newId } = req.body;
    let client;
    try {
        let retries = 3;
        while(retries > 0) { try { client = await pool.connect(); break; } catch(e) { retries--; if(retries === 0) throw e; await sleep(500); } }
        await client.query('BEGIN');
        const check = await client.query('SELECT id FROM users WHERE id = $1', [newId]);
        if (check.rows.length > 0) throw new Error('ID already taken');
        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [currentId]);
        if (userRes.rows.length === 0) throw new Error('User not found');
        const originalEmail = userRes.rows[0].email;
        const tempEmail = `temp_${Date.now()}_${originalEmail}`;
        await client.query('UPDATE users SET email = $1 WHERE id = $2', [tempEmail, currentId]);
        const columns = ['first_name', 'last_name', 'phone', 'password', 'role', 'status', 'category', 'gender', 'business_name', 'business_address', 'business_state', 'business_city', 'business_commencement', 'business_category', 'states_of_operation', 'material_types', 'machinery_deployed', 'monthly_volume', 'employees', 'areas_of_interest', 'related_association', 'related_association_name', 'dob', 'date_joined', 'expiry_date', 'profile_image', 'reset_token', 'reset_token_expiry', 'documents', 'token_version', 'mfa_secret', 'mfa_enabled'];
        const colsStr = columns.map(c => `"${c}"`).join(', ');
        const copyQuery = `INSERT INTO users (id, email, ${colsStr}) SELECT $1, $3, ${colsStr} FROM users WHERE id = $2`;
        await client.query(copyQuery, [newId, currentId, originalEmail]);
        await client.query('UPDATE payments SET user_id = $1 WHERE user_id = $2', [newId, currentId]);
        await client.query('UPDATE messages SET sender_id = $1 WHERE sender_id = $2', [newId, currentId]);
        await client.query('UPDATE messages SET receiver_id = $1 WHERE receiver_id = $2', [newId, currentId]);
        await client.query('DELETE FROM users WHERE id = $1', [currentId]);
        await client.query('COMMIT');
        res.json({ message: 'ID Updated successfully' });
    } catch (e) { if(client) await client.query('ROLLBACK'); res.status(500).json({ message: 'Failed: ' + e.message }); } finally { if(client) client.release(); }
});

router.get('/announcements', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    const result = await query('SELECT * FROM announcements ORDER BY date DESC');
    res.json(result.rows.map(row => ({ id: row.id, title: row.title, content: row.content, date: row.date, isImportant: row.is_important })));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/announcements', authenticateToken, requireAdmin, async (req, res) => {
  const { title, content, date, isImportant } = req.body;
  const id = `ann-${Date.now()}`;
  try { await query('INSERT INTO announcements (id, title, content, date, is_important) VALUES ($1, $2, $3, $4, $5)', [id, title, content, date, isImportant]); res.status(201).json({ id, title, content, date, isImportant }); } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { await query('DELETE FROM announcements WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/payments', authenticateToken, verifyOwnership, async (req, res) => {
    try {
        const { userId } = req.query;
        let q = 'SELECT * FROM payments ORDER BY date DESC';
        let params = [];
        if (req.user.role !== 'ADMIN') { q = 'SELECT * FROM payments WHERE user_id = $1 ORDER BY date DESC'; params = [req.user.id]; } 
        else if (userId) { q = 'SELECT * FROM payments WHERE user_id = $1 ORDER BY date DESC'; params = [userId]; }
        const result = await query(q, params);
        res.json(result.rows.map(row => ({ id: row.id, userId: row.user_id, amount: Number(row.amount), currency: row.currency, date: row.date, description: row.description, status: row.status, reference: row.reference, receipt: row.receipt })));
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/payments', authenticateToken, verifyOwnership, async (req, res) => {
    const data = req.body;
    const id = `pay-${Date.now()}`;
    const reference = `REF-${Math.floor(Math.random() * 1000000)}`;
    try { await query('INSERT INTO payments (id, user_id, amount, currency, date, description, status, reference, receipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, data.userId, data.amount, 'NGN', data.date || new Date().toISOString().split('T')[0], data.description, data.status || 'Pending', reference, data.receipt]); res.status(201).json({ ...data, id, reference, currency: 'NGN' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/payments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { await query('UPDATE payments SET status = $1 WHERE id = $2', [req.body.status, req.params.id]); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/payments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { await query('DELETE FROM payments WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/collections', authenticateToken, verifyOwnership, async (req, res) => {
    try {
        const { userId } = req.query;
        let q = `SELECT c.*, u.business_name, u.first_name, u.last_name FROM collections c JOIN users u ON c.user_id = u.id`;
        let params = [];
        if (req.user.role !== 'ADMIN') { q += ` WHERE c.user_id = $1`; params.push(req.user.id); } 
        else if (userId) { q += ` WHERE c.user_id = $1`; params.push(userId); }
        q += ` ORDER BY c.created_at DESC`;
        const result = await query(q, params);
        res.json(result.rows.map(row => ({ id: row.id, userId: row.user_id, userName: `${row.first_name} ${row.last_name}`, businessName: row.business_name, month: row.month, year: row.year, material: row.material, weight: Number(row.weight), images: row.images || [], createdAt: row.created_at })));
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/collections', authenticateToken, verifyOwnership, async (req, res) => {
    const data = req.body;
    const id = `col-${Date.now()}`;
    const createdAt = new Date().toISOString();
    try { await query('INSERT INTO collections (id, user_id, month, year, material, weight, images, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, data.userId, data.month, data.year, data.material, data.weight, data.images, createdAt]); res.status(201).json({ ...data, id, createdAt }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/messages/chat', authenticateToken, verifyOwnership, async (req, res) => {
    const { userId, otherUserId } = req.query;
    if (!userId || !otherUserId) return res.status(400).json({ message: "Missing userId or otherUserId" });
    try {
        const q = `SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp ASC`;
        const result = await query(q, [userId, otherUserId]);
        const messages = result.rows.map(row => ({ id: row.id, senderId: row.sender_id, receiverId: row.receiver_id, content: row.content, timestamp: row.timestamp, isRead: row.is_read }));
        res.json(messages);
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/messages/conversations', authenticateToken, verifyOwnership, async (req, res) => {
    const { userId } = req.query;
    try {
        const messagesQuery = `SELECT sender_id, receiver_id, timestamp FROM messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY timestamp DESC`;
        const messagesResult = await query(messagesQuery, [userId]);
        const rows = messagesResult.rows;
        if (rows.length === 0) return res.json([]);
        const contactIds = new Set();
        rows.forEach(msg => { const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id; if (otherId && otherId !== userId) contactIds.add(otherId); });
        const uniqueIds = Array.from(contactIds);
        if (uniqueIds.length === 0) return res.json([]);
        const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');
        
        const usersQuery = `SELECT id, first_name, last_name, business_name, profile_image FROM users WHERE id IN (${placeholders})`;
        const usersResult = await query(usersQuery, uniqueIds);
        
        const usersMap = new Map();
        usersResult.rows.forEach(row => {
            const mapped = mapUser(row);
            if (mapped) usersMap.set(mapped.id, mapped);
        });
        const sortedUsers = uniqueIds.map(id => usersMap.get(id)).filter(u => u !== undefined);
        res.json(sortedUsers);
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/messages/read', authenticateToken, verifyOwnership, async (req, res) => {
    const { userId, otherUserId } = req.body;
    try { await query('UPDATE messages SET is_read = TRUE WHERE sender_id = $2 AND receiver_id = $1 AND is_read = FALSE', [userId, otherUserId]); res.json({ message: 'Marked read' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/messages/unread', authenticateToken, verifyOwnership, async (req, res) => {
    const { userId } = req.query;
    try { const result = await query('SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = FALSE', [userId]); res.json({ count: parseInt(result.rows[0].count) }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/messages', authenticateToken, verifyOwnership, async (req, res) => {
    const { senderId, receiverId, content } = req.body;
    const id = `msg-${Date.now()}`;
    const timestamp = new Date().toISOString();
    try { await query('INSERT INTO messages (id, sender_id, receiver_id, content, timestamp, is_read) VALUES ($1, $2, $3, $4, $5, $6)', [id, senderId, receiverId, content, timestamp, false]); res.status(201).json({ id, senderId, receiverId, content, timestamp, isRead: false }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- PRICES & CO2e RATES ---
router.get('/prices', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
             const userRes = await query('SELECT status FROM users WHERE id = $1', [req.user.id]);
             if (!userRes.rows.length || userRes.rows[0].status !== 'Active') return res.status(403).json({ message: 'Pricelist available to Active members only.' });
        }
        res.set('Cache-Control', 'public, max-age=60');
        const result = await query('SELECT id, material_name, price, co2_rate, last_updated FROM material_prices ORDER BY material_name ASC');
        const prices = result.rows.map(row => ({ 
            id: row.id, 
            materialName: row.material_name, 
            price: Number(row.price), 
            co2Rate: Number(row.co2_rate || 0), 
            lastUpdated: row.last_updated 
        }));
        res.json(prices);
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/prices/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { price, co2Rate } = req.body;
    const { id } = req.params;
    try {
        const today = new Date().toISOString().split('T')[0];
        await query('UPDATE material_prices SET price = $1, co2_rate = $2, last_updated = $3 WHERE id = $4', [price, co2Rate, today, id]);
        res.json({ message: 'Price and CO2e rate updated successfully' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

app.use('/.netlify/functions/api', router);
app.use('/api', router);

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}