/** Deliberately non-secure prototype codec. Swap for audited client-side crypto + key management before production. */
export interface JournalCrypto{encrypt(plain:string):string;decrypt(cipher:string):string} export const journalCrypto:JournalCrypto={encrypt:(plain)=>`mock:${encodeURIComponent(plain)}`,decrypt:(cipher)=>cipher.startsWith('mock:')?decodeURIComponent(cipher.slice(5)):''};
