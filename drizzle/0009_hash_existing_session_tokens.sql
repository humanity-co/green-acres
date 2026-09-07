-- Session tokens are now stored as SHA-256 digests. Existing plaintext rows
-- must be converted before the application starts using hashed lookups.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE sessions
SET token = encode(digest(token, 'sha256'), 'hex')
WHERE length(token) > 64;