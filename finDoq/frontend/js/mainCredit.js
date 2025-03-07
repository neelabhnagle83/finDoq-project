const db = require("../../backend/models/creditModel");  // Import the shared database connection
const path = require("path");

// Fetch the current user's credits
function getUserCredits(userId, callback) {
  db.get("SELECT credits FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      return callback({ error: "Error fetching user credits!" });
    }
    if (!user) {
      return callback({ error: "User not found!" });
    }
    callback(null, { credits: user.credits });
  });
}

// Update the user's credits
function updateUserCredits(userId, newCredits, callback) {
  db.run("UPDATE users SET credits = ? WHERE id = ?", [newCredits, userId], (err) => {
    if (err) {
      return callback({ error: "Error updating user credits!" });
    }
    callback(null, { message: "Credits updated successfully!" });
  });
}

// Function to request more credits
function requestCredits(userId, requestedCredits, callback) {
  
  if (requestedCredits < 0 || requestedCredits > 10) {
    return callback({ error: "Invalid number of credits requested. Please request between 0 and 10 credits." });
  }

  db.get("SELECT credits FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      return callback({ error: "Error fetching user credits!" });
    }
    if (!user) {
      return callback({ error: "User not found!" });
    }

    // Assuming we add credits after admin approval (this can be handled in a different way)
    const newCredits = user.credits + requestedCredits;
    updateUserCredits(userId, newCredits, callback);
  });
}

module.exports = {
  getUserCredits,
  updateUserCredits,
  requestCredits,
};
