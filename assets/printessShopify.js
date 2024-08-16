/*Printess Shopify Integration Version: 2.4*/const showPrintessEditorFallback = (itemId, loopCount = 0) => {
    const showMethodName = "openPrintessEditor" + itemId;
    if (typeof window[showMethodName] === "undefined") {
        const scriptTag = document.getElementById("printess_script_" + itemId);
        if (scriptTag) {
            const newTag = document.createElement('script');
            newTag.setAttribute("id", "printess_script_" + itemId);
            newTag.type = 'text/javascript';
            newTag.text = scriptTag.text;
            scriptTag.replaceWith(newTag);
            if (loopCount < 10) {
                setTimeout(function () {
                    showPrintessEditorFallback(itemId, ++loopCount);
                }, 200);
            }
            else {
                console.error(showMethodName + " not found.");
            }
            ;
        }
    }
    else {
        window[showMethodName]();
    }
};
const initPrintessShopifyEditor = (printessSettings) => {
    if (typeof window["printessShopifyEditor"] === "undefined") {
        const addToBasketButtonSelector = 'button[type="submit"][name="add"], button.product-form__add-button[data-action="add-to-cart"],button#AddToCart';
        const editor = {
            productCache: {},
            productFormSelector: 'form[data-type="add-to-cart-form"],form.product-single__form,form.shopify-product-form[id^=product-form-template],form[action="/cart/add"]',
            debounce: function (func, timeout = 300) {
                let timer = undefined;
                return (...args) => {
                    clearTimeout(timer);
                    timer = setTimeout(() => { func.apply(this, args); }, timeout);
                };
            },
            getCurrentProductOptionValues: (product) => {
                const ret = {};
                const form = editor.getAddToBasketForm(editor.productFormSelector);
                const parseName = function (name) {
                    if (name.indexOf("properties[") === 0 && name.lastIndexOf("]") === name.length - 1) {
                        name = name.substring(11, name.length - 1);
                    }
                    else if (name.indexOf("options[") === 0 && name.lastIndexOf("]") === name.length - 1) {
                        name = name.substring(11, name.length - 1);
                    }
                    return name;
                };
                //Parse inputs that are not in a form        
                document.querySelectorAll("input[data-option-name],select[data-option-name]").forEach((x) => {
                    if (!x.form) {
                        const name = parseName(x.getAttribute("data-option-name"));
                        const value = x.getAttribute("value");
                        if ((name.length > 0 && name[0] !== "_") && (x.getAttribute("type") !== "checkbox" || x.checked)) {
                            ret[name] = value;
                        }
                    }
                });
                if (form) {
                    const formName = form.getAttribute("name");
                    const formData = new FormData(form);
                    for (const pair of formData.entries()) {
                        let name = parseName(pair[0]);
                        if (printessSettings.supportsOptionPositionIndex === true) {
                            document.getElementsByName(pair[0]).forEach((x) => {
                                if (!formName || (x.getAttribute("form") === formName || (x.form && x.form.getAttribute("name") === formName))) {
                                    const dataOptionIndex = parseInt(x.getAttribute("data-option-position"));
                                    if (!isNaN(dataOptionIndex) && dataOptionIndex > 0) {
                                        if (product && product.options && product.options.length >= dataOptionIndex) {
                                            name = product.options[dataOptionIndex - 1];
                                        }
                                    }
                                }
                            });
                        }
                        if (name.length > 0 && name[0] !== "_") {
                            ret[name] = pair[1];
                        }
                    }
                    //Get all checkboxes that are checked
                    const checkBoxes = form.querySelectorAll('input[type="checkbox"]');
                    if (checkBoxes && checkBoxes.length > 0) {
                        for (let i = 0; i < checkBoxes.length; ++i) {
                            if (typeof checkBoxes[i].checked !== "undefined" && checkBoxes[i].checked === true) {
                                let name = parseName(checkBoxes[i].name);
                                if (printessSettings.supportsOptionPositionIndex === true) {
                                    const dataOptionIndex = parseInt(checkBoxes[i].getAttribute("data-option-position"));
                                    if (!isNaN(dataOptionIndex) && dataOptionIndex > 0) {
                                        if (product && product.options && product.options.length >= dataOptionIndex) {
                                            name = product.options[dataOptionIndex - 1];
                                        }
                                    }
                                }
                                if (name.length > 0 && name[0] !== "_") {
                                    ret[name] = "true";
                                }
                            }
                        }
                    }
                }
                return ret;
            },
            getOptionsLookup: (product) => {
                const optionLookup = {};
                if (!product || !product.options) {
                    return optionLookup;
                }
                for (let i = 0; i < product.options.length; ++i) {
                    optionLookup[product.options[i]] = i;
                    optionLookup["option" + (i + 1)] = i;
                }
                return optionLookup;
            },
            getProductOptionValuesForVariants: (productOptions, product) => {
                const optionLookup = editor.getOptionsLookup(product);
                const ret = {};
                for (const optionName in productOptions) {
                    if (productOptions.hasOwnProperty(optionName) && optionLookup[optionName] >= 0) {
                        ret[optionName] = productOptions[optionName];
                    }
                }
                return ret;
            },
            parseInputName: (name) => {
                name = (name || "").trim();
                if (name) {
                    if (name[name.length - 1] === "]") {
                        name = name.substr(0, name.length - 1);
                        const index = name.indexOf("[");
                        if (index > -1) {
                            name = name.substr(index + 1);
                        }
                    }
                }
                return name;
            },
            addVariantChangeHandler: (product, variantChangeCallback) => {
                const getFormFieldsKey = function (formFields) {
                    let ret = "";
                    for (const ffName in formFields) {
                        if (formFields.hasOwnProperty(ffName)) {
                            ret += ffName + ";" + formFields[ffName] + "_";
                        }
                    }
                    return ret;
                };
                const triggerVariantChange = () => {
                    editor.debounce(() => {
                        const key = getFormFieldsKey(editor.getProductOptionValuesForVariants(editor.getCurrentProductOptionValues(product), product));
                        if (editor.addVariantChangeHandler.lastValue != key) {
                            editor.addVariantChangeHandler.lastValue = key;
                            if (typeof variantChangeCallback === "function") {
                                variantChangeCallback(editor.getVariantByProductOptions(editor.getCurrentProductOptionValues(product), product, true));
                            }
                        }
                    }, 100)();
                };
                const form = editor.getAddToBasketForm(editor.productFormSelector);
                if (form) {
                    const inputs = [];
                    form.querySelectorAll("input,select").forEach(x => inputs.push(x));
                    document.querySelectorAll("input[form='" + form.getAttribute("id") + "'],select[form='" + form.getAttribute("id") + "']").forEach(x => inputs.push(x));
                    inputs.forEach((x) => {
                        if (x.nodeName.toLowerCase() === "select" || (x.getAttribute("type") || "").toLowerCase() === "radio") {
                            x.addEventListener("change", triggerVariantChange);
                        }
                    });
                }
            },
            getVariantByProductOptions: (formFields, product, returnDefaultVariantOnFail = false) => {
                const variantProductOptionValues = editor.getProductOptionValuesForVariants(formFields, product);
                const optionLookup = editor.getOptionsLookup(product);
                let variants = product.variants;
                for (const x in variantProductOptionValues) {
                    if (variantProductOptionValues.hasOwnProperty(x)) {
                        let optionIndex = typeof optionLookup[x] !== "undefined" && optionLookup[x] >= 0 ? optionLookup[x] : -1;
                        if (optionIndex > -1) {
                            variants = variants.filter((variant) => {
                                if (variant.options && variant.options.length > optionIndex) {
                                    if (variant.options[optionIndex] == variantProductOptionValues[x]) {
                                        return true;
                                    }
                                }
                            });
                        }
                    }
                }
                if (variants.length === 0) {
                    variants = product.variants;
                    for (const x in variantProductOptionValues) {
                        if (variantProductOptionValues.hasOwnProperty(x) && x.indexOf("option") === 0) {
                            variants = variants.filter((variant) => {
                                if (typeof variant[x] !== "undefined" && variant[x] === variantProductOptionValues[x]) {
                                    return true;
                                }
                            });
                        }
                    }
                }
                if (variants.length === 0 && !returnDefaultVariantOnFail) {
                    return null;
                }
                else {
                    if (variants.length === 0) {
                        return product.variants[0];
                    }
                    return variants[0];
                }
            },
            postMessage: (cmd, properties) => {
                const iFrame = document.getElementById("printess");
                if (iFrame) {
                    setTimeout(function () {
                        iFrame.contentWindow.postMessage({
                            cmd: cmd,
                            properties: properties || {}
                        }, "*");
                    }, 0);
                }
            },
            setFormFieldValue: (formField, value, formFieldLabel, valueLabel) => {
                //Radio buttons
                let inputs = document.querySelectorAll(`input[type="radio"]`);
                if (inputs && inputs.length > 0) {
                    inputs.forEach((el) => {
                        const initialName = editor.parseInputName(el.getAttribute('data-option-name') || el.getAttribute('data-name') || el.getAttribute('name') || undefined);
                        const initialValue = el.getAttribute('value') || undefined;
                        if (initialName === formField || initialName === formFieldLabel) {
                            if (initialValue === value || initialValue === valueLabel) {
                                el.setAttribute('checked', true.toString());
                                el.checked = true;
                            }
                            else {
                                el.removeAttribute('checked');
                                el.checked = false;
                            }
                        }
                    });
                }
                //In case select / drop down is used
                if (!inputs || inputs.length == 0) {
                    inputs = document.querySelectorAll(`select`);
                    inputs.forEach((el) => {
                        const name = editor.parseInputName(el.getAttribute('data-option-name') || el.getAttribute('data-name') || el.getAttribute('name'));
                        if (el.options) {
                            for (let i = 0; i < el.options.length; ++i) {
                                const _value = el.options[i].getAttribute('value');
                                if (name === formField || name === formFieldLabel) {
                                    if (_value === value || _value === valueLabel) {
                                        el.options[i].setAttribute('selected', true.toString());
                                        el.options[i].selected = true;
                                        el.setAttribute('value', value);
                                        el.value = value;
                                    }
                                    else {
                                        el.options[i].removeAttribute('selected');
                                        el.options[i].selected = false;
                                    }
                                }
                            }
                        }
                    });
                }
                //Text boxes
                inputs = document.querySelectorAll(`input[type="text"],input[type="color"],input[type="date"],input[type="datetime-local"],input[type="email"],input[type="month"],input[type="number"],input[type="tel"],input[type="time"],input[type="url"],input[type="week"]`);
                if (inputs && inputs.length > 0) {
                    inputs.forEach((el) => {
                        const name = editor.parseInputName(el.getAttribute('data-option-name') || el.getAttribute('data-name') || el.getAttribute('name'));
                        const value = el.getAttribute('value');
                        if (name === formField) {
                            el.setAttribute("value", value);
                        }
                        else if (name === formFieldLabel) {
                            el.setAttribute("value", valueLabel);
                        }
                    });
                }
            },
            setProductProperty: (settings, formField, value, formFieldLabel, valueLabel, useFallback = false) => {
                if (!settings.basketItemOptions) {
                    settings.basketItemOptions = {};
                }
                const formFieldName = !useFallback ? formField : formFieldLabel;
                const formFieldValue = !useFallback ? value : valueLabel;
                if (typeof settings.basketItemOptions[formFieldName] !== "undefined") {
                    settings.basketItemOptions[formFieldName] = formFieldValue;
                }
                else {
                    if (!useFallback) {
                        editor.setProductProperty(settings, formField, value, formFieldLabel, valueLabel, true);
                    }
                    else {
                        settings.basketItemOptions[formField] = value;
                    }
                }
            },
            initProductPage: (initialTemplateName, product, variantMetaData) => {
                if (initialTemplateName === null) {
                    return;
                }
                const showOrHideCustomizeButton = function (variant = null, initialCall = undefined) {
                    const selectedVariant = variant !== null ? variant : editor.getVariantByProductOptions(editor.getCurrentProductOptionValues(product), product, true);
                    let templateNameToUse = initialTemplateName || "";
                    if (selectedVariant && selectedVariant.templateName) {
                        templateNameToUse = selectedVariant.templateName;
                    }
                    const printessButton = window.document.getElementById("printessCustomizeButton" + product.id);
                    const showPrintessButton = selectedVariant !== null && !(typeof selectedVariant.available !== "undefined" && selectedVariant.available === false) && templateNameToUse;
                    editor.showOrHideElement({ elementSelector: 'button[name="add"], button.product-form__add-button[data-action="add-to-cart"],button#AddToCart' }, !showPrintessButton, "block");
                    editor.showOrHideElement({ elementSelector: 'button[type="button"].shopify-payment-button__button' }, !showPrintessButton, "block");
                    if (printessButton) {
                        printessButton.style.display = showPrintessButton ? "flex" : "none";
                        if (initialCall === true) {
                            printessButton.printessEditor = editor;
                        }
                    }
                };
                editor.addVariantChangeHandler(product, showOrHideCustomizeButton);
                showOrHideCustomizeButton(null, true);
            },
            showOrHideElement: (elementSelector, show, displayValue = "block", retryCount = 10) => {
                if (retryCount <= 0) {
                    return;
                }
                let element = typeof elementSelector.elementId !== "undefined" ? window.document.getElementById(elementSelector.elementId) : window.document.querySelectorAll(elementSelector.elementSelector);
                if (element && typeof element.length !== "undefined") {
                    if (element.length > 0) {
                        element = element[0];
                    }
                    else {
                        element = null;
                    }
                }
                if (element) {
                    if (!element.originalDisplayStyle) {
                        element.originalDisplayStyle = element.style.display || displayValue;
                    }
                    element.style.display = !show ? "none" : element.originalDisplayStyle;
                }
                else {
                    setTimeout(function () {
                        editor.showOrHideElement(elementSelector, show, displayValue, retryCount - 1);
                    }, 200);
                }
            },
            show: (settings) => {
                const shopContext = editor.createShopContext(settings);
                if (typeof window["initPrintessEditor"] === "function") {
                    const editor = window["initPrintessEditor"](printessSettings);
                    editor.show(shopContext);
                }
            },
            getAddToBasketForm(formSelector) {
                const forms = document.querySelectorAll(formSelector);
                if (forms.length === 1) {
                    return forms[0];
                }
                const button = document.querySelector(addToBasketButtonSelector);
                let ret;
                if (button) {
                    const form = forms.forEach((form) => {
                        if (!ret && form.contains(button)) {
                            ret = form;
                        }
                    });
                }
                return ret || forms[0];
            },
            createShopContext: (settings) => {
                const context = {
                    cameFromSave: false,
                    lastSaveSaveToken: "",
                    templateNameOrSaveToken: settings.templateNameOrSaveToken,
                    stickers: [],
                    legalText: settings.legalText || "",
                    legalTextUrl: settings.legalUrl || "",
                    snippetPrices: [],
                    chargeEachStickerUsage: false,
                    hidePricesInEditor: typeof printessSettings.hidePricesInEditor !== "undefined" && printessSettings.hidePricesInEditor === true,
                    showSplitterGridSizeButton: settings.showSplitterGridSizeButton,
                    additionalAttachParams: settings.additionalAttachParams,
                    getProductName: () => {
                        if (typeof printessSettings.displayProductName !== "undefined" && printessSettings.displayProductName === false) {
                            return "";
                        }
                        return settings.product ? settings.product.name || "" : "";
                    },
                    getPriceInfo: () => {
                        return null;
                    },
                    getFormFieldMappings: () => {
                        let ret = {};
                        if (context.__ffMappings) {
                            return context.__ffMappings;
                        }
                        if (settings.optionValueMappings) {
                            try {
                                const mappings = JSON.parse(settings.optionValueMappings);
                                if (mappings && typeof mappings !== "string" && typeof mappings !== "number" && !Array.isArray(mappings) && typeof mappings !== "boolean" && typeof mappings === "object") {
                                    ret = mappings;
                                    context.__ffMappings = ret;
                                }
                            }
                            catch {
                            }
                        }
                        return ret;
                    },
                    getMergeTemplates: () => {
                        if (settings.mergeTemplates) {
                            if (typeof settings.mergeTemplates === "string") {
                                return editor.parseMergeTemplates(settings.mergeTemplates);
                            }
                            else {
                                return settings.mergeTemplates;
                            }
                        }
                        return [];
                    },
                    formatMoney: (price) => {
                        const format = printessSettings.shopMoneyFormat ? printessSettings.shopMoneyFormat : "${{amount}}";
                        return editor.formatMoney(price, format); //parseFloat("" + (price / 100)).toFixed(2);
                    },
                    onFormFieldChanged: (formField, value, formFieldLabel, valueLabel) => {
                        if (typeof settings.basketItemId !== "undefined") {
                            //We are in basket view
                            editor.setProductProperty(settings, formField, value, formFieldLabel, valueLabel);
                        }
                        else {
                            editor.setFormFieldValue(formField, value, formFieldLabel, valueLabel);
                        }
                    },
                    onAddToBasket: (saveToken, thumbnailUrl) => {
                        const isSave = typeof settings.basketItemId !== "undefined";
                        if (!isSave) {
                            editor.addNewItemToBasket(settings, saveToken, thumbnailUrl);
                        }
                        else {
                            editor.replaceBasketItem(settings, saveToken, thumbnailUrl);
                        }
                        try {
                            if (typeof settings.onAddToBasket === "function") {
                                settings.onAddToBasket(saveToken, thumbnailUrl);
                            }
                        }
                        catch (e) {
                            console.error(e);
                        }
                    },
                    getCurrentFormFieldValues: () => {
                        return editor.getCurrentProductOptionValues(settings.product);
                    },
                    getPriceForFormFields: (formFields) => {
                        const variantRelevantOptions = editor.getProductOptionValuesForVariants(formFields, settings.product);
                        const variant = editor.getVariantByProductOptions(formFields, settings.product, true);
                        return variant.price;
                    },
                    getBasketId: () => {
                        return "Not yet implemented";
                    },
                    onRenderFirstPageImage: (thumbnailUrl) => {
                        if (context.cameFromSave && context.lastSaveSaveToken) {
                            try {
                                context.onSave(context.lastSaveSaveToken, thumbnailUrl, true);
                            }
                            catch (e) {
                                console.error(e);
                            }
                            context.cameFromSave = false;
                            context.lastSaveSaveToken = "";
                        }
                    },
                    onSave: (saveToken, thumbnailUrl, cameFromFirstpageImage = false) => {
                        context.cameFromSave = true;
                        context.lastSaveSaveToken = saveToken;
                        if (!cameFromFirstpageImage) {
                            editor.postMessage("renderFirstPageImage", null);
                        }
                        else {
                            try {
                                if (typeof settings.onSave === "function") {
                                    settings.onSave(saveToken, thumbnailUrl);
                                }
                            }
                            catch (e) {
                                console.error(e);
                            }
                        }
                    },
                    editorClosed: (closeButtonClicked) => {
                        if (closeButtonClicked) {
                            //Remove all printess inputs from the product form
                            editor.addOrRemoveTextField(editor.productFormSelector, "", [
                                "printessSaveTokenEdit" + settings.product.id,
                                "printessThumbnailEdit" + settings.product.id,
                                "printessProductDefinitionIdEdit" + settings.product.id,
                                "printessOutputTypeEdit" + settings.product.id,
                                "printessDpiEdit" + settings.product.id,
                                "printessOptionValueMappingsEdit" + settings.product.id,
                                "printessProductTypeEdit" + settings.product.id,
                                "printessThemeEdit" + settings.product.id
                            ], "");
                        }
                    }
                };
                if (!context.templateNameOrSaveToken) {
                    const currentVariant = editor.getVariantByProductOptions(editor.getCurrentProductOptionValues(settings.product), settings.product, false);
                    if (currentVariant && currentVariant.templateName) {
                        context.templateNameOrSaveToken = currentVariant.templateName;
                    }
                }
                return context;
            },
            parseMergeTemplates: (valueString) => {
                let ret = null;
                if (!valueString) {
                    return ret;
                }
                try {
                    const json = JSON.parse(valueString);
                    if (typeof json === "string") {
                        ret = [{
                                "templateName": json,
                                "mergeMode": "layout-snippet-no-repeat"
                            }];
                    }
                    else {
                        if (!Array.isArray(json)) {
                            ret = [json];
                        }
                        else {
                            ret = json;
                        }
                    }
                }
                catch (e) {
                    ret = [{
                            "templateName": valueString,
                            "mergeMode": "layout-snippet-no-repeat"
                        }];
                }
                if (ret) {
                    ret.forEach((x) => {
                        if (!x.mergeMode) {
                            x.mergeMode = "layout-snippet-no-repeat";
                        }
                    });
                }
                return ret;
            },
            getProductByHandle: async function (productHandle) {
                if (editor.productCache[productHandle]) {
                    return editor.productCache[productHandle];
                }
                let ret = null;
                await fetch('/products/' + encodeURIComponent(productHandle) + '.js').then(function (response) {
                    return response.json();
                }).then(function (product) {
                    const result = {
                        ...product,
                        name: product.title,
                        options: product.options ? product.options.map((x) => x.name) : []
                    };
                    editor.productCache[productHandle] = result;
                    ret = result;
                });
                return ret;
            },
            formatMoney: (cents, format) => {
                if (typeof cents == 'string') {
                    cents = parseInt(cents.replace('.', ''));
                }
                var value = '';
                var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
                var formatString = format;
                function defaultOption(opt, def) {
                    return (typeof opt == 'undefined' || opt === null ? def : opt);
                }
                function formatWithDelimiters(number, precision, thousands = null, decimal = null) {
                    precision = defaultOption(precision, 2);
                    thousands = defaultOption(thousands, ',');
                    decimal = defaultOption(decimal, '.');
                    if (isNaN(number) || number == null) {
                        return "0";
                    }
                    const numberStr = (number / 100.0).toFixed(precision);
                    var parts = numberStr.split('.'), dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands), cents = parts[1] ? (decimal + parts[1]) : '';
                    return dollars + cents;
                }
                switch (formatString.match(placeholderRegex)[1]) {
                    case 'amount':
                        value = formatWithDelimiters(cents, 2);
                        break;
                    case 'amount_no_decimals':
                        value = formatWithDelimiters(cents, 0);
                        break;
                    case 'amount_with_comma_separator':
                        value = formatWithDelimiters(cents, 2, '.', ',');
                        break;
                    case 'amount_no_decimals_with_comma_separator':
                        value = formatWithDelimiters(cents, 0, '.', ',');
                        break;
                }
                return formatString.replace(placeholderRegex, value);
            },
            addOrRemoveTextField: (formSelector, textFieldName, textFieldId, value) => {
                if (Array.isArray(textFieldId)) {
                    textFieldId.forEach((id) => {
                        editor.addOrRemoveTextField(formSelector, textFieldName, id, value);
                    });
                }
                else {
                    let button = document.getElementById(textFieldId);
                    if (value) {
                        const form = typeof formSelector === "string" ? editor.getAddToBasketForm(formSelector) : formSelector;
                        if (!button && form) {
                            button = document.createElement("input");
                            button.setAttribute("id", textFieldId);
                            button.setAttribute("name", textFieldName);
                            button.setAttribute("type", "hidden");
                            button.style.display = "none";
                            form.appendChild(button);
                        }
                        if (button) {
                            button.setAttribute("value", value);
                        }
                    }
                    else {
                        if (button) {
                            button.remove();
                        }
                    }
                }
            },
            addNewItemToBasket: (settings, saveToken, thumbnailUrl) => {
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessSaveToken]", "printessSaveTokenEdit" + settings.product.id, saveToken);
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessThumbnail]", "printessThumbnailEdit" + settings.product.id, thumbnailUrl);
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessProductDefinitionId]", "printessProductDefinitionIdEdit" + settings.product.id, settings.productDefinitionId);
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessOutputType]", "printessOutputTypeEdit" + settings.product.id, "" + settings.outputFormat || "pdf");
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessDpi]", "printessDpiEdit" + settings.product.id, "" + settings.outputDpi || "300");
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessOptionValueMappings]", "printessOptionValueMappingsEdit" + settings.product.id, "" + settings.optionValueMappings || "");
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessProductType]", "printessProductTypeEdit" + settings.product.id, settings.productType || "");
                editor.addOrRemoveTextField(editor.productFormSelector, "properties[_printessTheme]", "printessThemeEdit" + settings.product.id, printessSettings.theme || "");
                //in some cases the id field is not correctly set and we have to set it.
                const selectedOptions = editor.getCurrentProductOptionValues(settings.product);
                const variantRelatedOptions = editor.getProductOptionValuesForVariants(selectedOptions, settings.product);
                const selectedVariant = editor.getVariantByProductOptions(variantRelatedOptions, settings.product, true);
                if (selectedVariant && typeof selectedVariant.productDefinitionId !== "undefined" && (selectedVariant.productDefinitionId === -1 || selectedVariant.productDefinitionId > 0))
                    if (selectedVariant) {
                        const idSelectList = document.querySelectorAll("select[name='id']");
                        if (idSelectList && idSelectList.length > 0) {
                            const idSelect = idSelectList[0];
                            idSelect.value = selectedVariant.id.toString();
                            idSelect.setAttribute("value", selectedVariant.id.toString());
                            for (let i = 0; i < idSelect.options.length; ++i) {
                                idSelect.options[i].selected = idSelect.options[i].getAttribute("value") === selectedVariant.id.toString();
                            }
                        }
                        else {
                            const idInputs = document.querySelectorAll("input[name='id']");
                            if (idInputs && idInputs.length > 0) {
                                idInputs.forEach((idInput) => {
                                    idInput.setAttribute("value", selectedVariant.id.toString());
                                });
                            }
                        }
                    }
                const addToBasketButton = document.querySelector(addToBasketButtonSelector);
                if (addToBasketButton) {
                    addToBasketButton.click();
                }
            },
            replaceBasketItem: (settings, saveToken, thumbnailUrl) => {
                const variantRelatedOptions = editor.getProductOptionValuesForVariants(settings.basketItemOptions, settings.product);
                const selectedVariant = editor.getVariantByProductOptions(variantRelatedOptions, settings.product, true);
                fetch('/cart.js', {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }).then((result) => {
                    result.json().then((json) => {
                        const { items } = json;
                        const curr = items.find((item) => item.properties && item.properties._printessSaveToken ? item.properties && item.properties._printessSaveToken === settings.templateNameOrSaveToken : (item.id === (settings && settings.product && settings.product.variants && settings.product.variants.length > 0 ? settings.product.variants[0].id : settings.product.id)));
                        if (curr) {
                            const { key } = curr;
                            let basketItemProperties = { ...curr.properties };
                            if (settings.basketItemOptions) {
                                for (let property in settings.basketItemOptions) {
                                    if (curr.properties && curr.properties.hasOwnProperty(property) && settings.basketItemOptions.hasOwnProperty(property)) {
                                        basketItemProperties[property] = settings.basketItemOptions[property];
                                    }
                                }
                            }
                            basketItemProperties = {
                                ...basketItemProperties,
                                _printessSaveToken: saveToken,
                                _printessThumbnail: thumbnailUrl,
                                _printessProductDefinitionId: "" + settings.productDefinitionId,
                                _printessOutputType: "" + settings.outputFormat || "pdf",
                                _printessOptionValueMappings: settings.optionValueMappings,
                                _printessDpi: "" + settings.outputDpi || "300"
                            };
                            //At first remove the item
                            fetch('/cart/change.js', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    id: key,
                                    quantity: 0
                                }),
                            }).then((x) => {
                                //Now add a new item with the new variant id
                                fetch('/cart/add', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        items: [
                                            {
                                                id: selectedVariant.id,
                                                quantity: typeof settings.quantity !== "undefined" && settings.quantity > 1 ? settings.quantity : 1,
                                                properties: basketItemProperties
                                            }
                                        ]
                                    }),
                                }).then(() => {
                                    window.location.replace('/cart');
                                });
                                // window.location.reload();
                            });
                        }
                    });
                });
            },
            readBasketItemQuantityInput: (basketItemId) => {
                const test = "".toString();
                const customizeButton = document.getElementById("printessCustomizeButton" + basketItemId.toString());
                if (!customizeButton) {
                    return null;
                }
                const parent = customizeButton.closest(".cart-item");
                if (!parent) {
                    return null;
                }
                const input = parent.querySelector("input.quantity__input");
                if (input) {
                    return parseInt(input.getAttribute("value"));
                }
                return null;
            }
        };
        window["printessShopifyEditor"] = editor;
    }
    return window["printessShopifyEditor"];
};