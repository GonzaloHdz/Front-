(function (window, document) {
    "use strict";

    function setFeedback(element, type, message) {
        element.className = "alert alert-" + type;
        element.textContent = message;
    }

    function parseCompanyId(value) {
        var parsed = parseInt(value, 10);
        return isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function setSubmitting(button, isSubmitting) {
        button.disabled = isSubmitting;
        button.textContent = isSubmitting ? "Signing in..." : "Sign in";
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("login-form");
        var feedback = document.getElementById("login-feedback");
        var submitButton = document.getElementById("login-submit");
        var companyIdInput = document.getElementById("login-company-id");
        var emailInput = document.getElementById("login-email");
        var passwordInput = document.getElementById("login-password");
        var rememberSessionInput = document.getElementById("remember-session");

        if (!form || !feedback || !submitButton) {
            return;
        }

        feedback.classList.add("d-none");

        form.addEventListener("submit", function (event) {
            var companyId = parseCompanyId(companyIdInput.value);
            var email = String(emailInput.value || "").trim().toLowerCase();
            var password = passwordInput.value;
            var rememberSession = rememberSessionInput.checked;

            event.preventDefault();
            feedback.classList.add("d-none");

            if (!companyId) {
                setFeedback(feedback, "danger", "Ingresa un Company ID valido.");
                return;
            }

            if (!email || email.indexOf("@") === -1) {
                setFeedback(feedback, "danger", "Ingresa un correo valido.");
                return;
            }

            if (!password) {
                setFeedback(feedback, "danger", "Ingresa tu contrasena.");
                return;
            }

            setSubmitting(submitButton, true);
            setFeedback(feedback, "info", "Validando credenciales contra el backend...");

            window.authService.login({
                company_id: companyId,
                email: email,
                password: password
            }, rememberSession).then(function (session) {
                setFeedback(feedback, "info", "Sesion iniciada. Verificando datos corporativos...");
                return window.authService.fetchCompanyDetails(session.company_id).then(function (companyDetails) {
                    return {
                        redirectUrl: window.authService.isCompanyProfileComplete(companyDetails)
                            ? "profile.html"
                            : "company-onboarding.html"
                    };
                }).catch(function () {
                    return { redirectUrl: "profile.html" };
                });
            }).then(function (result) {
                setFeedback(feedback, "success", "Inicio de sesion exitoso. Redirigiendo...");
                setSubmitting(submitButton, false);
                window.setTimeout(function () {
                    window.location.href = result.redirectUrl;
                }, 900);
            }).catch(function (error) {
                var apiError = error && error.data && error.data.error;
                var message = "No fue posible iniciar sesion.";

                if (apiError === "invalid_credentials") {
                    message = "Credenciales invalidas. Verifica company_id, email y password.";
                } else if (apiError === "invalid_payload") {
                    message = "El backend rechazo el payload del login.";
                } else if (apiError === "invalid_json") {
                    message = "El backend no pudo interpretar el JSON enviado.";
                } else if (error && error.message) {
                    message = error.message;
                }

                setFeedback(feedback, "danger", message);
                setSubmitting(submitButton, false);
            });
        });
    });
})(window, document);
