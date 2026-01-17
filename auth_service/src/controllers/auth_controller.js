const AuthService = require('../services/auth_service');

exports.register = async (req, res) => {
  const data = await AuthService.register(req.body);
  res.json(data);
};

exports.login = async (req, res) => {
  const data = await AuthService.login(req.body);
  res.json(data);
};

exports.refreshToken = async (req, res) => {
  const data = await AuthService.refreshToken(req.body);
  res.json(data);
};

exports.logout = async (req, res) => {
  const data = await AuthService.logout(req.body);
  res.json(data);
};

exports.sendOtp = async (req, res) => {
  const data = await AuthService.sendOtp(req.body);
  res.json(data);
};

exports.verifyOtp = async (req, res) => {
  const data = await AuthService.verifyOtp(req.body);
  res.json(data);
};

exports.resetPassword = async (req, res) => {
  const data = await AuthService.resetPassword(req.body);
  res.json(data);
};

exports.googleSignin = async (req, res) => {
  const data = await AuthService.googleSignIn(req.body);
  res.json(data);
};
