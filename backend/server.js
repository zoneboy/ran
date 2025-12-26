const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
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
      // Seed Admin
      const adminCheck = await pool.query("SELECT * FROM users WHERE email = 'admin@ran.org.ng'");
      if (adminCheck.rows.length === 0) {
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

const checkExpiry = async (user) => {
    if (user.role === 'ADMIN') return user;
    const today = new Date().toISOString().split('T')[0];
    if (user.expiryDate && user.expiryDate < today && user.status === 'Active') {
        await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['Expired', user.id]);
        user.status = 'Expired';
    }
    return user;
};

const router = express.Router();

router.get('/', (req, res) => { res.json({ message: "RAN Portal API is running." }); });

// --- AUTH ---
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
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/auth/request-reset', async (req, res) => {
  const { email } = req.body;
  try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 3600000;
      await pool.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3', [token, expiry, email]);
      if (!process.env.EMAIL_USER) return res.status(200).json({ message: 'Use code to reset (Dev):', debugToken: token });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset',
        text: `Your reset code is: ${token}`
      });
      res.status(200).json({ message: 'Reset code sent.' });
  } catch (err) { res.status(500).json({ message: 'Error processing request' }); }
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
    
    // Welcome Email (Optional)
    if (process.env.EMAIL_USER) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: data.email,
                subject: 'Welcome to RAN',
                text: `Welcome ${data.firstName}, your registration is pending approval.`
            });
        } catch(e) { console.error("Email failed", e); }
    }
    res.status(201).json(safeUser);
  } catch (error) { res.status(500).json({ message: 'Registration failed. ' + error.message }); }
});

// --- USER MANAGEMENT (Using Query Params to support slashed IDs) ---

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    const users = result.rows.map(mapUser).map(u => { const { password, ...safe } = u; return safe; });
    res.json(users);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// GET /user?id=... (Safe for slashed IDs)
router.get('/user', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: "Missing id query parameter" });
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    let user = mapUser(result.rows[0]);
    user = await checkExpiry(user);
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Legacy support (Warning: Breaks with slashes)
router.get('/users/:id', async (req, res) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    let user = mapUser(result.rows[0]);
    user = await checkExpiry(user);
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const fields = [
        'first_name', 'last_name', 'phone', 'category', 'status', 'business_name',
        'business_address', 'business_state', 'business_city', 'business_commencement',
        'business_category', 'states_of_operation', 'material_types', 'machinery_deployed',
        'monthly_volume', 'employees', 'areas_of_interest', 'related_association', 
        'related_association_name', 'dob', 'profile_image', 'documents', 'expiry_date'
    ];
    const mappedData = {
        first_name: data.firstName, last_name: data.lastName, phone: data.phone,
        category: data.category, status: data.status, business_name: data.businessName,
        business_address: data.businessAddress, business_state: data.businessState,
        business_city: data.businessCity, business_commencement: data.businessCommencement,
        business_category: data.businessCategory, states_of_operation: data.statesOfOperation,
        material_types: data.materialTypes, machinery_deployed: data.machineryDeployed,
        monthly_volume: data.monthlyVolume, employees: data.employees,
        areas_of_interest: data.areasOfInterest, related_association: data.relatedAssociation,
        related_association_name: data.relatedAssociationName, dob: data.dob,
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

router.post('/users/update-id', async (req, res) => {
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
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY date DESC');
    res.json(result.rows.map(row => ({ id: row.id, title: row.title, content: row.content, date: row.date, isImportant: row.is_important })));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});
router.post('/announcements', async (req, res) => {
  const { title, content, date, isImportant } = req.body;
  const id = `ann-${Date.now()}`;
  try { await pool.query('INSERT INTO announcements (id, title, content, date, is_important) VALUES ($1, $2, $3, $4, $5)', [id, title, content, date, isImportant]); res.status(201).json({ id, title, content, date, isImportant }); } catch (error) { res.status(500).json({ message: 'Server error' }); }
});
router.delete('/announcements/:id', async (req, res) => {
    try { await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- PAYMENTS (Unified GET) ---
router.get('/payments', async (req, res) => {
    try {
        const { userId } = req.query;
        let query = 'SELECT * FROM payments ORDER BY date DESC';
        let params = [];
        if (userId) {
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

router.post('/payments', async (req, res) => {
    const data = req.body;
    const id = `pay-${Date.now()}`;
    const reference = `REF-${Math.floor(Math.random() * 1000000)}`;
    try { await pool.query('INSERT INTO payments (id, user_id, amount, currency, date, description, status, reference, receipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, data.userId, data.amount, 'NGN', data.date || new Date().toISOString().split('T')[0], data.description, data.status || 'Pending', reference, data.receipt]); res.status(201).json({ ...data, id, reference, currency: 'NGN' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});
router.put('/payments/:id', async (req, res) => {
    try { await pool.query('UPDATE payments SET status = $1 WHERE id = $2', [req.body.status, req.params.id]); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});
router.delete('/payments/:id', async (req, res) => {
    try { await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// --- MESSAGES (Updated for Query Params) ---

// 1. Get Chat History
router.get('/messages/chat', async (req, res) => {
    const { userId, otherUserId } = req.query;
    if (!userId || !otherUserId) return res.status(400).json({ message: "Missing userId or otherUserId" });
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
router.get('/messages/conversations', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId" });
    
    console.log(`Getting conversations for user: ${userId}`);
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

        console.log(`Found contacts for ${userId}:`, uniqueIds);

        const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');
        const usersQuery = `SELECT * FROM users WHERE id IN (${placeholders})`;
        const usersResult = await pool.query(usersQuery, uniqueIds);
        
        const usersMap = new Map();
        usersResult.rows.forEach(row => {
            const mapped = mapUser(row);
            if (mapped) {
                const { password, ...safe } = mapped;
                usersMap.set(safe.id, safe);
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
router.put('/messages/read', async (req, res) => {
    const { userId, otherUserId } = req.body;
    try {
        await pool.query(
            'UPDATE messages SET is_read = TRUE WHERE sender_id = $2 AND receiver_id = $1 AND is_read = FALSE',
            [userId, otherUserId]
        );
        res.json({ message: 'Marked read' });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// 4. Unread Count
router.get('/messages/unread', async (req, res) => {
    const { userId } = req.query;
    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// 5. Send Message (Standard POST)
router.post('/messages', async (req, res) => {
    const { senderId, receiverId, content } = req.body;
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