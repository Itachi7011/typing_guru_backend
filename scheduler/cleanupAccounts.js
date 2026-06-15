const cron = require("node-cron");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require(`../models/User/Users`);

// Run every day at 00:00 and 12:00
cron.schedule("0 0,12 * * *", async () => {
  console.log("🔄 Running account cleanup cron job...", new Date().toISOString());
  
  try {
    // Find accounts deleted more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const accountsToDelete = await User.find({
      isDeleted: true,
      deletedAt: { $lt: thirtyDaysAgo }
    });
    
    console.log(`📊 Found ${accountsToDelete.length} accounts to permanently delete`);
    
    for (const user of accountsToDelete) {
      console.log(`🗑️ Permanently deleting user: ${user.email} (deleted on ${user.deletedAt})`);
      
      // You can also archive data to another collection if needed
      // await ArchiveUser.create(user.toObject());
      
      await User.deleteOne({ _id: user._id });
    }
    
    console.log(`✅ Cleanup completed. Deleted ${accountsToDelete.length} accounts permanently.`);
  } catch (error) {
    console.error("❌ Cleanup cron job error:", error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata" // Adjust to your timezone
});

console.log("📅 Account cleanup cron job scheduled (runs at 00:00 and 12:00 daily)");