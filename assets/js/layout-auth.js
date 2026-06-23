(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    function requireSession() {
        if (!window.authService || !window.authService.getAccessToken()) {
            redirectToLogin();
            return false;
        }
        return true;
    }

    function bindLogout() {
        var logoutButton = document.getElementById("logout-btn");

        if (!logoutButton || !window.authService) {
            return;
        }

        logoutButton.addEventListener("click", function (event) {
            event.preventDefault();
            window.authService.clearSession();
            redirectToLogin();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!requireSession()) {
            return;
        }

        bindLogout();
    });
})(window, document);
