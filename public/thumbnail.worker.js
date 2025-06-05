// public/thumbnail.worker.js

// Attempt to import pica - ensure pica.min.js is available in the same public directory or use a CDN
try {
  importScripts('./pica.min.js'); // Assuming pica.min.js is in /public
} catch (e) {
  console.error('Pica library not found. Ensure pica.min.js is in the public directory or use CDN.', e);
  // Fallback to CDN if local fails or not present - adjust version as needed
  try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pica/9.0.1/pica.min.js');
  } catch (cdnError) {
    console.error('Failed to load Pica from CDN:', cdnError);
    // Post error back to main thread if pica cannot be loaded
    self.postMessage({ error: 'Pica library failed to load.' });
    // Terminate worker if pica is essential and not loaded
    self.close();
  }
}


// Simplified version of generateImageThumbnail logic adapted for the worker context
async function generateThumbnailInWorker(fileBuffer, fileType, targetWidth, targetHeight) {
  if (!self.pica) {
    throw new Error('Pica library is not loaded.');
  }

  const picaInstance = self.pica();

  try {
    const blob = new Blob([fileBuffer], { type: fileType });
    const imageBitmap = await createImageBitmap(blob);

    const offscreenCanvas = new OffscreenCanvas(targetWidth, targetHeight);

    // Perform resize
    await picaInstance.resize(imageBitmap, offscreenCanvas, {
      // Pica options (optional, defaults are usually good)
      // unsharpAmount: 80,
      // unsharpRadius: 0.6,
      // unsharpThreshold: 2,
      // alpha: true, // Keep this if you need transparency
    });

    // Convert to Blob, then to data URL
    const thumbnailBlob = await offscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 }); // Or image/png

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(thumbnailBlob);
    });

  } catch (error) {
    console.error('Error generating thumbnail in worker:', error);
    throw error; // Re-throw to be caught by onmessage handler
  }
}

self.onmessage = async (event) => {
  const { fileId, fileBuffer, fileType } = event.data;

  if (!fileBuffer || !fileType || !fileId) {
    self.postMessage({ fileId, error: 'Missing fileId, fileBuffer, or fileType.' });
    return;
  }

  // Define target dimensions for the thumbnail
  const TARGET_WIDTH = 256; // Example width
  const TARGET_HEIGHT = 256; // Example height

  try {
    const thumbnailDataUrl = await generateThumbnailInWorker(fileBuffer, fileType, TARGET_WIDTH, TARGET_HEIGHT);
    self.postMessage({ fileId, thumbnailDataUrl });
  } catch (error) {
    self.postMessage({ fileId, error: `Thumbnail generation failed: ${error.message}` });
  }
};
