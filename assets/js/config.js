(function (window) {
    "use strict";

    window.APP_CONFIG = Object.freeze({
        API_BASE_URL: "http://127.0.0.1:8000",
        AUTH_ENDPOINTS: Object.freeze({
            LOGIN: "/api/auth/login",
            ME: "/api/auth/me"
        }),
        PRODUCTS_ENDPOINTS: Object.freeze({
            LIST: "/api/products",
            CREATE: "/api/products"
        }),
        INVENTORY_ENDPOINTS: Object.freeze({
            LIST: "/api/inventory",
            MOVEMENTS: "/api/inventory/movements"
        }),
        STORAGE_KEYS: Object.freeze({
            AUTH_SESSION: "gestor_inventory_auth_session"
        })
    });
})(window);
