 (function (window, document) {
     "use strict";
 
     function getStorageKey() {
         return window.APP_CONFIG && window.APP_CONFIG.STORAGE_KEYS ? window.APP_CONFIG.STORAGE_KEYS.AUTH_SESSION : "gestor_inventory_auth_session";
     }

    function getRegisterEndpoint() {
        return window.APP_CONFIG && window.APP_CONFIG.AUTH_ENDPOINTS && window.APP_CONFIG.AUTH_ENDPOINTS.REGISTER_COMPANY
            ? window.APP_CONFIG.AUTH_ENDPOINTS.REGISTER_COMPANY
            : "/api/auth/register-company";
    }
 
     function setFeedback(element, type, message) {
         if (!element) {
             return;
         }
         element.className = "alert alert-" + type;
         element.textContent = message;
         element.classList.remove("d-none");
     }
 
     function sanitizeEmail(value) {
         return String(value || "").trim().toLowerCase();
     }
 
     function saveSession(payload) {
         var session = {
             access_token: payload.access_token,
             token_type: payload.token_type || "bearer",
             company_id: payload.company_id,
             email: payload.email,
             role: payload.role,
             saved_at: new Date().toISOString()
         };
         window.sessionStorage.setItem(getStorageKey(), JSON.stringify(session));
         window.sessionStorage.setItem("token", String(payload.access_token || ""));
         window.sessionStorage.setItem("company_id", String(payload.company_id || ""));
         window.sessionStorage.setItem("user_role", String(payload.role || ""));
     }
 
     document.addEventListener("DOMContentLoaded", function () {
         var form = document.getElementById("register-form");
         var feedback = document.getElementById("register-feedback");
         var submitButton = document.getElementById("register-submit");
         var emailInput = document.getElementById("register-email");
         var passwordInput = document.getElementById("register-password");
        var companyNameInput = document.getElementById("register-company-name");
 
         if (!form || !window.httpClient) {
             return;
         }
 
         form.addEventListener("submit", function (event) {
             var email = sanitizeEmail(emailInput ? emailInput.value : "");
             var password = String(passwordInput ? passwordInput.value : "").trim();
             var companyName = String(companyNameInput ? companyNameInput.value : "").trim();
 
             event.preventDefault();
 
             if (!email || email.indexOf("@") === -1) {
                 setFeedback(feedback, "danger", "Ingresa un correo valido.");
                 return;
             }
 
             if (!password || password.length < 8) {
                 setFeedback(feedback, "danger", "La contraseña debe cumplir la politica del backend.");
                 return;
             }
 
             if (submitButton) {
                 submitButton.disabled = true;
                 submitButton.textContent = "Procesando...";
             }
 
            window.httpClient.request(getRegisterEndpoint(), {
                 method: "POST",
                 body: {
                     email: email,
                     password: password,
                     company_name: companyName || null
                 }
             }).then(function (data) {
                 saveSession({
                     access_token: data.access_token,
                     token_type: data.token_type,
                     company_id: data.company_id,
                     email: email,
                     role: data.role
                 });
                 setFeedback(feedback, "success", "Registro completado. Redirigiendo al perfil...");
                 window.setTimeout(function () {
                     window.location.href = "profile.html";
                 }, 700);
             }).catch(function (error) {
                 var apiError = error && error.data && error.data.error;
                 var message = "No fue posible completar el registro.";
 
                 if (apiError === "email_already_exists") {
                    message = "Ese correo ya existe. Redirigiendo al login...";
                    setFeedback(feedback, "warning", message);
                    window.setTimeout(function () {
                        window.location.href = "page-login.html";
                    }, 1200);
                    return;
                 } else if (apiError === "company_name_exists") {
                     message = "El nombre de empresa ya existe.";
                 } else if (apiError === "validation_error" && error.data && error.data.message) {
                     message = error.data.message;
                 }
 
                 setFeedback(feedback, "danger", message);
             }).then(function () {
                 if (submitButton) {
                     submitButton.disabled = false;
                     submitButton.textContent = "Register";
                 }
             });
         });
     });
 })(window, document);
