import React, { useState, useEffect, ChangeEvent } from 'react';

const ProfilePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Initialize with a placeholder path. Assume placeholder.svg is in public directory.
  const [previewUrl, setPreviewUrl] = useState<string | null>('/placeholder.svg');

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
    } else {
      // No file selected or files array is empty
      setSelectedFile(null);
      // Reset to placeholder if no file is chosen or selection is cleared.
      setPreviewUrl('/placeholder.svg');
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>User Profile</h2>
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <label htmlFor="avatarInput" style={{ display: 'block', marginBottom: '10px', cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}>
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
      <div>
        <img
          src={previewUrl || '/placeholder.svg'} // Fallback just in case
          alt="Avatar Preview"
          style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            border: '2px solid #ccc',
            objectFit: 'cover',
          }}
        />
      </div>
      {selectedFile && (
        <div style={{ marginTop: '10px' }}>
          <p>Selected file: {selectedFile.name}</p>
        </div>
      )}
      {/* Placeholder for future elements like user info, save button etc. */}
      {/* <button style={{ marginTop: '20px', padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
        Save Profile (Not Implemented)
      </button> */}
    </div>
  );
};

export default ProfilePage;
