import React, { useState, useEffect, ChangeEvent } from 'react';
import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth

const ProfilePage: React.FC = () => {
  const { user, updateUserAvatar } = useAuth(); // Get user and updateUserAvatar from context
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Initialize to null

  // Effect to set initial preview URL from user data or placeholder
  useEffect(() => {
    if (!selectedFile) { // Only set from user data if no local file is selected
      setPreviewUrl(user?.avatarUrl || '/placeholder.svg');
    }
  }, [user, selectedFile]); // Rerun if user changes or selectedFile is reset

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Revoke previous blob URL if it exists and is a blob URL
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      if (updateUserAvatar) {
        updateUserAvatar(newPreviewUrl); // Update context with the new blob URL for immediate UI feedback
      }
    } else {
      // No file selected or files array is empty
      setSelectedFile(null);
      // Reset to user's avatar or placeholder if no file is chosen or selection is cleared.
      setPreviewUrl(user?.avatarUrl || '/placeholder.svg');
    }
  };

  // Cleanup effect for when the component unmounts or previewUrl changes
  // to a non-blob URL (e.g. back to placeholder)
  useEffect(() => {
    // This function will be returned by the effect, serving as the cleanup
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
        // console.log("Revoked object URL on unmount/change:", previewUrl);
      }
    };
  }, [previewUrl]); // Rerun if previewUrl changes, so cleanup targets the correct URL

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>User Profile</h2>

      {user && (
        <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <h3 style={{ marginTop: '0', marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Account Details</h3>
          <p style={{ margin: '5px 0' }}><strong>Name:</strong> {user.name || 'N/A'}</p>
          <p style={{ margin: '5px 0' }}><strong>Email:</strong> {user.email || 'N/A'}</p>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img
          src={previewUrl || '/placeholder.svg'} // Fallback just in case
          alt="Avatar Preview"
          style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            border: '2px solid #ccc',
            objectFit: 'cover',
            display: 'block',
            margin: '0 auto 20px auto'
          }}
        />
        <label htmlFor="avatarInput" style={{ display: 'inline-block', padding: '10px 15px', cursor: 'pointer', color: 'white', backgroundColor: '#007bff', borderRadius: '5px', }}>
          Change Avatar
        </label>
        <input
          type="file"
          id="avatarInput"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }} // Hide the default input, trigger via label
        />
      </div>
      {selectedFile && (
        <div style={{ marginTop: '10px', textAlign: 'center', color: '#555' }}>
          <p>Selected file: {selectedFile.name}</p>
        </div>
      )}
      {/* Placeholder for future elements like user info, save button etc. */}
      {/* <button style={{ display: 'block', width: '100%', marginTop: '30px', padding: '12px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}>
        Save Profile (Not Implemented)
      </button> */}
    </div>
  );
};
        </label>
        <input
          type="file"
          id="avatarInput"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }} // Hide the default input, trigger via label
        />
// Note: The previous JSX for avatar display and file input was integrated into the new structure above.
// The section below is effectively removed by the replacement of the return statement's content.

export default ProfilePage;
