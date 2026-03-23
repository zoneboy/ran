// Determine API URL based on environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal 
    ? 'http://localhost:5000/api'  
    : '/.netlify/functions/api';   

export const uploadToCloudinary = async (file: File | string): Promise<string> => {
  try {
    let uploadPayload = file;

    // Convert raw files (like PDFs) to Base64
    if (file instanceof File) {
        uploadPayload = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    // SMART ROUTING: Check if user is logged in
    const isRegisteredUser = !!localStorage.getItem('ran_user');
    const endpoint = isRegisteredUser ? '/upload' : '/upload/public';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: uploadPayload }),
      credentials: 'include' 
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'File upload failed on server');
    }

    const data = await response.json();
    return data.secure_url;

  } catch (error) {
    console.error('Secure Upload Error:', error);
    throw error;
  }
};