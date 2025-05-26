export function generateImageThumbnail(
  file: File,
  maxWidth: number,
  maxHeight: number,
  mimeType: string = 'image/jpeg',
  quality: number = 0.8
): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    // Ensure the file is an image
    if (!file.type.startsWith('image/')) {
      console.warn('File is not an image, skipping thumbnail generation:', file.name);
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Failed to get canvas context for thumbnail generation.');
          resolve(null); // Or reject(new Error('Failed to get context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              console.error('Canvas toBlob returned null.');
              resolve(null); // Or reject(new Error('Canvas toBlob returned null'));
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = (error) => {
        console.error('Image load error for thumbnail generation:', error);
        // If image can't be loaded, it might be corrupted or not a displayable image
        resolve(null); // Or reject(error);
      };
      
      if (event.target?.result && typeof event.target.result === 'string') {
        img.src = event.target.result;
      } else {
        console.error('FileReader did not return a valid string result for image source.');
        resolve(null); // Or reject(new Error('Invalid FileReader result'));
      }
    };
    reader.onerror = (error) => {
      console.error('FileReader error for thumbnail generation:', error);
      resolve(null); // Or reject(error);
    };

    reader.readAsDataURL(file);
  });
}
