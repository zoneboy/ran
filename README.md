
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Recyclers Association of Nigeria Portal

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Configure Environment Variables:
   - Rename or copy `.env.local` to `.env` (optional, but recommended for local dev).
   - Set the `GEMINI_API_KEY` to your Gemini API key.
   - **Crucial:** Set `JWT_SECRET` to a long random string. The app will not start without this.
   - Set `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` for image uploads.
   - (Optional) Update `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` to seed your initial admin account.
3. Run the app:
   `npm run dev`

## Deployment (Netlify)

1. Connect this repository to Netlify.
2. In **Site Settings > Environment Variables**, add the following:
   - `JWT_SECRET` (Required)
   - `GEMINI_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_UPLOAD_PRESET`
   - `ADMIN_EMAIL`
   - `ADMIN_INITIAL_PASSWORD`
   - `DATABASE_URL` (If connecting to an external PostgreSQL database)
