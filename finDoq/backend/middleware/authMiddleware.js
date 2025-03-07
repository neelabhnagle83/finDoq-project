const jwt = require("jsonwebtoken");
const SECRET_KEY = "finDoq@098";

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ error: "No token provided" });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.log("Invalid token:", err.message);
            return res.status(403).json({ error: "Invalid token" });
        }

        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };
