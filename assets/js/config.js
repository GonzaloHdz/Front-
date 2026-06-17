(function (window) {
    "use strict";

    window.APP_CONFIG = Object.freeze({
        API_BASE_URL: "http://127.0.0.1:8000",
        AUTH_ENDPOINTS: Object.freeze({
            LOGIN: "/api/auth/login",
            ME: "/api/auth/me"
        }),
        STORAGE_KEYS: Object.freeze({
            AUTH_SESSION: "gestor_inventory_auth_session"
        })
    });
})(window);
