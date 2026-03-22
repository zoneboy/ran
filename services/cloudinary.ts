// Determine API URL based on environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal 
    ? 'http://localhost:5000/api'  
    : '/.netlify/functions/api';   

/**
 * Uploads a file or base64 string SECURELY via the Node.js backend
 * @param file File object (e.g., PDF) or Base64 Data URI string (compressed image)
 * @returns Promise resolving to the secure URL
 */
export const uploadToCloudinary = async (file: File | string): Promise<string> => {
  try {
    let uploadPayload = file;

    // If the file is a raw File object (like a PDF), convert it to Base64 first
    if (file instanceof File) {
        uploadPayload = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    // Send the base64 payload to the secure backend route
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: uploadPayload }),
      credentials: 'include' // This pushes the JWT cookie to the backend
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