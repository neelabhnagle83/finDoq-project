const jwt = require("jsonwebtoken");
const SECRET_KEY = "finDoq@098";

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");

  // Check if the token is missing
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  // If token is present, check if it has the 'Bearer' prefix
  const tokenWithoutBearer = token.startsWith("Bearer ") ? token.slice(7) : token;

  // Verify the token
  jwt.verify(tokenWithoutBearer, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }
    req.user = user; // Attach the user object to the request
    next();
  });
};

module.exports = { authenticateToken };
