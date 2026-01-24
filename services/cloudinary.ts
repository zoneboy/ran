
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads a file or base64 string to Cloudinary
 * @param file File object or Base64 Data URI string
 * @param resourceType 'image' | 'raw' | 'auto'
 * @returns Promise resolving to the secure URL
 */
export const uploadToCloudinary = async (file: File | string, resourceType: 'image' | 'raw' | 'auto' = 'auto'): Promise<string> => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error("Cloudinary configuration missing. Please check .env.local");
    throw new Error("Cloudinary configuration missing");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'File upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw error;
  }
};
