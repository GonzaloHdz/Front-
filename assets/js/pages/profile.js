(function (window, document) {
    "use strict";

    var NOT_REGISTERED_TEXT = "Informacion no registrada";
    var EDIT_ROLES = ["administrador", "supervisor"];
    var MOCK_ROLE_STORAGE_KEY = "current_mock_role";
    var ROLE_NAMES_BY_ID = {
        10: "Almacenista",
        11: "Supervisor",
        12: "Administrador"
    };
    var ROLE_IDS_BY_NAME = {
        administrador: 12,
        supervisor: 11,
        almacenista: 10
    };

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    function redirectToOnboarding() {
        window.location.replace("company-onboarding.html");
    }

    function normalizeValue(value) {
        if (value === null || typeof value === "undefined") {
            return null;
        }

        if (typeof value === "string" && !value.trim()) {
            return null;
        }

        return value;
    }

    function pickFirstValue(candidates) {
        var index;
        for (index = 0; index < candidates.length; index += 1) {
            if (normalizeValue(candidates[index]) !== null) {
                return candidates[index];
            }
        }
        return null;
    }

    function setTextValue(elementId, value, fallbackText) {
        var element = document.getElementById(elementId);
        var resolvedValue = normalizeValue(value);
        if (!element) {
            return;
        }

        if (resolvedValue === null) {
            element.textContent = fallbackText || NOT_REGISTERED_TEXT;
            if (element.className.indexOf("text-muted") === -1) {
                element.className = (element.className ? element.className + " " : "") + "text-muted";
            }
            return;
        }

        element.textContent = String(resolvedValue);
        element.className = String(element.className || "").replace(/\btext-muted\b/g, "").replace(/\s{2,}/g, " ").trim();
    }

    function setRoleBadge(value) {
        var element = document.getElementById("user-role-val");
        var resolvedValue = normalizeValue(value);

        if (!element) {
            return;
        }

        if (resolvedValue === null) {
            element.textContent = NOT_REGISTERED_TEXT;
            element.className = "badge badge-secondary";
            return;
        }

        element.textContent = String(resolvedValue);
        element.className = "badge badge-info";
    }

    function normalizeRole(value) {
        return String(value || "").trim().toLowerCase();
    }

    function canEditProfile(roleValue) {
        return EDIT_ROLES.indexOf(normalizeRole(roleValue)) !== -1;
    }

    function canManageStaff(roleValue) {
        return normalizeRole(roleValue) === "administrador";
    }

    function getAuthHeaders() {
        return window.authService ? window.authService.getAuthorizationHeaders() : {};
    }

    function getRoleNameById(roleId) {
        return ROLE_NAMES_BY_ID[Number(roleId)] || "Rol desconocido";
    }

    function getRoleIdByName(roleName) {
        return ROLE_IDS_BY_NAME[normalizeRole(roleName)] || 10;
    }

    function getNextRoleId(roleId) {
        var normalizedRoleId = Number(roleId) || 10;
        if (normalizedRoleId === 10) {
            return 11;
        }
        if (normalizedRoleId === 11) {
            return 12;
        }
        return 10;
    }

    function requestCompanyDetails(companyId) {
        var endpointBase = window.APP_CONFIG && window.APP_CONFIG.COMPANY_ENDPOINTS
            ? window.APP_CONFIG.COMPANY_ENDPOINTS.DETAILS
            : "/api/company/details";
        var companyDetailsEndpoint = endpointBase + "?company_id=" + encodeURIComponent(companyId);

        return window.httpClient.request(companyDetailsEndpoint, {
            method: "GET",
            headers: getAuthHeaders()
        }).then(function (companyDetails) {
            if (window.authService && window.authService.saveCompanyDetails) {
                window.authService.saveCompanyDetails(companyDetails);
            }
            return companyDetails;
        }).catch(function (error) {
            if (error && (error.status === 404 || error.status === 403 || error.status === 400)) {
                return null;
            }
            throw error;
        });
    }

    function requestRegisterUser(payload) {
        return window.httpClient.request("/api/users/register", {
            method: "POST",
            headers: getAuthHeaders(),
            body: payload
        });
    }

    function requestAssignRole(payload) {
        return window.httpClient.request("/api/admin/user-roles/assign", {
            method: "POST",
            headers: getAuthHeaders(),
            body: payload
        });
    }

    function requestCompanyUsers() {
        return window.httpClient.request("/api/company/users", {
            method: "GET",
            headers: getAuthHeaders()
        }).then(function (data) {
            return data && data.users ? data.users : [];
        });
    }

    function isCompanyProfileComplete(companyDetails) {
        if (window.authService && window.authService.isCompanyProfileComplete) {
            return window.authService.isCompanyProfileComplete(companyDetails);
        }
        companyDetails = companyDetails && companyDetails.company ? companyDetails.company : companyDetails;
        return !!(companyDetails && normalizeValue(companyDetails.rfc) !== null && normalizeValue(companyDetails.phone) !== null);
    }

    function extractProfileData(session, profile, companyDetails) {
        var companyPayload = companyDetails && companyDetails.company ? companyDetails.company : companyDetails;
        var branchPayload = companyDetails && companyDetails.branch ? companyDetails.branch : companyDetails;
        var userPayload = profile && profile.user ? profile.user : profile;

        return {
            userName: pickFirstValue([
                userPayload && userPayload.name,
                userPayload && userPayload.full_name,
                userPayload && userPayload.username,
                session && session.name
            ]),
            userEmail: pickFirstValue([
                userPayload && userPayload.email,
                session && session.email
            ]),
            userRole: pickFirstValue([
                userPayload && userPayload.role,
                userPayload && userPayload.role_name,
                userPayload && userPayload.primary_role,
                session && session.role
            ]),
            companyId: pickFirstValue([
                userPayload && userPayload.company_id,
                companyPayload && companyPayload.company_id,
                companyPayload && companyPayload.id,
                session && session.company_id,
                1
            ]),
            companyName: pickFirstValue([
                userPayload && userPayload.company_name,
                companyPayload && companyPayload.company_name,
                companyPayload && companyPayload.name
            ]),
            companyRfc: pickFirstValue([
                userPayload && userPayload.rfc,
                userPayload && userPayload.tax_id,
                companyPayload && companyPayload.rfc,
                companyPayload && companyPayload.tax_id
            ]),
            companyPhone: pickFirstValue([
                userPayload && userPayload.company_phone,
                companyPayload && companyPayload.phone,
                companyPayload && companyPayload.contact_phone,
                branchPayload && branchPayload.phone,
                branchPayload && branchPayload.contact_phone
            ])
        };
    }

    function setAlert(element, type, message) {
        if (!element) {
            return;
        }
        element.className = "alert alert-" + type;
        element.textContent = message;
        element.classList.remove("d-none");
    }

    function clearAlert(element) {
        if (element) {
            element.classList.add("d-none");
        }
    }

    function setInputValue(elementId, value) {
        var element = document.getElementById(elementId);
        var resolvedValue = normalizeValue(value);
        if (element) {
            element.value = resolvedValue === null ? "" : String(resolvedValue);
        }
    }

    function setInputsReadOnly(readOnly) {
        var inputIds = [
            "company-name-input",
            "company-rfc-input",
            "company-phone-input"
        ];
        inputIds.forEach(function (id) {
            var element = document.getElementById(id);
            if (element) {
                element.readOnly = !!readOnly;
            }
        });
    }

    function setEditMode(isEditMode, canEdit) {
        var editButton = document.getElementById("profile-edit-btn");
        var saveButton = document.getElementById("profile-save-btn");
        var hasPermission = typeof canEdit === "boolean" ? canEdit : true;
        var enableInputs = hasPermission && !!isEditMode;

        setInputsReadOnly(!enableInputs);

        if (editButton) {
            editButton.classList.toggle("d-none", !hasPermission);
            editButton.textContent = enableInputs ? "Cancelar" : "Editar";
        }
        if (saveButton) {
            saveButton.classList.toggle("d-none", !enableInputs);
        }
    }

    function sanitizePhone(value) {
        var trimmed = String(value || "").trim();
        return trimmed ? trimmed : null;
    }

    function isValidPhone(value) {
        if (!value) {
            return true;
        }
        return /^[0-9+()\-\s]{7,20}$/.test(String(value));
    }

    function validateEmployeePassword(value) {
        var password = String(value || "");
        var errors = [];

        if (password.length < 8) {
            errors.push("minimo 8 caracteres");
        }
        if (!/[A-Z]/.test(password)) {
            errors.push("al menos una letra mayuscula");
        }
        if (!/[0-9]/.test(password)) {
            errors.push("al menos un numero");
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            errors.push("al menos un caracter especial");
        }

        return {
            isValid: errors.length === 0,
            message: errors.length ? "La contrasena del empleado debe incluir " + errors.join(", ") + "." : ""
        };
    }

    function sanitizeEmail(value) {
        var normalized = String(value || "").trim().toLowerCase();
        return normalized || null;
    }

    function buildCompanyProfileUpdatePayload(original, current) {
        var payload = {};
        var hasChanges = false;

        function setIfChanged(key, newValue, oldValue) {
            if (normalizeValue(newValue) === null && normalizeValue(oldValue) === null) {
                return;
            }
            if (String(normalizeValue(newValue) || "") === String(normalizeValue(oldValue) || "")) {
                return;
            }
            payload[key] = normalizeValue(newValue);
            hasChanges = true;
        }

        setIfChanged("company_name", current.companyName, original.companyName);
        setIfChanged("rfc", current.companyRfc, original.companyRfc);
        setIfChanged("phone", current.companyPhone, original.companyPhone);

        return hasChanges ? payload : null;
    }

    function updateProfile(payload) {
        var endpoint = window.APP_CONFIG && window.APP_CONFIG.USER_ENDPOINTS
            ? window.APP_CONFIG.USER_ENDPOINTS.PROFILE
            : "/api/user/profile";

        return window.httpClient.request(endpoint, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: payload
        });
    }

    function renderProfileData(mappedData) {
        setTextValue("user-name-val", mappedData.userName);
        setTextValue("user-name-field-val", mappedData.userName);
        setTextValue("user-email-val", mappedData.userEmail);
        setRoleBadge(mappedData.userRole);
        setTextValue("company-name-val", mappedData.companyName);
        setTextValue("company-rfc-val", mappedData.companyRfc);
        setTextValue("company-phone-val", mappedData.companyPhone);

        setInputValue("user-name-input", mappedData.userName);
        setInputValue("user-email-input", mappedData.userEmail);
        setInputValue("company-name-input", mappedData.companyName);
        setInputValue("company-rfc-input", mappedData.companyRfc);
        setInputValue("company-phone-input", mappedData.companyPhone);
    }

    function renderCompanyUsersTable(users, currentUserId) {
        var tableBody = document.getElementById("company-users-table-body");
        var activeUsers = (users || []).filter(function (user) {
            return !user || typeof user.is_active === "undefined" ? true : Number(user.is_active) === 1;
        });

        if (!tableBody) {
            return;
        }

        if (!activeUsers.length) {
            tableBody.innerHTML = "<tr><td colspan=\"4\" class=\"text-center text-muted\">No hay empleados activos registrados.</td></tr>";
            return;
        }

        tableBody.innerHTML = activeUsers.map(function (user) {
            var userId = user && (user.user_id || user.id);
            var userRoleId = user && (user.role_id || user.roleId || user.role);
            var resolvedRoleId = userRoleId === null || typeof userRoleId === "undefined" ? null : Number(userRoleId);
            var isCurrentUser = Number(userId) === Number(currentUserId);
            return [
                "<tr>",
                "<td>", String(userId), "</td>",
                "<td>", String(user.email || NOT_REGISTERED_TEXT), "</td>",
                "<td><span class=\"badge badge-light\">", resolvedRoleId ? getRoleNameById(resolvedRoleId) : "Sin rol", "</span></td>",
                "<td>",
                "<button type=\"button\" class=\"btn btn-sm btn-outline-primary change-role-btn\" data-user-id=\"", String(userId), "\" data-role-id=\"", resolvedRoleId ? String(resolvedRoleId) : "", "\"", isCurrentUser ? " disabled" : "", ">",
                isCurrentUser ? "Rol propio protegido" : "Cambiar Rol",
                "</button>",
                "</td>",
                "</tr>"
            ].join("");
        }).join("");
    }

    function getStoredMockRole() {
        return window.localStorage.getItem(MOCK_ROLE_STORAGE_KEY);
    }

    function setStoredMockRole(roleName) {
        window.localStorage.setItem(MOCK_ROLE_STORAGE_KEY, roleName);
    }

    function applyRBACRestrictions(activeRole, isEditMode) {
        var normalizedRole = normalizeRole(activeRole);
        var staffPanel = document.getElementById("company-staff-panel");
        var registerEmployeeButton = document.getElementById("open-register-employee-modal");
        var canEdit = canEditProfile(normalizedRole);
        var canManage = canManageStaff(normalizedRole);

        if (staffPanel) {
            staffPanel.classList.toggle("d-none", !canManage);
        }

        setEditMode(canEdit && !!isEditMode, canEdit);

        if (registerEmployeeButton) {
            registerEmployeeButton.disabled = !canManage;
        }
    }

    function applyEmployeeManagementGate(isCompanyComplete) {
        var lockMessage = document.getElementById("staff-management-lock-message");
        var registerEmployeeEmail = document.getElementById("new-employee-email");
        var registerEmployeePassword = document.getElementById("new-employee-password");
        var registerEmployeeRole = document.getElementById("new-employee-role-id");
        var registerEmployeeSubmitButton = document.getElementById("register-employee-submit");

        if (lockMessage) {
            lockMessage.classList.toggle("d-none", !!isCompanyComplete);
        }
        if (registerEmployeeEmail) {
            registerEmployeeEmail.disabled = !isCompanyComplete;
        }
        if (registerEmployeePassword) {
            registerEmployeePassword.disabled = !isCompanyComplete;
        }
        if (registerEmployeeRole) {
            registerEmployeeRole.disabled = !isCompanyComplete;
        }
        if (registerEmployeeSubmitButton) {
            registerEmployeeSubmitButton.disabled = !isCompanyComplete;
        }
    }

    if (!window.authService || !window.authService.getAccessToken()) {
        redirectToLogin();
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var feedback = document.getElementById("profile-feedback");
        var session = window.authService.getSession ? window.authService.getSession() : null;
        var formFeedback = document.getElementById("profile-form-feedback");
        var staffFeedback = document.getElementById("staff-management-feedback");
        var registerEmployeeFeedback = document.getElementById("register-employee-feedback");
        var profileForm = document.getElementById("profile-form");
        var registerEmployeeForm = document.getElementById("register-employee-form");
        var editButton = document.getElementById("profile-edit-btn");
        var saveButton = document.getElementById("profile-save-btn");
        var registerEmployeeSubmit = document.getElementById("register-employee-submit");
        var roleSelector = document.getElementById("mock-role-selector");
        var tableBody = document.getElementById("company-users-table-body");
        var profileResponse = null;
        var companyId = session && session.company_id ? session.company_id : null;
        var loadedData = null;
        var isEditMode = false;
        var activeMockRole = getStoredMockRole() || "Administrador";
        var companyDetailsLoaded = null;

        function setUsersLoadingState() {
            if (tableBody) {
                tableBody.innerHTML = "<tr><td colspan=\"4\" class=\"text-center text-muted\">Cargando personal...</td></tr>";
            }
        }

        function refreshUsersUI(messageType, messageText) {
            if (!loadedData) {
                return Promise.resolve([]);
            }

            setUsersLoadingState();
            return requestCompanyUsers().then(function (users) {
                renderCompanyUsersTable(users, loadedData.userId);
                if (messageType && messageText) {
                    setAlert(staffFeedback, messageType, messageText);
                }
                return users;
            }).catch(function (error) {
                if (error && error.status === 403) {
                    setAlert(staffFeedback, "warning", "No tienes permisos para ver el listado de colaboradores.");
                } else {
                    setAlert(staffFeedback, "warning", "No fue posible cargar el listado de colaboradores.");
                }
                renderCompanyUsersTable([], loadedData.userId);
                return [];
            });
        }

        if (session) {
            setTextValue("user-email-val", session.email);
        }

        if (roleSelector) {
            roleSelector.value = activeMockRole;
        }

        window.authService.fetchProfile().then(function (profile) {
            profileResponse = profile || {};
            companyId = pickFirstValue([
                profileResponse && profileResponse.company_id,
                profileResponse && profileResponse.company && profileResponse.company.id,
                session && session.company_id,
                1
            ]);

            if (
                profileResponse &&
                (
                    normalizeValue(profileResponse.company_name) !== null ||
                    normalizeValue(profileResponse.rfc) !== null ||
                    normalizeValue(profileResponse.tax_id) !== null ||
                    normalizeValue(profileResponse.branch_name) !== null
                )
            ) {
                return null;
            }

            return requestCompanyDetails(companyId);
        }).then(function (companyDetails) {
            companyDetailsLoaded = companyDetails;
            loadedData = extractProfileData(session, profileResponse, companyDetails);

            if (!isCompanyProfileComplete(companyDetailsLoaded || {
                company: {
                    company_name: loadedData.companyName,
                    rfc: loadedData.companyRfc,
                    phone: loadedData.companyPhone
                }
            })) {
                applyEmployeeManagementGate(false);
                redirectToOnboarding();
                return;
            }

            if (!normalizeValue(loadedData.userRole)) {
                loadedData.userRole = activeMockRole;
            }

            if (!getStoredMockRole()) {
                activeMockRole = loadedData.userRole || activeMockRole;
                setStoredMockRole(activeMockRole);
                if (roleSelector) {
                    roleSelector.value = activeMockRole;
                }
            }

            renderProfileData(loadedData);
            applyEmployeeManagementGate(true);
            refreshUsersUI();
            applyRBACRestrictions(activeMockRole, isEditMode);

            if (feedback) {
                feedback.className = "alert alert-success";
                feedback.textContent = "Perfil cargado correctamente.";
            }
        }).catch(function () {
            if (window.authService) {
                window.authService.clearSession();
            }
            redirectToLogin();
        });

        if (roleSelector) {
            roleSelector.addEventListener("change", function () {
                activeMockRole = roleSelector.value;
                if (loadedData) {
                    loadedData.userRole = activeMockRole;
                }
                setStoredMockRole(activeMockRole);
                setRoleBadge(activeMockRole);
                if (!canEditProfile(activeMockRole)) {
                    isEditMode = false;
                }
                applyRBACRestrictions(activeMockRole, isEditMode);
            });
        }

        if (editButton) {
            editButton.addEventListener("click", function () {
                if (!canEditProfile(activeMockRole) || !loadedData) {
                    return;
                }

                clearAlert(formFeedback);
                isEditMode = !isEditMode;
                applyRBACRestrictions(activeMockRole, isEditMode);

                if (!isEditMode) {
                    setInputValue("company-name-input", loadedData.companyName);
                    setInputValue("company-rfc-input", loadedData.companyRfc);
                    setInputValue("company-phone-input", loadedData.companyPhone);
                }
            });
        }

        if (profileForm) {
            profileForm.addEventListener("submit", function (event) {
                var companyName;
                var companyRfc;
                var companyPhone;
                var current;
                var payload;
                var applyLocalChanges;

                event.preventDefault();

                if (!canEditProfile(activeMockRole) || !loadedData) {
                    return;
                }

                clearAlert(formFeedback);

                companyName = String(document.getElementById("company-name-input") ? document.getElementById("company-name-input").value : "").trim();
                companyRfc = String(document.getElementById("company-rfc-input") ? document.getElementById("company-rfc-input").value : "").trim();
                companyPhone = sanitizePhone(document.getElementById("company-phone-input") ? document.getElementById("company-phone-input").value : "");

                if (companyName && companyName.length < 2) {
                    setAlert(formFeedback, "danger", "El nombre de la empresa es demasiado corto.");
                    return;
                }

                if (companyPhone && !isValidPhone(companyPhone)) {
                    setAlert(formFeedback, "danger", "Telefono corporativo invalido.");
                    return;
                }

                current = {
                    companyId: loadedData.companyId,
                    companyName: companyName || null,
                    companyRfc: companyRfc || null,
                    companyPhone: companyPhone
                };

                applyLocalChanges = function () {
                    loadedData.companyName = current.companyName;
                    loadedData.companyRfc = current.companyRfc;
                    loadedData.companyPhone = current.companyPhone;
                    companyDetailsLoaded = {
                        company: {
                            id: loadedData.companyId,
                            company_name: current.companyName,
                            name: current.companyName,
                            rfc: current.companyRfc,
                            phone: current.companyPhone
                        }
                    };
                    if (window.authService && window.authService.saveCompanyDetails) {
                        window.authService.saveCompanyDetails(companyDetailsLoaded);
                    }
                    renderProfileData(loadedData);
                    applyEmployeeManagementGate(isCompanyProfileComplete(companyDetailsLoaded));
                    isEditMode = false;
                    applyRBACRestrictions(activeMockRole, isEditMode);
                };

                payload = buildCompanyProfileUpdatePayload(
                    {
                        companyName: loadedData.companyName,
                        companyRfc: loadedData.companyRfc,
                        companyPhone: loadedData.companyPhone
                    },
                    current
                );

                if (!payload) {
                    setAlert(formFeedback, "info", "No hay cambios para guardar.");
                    return;
                }

                if (saveButton) {
                    saveButton.disabled = true;
                    saveButton.textContent = "Procesando...";
                }

                updateProfile(payload).then(function () {
                    setAlert(formFeedback, "success", "Cambios guardados correctamente.");
                    applyLocalChanges();
                }).catch(function (error) {
                    if (error && error.status === 404) {
                        setAlert(formFeedback, "warning", "El backend no expone aun /api/user/profile.");
                        return;
                    }
                    if (error && error.status === 403) {
                        setAlert(formFeedback, "warning", "No tienes permisos para actualizar la informacion de la empresa.");
                        return;
                    }

                    setAlert(formFeedback, "danger", "No fue posible guardar los cambios.");
                    if (saveButton) {
                        saveButton.disabled = false;
                        saveButton.textContent = "Guardar Cambios";
                    }
                });
            });
        }

        if (registerEmployeeForm) {
            registerEmployeeForm.addEventListener("submit", function (event) {
                var emailInput = document.getElementById("new-employee-email");
                var passwordInput = document.getElementById("new-employee-password");
                var roleInput = document.getElementById("new-employee-role-id");
                var email;
                var password;
                var roleId;
                var passwordValidation;

                event.preventDefault();

                if (!loadedData || !canManageStaff(activeMockRole)) {
                    return;
                }

                if (!isCompanyProfileComplete(companyDetailsLoaded || {
                    company: {
                        rfc: loadedData.companyRfc,
                        phone: loadedData.companyPhone
                    }
                })) {
                    setAlert(registerEmployeeFeedback, "warning", "Seguridad Multi-tenant: Debe completar el perfil legal de la empresa (RFC y Telefono) antes de poder dar de alta empleados en su organizacion.");
                    return;
                }

                clearAlert(registerEmployeeFeedback);

                email = sanitizeEmail(emailInput ? emailInput.value : "");
                password = String(passwordInput ? passwordInput.value : "").trim();
                roleId = parseInt(roleInput ? roleInput.value : "0", 10);

                if (!email || email.indexOf("@") === -1) {
                    setAlert(registerEmployeeFeedback, "danger", "El correo del empleado es invalido.");
                    return;
                }

                passwordValidation = validateEmployeePassword(password);
                if (!passwordValidation.isValid) {
                    setAlert(registerEmployeeFeedback, "danger", passwordValidation.message);
                    return;
                }

                if (roleId !== 10 && roleId !== 11) {
                    setAlert(registerEmployeeFeedback, "danger", "Selecciona un rol valido para el empleado.");
                    return;
                }

                if (registerEmployeeSubmit) {
                    registerEmployeeSubmit.disabled = true;
                    registerEmployeeSubmit.textContent = "Procesando...";
                }

                requestRegisterUser({
                    email: email,
                    password: password,
                    role_id: roleId
                }).then(function () {
                    setAlert(registerEmployeeFeedback, "success", "Empleado registrado correctamente.");
                }).catch(function (error) {
                    if (error && error.status === 404) {
                        setAlert(registerEmployeeFeedback, "warning", "El backend no expone aun /api/users/register.");
                        return;
                    }
                    if (error && error.status === 403) {
                        setAlert(registerEmployeeFeedback, "warning", "No tienes permisos para registrar empleados.");
                        return;
                    }
                    if (error && error.data && error.data.message) {
                        setAlert(registerEmployeeFeedback, "danger", error.data.message);
                        return;
                    }
                    setAlert(registerEmployeeFeedback, "danger", "No fue posible registrar al empleado.");
                }).then(function () {
                    return refreshUsersUI("success", "La tabla de colaboradores fue actualizada.");
                }).then(function () {
                    if (registerEmployeeForm) {
                        registerEmployeeForm.reset();
                    }
                    if (registerEmployeeSubmit) {
                        registerEmployeeSubmit.disabled = false;
                        registerEmployeeSubmit.textContent = "Registrar Empleado";
                    }
                });
            });
        }

        if (tableBody) {
            tableBody.addEventListener("click", function (event) {
                var button = event.target.closest(".change-role-btn");
                var currentRoleId;
                var nextRoleId;
                var originalText;

                if (!button || !loadedData || !canManageStaff(activeMockRole)) {
                    return;
                }

                if (Number(button.getAttribute("data-user-id")) === Number(loadedData.userId)) {
                    setAlert(staffFeedback, "warning", "No puedes modificar el rol del usuario autenticado en esta simulacion.");
                    return;
                }

                currentRoleId = Number(button.getAttribute("data-role-id")) || 10;
                nextRoleId = getNextRoleId(currentRoleId);
                button.disabled = true;
                originalText = button.textContent;
                button.textContent = "Procesando...";

                requestAssignRole({
                    company_id: getCurrentSessionCompanyId(loadedData.companyId),
                    user_id: Number(button.getAttribute("data-user-id")),
                    role_id: nextRoleId
                }).then(function () {
                    setAlert(staffFeedback, "success", "Rol sincronizado con el backend.");
                }).catch(function (error) {
                    if (error && error.status === 404) {
                        setAlert(staffFeedback, "warning", "El backend no expone aun /api/admin/user-roles/assign.");
                        return;
                    }
                    if (error && error.status === 403) {
                        setAlert(staffFeedback, "warning", "No tienes permisos para asignar roles.");
                        return;
                    }
                    setAlert(staffFeedback, "danger", "No fue posible asignar el rol.");
                }).then(function () {
                    return refreshUsersUI();
                }).then(function () {
                    button.disabled = false;
                    button.textContent = originalText || "Cambiar Rol";
                });
            });
        }
    });
})(window, document);
