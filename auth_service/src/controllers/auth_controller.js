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

exports.requestPasswordReset = async (req, res, next) => {
  try {
    const data = await AuthService.requestPasswordReset(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.verifyAndResetPassword = async (req, res, next) => {
  try {
    const data = await AuthService.verifyAndResetPassword(req.body);
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

exports.resetPasswordOwnerByAdmin = async (req, res, next) => {
  try {
    const data = await AuthService.resetPasswordOwnerByAdmin(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const data = await AuthService.changePassword({
      userId: req.user.id,
      ...req.body
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.submitPartnerRequest = async (req, res, next) => {
  try {
    const data = await AuthService.submitPartnerRequest(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPartnerRequests = async (req, res, next) => {
  try {
    const data = await AuthService.getPartnerRequests(req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.deletePartnerRequest = async (req, res, next) => {
  try {
    const data = await AuthService.deletePartnerRequest(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPartnerRequestById = async (req, res, next) => {
  try {
    const data = await AuthService.getPartnerRequestById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'PARTNER_REQUEST_NOT_FOUND' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.updateUserInternal = async (req, res, next) => {
  try {
    const data = await AuthService.updateUserInternal(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.deleteUserInternal = async (req, res, next) => {
  try {
    const data = await AuthService.deleteUserInternal(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.checkExists = async (req, res, next) => {
  try {
    const { email, phone } = req.query;
    const data = await AuthService.checkExists({ email, phone });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
