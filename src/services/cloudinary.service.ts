// Lógica para subir/borrar imágenes en Cloudinary.

import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

interface ResultadoSubida {
  publicId: string;
  url: string;
}

// Sube un buffer de imagen a una carpeta específica de Cloudinary
export const subirImagen = (buffer: Buffer, carpeta = 'trinity-party'): Promise<ResultadoSubida> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: carpeta },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ publicId: result.public_id, url: result.secure_url });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Borra una imagen de Cloudinary usando su public_id
export const borrarImagen = (publicId: string) => {
  return cloudinary.uploader.destroy(publicId);
};
