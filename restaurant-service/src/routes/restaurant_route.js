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
const { upsertMenuItemSchema } = require('../validators/menu_validator');
const { createReviewSchema } = require('../validators/review_validator');
const { createTableSchema, updateTableSchema } = require('../validators/table_validator');

// ===== Controllers =====
const restaurantCtl = require('../controllers/restaurant_controller');
const menuCtl = require('../controllers/menu_controller');
const reviewCtl = require('../controllers/review_controller');
const tableCtl = require('../controllers/table_controller');

// ==================================================
// PUBLIC: Search + Detail
// FE goi: GET /api/v1/restaurants?lat=...&lng=...&radiusKm=...&sort=distance
// ==================================================
router.get('/', authOptional, rateLimit({ limit: 60, windowSec: 60, key: 'restaurants_search' }), validateQuery(listQuerySchema), restaurantCtl.list);
router.get('/:id', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_detail' }), restaurantCtl.detail);

// ==================================================
// MENU (Mongo)
// ==================================================
router.get('/:id/menu', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_menu' }), menuCtl.list);
router.post('/:id/menu', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(upsertMenuItemSchema), menuCtl.create);
router.put('/:id/menu/:itemId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(upsertMenuItemSchema), menuCtl.update);
router.delete('/:id/menu/:itemId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), menuCtl.remove);

// ==================================================
// REVIEWS (Mongo)
// ==================================================
router.get('/:id/reviews', rateLimit({ limit: 120, windowSec: 60, key: 'restaurants_reviews' }), reviewCtl.list);
router.post('/:id/reviews', requireAuth, requireRole('CUSTOMER', 'ADMIN'), validateBody(createReviewSchema), reviewCtl.create);

// ==================================================
// TABLES (SQL)
// ==================================================
router.get('/:id/tables', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), tableCtl.list);
router.post('/:id/tables', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(createTableSchema), tableCtl.create);
router.put('/:id/tables/:tableId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(updateTableSchema), tableCtl.update);
router.delete('/:id/tables/:tableId', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), tableCtl.remove);

// ==================================================
// RESTAURANT CRUD (SQL)
// ==================================================
// Chỉ ADMIN được tạo nhà hàng (điền chính sách từ yêu cầu của owner)
router.post('/', requireAuth, requireRole('ADMIN'), validateBody(createRestaurantSchema), restaurantCtl.create);
// ADMIN + RESTAURANT_OWNER đều cập nhật được, nhưng trường nhạy cảm chỉ ADMIN thay đổi được
router.put('/:id', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(updateRestaurantSchema), restaurantCtl.update);
router.put('/:id/deposit-policy', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), validateBody(depositPolicySchema), restaurantCtl.updateDepositPolicy);
router.delete('/:id', requireAuth, requireRole('RESTAURANT_OWNER', 'ADMIN'), restaurantCtl.remove);


router.get('/:id/availability', restaurantCtl.availability);

module.exports = router;
