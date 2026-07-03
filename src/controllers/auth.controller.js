import { AuthService } from '../services/auth.service.js';

function sendAuthResponse(res, { user, tokens }, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data: {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
}

export const authController = {
  register: async (req, res) => {
    const result = await AuthService.register(req.body);
    return sendAuthResponse(res, result, 201);
  },

  login: async (req, res) => {
    const result = await AuthService.login(req.body);
    return sendAuthResponse(res, result);
  },

  refresh: async (req, res) => {
    const result = await AuthService.refresh(req.body.refreshToken);
    return sendAuthResponse(res, result);
  },

  logout: async (req, res) => {
    await AuthService.logout(req.user._id);
    return res.json({ success: true, message: 'Logged out successfully' });
  },

  me: async (req, res) => {
    const user = await AuthService.getProfile(req.user._id);
    return res.json({ success: true, data: user });
  },
};
