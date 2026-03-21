const AuthService = require('../services/auth_service');

exports.register = async (req, res, next) => {
  try {
    const data = await AuthService.register(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const data = await AuthService.login(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const data = await AuthService.refreshToken(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const data = await AuthService.logout(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.sendOtp = async (req, res, next) => {
  try {
    const data = await AuthService.sendOtp(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const data = await AuthService.verifyOtp(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const data = await AuthService.resetPassword(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.googleSignin = async (req, res, next) => {
  try {
    const data = await AuthService.googleSignIn(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.createRestaurantOwner = async (req, res, next) => {
  try {
    const data = await AuthService.createRestaurantOwnerByAdmin(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.forgotPasswordCustomer = async (req, res, next) => {
  try {
    const data = await AuthService.forgotPasswordCustomer(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.resetPasswordOwnerByAdmin = async (req, res, next) => {
  try {
    const data = await AuthService.resetPasswordOwnerByAdmin(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
