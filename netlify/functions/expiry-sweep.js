// Netlify Scheduled Function — keeps membership status accurate without
// requiring anyone to log in or an admin to open the dashboard.
//
// The schedule is configured in netlify.toml ([functions."expiry-sweep"]).
// On each run it (1) normalizes any stray date formats to YYYY-MM-DD and
// (2) flips lapsed memberships from Active to Expired, using the exact same
// logic as the login-time check in backend/server.js.
const app = require('../../backend/server');

module.exports.handler = async () => {
    try {
        const normalized = await app.normalizeAllExpiryDates();
        await app.syncExpiredMembers();
        console.log(`expiry-sweep: normalized ${normalized} date(s); synced expired members`);
        return { statusCode: 200, body: 'ok' };
    } catch (err) {
        console.error('expiry-sweep failed:', err);
        return { statusCode: 500, body: 'error' };
    }
};
