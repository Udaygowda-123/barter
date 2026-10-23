// Runs in every test worker before any app module loads.
process.env.MONGODB_URI = process.env.TEST_MONGO_URI!.replace('/?', '/swapd_test?');
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret-1234';
process.env.RATE_LIMIT_SCALE = '1000';
process.env.MEDIA_LOCAL_DIR = require('path').join(require('os').tmpdir(), 'swapd-test-media');
process.env.CLOUDINARY_URL = ''; process.env.BLOB_READ_WRITE_TOKEN = '';
process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.RESEND_API_KEY = '';
