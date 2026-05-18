import fs from 'node:fs';

const files = ['src/assets/i18n/en.json', 'src/assets/i18n/uk.json'];

/** @type {Record<string, Record<string, string>>} */
const patches = {
  en: {
    'ORDER_CHECKOUT.CONFLICT_ORDER_CREATION_FAILED':
      'We could not place your order. Tap Purchase again or contact support.',
    'ORDER_CHECKOUT.LIQPAY_REDIRECT_FAILED':
      'Your order was placed, but we could not open the payment page. Try again or contact support.',
    'ORDER_CHECKOUT.LIQPAY_FOOTER':
      'After you tap Purchase, you will be redirected to LiqPay to pay securely. Please do not refresh the page during payment.',
    'ADDRESS.NP_HINT':
      'Choose your city, branch, parcel locker, or street from the Nova Poshta suggestions.',
    'ADDRESS.WAREHOUSE_REF': 'Nova Poshta branch',
    'ADDRESS.CITY_REF_HINT': 'Select a settlement from the list first.',
    'CART.ADDRESS_ID': 'Delivery address',
    'CART.ADDRESS_ID_PLACEHOLDER': 'Select a saved address',
    'CART.ADDRESS_REQUIRED': 'Choose a delivery address before checkout.',
    'CART.COUPON_APPLY_FAILED_CODE': 'Could not apply this coupon.',
    'CART.COUPON_NOT_ELIGIBLE': 'This coupon does not apply to your cart.',
    'CART.COUPON_BETTER_PROMO': 'A better promotion is already applied to your cart.',
    'ADMIN.STATS.DESCRIPTION': 'Sales and operations overview',
    'ADMIN.STATS.UTC_RANGE_HINT':
      'Reports use the calendar dates you select. Month names follow your interface language.',
    'ADMIN.STATS.PROMO_SORT_HINT':
      'The chart is sorted by promotion revenue. You can sort and search the table below separately.',
    'ADMIN.PROMOTION.PRODUCT_CONDITIONS_HINT':
      'Search products by name or pick them in the advanced section. Leave empty to apply to all matching products.',
    'ADMIN.PROMOTION.CART_CONDITIONS_HINT':
      'Set minimum cart total or quantity. You can limit products or categories by search.',
    'ADMIN.PROMOTION.PICKER_ADVANCED_TOGGLE': 'Enter product IDs manually',
    'ADMIN.PROMOTION.PICKER_ADVANCED_LABEL': 'Product IDs (comma or space separated)',
    'ADMIN.PROMOTION.PICKER_ADVANCED_APPLY': 'Apply list',
    'ADMIN.PROMOTION.ERR_PRODUCT_IDS': 'Some product IDs are invalid: {{invalid}}',
    'ADMIN.PROMOTION.ERR_CATEGORY_IDS': 'Some category IDs are invalid: {{invalid}}',
    'ADMIN.PROMOTION.ERR_CART_PRODUCT_IDS': 'Some product IDs are invalid: {{invalid}}',
    'ADMIN.PROMOTION.ERR_CART_CATEGORY_IDS': 'Some category IDs are invalid: {{invalid}}',
    'ADMIN.PROMOTION.REFERENCED_PRODUCTS_TITLE': 'Products matching promotion conditions',
    'ADMIN.CATEGORY.TRANSLATIONS_HINT':
      'The main name and description match the English version. The table shows the default name and catalog link.',
    'ADMIN.BRAND.TRANSLATIONS_HINT':
      'The main name and description match the English version. The table shows the default name and catalog link.',
    'ADMIN.PRODUCT.STOCK_ADJUST_ERROR':
      'Could not update stock. Check your permissions or try again.',
    'ADMIN.ORDERS_PAGE.ADDRESS_ID': 'Delivery address',
    'ADMIN.ORDERS_PAGE.ADDRESS_ID_HINT': 'Optional: link another saved delivery address.',
    'ADMIN.PAYMENTS_PAGE.DESCRIPTION':
      'Manage payments, refunds, and cancellations. Open details with the Details button in the table.',
    'ADMIN.PAYMENTS_PAGE.LIST_NOT_AVAILABLE':
      'The full payment list is unavailable. Enter a payment ID from an order below.',
    'ADMIN.PAYMENTS_PAGE.LIST_404_BACKEND':
      'The payment list is temporarily unavailable. Search by payment ID below.',
    'ADMIN.PAYMENTS_PAGE.PAYMENT_ID_HINT': 'Payment ID from the order confirmation',
    'ADMIN.PAYMENTS_PAGE.CANCEL_MSG':
      'Available for failed or pending payments according to store rules.',
    'AUTH.SOCIAL_LOGIN_GOOGLE_FAILED': 'Could not sign in with Google. Try again or use email.',
    'AUTH.SOCIAL_LOGIN_FACEBOOK_FAILED': 'Could not sign in with Facebook. Try again or use email.',
    'AUTH.SOCIAL_LOGIN_GOOGLE_POPUP':
      'Allow pop-ups for Google sign-in, or sign in with your email.',
    PROMOTION_SLUG_EXISTS: 'A promotion with this catalog link already exists',
    INVALID_2FA_TOKEN: 'Your sign-in session expired. Please sign in again.',
    INVALID_REFRESH_TOKEN: 'Your session expired. Please sign in again.',
    INVALID_TOTP_CODE: 'Invalid code from your authenticator app',
    TOTP_NOT_INITIALIZED: 'Set up two-factor authentication first',
    LIQPAY_HTTP_ERROR: 'Payment service is temporarily unavailable',
    FACEBOOK_TOKEN_INVALID: 'Facebook sign-in failed. Try again.',
    GOOGLE_TOKEN_INVALID: 'Google sign-in failed. Try again.',
    INVALID_LIQPAY_PAYLOAD: 'Invalid payment data',
    INVALID_LIQPAY_SIGNATURE: 'Payment verification failed',
    LIQPAY_INVALID_REFUND_PAYLOAD: 'Invalid refund data',
    LIQPAY_INVALID_RESPONSE: 'Unexpected payment response',
    LIQPAY_INVALID_SIGNATURE: 'Payment verification failed',
    LIQPAY_INVALID_STATUS_PAYLOAD: 'Unexpected payment status',
    LIQPAY_NO_DATA: 'Payment data is missing',
    LIQPAY_NO_SIGNATURE: 'Payment could not be verified',
    LIQPAY_NO_STATUS: 'Payment status is unknown',
    PRODUCT_ID_REQUIRED: 'Product is required',
    USER_ID_NOT_FOUND: 'User not found',
    USER_ID_REQUIRED: 'User is required',
    INVALID_FILTERS_PARAMETER: 'Invalid search filters',
    MISSING_FRONTEND_URL: 'Store link is not configured',
    MISSING_FRONTEND_URL_CONFIGURATION: 'Store link is not configured',
  },
  uk: {
    'ORDER_CHECKOUT.CONFLICT_ORDER_CREATION_FAILED':
      'Не вдалося оформити замовлення. Натисніть «Придбати» ще раз або зверніться до підтримки.',
    'ORDER_CHECKOUT.LIQPAY_REDIRECT_FAILED':
      'Замовлення оформлено, але не вдалося відкрити сторінку оплати. Спробуйте ще раз або зверніться до підтримки.',
    'ORDER_CHECKOUT.LIQPAY_FOOTER':
      'Після натискання «Придбати» ви перейдете на безпечну оплату через LiqPay. Не оновлюйте сторінку під час оплати.',
    'ADDRESS.NP_HINT':
      'Оберіть місто, відділення, поштомат або вулицю з підказок Нової Пошти.',
    'ADDRESS.WAREHOUSE_REF': 'Відділення Нової Пошти',
    'ADDRESS.CITY_REF_HINT': 'Спочатку оберіть населений пункт зі списку.',
    'ADDRESS.STREET_REF': 'Вулиця (Нова Пошта)',
    'CART.ADDRESS_ID': 'Адреса доставки',
    'CART.ADDRESS_ID_PLACEHOLDER': 'Оберіть збережену адресу',
    'CART.ADDRESS_REQUIRED': 'Оберіть адресу доставки перед оформленням.',
    'CART.COUPON_APPLY_FAILED_CODE': 'Не вдалося застосувати цей купон.',
    'CART.COUPON_NOT_ELIGIBLE': 'Цей купон не підходить до вашого кошика.',
    'CART.COUPON_BETTER_PROMO': 'У кошику вже застосовано вигіднішу акцію.',
    'ADMIN.STATS.DESCRIPTION': 'Огляд продажів та операцій',
    'ADMIN.STATS.UTC_RANGE_HINT':
      'Звіти будуються за обраними календарними датами. Назви місяців — мовою інтерфейсу.',
    'ADMIN.STATS.PROMO_SORT_HINT':
      'На графіку — за спаданням доходу від акцій. Таблицю нижче можна сортувати та шукати окремо.',
    'ADMIN.PROMOTION.PRODUCT_CONDITIONS_HINT':
      'Шукайте товари за назвою або оберіть у розширеному розділі. Порожньо — для всіх відповідних товарів.',
    'ADMIN.PROMOTION.CART_CONDITIONS_HINT':
      'Мінімальна сума або кількість у кошику; можна обмежити товари чи категорії пошуком.',
    'ADMIN.PROMOTION.PICKER_ADVANCED_TOGGLE': 'Ввести ID товарів вручну',
    'ADMIN.PROMOTION.PICKER_ADVANCED_LABEL': 'ID товарів (через кому або пробіл)',
    'ADMIN.PROMOTION.PICKER_ADVANCED_APPLY': 'Застосувати список',
    'ADMIN.PROMOTION.ERR_PRODUCT_IDS': 'Некоректні ID товарів: {{invalid}}',
    'ADMIN.PROMOTION.ERR_CATEGORY_IDS': 'Некоректні ID категорій: {{invalid}}',
    'ADMIN.PROMOTION.ERR_CART_PRODUCT_IDS': 'Некоректні ID товарів: {{invalid}}',
    'ADMIN.PROMOTION.ERR_CART_CATEGORY_IDS': 'Некоректні ID категорій: {{invalid}}',
    'ADMIN.PROMOTION.REFERENCED_PRODUCTS_TITLE': 'Товари за умовами акції',
    'ADMIN.CATEGORY.TRANSLATIONS_HINT':
      'Основна назва та опис збігаються з англійською версією. У таблиці — назва за замовчуванням і посилання в каталозі.',
    'ADMIN.BRAND.TRANSLATIONS_HINT':
      'Основна назва та опис збігаються з англійською версією. У таблиці — назва за замовчуванням і посилання в каталозі.',
    'ADMIN.PRODUCT.STOCK_ADJUST_ERROR':
      'Не вдалося оновити залишок. Перевірте права доступу або спробуйте ще раз.',
    'ADMIN.ORDERS_PAGE.ADDRESS_ID': 'Адреса доставки',
    'ADMIN.ORDERS_PAGE.ADDRESS_ID_HINT': 'Необов’язково: прив’язати іншу збережену адресу доставки.',
    'ADMIN.PAYMENTS_PAGE.DESCRIPTION':
      'Керування платежами, поверненнями та скасуваннями. Деталі — кнопкою «Деталі» в таблиці.',
    'ADMIN.PAYMENTS_PAGE.LIST_NOT_AVAILABLE':
      'Повний список платежів недоступний. Введіть ідентифікатор платежу з замовлення нижче.',
    'ADMIN.PAYMENTS_PAGE.LIST_404_BACKEND':
      'Список платежів тимчасово недоступний. Шукайте за ідентифікатором платежу нижче.',
    'ADMIN.PAYMENTS_PAGE.PAYMENT_ID_HINT': 'Ідентифікатор платежу з підтвердження замовлення',
    'ADMIN.PAYMENTS_PAGE.CANCEL_MSG':
      'Доступно для невдалих або очікуваних платежів за правилами магазину.',
    'AUTH.SOCIAL_LOGIN_GOOGLE_FAILED':
      'Не вдалося увійти через Google. Спробуйте ще раз або увійдіть email.',
    'AUTH.SOCIAL_LOGIN_FACEBOOK_FAILED':
      'Не вдалося увійти через Facebook. Спробуйте ще раз або увійдіть email.',
    'AUTH.SOCIAL_LOGIN_GOOGLE_POPUP':
      'Дозвольте спливаючі вікна для входу через Google або увійдіть через email.',
    PROMOTION_SLUG_EXISTS: 'Акція з таким посиланням у каталозі вже існує',
    INVALID_2FA_TOKEN: 'Час сесії входу минув. Увійдіть знову.',
    INVALID_REFRESH_TOKEN: 'Сесію завершено. Увійдіть знову.',
    INVALID_TOTP_CODE: 'Невірний код із додатку-автентифікатора',
    TOTP_NOT_INITIALIZED: 'Спочатку налаштуйте двофакторну автентифікацію',
    LIQPAY_HTTP_ERROR: 'Сервіс оплати тимчасово недоступний',
    FACEBOOK_TOKEN_INVALID: 'Не вдалося увійти через Facebook. Спробуйте ще раз.',
    GOOGLE_TOKEN_INVALID: 'Не вдалося увійти через Google. Спробуйте ще раз.',
    INVALID_LIQPAY_PAYLOAD: 'Некоректні дані оплати',
    INVALID_LIQPAY_SIGNATURE: 'Не вдалося перевірити оплату',
    LIQPAY_INVALID_REFUND_PAYLOAD: 'Некоректні дані повернення',
    LIQPAY_INVALID_RESPONSE: 'Неочікувана відповідь платіжного сервісу',
    LIQPAY_INVALID_SIGNATURE: 'Не вдалося перевірити оплату',
    LIQPAY_INVALID_STATUS_PAYLOAD: 'Неочікуваний статус оплати',
    LIQPAY_NO_DATA: 'Відсутні дані оплати',
    LIQPAY_NO_SIGNATURE: 'Не вдалося підтвердити оплату',
    LIQPAY_NO_STATUS: 'Статус оплати невідомий',
    PRODUCT_ID_REQUIRED: 'Потрібно вказати товар',
    USER_ID_NOT_FOUND: 'Користувача не знайдено',
    USER_ID_REQUIRED: 'Потрібно вказати користувача',
    INVALID_FILTERS_PARAMETER: 'Некоректні фільтри пошуку',
    MISSING_FRONTEND_URL: 'Посилання магазину не налаштовано',
    MISSING_FRONTEND_URL_CONFIGURATION: 'Посилання магазину не налаштовано',
  },
};

const slugKeys = [
  'ADMIN.CATEGORY.COL_SLUG',
  'ADMIN.BRAND.COL_SLUG',
  'ADMIN.PROMOTION.COL_SLUG',
  'ADMIN.PRODUCT.COL_SLUG',
  'ADMIN.PROMOTION.SLUG',
  'ADMIN.PROMOTION.SLUG_REQUIRED',
  'ADMIN.CATEGORY.SLUG',
  'ADMIN.CATEGORY.SLUG_REQUIRED',
  'ADMIN.BRAND.SLUG',
  'ADMIN.BRAND.SLUG_REQUIRED',
];

function setNested(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

for (const file of files) {
  const lang = file.includes('uk') ? 'uk' : 'en';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [path, value] of Object.entries(patches[lang])) {
    setNested(data, path, value);
  }
  for (const path of slugKeys) {
    if (lang === 'uk') {
      if (path.endsWith('COL_SLUG')) setNested(data, path, 'Посилання');
      if (path.endsWith('SLUG') && !path.endsWith('SLUG_REQUIRED'))
        setNested(data, path, 'Посилання в каталозі (URL)');
      if (path.endsWith('SLUG_REQUIRED')) setNested(data, path, 'Вкажіть посилання в каталозі');
    } else {
      if (path.endsWith('COL_SLUG')) setNested(data, path, 'Catalog link');
      if (path.endsWith('SLUG') && !path.endsWith('SLUG_REQUIRED'))
        setNested(data, path, 'Catalog link (URL)');
      if (path.endsWith('SLUG_REQUIRED')) setNested(data, path, 'Catalog link is required');
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('patched', file);
}
