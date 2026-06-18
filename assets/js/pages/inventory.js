(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
    }

    function getBootstrapAlertMessage(status) {
        if (status === 500) {
            return "El servidor encontro un error interno. Intenta nuevamente en unos momentos.";
        }
        return "No fue posible completar la solicitud en este momento.";
    }

    function getStoredAccessToken() {
        var storageKey = window.APP_CONFIG && window.APP_CONFIG.STORAGE_KEYS
            ? window.APP_CONFIG.STORAGE_KEYS.AUTH_SESSION
            : null;
        var storedValues = [];

        function parseStoredToken(rawValue) {
            var parsed;
            if (!rawValue) {
                return null;
            }
            try {
                parsed = JSON.parse(rawValue);
                return parsed && parsed.access_token ? parsed.access_token : null;
            } catch (error) {
                return null;
            }
        }

        if (!storageKey) {
            return window.authService && window.authService.getAccessToken ? window.authService.getAccessToken() : null;
        }

        storedValues.push(window.localStorage.getItem(storageKey));
        storedValues.push(window.sessionStorage.getItem(storageKey));

        return parseStoredToken(storedValues[0]) || parseStoredToken(storedValues[1]) || (
            window.authService && window.authService.getAccessToken ? window.authService.getAccessToken() : null
        );
    }

    function setFeedback(element, type, message) {
        element.className = "alert alert-" + type;
        element.textContent = message;
    }

    function parsePositiveInt(value) {
        var trimmed = String(value || "").trim();
        if (!trimmed) {
            return null;
        }

        var parsed = Number(trimmed);
        return isFinite(parsed) && Math.floor(parsed) === parsed && parsed > 0 ? parsed : null;
    }

    function formatTimestamp(unixTimestamp) {
        if (!unixTimestamp) {
            return "-";
        }

        try {
            if (unixTimestamp instanceof Date) {
                return unixTimestamp.toLocaleString();
            }

            if (typeof unixTimestamp === "string") {
                return new Date(unixTimestamp).toLocaleString();
            }

            var numericValue = Number(unixTimestamp);
            if (!isFinite(numericValue)) {
                return String(unixTimestamp);
            }

            var timestampMs = numericValue > 1000000000000 ? numericValue : numericValue * 1000;
            return new Date(timestampMs).toLocaleString();
        } catch (error) {
            return String(unixTimestamp);
        }
    }

    function isActiveProduct(product) {
        if (!product) {
            return false;
        }
        return !(product.is_active === 0 || product.is_active === false);
    }

    function indexProductsById(products) {
        var map = {};
        products.forEach(function (product) {
            map[String(product.id)] = product;
        });
        return map;
    }

    function mergeInventory(products, items) {
        var itemMap = {};
        var rows = [];

        items.forEach(function (item) {
            itemMap[String(item.product_id)] = item;
        });

        products.forEach(function (product) {
            if (!isActiveProduct(product)) {
                return;
            }
            var item = itemMap[String(product.id)] || null;
            rows.push({
                product_id: product.id,
                sku: product.sku,
                name: product.name,
                is_active: product.is_active,
                quantity: item ? item.quantity : 0,
                min_quantity: item ? item.min_quantity : 0,
                updated_at: item ? item.updated_at : null
            });
        });

        return rows;
    }

    function filterActiveInventoryRows(rows) {
        return (rows || []).filter(function (row) {
            return row && !(row.is_active === 0 || row.is_active === false);
        });
    }

    function renderInventory(tableBody, rows) {
        var visibleRows = filterActiveInventoryRows(rows);

        tableBody.innerHTML = "";

        if (!visibleRows.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 7;
            emptyCell.className = "text-muted";
            emptyCell.textContent = "No hay productos o stock registrado para esta sucursal.";
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        visibleRows.forEach(function (row, index) {
            var tr = document.createElement("tr");
            var stockClass = row.quantity <= row.min_quantity ? "text-danger font-weight-bold" : "";

            function td(text, className) {
                var cell = document.createElement("td");
                cell.textContent = text;
                if (className) {
                    cell.className = className;
                }
                return cell;
            }

            tr.appendChild(td(String(index + 1)));
            tr.appendChild(td(String(row.sku || "")));
            tr.appendChild(td(String(row.name || "")));
            tr.appendChild(td(String(row.quantity), stockClass));
            tr.appendChild(td(String(row.min_quantity)));
            tr.appendChild(td(formatTimestamp(row.updated_at)));

            var actionsCell = document.createElement("td");
            var deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "btn btn-sm btn-outline-danger";
            deleteButton.textContent = "Eliminar";
            deleteButton.setAttribute("data-id", String(row.product_id));
            actionsCell.appendChild(deleteButton);
            tr.appendChild(actionsCell);

            tableBody.appendChild(tr);
        });
    }

    function filterInventoryRows(tableBody, searchTerm) {
        var normalizedSearch = String(searchTerm || "").trim().toLowerCase();
        var rows = tableBody ? tableBody.querySelectorAll("tr") : [];

        Array.prototype.forEach.call(rows, function (row) {
            var cells = row.getElementsByTagName("td");
            if (cells.length < 3) {
                row.style.display = "";
                return;
            }

            var skuText = String(cells[1].textContent || "").toLowerCase();
            var nameText = String(cells[2].textContent || "").toLowerCase();
            var matches = !normalizedSearch || skuText.indexOf(normalizedSearch) !== -1 || nameText.indexOf(normalizedSearch) !== -1;

            row.style.display = matches ? "" : "none";
        });
    }

    function calculateDashboardMetrics(rows, movements) {
        var totalStock = 0;
        var alertProducts = 0;
        var lastActivity = null;
        var activeRows = filterActiveInventoryRows(rows);

        activeRows.forEach(function (row) {
            var quantity = Number(row.quantity || 0);
            var minQuantity = Number(row.min_quantity || 0);
            var updatedAt = Number(row.updated_at || 0);

            totalStock += quantity;

            if (quantity <= minQuantity) {
                alertProducts += 1;
            }

            if (updatedAt && (!lastActivity || updatedAt > lastActivity)) {
                lastActivity = updatedAt;
            }
        });

        movements.forEach(function (movement) {
            var createdAt = Number(movement.created_at || 0);
            if (createdAt && (!lastActivity || createdAt > lastActivity)) {
                lastActivity = createdAt;
            }
        });

        return {
            totalStock: totalStock,
            alertProducts: alertProducts,
            lastActivity: lastActivity
        };
    }

    function renderDashboardCards(totalStockElement, alertProductsElement, lastActivityElement, alertsContainerElement, rows, movements) {
        var metrics = calculateDashboardMetrics(rows, movements);

        if (totalStockElement) {
            totalStockElement.textContent = String(metrics.totalStock);
        }

        if (alertProductsElement) {
            alertProductsElement.textContent = String(metrics.alertProducts);
        }

        if (lastActivityElement) {
            lastActivityElement.textContent = metrics.lastActivity ? formatTimestamp(metrics.lastActivity) : "-";
        }

        if (alertsContainerElement) {
            if (metrics.alertProducts > 0) {
                alertsContainerElement.innerHTML = [
                    '<div class="alert alert-danger" role="alert">',
                    "Atencion: Tienes ",
                    String(metrics.alertProducts),
                    " productos con stock criticamente bajo. Por favor, verifica los niveles en la tabla inferior.",
                    "</div>"
                ].join("");
            } else {
                alertsContainerElement.innerHTML = "";
            }
        }
    }

    function hideProductDeactivateModal(modalElement) {
        if (window.jQuery && modalElement) {
            window.jQuery(modalElement).modal("hide");
        }
    }

    function showProductDeactivateModal(modalElement) {
        if (window.jQuery && modalElement) {
            window.jQuery(modalElement).modal("show");
        }
    }

    function syncInventoryView(tableBody, searchInput, totalStockElement, alertProductsElement, lastActivityElement, alertsContainerElement, state) {
        renderInventory(tableBody, state.inventoryRows);
        filterInventoryRows(tableBody, searchInput ? searchInput.value : "");
        renderDashboardCards(
            totalStockElement,
            alertProductsElement,
            lastActivityElement,
            alertsContainerElement,
            state.inventoryRows,
            state.movements
        );
    }

    function formatMovementUserLabel(userId, currentUserId) {
        if (!userId) {
            return "-";
        }
        if (currentUserId && Number(userId) === Number(currentUserId)) {
            return "Tu usuario (#" + String(userId) + ")";
        }
        return "Usuario #" + String(userId);
    }

    function formatMovementDate(dateValue) {
        if (!dateValue) {
            return "-";
        }

        if (typeof dateValue === "string") {
            return new Date(dateValue).toLocaleString();
        }

        return new Date(Number(dateValue) * 1000).toLocaleString();
    }

    function normalizeMovementType(value) {
        return String(value || "").trim().toLowerCase();
    }

    function filterMovementsByType(movements, movementType) {
        var normalizedType = normalizeMovementType(movementType);
        if (!normalizedType || normalizedType === "all") {
            return movements || [];
        }
        return (movements || []).filter(function (movement) {
            return normalizeMovementType(movement && movement.movement_type) === normalizedType;
        });
    }

    function setActiveFilterButton(container, filterValue) {
        if (!container) {
            return;
        }
        var buttons = container.querySelectorAll("button[data-filter]");
        Array.prototype.forEach.call(buttons, function (button) {
            var isActive = String(button.getAttribute("data-filter") || "").toLowerCase() === String(filterValue || "").toLowerCase();
            button.classList.toggle("active", isActive);
        });
    }

    function renderMovements(tableBody, movements, productMap, currentUserId) {
        tableBody.innerHTML = "";

        if (!movements.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 7;
            emptyCell.className = "text-muted";
            emptyCell.textContent = "No hay movimientos registrados.";
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        movements.forEach(function (movement) {
            var product = productMap[String(movement.product_id)] || null;
            var tr = document.createElement("tr");

            function td(text) {
                var cell = document.createElement("td");
                cell.textContent = text;
                return cell;
            }

            tr.appendChild(td(String(movement.id)));
            tr.appendChild(td(product ? product.sku : "Producto #" + movement.product_id));
            tr.appendChild(td(product ? product.name : "Producto #" + movement.product_id));
            tr.appendChild(td(String(movement.movement_type || "")));
            tr.appendChild(td(String(movement.quantity || 0)));
            tr.appendChild(td(formatMovementUserLabel(movement.user_id, currentUserId)));
            tr.appendChild(td(formatMovementDate(movement.created_at)));
            tableBody.appendChild(tr);
        });
    }

    function renderProductOptions(select, products) {
        select.innerHTML = "";

        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = products.length ? "Selecciona un producto" : "No hay productos";
        select.appendChild(placeholder);

        products.filter(isActiveProduct).forEach(function (product) {
            var option = document.createElement("option");
            option.value = String(product.id);
            option.textContent = product.sku + " - " + product.name;
            select.appendChild(option);
        });
    }

    if (!window.authService || !getStoredAccessToken()) {
        redirectToLogin();
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var pageFeedback = document.getElementById("inventory-feedback");
        var branchIdInput = document.getElementById("inventory-branch-id");
        var reloadButton = document.getElementById("inventory-reload");
        var inventoryBody = document.getElementById("inventory-table-body");
        var movementsBody = document.getElementById("movements-table-body");
        var movementForm = document.getElementById("movement-form");
        var movementFeedback = document.getElementById("movement-feedback");
        var movementWarning = document.getElementById("movement-warning");
        var productSelect = document.getElementById("movement-product");
        var typeSelect = document.getElementById("movement-type");
        var quantityInput = document.getElementById("movement-quantity");
        var referenceInput = document.getElementById("movement-reference");
        var submitButton = document.getElementById("movement-submit");
        var totalStockCard = document.getElementById("total-stock-card");
        var alertProductsCard = document.getElementById("alert-products-card");
        var lastActivityCard = document.getElementById("last-activity-card");
        var liveAlertsContainer = document.getElementById("live-alerts-container");
        var searchProductInput = document.getElementById("search-product-input");
        var bajaProductoModal = document.getElementById("bajaProductoModal");
        var confirmarBajaProductoButton = document.getElementById("confirmar-baja-producto");
        var movementsFilterGroup = document.querySelector("[aria-label='Filtro de movimientos']");

        if (!pageFeedback || !branchIdInput || !reloadButton || !inventoryBody || !movementsBody || !movementForm || !movementFeedback || !movementWarning || !productSelect || !typeSelect || !quantityInput || !referenceInput || !submitButton) {
            return;
        }

        var state = {
            products: [],
            productMap: {},
            inventoryRows: [],
            movements: [],
            movementsFilter: "all",
            submitting: false,
            currentUserId: null,
            pendingDeactivateProductId: null
        };

        pageFeedback.classList.add("d-none");
        movementFeedback.classList.add("d-none");
        movementWarning.classList.add("d-none");

        function showGlobalHttpError(targetElement, status) {
            if (!targetElement) {
                return;
            }
            setFeedback(targetElement, "danger", getBootstrapAlertMessage(status));
            targetElement.classList.remove("d-none");
        }

        function withHttpInterceptor(promise, feedbackElement) {
            return promise.catch(function (error) {
                if (error && error.status === 401) {
                    window.authService.clearSession();
                    redirectToLogin();
                    throw error;
                }

                if (error && error.status === 500) {
                    showGlobalHttpError(feedbackElement || pageFeedback, 500);
                }

                throw error;
            });
        }

        function getCurrentBranchId() {
            return parsePositiveInt(branchIdInput.value);
        }

        function getCurrentStock(productId) {
            var stock = 0;

            state.inventoryRows.forEach(function (row) {
                if (Number(row.product_id) === Number(productId)) {
                    stock = Number(row.quantity || 0);
                }
            });

            return stock;
        }

        function setSubmitting(isSubmitting) {
            state.submitting = isSubmitting;
            submitButton.textContent = isSubmitting ? "Registrando..." : "Registrar movimiento";
            validateMovementForm();
        }

        function validateMovementForm() {
            var productId = parsePositiveInt(productSelect.value);
            var quantity = parsePositiveInt(quantityInput.value);
            var branchId = getCurrentBranchId();
            var movementType = String(typeSelect.value || "").trim().toLowerCase();
            var canSubmit = !state.submitting && !!productId && !!quantity && !!branchId && state.products.length > 0;
            var warningMessage = "";

            if (movementType === "salida" && productId && quantity) {
                var currentStock = getCurrentStock(productId);
                if (quantity > currentStock) {
                    canSubmit = false;
                    warningMessage = "No hay suficiente stock disponible. Operacion rechazada.";
                }
            }

            submitButton.disabled = !canSubmit;

            if (warningMessage) {
                setFeedback(movementWarning, "warning", warningMessage);
                movementWarning.classList.remove("d-none");
            } else {
                movementWarning.classList.add("d-none");
            }
        }

        function handleLoadError(error) {
            if (error && (error.status === 401 || error.status === 403)) {
                window.authService.clearSession();
                redirectToLogin();
                return;
            }

            renderProductOptions(productSelect, state.products);
            renderInventory(inventoryBody, []);
            renderMovements(movementsBody, filterMovementsByType([], state.movementsFilter), state.productMap, state.currentUserId);
            state.inventoryRows = [];
            state.movements = [];
            renderDashboardCards(totalStockCard, alertProductsCard, lastActivityCard, liveAlertsContainer, state.inventoryRows, state.movements);

            if (error && error.status === 404) {
                setFeedback(pageFeedback, "danger", "La sucursal indicada no existe en el backend.");
            } else if (state.products.length) {
                setFeedback(pageFeedback, "warning", "Se cargaron los productos, pero no fue posible cargar inventario o movimientos.");
            } else {
                setFeedback(pageFeedback, "danger", "No fue posible cargar productos, inventario o movimientos.");
            }

            pageFeedback.classList.remove("d-none");
            validateMovementForm();
        }

        function loadPageData() {
            var branchId = getCurrentBranchId();

            if (!branchId) {
                setFeedback(pageFeedback, "danger", "Ingresa un Branch ID valido para consultar inventario.");
                pageFeedback.classList.remove("d-none");
                renderProductOptions(productSelect, state.products);
                renderInventory(inventoryBody, []);
                renderMovements(movementsBody, filterMovementsByType([], state.movementsFilter), {}, state.currentUserId);
                renderDashboardCards(totalStockCard, alertProductsCard, lastActivityCard, liveAlertsContainer, [], []);
                submitButton.disabled = true;
                return Promise.resolve();
            }

            setFeedback(pageFeedback, "info", "Cargando inventario y movimientos...");
            pageFeedback.classList.remove("d-none");

            return withHttpInterceptor(window.productsService.listProducts(), pageFeedback).then(function (products) {
                state.products = products || [];
                state.productMap = indexProductsById(state.products);
                renderProductOptions(productSelect, state.products);

                return withHttpInterceptor(Promise.all([
                    window.inventoryService.listInventory(branchId),
                    window.inventoryService.listMovements(branchId, 20)
                ]), pageFeedback).then(function (results) {
                    state.inventoryRows = mergeInventory(state.products, results[0] || []);
                    state.movements = results[1] || [];

                    syncInventoryView(
                        inventoryBody,
                        searchProductInput,
                        totalStockCard,
                        alertProductsCard,
                        lastActivityCard,
                        liveAlertsContainer,
                        state
                    );
                    renderMovements(movementsBody, filterMovementsByType(state.movements, state.movementsFilter), state.productMap, state.currentUserId);

                    if (!state.products.length) {
                        setFeedback(pageFeedback, "warning", "No hay productos creados. Crea productos antes de registrar movimientos.");
                        pageFeedback.classList.remove("d-none");
                    } else {
                        pageFeedback.classList.add("d-none");
                    }

                    validateMovementForm();
                });
            }).catch(function (error) {
                handleLoadError(error);
            });
        }

        withHttpInterceptor(window.authService.fetchProfile(), pageFeedback).then(function (profile) {
            state.currentUserId = profile && profile.sub ? Number(profile.sub) : null;
            return loadPageData();
        }).catch(function (error) {
            if (error && error.status === 401) {
                return;
            }
            setFeedback(pageFeedback, "danger", "No fue posible validar la sesion actual.");
            pageFeedback.classList.remove("d-none");
        });

        reloadButton.addEventListener("click", function () {
            loadPageData();
        });

        if (searchProductInput) {
            searchProductInput.addEventListener("input", function () {
                filterInventoryRows(inventoryBody, searchProductInput.value);
            });
        }

        if (movementsFilterGroup) {
            movementsFilterGroup.addEventListener("click", function (event) {
                var button = event.target.closest("button[data-filter]");
                var filterValue;
                if (!button) {
                    return;
                }
                filterValue = button.getAttribute("data-filter") || "all";
                state.movementsFilter = filterValue;
                setActiveFilterButton(movementsFilterGroup, state.movementsFilter);
                renderMovements(movementsBody, filterMovementsByType(state.movements, state.movementsFilter), state.productMap, state.currentUserId);
            });
            setActiveFilterButton(movementsFilterGroup, state.movementsFilter);
        }

        inventoryBody.addEventListener("click", function (event) {
            var deleteButton = event.target.closest("button[data-id]");

            if (!deleteButton) {
                return;
            }

            state.pendingDeactivateProductId = parsePositiveInt(deleteButton.getAttribute("data-id"));

            if (!state.pendingDeactivateProductId) {
                setFeedback(pageFeedback, "danger", "No fue posible identificar el producto seleccionado.");
                pageFeedback.classList.remove("d-none");
                return;
            }

            showProductDeactivateModal(bajaProductoModal);
        });

        if (confirmarBajaProductoButton) {
            confirmarBajaProductoButton.addEventListener("click", function () {
                var productId = state.pendingDeactivateProductId;
                var productIndex;

                if (!productId) {
                    hideProductDeactivateModal(bajaProductoModal);
                    return;
                }

                confirmarBajaProductoButton.disabled = true;

                withHttpInterceptor(window.httpClient.request("/api/products/" + encodeURIComponent(productId), {
                    method: "DELETE",
                    headers: window.authService.getAuthorizationHeaders()
                }), pageFeedback)
                    .then(function () {
                        productIndex = state.products.findIndex(function (product) {
                            return Number(product.id) === Number(productId);
                        });

                        if (productIndex !== -1) {
                            state.products.splice(productIndex, 1);
                        }

                        state.productMap = indexProductsById(state.products);
                        state.inventoryRows = state.inventoryRows.filter(function (row) {
                            return Number(row.product_id) !== Number(productId);
                        });

                        syncInventoryView(
                            inventoryBody,
                            searchProductInput,
                            totalStockCard,
                            alertProductsCard,
                            lastActivityCard,
                            liveAlertsContainer,
                            state
                        );
                        renderProductOptions(productSelect, state.products);
                        validateMovementForm();
                        hideProductDeactivateModal(bajaProductoModal);
                        setFeedback(pageFeedback, "success", "Producto dado de baja correctamente.");
                        pageFeedback.classList.remove("d-none");
                    }).catch(function (error) {
                        var message = "No fue posible dar de baja el producto.";

                        if (error && error.data && error.data.message) {
                            message = error.data.message;
                        } else if (error && error.message) {
                            message = error.message;
                        }

                        setFeedback(pageFeedback, "danger", message);
                        pageFeedback.classList.remove("d-none");
                    }).then(function () {
                        confirmarBajaProductoButton.disabled = false;
                        state.pendingDeactivateProductId = null;
                    });
            });
        }

        if (window.jQuery && bajaProductoModal) {
            window.jQuery(bajaProductoModal).on("hidden.bs.modal", function () {
                state.pendingDeactivateProductId = null;
                confirmarBajaProductoButton.disabled = false;
            });
        }

        branchIdInput.addEventListener("input", validateMovementForm);
        productSelect.addEventListener("change", validateMovementForm);
        typeSelect.addEventListener("change", validateMovementForm);
        quantityInput.addEventListener("input", validateMovementForm);

        movementForm.addEventListener("submit", function (event) {
            var branchId = getCurrentBranchId();
            var productId = parsePositiveInt(productSelect.value);
            var quantity = parsePositiveInt(quantityInput.value);
            var movementType = String(typeSelect.value || "").trim().toLowerCase();
            var reference = String(referenceInput.value || "").trim();

            event.preventDefault();
            movementFeedback.classList.add("d-none");
            validateMovementForm();

            if (submitButton.disabled) {
                return;
            }

            if (!branchId || !productId || !quantity) {
                setFeedback(movementFeedback, "danger", "Completa branch, producto y cantidad.");
                movementFeedback.classList.remove("d-none");
                return;
            }

            setSubmitting(true);
            setFeedback(movementFeedback, "info", "Registrando movimiento...");
            movementFeedback.classList.remove("d-none");

            withHttpInterceptor(window.inventoryService.createMovement({
                branch_id: branchId,
                product_id: productId,
                movement_type: movementType,
                quantity: quantity,
                reference: reference || null
            }), movementFeedback).then(function () {
                setFeedback(movementFeedback, "success", "Movimiento registrado correctamente.");
                movementFeedback.classList.remove("d-none");
                quantityInput.value = "";
                referenceInput.value = "";
                typeSelect.value = "entrada";
                setSubmitting(false);
                loadPageData();
            }).catch(function (error) {
                var apiError = error && error.data && error.data.error;
                var message = "No fue posible registrar el movimiento.";

                if (apiError === "negative_stock_rejected") {
                    message = "No hay suficiente stock disponible. Operacion rechazada.";
                } else if (apiError === "not_found") {
                    message = error.data && error.data.message ? error.data.message : "Sucursal o producto no encontrado.";
                } else if (apiError === "validation_error" && error.data && error.data.message) {
                    message = error.data.message;
                } else if (error && error.message) {
                    message = error.message;
                }

                setFeedback(movementFeedback, "danger", message);
                movementFeedback.classList.remove("d-none");
                setSubmitting(false);
                validateMovementForm();
            });
        });
    });
})(window, document);
