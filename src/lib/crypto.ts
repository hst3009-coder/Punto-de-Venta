const webCrypto = typeof window !== "undefined" ? window.crypto : (globalThis as any).crypto;

/**
 * Hashes a PIN using native PBKDF2 with a random salt and 100,000 iterations.
 */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  const salt = webCrypto.getRandomValues(new Uint8Array(16)) as Uint8Array;
  
  const baseKey = await webCrypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await webCrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    256 // 256 bits = 32 bytes
  );
  
  const hexSalt = Array.from(salt)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
    
  const hexHash = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
    
  return { hash: hexHash, salt: hexSalt };
}

/**
 * Verifies a PIN against a saved hash and salt.
 */
export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  try {
    if (!pin || !hash || !salt) return false;
    
    const encoder = new TextEncoder();
    
    // Convert hex salt back to Uint8Array
    const saltBytes = new Uint8Array(
      salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    const baseKey = await webCrypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    
    const derivedBits = await webCrypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256"
      },
      baseKey,
      256
    );
    
    const candidateHash = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
      
    return candidateHash === hash;
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return false;
  }
}
