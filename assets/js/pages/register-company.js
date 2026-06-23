(function (window, document) {
    "use strict";

    function setFeedback(element, type, message) {
        if (!element) {
            return;
        }
        element.className = "alert alert-" + type;
        element.textContent = message;
        element.classList.remove("d-none");
    }

    function normalizeText(value) {
        var trimmed = String(value || "").trim();
        return trimmed ? trimmed : null;
    }

    function normalizeEmail(value) {
        var trimmed = String(value || "").trim().toLowerCase();
        return trimmed ? trimmed : null;
    }

    function requestCompanyRegister(payload) {
        var endpoint = window.APP_CONFIG && window.APP_CONFIG.COMPANY_ENDPOINTS
            ? window.APP_CONFIG.COMPANY_ENDPOINTS.REGISTER
            : "/api/company/register";
        return window.httpClient.request(endpoint, {
            method: "POST",
            body: payload
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("register-company-form");
        var feedback = document.getElementById("register-company-feedback");
        var submitButton = document.getElementById("register-company-submit");

        var companyNameInput = document.getElementById("company-name");
        var adminNameInput = document.getElementById("admin-name");
        var adminEmailInput = document.getElementById("admin-email");
        var adminPasswordInput = document.getElementById("admin-password");

        if (!form || !companyNameInput || !adminNameInput || !adminEmailInput || !adminPasswordInput || !submitButton) {
            return;
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var companyName = normalizeText(companyNameInput.value);
            var adminName = normalizeText(adminNameInput.value);
            var email = normalizeEmail(adminEmailInput.value);
            var password = normalizeText(adminPasswordInput.value);

            if (!companyName || companyName.length < 2) {
                setFeedback(feedback, "danger", "El nombre de la empresa es obligatorio.");
                return;
            }

            if (!adminName || adminName.length < 2) {
                setFeedback(feedback, "danger", "El nombre del administrador es obligatorio.");
                return;
            }

            if (!email || email.indexOf("@") === -1) {
                setFeedback(feedback, "danger", "El correo es invalido.");
                return;
            }

            if (!password || password.length < 6) {
                setFeedback(feedback, "danger", "La contraseña debe tener al menos 6 caracteres.");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Procesando...";
            setFeedback(feedback, "info", "Registrando empresa...");

            requestCompanyRegister({
                company_name: companyName,
                admin_name: adminName,
                email: email,
                password: password
            }).then(function () {
                setFeedback(feedback, "success", "Empresa registrada correctamente. Ahora puedes iniciar sesion.");
            }).catch(function (error) {
                if (error && error.status === 404) {
                    setFeedback(feedback, "warning", "El backend no expone aun el endpoint POST /api/company/register.");
                    return;
                }
                if (error && error.data && error.data.message) {
                    setFeedback(feedback, "danger", error.data.message);
                    return;
                }
                setFeedback(feedback, "danger", "No fue posible registrar la empresa.");
            }).then(function () {
                submitButton.disabled = false;
                submitButton.textContent = "Registrar Empresa";
            });
        });
    });
})(window, document);

