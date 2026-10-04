export const PROOF_BUCKET = 'payment-proofs';
export const MAX_PROOF_BYTES = 3 * 1024 * 1024;
export function proofType(bytes: Uint8Array) {
 if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
 if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
 if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
 throw new Error('Upload a PNG, JPEG or WebP payment screenshot.');
}
