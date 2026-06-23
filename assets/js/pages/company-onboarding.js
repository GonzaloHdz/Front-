(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    function setFeedback(element, type, message) {
        if (!element) {
            return;
        }
        element.className = "alert alert-" + type;
        element.textContent = message;
        element.classList.remove("d-none");
    }

    function normalizeValue(value) {
        if (value === null || typeof value === "undefined") {
            return null;
        }
        value = String(value).trim();
        return value || null;
    }

    function sanitizePhone(value) {
        return normalizeValue(value);
    }

    function fillForm(companyDetails) {
        var company = companyDetails && companyDetails.company ? companyDetails.company : companyDetails;

        document.getElementById("onboarding-company-name").value = normalizeValue(company && (company.company_name || company.name)) || "";
        document.getElementById("onboarding-company-rfc").value = normalizeValue(company && company.rfc) || "";
        document.getElementById("onboarding-company-phone").value = normalizeValue(company && company.phone) || "";
    }

    if (!window.authService || !window.authService.getAccessToken()) {
        redirectToLogin();
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("company-onboarding-form");
        var feedback = document.getElementById("company-onboarding-feedback");
        var submitButton = document.getElementById("company-onboarding-submit");
        var session = window.authService && window.authService.getSession ? window.authService.getSession() : null;
        var companyId = session && session.company_id ? session.company_id : null;

        if (!form || !companyId) {
            redirectToLogin();
            return;
        }

        window.authService.fetchCompanyDetails(companyId).then(function (companyDetails) {
            fillForm(companyDetails);
            if (window.authService.isCompanyProfileComplete(companyDetails)) {
                window.location.replace("profile.html");
            }
        }).catch(function () {
            setFeedback(feedback, "warning", "No fue posible precargar los datos de la empresa.");
        });

        form.addEventListener("submit", function (event) {
            var companyName = normalizeValue(document.getElementById("onboarding-company-name").value);
            var rfc = normalizeValue(document.getElementById("onboarding-company-rfc").value);
            var phone = sanitizePhone(document.getElementById("onboarding-company-phone").value);

            event.preventDefault();

            if (!companyName || companyName.length < 2) {
                setFeedback(feedback, "danger", "El nombre de la empresa es obligatorio.");
                return;
            }
            if (!rfc) {
                setFeedback(feedback, "danger", "El RFC es obligatorio.");
                return;
            }
            if (!phone) {
                setFeedback(feedback, "danger", "El telefono es obligatorio.");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Guardando...";
            setFeedback(feedback, "info", "Guardando perfil corporativo...");

            window.httpClient.request(window.APP_CONFIG.USER_ENDPOINTS.PROFILE, {
                method: "PUT",
                headers: window.authService.getAuthorizationHeaders(),
                body: {
                    company_name: companyName,
                    rfc: rfc,
                    phone: phone
                }
            }).then(function () {
                var updatedCompany = {
                    company: {
                        id: companyId,
                        company_name: companyName,
                        name: companyName,
                        rfc: rfc,
                        phone: phone
                    }
                };
                window.authService.saveCompanyDetails(updatedCompany);
                setFeedback(feedback, "success", "Perfil corporativo completado. Redirigiendo...");
                window.setTimeout(function () {
                    window.location.replace("profile.html");
                }, 700);
            }).catch(function (error) {
                if (error && error.status === 403) {
                    setFeedback(feedback, "danger", "No tienes permisos para completar el perfil legal corporativo.");
                    return;
                }
                if (error && error.data && error.data.message) {
                    setFeedback(feedback, "danger", error.data.message);
                    return;
                }
                setFeedback(feedback, "danger", "No fue posible guardar la informacion de la empresa.");
            }).then(function () {
                submitButton.disabled = false;
                submitButton.textContent = "Guardar y Continuar";
            });
        });
    });
})(window, document);
