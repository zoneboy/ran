const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
// Allow all origins to prevent CORS issues in live deployment/testing
app.use(cors({ origin: '*' }));
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

// Router Definition
const router = express.Router();

// Health Check Route
router.get('/', (req, res) => {
    res.json({ message: "RAN Portal API is running." });
});

// --- AUTH ROUTER ---

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
    
    // --- SEND WELCOME EMAIL ---
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: data.email,
                subject: 'Registration Received - Recyclers Association of Nigeria',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2 style="color: #166534;">Welcome to the Recyclers Association of Nigeria</h2>
                        <p>Dear ${data.firstName} ${data.lastName},</p>
                        <p>Thank you for submitting your membership registration application.</p>
                        <p><strong>Your Current Status: <span style="color: #eab308;">Pending Approval</span></strong></p>
                        <p>Our administrative team has received your business details and documents. We will review your application shortly to ensure all requirements are met.</p>
                        <p>Once your documents are verified and your application is approved, you will receive another email notifying you that your account is Active, and you will be able to log in to the portal.</p>
                        <br/>
                        <p>Best Regards,<br/><strong>RAN Secretariat</strong></p>
                    </div>
                `
            };
            await transporter.sendMail(mailOptions);
            console.log(`Registration email sent to ${data.email}`);
        } catch (emailErr) {
            console.error("Failed to send registration email:", emailErr);
            // We do not fail the request here; the user is still registered.
        }
    } else {
        console.log("Email credentials missing, skipping welcome email.");
    }
    // ---------------------------

    res.status(201).json(safeUser);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed. ' + error.message });
  }
});

// --- USER MANAGEMENT ---

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    const users = result.rows.map(mapUser).map(u => {
        const { password, ...safe } = u; 
        return safe;
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    
    let user = mapUser(result.rows[0]);
    user = await checkExpiry(user);

    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  
  try {
    // Construct dynamic update query
    const fields = [
        'first_name', 'last_name', 'phone', 'category', 'status', 'business_name',
        'business_address', 'business_state', 'business_city', 'business_commencement',
        'business_category', 'states_of_operation', 'material_types', 'machinery_deployed',
        'monthly_volume', 'employees', 'areas_of_interest', 'related_association', 
        'related_association_name', 'dob', 'profile_image', 'documents', 'expiry_date'
    ];
    
    // Map camelCase body to snake_case db columns
    const mappedData = {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        category: data.category,
        status: data.status,
        business_name: data.businessName,
        business_address: data.businessAddress,
        business_state: data.businessState,
        business_city: data.businessCity,
        business_commencement: data.businessCommencement,
        business_category: data.businessCategory,
        states_of_operation: data.statesOfOperation,
        material_types: data.materialTypes,
        machinery_deployed: data.machineryDeployed,
        monthly_volume: data.monthlyVolume,
        employees: data.employees,
        areas_of_interest: data.areasOfInterest,
        related_association: data.relatedAssociation,
        related_association_name: data.relatedAssociationName,
        dob: data.dob,
        profile_image: data.profileImage,
        documents: JSON.stringify(data.documents),
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

    if (setClause.length === 0) return res.json(data); // Nothing to update

    values.push(id);
    const query = `UPDATE users SET ${setClause.join(', ')} WHERE id = $${idx} RETURNING *`;
    
    const result = await pool.query(query, values);
    const updatedUser = mapUser(result.rows[0]);
    const { password, ...safeUser } = updatedUser;
    
    res.json(safeUser);
  } catch (error) {
    console.error("Update error", error);
    res.status(500).json({ message: 'Update failed' });
  }
});

// Update User ID (Admin Feature)
router.post('/users/update-id', async (req, res) => {
    const { currentId, newId } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Check if new ID exists
        const check = await client.query('SELECT id FROM users WHERE id = $1', [newId]);
        if (check.rows.length > 0) {
            throw new Error('ID already taken');
        }
        
        // 2. Fetch original user to get email and ensure existence
        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [currentId]);
        if (userRes.rows.length === 0) throw new Error('User not found');
        const originalEmail = userRes.rows[0].email;

        // 3. Rename old user's email to temporary to free up the UNIQUE constraint
        // (Since we are essentially copying the user, the new copy needs the original email)
        const tempEmail = `temp_${Date.now()}_${originalEmail}`;
        await client.query('UPDATE users SET email = $1 WHERE id = $2', [tempEmail, currentId]);

        // 4. Copy User to New ID
        // We explicitly list columns to avoid issues with ID and ensure email is set correctly
        const columns = [
          'first_name', 'last_name', 'phone', 'password', 'role', 'status', 
          'category', 'gender', 'business_name', 'business_address', 'business_state', 
          'business_city', 'business_commencement', 'business_category', 'states_of_operation', 
          'material_types', 'machinery_deployed', 'monthly_volume', 'employees', 
          'areas_of_interest', 'related_association', 'related_association_name', 'dob', 
          'date_joined', 'expiry_date', 'profile_image', 'reset_token', 'reset_token_expiry', 
          'documents'
        ];
        
        const colsStr = columns.map(c => `"${c}"`).join(', ');
        
        // Query: INSERT INTO users (id, email, ...cols) SELECT $1, $3, ...cols FROM users WHERE id = $2
        // $1 = newId, $2 = currentId (which now has temp email), $3 = originalEmail
        const copyQuery = `
            INSERT INTO users (id, email, ${colsStr}) 
            SELECT $1, $3, ${colsStr} 
            FROM users WHERE id = $2
        `;
        
        await client.query(copyQuery, [newId, currentId, originalEmail]);

        // 5. Update foreign keys (Payments & Messages)
        await client.query('UPDATE payments SET user_id = $1 WHERE user_id = $2', [newId, currentId]);
        await client.query('UPDATE messages SET sender_id = $1 WHERE sender_id = $2', [newId, currentId]);
        await client.query('UPDATE messages SET receiver_id = $1 WHERE receiver_id = $2', [newId, currentId]);

        // 6. Delete old user (which has the temp email now)
        await client.query('DELETE FROM users WHERE id = $1', [currentId]);

        await client.query('COMMIT');
        res.json({ message: 'ID Updated successfully' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Update ID Error:", e);
        res.status(500).json({ message: 'Failed to update ID: ' + e.message });
    } finally {
        client.release();
    }
});


// --- ANNOUNCEMENTS ---

router.get('/announcements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY date DESC');
    const announcements = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        date: row.date,
        isImportant: row.is_important
    }));
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/announcements', async (req, res) => {
  const { title, content, date, isImportant } = req.body;
  const id = `ann-${Date.now()}`;
  try {
    await pool.query(
        'INSERT INTO announcements (id, title, content, date, is_important) VALUES ($1, $2, $3, $4, $5)',
        [id, title, content, date, isImportant]
    );
    res.status(201).json({ id, title, content, date, isImportant });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- PAYMENTS ---

router.get('/payments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments ORDER BY date DESC');
        const payments = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            amount: Number(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            status: row.status,
            reference: row.reference,
            receipt: row.receipt
        }));
        res.json(payments);
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/payments/:userId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY date DESC', [req.params.userId]);
        const payments = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            amount: Number(row.amount),
            currency: row.currency,
            date: row.date,
            description: row.description,
            status: row.status,
            reference: row.reference,
            receipt: row.receipt
        }));
        res.json(payments);
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/payments', async (req, res) => {
    const data = req.body;
    const id = `pay-${Date.now()}`;
    const reference = `REF-${Math.floor(Math.random() * 1000000)}`;
    
    try {
        await pool.query(
            'INSERT INTO payments (id, user_id, amount, currency, date, description, status, reference, receipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, data.userId, data.amount, 'NGN', data.date || new Date().toISOString().split('T')[0], data.description, data.status || 'Pending', reference, data.receipt]
        );
        res.status(201).json({ ...data, id, reference, currency: 'NGN' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/payments/:id', async (req, res) => {
    const { status } = req.body;
    try {
        await pool.query('UPDATE payments SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ message: 'Updated' });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/payments/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- MESSAGES ---

// Get Messages between two users
router.get('/messages/:userId/:otherUserId', async (req, res) => {
    const { userId, otherUserId } = req.params;
    try {
        const query = `
            SELECT * FROM messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY timestamp ASC
        `;
        const result = await pool.query(query, [userId, otherUserId]);
        const messages = result.rows.map(row => ({
            id: row.id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            content: row.content,
            timestamp: row.timestamp,
            isRead: row.is_read
        }));
        res.json(messages);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Conversations List - REDESIGNED: TWO-STEP FETCH (Guaranteed to work)
router.get('/messages/conversations/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`Getting conversations for user: ${userId}`);
    
    try {
        // Step 1: Find all IDs who sent me a message
        const received = await pool.query('SELECT DISTINCT sender_id FROM messages WHERE receiver_id = $1', [userId]);
        
        // Step 2: Find all IDs I sent a message to
        const sent = await pool.query('SELECT DISTINCT receiver_id FROM messages WHERE sender_id = $1', [userId]);

        // Step 3: Combine into a unique Set of User IDs
        const contactIds = new Set();
        received.rows.forEach(r => contactIds.add(r.sender_id));
        sent.rows.forEach(r => contactIds.add(r.receiver_id));
        
        // Remove self if accidentally included (shouldn't happen but safe)
        contactIds.delete(userId);

        if (contactIds.size === 0) {
            console.log("No contacts found.");
            return res.json([]);
        }

        // Step 4: Fetch user details for these IDs
        const idsArray = Array.from(contactIds);
        console.log("Fetching profiles for IDs:", idsArray);

        const usersQuery = `SELECT * FROM users WHERE id = ANY($1::text[])`;
        const usersResult = await pool.query(usersQuery, [idsArray]);
        
        const users = usersResult.rows.map(mapUser);
        console.log(`Returning ${users.length} conversations.`);
        res.json(users);

    } catch (e) {
        console.error("Conversation Fetch Error:", e);
        res.status(500).json({ message: 'Server error fetching conversations: ' + e.message });
    }
});

// Send Message
router.post('/messages', async (req, res) => {
    const { senderId, receiverId, content } = req.body;
    const id = `msg-${Date.now()}`;
    const timestamp = new Date().toISOString();

    console.log(`Sending message from ${senderId} to ${receiverId}`);

    try {
        await pool.query(
            'INSERT INTO messages (id, sender_id, receiver_id, content, timestamp, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, senderId, receiverId, content, timestamp, false]
        );
        res.status(201).json({ id, senderId, receiverId, content, timestamp, isRead: false });
    } catch (e) {
        console.error("Send Message Error:", e);
        res.status(500).json({ message: 'Server error sending message' });
    }
});

// Mark Read
router.put('/messages/read/:userId/:otherUserId', async (req, res) => {
    const { userId, otherUserId } = req.params; // userId is the READER (receiver of message)
    try {
        await pool.query(
            'UPDATE messages SET is_read = TRUE WHERE sender_id = $2 AND receiver_id = $1 AND is_read = FALSE',
            [userId, otherUserId]
        );
        res.json({ message: 'Marked read' });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Check Unread Count Total
router.get('/messages/unread/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});


// MOUNT ROUTER for Serverless and Local
// Netlify Functions often use the /.netlify/functions/api path
app.use('/.netlify/functions/api', router);
app.use('/api', router); // Local development fallback

// Export app for Netlify Functions (serverless-http)
module.exports = app;

// Local Server Start
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}