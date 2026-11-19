process.env.NODE_ENV = 'test';
process.env.PORT = '5050';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/cricket_auction_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-minimum-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX = '1000';

// No external email service is used by API tests.
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.LOG_LEVEL = 'fatal';

// Never contact a developer/production Redis from the integration suite.
process.env.REDIS_URL = '';
process.env.TRUST_PROXY_HOPS = '0';
