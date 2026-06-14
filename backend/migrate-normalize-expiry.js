// One-off maintenance script.
//
// Normalizes every users.expiry_date to canonical YYYY-MM-DD (fixing legacy
// values such as US "3/31/2025"), then expires any member whose membership has
// lapsed. Safe to run more than once — it is idempotent.
//
// Run it against the live database (DATABASE_URL must be set, e.g. in
// backend/.env, which server.js loads via dotenv):
//
//   PowerShell:  $env:DATABASE_URL="postgres://..."; node backend/migrate-normalize-expiry.js
//   bash:        DATABASE_URL="postgres://..." node backend/migrate-normalize-expiry.js
const app = require('./server');

(async () => {
    try {
        const normalized = await app.normalizeAllExpiryDates();
        console.log(`Normalized ${normalized} expiry_date value(s) to YYYY-MM-DD.`);
        await app.syncExpiredMembers();
        console.log('Synced expired members.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
})();
