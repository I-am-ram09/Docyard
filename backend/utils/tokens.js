// Short-lived, narrowly-scoped tokens. Each kind is signed with its OWN secret derived from JWT_SECRET,
// so a collaborator or "unlock" token can never be accepted by requireAuth (which only trusts login tokens).
const jwt = require("jsonwebtoken");

const secretFor = (kind) => `${process.env.JWT_SECRET}::${kind}`;

const sign = (kind, payload, expiresIn) => jwt.sign(payload, secretFor(kind), { expiresIn });
const verify = (kind, token) => jwt.verify(token, secretFor(kind));

module.exports = { sign, verify };
