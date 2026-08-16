const mongoose = require('mongoose');

let lastDbError = null;

const connectDB = async () => {
  let uri = (process.env.MONGODB_URI || '').trim().replace(/^["']|["']$/g, '');

  if (!uri) {
    lastDbError = 'MONGODB_URI is undefined or empty in environment variables';
    console.error(`[MongoDB Error] ${lastDbError}`);
    return;
  }

  // Ensure database name is explicitly present if missing before query parameters
  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/storybook?');
  } else if (uri.includes('.mongodb.net?')) {
    uri = uri.replace('.mongodb.net?', '.mongodb.net/storybook?');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    lastDbError = null;
    console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    lastDbError = error.message;
    console.error(`[MongoDB Error] Connection failed: ${error.message}`);
    if (error.message.includes('whitelist') || error.message.includes('querySrv') || error.message.includes('ETIMEOUT')) {
      console.error('[MongoDB Tip] Make sure 0.0.0.0/0 (Access from Anywhere) is added to MongoDB Atlas Network Access.');
    }
    console.log('[MongoDB] Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('connected', () => {
  lastDbError = null;
  console.log('[Mongoose Event] Connection established');
});

mongoose.connection.on('error', (err) => {
  lastDbError = err.message;
  console.error('[Mongoose Event Error]', err.message);
});

module.exports = {
  connectDB,
  getLastDbError: () => lastDbError,
};
