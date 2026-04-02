export interface ProcessOptions {
  contrast: number;
  brightness: number;
  grayscale: boolean;
  maxWidth?: number;
  rotation?: number;
}

export async function processImage(imageUrl: string, options: ProcessOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas context not found");

      let width = img.width;
      let height = img.height;

      if (options.maxWidth && width > options.maxWidth) {
        height = (options.maxWidth / width) * height;
        width = options.maxWidth;
      }

      // Rotation handling
      if (options.rotation === 90 || options.rotation === 270) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      if (options.rotation) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((options.rotation * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
      } else {
        ctx.drawImage(img, 0, 0, width, height);
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        if (options.grayscale) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }

        // Brightness & Contrast
        for (let j = 0; j < 3; j++) {
          let val = data[i + j];
          val = (val - 128) * options.contrast + 128;
          val = val * options.brightness;
          data[i + j] = Math.min(255, Math.max(0, val));
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

export async function autoEnhance(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const url = e.target?.result as string;
        const enhanced = await processImage(url, {
          contrast: 1.4,
          brightness: 1.05,
          grayscale: false,
          maxWidth: 1600
        });
        resolve(enhanced);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okuma hatası"));
    reader.readAsDataURL(file);
  });
}
