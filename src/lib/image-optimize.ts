import sharp from 'sharp'

const MAX_DIMENSION = 2560
const JPEG_QUALITY = 82
const WEBP_QUALITY = 82
const PNG_COMPRESSION_LEVEL = 8

/**
 * Begrenzt Dimensionen und komprimiert Bild-Uploads verlustarm, bevor sie gespeichert werden.
 * PDFs und andere Nicht-Bild-Dateien werden unverändert durchgereicht. HEIC wird ebenfalls
 * unverändert durchgereicht, da HEIC-Dekodierung ohne zusätzliche libheif-Codecs auf den
 * meisten Serverless-Umgebungen nicht zuverlässig verfügbar ist.
 */
export async function optimizeImageIfNeeded(
  file: File
): Promise<{ buffer: Buffer; contentType: string }> {
  const inputBuffer = Buffer.from(await file.arrayBuffer())

  if (file.type !== 'image/jpeg' && file.type !== 'image/png' && file.type !== 'image/webp') {
    return { buffer: inputBuffer, contentType: file.type }
  }

  try {
    let pipeline = sharp(inputBuffer, { failOn: 'none' }).rotate() // rotate(): EXIF-Orientierung anwenden, dann verwerfen
    const metadata = await sharp(inputBuffer).metadata()

    if ((metadata.width && metadata.width > MAX_DIMENSION) || (metadata.height && metadata.height > MAX_DIMENSION)) {
      pipeline = pipeline.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    }

    if (file.type === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    } else if (file.type === 'image/webp') {
      pipeline = pipeline.webp({ quality: WEBP_QUALITY })
    } else {
      pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL })
    }

    const optimized = await pipeline.toBuffer()
    // Nur übernehmen, wenn die Optimierung tatsächlich verkleinert hat – bei bereits
    // gut komprimierten Bildern das Original behalten statt unnötig neu zu kodieren.
    return optimized.byteLength < inputBuffer.byteLength
      ? { buffer: optimized, contentType: file.type }
      : { buffer: inputBuffer, contentType: file.type }
  } catch {
    // Ein nicht dekodierbares oder beschädigtes "Bild" wird unverändert weitergereicht;
    // die MIME-/Endungsprüfung im Upload-Handler hat bereits vorher stattgefunden.
    return { buffer: inputBuffer, contentType: file.type }
  }
}
