const express = require('express');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors());

const { swaggerUi, specs } = require('./swagger');

// Serve Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Middleware to check for valid JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'A token is required for authentication' });

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid Token' });
    req.user = user;
    next();
  });
};

// SQLite database setup
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

// Define User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      const salt = bcrypt.genSaltSync(10);
      this.setDataValue('password', bcrypt.hashSync(value, salt));
    }
  }
});

// Add comparePassword method to User model
User.prototype.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

// JWT secret (should be in environment variables for production)
const jwtSecret = 'your_jwt_secret';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *       example:
 *         username: johndoe
 *         password: 'password123'
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       500:
 *         description: Failed to register user
 */
app.post('/register', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login a user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Successful login
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Failed to login
 */
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, jwtSecret);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * @swagger
 * /quote:
 *   get:
 *     summary: Get a random quote
 *     tags: [Quote]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A random quote
 *       500:
 *         description: Failed to fetch a quote
 */
app.get('/quote', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get('https://api.quotable.io/random');
    res.json({ quote: response.data.content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch a quote' });
  }
});

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Sync database and start server
sequelize.sync().then(() => {
  app.listen(3000, () => console.log('Server running on port 3000'));
});
