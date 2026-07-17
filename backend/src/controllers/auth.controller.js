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
    console.log('Login result:', result);
    return sendAuthResponse(res, result);
  },

  refresh: async (req, res) => {
    const result = await AuthService.refresh(req.body.refreshToken);
    console.log('Refresh result:', result);
    return sendAuthResponse(res, result);
  },

  logout: async (req, res) => {
    await AuthService.logout(req.user._id);
    return res.json({ success: true, message: 'Logged out successfully' });
  },

  me: async (req, res) => {
    const user = await AuthService.getProfile(req.user._id);
    console.log('User profile:', user);
    return res.json({ success: true, data: user });
  },

  // ════════════════════════════════════════════════════════════════════════
  // NEW: PASSWORD RESET ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════

  forgotPassword: async (req, res) => {
    const result = await AuthService.requestPasswordReset({
        email: req.body.email,
        clientIp: req.ip
    });

    return res.json({
        success: true,
        data: result
    });
  },

  verifyResetToken: async (req, res) => {
    const result = await AuthService.verifyResetToken(req.query.token);
    return res.json({ success: true, data: result });
  },

  resetPassword: async (req, res) => {
    const result = await AuthService.resetPassword({
      rawToken: req.body.token,
      newPassword: req.body.password,
    });
    return res.json({ success: true, message: result.message });
  },
};