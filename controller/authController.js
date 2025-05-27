import asyncHandler from '../middlewares/asyncHandler.js';
import User from '../model/UserModel.js';
import jwt from 'jsonwebtoken';





const registerUser = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

   
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

   
    const user = await User.create({ name, email, password, role });

    
    const token = generateToken(user._id, user.role, user.name, user.email);

   
    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (err) {
    
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
});




const loginUser = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    
    const isMatch = await user.matchPassword(password);
    if (isMatch) {
      
      const token = generateToken(user._id, user.role, user.name, user.email);

      
      return res.status(200).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + error.message
    });
  }
});




const logoutUser = asyncHandler(async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});


const generateToken = (id, role, name = '', email = '') => {
  return jwt.sign({
    id,
    role,
    name,
    email
  }, process.env.JWT_SECRET, {
    expiresIn: '30d', 
  });
};

export { registerUser, loginUser, logoutUser };


