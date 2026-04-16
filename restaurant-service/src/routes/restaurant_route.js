// restaurant.route.js
// Dinh nghia route theo tung khu vuc nghiep vu de de doc va de bao tri.

const router = require('express').Router();

// ===== Middlewares =====
const rateLimit = require('../middlewares/rateLimit_middleware');
const { authOptional, requireAuth } = require('../middlewares/jwt_middleware');
const requireRole = require('../middlewares/requireRole_middleware');

// ===== Validators =====
const { validateQuery, validateBody, listQuerySchema } = require('../validators/common_validator');
const { createRestaurantSchema, updateRestaurantSchema, depositPolicySchema } = require('../validators/restaurant_validator');
const { createMenuItemSchema, updateMenuItemSchema } = require('../validators/menu_validator');
const { createReviewSchema } = require('../validators/review_validator');
const { createTableSchema, updateTableSchema } = require('../validators/table_validator');

// ===== Controllers =====
const restaurantCtl = require('../controllers/restaurant_controller');
const menuCtl = require('../controllers/menu_controller');
const reviewCtl = require('../controllers/review_controller');
const tableCtl = require('../controllers/table_controller');

// ==================================================
// PUBLIC: Search + Detail
// ==================================================
router.get('/restaurants', authOptional, rateLimit({ limit: 60, windowSec: 60, key: 'restaurants_search' }), validateQuery(listQuerySchema), restaurantCtl.list);
router.get('/restaurants/:id', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_detail' }), restaurantCtl.detail);

// ==================================================
// MENU (Mongo)
// ==================================================
router.get('/restaurants/:id/menu', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_menu' }), menuCtl.list);
router.post('/restaurants/:id/menu', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(createMenuItemSchema), menuCtl.create);
router.put('/restaurants/:id/menu/:itemId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(updateMenuItemSchema), menuCtl.update);
router.delete('/restaurants/:id/menu/:itemId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), menuCtl.remove);

// ==================================================
// REVIEWS (Mongo)
// ==================================================
router.get('/restaurants/:id/reviews', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_reviews' }), reviewCtl.list);
router.get('/restaurants/:id/reviews/summary', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_reviews_summary' }), reviewCtl.getSummary);
router.post('/restaurants/:id/reviews', authOptional, validateBody(createReviewSchema), reviewCtl.create);

// ==================================================
// TABLES (SQL)
// ==================================================
router.get('/restaurants/:id/tables', authOptional, tableCtl.list);
router.get('/restaurants/:id/tables/stats', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), tableCtl.getStats);
router.post('/restaurants/:id/tables', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(createTableSchema), tableCtl.create);
router.put('/restaurants/:id/tables/:tableId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(updateTableSchema), tableCtl.update);
router.delete('/restaurants/:id/tables/:tableId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), tableCtl.remove);

// ==================================================
// RESTAURANT CRUD (SQL)
// ==================================================
router.post('/restaurants', requireAuth, requireRole('ADMIN', 'RESTAURANT_OWNER'), validateBody(createRestaurantSchema), restaurantCtl.create);
router.put('/restaurants/:id', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(updateRestaurantSchema), restaurantCtl.update);
router.put('/restaurants/:id/deposit-policy', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(depositPolicySchema), restaurantCtl.updateDepositPolicy);
router.delete('/restaurants/:id', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), restaurantCtl.remove);

// Lấy thông tin bàn trống
router.get('/restaurants/:id/availability', restaurantCtl.availability);

// ==================================================
// STATISTICS (Global & Single) & PORTFOLIO
// ==================================================
// Lấy danh sách tất cả nhà hàng của Owner - GET /api/v1/portfolio/restaurants
router.get('/portfolio/restaurants', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), restaurantCtl.getPortfolioRestaurants);

// Lấy thông tin Portfolio tổng hợp (cho chủ chuỗi) - GET /api/v1/portfolio/summary
router.get('/portfolio/summary', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), restaurantCtl.portfolioSummary);
// Lấy thông tin Summary cho duy nhất một nhà hàng - GET /api/v1/restaurants/:id/stats-summary
router.get('/restaurants/:id/stats-summary', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), restaurantCtl.getRestaurantStatsSummary);
// Lấy thông tin doanh thu
router.get('/restaurants/:id/revenue-stats', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), restaurantCtl.revenueStats);

module.exports = router;
