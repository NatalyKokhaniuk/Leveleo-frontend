export const environment = {
  production: false,
  /**
   * GET /api/admin/Statistics/promotions — блок «Ефективність акцій» у адмінці.
   * Помилка 42703 через неіснуючі колонки на бекенді більше не очікується.
   * Для акцій рівня кошика метрики в API можуть бути 0 (немає прив’язки замовлення до промо в БД) — це нормально.
   * Ставте `false`, лише якщо потрібно приховати блок (наприклад, тимчасово).
   */
  adminPromotionStatisticsEnabled: true,
  googleClientId: '473086035072-0aton30pklt9ccvj0pq53qjke9f8egv5.apps.googleusercontent.com',
  facebookAppId: '1574880827165492',
  /**
   * Якщо задано — усі зображення за ключем беруться з цього шаблону (без GET /api/media/url).
   * Приклади: `https://cdn.example.com/{key}` або публічний шлях до файлу на API.
   * Рядок `{key}` замінюється на encodeURIComponent(ключ). Якщо `{key}` немає — ключ додається в кінець шляху.
   *
   * Якщо null і зображень немає у гостей: на бекенді додайте [AllowAnonymous] на GET /api/media/url
   * АБО окремий GET /api/media/public-url з тим самим JSON { url }, АБО повертайте mainImageUrl у товарі.
   */
  mediaPublicUrlTemplate: null as string | null,
};
