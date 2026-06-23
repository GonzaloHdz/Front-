(function (window, document) {
    "use strict";

    function redirectToLogin() {
        window.location.replace("page-login.html");
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
            return new Date(Number(unixTimestamp) * 1000).toLocaleString();
        } catch (error) {
            return String(unixTimestamp);
        }
    }

    function indexProductsById(products) {
        var map = {};
        products.forEach(function (product) {
            map[String(product.id)] = product;
        });
        return map;
    }

    function getBranchStorageKey() {
        return "gestor_inventory_active_branch_id";
    }

    function getStoredBranchId() {
        var rawValue = null;
        try {
            rawValue = window.sessionStorage.getItem(getBranchStorageKey()) || window.localStorage.getItem(getBranchStorageKey());
        } catch (error) {
            return null;
        }
        return parsePositiveInt(rawValue);
    }

    function saveActiveBranchId(branchId) {
        try {
            window.sessionStorage.setItem(getBranchStorageKey(), String(branchId));
            window.localStorage.setItem(getBranchStorageKey(), String(branchId));
        } catch (error) {
        }
    }

    function getBranchRequestHeaders() {
        var token = null;
        var headers = {
            "Content-Type": "application/json"
        };

        if (window.authService && window.authService.getAccessToken) {
            token = window.authService.getAccessToken();
        }

        if (!token) {
            try {
                token = window.localStorage.getItem("token") || window.sessionStorage.getItem("token");
            } catch (error) {
                token = null;
            }
        }

        if (token) {
            headers.Authorization = "Bearer " + token;
        }

        return headers;
    }

    function fetchCompanyBranches() {
        return window.httpClient.request(window.APP_CONFIG.COMPANY_ENDPOINTS.BRANCHES, {
            method: "GET",
            headers: getBranchRequestHeaders()
        }).then(function (data) {
            return data && data.branches ? data.branches : [];
        }).catch(function (error) {
            console.error("Error cargando sucursales:", error);
            throw error;
        });
    }

    function mergeInventory(products, items) {
        var itemMap = {};
        var rows = [];

        items.forEach(function (item) {
            itemMap[String(item.product_id)] = item;
        });

        products.forEach(function (product) {
            var item = itemMap[String(product.id)] || null;
            rows.push({
                product_id: product.id,
                sku: product.sku,
                name: product.name,
                quantity: item ? item.quantity : 0,
                min_quantity: item ? item.min_quantity : 0,
                updated_at: item ? item.updated_at : null
            });
        });

        items.forEach(function (item) {
            if (!indexProductsById(products)[String(item.product_id)]) {
                rows.push({
                    product_id: item.product_id,
                    sku: "N/A",
                    name: "Producto #" + item.product_id,
                    quantity: item.quantity,
                    min_quantity: item.min_quantity,
                    updated_at: item.updated_at
                });
            }
        });

        return rows;
    }

    function renderInventory(tableBody, rows) {
        tableBody.innerHTML = "";

        if (!rows.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 6;
            emptyCell.className = "text-muted";
            emptyCell.textContent = "No hay productos o stock registrado para esta sucursal.";
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }

        rows.forEach(function (row, index) {
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
            tableBody.appendChild(tr);
        });
    }

    function renderMovements(tableBody, movements, productMap) {
        tableBody.innerHTML = "";

        if (!movements.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 6;
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
            tr.appendChild(td(formatTimestamp(movement.created_at)));
            tableBody.appendChild(tr);
        });
    }

    function renderProductOptions(select, products) {
        select.innerHTML = "";

        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = products.length ? "Selecciona un producto" : "No hay productos";
        select.appendChild(placeholder);

        products.forEach(function (product) {
            var option = document.createElement("option");
            option.value = String(product.id);
            option.textContent = product.sku + " - " + product.name;
            select.appendChild(option);
        });
    }

    if (!window.authService || !window.authService.getAccessToken()) {
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

        if (!pageFeedback || !branchIdInput || !reloadButton || !inventoryBody || !movementsBody || !movementForm || !movementFeedback || !movementWarning || !productSelect || !typeSelect || !quantityInput || !referenceInput || !submitButton) {
            return;
        }

        var state = {
            products: [],
            productMap: {},
            inventoryRows: [],
            movements: [],
            submitting: false,
            branches: [],
            activeBranch: null
        };

        pageFeedback.classList.add("d-none");
        movementFeedback.classList.add("d-none");
        movementWarning.classList.add("d-none");

        function getCurrentBranchId() {
            return parsePositiveInt(branchIdInput.value);
        }

        function resolveActiveBranch(branches) {
            var storedBranchId = getStoredBranchId();
            var selectedBranch = null;

            if (!branches.length) {
                return null;
            }

            if (storedBranchId) {
                branches.forEach(function (branch) {
                    if (!selectedBranch && Number(branch.id) === Number(storedBranchId) && Number(branch.is_active ? 1 : 0) === 1) {
                        selectedBranch = branch;
                    }
                });
            }

            if (!selectedBranch) {
                selectedBranch = branches.filter(function (branch) {
                    return Number(branch.is_active ? 1 : 0) === 1;
                })[0] || branches[0];
            }

            return selectedBranch || null;
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
            renderMovements(movementsBody, [], state.productMap);
            state.inventoryRows = [];
            state.movements = [];

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
                renderMovements(movementsBody, [], {});
                submitButton.disabled = true;
                return Promise.resolve();
            }

            setFeedback(pageFeedback, "info", "Cargando inventario y movimientos...");
            pageFeedback.classList.remove("d-none");

            return window.productsService.listProducts().then(function (products) {
                state.products = products || [];
                state.productMap = indexProductsById(state.products);
                renderProductOptions(productSelect, state.products);

                return Promise.all([
                    window.inventoryService.listInventory(branchId),
                    window.inventoryService.listMovements(branchId, 20)
                ]).then(function (results) {
                    state.inventoryRows = mergeInventory(state.products, results[0] || []);
                    state.movements = results[1] || [];

                    renderInventory(inventoryBody, state.inventoryRows);
                    renderMovements(movementsBody, state.movements, state.productMap);

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

        window.authService.fetchProfile().then(function () {
            return initializeBranchContext();
        }).then(function (branchId) {
            if (!branchId) {
                return null;
            }
            return loadPageData();
        }).catch(function (error) {
            console.error("Error inicializando inventario:", error);
            if (pageFeedback) {
                setFeedback(pageFeedback, "danger", "No fue posible cargar las sucursales o el perfil. Revisa la consola para ver el error real del servidor.");
                pageFeedback.classList.remove("d-none");
            }
            renderInventory(inventoryBody, []);
            renderMovements(movementsBody, [], state.productMap);
            submitButton.disabled = true;
        });

        function initializeBranchContext() {
            return fetchCompanyBranches().then(function (branches) {
                state.branches = branches || [];
                state.activeBranch = resolveActiveBranch(state.branches);

                if (!state.activeBranch) {
                    setFeedback(pageFeedback, "danger", "No existe una sucursal activa para esta empresa. Completa el onboarding o verifica el backend.");
                    pageFeedback.classList.remove("d-none");
                    branchIdInput.value = "";
                    reloadButton.disabled = true;
                    submitButton.disabled = true;
                    renderInventory(inventoryBody, []);
                    renderMovements(movementsBody, [], state.productMap);
                    return null;
                }

                branchIdInput.value = String(state.activeBranch.id);
                branchIdInput.readOnly = true;
                reloadButton.disabled = false;
                saveActiveBranchId(state.activeBranch.id);
                setFeedback(pageFeedback, "info", "Sucursal activa detectada: " + String(state.activeBranch.name || ("#" + state.activeBranch.id)));
                pageFeedback.classList.remove("d-none");
                return state.activeBranch.id;
            }).catch(function (error) {
                console.error("Error cargando sucursales:", error);
                setFeedback(pageFeedback, "danger", "No fue posible cargar las sucursales de la empresa. Revisa la consola para inspeccionar la respuesta del servidor.");
                pageFeedback.classList.remove("d-none");
                branchIdInput.value = "";
                reloadButton.disabled = true;
                submitButton.disabled = true;
                renderInventory(inventoryBody, []);
                renderMovements(movementsBody, [], state.productMap);
                return null;
            });
        }

        reloadButton.addEventListener("click", function () {
            initializeBranchContext().then(function (branchId) {
                if (branchId) {
                    loadPageData();
                }
            });
        });

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

            window.inventoryService.createMovement({
                branch_id: branchId,
                product_id: productId,
                movement_type: movementType,
                quantity: quantity,
                reference: reference || null
            }).then(function () {
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
