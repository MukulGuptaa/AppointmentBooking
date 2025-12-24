const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

exports.register = async (req, res) => {
    try {
        const { username, email, password, phoneNumber } = req.body;

        // Check if user exists
        const userExists = await User.findOne({
            $or: [{ email }, { username }, { phoneNumber }]
        });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            phoneNumber
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, phoneNumber, password } = req.body;

        // Check for user by email OR phoneNumber
        let user;
        if (email) {
            user = await User.findOne({ email });
        } else if (phoneNumber) {
            user = await User.findOne({ phoneNumber });
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (await user.comparePassword(password)) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
