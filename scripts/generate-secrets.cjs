const crypto = require("crypto");

function randomHex(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex");
}

function randomBase64Url(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}

const nextAuthSecret = randomBase64Url(64);
const adminLoginKey = randomBase64Url(32);

console.log("# Generated secrets");
console.log(`NEXTAUTH_SECRET=\"${nextAuthSecret}\"`);
console.log(`ADMIN_LOGIN_KEY=\"${adminLoginKey}\"`);
console.log(`ADMIN_DEFAULT_PASSWORD=\"${randomHex(12)}\"`);
