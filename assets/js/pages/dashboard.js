(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    if (!window.authService || !window.authService.getAccessToken()) {
        redirectToLogin();
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        window.authService.fetchProfile().catch(function () {
            window.authService.clearSession();
            redirectToLogin();
        });
    });
})(window, document);
