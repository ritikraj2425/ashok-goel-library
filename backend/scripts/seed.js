const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Admin = require('../src/models/Admin');
const Cabin = require('../src/models/Cabin');
const { DEFAULT_CABINS, ADMIN_ROLES } = require('../src/utils/constants');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // --- Seed Root Admin ---
    const rootUsername = process.env.ADMIN_ROOT_USERNAME || 'root';
    const rootPassword = process.env.ADMIN_ROOT_PASSWORD;

    if (!rootPassword) {
      console.error('ADMIN_ROOT_PASSWORD environment variable is required');
      process.exit(1);
    }

    const existingRoot = await Admin.findOne({ role: ADMIN_ROLES.ROOT });
    if (existingRoot) {
      console.log(`Root admin already exists: ${existingRoot.username}`);
    } else {
      const rootAdmin = new Admin({
        username: rootUsername.toLowerCase(),
        passwordHash: rootPassword, // Will be hashed by pre-save hook
        role: ADMIN_ROLES.ROOT,
        isActive: true,
      });
      await rootAdmin.save();
      console.log(`Root admin created: ${rootUsername}`);
    }

    // --- Seed Cabins ---
    for (const cabinData of DEFAULT_CABINS) {
      const existing = await Cabin.findOne({ code: cabinData.code });
      if (existing) {
        console.log(`Cabin ${cabinData.code} already exists, skipping`);
      } else {
        await Cabin.create(cabinData);
        console.log(`Cabin ${cabinData.code} created`);
      }
    }

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
