/*******************************************************************************
 * Copyright 2018 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "carousel";

    var keyCodes = {
        SPACE: 32,
        END: 35,
        HOME: 36,
        ARROW_LEFT: 37,
        ARROW_UP: 38,
        ARROW_RIGHT: 39,
        ARROW_DOWN: 40
    };

    var selectors = {
        self: "[data-" +  NS + '-is="' + IS + '"]'
    };

    var properties = {
        /**
         * Determines whether the Carousel will automatically transition between slides
         *
         * @memberof Carousel
         * @type {Boolean}
         * @default false
         */
        "autoplay": {
            "default": false,
            "transform": function(value) {
                return !(value === null || typeof value === "undefined");
            }
        },
        /**
         * Duration (in milliseconds) before automatically transitioning to the next slide
         *
         * @memberof Carousel
         * @type {Number}
         * @default 5000
         */
        "delay": {
            "default": 5000,
            "transform": function(value) {
                value = parseFloat(value);
                return !isNaN(value) ? value : null;
            }
        },
        /**
         * Determines whether automatic pause on hovering the carousel is disabled
         *
         * @memberof Carousel
         * @type {Boolean}
         * @default false
         */
        "autopauseDisabled": {
            "default": false,
            "transform": function(value) {
                return !(value === null || typeof value === "undefined");
            }
        }
    };

    /**
     * Carousel Configuration
     *
     * @typedef {Object} CarouselConfig Represents a Carousel configuration
     * @property {HTMLElement} element The HTMLElement representing the Carousel
     * @property {Object} options The Carousel options
     */

    /**
     * Carousel
     *
     * @class Carousel
     * @classdesc An interactive Carousel component for navigating a list of generic items
     * @param {CarouselConfig} config The Carousel configuration
     */
    function Carousel(config) {
        var that = this;

        if (config && config.element) {
            init(config);
        }

        /**
         * Initializes the Carousel
         *
         * @private
         * @param {CarouselConfig} config The Carousel configuration
         */
        function init(config) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");

            setupProperties(config.options);
            cacheElements(config.element);

            that._active = 0;
            that._paused = false;

            if (that._elements.item) {
                refreshActive();
                bindEvents();
                resetAutoplayInterval();
                refreshPlayPauseActions();
            }

            if (window.Granite && window.Granite.author && window.Granite.author.MessageChannel) {
                /*
                 * Editor message handling:
                 * - subscribe to "cmp.panelcontainer" message requests sent by the editor frame
                 * - check that the message data panel container type is correct and that the id (path) matches this specific Carousel component
                 * - if so, route the "navigate" operation to enact a navigation of the Carousel based on index data
                 */
                new window.Granite.author.MessageChannel("cqauthor", window).subscribeRequestMessage("cmp.panelcontainer", function(message) {
                    if (message.data && message.data.type === "cmp-carousel" && message.data.id === that._elements.self.dataset["cmpPanelcontainerId"]) {
                        if (message.data.operation === "navigate") {
                            navigate(message.data.index);
                        }
                    }
                });
            }
        }

        /**
         * Caches the Carousel elements as defined via the {@code data-carousel-hook="ELEMENT_NAME"} markup API
         *
         * @private
         * @param {HTMLElement} wrapper The Carousel wrapper element
         */
        function cacheElements(wrapper) {
            that._elements = {};
            that._elements.self = wrapper;
            var hooks = that._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

            for (var i = 0; i < hooks.length; i++) {
                var hook = hooks[i];
                var capitalized = IS;
                capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
                var key = hook.dataset[NS + "Hook" + capitalized];
                if (that._elements[key]) {
                    if (!Array.isArray(that._elements[key])) {
                        var tmp = that._elements[key];
                        that._elements[key] = [tmp];
                    }
                    that._elements[key].push(hook);
                } else {
                    that._elements[key] = hook;
                }
            }
        }

        /**
         * Sets up properties for the Carousel based on the passed options.
         *
         * @private
         * @param {Object} options The Carousel options
         */
        function setupProperties(options) {
            that._properties = {};

            for (var key in properties) {
                if (properties.hasOwnProperty(key)) {
                    var property = properties[key];
                    var value = null;

                    if (options && options[key] != null) {
                        value = options[key];

                        // transform the provided option
                        if (property && typeof property.transform === "function") {
                            value = property.transform(value);
                        }
                    }

                    if (value === null) {
                        // value still null, take the property default
                        value = properties[key]["default"];
                    }

                    that._properties[key] = value;
                }
            }
        }

        /**
         * Binds Carousel event handling
         *
         * @private
         */
        function bindEvents() {
            if (that._elements["previous"]) {
                that._elements["previous"].addEventListener("click", function() {
                    navigate(getPreviousIndex());
                });
            }

            if (that._elements["next"]) {
                that._elements["next"].addEventListener("click", function() {
                    navigate(getNextIndex());
                });
            }

            var indicators = that._elements["indicator"];
            if (indicators) {
                for (var i = 0; i < indicators.length; i++) {
                    (function(index) {
                        indicators[i].addEventListener("click", function(event) {
                            navigateAndFocusIndicator(index);
                        });
                    })(i);
                }
            }

            if (that._elements["pause"]) {
                if (that._properties.autoplay) {
                    that._elements["pause"].addEventListener("click", onPauseClick);
                }
            }

            if (that._elements["play"]) {
                if (that._properties.autoplay) {
                    that._elements["play"].addEventListener("click", onPlayClick);
                }
            }

            that._elements.self.addEventListener("keydown", onKeyDown);

            if (!that._properties.autopauseDisabled) {
                that._elements.self.addEventListener("mouseenter", onMouseEnter);
                that._elements.self.addEventListener("mouseleave", onMouseLeave);
            }
        }

        /**
         * Handles carousel keydown events
         *
         * @private
         * @param {Object} event The keydown event
         */
        function onKeyDown(event) {
            var index = that._active;
            var lastIndex = that._elements["indicator"].length - 1;

            switch (event.keyCode) {
                case keyCodes.ARROW_LEFT:
                case keyCodes.ARROW_UP:
                    event.preventDefault();
                    if (index > 0) {
                        navigateAndFocusIndicator(index - 1);
                    }
                    break;
                case keyCodes.ARROW_RIGHT:
                case keyCodes.ARROW_DOWN:
                    event.preventDefault();
                    if (index < lastIndex) {
                        navigateAndFocusIndicator(index + 1);
                    }
                    break;
                case keyCodes.HOME:
                    event.preventDefault();
                    navigateAndFocusIndicator(0);
                    break;
                case keyCodes.END:
                    event.preventDefault();
                    navigateAndFocusIndicator(lastIndex);
                    break;
                case keyCodes.SPACE:
                    if (that._properties.autoplay && (event.target !== that._elements["previous"] && event.target !== that._elements["next"])) {
                        event.preventDefault();
                        if (!that._paused) {
                            pause();
                        } else {
                            play();
                        }
                    }
                    if (event.target === that._elements["pause"]) {
                        that._elements["play"].focus();
                    }
                    if (event.target === that._elements["play"]) {
                        that._elements["pause"].focus();
                    }
                    break;
                default:
                    return;
            }
        }

        /**
         * Handles carousel mouseenter events
         *
         * @private
         * @param {Object} event The mouseenter event
         */
        function onMouseEnter(event) {
            clearAutoplayInterval();
        }

        /**
         * Handles carousel mouseleave events
         *
         * @private
         * @param {Object} event The mouseleave event
         */
        function onMouseLeave(event) {
            resetAutoplayInterval();
        }

        /**
         * Handles pause element click events
         *
         * @private
         * @param {Object} event The click event
         */
        function onPauseClick(event) {
            pause();
            that._elements["play"].focus();
        }

        /**
         * Handles play element click events
         *
         * @private
         * @param {Object} event The click event
         */
        function onPlayClick() {
            play();
            that._elements["pause"].focus();
        }

        /**
         * Pauses the playing of the Carousel. Sets {@code Carousel#_paused} marker.
         * Only relevant when autoplay is enabled
         *
         * @private
         */
        function pause() {
            that._paused = true;
            clearAutoplayInterval();
            refreshPlayPauseActions();
        }

        /**
         * Enables the playing of the Carousel. Sets {@code Carousel#_paused} marker.
         * Only relevant when autoplay is enabled
         *
         * @private
         */
        function play() {
            that._paused = false;

            // If the Carousel is hovered, don't begin auto transitioning until the next mouse leave event
            var hovered = that._elements.self.parentElement.querySelector(":hover") === that._elements.self;
            if (that._properties.autopauseDisabled || !hovered) {
                resetAutoplayInterval();
            }

            refreshPlayPauseActions();
        }

        /**
         * Refreshes the play/pause action markup based on the {@code Carousel#_paused} state
         *
         * @private
         */
        function refreshPlayPauseActions() {
            setActionDisabled(that._elements["pause"], that._paused);
            setActionDisabled(that._elements["play"], !that._paused);
        }

        /**
         * Refreshes the item markup based on the current {@code Carousel#_active} index
         *
         * @private
         */
        function refreshActive() {
            var items = that._elements["item"];
            var indicators = that._elements["indicator"];

            if (items) {
                if (Array.isArray(items)) {
                    for (var i = 0; i < items.length; i++) {
                        if (i === parseInt(that._active)) {
                            items[i].classList.add("cmp-carousel__item--active");
                            items[i].removeAttribute("aria-hidden");
                            indicators[i].classList.add("cmp-carousel__indicator--active");
                            indicators[i].setAttribute("aria-selected", true);
                            indicators[i].setAttribute("tabindex", "0");
                        } else {
                            items[i].classList.remove("cmp-carousel__item--active");
                            items[i].setAttribute("aria-hidden", true);
                            indicators[i].classList.remove("cmp-carousel__indicator--active");
                            indicators[i].setAttribute("aria-selected", false);
                            indicators[i].setAttribute("tabindex", "-1");
                        }
                    }
                } else {
                    // only one item
                    items.classList.add("cmp-carousel__item--active");
                    indicators.classList.add("cmp-carousel__indicator--active");
                }
            }
        }

        /**
         * Focuses the element and prevents scrolling the element into view
         *
         * @param {HTMLElement} element Element to focus
         */
        function focusWithoutScroll(element) {
            var x = window.scrollX || window.pageXOffset;
            var y = window.scrollY || window.pageYOffset;
            element.focus();
            window.scrollTo(x, y);
        }

        /**
         * Retrieves the next active index, with looping
         *
         * @private
         * @returns {Number} Index of the next carousel item
         */
        function getNextIndex() {
            return that._active === (that._elements["item"].length - 1) ? 0 : that._active + 1;
        }

        /**
         * Retrieves the previous active index, with looping
         *
         * @private
         * @returns {Number} Index of the previous carousel item
         */
        function getPreviousIndex() {
            return that._active === 0 ? (that._elements["item"].length - 1) : that._active - 1;
        }

        /**
         * Navigates to the item at the provided index
         *
         * @private
         * @param {Number} index The index of the item to navigate to
         */
        function navigate(index) {
            if (index < 0 || index > (that._elements["item"].length - 1)) {
                return;
            }

            that._active = index;
            refreshActive();

            // reset the autoplay transition interval following navigation, if not already hovering the carousel
            if (that._elements.self.parentElement.querySelector(":hover") !== that._elements.self) {
                resetAutoplayInterval();
            }
        }

        /**
         * Navigates to the item at the provided index and ensures the active indicator gains focus
         *
         * @private
         * @param {Number} index The index of the item to navigate to
         */
        function navigateAndFocusIndicator(index) {
            navigate(index);
            focusWithoutScroll(that._elements["indicator"][index]);
        }

        /**
         * Starts/resets automatic slide transition interval
         *
         * @private
         */
        function resetAutoplayInterval() {
            if (that._paused || !that._properties.autoplay) {
                return;
            }
            clearAutoplayInterval();
            that._autoplayIntervalId = window.setInterval(function() {
                if (document.visibilityState && document.hidden) {
                    return;
                }
                var indicators = that._elements["indicators"];
                if (indicators !== document.activeElement && indicators.contains(document.activeElement)) {
                    // if an indicator has focus, ensure we switch focus following navigation
                    navigateAndFocusIndicator(getNextIndex());
                } else {
                    navigate(getNextIndex());
                }
            }, that._properties.delay);
        }

        /**
         * Clears/pauses automatic slide transition interval
         *
         * @private
         */
        function clearAutoplayInterval() {
            window.clearInterval(that._autoplayIntervalId);
            that._autoplayIntervalId = null;
        }

        /**
         * Sets the disabled state for an action and toggles the appropriate CSS classes
         *
         * @private
         * @param {HTMLElement} action Action to disable
         * @param {Boolean} [disable] {@code true} to disable, {@code false} to enable
         */
        function setActionDisabled(action, disable) {
            if (!action) {
                return;
            }
            if (disable !== false) {
                action.disabled = true;
                action.classList.add("cmp-carousel__action--disabled");
            } else {
                action.disabled = false;
                action.classList.remove("cmp-carousel__action--disabled");
            }
        }
    }

    /**
     * Reads options data from the Carousel wrapper element, defined via {@code data-cmp-*} data attributes
     *
     * @private
     * @param {HTMLElement} element The Carousel element to read options data from
     * @returns {Object} The options read from the component data attributes
     */
    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    /**
     * Document ready handler and DOM mutation observers. Initializes Carousel components as necessary.
     *
     * @private
     */
    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Carousel({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body             = document.querySelector("body");
        var observer         = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Carousel({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady());
    }

}());

/*******************************************************************************
 * Copyright 2017 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
if (window.Element && !Element.prototype.closest) {
    // eslint valid-jsdoc: "off"
    Element.prototype.closest =
        function(s) {
            "use strict";
            var matches = (this.document || this.ownerDocument).querySelectorAll(s);
            var el      = this;
            var i;
            do {
                i = matches.length;
                while (--i >= 0 && matches.item(i) !== el) {
                    // continue
                }
            } while ((i < 0) && (el = el.parentElement));
            return el;
        };
}

if (window.Element && !Element.prototype.matches) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(s) {
            "use strict";
            var matches = (this.document || this.ownerDocument).querySelectorAll(s);
            var i       = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {
                // continue
            }
            return i > -1;
        };
}

if (!Object.assign) {
    Object.assign = function(target, varArgs) { // .length of function is 2
        "use strict";
        if (target === null) {
            throw new TypeError("Cannot convert undefined or null to object");
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource !== null) {
                for (var nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

(function(arr) {
    "use strict";
    arr.forEach(function(item) {
        if (item.hasOwnProperty("remove")) {
            return;
        }
        Object.defineProperty(item, "remove", {
            configurable: true,
            enumerable: true,
            writable: true,
            value: function remove() {
                this.parentNode.removeChild(this);
            }
        });
    });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);

/*******************************************************************************
 * Copyright 2016 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "image";

    var EMPTY_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    var LAZY_THRESHOLD = 0;
    var SRC_URI_TEMPLATE_WIDTH_VAR = "{.width}";

    var selectors = {
        self: "[data-" + NS + '-is="' + IS + '"]',
        image: '[data-cmp-hook-image="image"]',
        map: '[data-cmp-hook-image="map"]',
        area: '[data-cmp-hook-image="area"]'
    };

    var lazyLoader = {
        "cssClass": "cmp-image__image--is-loading",
        "style": {
            "height": 0,
            "padding-bottom": "" // will be replaced with % ratio
        }
    };

    var properties = {
        /**
         * An array of alternative image widths (in pixels).
         * Used to replace a {.width} variable in the src property with an optimal width if a URI template is provided.
         *
         * @memberof Image
         * @type {Number[]}
         * @default []
         */
        "widths": {
            "default": [],
            "transform": function(value) {
                var widths = [];
                value.split(",").forEach(function(item) {
                    item = parseFloat(item);
                    if (!isNaN(item)) {
                        widths.push(item);
                    }
                });
                return widths;
            }
        },
        /**
         * Indicates whether the image should be rendered lazily.
         *
         * @memberof Image
         * @type {Boolean}
         * @default false
         */
        "lazy": {
            "default": false,
            "transform": function(value) {
                return !(value === null || typeof value === "undefined");
            }
        },
        /**
         * The image source.
         *
         * Can be a simple image source, or a URI template representation that
         * can be variable expanded - useful for building an image configuration with an alternative width.
         * e.g. '/path/image.coreimg{.width}.jpeg/1506620954214.jpeg'
         *
         * @memberof Image
         * @type {String}
         */
        "src": {
        }
    };

    var devicePixelRatio = window.devicePixelRatio || 1;

    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    function Image(config) {
        var that = this;

        function init(config) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");

            setupProperties(config.options);
            cacheElements(config.element);

            if (!that._elements.noscript) {
                return;
            }

            that._elements.container = that._elements.link ? that._elements.link : that._elements.self;

            unwrapNoScript();

            if (that._properties.lazy) {
                addLazyLoader();
            }

            if (that._elements.map) {
                that._elements.image.addEventListener("load", onLoad);
            }

            window.addEventListener("scroll", that.update);
            window.addEventListener("resize", onWindowResize);
            window.addEventListener("update", that.update);
            that._elements.image.addEventListener("cmp-image-redraw", that.update);
            that.update();
        }

        function loadImage() {
            var hasWidths = that._properties.widths && that._properties.widths.length > 0;
            var replacement = hasWidths ? "." + getOptimalWidth() : "";
            var url = that._properties.src.replace(SRC_URI_TEMPLATE_WIDTH_VAR, replacement);

            if (that._elements.image.getAttribute("src") !== url) {
                that._elements.image.setAttribute("src", url);
                if (!hasWidths) {
                    window.removeEventListener("scroll", that.update);
                }
            }

            if (that._lazyLoaderShowing) {
                that._elements.image.addEventListener("load", removeLazyLoader);
            }
        }

        function getOptimalWidth() {
            var container = that._elements.self;
            var containerWidth = container.clientWidth;
            while (containerWidth === 0 && container.parentNode) {
                container = container.parentNode;
                containerWidth = container.clientWidth;
            }
            var optimalWidth = containerWidth * devicePixelRatio;
            var len = that._properties.widths.length;
            var key = 0;

            while ((key < len - 1) && (that._properties.widths[key] < optimalWidth)) {
                key++;
            }

            return that._properties.widths[key].toString();
        }

        function addLazyLoader() {
            var width = that._elements.image.getAttribute("width");
            var height = that._elements.image.getAttribute("height");

            if (width && height) {
                var ratio = (height / width) * 100;
                var styles = lazyLoader.style;

                styles["padding-bottom"] = ratio + "%";

                for (var s in styles) {
                    if (styles.hasOwnProperty(s)) {
                        that._elements.image.style[s] = styles[s];
                    }
                }
            }
            that._elements.image.setAttribute("src", EMPTY_PIXEL);
            that._elements.image.classList.add(lazyLoader.cssClass);
            that._lazyLoaderShowing = true;
        }

        function unwrapNoScript() {
            var markup = decodeNoscript(that._elements.noscript.textContent.trim());
            var parser = new DOMParser();

            // temporary document avoids requesting the image before removing its src
            var temporaryDocument = parser.parseFromString(markup, "text/html");
            var imageElement = temporaryDocument.querySelector(selectors.image);
            imageElement.removeAttribute("src");
            that._elements.container.insertBefore(imageElement, that._elements.noscript);

            var mapElement = temporaryDocument.querySelector(selectors.map);
            if (mapElement) {
                that._elements.container.insertBefore(mapElement, that._elements.noscript);
            }

            that._elements.noscript.parentNode.removeChild(that._elements.noscript);
            if (that._elements.container.matches(selectors.image)) {
                that._elements.image = that._elements.container;
            } else {
                that._elements.image = that._elements.container.querySelector(selectors.image);
            }

            that._elements.map = that._elements.container.querySelector(selectors.map);
            that._elements.areas = that._elements.container.querySelectorAll(selectors.area);
        }

        function removeLazyLoader() {
            that._elements.image.classList.remove(lazyLoader.cssClass);
            for (var property in lazyLoader.style) {
                if (lazyLoader.style.hasOwnProperty(property)) {
                    that._elements.image.style[property] = "";
                }
            }
            that._elements.image.removeEventListener("load", removeLazyLoader);
            that._lazyLoaderShowing = false;
        }

        function isLazyVisible() {
            if (that._elements.container.offsetParent === null) {
                return false;
            }

            var wt = window.pageYOffset;
            var wb = wt + document.documentElement.clientHeight;
            var et = that._elements.container.getBoundingClientRect().top + wt;
            var eb = et + that._elements.container.clientHeight;

            return eb >= wt - LAZY_THRESHOLD && et <= wb + LAZY_THRESHOLD;
        }

        function resizeAreas() {
            if (that._elements.areas && that._elements.areas.length > 0) {
                for (var i = 0; i < that._elements.areas.length; i++) {
                    var width = that._elements.image.width;
                    var height = that._elements.image.height;

                    if (width && height) {
                        var relcoords = that._elements.areas[i].dataset.cmpRelcoords;
                        if (relcoords) {
                            var relativeCoordinates = relcoords.split(",");
                            var coordinates = new Array(relativeCoordinates.length);

                            for (var j = 0; j < coordinates.length; j++) {
                                if (j % 2 === 0) {
                                    coordinates[j] = parseInt(relativeCoordinates[j] * width);
                                } else {
                                    coordinates[j] = parseInt(relativeCoordinates[j] * height);
                                }
                            }

                            that._elements.areas[i].coords = coordinates;
                        }
                    }
                }
            }
        }

        function cacheElements(wrapper) {
            that._elements = {};
            that._elements.self = wrapper;
            var hooks = that._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

            for (var i = 0; i < hooks.length; i++) {
                var hook = hooks[i];
                var capitalized = IS;
                capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
                var key = hook.dataset[NS + "Hook" + capitalized];
                that._elements[key] = hook;
            }
        }

        function setupProperties(options) {
            that._properties = {};

            for (var key in properties) {
                if (properties.hasOwnProperty(key)) {
                    var property = properties[key];
                    if (options && options[key] != null) {
                        if (property && typeof property.transform === "function") {
                            that._properties[key] = property.transform(options[key]);
                        } else {
                            that._properties[key] = options[key];
                        }
                    } else {
                        that._properties[key] = properties[key]["default"];
                    }
                }
            }
        }

        function onWindowResize() {
            that.update();
            resizeAreas();
        }

        function onLoad() {
            resizeAreas();
        }

        that.update = function() {
            if (that._properties.lazy) {
                if (isLazyVisible()) {
                    loadImage();
                }
            } else {
                loadImage();
            }
        };

        if (config && config.element) {
            init(config);
        }
    }

    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Image({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body             = document.querySelector("body");
        var observer         = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Image({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady());
    }

    /*
        on drag & drop of the component into a parsys, noscript's content will be escaped multiple times by the editor which creates
        the DOM for editing; the HTML parser cannot be used here due to the multiple escaping
     */
    function decodeNoscript(text) {
        text = text.replace(/&(amp;)*lt;/g, "<");
        text = text.replace(/&(amp;)*gt;/g, ">");
        return text;
    }

})();

/*******************************************************************************
 * Copyright 2018 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/

/**
 * Element.matches()
 * https://developer.mozilla.org/enUS/docs/Web/API/Element/matches#Polyfill
 */
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

// eslint-disable-next-line valid-jsdoc
/**
 * Element.closest()
 * https://developer.mozilla.org/enUS/docs/Web/API/Element/closest#Polyfill
 */
if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
        "use strict";
        var el = this;
        if (!document.documentElement.contains(el)) {
            return null;
        }
        do {
            if (el.matches(s)) {
                return el;
            }
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
    };
}

/*******************************************************************************
 * Copyright 2018 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "tabs";

    var keyCodes = {
        END: 35,
        HOME: 36,
        ARROW_LEFT: 37,
        ARROW_UP: 38,
        ARROW_RIGHT: 39,
        ARROW_DOWN: 40
    };

    var selectors = {
        self: "[data-" +  NS + '-is="' + IS + '"]',
        active: {
            tab: "cmp-tabs__tab--active",
            tabpanel: "cmp-tabs__tabpanel--active"
        }
    };

    /**
     * Tabs Configuration
     *
     * @typedef {Object} TabsConfig Represents a Tabs configuration
     * @property {HTMLElement} element The HTMLElement representing the Tabs
     * @property {Object} options The Tabs options
     */

    /**
     * Tabs
     *
     * @class Tabs
     * @classdesc An interactive Tabs component for navigating a list of tabs
     * @param {TabsConfig} config The Tabs configuration
     */
    function Tabs(config) {
        var that = this;

        if (config && config.element) {
            init(config);
        }

        /**
         * Initializes the Tabs
         *
         * @private
         * @param {TabsConfig} config The Tabs configuration
         */
        function init(config) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");

            cacheElements(config.element);
            that._active = getActiveIndex(that._elements["tab"]);

            if (that._elements.tabpanel) {
                refreshActive();
                bindEvents();
            }

            if (window.Granite && window.Granite.author && window.Granite.author.MessageChannel) {
                /*
                 * Editor message handling:
                 * - subscribe to "cmp.panelcontainer" message requests sent by the editor frame
                 * - check that the message data panel container type is correct and that the id (path) matches this specific Tabs component
                 * - if so, route the "navigate" operation to enact a navigation of the Tabs based on index data
                 */
                new window.Granite.author.MessageChannel("cqauthor", window).subscribeRequestMessage("cmp.panelcontainer", function(message) {
                    if (message.data && message.data.type === "cmp-tabs" && message.data.id === that._elements.self.dataset["cmpPanelcontainerId"]) {
                        if (message.data.operation === "navigate") {
                            navigate(message.data.index);
                        }
                    }
                });
            }
        }

        /**
         * Returns the index of the active tab, if no tab is active returns 0
         *
         * @param {Array} tabs Tab elements
         * @returns {Number} Index of the active tab, 0 if none is active
         */
        function getActiveIndex(tabs) {
            if (tabs) {
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].classList.contains(selectors.active.tab)) {
                        return i;
                    }
                }
            }
            return 0;
        }

        /**
         * Caches the Tabs elements as defined via the {@code data-tabs-hook="ELEMENT_NAME"} markup API
         *
         * @private
         * @param {HTMLElement} wrapper The Tabs wrapper element
         */
        function cacheElements(wrapper) {
            that._elements = {};
            that._elements.self = wrapper;
            var hooks = that._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

            for (var i = 0; i < hooks.length; i++) {
                var hook = hooks[i];
                if (hook.closest("." + NS + "-" + IS) === that._elements.self) { // only process own tab elements
                    var capitalized = IS;
                    capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
                    var key = hook.dataset[NS + "Hook" + capitalized];
                    if (that._elements[key]) {
                        if (!Array.isArray(that._elements[key])) {
                            var tmp = that._elements[key];
                            that._elements[key] = [tmp];
                        }
                        that._elements[key].push(hook);
                    } else {
                        that._elements[key] = hook;
                    }
                }
            }
        }

        /**
         * Binds Tabs event handling
         *
         * @private
         */
        function bindEvents() {
            var tabs = that._elements["tab"];
            if (tabs) {
                for (var i = 0; i < tabs.length; i++) {
                    (function(index) {
                        tabs[i].addEventListener("click", function(event) {
                            navigateAndFocusTab(index);
                        });
                        tabs[i].addEventListener("keydown", function(event) {
                            onKeyDown(event);
                        });
                    })(i);
                }
            }
        }

        /**
         * Handles tab keydown events
         *
         * @private
         * @param {Object} event The keydown event
         */
        function onKeyDown(event) {
            var index = that._active;
            var lastIndex = that._elements["tab"].length - 1;

            switch (event.keyCode) {
                case keyCodes.ARROW_LEFT:
                case keyCodes.ARROW_UP:
                    event.preventDefault();
                    if (index > 0) {
                        navigateAndFocusTab(index - 1);
                    }
                    break;
                case keyCodes.ARROW_RIGHT:
                case keyCodes.ARROW_DOWN:
                    event.preventDefault();
                    if (index < lastIndex) {
                        navigateAndFocusTab(index + 1);
                    }
                    break;
                case keyCodes.HOME:
                    event.preventDefault();
                    navigateAndFocusTab(0);
                    break;
                case keyCodes.END:
                    event.preventDefault();
                    navigateAndFocusTab(lastIndex);
                    break;
                default:
                    return;
            }
        }

        /**
         * Refreshes the tab markup based on the current {@code Tabs#_active} index
         *
         * @private
         */
        function refreshActive() {
            var tabpanels = that._elements["tabpanel"];
            var tabs = that._elements["tab"];

            if (tabpanels) {
                if (Array.isArray(tabpanels)) {
                    for (var i = 0; i < tabpanels.length; i++) {
                        if (i === parseInt(that._active)) {
                            tabpanels[i].classList.add(selectors.active.tabpanel);
                            tabpanels[i].removeAttribute("aria-hidden");
                            tabs[i].classList.add(selectors.active.tab);
                            tabs[i].setAttribute("aria-selected", true);
                            tabs[i].setAttribute("tabindex", "0");
                        } else {
                            tabpanels[i].classList.remove(selectors.active.tabpanel);
                            tabpanels[i].setAttribute("aria-hidden", true);
                            tabs[i].classList.remove(selectors.active.tab);
                            tabs[i].setAttribute("aria-selected", false);
                            tabs[i].setAttribute("tabindex", "-1");
                        }
                    }
                } else {
                    // only one tab
                    tabpanels.classList.add(selectors.active.tabpanel);
                    tabs.classList.add(selectors.active.tab);
                }
            }
        }

        /**
         * Focuses the element and prevents scrolling the element into view
         *
         * @param {HTMLElement} element Element to focus
         */
        function focusWithoutScroll(element) {
            var x = window.scrollX || window.pageXOffset;
            var y = window.scrollY || window.pageYOffset;
            element.focus();
            window.scrollTo(x, y);
        }

        /**
         * Navigates to the tab at the provided index
         *
         * @private
         * @param {Number} index The index of the tab to navigate to
         */
        function navigate(index) {
            that._active = index;
            refreshActive();
        }

        /**
         * Navigates to the item at the provided index and ensures the active tab gains focus
         *
         * @private
         * @param {Number} index The index of the item to navigate to
         */
        function navigateAndFocusTab(index) {
            navigate(index);
            focusWithoutScroll(that._elements["tab"][index]);
        }
    }

    /**
     * Reads options data from the Tabs wrapper element, defined via {@code data-cmp-*} data attributes
     *
     * @private
     * @param {HTMLElement} element The Tabs element to read options data from
     * @returns {Object} The options read from the component data attributes
     */
    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    /**
     * Document ready handler and DOM mutation observers. Initializes Tabs components as necessary.
     *
     * @private
     */
    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Tabs({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body = document.querySelector("body");
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Tabs({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady());
    }

}());

/*******************************************************************************
 * Copyright 2017 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "search";

    var DELAY = 300; // time before fetching new results when the user is typing a search string
    var LOADING_DISPLAY_DELAY = 300; // minimum time during which the loading indicator is displayed
    var PARAM_RESULTS_OFFSET = "resultsOffset";

    var keyCodes = {
        TAB: 9,
        ENTER: 13,
        ESCAPE: 27,
        ARROW_UP: 38,
        ARROW_DOWN: 40
    };

    var selectors = {
        self: "[data-" + NS + '-is="' + IS + '"]',
        item: {
            self: "[data-" + NS + "-hook-" + IS + '="item"]',
            title: "[data-" + NS + "-hook-" + IS + '="itemTitle"]',
            focused: "." + NS + "-search__item--is-focused"
        }
    };

    var properties = {
        /**
         * The minimum required length of the search term before results are fetched.
         *
         * @memberof Search
         * @type {Number}
         * @default 3
         */
        minLength: {
            "default": 3,
            transform: function(value) {
                value = parseFloat(value);
                return isNaN(value) ? null : value;
            }
        },
        /**
         * The maximal number of results fetched by a search request.
         *
         * @memberof Search
         * @type {Number}
         * @default 10
         */
        resultsSize: {
            "default": 10,
            transform: function(value) {
                value = parseFloat(value);
                return isNaN(value) ? null : value;
            }
        }
    };

    var idCount = 0;

    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    function toggleShow(element, show) {
        if (element) {
            if (show !== false) {
                element.style.display = "block";
                element.setAttribute("aria-hidden", false);
            } else {
                element.style.display = "none";
                element.setAttribute("aria-hidden", true);
            }
        }
    }

    function serialize(form) {
        var query = [];
        if (form && form.elements) {
            for (var i = 0; i < form.elements.length; i++) {
                var node = form.elements[i];
                if (!node.disabled && node.name) {
                    var param = [node.name, encodeURIComponent(node.value)];
                    query.push(param.join("="));
                }
            }
        }
        return query.join("&");
    }

    function mark(node, regex) {
        if (!node || !regex) {
            return;
        }

        // text nodes
        if (node.nodeType === 3) {
            var nodeValue = node.nodeValue;
            var match = regex.exec(nodeValue);

            if (nodeValue && match) {
                var element = document.createElement("mark");
                element.className = NS + "-search__item-mark";
                element.appendChild(document.createTextNode(match[0]));

                var after = node.splitText(match.index);
                after.nodeValue = after.nodeValue.substring(match[0].length);
                node.parentNode.insertBefore(element, after);
            }
        } else if (node.hasChildNodes()) {
            for (var i = 0; i < node.childNodes.length; i++) {
                // recurse
                mark(node.childNodes[i], regex);
            }
        }
    }

    function Search(config) {
        if (config.element) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");
        }

        this._cacheElements(config.element);
        this._setupProperties(config.options);

        this._action = this._elements.form.getAttribute("action");
        this._resultsOffset = 0;
        this._hasMoreResults = true;

        this._elements.input.addEventListener("input", this._onInput.bind(this));
        this._elements.input.addEventListener("focus", this._onInput.bind(this));
        this._elements.input.addEventListener("keydown", this._onKeydown.bind(this));
        this._elements.clear.addEventListener("click", this._onClearClick.bind(this));
        document.addEventListener("click", this._onDocumentClick.bind(this));
        this._elements.results.addEventListener("scroll", this._onScroll.bind(this));

        this._makeAccessible();
    }

    Search.prototype._displayResults = function() {
        if (this._elements.input.value.length === 0) {
            toggleShow(this._elements.clear, false);
            this._cancelResults();
        } else if (this._elements.input.value.length < this._properties.minLength) {
            toggleShow(this._elements.clear, true);
        } else {
            this._updateResults();
            toggleShow(this._elements.clear, true);
        }
    };

    Search.prototype._onScroll = function(event) {
        // fetch new results when the results to be scrolled down are less than the visible results
        if (this._elements.results.scrollTop + 2 * this._elements.results.clientHeight >= this._elements.results.scrollHeight) {
            this._resultsOffset += this._properties.resultsSize;
            this._displayResults();
        }
    };

    Search.prototype._onInput = function(event) {
        var self = this;
        self._cancelResults();
        // start searching when the search term reaches the minimum length
        this._timeout = setTimeout(function() {
            self._displayResults();
        }, DELAY);
    };

    Search.prototype._onKeydown = function(event) {
        var self = this;

        switch (event.keyCode) {
            case keyCodes.TAB:
                if (self._resultsOpen()) {
                    event.preventDefault();
                }
                break;
            case keyCodes.ENTER:
                event.preventDefault();
                if (self._resultsOpen()) {
                    var focused = self._elements.results.querySelector(selectors.item.focused);
                    if (focused) {
                        focused.click();
                    }
                }
                break;
            case keyCodes.ESCAPE:
                self._cancelResults();
                break;
            case keyCodes.ARROW_UP:
                if (self._resultsOpen()) {
                    event.preventDefault();
                    self._stepResultFocus(true);
                }
                break;
            case keyCodes.ARROW_DOWN:
                if (self._resultsOpen()) {
                    event.preventDefault();
                    self._stepResultFocus();
                } else {
                    // test the input and if necessary fetch and display the results
                    self._onInput();
                }
                break;
            default:
                return;
        }
    };

    Search.prototype._onClearClick = function(event) {
        event.preventDefault();
        this._elements.input.value = "";
        toggleShow(this._elements.clear, false);
        toggleShow(this._elements.results, false);
    };

    Search.prototype._onDocumentClick = function(event) {
        var inputContainsTarget =  this._elements.input.contains(event.target);
        var resultsContainTarget = this._elements.results.contains(event.target);

        if (!(inputContainsTarget || resultsContainTarget)) {
            toggleShow(this._elements.results, false);
        }
    };

    Search.prototype._resultsOpen = function() {
        return this._elements.results.style.display !== "none";
    };

    Search.prototype._makeAccessible = function() {
        var id = NS + "-search-results-" + idCount;
        this._elements.input.setAttribute("aria-owns", id);
        this._elements.results.id = id;
        idCount++;
    };

    Search.prototype._generateItems = function(data, results) {
        var self = this;

        data.forEach(function(item) {
            var el = document.createElement("span");
            el.innerHTML = self._elements.itemTemplate.innerHTML;
            el.querySelectorAll(selectors.item.title)[0].appendChild(document.createTextNode(item.title));
            el.querySelectorAll(selectors.item.self)[0].setAttribute("href", item.url);
            results.innerHTML += el.innerHTML;
        });
    };

    Search.prototype._markResults = function() {
        var nodeList = this._elements.results.querySelectorAll(selectors.item.self);
        var escapedTerm = this._elements.input.value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        var regex = new RegExp("(" + escapedTerm + ")", "gi");

        for (var i = this._resultsOffset - 1; i < nodeList.length; ++i) {
            var result = nodeList[i];
            mark(result, regex);
        }
    };

    Search.prototype._stepResultFocus = function(reverse) {
        var results = this._elements.results.querySelectorAll(selectors.item.self);
        var focused = this._elements.results.querySelector(selectors.item.focused);
        var newFocused;
        var index = Array.prototype.indexOf.call(results, focused);
        var focusedCssClass = NS + "-search__item--is-focused";

        if (results.length > 0) {

            if (!reverse) {
                // highlight the next result
                if (index < 0) {
                    results[0].classList.add(focusedCssClass);
                } else if (index + 1 < results.length) {
                    results[index].classList.remove(focusedCssClass);
                    results[index + 1].classList.add(focusedCssClass);
                }

                // if the last visible result is partially hidden, scroll up until it's completely visible
                newFocused = this._elements.results.querySelector(selectors.item.focused);
                if (newFocused) {
                    var bottomHiddenHeight = newFocused.offsetTop + newFocused.offsetHeight - this._elements.results.scrollTop - this._elements.results.clientHeight;
                    if (bottomHiddenHeight > 0) {
                        this._elements.results.scrollTop += bottomHiddenHeight;
                    } else {
                        this._onScroll();
                    }
                }

            } else {
                // highlight the previous result
                if (index >= 1) {
                    results[index].classList.remove(focusedCssClass);
                    results[index - 1].classList.add(focusedCssClass);
                }

                // if the first visible result is partially hidden, scroll down until it's completely visible
                newFocused = this._elements.results.querySelector(selectors.item.focused);
                if (newFocused) {
                    var topHiddenHeight = this._elements.results.scrollTop - newFocused.offsetTop;
                    if (topHiddenHeight > 0) {
                        this._elements.results.scrollTop -= topHiddenHeight;
                    }
                }
            }
        }
    };

    Search.prototype._updateResults = function() {
        var self = this;
        if (self._hasMoreResults) {
            var request = new XMLHttpRequest();
            var url = self._action + "?" + serialize(self._elements.form) + "&" + PARAM_RESULTS_OFFSET + "=" + self._resultsOffset;

            request.open("GET", url, true);
            request.onload = function() {
                // when the results are loaded: hide the loading indicator and display the search icon after a minimum period
                setTimeout(function() {
                    toggleShow(self._elements.loadingIndicator, false);
                    toggleShow(self._elements.icon, true);
                }, LOADING_DISPLAY_DELAY);
                if (request.status >= 200 && request.status < 400) {
                    // success status
                    var data = JSON.parse(request.responseText);
                    if (data.length > 0) {
                        self._generateItems(data, self._elements.results);
                        self._markResults();
                        toggleShow(self._elements.results, true);
                    } else {
                        self._hasMoreResults = false;
                    }
                    // the total number of results is not a multiple of the fetched results:
                    // -> we reached the end of the query
                    if (self._elements.results.querySelectorAll(selectors.item.self).length % self._properties.resultsSize > 0) {
                        self._hasMoreResults = false;
                    }
                } else {
                    // error status
                }
            };
            // when the results are loading: display the loading indicator and hide the search icon
            toggleShow(self._elements.loadingIndicator, true);
            toggleShow(self._elements.icon, false);
            request.send();
        }
    };

    Search.prototype._cancelResults = function() {
        clearTimeout(this._timeout);
        this._elements.results.scrollTop = 0;
        this._resultsOffset = 0;
        this._hasMoreResults = true;
        this._elements.results.innerHTML = "";
    };

    Search.prototype._cacheElements = function(wrapper) {
        this._elements = {};
        this._elements.self = wrapper;
        var hooks = this._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

        for (var i = 0; i < hooks.length; i++) {
            var hook = hooks[i];
            var capitalized = IS;
            capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
            var key = hook.dataset[NS + "Hook" + capitalized];
            this._elements[key] = hook;
        }
    };

    Search.prototype._setupProperties = function(options) {
        this._properties = {};

        for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
                var property = properties[key];
                if (options && options[key] != null) {
                    if (property && typeof property.transform === "function") {
                        this._properties[key] = property.transform(options[key]);
                    } else {
                        this._properties[key] = options[key];
                    }
                } else {
                    this._properties[key] = properties[key]["default"];
                }
            }
        }
    };

    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Search({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body = document.querySelector("body");
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Search({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady);
    }

})();

/*
 * Code for the Cookie Accept component.
 * This code handles the cookie maintenance and the listener for the acceptance button.
 */
(function() {
	"use strict";

	const COOKIE_NAME = "CookiesAccepted";

	function onDocumentReady() {

		var cookieAccepts = document.querySelectorAll(".cmp-cookie-accept");

		for (var index = cookieAccepts.length - 1; index >= 0; index--) {
			var cookieAccept = cookieAccepts[index];
			var cookieValue = getCookie(COOKIE_NAME);
			if (cookieValue === "TRUE") {
				cookieAccept.parentNode.removeChild(cookieAccept);
			} else {
				var button = cookieAccept.getElementsByClassName("cookie-accept-button")[0];
				if (button != null) {
					button.addEventListener ("click", function() {
						setCookie(COOKIE_NAME, "TRUE", 90);
						var target = event.target;
                        var comp = target.closest(".cmp-cookie-accept");
						comp.parentNode.removeChild(comp);
					});
				}
                cookieAccept.classList.remove("hidden");
			}
		}
	}

	function getCookie(cname) {
		const name = cname + "=";
		const decodedCookie = decodeURIComponent(document.cookie);
		const ca = decodedCookie.split(';');
		for(var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == ' ') {
				c = c.substring(1);
			}
			if (c.indexOf(name) == 0) {
				return c.substring(name.length, c.length);
			}
		}
		return false;
	}

	function setCookie(cname, cvalue, exdays) {
        const path = '/';
        const samesite = 'Lax';
		const d = new Date();
		d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
		const expires = "expires="+d.toUTCString();

        let domain = location.hostname;
		let hostSplit = domain.split(".");
		if (hostSplit.length > 1) {
			domain = "." + hostSplit[hostSplit.length-2] + "." + hostSplit[hostSplit.length-1];
		}
        document.cookie = cname + "=" + cvalue + ";expires=" + expires + ";sameSite=" + samesite +
            				";path=" + path + ";domain=" + domain;
	}

	if (document.readyState !== "loading") {
		onDocumentReady();
	} else {
		document.addEventListener("DOMContentLoaded", onDocumentReady());
	}

}());


var gcs_apiUrl = "https://www.googleapis.com/customsearch/v1";
//var gcs_key = "AIzaSyBAf0oD-hXZG23CgYDMHLs1KeWEAHKyZNA"; // Google API key

// One of these needs to be set by the component
//var gcs_engine_id = "012092283105447367196:wvuwbkua6pw"; // PC Search Engine ID
//var gcs_engine_id = "012092283105447367196:eydpmtz-u8s"; // PP Search Engine ID
//var gcs_engine_id = "012092283105447367196:oocw-v_utjg"; // RMP Search Engine ID

var gcs_key;
var gcs_engine_id;
var gcs_searchParams;
var gcs_resultsPerPage = 10; // 10 is the default number of results per page returned by the Google API. 
                             // It is also the maximum.
var gcs_currentPage = 1;

var component = document.querySelector(".pc-search");
if (component) {
    gcs_key = component.dataset.key;
    gcs_engine_id = component.dataset.engineId;
}

function basicSearch() {
    gcs_searchParams = {};
    gcs_searchParams.key = gcs_key;
    gcs_searchParams.cx = gcs_engine_id;
    gcs_searchParams.q = document.getElementById("searchInput").value;
    gcs_searchParams.start = 1;
    gcs_currentPage = 1;

    executeSearch();
}

/*  Not used anymore--leave in case someone wants it back
function advancedSearch() {
    gcs_searchParams = {};
    gcs_searchParams.key = gcs_key;
    gcs_searchParams.cx = gcs_engine_id;
    // Passes reqWords in place of the query to get around an apparent bug where Google doesn't return any results if only required words are sent
    gcs_searchParams.q = document.getElementById("reqWords").value;
    gcs_searchParams.hq = document.getElementById("reqWords").value;
    gcs_searchParams.exactTerms = document.getElementById("exactPhrase").value;
    gcs_searchParams.orTerms = document.getElementById("anyWords").value;
    gcs_searchParams.excludeTerms = document.getElementById("withoutWords").value;
    gcs_searchParams.fileType = document.getElementById("fileFormat").value;
    gcs_searchParams.start = 1;
    gcs_currentPage = 1;

    executeSearch();
}
*/

function pageNav(pageNum) {
    gcs_currentPage = pageNum;
    // Calculate which result will be the first result on a given page. 1 for page 1, 11 for page 2, 22 for page 3, etc.
    gcs_searchParams.start = String(gcs_resultsPerPage * (pageNum - 1) + 1);

    executeSearch();

    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}

function executeSearch() {
    var query = Object.keys(gcs_searchParams)
        .map(function(k) {return k + '=' + gcs_searchParams[k]})
        .join('&');

    var url = gcs_apiUrl + "?" + query;

    var http = new XMLHttpRequest();
    http.open("GET", url);
    http.send();

    http.onreadystatechange = function(event) {
        if(http.readyState === 4 && http.status === 200) {
            try {
                var resultsObj = JSON.parse(http.response);
                var numResults = resultsObj.queries.request[0].totalResults;
                if (numResults == 0) {
                    if (gcs_currentPage <= 1) {
                        document.getElementById("result-list").innerHTML = 'Your search did not match any results.';
                        document.getElementById("page-nav").innerHTML = '';
                    } else {
                        // If the page requested doesn't have any results, we try again with the previous page. 
                        // This is neccessary because Google's API sometimes promises more results than it actually has.
                        pageNav(gcs_currentPage - 1);
                    }
                } else {
                    populateResultsText(resultsObj);
                }
            } catch (error) {
                console.error(error);
            }
        }
    }
}

function populateResultsText(resultsObj) {
    var resultsHtml = '';
    resultsObj.items.forEach(function(item) {
        var maxLinkLength = 100;
        var truncLink = item.link.length > maxLinkLength ? truncateLink(item.link, maxLinkLength) : item.link;
        var snip = removeBreaks(item.htmlSnippet);
        resultsHtml += '<div class="result">' +
            '<a class="title link link--default link--size-default" href="' + item.link + '">' + getFileFormat(item) + item.htmlTitle + '</a>' +
            '<p class="url" title="' + item.link + '">' + truncLink + '</p>' +
            '<p class="snippet">' + snip + '</p>' +
            '</div>';
    });
    document.getElementById("result-list").innerHTML = resultsHtml;

    var numResults = resultsObj.queries.request[0].totalResults;
    // Calculate the number of pages required to fit all results, with a max of 100 results (Google won't return any results past 100)
    var numPages = Math.floor((Math.min(numResults, 100) - 1) / gcs_resultsPerPage) + 1;

    var pageNavHtml = '';
    if (gcs_currentPage > 1) {
        pageNavHtml += '<a class="page-nav-link link link--default link--size-default" onclick="pageNav(' + (gcs_currentPage - 1) + ')">Previous</a>';
    }
    for (var i = 1; i <= numPages; i++) {
        if (i != gcs_currentPage) {
            pageNavHtml += '<a class="page-nav-link link link--default link--size-default" onclick="pageNav(' + i + ')">' + i + '</a>';
        } else {
            pageNavHtml += '<span class="page-nav-link">' + i + '</span>';
        }
    }
    if (gcs_currentPage < numPages) {
        pageNavHtml += '<a class="page-nav-link link link--default link--size-default" onclick="pageNav(' + (gcs_currentPage + 1) + ')">Next</a>';
    }
    document.getElementById("page-nav").innerHTML = pageNavHtml;
}

function truncateLink(url, maxLength) {
    var res = url.split("/");
    var arrayLength = res.length;
    var shortUrl = res[arrayLength - 1];
    for (i = arrayLength - 2; i >= 0; i--) {
    	var totalLength = shortUrl.length + res[i].length;
        if (totalLength < maxLength) {
            shortUrl = res[i] + "/" + shortUrl;
        } else {
            break;
        }
    }
    shortUrl = ".../" + shortUrl;
    return shortUrl;
}

function removeBreaks(snippet) {
    return snippet.replace(new RegExp('<br>', 'g'), '');
}

function getFileFormat(item) {
    switch(item.fileFormat) {
        case 'PDF/Adobe Acrobat':
            return '[PDF] ';
        case 'Microsoft Word':
            return '[DOC] ';
        case 'Microsoft Excel':
            return '[XLS] ';
        case 'Microsoft Powerpoint':
            return '[PPT] ';
        default:
            return '';
    }
}

function listenForEnterKey(event) {
    if (event.key !== "Enter") return;
    document.querySelector("#searchButton").click();
    event.preventDefault();
}

function onClickBasicSearch() {
    window.location.search = '?q=' + document.getElementById("searchInput").value;
}

/*
 * TODO:  This should only apply to pages with search result component. 
 *   We shouldn't be calling this for every page. 
 *   Too late in deployment to make this fix.  Craig Hondo 7/16/2019
 */
window.onload = function() {
    var button = document.querySelector("#searchInput");

    if (button) {
        var queryArgs = {};
        var query = window.location.search.substring(1).split("&");
        for (var i = 0, max = query.length; i < max; i++)
        {
            if (query[i] === "") // check for trailing & with no param
                continue;
        
            var param = query[i].split("=");
            queryArgs[decodeURIComponent(param[0])] = decodeURIComponent(param[1] || "");
        }
        if (queryArgs["q"]) {
            document.getElementById("searchInput").value = queryArgs["q"];
            basicSearch();
        }
    
        var currentUrl = window.location.href;
        currentUrl = currentUrl.replace(/.html?.*/,".html");
    
        /*  Not used anymore--leave in case someone wants it back
        var asv = currentUrl.replace(/search.html/, "advancedsearch.html");
        var asl = document.getElementById("advancedSearchLink");
        if (asl) {
            asl.href = asv;
        }
        */


        // Use enter key to trigger search button
        button.addEventListener("keyup", function(event) {listenForEnterKey(event)});
    }

    // Additional code that needs to go into FED code.  To check for "focused" state, after a reload
    // of the page.  Otherwise, the label and value both go into the textfield.
    if (document.getElementById("searchInput")) {
        if (document.getElementById("searchInput").value) {
            var parent = document.getElementById("searchInput").parentElement;
            if (parent.classList.contains('input--dynamic-placeholder')) {
                parent.classList.add('focused');
            }
        }
    }

};

/* 
 * Read the XML file and generate a table based on the information
 */
function xmlTableForecastHandler(request, dataEl) {
	var tableName = dataEl.dataset.componentname + "Table";

    if (request.status==200) {
        var headers = new Set();
        var labelArray = [];
        var dataArray = [];

        var domparser = new DOMParser();
        var xmlDoc = domparser.parseFromString(request.responseText, "application/xml");
        // Get all the measurements
        var measurementList = xmlDoc.getElementsByTagName("MeasurementValue");

        var listSize = measurementList.length;
        var firstIndex = ((listSize - 24) > 0) ? listSize - 24 : 0;

        var measuredList = [];
        for (var i = 0; i < listSize; i++) {
            var measured = [];
            var timestamp = measurementList[i].getElementsByTagName("timeStamp")[0].childNodes[0].nodeValue;
            var date = timestamp.split(" ")[0];
            headers.add(date);   // Assuming the readings in the XML file are ordered by date and time
            measured["date"] = date;
            var time = timestamp.split(" ")[1];
            measured["hour"] = time.split(":")[0];
            measured["value"] = measurementList[i].getElementsByTagName("value")[0].childNodes[0].nodeValue;

            measuredList.push(measured);
        }

        var tableBody = generateTableForecastBody(headers, measuredList);
    	var tableElement = document.getElementById(tableName);
    	tableElement.innerHTML = tableBody;

    }
}


function generateTableForecastBody(headers, measuredList) {
    var tableBody = "";
   
    tableBody += "<tr>";
    tableBody += "<th>Day</th>";
    headers.forEach(function(header) {
        headerParts = header.split("-");
        tableBody += "<th>" + headerParts[1] + "/" + headerParts[2] + "</th>";
    });
    tableBody += "</tr>";
    
    tableBody += "<tr>";
    tableBody += "<th>cu.&#13ft.&#13/&#13sec</th>";
    measuredList.forEach(function(measured) {
        tableBody += "<td>" + measured["value"] + "</td>";
    });
    tableBody += "</tr>";

    return tableBody;
}

/* 
 * Inefficient search for values in the list but it's quick enough
 */

function findTableValue(date, hour, measuredList) {
    var value = "";
    for (var i = 0; i < measuredList.length; i++) {
    	var measured = measuredList[i];
        if (measured["date"] == date && measured["hour"] == hour) {
            value = measured["value"];
            break;
        }
    }

    return value;
}


/*
 * Open the XML file
 */
var tableFuncs = [];
var tableRequests = [];
document.addEventListener("DOMContentLoaded", function() {
    var list = document.getElementsByClassName("hydroForecastTableData");
    for (var l = 0; l < list.length; l++) {
		var xmlhttp = new XMLHttpRequest;
		var dataEl = list[l];
        tableRequests[l] = xmlhttp;
        tableFuncs[l] = xmlTableForecastHandler.bind(this, xmlhttp, dataEl);
    }
    for (var m = 0; m < list.length; m++) {
            tableRequests[m].addEventListener("load", tableFuncs[m], false);
            tableRequests[m].open("GET", list[m].dataset.url); 
            tableRequests[m].send();
    }
});
/* 
 * Read the XML file and generate a table based on the information
 */
function xmlTableHandler(request, dataEl) {
	var tableName = dataEl.dataset.componentname + "Table";
    var isForecast = (dataEl.dataset.forecast == "true");
    if (request.status==200) {
        var headers = new Set();
        var labelArray = [];
        var dataArray = [];

        var domparser = new DOMParser();
        var xmlDoc = domparser.parseFromString(request.responseText, "application/xml");
        // Get all the measurements
        var measurementList = xmlDoc.getElementsByTagName("MeasurementValue");

        var listSize = measurementList.length;
        var firstIndex = ((listSize - 24) > 0) ? listSize - 24 : 0;

        var measuredList = [];
        for (var i = 0; i < listSize; i++) {
            var measured = [];
            var timestamp = measurementList[i].getElementsByTagName("timeStamp")[0].childNodes[0].nodeValue;
            var date = timestamp.split(" ")[0];
            headers.add(date);   // Assuming the readings in the XML file are ordered by date and time
            measured["date"] = date;
            var time = timestamp.split(" ")[1];
            measured["hour"] = time.split(":")[0];
            measured["value"] = measurementList[i].getElementsByTagName("value")[0].childNodes[0].nodeValue;

            measuredList.push(measured);
        }

        var tableBody = generateTableBody(headers, measuredList);
    	var tableElement = document.getElementById(tableName);
    	tableElement.innerHTML = tableBody;

    }
}


function generateTableBody(headers, measuredList) {
    var tableBody = "";

    tableBody += "<tr>";
    tableBody += "<th>Hour</th>";
    headers.forEach(function(header) {
        headerParts = header.split("-");
        tableBody += "<th>" + headerParts[1] + "/" + headerParts[2] + "</th>";
    });
    tableBody += "</tr>";
    for (var h = 0; h < 24; h++) {
        tableBody += "<tr>";
        
        tableBody += "<th>" + (h + 1) + "</th>";
        headers.forEach(function(header) {
            tableBody += "<td>" + findTableValue(header, h, measuredList) + "</td>";
        });
        tableBody += "</tr>";
    }

    return tableBody;
}

/* 
 * Inefficient search for values in the list but it's quick enough
 */

function findTableValue(date, hour, measuredList) {
    var value = "";
    for (var i = 0; i < measuredList.length; i++) {
    	var measured = measuredList[i];
        if (measured["date"] == date && measured["hour"] == hour) {
            value = measured["value"];
            break;
        }
    }

    return value;
}


/*
 * Open the XML file
 */
var tableFuncs = [];
var tableRequests = [];
document.addEventListener("DOMContentLoaded", function() {
    var list = document.getElementsByClassName("hydroTableFlowData");
    for (var l = 0; l < list.length; l++) {
		var xmlhttp = new XMLHttpRequest;
		var dataEl = list[l];
        tableRequests[l] = xmlhttp;
        tableFuncs[l] = xmlTableHandler.bind(this, xmlhttp, dataEl);
    }
    for (var m = 0; m < list.length; m++) {
            tableRequests[m].addEventListener("load", tableFuncs[m], false);
            tableRequests[m].open("GET", list[m].dataset.url); 
            tableRequests[m].send();
    }
});
/* 
 * Read the CSV file and generate a table based on the information
 */
function csvHandler(request, dataEl) {
    if (request.status==200) {
        var content = request.responseText;
        var tableName = dataEl.dataset.componentname + "Table";
        var tableElement = document.getElementById(tableName);
        var dateName = dataEl.dataset.componentname + "Date";
        var dateElement = document.getElementById(dateName);
        var dataCells = parseCSV(content);
        makeTable(tableElement, dateElement, dataCells);
    }
}

//
// From: Trevor Dixon (https://stackoverflow.com/questions/1293147/javascript-code-to-parse-csv-data)
//
function parseCSV(str) {
    var arr = [];
    var quote = false;  // true means we're inside a quoted field

	str = str.trim();
    // iterate over each character, keep track of current row and column (of the returned array)
    for (var row = 0, col = 0, c = 0; c < str.length; c++) {
        var cc = str[c], nc = str[c+1];        // current character, next character
        arr[row] = arr[row] || [];             // create a new row if necessary
        arr[row][col] = arr[row][col] || '';   // create a new column (start with empty string) if necessary

        // If the current character is a quotation mark, and we're inside a
        // quoted field, and the next character is also a quotation mark,
        // add a quotation mark to the current column and skip the next character
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }  

        // If it's just one quotation mark, begin/end quoted field
        if (cc == '"') { quote = !quote; continue; }

        // If it's a comma and we're not in a quoted field, move on to the next column
        if (cc == ',' && !quote) { ++col; continue; }

        // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
        // and move on to the next row and move to column 0 of that new row
        if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }

        // If it's a newline (LF or CR) and we're not in a quoted field,
        // move on to the next row and move to column 0 of that new row
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }
        if (cc == '\r' && !quote) { ++row; col = 0; continue; }

        // Otherwise, append the current character to the current column
        arr[row][col] += cc;
    }
    return arr;
}

function makeTable(tableElement, dateElement, cells) {

    if (cells.length > 0) {
		var header = tableElement.createTHead();
		header.classList.add("table__head");
		var row = header.insertRow();
		row.classList.add("table__row");
        cells[0].forEach(function(cell) {
            let th = document.createElement("th");
			th.classList.add("table__header");
            th.appendChild(document.createTextNode(cell));
            row.appendChild(th);
        });
    }
    if (cells.length > 1) {
        var tableBody = document.createElement('tbody');
        tableBody.classList.add("table__body");

        for (var line = 1; line < cells.length; line++) {
            if ("*UPDATED*" === cells[line][0]) {
                if (dateElement) {
                    dateElement.innerHTML = cells[line][1];
                }
            } else {
                var rowOfCells = cells[line];
                var row = tableBody.insertRow();
                row.classList.add("table__row");
                rowOfCells.forEach(function(data) {
                    var cell = row.insertCell();
                    cell.classList.add("table__data");
                    let p = document. createElement("p");
                    cell.appendChild(p);
                    p.appendChild(document.createTextNode(data));
                });
            }
        }
        tableElement.appendChild(tableBody);
    }
}

/*
 * Open the CSV file
 */
var tableFuncs = [];
var tableRequests = [];
document.addEventListener("DOMContentLoaded", function() {
    var list = document.getElementsByClassName("pcDataTable");

    for (var l = 0; l < list.length; l++) {
		var xmlhttp = new XMLHttpRequest;
		var dataEl = list[l];
        tableRequests[l] = xmlhttp;
        tableFuncs[l] = csvHandler.bind(this, xmlhttp, dataEl);
    }
    for (var m = 0; m < list.length; m++) {
            tableRequests[m].addEventListener("load", tableFuncs[m], false);
            tableRequests[m].open("GET", list[m].dataset.url); 
            tableRequests[m].send();
    }
});


/*
 * Return the cookie value, if one exists; or null, if it doesn't exist.  Eventually, replace 
 *  this code with getCookie() in utilities.jsx.
 */
function getAngularCookie(cname) {

    const name = cname + "=";
    const decodedCookie = decodeURIComponent(document.cookie);


    const ca = decodedCookie.split(';');

    for(var i = 0; i < ca.length; i++) {

        var c = ca[i];
        while (c.charAt(0) == ' ') {
        	c = c.substring(1);
        }

        if (c.indexOf(name) == 0) {
        	return c.substring(name.length, c.length);
        }

    }
    return null;
} 

/*
 *  On page load, check if we are in AEM Author and if not proceed.
 *  If the PCState cookie doesn't exist, create it with an empty string value
 *  then bring up the state selector dialog.
 */
document.addEventListener('DOMContentLoaded', function() {

    /* Check for cookie buttons */
    var buttons = document.getElementsByClassName("cookieButton");
    if (buttons.length > 0) {
        for (var i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            //let cookieName = button.getAttribute("cookiename");
            //let cookieValue = button.getAttribute("cookievalue");
            let cookie = JSON.parse(button.getAttribute("data-json")); 
            let cookieName = cookie.name;
            let cookieValue = cookie.value;

            if (cookieName) {
            	var class2Keep = (cookieValue === getAngularCookie(cookieName)) ? 
                    "cookieButton--cookie" : "cookieButton--noCookie";
                var elements2Keep = button.getElementsByClassName(class2Keep);
                for (var j = 0; j < elements2Keep.length; j++) {
                    elements2Keep[j].classList.remove("cookieButton--hidden");
                }

            }
        }



    }
}, false);
    


/*
 * Code to add font awesome arrow at end of link.
 */
(function() {
    "use strict";

	function onDocumentReady() {

        var banners = document.querySelectorAll(".banner");

        for (var index = banners.length - 1; index >= 0; index--) {
            var banner = banners[index];
			var button = banner.getElementsByClassName("cmp-banner-close")[0];
            if (button != null) {
                button.addEventListener ("click", function() {
                    var target = event.target;
                    target.closest(".banner").remove();
                });
            }
        }


        var banners = document.querySelectorAll(".cmp-banner");

        for (var index = banners.length - 1; index >= 0; index--) {
            var banner = banners[index];
            var icon = banner.getElementsByClassName("cmp-banner-icon")[0];
            if (icon != null) {
                icon.className = "";
                icon.classList.add("cmp-banner-icon");
            }
        }

        var alerts = document.querySelectorAll(".cmp-banner--alert");

        for (var index = alerts.length - 1; index >= 0; index--) {
            var alert = alerts[index];
            var icon = alert.getElementsByClassName("cmp-banner-icon")[0];
            if (icon != null) {
                icon.classList.add("fa");
                icon.classList.add("fa-lg");
                icon.classList.add("fa-exclamation-triangle");
            }
        }

        var infos = document.querySelectorAll(".cmp-banner--info");

        for (var index = infos.length - 1; index >= 0; index--) {
            var info = infos[index];
            var icon = info.getElementsByClassName("cmp-banner-icon")[0];
            if (icon != null) {
                icon.classList.add("fa");
                icon.classList.add("fa-lg");
                icon.classList.add("fa-info-circle");
            }
        }
    }


    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady());
    }

}());
!function(e){var t={};function n(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return e[r].call(o.exports,o,o.exports,n),o.l=!0,o.exports}n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(r,o,function(t){return e[t]}.bind(null,o));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="/etc.clientlibs/pcorp/clientlibs/main/",n(n.s=40)}([function(e,t){function n(e,t,o){return(n=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Date.prototype.toString.call(Reflect.construct(Date,[],function(){})),!0}catch(e){return!1}}()?Reflect.construct:function(e,t,n){var o=[null];o.push.apply(o,t);var a=new(Function.bind.apply(e,o));return n&&r(a,n.prototype),a}).apply(null,arguments)}function r(e,t){return(r=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function o(e){return(o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}var a=function(e){return e.charAt(0).toUpperCase()+e.slice(1)},s=function(e){return a(e)};!function(){if("function"==typeof NodeList.prototype.forEach)return!1;NodeList.prototype.forEach=Array.prototype.forEach}();
/**
* @license MIT, GPL, do whatever you want
* @requires polyfill: Array.prototype.slice fix {@link https://gist.github.com/brettz9/6093105}
*/
Array.from||(Array.from=function(e){"use strict";return[].slice.call(e)}),e.exports={XHR:function(e,t,n){t={}||t;var r=new XMLHttpRequest;r.onreadystatechange=function(){4===r.readyState&&200===r.status&&"function"==typeof n&&n(r)},r.open("GET",e,!0),r.send()},CSV2JSON:function(e){for(var t=e.replace(/"(.*?),(.*?)"/g,"$1&comma; $2").split("\n"),n=[],r=t[0].trim().split(","),o=1;o<t.length;o++){for(var a={},s=t[o].split(","),i=0;i<r.length;i++)a[r[i]]=s[i]?s[i].replace(/"/g,""):"";n.push(a)}return JSON.stringify(n)},capitalizeFirstCharacter:a,titleCapitalize:s,setCookie:function(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:"/",o=arguments.length>4&&void 0!==arguments[4]?arguments[4]:location.hostname,a=new Date;a.setTime(a.getTime()+24*n*60*60*1e3);var s="expires="+a.toUTCString();document.cookie="".concat(e,"=").concat(t,";").concat(s,";sameSite=Lax;path=").concat(r,";domain=").concat(o)},getCookie:function(e){for(var t=e+"=",n=decodeURIComponent(document.cookie).split(";"),r=0;r<n.length;r++){for(var o=n[r];" "==o.charAt(0);)o=o.substring(1);if(0==o.indexOf(t))return o.substring(t.length,o.length)}return!1},serialize:function(e,t){void 0===t&&(t="json");for(var n,r={},o=e.querySelectorAll("input, select, textarea"),a=0;a<o.length;++a){var s=o[a],i=s.name,l=s.value;i&&(r[i]=l)}return"urlencode"===t?(n=r,Object.keys(n).map(function(e){return[encodeURIComponent(e),"=",encodeURIComponent(n[e])].join("")}).join("&")):"json"===t&&JSON.stringify(r)},checkValidity:function(e){var t=e.querySelector(".field__native");t.required&&(t.checkValidity()?(e.classList.remove("field__no-message"),e.classList.remove("field__error")):(e.querySelector(".field__error-message-inner")?""===e.querySelector(".field__error-message-inner").innerText&&e.classList.add("field__no-message"):e.classList.add("field__no-message"),e.classList.add("field__error")))},currencyFormatter:function(e){var t=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],n=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(e).replace("$","");return"".concat(!0===t?"$":"").concat(-1===n.indexOf(".")?"0.00":n)},markupCalculatorData:function(e){var t=[];Object.keys(e).map(function(n){t[n]=e[n]}),e=t},setStateSelelection:function(e,t,n){if(!t)return!1;var r=e.length,o=function(e,n,r){Object.keys(r).map(function(n){r[n].innerText===t&&e.handleSelection(r[n].value)})};if(r)for(;r--;){var a=e[r],s=a.querySelector(".field__native");if(s)o(a,0,s.options)}else{var i=e.querySelector(".field__native");if(i)o(e,0,i.options)}"function"==typeof n&&n()},createClassStack:function e(t){return t.map(function(t){return Array.isArray(t)?e(t):t}).filter(function(e){return e}).join(" ")},initComponent:function(e,t,r){document.querySelectorAll(t.toLowerCase().toString()).forEach(function(e){for(var t=arguments.length,o=new Array(t>1?t-1:0),a=1;a<t;a++)o[a-1]=arguments[a];return n(r,[e].concat(o))})},toggleClass:function(e,t){e||console.log("First param of toggleClass needs to be the element."),t&&"object"!==o(t)||console.log("Second param of toggleClass needs to be a string."),"object"===o(t)&&console.log("Perhaps you want Utils.replaceClass() instead?"),e.classList.contains(t)?e.classList.remove(t):e.classList.add(t)},remove:function(e){e&&e.parentNode.removeChild(e)},roundToTwo:function(e){return Math.round(100*e)/100},parents:function(e,t){var n=e;if(0===t.indexOf("."))for(;n.parentNode;){var r=(n=n.parentNode).className;if(r&&"function"==typeof r.match)for(var o=r.split(" "),a=o.length,s=t.toLowerCase().replace(".","");a--;)if(o[a]==s)return n}else if(0===t.indexOf("#"))for(;n.parentNode;){var i=(n=n.parentNode).id;if(i&&"function"==typeof i.match&&i.match(t.toLowerCase().replace("#","")))return n}else for(;n.parentNode;)if((n=n.parentNode).tagName&&void 0!==t&&n.tagName.toLowerCase()===t.toLowerCase())return n;return null},ipsum:function(e,t){var n={max:16,min:4},r={max:8,min:4},o=["ad","adipisicing","aliqua","aliquip","amet","anim","aute","cillum","commodo","consectetur","consequat","culpa","cupidatat","deserunt","do","dolor","dolore","duis","ea","eiusmod","elit","enim","esse","est","et","eu","ex","excepteur","exercitation","fugiat","id","in","incididunt","ipsum","irure","labore","laboris","laborum","Lorem","magna","minim","mollit","nisi","non","nostrud","nulla","occaecat","officia","pariatur","proident","qui","quis","reprehenderit","sint","sit","sunt","tempor","ullamco","ut","velit","veniam","voluptate"],a=function(e,t){return Math.floor(Math.random()*(t-e)+e)},i=function(e){for(var t="",n=0;n<e;n++){var r=a(1,o.length);t+=" ".concat(o[r])}return s(t.trim())},l=function(){for(var e="",r=0;r<t;r++)e+=" ".concat(i(a(n.min,n.max)),".");return e};return"word"===e?i(t):"sentence"===e?l():"paragraph"===e&&function(){for(var e="",n=0;n<t;n++)e+=" ".concat(l(a(r.min,r.max)));return e}()}}},function(e,t,n){"use strict";(function(e){var n=!1,r=[],o=[];t.a=function(t){var a={modal:t,close:t.querySelector("[data-modal-close]")},s=function(){var e=document.querySelector(".modal-visible");e&&(e.classList.remove("overflowing"),window.innerHeight<=e.querySelector(".modal-inner").clientHeight+100?e.classList.add("overflowing"):e.classList.remove("overflowing"))},i=function(e){e&&e.classList&&(r.pop(),r.length&&c(r[r.length-1]),null!=o[o.length-1]&&(o[o.length-1].focus(),o.pop()),e.classList.remove("modal-visible"),e.removeAttribute("data-modal-hide"),e.removeAttribute("data-href"))},l=function(e){e&&e.setAttribute("data-modal-hide",!0)},c=function(e){e&&(e.removeAttribute("data-modal-hide"),e.querySelector("[data-modal-close]").focus())},u=function(e){return e.querySelectorAll("a[href]:not([tabindex='-1']),\n            area[href]:not([tabindex='-1']),\n            input:not([disabled]):not([tabindex='-1']),\n            select:not([disabled]):not([tabindex='-1']),\n            textarea:not([disabled]):not([tabindex='-1']),\n            button:not([disabled]):not([tabindex='-1']),\n            iframe:not([tabindex='-1']),\n            [tabindex]:not([tabindex='-1']),\n            [contentEditable=true]:not([tabindex='-1'])")},d=function(t){var n=t.target;if(n.dataset){var a=n.dataset,c=n.classList;if(a.modal&&!c.contains("modal")){var d=function(e){var t=['.modal[data-modal="',e,'"]'].join(""),n=document.querySelector(t);return null==n?null:n}(a.modal);if(null==d)return;!function(e,t){if(e&&e.classList){r.length&&l(r[r.length-1]),r.push(e),o.push(t),t.hasAttribute("href")&&(e.dataset.href=t.href),e.classList.add("modal-visible"),e.removeAttribute("data-modal-hide");var n=e.querySelector(".modalCloseButton");n.focus(),n.addEventListener("keydown",function(t){return f(t,e)});var a=u(e);a.length>1?a[0].addEventListener("keydown",function(t){return g(t,e,a)}):n.addEventListener("keydown",function(e){return m(e)}),setTimeout(function(){s()})}}(d,n),t.preventDefault()}a.modalClose&&(i(e.parents(n,".modal")),t.preventDefault()),c.contains("modal")&&i(n)}},p=function(e){"Enter"===e.key&&d(e)},f=function(e,t){if("Tab"===e.key&&!e.shiftKey){var n=u(t);n.length>1&&n[0].focus(),e.preventDefault()}},m=function(e){"Tab"===e.key&&e.shiftKey&&e.preventDefault()},g=function(e,t,n){"Tab"===e.key&&e.shiftKey&&(n[n.length-1].focus(),e.preventDefault())};!function(){var t=document.createElement("a");t.classList.add("modalCloseButton"),t.setAttribute("data-modal-close",!0),t.setAttribute("tabindex","0"),t.innerHTML=a.close.innerHTML,a.close.parentNode.removeChild(a.close);var r=document.createElement("div");r.classList.add("modal-inner");var o=document.createElement("div");o.classList.add("modal-inner--width");var l=document.createElement("div");l.classList.add("modal-inner--height");var c=document.createElement("div");c.classList.add("modal-content"),c.innerHTML=a.modal.innerHTML,l.appendChild(c),o.appendChild(l),r.appendChild(o),r.appendChild(t),a.modal.innerHTML="",a.modal.appendChild(r),document.body.appendChild(a.modal),t.addEventListener("keydown",function(t){var n;"Enter"===(n=t).key&&(i(e.parents(n.target,".modal")),n.preventDefault())}),n||(document.body.addEventListener("click",d),document.body.addEventListener("keydown",p),n=!0),window.addEventListener("resize",function(){s()})}()}}).call(this,n(0))},function(e,t,n){e.exports=n.p+"resources/img/outage-marker.svg"},function(e,t,n){e.exports=n.p+"resources/img/outage-planned.svg"},function(e,t,n){e.exports=n.p+"resources/img/outage-cluster.svg"},function(e,t,n){"use strict";t.a=function(e){e.addEventListener("click",function(t){t.target.classList.contains("close")&&e.parentNode.removeChild(e)})}},function(e,t,n){"use strict";(function(e){t.a=function(t){var n={el:t,links:t.querySelectorAll(".link"),signinLink:t.querySelector(".signin"),searchLink:t.querySelector(".search"),signinFlyout:t.querySelector(".signin__flyout"),searchFlyout:t.querySelector(".search__flyout")},r=function(){if(n.signinLink&&n.signinFlyout){var e=n.signinLink.offsetLeft,t=n.signinFlyout.offsetLeft;n.signinLink.classList.contains("open")&&(n.signinFlyout.querySelector(".tail").style.left="".concat(e-t,"px"))}if(n.searchLink&&n.searchFlyout){var r=n.searchLink.offsetLeft,o=n.searchFlyout.offsetLeft;n.searchLink.classList.contains("open")&&(n.searchFlyout.querySelector(".tail").style.left="".concat(r-o,"px"))}};!function(){if(n.signinLink&&(n.signinLink.style.visibility="visible"),t.addEventListener("click",function(t){var o=t.target;if(e.parents(o,".flyout")||o.classList.contains("flyout"))return!1;n.signinLink&&o===n.signinLink&&(n.searchLink&&n.searchLink.classList.remove("open"),e.toggleClass(n.signinLink,"open"),n.signinFlyout&&(setTimeout(function(){r()},100),t.preventDefault())),n.searchLink&&o===n.searchLink&&(n.signinLink&&n.signinLink.classList.remove("open"),e.toggleClass(n.searchLink,"open"),n.searchFlyout&&setTimeout(function(){r()},100),t.preventDefault())}),document.body.addEventListener("click",function(t){var r=t.target;r.classList.contains("open")||r.classList.contains("flyout")||e.parents(r,".flyout")||(n.signinLink&&n.signinLink.classList.remove("open"),n.searchLink&&n.searchLink.classList.remove("open"))}),window.addEventListener("resize",function(){r()}),"Edit"!==e.getCookie("cq-editor-layer.page")){var o=document.getElementsByClassName("location");if(o.length>0)if(!1===e.getCookie("PCState"))if(document.getElementsByClassName("state-modal").length>0){var a=new Date;a.setTime(a.getTime()+31536e6);var s=a.toUTCString(),i=location.hostname,l=i.split(".");l.length>1&&(i="."+l[l.length-2]+"."+l[l.length-1]),document.cookie="PCState=;expires="+s+";sameSite=Lax;path=/;domain="+i,o[0].dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window}))}}}()}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){t.a=function(t){var n={el:t,topNav:document.querySelector(".top-nav"),mobileNav:document.querySelector(".mobile-nav"),parents:document.querySelectorAll(".has-children"),topLevel:document.querySelectorAll(".level--top"),searchLink:document.querySelector(".top-nav__search"),searchInput:t.querySelector('input[type="text"]'),scrollbars:t.querySelector(".scrollbars")},r=[],o=function(t){var o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"toggle";if(t.parentNode.classList.contains("level--top")){var s=n.el.querySelectorAll(".open");Object.keys(s).map(function(e){t!==s[e]&&s[e].classList.remove("open")})}if(t.parentNode.classList.contains("level--sub")){var i=t.parentNode.querySelectorAll(".open");Object.keys(i).map(function(e){t!==i[e]&&i[e].classList.remove("open")})}"toggle"===o?e.toggleClass(t,"open"):"open"===o?t.classList.contains("open")||t.classList.add("open"):t.classList.contains("open")&&t.classList.remove("open"),a(r)},a=function(e){e.length=0,Array.prototype.slice.call(n.topLevel).forEach(function(t,n){!function e(t,n){for(var r=0,o=Array.from(n.children);r<o.length;r++){var a=o[r],s=a.getElementsByClassName("link")[0];if(t.push(s),a.classList.contains("has-children")&&a.classList.contains("open"))e(t,a.getElementsByClassName("list")[0])}}(e,t)})};!function(){n.mobileNav.addEventListener("click",function(e){n.scrollbars.perfectScroll.update();var t=e.target;t.classList.contains("mobile-nav__trigger")&&(n.topNav.classList.contains("nav-open")?(n.topNav.classList.remove("nav-open"),document.body.classList.remove("locked")):(n.topNav.classList.add("nav-open"),n.scrollbars.perfectScroll.update(),document.body.classList.add("locked"))),t.classList.contains("has-children")&&o(t)}),Array.prototype.forEach.call(n.parents,function(e){e.addEventListener("keydown",function(e){var t=-1;switch(e.key){case"Left":case"ArrowLeft":o(e.target.parentNode,"close"),e.stopImmediatePropagation();break;case"Right":case"ArrowRight":o(e.target.parentNode,"open"),e.stopImmediatePropagation();break;case"Up":case"ArrowUp":(t=r.indexOf(e.target))>0&&r[t-1].focus(),e.stopImmediatePropagation();break;case"Down":case"ArrowDown":(t=r.indexOf(e.target))>=0&&t<r.length-1&&r[t+1].focus(),e.stopImmediatePropagation()}})}),window.addEventListener("resize",function(){n.scrollbars.perfectScroll.update()});var s=t.querySelector(".active");if(s){var i=e.parents(s,".has-children");i.classList.add("open");var l=e.parents(i,".has-children");l&&l.classList.add("open")}a(r)}()}}).call(this,n(0))},function(e,t,n){"use strict";t.a=function(e){var t={trigger:e.querySelector(".expandable__trigger"),target:e.querySelector(".expandable__target")},n={opened:!1},r=function(){!0===n.opened?e.close():e.open()};e.close=function(){t.trigger.classList.remove("is-open"),t.target.style.display="none",n.opened=!1},e.open=function(){t.trigger.classList.add("is-open"),t.target.style.display="block",n.opened=!0},t.trigger.addEventListener("click",function(){r()}),t.trigger.addEventListener("keydown",function(e){13===e.keyCode&&r()})}},function(e,t,n){"use strict";t.a=function(e){var t={el:e,fields:e.querySelectorAll(".field")};e.setAttribute("novalidate","novalidate"),e.addEventListener("submit",function(n){Object.keys(t.fields).map(function(e){t.fields[e].validate()}),e.querySelector(".field__error")&&n.preventDefault()})}},function(e,t,n){"use strict";(function(e){function n(e){return(n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}t.a=function(t){var r={el:t,native:t.querySelector(".field__native"),error:t.querySelector(".field__error-message"),isMulti:!!t.querySelector(".field__native").multiple},o={change:document.createEvent("Event"),close:document.createEvent("Event"),open:document.createEvent("Event")};o.change.initEvent("change",!0,!0),o.close.initEvent("close",!0,!0),o.open.initEvent("open",!0,!0);var a=function(){r.el.classList.remove("open"),r.el.dispatchEvent(o.close),setTimeout(function(){i(!!r.el.classList.contains("selected")),t.validate()},250)},s=function(){r.el.classList.add("open"),r.el.dispatchEvent(o.open),i(!0)},i=function(e){r.el.classList[e?"add":"remove"]("focused")},l=function(e){if(void 0!==e){document.body.removeEventListener("keyup",p,!0);var a=function(){var e=r.el.querySelectorAll("li");Object.keys(e).map(function(t){r.native.options[t].removeAttribute("selected"),r.native.options[t].selected=!1,e[t].classList.contains("selected")&&(r.native.options[t].setAttribute("selected",!0),r.native.options[t].selected=!0)})};if(r.isMulti)e.classList.contains("selected")?e.classList.remove("selected"):e.classList.add("selected");else{var s=t.querySelector(".selected");s&&s.classList.remove("selected")}if("string"==typeof e){if(!r.native.querySelector('[value="'.concat(e,'"]')))return void("console"in window&&console.log("No option with that string value could be found."));var i=r.native.querySelector('[value="'.concat(e,'"]')),l=Array.from(i.parentNode.children).indexOf(i);return r.native.value=e,r.isMulti?a():r.el.querySelectorAll("li")[l].classList.add("selected"),r.el.classList.remove("open"),r.el.classList[-1!==r.native.selectedIndex?"add":"remove"]("selected"),r.el.classList[-1!==r.native.selectedIndex?"add":"remove"]("focused"),void r.el.dispatchEvent(o.change)}return"number"==typeof e?r.native.options[e]?(r.native.value=0===e?0:r.native.options[e].value,r.isMulti?a():r.el.querySelectorAll("li")[e].classList.add("selected"),r.el.classList.remove("open"),r.el.classList[-1!==r.native.selectedIndex?"add":"remove"]("selected"),r.el.classList[-1!==r.native.selectedIndex?"add":"remove"]("focused"),void r.el.dispatchEvent(o.change)):void("console"in window&&console.log("No option value with that numerical index could be found.")):"object"===n(e)?(r.isMulti?a():(r.native.value=e.dataset.value,e.classList.add("selected")),r.el.classList.remove("open"),r.el.classList[r.native.value?"add":"remove"]("selected"),r.el.classList[r.native.value?"add":"remove"]("focused"),void r.el.dispatchEvent(o.change)):void 0}},c=function(e){e.parentNode.scrollTop=e.offsetTop},u={searchString:"",lastTime:Date.now()},d=function(e){var n,r=e.keyCode,o=Date.now(),a=t.querySelector(".selected"),s="";a||(a=t.querySelectorAll(".sub-field__decorator li")[0]).classList.add("selected"),32==r?n=" ":1==e.key.length&&(n=e.key),a=function(e,n){for(var r=t.querySelectorAll(".list__item"),o=-1,a=e.dataset.value,s=0;s<r.length;s++)if(r[s].dataset.value===a){o=s;break}var i=e;for(s=0;s<r.length;s++){var l=n.toUpperCase(),c=r[(o+1+s)%r.length],u=c.dataset.value.toUpperCase(),d=new RegExp("^"+l);if(u.match(d)){(i=c).classList.add("selected"),e.classList.remove("selected"),i.parentNode.scrollTop=i.offsetTop;break}}return i}(a,s=o-u.lastTime>1e3?n:u.searchString===n?n:u.searchString+n),l(a),u={searchString:s,lastTime:o}},p=function(e){var n=e.keyCode,o=t.querySelector(".selected");o||(o=t.querySelectorAll(".sub-field__decorator li")[0]).classList.add("selected");var a=o.previousElementSibling,s=o.nextElementSibling;38===n&&(a&&(a.classList.add("selected"),o.classList.remove("selected"),c(o=a)),e.preventDefault()),40===n&&(s&&(s.classList.add("selected"),o.classList.remove("selected"),c(o=s)),e.preventDefault()),r.el.classList.contains("open")||l(o)};!function(){var n=document.createElement("ul");n.classList.add("sub-field__decorator"),r.el.setAttribute("tabindex",0),r.native.setAttribute("tabindex",-1);for(var o=0;o<r.native.options.length;o++){var c=r.native.options[o];c.setAttribute("hidden",!0);var u=document.createElement("li");u.classList.add("list__item"),u.innerHTML=c.innerHTML,u.dataset.value=c.value?c.value:"",n.appendChild(u)}r.native.parentElement.appendChild(n),r.el.validate=function(){e.checkValidity(t),r.error&&(r.error.style.left=r.native.parentNode.offsetLeft+"px")},r.el.addEventListener("click",function(e){var t=e.target;r.isMulti?l(t):r.el.classList.contains("open")?(l(t),a()):s()}),r.el.addEventListener("focusout",function(e){setTimeout(function(){r.el.classList.contains("selected")||i(!1),e.target.classList.contains("field__decorator")||a(),t.validate()},250)}),r.el.addEventListener("focusin",function(){setTimeout(function(){i(!0)},250)}),document.body.addEventListener("click",function(e){e.target!==r.el&&r.el.classList.contains("open")&&a()}),document.body.addEventListener("keydown",function(e){document.activeElement===r.el&&(38!==e.keyCode&&40!==e.keyCode||(p(e),e.preventDefault()),32!==e.keyCode&&1!==e.key.length||(d(e),e.preventDefault()),r.el.classList.contains("open")?13===e.keyCode&&r.el.querySelector(".sub-field__decorator .selected")&&(l(r.el.querySelector(".sub-field__decorator .selected")),""===r.native.value&&i(!1)):13===e.keyCode&&s())}),-1!==r.native.selectedIndex&&r.native.options[r.native.selectedIndex].innerHTML.length&&(r.el.classList.add("selected"),(r.el.classList.contains("select--dynamic-placeholder")||r.el.classList.contains("select--inline-label"))&&i(!0)),r.el.handleOpen=s,r.el.handleClose=a,r.el.handleSelection=l}()}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){t.a=function(t){var n={el:t,native:t.querySelector(".field__native"),error:t.querySelector(".field__error-message")},r=function(e,t){var r=e.parentElement;r.classList.contains("textarea--dynamic-placeholder")&&(t?(r.classList.add("focused"),n.native.focus()):n.native.value.length||r.classList.remove("focused"))};n.el.classList[n.native.value.length?"add":"remove"]("filled-out"),t.validate=function(){e.checkValidity(t),n.error&&(n.error.style.left=n.native.offsetLeft+"px")},n.el.classList.contains("textarea--dynamic-placeholder")&&(n.el.addEventListener("click",function(e){r(e.target,!0)}),n.native.addEventListener("keyup",function(e){r(e.target,!0)})),n.native.addEventListener("input",function(){n.el.classList[n.native.value.length?"add":"remove"]("filled-out"),setTimeout(function(){t.validate()},250)}),n.native.addEventListener("blur",function(e){r(e.target,!1),setTimeout(function(){t.validate()},250)}),n.native.value&&(n.el.classList.contains("textarea--dynamic-placeholder")||n.el.classList.contains("textarea--inline-label"))&&(n.el.classList.add("filled-out"),n.el.classList.add("focused"))}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){var n=function(e){return Array.from(e.parentNode.children).indexOf(e)},r=function(t){for(var r=t.querySelectorAll("tr td"),o=t.querySelectorAll('[scope="col"]'),a=t.querySelectorAll('[scope="row"]'),s=r.length,i=function(e,t){e.parentNode.insertBefore(t,e),t.appendChild(e)};s--;)o[n(r[s])]&&(r[s].dataset.heading=o[n(r[s])].innerHTML),a[n(r[s])]&&(r[s].dataset.heading=a[n(r[s])].innerHTML);var l=document.createElement("div");l.classList.add("table"),l.classList.add("table--default"),e.parents(t,"date-input-polyfill")||t.parentNode.classList&&t.parentNode.classList.contains("table")||i(t,l)};t.a=function(e){var t={el:e};t.el.classList.length||t.el.classList.contains("table__root")||(r(e),t.el.addEventListener("resize",function(){r(e)}))}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){n(53);t.a=function(t){var n,r={el:t,native:t.querySelector(".field__native"),error:t.querySelector(".field__error-message")};n=function(e,t){var n=e.parentElement;r.el.classList.contains("input--dynamic-placeholder")&&(t?n.classList.add("focused"):r.native.value.length||n.classList.remove("focused"))},t.validate=function(){e.checkValidity(t),r.error&&(r.error.style.left=r.native.offsetLeft+"px")},"radio"!==r.native.type&&"checkbox"!==r.native.type||(r.el.querySelector(".field__label").setAttribute("tabindex",0),r.native.setAttribute("tabindex",-1),t.addEventListener("click",function(e){setTimeout(function(){t.validate()},250)}),t.addEventListener("keyup",function(e){13===e.keyCode&&(r.native.checked=!0)})),"date"===r.native.type&&t.addEventListener("blur",function(e){setTimeout(function(){t.validate()},250)}),r.el.addEventListener("click",function(e){r.native.focus()}),r.native.addEventListener("blur",function(e){n(e.target,!1),setTimeout(function(){t.validate()},250)}),r.native.addEventListener("focus",function(e){n(e.target,!0)}),r.native.addEventListener("input",function(e){"radio"===r.native.type&&"checkbox"===r.native.type||(r.native.value.length?r.el.classList.add("filled-out"):r.el.classList.remove("filled-out")),"number"===r.native.type&&r.native.hasAttribute("step")&&r.native.hasAttribute("min")&&(r.native.value=parseInt(r.native.value)<parseInt(r.native.min)?parseInt(r.native.min):parseInt(r.native.value),r.native.hasAttribute("max")&&(r.native.value=parseInt(r.native.value)>parseInt(r.native.max)?parseInt(r.native.max):parseInt(r.native.value))),n(e.target,!0),setTimeout(function(){t.validate()},250)}),r.native.value&&(r.el.classList.add("selected"),(r.el.classList.contains("input--dynamic-placeholder")||r.el.classList.contains("input--inline-label"))&&(r.el.classList.add("filled-out"),r.el.classList.add("focused")))}}).call(this,n(0))},function(e,t,n){"use strict";t.a=function(e){if(e){var t={el:e,allExtensionRadios:document.querySelectorAll(".extension-radios"),toggles:e.querySelectorAll(".extension-radios__toggle")},n=function(e){e.preventDefault();for(var n=0;n<t.allExtensionRadios.length;n++)t.allExtensionRadios[n].classList.toggle("extension-radios--active")};!function(){for(var e=0;e<t.toggles.length;e++)t.toggles[e].addEventListener("click",n)}()}}},function(e,t,n){"use strict";t.a=function(e){if(e&&e.id){var t={el:e,closeToggles:e.querySelectorAll("[data-inline-modal-close]"),openToggles:document.querySelectorAll('[data-inline-modal="'.concat(e.id,'"]'))},n={active:!1},r=function(e){e.preventDefault(),t.el.methods.close()},o=function(e){e.preventDefault(),n.active?t.el.methods.close():t.el.methods.open()},a=function(){if(n.active){t.el.classList.remove("inline-modal--active"),n.active=!1;for(var e=0;e<t.closeToggles.length;e++)t.closeToggles[e].removeEventListener("click",r)}},s=function(){if(!n.active){t.el.classList.add("inline-modal--active"),n.active=!0;for(var e=0;e<t.closeToggles.length;e++)t.closeToggles[e].addEventListener("click",r)}};!function(){t.el.methods={open:s,close:a};for(var e=0;e<t.openToggles.length;e++)t.openToggles[e].addEventListener("click",o);t.el.classList.contains("inline-modal--active")&&s()}()}}},function(e,t,n){"use strict";t.a=function(e){var t={tabsSystem:e,tabs:e.querySelectorAll(".tab"),contents:e.querySelectorAll(".tab__panel"),nav:e.querySelector(".tab__nav")},n=function(e){for(var n=t.contents.length;n--;)t.contents[n].style.display="none",0===n&&e||t.tabs[n].classList.remove("cmp-tabs__tab--active")};(document.querySelector(".guide")||e.classList.contains("fed-tabs"))&&(t.nav.addEventListener("click",function(e){var r,o,a;e.target.classList.contains("tab")&&(n(!1),r=e.target,o=r.dataset.id,(a=t.tabsSystem.querySelector(['.tab__panel[data-id="',o,'"]'].join("")))&&(a.style.display="block",r.classList.add("cmp-tabs__tab--active"),r.classList.add("is-viewed")),e.preventDefault())}),n(!0),t.contents[0].style.display="block")}},function(e,t,n){"use strict";(function(e){t.a=function(t,n,r){if(t&&n&&r){var o={calculator:n,el:t,btnNext:t.querySelector(".steps-nav__next"),distanceInput:t.querySelector(".extension-calculator__fieldset--distance .field__native"),stateAnchors:t.querySelectorAll(".state-list__item > a"),stateSelect:t.querySelector(".extension-calculator__fieldset--state .select"),stateSelectNative:t.querySelector(".extension-calculator__fieldset--state .field__native")},a={isValid:!1},s=function(){a.isValid=!(!r.state||!r.distance||void 0===r.distance||r.distance<=0||r.distance>2639),o.btnNext.disabled=!a.isValid},i=function(){var e=o.calculator;a.isValid&&o.calculator.methods.nextStep(),e.scrollIntoView({block:"start"})},l=function(e){var t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];r.state=e;for(var n=0;n<o.stateAnchors.length;n++){var a=o.stateAnchors[n],i=a.parentElement,l=a.getAttribute("data-state-name"),c=a.getAttribute("data-state-abbr");c&&l&&l===e&&(r.state=c,r.stateName=l),c&&l===e?i.classList.add("state-list__item--active"):i.classList.remove("state-list__item--active")}t&&(o.stateSelect.handleSelection(e),o.stateSelect.validate()),s()},c=function(e){r.distance=e.target.value,s()};!function(){o.el.addEventListener("submit",function(e){e.preventDefault(),i()}),o.btnNext.addEventListener("click",function(e){e.preventDefault(),i()}),o.stateSelect.addEventListener("change",function(){var e=o.stateSelectNative.options[o.stateSelectNative.selectedIndex];l(e?e.value:"")}),o.distanceInput.addEventListener("input",c);for(var t=function(e){var t=o.stateAnchors[e],n=t.getAttribute("data-state-name");t.getAttribute("data-state-abbr")&&t.addEventListener("click",function(e){e.preventDefault(),l(n,!0)})},n=0;n<o.stateAnchors.length;n++)t(n);var r=e.getCookie("PCState");r&&l(r,!0)}()}}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){var r=n(19);t.a=function(t,n,o,a){if(t&&n&&o&&a){var s={calculator:n,el:t,btnNext:t.querySelector(".steps-nav__next"),btnBack:t.querySelector(".steps-nav__back"),ballparkWrapper:t.querySelector(".extension-calculator__ballpark"),ballparkNumber:t.querySelector(".extension-calculator__ballpark-number"),transformerRadios:t.querySelectorAll('input[name="ec-transformer"]'),transformerRadioLabels:t.querySelectorAll(".input-radio .field__label"),readyCheckboxes:t.querySelectorAll('input[name="ec-ready"]'),readyText:t.querySelector(".extension-calculator__ready-text"),btnReady:t.querySelector(".extension-calculator__ready-btn")},i={isValid:!1,ballparkActive:!1,readyChecks:0},l=function(){i.isValid=!!o.transformer,s.btnNext.disabled=!i.isValid},c=function(){for(var e=0;e<s.readyCheckboxes.length;e++)s.readyCheckboxes[e].checked=!1;i.readyChecks=0,g(!1)},u=function(t){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;if(i.ballparkActive=t,t){if(n.tooShort)s.calculator.classList.add("extension-calculator--short");else if(void 0!==n.estimate){s.calculator.classList.remove("extension-calculator--short");var r=e.currencyFormatter(n.estimate);s.ballparkNumber.textContent=r.substring(0,r.length-3)}s.ballparkWrapper.classList.add("extension-calculator__ballpark--active")}else s.ballparkWrapper.classList.remove("extension-calculator__ballpark--active")},d=function(e){o.transformer=e.target.value,u(!1),c(),l()},p=function(e){if(13===e.keyCode){var t,n=e.target.htmlFor;void 0!==n&&(t=s.el.querySelector("#"+n)),void 0!==t&&(o.transformer=t.value,u(!1),c(),t.checked=!0,l(),e.preventDefault())}},f=function(){if(i.isValid){var e=Object(r.a)(o,a);u(!0,e)}},m=function(e){e.target.checked?i.readyChecks++:i.readyChecks--,g(!1)},g=function(e){e?3===i.readyChecks?(s.readyText.classList.remove("extension-calculator__ready-text--first"),s.readyText.classList.add("extension-calculator__ready-text--last")):(s.readyText.classList.add("extension-calculator__ready-text--first"),s.readyText.classList.remove("extension-calculator__ready-text--last")):(s.readyText.classList.remove("extension-calculator__ready-text--first"),s.readyText.classList.remove("extension-calculator__ready-text--last"))},h=function(e){e.preventDefault(),g(!0)},v=function(){u(!1),c(),l()};!function(){s.el.methods={reInitStep:v},s.el.addEventListener("submit",function(e){e.preventDefault(),i.ballparkActive?g(!0):f()}),s.btnNext.addEventListener("click",function(e){e.preventDefault(),i.ballparkActive||f()}),s.btnBack.addEventListener("click",function(e){e.preventDefault(),u(!1),s.calculator.states.currentStep=3,s.calculator.states.activeSteps={step1:document.querySelector(".extension-calculator__step--one"),step2:document.querySelector(".extension-calculator__step--two")},s.calculator.methods.previousStep(),s.calculator.scrollIntoView({block:"start"})});for(var e=0;e<s.transformerRadios.length;e++)s.transformerRadios[e].addEventListener("change",d);for(var t=0;t<s.transformerRadioLabels.length;t++)s.transformerRadioLabels[t].addEventListener("keydown",function(e){p(e)});for(var n=0;n<s.readyCheckboxes.length;n++)s.readyCheckboxes[n].addEventListener("change",m);s.btnReady.addEventListener("click",h)}()}}}).call(this,n(0))},function(e,t,n){"use strict";var r=function(){var e={};window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi,function(t,n,r){e[n]=r});return e},o=function(e,t,n,r){e&&console.log(n+": "+t)},a=function(e,t,n){o(e.log,n.state,"State"),o(e.log,n.transformer,"Transformer");var r=n.state.toLowerCase();switch(e.lineType){case"A1/B1":o(e.log,"A1/B1","Short Overhead"),e.serviceCost=t.ohServiceCost*n.distance,e.svcRiser=0,e.extensionCost=t.ohTransformerCost,e.pri=0,e.priRiser=0,e.variance=t["".concat(r,"VarB1")];break;case"A3/B3":o(e.log,"A3/B3","Short Underground"),e.serviceCost=t.ugServiceCost*n.distance,e.svcRiser=t.riserServiceCost,e.extensionCost=t.ohTransformerCost,e.pri=0,e.priRiser=0,e.variance=t["".concat(r,"VarB3")];break;case"A4/B4":o(e.log,"A4/B4","Short Underground from Underground"),e.serviceCost=t.ugServiceCost*n.distance,e.svcRiser=0,e.extensionCost=t.ugTransformerCost,e.pri=0,e.priRiser=0,e.variance=t["".concat(r,"VarB4")];break;case"C1/D1":o(e.log,"C1/D1","Long Overhead"),e.serviceCost=t.ohServiceCost*t.defaultServiceDistance,e.svcRiser=0,e.extensionCost=t.ohTransformerCost,e.priRiser=0,n.distance<=t.endOfCRange?(o(e.log,"C1","Scenario"),e.pri=t.ohFromOhExtensionCost*(n.distance-t.defaultServiceDistance),e.variance=t["".concat(r,"VarC1")]):(o(e.log,"D1","Scenario"),e.pri=t.over1000OhExtensionCost*(n.distance-t.defaultServiceDistance),e.variance=t["".concat(r,"VarD1")]);break;case"C5/D5":o(e.log,"C5/D5","Long Overhead & Underground"),e.serviceCost=t.ugServiceCost*t.defaultServiceDistance,e.svcRiser=t.riserServiceCost,e.extensionCost=t.ohTransformerCost,e.priRiser=0,n.distance<=t.endOfCRange?(o(e.log,"C5","Scenario"),e.pri=t.ohFromOhExtensionCostC5*(n.distance-t.defaultServiceDistance),e.variance=t["".concat(r,"VarC5")]):(o(e.log,"D5","Scenario"),e.pri=t.over1000OhExtensionCostD5*(n.distance-t.defaultServiceDistance),e.variance=t["".concat(r,"VarD5")]);break;case"C7/D7":o(e.log,"C7/D7","Long Underground"),e.serviceCost=t.ugServiceCost*t.defaultServiceDistance,e.svcRiser=0,e.extensionCost=t.ugTransformerCost,n.distance<=t.endOfCRange?(o(e.log,"C7","Scenario"),e.pri=t.ugFromOhExtensionCost*(n.distance-t.defaultServiceDistance),e.priRiser=0,e.variance=t["".concat(r,"VarC7")]):(o(e.log,"D7","Scenario"),e.pri=t.over1000UgExtensionCost*(n.distance-t.defaultServiceDistance),e.priRiser=t.priRiserExtensionCost,e.variance=t["".concat(r,"VarD7")]);break;case"C8/D8":o(e.log,"C8/D8","Long Underground from Underground"),e.serviceCost=t.ugServiceCost*t.defaultServiceDistance,e.svcRiser=0,e.extensionCost=t.ugTransformerCost,e.priRiser=0,n.distance<=t.endOfCRange?(o(e.log,"C8","Scenario"),e.pri=t.ugFromUgExtensionCost*(n.distance-t.defaultServiceDistance),e.variance=t["".concat(r,"VarC8")]):(o(e.log,"D8","Scenario"),e.pri=t.over1000UgExtensionCost*(n.distance-t.defaultServiceDistance),e.variance=t["".concat(r,"VarD8")])}o(e.log,n.distance,"Distance")},s=function(e){return e<300?534:e<1e3?1e3:2e3},i=function(e,t,n,r){switch(e){case"A1/B1":return t>=n?"C1/D1":"A1/B1";case"A3/B3":return t>=n?"Underground"===r?"C7/D7":"C5/D5":"A3/B3";case"A4/B4":return t>=n?"C8/D8":"A4/B4";case"C1/D1":return t<n?"A1/B1":"C1/D1";case"C5/D5":return t<n?"A3/B3":"C5/D5";case"C7/D7":return t<n?"A3/B3":"C7/D7";case"C8/D8":return t<n?"A4/B4":"C8/D8"}},l=function(e){o(e.log,"$ "+e.meterCost,"Meter Cost"),o(e.log,"$"+e.serviceCost,"Service Cost"),o(e.log,"$"+e.svcRiser,"Service Riser Cost"),o(e.log,"$"+e.extensionCost,"Extension Cost"),o(e.log,"$"+e.pri,"Pri Cost"),o(e.log,"$"+e.priRiser,"Pri Riser Cost"),o(e.log,"$"+e.travelCost,"Travel cost"),o(e.log,"$"+-1*e.stateAllowance,"State Allowance"),o(e.log,"x "+e.variance,"Scenario Variance");var t=(e.meterCost+e.serviceCost+e.svcRiser+e.extensionCost+e.pri+e.priRiser+e.travelCost-e.stateAllowance)*e.variance,n=t>0?100*Math.round(t/100):0;return o(e.log,"$"+n,"Estimate Total"),n};t.a=function(e,t){var n,c=r().debug;if(void 0!==c&&(n="1"===c||"1#"===c),e&&t){if(e.distance<t.endOfABRange&&"yes"===e.transformer)return o(n,"Distance is too short for transformer",""),{tooShort:!0};var u=e.state.toLowerCase(),d={lineType:i(e.lineType,e.distance,t.endOfABRange,e.hvLines),meterCost:t.meterCost,travelCost:s(e.distance),stateAllowance:t["".concat(u,"AllowanceCredit")],log:n};return a(d,t,e),{estimate:l(d)}}}},function(e,t,n){"use strict";(function(e){var r=n(21),o=n(22);t.a=function(t){if(t){var n={el:t,steps:t.querySelectorAll(".sky-calculator__step"),stateOptionSelect:t.querySelector(".sky-calculator__fieldset--state .field__native"),stateOption:t.querySelector(".sky-calculator__fieldset--state .select")},a={activeSteps:{},currentStep:1,stepsData:{}},s=function(e){switch(e){case 1:default:new r.a(n.steps[0],n.el,a.stepsData),a.activeSteps.step1=n.steps[0];break;case 2:new o.a(n.steps[1],n.el,a.stepsData),a.activeSteps.step2=n.steps[1]}},i=function(e){for(var t=0;t<n.steps.length;t++)n.steps[t].classList.remove("sky-calculator__step--active");n.steps[e-1].classList.add("sky-calculator__step--active")},l=function(){a.currentStep++;var e=a.activeSteps["step".concat(a.currentStep)];e?a.currentStep>1&&e.methods.reInitStep():s(a.currentStep),i(a.currentStep)},c=function(){a.currentStep--;var e=a.activeSteps["step".concat(a.currentStep)];e?a.currentStep>1&&e.methods.reInitStep():s(a.currentStep),i(a.currentStep)};setTimeout(function(){e.setStateSelelection(n.stateOption,e.getCookie("PCState"))}),a.totalSteps=n.steps.length,n.el.methods={nextStep:l,previousStep:c},n.el.states=a,s(1)}}}).call(this,n(0))},function(e,t,n){"use strict";t.a=function(e,t,n){if(e&&t&&n){var r={skycalculator:t,el:e,btnNext:e.querySelector(".steps-nav__next"),stateOption:e.querySelector(".sky-calculator__fieldset--state"),stateOptionSelect:e.querySelector(".sky-calculator__fieldset--state .field__native"),customerTypeRadios:e.querySelectorAll('input[name="customer-type"]'),customerTypeLabels:e.querySelectorAll(".input .field__label"),smallNonRes:e.querySelector("#smallNonRes"),oregonSmallNonRes:e.querySelector('[data-modal="oregon-non-residential"]')},o={isValid:!1},a=function(){o.isValid=!(!n.customerType||!n.state)&&2===n.state.length,r.btnNext.disabled=!o.isValid},s=function(){o.isValid&&(r.skycalculator.methods.nextStep(),i())},i=function(){var e=document.querySelector("#nonres-option1"),t=document.querySelector("#nonres-option2"),r=document.querySelector("#nonres-option3"),o=document.querySelector("#default-option1"),a=document.querySelector("#option2-oregon"),s=document.querySelector("#option2-res"),i=document.querySelector("#blocksResult"),l=(document.querySelector("#salmonProtectionResults"),document.querySelector("#comparisonResults")),c=document.querySelector("#skyCalculatorLegend"),u=document.querySelector("#skyCalculatorLightBulb"),d=(document.querySelector("#skyCalculatorLaundry"),document.querySelector("#calculatorVariant"));document.querySelector("#numberOfMiles"),document.querySelector("#numberOfLaundryLoads"),document.querySelector("#numberOfBulbs"),document.querySelector("#numberOfPounds");switch(n.state){case"OR":d.innerHTML="Oregon - "+n.customerType;break;case"WA":d.innerHTML="Washington - "+n.customerType;break;case"CA":d.innerHTML="California - "+n.customerType;break;case"WY":d.innerHTML="Wyoming - "+n.customerType;break;case"UT":d.innerHTML="Utah - "+n.customerType;break;case"ID":d.innerHTML="Idaho - "+n.customerType}"OR"!==n.state&&"Residential"===n.customerType?(o.classList.add("sky-calculator__fieldset--active"),s.classList.add("sky-calculator__fieldset--active"),i.classList.add("sky-calculator__cells-cell--active"),l.classList.add("sky-calculator__cells-cell--active"),c.classList.add("sky-calculator__cells-cell--active"),u.classList.add("sky-calculator__cells-cell-nonres--active")):"OR"===n.state&&"Residential"===n.customerType?(o.classList.add("sky-calculator__fieldset--active"),a.classList.add("sky-calculator__fieldset--active"),i.classList.add("sky-calculator__cells-cell--active"),l.classList.add("sky-calculator__cells-cell--active"),c.classList.add("sky-calculator__cells-cell--active"),u.classList.add("sky-calculator__cells-cell-nonres--active")):"OR"===n.state&&"Small Non-Residential"===n.customerType?(o.classList.add("sky-calculator__fieldset--active"),a.classList.add("sky-calculator__fieldset--active"),i.classList.add("sky-calculator__cells-cell--active"),l.classList.add("sky-calculator__cells-cell--active"),c.classList.add("sky-calculator__cells-cell--active"),u.classList.add("sky-calculator__cells-cell-nonres--active")):(e.classList.add("sky-calculator__fieldset--active"),t.classList.add("sky-calculator__fieldset--active"),r.classList.add("sky-calculator__fieldset--active"),i.classList.add("sky-calculator__cells-cell--active"),l.classList.add("sky-calculator__cells-cell--active"),c.classList.add("sky-calculator__cells-cell--active"),u.classList.add("sky-calculator__cells-cell-nonres--active"))},l=function(e){var t=e.target.value;n.customerType=t,a()},c=function(e){if(13===e.keyCode){var t,o=e.target.htmlFor;if(void 0!==o&&(t=r.el.querySelector("#"+o)),void 0!==t){var s=t.value;t.checked=!0,n.customerType=s,a(),e.preventDefault()}}},u=function(){a()};!function(){r.el.methods={reInitStep:u},"OR"===r.stateOptionSelect.value?r.smallNonRes.classList.remove("hidden"):r.smallNonRes.classList.add("hidden"),r.el.addEventListener("submit",function(e){e.preventDefault(),s()}),r.btnNext.addEventListener("click",function(e){e.preventDefault(),s()});for(var e=0;e<r.customerTypeRadios.length;e++)r.customerTypeRadios[e].addEventListener("change",l);for(var t=0;t<r.customerTypeLabels.length;t++)r.customerTypeLabels[t].addEventListener("keydown",function(e){c(e)});r.stateOption.addEventListener("change",function(){var e,t=r.stateOptionSelect.options[r.stateOptionSelect.selectedIndex];e=t?t.value:"",n.state=e,a(),"OR"===n.state?(r.smallNonRes.classList.remove("hidden"),r.oregonSmallNonRes.classList.remove("hidden")):(r.smallNonRes.classList.add("hidden"),r.oregonSmallNonRes.classList.add("hidden"))})}()}}},function(e,t,n){"use strict";(function(e){t.a=function(t,n,r){if(t&&n&&r){var o={skycalculator:n,el:t,skyCalcForm:document.querySelector(".sky-calculator__step"),btnBack:t.querySelector(".steps-nav__back"),btnStartOver:t.querySelector(".steps-nav__next"),btnCalculatePercentageRes:t.querySelector("#calculatePercentageRes"),btnCalculatePercentageNon:t.querySelector("#calculatePercentageNonRes"),btnKwhMonthlyUsage:t.querySelector("#kwhMonthlyUsage"),btnCalculateBlocks:t.querySelector("#blockPerMonth"),btnUsageKwhHours:t.querySelector("#usageKwhHours"),loadsOfLaundry:t.querySelector("#loadsOfLaundry"),percentOfKwh:t.querySelector('input[data-type="percentageOfKwh"]'),totalKwh:t.querySelector('input[data-type="totalKwh"]'),totalLightBulbs:t.querySelector("#lightBulbAmount"),perMonthBudget:t.querySelector("#perMonthBudget"),btnPerMonthBudget:t.querySelector("#calculateMonthBudget"),fixedAmount:t.querySelector("#fixedAmount"),numberOfBlocks:t.querySelector("#numberOfBlocks"),monthlyCostFixed:t.querySelector("#monthlyCostFixed"),totalKwhRes:t.querySelector("#totalKwhRes"),totalPercentageRes:t.querySelector("#percentageRes"),monthlyCostBlocks:t.querySelector("#monthlyCostBlocks"),EvMiles:t.querySelector("#evMiles"),blocksPurchased:t.querySelector("#blocksPurchased"),equivalentKwh:t.querySelector("#equivalentKwh"),carbonFootprint:t.querySelector("#carbonFootprint"),kilowattHours:t.querySelector("#kilowattHours"),usage:t.querySelector("#usage"),checkboxSalmon:t.querySelector("#salmonCheckBox"),salmonPurchase:t.querySelector("#salmonProtectionResults"),supportResultWrapper:t.querySelector(".support-result__wrapper"),monthlyKwh:t.querySelector("#monthlyKwh"),supportResult:t.querySelector("#supportResult"),partnerLevelRadios:t.querySelectorAll('input[name="partner-level"]'),stateAverage:t.querySelectorAll('input[data-type="state-average"]'),radioLabels:t.querySelectorAll("label"),salmonIcon:t.querySelector("#salmonIcon"),btnCalculate:t.querySelector(".sky-calculator__button-calculate"),loadingOverlay:t.querySelector(".sky-calculator__overlay-loading"),odometer:t.querySelector(".odometer"),blocksResult:t.querySelector("#blocksResult"),evm:t.querySelector(".evm"),kwh:t.querySelector(".kwh"),data:{utStateAverage:732,wyStateAverage:731,idStateAverage:898,orStateAverage:897,waStateAverage:1195,caStateAverage:824,poundsPerKwhCost:.90392,loadsOfLaundryCost:3.045,evMilesTravelled:3.067484663,ledBulbsAmount:9.9,costPerBlock:1.95,price_per_kwh:.0105,price_per_qs_block:.7,price_qs_monthly_fee:125,price_habitat_fee:2.5,min_qs_blocks:101,kwhPerBlock:100}},a={isValid:!1,isChecked:!1},s=function(){a.isValid=!(!r.partnerLevel||!r.salmonSupport)},i=function(e){var t=e.target.value;r.partnerLevel=t,s()},l=function(){var e=document.querySelectorAll(".sky-calculator__fieldset--active");Object.keys(e).map(function(t){e[t].classList.remove("sky-calculator__fieldset--active")}),o.skycalculator.states.currentStep=2,o.skycalculator.states.activeSteps={step1:document.querySelector(".sky-calculator__step--one")},o.skycalculator.methods.previousStep()},c=function(e){if(e.target.checked)switch(r.state){case"OR":o.usage.value=o.data.orStateAverage,o.usage.setAttribute("readonly","readonly");break;case"WA":o.totalKwhRes.value=o.data.waStateAverage,o.totalKwhRes.setAttribute("readonly","readonly");break;case"CA":o.totalKwhRes.value=o.data.caStateAverage,o.totalKwhRes.setAttribute("readonly","readonly");break;case"WY":o.totalKwhRes.value=o.data.wyStateAverage,o.totalKwhRes.setAttribute("readonly","readonly");break;case"UT":o.totalKwhRes.value=o.data.utStateAverage,o.totalKwhRes.setAttribute("readonly","readonly");break;case"ID":o.totalKwhRes.value=o.data.idStateAverage,o.totalKwhRes.setAttribute("readonly","readonly");break;default:o.totalKwhRes.removeAttribute("value")}e.target.checked||(o.totalKwhRes.removeAttribute("readonly","readonly"),o.usage.removeAttribute("readonly","readonly"),o.usage.value="",o.totalKwhRes.value="")},u=function(e){13===e.keyCode&&"label"===e.target.tagName.toLowerCase()&&(o.el.querySelector("#"+e.target.htmlFor).click(),e.target.focus(),e.preventDefault())},d=function(){var e=o.blocksResult.getBoundingClientRect().top+document.documentElement.scrollTop-document.querySelector(".header-component").offsetHeight;document.documentElement.scrollTop=e-20},p=function(){o.loadingOverlay.style.display="block",setTimeout(function(){o.loadingOverlay.style.display="none"},1e3)};!function(){o.el.methods={reInitStep:l},o.btnStartOver.addEventListener("click",function(e){e.preventDefault(),window.scrollTo(0,0),window.location.reload()}),o.btnStartOver.addEventListener("keydown",function(e){13===e.keyCode&&(window.scrollTo(0,0),window.location.reload())});for(var n=o.partnerLevelRadios.length;n--;)o.partnerLevelRadios[n].addEventListener("change",i);for(var a=o.stateAverage.length;a--;)o.stateAverage[a].addEventListener("change",c);for(var s,f=o.radioLabels.length;f--;)o.radioLabels[f].addEventListener("keydown",u);if("#/"!==o.skyCalcForm.getAttribute("action")){var m=new XMLHttpRequest;m.onreadystatechange=function(){4==m.readyState&&200==m.status&&(o.data=JSON.parse(m.responseText),e.markupCalculatorData(o.data,e.serialize(o.skyCalcForm,"json"),!0))},m.open("get",o.skyCalcForm.action,!0),m.send()}o.el.addEventListener("keydown",function(e){"input"===e.target.tagName.toLowerCase()&&13===e.keyCode&&e.preventDefault()}),(s=function(e,n){var r=t.querySelectorAll(".blockResult");Object.keys(r).map(function(t){r[t].classList.add("hide"),r[t].id===e&&(r[t].classList.remove("hide"),n&&Object.keys(n).map(function(e){r[t].querySelector(".".concat(e)).innerHTML=n[e]}))})})("Residential"===r.customerType?"blockResultsOne-res":"blockResultsOne-nonres"),o.btnCalculateBlocks.addEventListener("click",function(t){t.preventDefault();var n=o.numberOfBlocks.value*o.data.kwhPerBlock*12,r=Math.round(n*o.data.evMilesTravelled),a=Math.round(n*o.data.ledBulbsAmount),i=Math.round(n*o.data.poundsPerKwhCost),l=o.numberOfBlocks.value<o.data.min_qs_blocks?o.numberOfBlocks.value*o.data.costPerBlock:o.numberOfBlocks.value*o.data.price_per_qs_block+o.data.price_qs_monthly_fee;o.monthlyCostBlocks.innerHTML=e.currencyFormatter(parseFloat(l)),s("blockResultsOne-res",{"blocks-purchased":Math.round(Number(o.numberOfBlocks.value)).toLocaleString(),"anual-kwh":Math.round(parseInt(n)).toLocaleString()}),o.EvMiles.innerHTML=parseInt(r).toLocaleString(),o.totalLightBulbs.innerHTML=parseInt(a).toLocaleString(),o.carbonFootprint.innerHTML=parseInt(i).toLocaleString(),o.salmonPurchase.classList.remove("sky-calculator__cells-cell--active"),p(),d()}),o.btnCalculatePercentageRes.addEventListener("click",function(t){t.preventDefault(),o.totalPercentageRes.value,o.totalKwhRes.value;var n,r=12*o.totalKwhRes.value,a=Math.ceil(r/12),i=Math.floor(Math.ceil(a/o.data.kwhPerBlock)*o.totalPercentageRes.value/100);n=i<o.data.min_qs_blocks?o.data.costPerBlock*i:i*o.data.price_per_qs_block+o.data.price_qs_monthly_fee,o.monthlyCostBlocks.innerHTML=e.currencyFormatter(parseFloat(n));var l=i*o.data.kwhPerBlock,c=12*l,u=Math.round(c*o.data.evMilesTravelled),f=Math.round(c*o.data.ledBulbsAmount),m=Math.round(c*o.data.poundsPerKwhCost);s("blockResultsTwo-res",{"monthly-kwh":l,"blocks-purchased":i,"anual-kwh":c}),o.EvMiles.innerHTML=parseInt(u).toLocaleString(),o.totalLightBulbs.innerHTML=parseInt(f).toLocaleString(),o.carbonFootprint.innerHTML=parseInt(m).toLocaleString(),o.salmonPurchase.classList.remove("sky-calculator__cells-cell--active"),p(),d()}),o.btnPerMonthBudget.addEventListener("click",function(t){var n;t.preventDefault();var r=(n=Math.floor((parseInt(o.fixedAmount.value)-o.data.price_qs_monthly_fee)/o.data.price_per_qs_block)>=o.data.min_qs_blocks?Math.floor((parseInt(o.fixedAmount.value)-o.data.price_qs_monthly_fee)/o.data.price_per_qs_block):Math.floor(parseInt(o.fixedAmount.value)/o.data.costPerBlock))*o.data.kwhPerBlock*12,a=Math.round(r*o.data.evMilesTravelled),i=Math.round(r*o.data.ledBulbsAmount),l=Math.round(r*o.data.poundsPerKwhCost),c=n<o.data.min_qs_blocks?n*o.data.costPerBlock:n*o.data.price_per_qs_block+o.data.price_qs_monthly_fee;o.monthlyCostBlocks.innerHTML=e.currencyFormatter(c),s("blockResultsOne-nonres",{"monthly-cost":e.currencyFormatter(parseFloat(o.fixedAmount.value)),"blocks-purchased":Number(n).toLocaleString(),"anual-kwh":r.toLocaleString()}),o.EvMiles.innerHTML=parseInt(a).toLocaleString(),o.totalLightBulbs.innerHTML=parseInt(i).toLocaleString(),o.carbonFootprint.innerHTML=parseInt(l).toLocaleString(),o.salmonPurchase.classList.remove("sky-calculator__cells-cell--active"),p(),d()}),o.btnCalculatePercentageNon.addEventListener("click",function(t){t.preventDefault(),o.percentOfKwh.value,o.totalKwh.value,o.totalKwh.value;var n=Math.ceil(parseInt(o.totalKwh.value)/o.data.kwhPerBlock),r=Math.floor(n*parseInt(o.percentOfKwh.value)/100);console.log(n,r);var a=r<o.data.min_qs_blocks?o.data.costPerBlock*r:r*o.data.price_per_qs_block+o.data.price_qs_monthly_fee;o.monthlyCostBlocks.innerHTML=e.currencyFormatter(a);var i=r*o.data.kwhPerBlock,l=12*i,c=Math.round(l*o.data.evMilesTravelled),u=Math.round(l*o.data.ledBulbsAmount),f=Math.round(l*o.data.poundsPerKwhCost);s("blockResultsTwo-nonres",{"monthly-kwh":i,"blocks-purchased":r,"anual-kwh":l}),o.EvMiles.innerHTML=parseInt(c).toLocaleString(),o.totalLightBulbs.innerHTML=parseInt(u).toLocaleString(),o.carbonFootprint.innerHTML=parseInt(f).toLocaleString(),o.salmonPurchase.classList.remove("sky-calculator__cells-cell--active"),p(),d()}),o.btnUsageKwhHours.addEventListener("click",function(t){t.preventDefault(),o.usage.value,o.data.kwhPerBlock;var n=12*o.usage.value,r=Math.round(n*o.data.evMilesTravelled),a=Math.round(n*o.data.ledBulbsAmount),i=Math.round(n*o.data.poundsPerKwhCost),l=o.usage.value*o.data.price_per_kwh;o.monthlyCostBlocks.innerHTML=e.currencyFormatter(l),s("blockResultsTwo-oregon",{"monthly-kwh":Math.round(parseInt(o.usage.value)).toLocaleString(),"anual-kwh":Math.round(parseInt(n)).toLocaleString()}),o.EvMiles.innerHTML=parseInt(r).toLocaleString(),o.totalLightBulbs.innerHTML=parseInt(a).toLocaleString(),o.carbonFootprint.innerHTML=parseInt(i).toLocaleString(),p(),o.salmonPurchase.classList.add("sky-calculator__cells-cell--active"),d(),o.checkboxSalmon.checked?(o.monthlyCostBlocks.innerHTML=e.currencyFormatter(parseFloat(l+2.5)),o.supportResult.innerHTML="Yes",o.supportResultWrapper.classList.add("support-result__wrapper--active")):(o.supportResult.innerHTML="No",o.supportResultWrapper.classList.add("support-result__wrapper--active"))}),o.btnKwhMonthlyUsage.addEventListener("click",function(t){t.preventDefault();var n,a=12*parseInt(o.monthlyKwh.value),i=Math.ceil(a/12),l=function(e,t,n){return i*e/o.data.kwhPerBlock<t?t:i*e/o.data.kwhPerBlock<n?Math.ceil(i*e/o.data.kwhPerBlock):n};"supporter"===r.partnerLevel&&(n=i<1e4?4:7),"champion"===r.partnerLevel&&(n=l(.1,10,350)),"visionary"===r.partnerLevel&&(n=l(.3,50,750));var c,u,f,m,g=n*o.data.kwhPerBlock*12,h=Math.round(g*o.data.evMilesTravelled),v=Math.round(g*o.data.ledBulbsAmount),y=Math.round(g*o.data.poundsPerKwhCost),b=(c=n,u=o.data.min_qs_blocks,f=o.data.costPerBlock,m=o.data.price_per_qs_block,c<u?f*c:c*m+o.data.price_qs_monthly_fee);o.monthlyCostBlocks.innerHTML=e.currencyFormatter(b),s("blockResultsThree",{"blocks-purchased":n,"monthly-cost":e.currencyFormatter(b),"anual-kwh":g.toLocaleString(),"partner-level":e.capitalizeFirstCharacter(r.partnerLevel)}),o.EvMiles.innerHTML=h.toLocaleString(),o.carbonFootprint.innerHTML=y.toLocaleString(),o.totalLightBulbs.innerHTML=v.toLocaleString(),o.salmonPurchase.classList.remove("sky-calculator__cells-cell--active"),d(),setTimeout(function(){p()},250)})}()}}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){t.a=function(t){var n={el:t,select:t.querySelector(".select"),native:t.querySelector(".field__native"),tabsNavItems:t.querySelectorAll(".cmp-tabs__tablist .cmp-tabs__tab")};n.select.addEventListener("change",function(e){e.target!==n.native&&n.tabsNavItems[n.native.selectedIndex].click()}),e.setStateSelelection(n.select,e.getCookie("PCState")),e.getCookie("PCState")||n.tabsNavItems[n.native.selectedIndex].click()}}).call(this,n(0))},function(e,t,n){"use strict";t.a=function(e){({flyout:document.querySelector(".search__flyout .field__native")}).flyout.value=""}},function(e,t,n){"use strict";n(1);t.a=function(e){var t={el:e},n=function(e,t,n,r){var o=e.target;if(o.classList.contains("pagination__left")||o.classList.contains("pagination__right")){var a=o.classList.contains("pagination__left"),s=o.classList.contains("pagination__right"),i=t.querySelector(".active");return a&&!i.previousSibling.classList.contains("pagination__left")&&(i.previousSibling.classList.add("active"),i.previousSibling.removeAttribute("tabindex"),i.classList.remove("active"),i.setAttribute("tabindex","0"),i.previousSibling.click()),s&&!i.nextSibling.classList.contains("pagination__right")&&(i.nextSibling.classList.add("active"),i.nextSibling.removeAttribute("tabindex"),i.classList.remove("active"),i.setAttribute("tabindex","0"),i.nextSibling.click()),!1}if(o.classList.contains("list__item")){t.querySelector(".active").setAttribute("tabindex","0"),t.querySelector(".active").classList.remove("active"),o.classList.add("active"),o.removeAttribute("tabindex");for(var l=9*(parseInt(t.querySelector(".active").innerHTML,10)-1),c=0;c<n.length;c++)c<l||c>=l+9?n[c].classList.add("hide"):n[c].classList.remove("hide");var u=1;u=l+9>n.length?n.length:l+9,r.innerHTML="Showing "+(l+1)+"-"+u+" of "+n.length}},r=function(){var e=1,r=document.createElement("footer"),o=t.el.querySelectorAll(".grid-result > .link"),a=t.el.querySelectorAll(".grid-result"),s=document.createElement("ul"),i=document.createElement("li"),l=document.createElement("li"),c=document.createElement("span");o.forEach(function(e){e.setAttribute("tabindex","-1"),e.parentElement.addEventListener("keydown",function(e){"Enter"==e.key&&e.target.querySelector("a").click()})}),i.setAttribute("tabindex","0"),l.setAttribute("tabindex","0"),s.setAttribute("class","list"),r.setAttribute("class","pagination"),c.setAttribute("class","pagination__outof-title"),c.innerHTML="Showing XX of ".concat(a.length),i.setAttribute("class","pagination__left list__item"),l.setAttribute("class","pagination__right list__item"),s.appendChild(i);for(var u=0;u<a.length;u++)if(u%9==0){var d=document.createElement("li");1===e?d.setAttribute("class","list__item active"):(d.setAttribute("class","list__item"),d.setAttribute("tabindex","0")),d.innerHTML=e,s.appendChild(d),e++}s.addEventListener("click",function(e){return function(t,r,o){n(e,t,r,o)}(s,a,c)}),s.addEventListener("keydown",function(e){return function(t,r,o){!function(e,t,r,o){"Enter"===e.key&&n(e,t,r,o)}(e,t,r,o)}(s,a,c)}),a.length<=9&&(s.style.display="none"),a.length>=1?(s.appendChild(l),r.appendChild(c),r.appendChild(s),t.el.appendChild(r),s.querySelector(".active")&&s.querySelector(".active").click()):(r.innerHTML="No results found",t.el.appendChild(r))};document.querySelector(".wcmmode-edit")||r()}},function(e,t,n){"use strict";(function(e){var r=n(27),o=n.n(r);t.a=function(t){var n,r={el:t,results:document.querySelector(".list-results"),resultsBody:document.querySelector(".list-results .table__body"),filterForm:t.querySelector(".form"),stateFilter:t.querySelector(".state-list .select"),stateFilterNative:t.querySelector(".state-list .select .field__native"),stateFilterList:t.querySelector(".state-list .select .sub-field__decorator"),cityFilter:t.querySelector(".city-list .select"),cityFilterNative:t.querySelector(".city-list .select .field__native"),cityFilterList:t.querySelector(".city-list .select .sub-field__decorator")},a=function(e){return"string"!=typeof e?"":e.charAt(0).toUpperCase()+e.slice(1)},s=function(e,n){var o=arguments.length>2&&void 0!==arguments[2]&&arguments[2],s=arguments.length>3&&void 0!==arguments[3]&&arguments[3],l=[],c=document.createDocumentFragment();if(Object.keys(e).map(function(t){l[t]=e[t]}),e=l,!0===s){var u=t.querySelector('select[name="state"]'),d=u.nextElementSibling,p=[],f=function(e){var t=document.createElement("option");return t.setAttribute("value",e),t.innerHTML=e?"OR"===e?"Oregon":"WA"===e?"Washington":"ID"===e?"Idaho":"UT"===e?"Utah":"CA"===e?"California":"WY"===e?"Wyoming":a(e):"",t},m=function(e){var t=document.createElement("li");return t.setAttribute("class","list__item"),t.setAttribute("data-value",e),t.innerHTML="OR"===e?"Oregon":"WA"===e?"Washington":"ID"===e?"Idaho":"UT"===e?"Utah":"CA"===e?"California":"WY"===e?"Wyoming":a(e),t};u.innerHTML="",u.appendChild(f("")),d.innerHTML="",d.appendChild(m("")),Object.keys(e).map(function(t){var n=e[t].STATE;-1===p.indexOf(n)&&n&&(p.push(n),r.stateFilterNative.appendChild(f(n)),r.stateFilterList.appendChild(m(n)))}),r.stateFilter.classList.remove("focused")}if(!0===o){var g=t.querySelector('select[name="city"]'),h=g.nextElementSibling,v=[],y=function(e){var t=document.createElement("option");return t.setAttribute("value",e),t.innerHTML=e||"",t},b=function(e){var t=document.createElement("li");return t.setAttribute("class","list__item"),t.setAttribute("data-value",e),t.innerHTML=e,t};g.innerHTML="",g.appendChild(y("")),h.innerHTML="",h.appendChild(b("")),Object.keys(e).map(function(t){var n=e[t].STATE;if(r.stateFilterNative.options[r.stateFilterNative.selectedIndex].value==n){var o=e[t].CITY;-1===v.indexOf(o)&&o&&(v.push(o),r.cityFilterNative.appendChild(y(o)),r.cityFilterList.appendChild(b(o)))}}),r.cityFilter.classList.remove("focused")}c.innerHTML=Object.keys(e).map(function(t){var n=e[t];l[t];if(!r.stateFilterNative.options[r.stateFilterNative.selectedIndex]||!r.cityFilterNative.options[r.cityFilterNative.selectedIndex])return!1;var o=r.stateFilterNative.options[r.stateFilterNative.selectedIndex].value,a=r.cityFilterNative.options[r.cityFilterNative.selectedIndex].value;return!!n.CITY&&(o===n.STATE&&(a==n.CITY&&'<tr class="table__row list-result">\n          <td class="table__data location-td">\n\t\t    <p>'.concat(n.STORE_NAME,'</p>\n            <p><a target="_blank" href="//www.google.com/maps/search/?api=1&query=').concat(n.ADDRESS,"+").concat(n.CITY,", ").concat(n.STATE,"+").concat(n.ZIP,'" class="link link--default">').concat(n.ADDRESS,'</a></p>\n            <p>\n              <a target="_blank" href="//www.google.com/maps/search/?api=1&query=').concat(n.ADDRESS,"+").concat(n.CITY,", ").concat(n.STATE,"+").concat(n.ZIP,'" class="link link--default">').concat(n.CITY,", ").concat(n.STATE," ").concat(n.ZIP,'</a>\n\t\t\t</p>\n\t\t  </td>\n          <td class="table__data details-td">\n              <p>').concat(n.PAYSTATION_TYPE,"</p\n              <p>").concat(n.PAYMENT_TYPES,'</p>\n\t\t\t  <div class="table__data-extra">\n\t\t\t\t<p>').concat(n.PROCESSING,"</p>\n\t\t\t\t<p>").concat(n.HOURS,'</p>\n\t\t\t  </div>\n            </div>\n          </td>\n          <td class="table__data fee-td"><p>').concat(n.PROCESSING,'</p></td>\n          <td class="table__data hours-td"><p>').concat(n.HOURS,"</p></td>\n        </tr>\n        ")))}).filter(function(e){return e}).join(""),r.resultsBody.innerHTML=c.innerHTML,r.results.querySelector("footer")&&r.results.removeChild(r.results.querySelector("footer")),i()},i=function(){var e=1,t=document.createElement("footer"),n=r.resultsBody.querySelectorAll(".list-result"),a=document.createElement("ul"),s=document.createElement("li"),i=document.createElement("li"),l=document.createElement("span");a.setAttribute("class","list"),t.setAttribute("class","pagination"),l.setAttribute("class","pagination__outof-title"),l.innerHTML="Showing XX of "+n.length,s.setAttribute("class","pagination__left list__item"),i.setAttribute("class","pagination__right list__item"),a.appendChild(s);for(var c=0;c<n.length;c++)if(c%25==0){var u=document.createElement("li");1===e?u.setAttribute("class","list__item active"):u.setAttribute("class","list__item"),u.innerHTML=e,a.appendChild(u),e++}var d=!0;a.addEventListener("click",function(e){var t=e.target;if(t.classList.contains("pagination__left")||t.classList.contains("pagination__right")){var s=t.classList.contains("pagination__left"),i=t.classList.contains("pagination__right"),c=a.querySelector(".active");return s&&!c.previousSibling.classList.contains("pagination__left")&&(c.previousSibling.classList.add("active"),c.classList.remove("active"),c.previousSibling.click()),i&&!c.nextSibling.classList.contains("pagination__right")&&(c.nextSibling.classList.add("active"),c.classList.remove("active"),c.nextSibling.click()),!1}if(t.classList.contains("list__item")){a.querySelector(".active").classList.remove("active"),t.classList.add("active");for(var u=25*(parseInt(a.querySelector(".active").innerHTML,10)-1),p=0;p<n.length;p++)p<u||p>=u+25?n[p].classList.add("hide"):n[p].classList.remove("hide");var f=1;f=u+25>n.length?n.length:u+25,l.innerHTML="Showing "+(u+1)+"-"+f+" of "+n.length}if(d)d=!d;else{var m=r.results.getBoundingClientRect().top;o.a.toY(m+window.pageYOffset)}}),n.length<=25&&(a.style.display="none"),n.length>=1?(a.appendChild(i),t.appendChild(l),t.appendChild(a),r.results.appendChild(t),a.querySelector(".active")&&a.querySelector(".active").click()):(t.innerHTML="No results found",r.results.appendChild(t))};n="#/"===r.filterForm.getAttribute("action")?"/resources/data/paystations02.csv":r.filterForm.action,e.XHR(n,{},function(t){r.data=JSON.parse(e.CSV2JSON(t.response)),s(r.data,e.serialize(r.filterForm,"json"),!0,!0),e.setStateSelelection(r.stateFilter,e.getCookie("PCState"),function(){s(r.data,e.serialize(r.filterForm,"json"),!0)})}),r.stateFilter.addEventListener("change",function(t){s(r.data,e.serialize(r.filterForm,"json"),!0),t.preventDefault()}),r.cityFilter.addEventListener("change",function(t){s(r.data,e.serialize(r.filterForm,"json"),!1),t.preventDefault()}),r.resultsBody.addEventListener("click",function(e){var t=e.target;if(t.classList.contains("details-toggle")){var n=t.parentNode.parentNode,r=n.querySelector(".details-td"),o=n.querySelector(".details"),a=n.querySelector(".table__data:nth-child(3n)"),s=n.querySelector(".table__data:nth-child(4n)"),i=n.querySelector(".table__data:nth-child(4n)");o.classList.contains("open")?(o.classList.remove("open"),r.removeAttribute("colspan"),a.classList.remove("hide"),s.classList.remove("hide"),i.classList.remove("hide"),t.innerHTML='<img src="/etc.clientlibs/pcorp/clientlibs/main/resources/img/plus-blue.svg" class="icon icon--plus-blue icon--normal icon--default" />'):(o.classList.add("open"),document.body.clientWidth>=650&&r.setAttribute("colspan",3),a.classList.add("hide"),s.classList.add("hide"),i.classList.add("hide"),t.innerHTML='<img src="/etc.clientlibs/pcorp/clientlibs/main/resources/img/minus-blue.svg" class="icon icon--minus-blue icon--normal icon--default" />')}}),r.cityFilter.addEventListener("open",function(e){!function(e){for(var t=r.cityFilterList.getElementsByClassName("selected")[0],n=r.cityFilterList.getElementsByClassName("list__item"),o=0,a=0;a<n.length;a++)n[a]==t&&(o=e<0?a>0?a-1:0:e>0?a<n.length-1?a+1:n.length-1:a);var s=n[o];s.parentNode.scrollTop=s.offsetTop}(0)})}}).call(this,n(0))},function(e,t,n){var r,o,a;o=[],r=function(){"use strict";var e=function(e){return e&&"getComputedStyle"in window&&"smooth"===window.getComputedStyle(e)["scroll-behavior"]};if("undefined"==typeof window||!("document"in window))return{};var t=function(t,n,r){var o;n=n||999,r||0===r||(r=9);var a=function(e){o=e},s=function(){clearTimeout(o),a(0)},i=function(e){return Math.max(0,t.getTopOf(e)-r)},l=function(r,o,i){if(s(),0===o||o&&o<0||e(t.body))t.toY(r),i&&i();else{var l=t.getY(),c=Math.max(0,r)-l,u=(new Date).getTime();o=o||Math.min(Math.abs(c),n),function e(){a(setTimeout(function(){var n=Math.min(1,((new Date).getTime()-u)/o),r=Math.max(0,Math.floor(l+c*(n<.5?2*n*n:n*(4-2*n)-1)));t.toY(r),n<1&&t.getHeight()+r<t.body.scrollHeight?e():(setTimeout(s,99),i&&i())},9))}()}},c=function(e,t,n){l(i(e),t,n)};return{setup:function(e,t){return(0===e||e)&&(n=e),(0===t||t)&&(r=t),{defaultDuration:n,edgeOffset:r}},to:c,toY:l,intoView:function(e,n,o){var a=e.getBoundingClientRect().height,s=t.getTopOf(e)+a,u=t.getHeight(),d=t.getY(),p=d+u;i(e)<d||a+r>u?c(e,n,o):s+r>p?l(s-u+r,n,o):o&&o()},center:function(e,n,r,o){l(Math.max(0,t.getTopOf(e)-t.getHeight()/2+(r||e.getBoundingClientRect().height/2)),n,o)},stop:s,moving:function(){return!!o},getY:t.getY,getTopOf:t.getTopOf}},n=document.documentElement,r=function(){return window.scrollY||n.scrollTop},o=t({body:document.scrollingElement||document.body,toY:function(e){window.scrollTo(0,e)},getY:r,getHeight:function(){return window.innerHeight||n.clientHeight},getTopOf:function(e){return e.getBoundingClientRect().top+r()-n.offsetTop}});if(o.createScroller=function(e,r,o){return t({body:e,toY:function(t){e.scrollTop=t},getY:function(){return e.scrollTop},getHeight:function(){return Math.min(e.clientHeight,window.innerHeight||n.clientHeight)},getTopOf:function(e){return e.offsetTop}},r,o)},"addEventListener"in window&&!window.noZensmooth&&!e(document.body)){var a="history"in window&&"pushState"in history,s=a&&"scrollRestoration"in history;s&&(history.scrollRestoration="auto"),window.addEventListener("load",function(){s&&(setTimeout(function(){history.scrollRestoration="manual"},9),window.addEventListener("popstate",function(e){e.state&&"zenscrollY"in e.state&&o.toY(e.state.zenscrollY)},!1)),window.location.hash&&setTimeout(function(){var e=o.setup().edgeOffset;if(e){var t=document.getElementById(window.location.href.split("#")[1]);if(t){var n=Math.max(0,o.getTopOf(t)-e),r=o.getY()-n;0<=r&&r<9&&window.scrollTo(0,n)}}},9)},!1);var i=new RegExp("(^|\\s)noZensmooth(\\s|$)");window.addEventListener("click",function(e){for(var t=e.target;t&&"A"!==t.tagName;)t=t.parentNode;if(!(!t||1!==e.which||e.shiftKey||e.metaKey||e.ctrlKey||e.altKey)){if(s){var n=history.state&&"object"==typeof history.state?history.state:{};n.zenscrollY=o.getY();try{history.replaceState(n,"")}catch(e){}}var r=t.getAttribute("href")||"";if(0===r.indexOf("#")&&!i.test(t.className)){var l=0,c=document.getElementById(r.substring(1));if("#"!==r){if(!c)return;l=o.getTopOf(c)}e.preventDefault();var u=function(){window.location=r},d=o.setup().edgeOffset;d&&(l=Math.max(0,l-d),a&&(u=function(){history.pushState({},"",r)})),o.toY(l,null,u)}}},!1)}return o}(),void 0===(a="function"==typeof r?r.apply(t,o):r)||(e.exports=a)},function(e,t,n){"use strict";t.a=function(e){var t={el:e,container:document.querySelector(".header-component"),currentPos:document.documentElement.scrollTop,mobileNav:e.querySelector(".top-nav"),startedAsSticky:!1},n=5,r=25,o=function(e,o){"down"===o&&e>=r&&t.container.classList.add("not-sticky"),"up"===o&&e>=n&&t.container.classList.remove("not-sticky")};e.classList.contains("is-sticky")&&(t.startedAsSticky=!0,t.container.classList.add("is-sticky"),e.classList.remove("is-sticky")),window.addEventListener("scroll",function(e){if(t.mobileNav.classList.contains("nav-open"))return!1;if(!1===t.startedAsSticky)return!1;var n=document.documentElement.scrollTop,r=t.currentPos;return 0===n&&t.container.classList.add("is-sticky"),t.currentPos=document.documentElement.scrollTop,r<n?o(n-r,"down"):o(r-n,"up"),!1})}},function(e,t,n){"use strict";(function(e){t.a=function(t){var n={el:t,startOver:t.querySelector(".startOver"),calculatorRows:t.querySelectorAll("#calculator .table__body .table__row"),calculatorSelects:t.querySelectorAll("#calculator .table__body .select"),calculatorInputNumbers:t.querySelectorAll("#calculator .table__body .input-number .field__native"),calculateRowDropdown:t.querySelectorAll(".calc-row-dropdown"),totalWaterHeater:t.querySelector(".total-water-heater"),totalAppliance:t.querySelector(".total-appliance"),totalMonthly:t.querySelector(".total-monthly")},r=function(e){for(var r=n.calculatorRows.length,o=0,a=0,s=t.querySelector("#calculator .table__body .table__row:last-child .table__data:last-child");r--;){var i=n.calculatorRows[r],l=i.querySelector(".average-total"),c=i.querySelector(".grand-total"),u=i.querySelector(".select .field__native"),d=i.querySelector(".input-number .field__native"),p=!0,f=!0,m=0,g=0;d&&(f=!1,m=d.value),u&&(p=!1),!1===p?(g=u.value,d||(m=1)):i.querySelector("[data-value]")&&(g=parseInt(i.querySelector("[data-value]").dataset.value)),l&&(l.innerHTML="x ".concat(g)),c&&(Number(g)&&Number(m)?c.innerHTML=Number(g)*Number(m):c.innerHTML=0),a+=!1===p&&!0===f?0:g*m,Number(g)&&Number(m)?o+=Number(g)*Number(m):o+=0}var h=parseInt(s.innerHTML)?parseInt(s.innerHTML):0;n.totalAppliance.innerHTML=a,n.totalWaterHeater.innerHTML=h,n.totalMonthly.innerHTML=o};!function(){n.startOver.addEventListener("click",function(e){!function(){for(var e=n.calculatorSelects.length,t=n.calculatorInputNumbers.length;e--;)n.calculatorSelects[e].handleSelection(0);for(;t--;)n.calculatorInputNumbers[t].value=0}(),n.calculatorRows[0].querySelector(".applianceSelector").focus(),e.preventDefault()});for(var t=n.calculatorSelects.length,o=n.calculatorInputNumbers.length,a=function(){var o=n.calculatorSelects[t];o.addEventListener("change",function(){r(e.parents(o,".table__row"))})};t--;)a();for(var s=function(){var t=n.calculatorInputNumbers[o];t.addEventListener("click",function(){r(e.parents(t,".table__row"))}),t.addEventListener("keyup",function(){t.value=t.value.replace(/^0+/,""),r(e.parents(t,".table__row"))}),t.addEventListener("input",function(){r(e.parents(t,".table__row"))})};o--;)s();r()}()}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){var r=n(2),o=n.n(r),a=n(3),s=n.n(a),i=n(4),l=n.n(i),c=n(31);function u(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function d(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}t.a=function(t){var n={el:t,map:document.querySelector(".outage-map__map"),mapTab:t.querySelectorAll(".tab")[0],listTab:t.querySelectorAll(".tab")[1],mapPanel:t.querySelectorAll(".tab__panel")[0],listPanel:t.querySelectorAll(".tab__panel")[1],header:t.querySelector(".outage-map__header"),footer:t.querySelector(".outage-map__footer"),stateSelect:t.querySelector(".select"),stateSelectNative:t.querySelector(".select .field__native"),legends:t.querySelector(".outage-map__keys-inner"),tableBody:t.querySelector(".table__body"),fieldset:t.querySelector(".fieldset"),radioLabels:t.querySelectorAll(".input-radio .field__label"),zipFilter:t.querySelector(".zip-filter"),labels:t.querySelectorAll(".label"),bounds:{OR:[46.3,-124.7,42,-116.5],WA:[47.4,-121.4,45.5,-116.9],WY:[45,-111.1,41,-104.1],ID:[44.8,-117.3,41,-111],CA:[42,-124.5,40.5,-120],UT:[42,-114.1,37,-109]}},r={el:t,map:document.querySelector(".outage-map")},a={alertState:!1},i=function(e){if(e.length){for(var t=e.length;t--;)e[t].setMap(null);for(var r=n.map.app.clusters.length;r--;)n.map.app.clusters[r].clearMarkers();n.map.app.markers=[],n.map.app.clusters=[]}},p=function(t){n.map.app.infowindow&&(n.map.app.infowindow.close(),n.map.app.infowindow=null);for(var r=document.getElementsByClassName("outage-info-alert-styles");r.length>0;){var o=r[0].parentNode.parentNode;o.parentNode.removeChild(o)}setTimeout(function(){if(n.stateSelectNative.options[t].dataset.alert){var r=new google.maps.InfoWindow({content:'<div class="outage-info-alert">\n            <p>'.concat(n.stateSelectNative.options[t].dataset.alert,"</p>\n          </div>"),position:S(n.map.app.getCenter(),0,150),maxWidth:300});r.open(n.map.app),n.map.app.infowindow=r,setTimeout(function(){e.parents(document.querySelector(".outage-info-alert"),".gm-style-iw-t").classList.add("outage-info-alert-styles");for(var t=document.getElementsByClassName("gm-style-iw"),n=0;n<t.length;n++){t[n].querySelector("button img").setAttribute("alt","close")}})}},1e3)},f=function(e){var r=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],o=new XMLHttpRequest;o.onreadystatechange=function(){if(4==o.readyState&&200==o.status){var t=JSON.parse(o.responseText),s=t.outages,i=n.bounds[e.replace("map","")],l=new google.maps.LatLng(i[0],i[1]),c=new google.maps.LatLng(i[2],i[3]);s.length&&r&&h(s);var u=t.count,d=t.totalState,p=n.stateSelectNative.options[n.stateSelectNative.selectedIndex].innerHTML;n.header.innerHTML="<p>There are <strong>".concat(u,"</strong> outages in <strong>").concat(p,"</strong> affecting <strong>").concat(d,"</strong> customers</p>"),n.footer.querySelector(".heading--h4").innerHTML="Map last updated ".concat(JSON.parse(o.responseText).last_upd),setTimeout(function(){n.map.app.fitBounds(new google.maps.LatLngBounds(l,c))}),a.alertState||(a.alertState=!0)}},o.open("get",document.querySelector(".guide")?"/dist/resources/data/".concat(e,".json"):"".concat(t.dataset.endpoint).concat(e,".json"),!0),o.send()},m=function(e){var r=new XMLHttpRequest;r.onreadystatechange=function(){4==r.readyState&&200==r.status&&(g(JSON.parse(r.responseText)),n.footer.querySelector(".heading--h4").innerHTML="Last updated ".concat(JSON.parse(r.responseText).last_upd))},r.open("get",document.querySelector(".guide")?"/dist/resources/data/".concat(e,".json"):"".concat(t.dataset.endpoint).concat(e,".json"),!0),r.send()},g=function(e){var t=document.querySelector('input[name="view-type"]:checked').value;e="county"===t?e.counties:e.zips;var r=Object.keys(e).map(function(n){return'<tr class="table__row" '.concat(e[n].zipCode?'data-zip="'.concat(e[n].zipCode,'"'):"",'>\n        <td class="table__data" data-heading="').concat(t,'">\n          ').concat("county"===t?e[n].countyName:e[n].zipCode,'\n        </td>\n        <td class="table__data" data-heading="Unplanned">\n          ').concat(e[n].outCountUnplan,'\n        </td>\n        <td class="table__data" data-heading="Planned">\n          ').concat(e[n].outCountPlan,'\n        </td>\n        <td class="table__data" data-heading="Unplanned">\n          ').concat(e[n].custOutUnplan,'\n        </td>\n        <td class="table__data" data-heading="Planned">\n          ').concat(e[n].custOutPlan,"\n        </td>\n      </tr>")}).filter(function(e){return e});n.tableBody.innerHTML=r.length?r.join(""):'<tr class="table__row"><td class="table__data" colspan="6">There appears to be no outages in this region.</td></tr>'},h=function(e){for(var t=new google.maps.LatLngBounds,r=function(t){var r=e[t],a=(parseInt(r.outCount),function(e,t){var n=e<50?20:e<100?30:e<1e3?35:e>=1e3?50:40,r=n;return{width:n,height:r,icon:{url:-1!==t.indexOf("Planned")?s.a:o.a,scaledSize:new google.maps.Size(n,r)}}}(parseInt(r.custOut),e[t].cause)),i=new google.maps.Marker(function(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?u(n,!0).forEach(function(t){d(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):u(n).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}({position:new google.maps.LatLng(r.latitude,r.longitude),etr:r.etr,outCount:parseInt(r.outCount),custOut:parseInt(r.custOut),cause:r.cause,crewStatus:r.crewStatus,reported:parseInt(r.reported),zip:r.zip,title:"Outages:".concat(parseInt(r.outCount),", Customers: ").concat(parseInt(r.custOut))},a)),l=new google.maps.InfoWindow({content:'<ol class="list list--blank outage-info-list rhythm rhythm--small">\n          <li><strong>Outages:</strong> '.concat(r.outCount,"</li>\n          <li><strong>Est. Restore:</strong> ").concat(r.etr,"</li>\n          <li><strong>Customers:</strong> ").concat(r.custOut,"</li>\n          <li><strong>Cause:</strong> ").concat(r.cause,"</li>\n          <li><strong>Status:</strong> ").concat(r.crewStatus,"</li>\n          <li><strong>First Report:</strong> ").concat(r.reported,"</li>\n          <li><strong>Zip:</strong> ").concat(r.zip,"</li>\n        </ol>")});i.addListener("click",function(){n.map.app.infowindow&&(n.map.app.infowindow.close(),n.map.app.infowindow=null),n.map.app.infowindow=l,l.open(n.map.app,i)}),i.setMap(n.map.app),n.map.app.markers.push(i)},a=0;a<e.length;a++)r(a);n.map.app.bounds=t;var i=new c.a(n.map.app,n.map.app.markers,{imagePath:l.a});n.map.app.clusters.push(i)},v=function(e){for(var n=t.querySelectorAll(".label"),r=n.length;r--;){var o=n[r];o.classList.contains("zip-label")&&(o.style.display="county"===e?"none":"inline"),o.classList.contains("county-label")&&(o.style.display="county"===e?"inline":"none")}},y=function(){for(var e=n.zipFilter.querySelector(".field__native").value,t=n.tableBody.querySelectorAll(".table__row"),r=t.length,o=0;r--;)t[r].style.display="none",-1!==t[r].dataset.zip.indexOf(e)&&(t[r].style.display="",o++);var a=document.createElement("tr"),s=document.createElement("td");s.setAttribute("colspan","5"),a.classList.add("no-results"),a.appendChild(s),o?n.tableBody.querySelector(".no-results")&&n.tableBody.removeChild(n.tableBody.querySelector(".no-results")):n.tableBody.querySelector(".no-results")||n.tableBody.appendChild(a)},b=function(){for(var e=!(arguments.length>0&&void 0!==arguments[0])||arguments[0],t=n.legends.querySelectorAll(".outage-map__panel"),r=t.length;r--;)e&&t[r].classList.contains("collapsed")?t[r].classList.remove("collapsed"):t[r].classList.add("collapsed")},_=function(e){if(13===e.keyCode){var t=e.target.control;if(void 0!==t){m(n.stateSelectNative.value.replace("map","list"));var r=t.value;"county"===r?(n.zipFilter.style.display="none",n.zipFilter.querySelector(".field__native").value="",v(r),y()):(n.zipFilter.style.display="inline-flex",v(r)),t.checked=!0}}},S=function(e,t,r){var o,a=Math.pow(2,n.map.app.getZoom());if(void 0!==n.map.app.getProjection()){var s=n.map.app.getProjection().fromLatLngToPoint(e),i=new google.maps.Point(t/a||0,r/a||0),l=new google.maps.Point(s.x-i.x,s.y+i.y);o=n.map.app.getProjection().fromPointToLatLng(l)}else o=e;return o},L=35,w=36,x=37,k=38,C=39,T=40,M=function(e){0===e?(n.listPanel.style.display="none",n.mapPanel.style.display="block",n.listTab.classList.remove("cmp-tabs__tab--active"),n.mapTab.classList.add("cmp-tabs__tab--active")):(n.mapPanel.style.display="none",n.listPanel.style.display="block",n.mapTab.classList.remove("cmp-tabs__tab--active"),n.listTab.classList.add("cmp-tabs__tab--active"))},E=function(e,t,n){switch(e.keyCode){case x:case k:1===n&&M(0);break;case C:case T:0===n&&M(1);break;case w:M(0);break;case L:M(1);break;default:return}};!function(){var o=n.stateSelectNative;if(n.map.app=new google.maps.Map(n.map,{zoom:5,maxZoom:13,minZoom:5,center:{lat:41.48273516349129,lng:-117.84654863432536},disableDefaultUI:!1,streetViewControl:!1,mapTypeControl:!0,mapTypeControlOptions:{mapTypeIds:["roadmap","satellite"],position:google.maps.ControlPosition.LEFT_TOP},zoomControlOptions:{position:google.maps.ControlPosition.LEFT_BOTTOM},fullscreenControlOptions:{position:google.maps.ControlPosition.RIGHT_BOTTOM}}),n.map.app.markers=[],n.map.app.clusters=[],n.map.app.clearAll=i,n.stateSelect.addEventListener("change",function(e){n.map.app.markers&&i(n.map.app.markers),m(o.value.replace("map","list")),f(o.value),p(o.selectedIndex)}),r.map.classList.contains("outage-map--mobile")){var a=n.stateSelect.querySelector(".field__native").options[0].innerText;e.setStateSelelection(n.stateSelect,a)}else e.getCookie("PCState")?e.setStateSelelection(n.stateSelect,e.getCookie("PCState")):(f(o.value),m(o.value.replace("map","list")),p(o.selectedIndex));n.mapTab.addEventListener("click",function(){f(o.value,!1)}),n.listTab.addEventListener("click",function(){m(o.value.replace("map","list"))}),n.mapTab.addEventListener("keydown",function(e){E(e,0,0)}),n.listTab.addEventListener("keydown",function(e){E(e,0,1)}),n.legends.addEventListener("click",function(e){e.target.classList.contains("heading")&&b()}),n.fieldset.addEventListener("click",function(e){var r=t.querySelector('input[name="view-type"]:checked').value,a=e.target;a.classList.contains("field__native")&&"radio"===a.type&&(m(o.value.replace("map","list")),"county"===r?(n.zipFilter.style.display="none",n.zipFilter.querySelector(".field__native").value="",v(r),y()):(n.zipFilter.style.display="inline-flex",v(r)))});for(var s=0;s<n.radioLabels.length;s++)n.radioLabels[s].addEventListener("keydown",function(e){_(e)});n.zipFilter.querySelector(".field__native").addEventListener("keyup",function(){y()}),window.addEventListener("resize",function(){document.body.offsetWidth<=768&&b(!1)}),document.body.offsetWidth<=768&&b(!1)}()}}).call(this,n(0))},function(e,t,n){"use strict";function r(e){return(r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function o(e,t,n){this.extend(o,google.maps.OverlayView),this.map_=e,this.markers_=[],this.clusters_=[],this.sizes=[27,37,47,57,67],this.styles_=[],this.ready_=!1;var r=n||{};this.gridSize_=r.gridSize||60,this.minClusterSize_=r.minimumClusterSize||2,this.maxZoom_=r.maxZoom||12,this.styles_=r.styles||[],this.imagePath_=r.imagePath||this.MARKER_CLUSTER_IMAGE_PATH_,this.zoomOnClick_=!0,null!=r.zoomOnClick&&(this.zoomOnClick_=r.zoomOnClick),this.averageCenter_=!0,null!=r.averageCenter&&(this.averageCenter_=r.averageCenter),this.setupStyles_(),this.setMap(e),this.prevZoom_=this.map_.getZoom();var a=this;google.maps.event.addListener(this.map_,"zoom_changed",function(){var e=a.map_.getZoom(),t=a.map_.minZoom||0,n=Math.min(a.map_.maxZoom||100,a.map_.mapTypes[a.map_.getMapTypeId()].maxZoom);e=Math.min(Math.max(e,t),n),a.prevZoom_!=e&&(a.prevZoom_=e,a.resetViewport())}),google.maps.event.addListener(this.map_,"idle",function(){a.redraw()}),t&&(t.length||Object.keys(t).length)&&this.addMarkers(t,!1)}function a(e){this.markerClusterer_=e,this.map_=e.getMap(),this.gridSize_=e.getGridSize(),this.minClusterSize_=e.getMinClusterSize(),this.averageCenter_=e.isAverageCenter(),this.center_=null,this.markers_=[],this.bounds_=null,this.clusterIcon_=new s(this,e.getStyles(),e.getGridSize())}function s(e,t,n){e.getMarkerClusterer().extend(s,google.maps.OverlayView),this.styles_=t,this.padding_=n||0,this.cluster_=e,this.center_=null,this.map_=e.getMap(),this.div_=null,this.sums_=null,this.visible_=!1,this.setMap(this.map_)}o.prototype.MARKER_CLUSTER_IMAGE_PATH_="../images/m",o.prototype.extend=function(e,t){return function(e){for(var t in e.prototype)this.prototype[t]=e.prototype[t];return this}.apply(e,[t])},o.prototype.onAdd=function(){this.setReady_(!0)},o.prototype.draw=function(){},o.prototype.setupStyles_=function(){if(!this.styles_.length)for(var e,t=0;e=this.sizes[t];t++)this.styles_.push({url:this.imagePath_,height:e,width:e})},o.prototype.fitMapToMarkers=function(){for(var e,t=this.getMarkers(),n=new google.maps.LatLngBounds,r=0;e=t[r];r++)n.extend(e.getPosition());this.map_.fitBounds(n)},o.prototype.setStyles=function(e){this.styles_=e},o.prototype.getStyles=function(){return this.styles_},o.prototype.isZoomOnClick=function(){return this.zoomOnClick_},o.prototype.isAverageCenter=function(){return this.averageCenter_},o.prototype.getMarkers=function(){return this.markers_},o.prototype.getTotalMarkers=function(){return this.markers_.length},o.prototype.setMaxZoom=function(e){this.maxZoom_=e},o.prototype.getMaxZoom=function(){return this.maxZoom_},o.prototype.calculator_=function(e,t){for(var n=0,r=e.length,o=0,a=0;a<e.length;a++)o+=parseInt(e[a].custOut);for(;0!==r;)r=parseInt(r/10,10),n++;o<=9?n=1:o>=10&&o<=99?n=2:o>=100&&o<=999?n=3:o>=1e3&&o<=9999?n=4:o>=1e4&&(n=5);parseInt(o);return{text:o,index:n}},o.prototype.setCalculator=function(e){this.calculator_=e},o.prototype.getCalculator=function(){return this.calculator_},o.prototype.addMarkers=function(e,t){if(e.length)for(var n=0;r=e[n];n++)this.pushMarkerTo_(r);else if(Object.keys(e).length)for(var r in e)this.pushMarkerTo_(e[r]);t||this.redraw()},o.prototype.pushMarkerTo_=function(e){if(e.isAdded=!1,e.draggable){var t=this;google.maps.event.addListener(e,"dragend",function(){e.isAdded=!1,t.repaint()})}this.markers_.push(e)},o.prototype.addMarker=function(e,t){this.pushMarkerTo_(e),t||this.redraw()},o.prototype.removeMarker_=function(e){var t=-1;if(this.markers_.indexOf)t=this.markers_.indexOf(e);else for(var n,r=0;n=this.markers_[r];r++)if(n==e){t=r;break}return-1!=t&&(e.setMap(null),this.markers_.splice(t,1),!0)},o.prototype.removeMarker=function(e,t){var n=this.removeMarker_(e);return!(t||!n)&&(this.resetViewport(),this.redraw(),!0)},o.prototype.removeMarkers=function(e,t){for(var n,r=e===this.getMarkers()?e.slice():e,o=!1,a=0;n=r[a];a++){var s=this.removeMarker_(n);o=o||s}if(!t&&o)return this.resetViewport(),this.redraw(),!0},o.prototype.setReady_=function(e){this.ready_||(this.ready_=e,this.createClusters_())},o.prototype.getTotalClusters=function(){return this.clusters_.length},o.prototype.getMap=function(){return this.map_},o.prototype.setMap=function(e){this.map_=e},o.prototype.getGridSize=function(){return this.gridSize_},o.prototype.setGridSize=function(e){this.gridSize_=e},o.prototype.getMinClusterSize=function(){return this.minClusterSize_},o.prototype.setMinClusterSize=function(e){this.minClusterSize_=e},o.prototype.getExtendedBounds=function(e){var t=this.getProjection(),n=new google.maps.LatLng(e.getNorthEast().lat(),e.getNorthEast().lng()),r=new google.maps.LatLng(e.getSouthWest().lat(),e.getSouthWest().lng()),o=t.fromLatLngToDivPixel(n);o.x+=this.gridSize_,o.y-=this.gridSize_;var a=t.fromLatLngToDivPixel(r);a.x-=this.gridSize_,a.y+=this.gridSize_;var s=t.fromDivPixelToLatLng(o),i=t.fromDivPixelToLatLng(a);return e.extend(s),e.extend(i),e},o.prototype.isMarkerInBounds_=function(e,t){return t.contains(e.getPosition())},o.prototype.clearMarkers=function(){this.resetViewport(!0),this.markers_=[]},o.prototype.resetViewport=function(e){for(var t,n=0;t=this.clusters_[n];n++)t.remove();var r;for(n=0;r=this.markers_[n];n++)r.isAdded=!1,e&&r.setMap(null);this.clusters_=[]},o.prototype.repaint=function(){var e=this.clusters_.slice();this.clusters_.length=0,this.resetViewport(),this.redraw(),window.setTimeout(function(){for(var t,n=0;t=e[n];n++)t.remove()},0)},o.prototype.redraw=function(){this.createClusters_()},o.prototype.distanceBetweenPoints_=function(e,t){if(!e||!t)return 0;var n=(t.lat()-e.lat())*Math.PI/180,r=(t.lng()-e.lng())*Math.PI/180,o=Math.sin(n/2)*Math.sin(n/2)+Math.cos(e.lat()*Math.PI/180)*Math.cos(t.lat()*Math.PI/180)*Math.sin(r/2)*Math.sin(r/2);return 6371*(2*Math.atan2(Math.sqrt(o),Math.sqrt(1-o)))},o.prototype.addToClosestCluster_=function(e){for(var t,n=4e4,r=null,o=(e.getPosition(),0);t=this.clusters_[o];o++){var s=t.getCenter();if(s){var i=this.distanceBetweenPoints_(s,e.getPosition());i<n&&(n=i,r=t)}}r&&r.isMarkerInClusterBounds(e)?r.addMarker(e):((t=new a(this)).addMarker(e),this.clusters_.push(t))},o.prototype.createClusters_=function(){if(this.ready_)for(var e,t=new google.maps.LatLngBounds(this.map_.getBounds().getSouthWest(),this.map_.getBounds().getNorthEast()),n=this.getExtendedBounds(t),r=0;e=this.markers_[r];r++)!e.isAdded&&this.isMarkerInBounds_(e,n)&&this.addToClosestCluster_(e)},a.prototype.isMarkerAlreadyAdded=function(e){if(this.markers_.indexOf)return-1!=this.markers_.indexOf(e);for(var t,n=0;t=this.markers_[n];n++)if(t==e)return!0;return!1},a.prototype.addMarker=function(e){if(this.isMarkerAlreadyAdded(e))return!1;if(this.center_){if(this.averageCenter_){var t=this.markers_.length+1,n=(this.center_.lat()*(t-1)+e.getPosition().lat())/t,r=(this.center_.lng()*(t-1)+e.getPosition().lng())/t;this.center_=new google.maps.LatLng(n,r),this.calculateBounds_()}}else this.center_=e.getPosition(),this.calculateBounds_();e.isAdded=!0,this.markers_.push(e);var o=this.markers_.length;if(o<this.minClusterSize_&&e.getMap()!=this.map_&&e.setMap(this.map_),o==this.minClusterSize_)for(var a=0;a<o;a++)this.markers_[a].setMap(null);return o>=this.minClusterSize_&&e.setMap(null),this.updateIcon(),!0},a.prototype.getMarkerClusterer=function(){return this.markerClusterer_},a.prototype.getBounds=function(){for(var e,t=new google.maps.LatLngBounds(this.center_,this.center_),n=this.getMarkers(),r=0;e=n[r];r++)t.extend(e.getPosition());return t},a.prototype.remove=function(){this.clusterIcon_.remove(),this.markers_.length=0,delete this.markers_},a.prototype.getSize=function(){return this.markers_.length},a.prototype.getMarkers=function(){return this.markers_},a.prototype.getCenter=function(){return this.center_},a.prototype.calculateBounds_=function(){var e=new google.maps.LatLngBounds(this.center_,this.center_);this.bounds_=this.markerClusterer_.getExtendedBounds(e)},a.prototype.isMarkerInClusterBounds=function(e){return this.bounds_.contains(e.getPosition())},a.prototype.getMap=function(){return this.map_},a.prototype.updateIcon=function(){var e=this.map_.getZoom(),t=this.markerClusterer_.getMaxZoom();if(t&&e>t)for(var n,r=0;n=this.markers_[r];r++)n.setMap(this.map_);else if(this.markers_.length<this.minClusterSize_)this.clusterIcon_.hide();else{var o=this.markerClusterer_.getStyles().length,a=this.markerClusterer_.getCalculator()(this.markers_,o);this.clusterIcon_.setCenter(this.center_),this.clusterIcon_.setSums(a),this.clusterIcon_.show()}},s.prototype.triggerClusterClick=function(){var e=this.cluster_.getMarkerClusterer();google.maps.event.trigger(e,"clusterclick",this.cluster_),e.isZoomOnClick()&&this.map_.fitBounds(this.cluster_.getBounds())},s.prototype.onAdd=function(){if(this.div_=document.createElement("DIV"),this.visible_){var e=this.getPosFromLatLng_(this.center_);this.div_.style.cssText=this.createCss(e),this.div_.innerHTML=this.sums_.text}this.getPanes().overlayMouseTarget.appendChild(this.div_);var t=this;google.maps.event.addDomListener(this.div_,"click",function(){t.triggerClusterClick()})},s.prototype.getPosFromLatLng_=function(e){var t=this.getProjection().fromLatLngToDivPixel(e);return t.x-=parseInt(this.width_/2,10),t.y-=parseInt(this.height_/2,10),t},s.prototype.draw=function(){if(this.visible_){var e=this.getPosFromLatLng_(this.center_);this.div_.style.top=e.y+"px",this.div_.style.left=e.x+"px"}},s.prototype.hide=function(){this.div_&&(this.div_.style.display="none"),this.visible_=!1},s.prototype.show=function(){if(this.div_){var e=this.getPosFromLatLng_(this.center_);this.div_.style.cssText=this.createCss(e),this.div_.style.display=""}this.visible_=!0},s.prototype.remove=function(){this.setMap(null)},s.prototype.onRemove=function(){this.div_&&this.div_.parentNode&&(this.hide(),this.div_.parentNode.removeChild(this.div_),this.div_=null)},s.prototype.setSums=function(e){this.sums_=e,this.text_=e.text,this.index_=e.index,this.div_&&(this.div_.innerHTML=e.text),this.useStyle()},s.prototype.useStyle=function(){var e=Math.max(0,this.sums_.index-1);e=Math.min(this.styles_.length-1,e);var t=this.styles_[e];this.url_=t.url,this.height_=t.height,this.width_=t.width,this.textColor_=t.textColor,this.anchor_=t.anchor,this.textSize_=t.textSize,this.backgroundPosition_=t.backgroundPosition},s.prototype.setCenter=function(e){this.center_=e},s.prototype.createCss=function(e){var t=[];t.push("background-image:url("+this.url_+");");var n=this.backgroundPosition_?this.backgroundPosition_:"0 0";t.push("background-position:"+n+";"),"object"===r(this.anchor_)?("number"==typeof this.anchor_[0]&&this.anchor_[0]>0&&this.anchor_[0]<this.height_?t.push("height:"+(this.height_-this.anchor_[0])+"px; padding-top:"+this.anchor_[0]+"px;"):t.push("height:"+this.height_+"px; line-height:"+this.height_+"px;"),"number"==typeof this.anchor_[1]&&this.anchor_[1]>0&&this.anchor_[1]<this.width_?t.push("width:"+(this.width_-this.anchor_[1])+"px; padding-left:"+this.anchor_[1]+"px;"):t.push("width:"+this.width_+"px; text-align:center;")):t.push("height:"+this.height_+"px; line-height:"+this.height_+"px; width:"+this.width_+"px; text-align:center;");var o=this.textColor_?this.textColor_:"white",a=this.textSize_?this.textSize_:11;return t.push("cursor:pointer; top:"+e.y+"px; left:"+e.x+"px; color:"+o+"; position:absolute; font-size:"+a+"px; font-family:Arial,sans-serif; font-weight:bold"),t.join("")},t.a=o},function(e,t,n){"use strict";(function(e){t.a=function(t,n,r){if(t&&n&&r){var o={Carecalculator:n,el:t,careCalcStep:document.querySelector(".care-calculator__step"),btnBack:t.querySelector(".steps-nav__back"),btnStartOver:t.querySelector(".steps-nav__restart"),priorMeterReading:t.querySelector("#priorMeterReading"),currentMeterReading:t.querySelector("#currentMeterReading"),meterReadingDifference:t.querySelector("#meterReadingDifference"),countyData:t.querySelector("#countyData"),heatingSourceData:t.querySelector("#heatingSourceData"),careEligibility:t.querySelector("#careEligibility"),priorDate:t.querySelector("#priorDate"),currentDate:t.querySelector("#currentDate"),baselineKwhPerDay:t.querySelector("#baselineKwhPerDay"),nonBaselineKwhPerDay:t.querySelector("#nonBaselineKwhPerDay"),cpucSurchargeKwh:t.querySelector("#cpucSurchargeKwh"),damRemovalKwh:t.querySelector("#damRemovalKwh"),pollutionPermitKwh:t.querySelector("#pollutionPermitKwh"),energyTaxKwh:t.querySelector("#energyTaxKwh"),baselineCharge:t.querySelector("#baselineCharge"),nonBaselineCharge:t.querySelector("#nonBaselineCharge"),cpucCharge:t.querySelector("#cpucCharge"),damRemovalCharge:t.querySelector("#damRemovalCharge"),lowIncomeCharge:t.querySelector("#lowIncomeCharge"),pollutionPermitCharge:t.querySelector("#pollutionCharge"),taxCharge:t.querySelector("#taxCharge"),summerBaselinePerDay:t.querySelector("#summerBaselinePerDay"),winterBaselinePerDay:t.querySelector("#winterBaselinePerDay"),winterBaseAllowance:t.querySelector("#winterBaseAllowance"),summerBaseAllowance:t.querySelector("#summerBaseAllowance"),totalBaseline:t.querySelector("#totalBaseline"),daysSummer:t.querySelector("#daysSummer"),daysWinter:t.querySelector("#daysWinter"),careCredit:t.querySelector("#careCredit"),careCreditDiscount:t.querySelector("#careCreditDiscount"),subTotal:t.querySelector("#subTotal"),totalCharges:t.querySelector("#totalCharges"),days:t.querySelector("#days"),discountPercentage:t.querySelector("#discountPercentage"),taxCostPer:t.querySelector("#taxCostPer"),lowIncomeCostPer:t.querySelector("#lowIncomeCostPer"),carbonCostPer:t.querySelector("#carbonCostPer"),damRemovalCostPer:t.querySelector("#damRemovalCostPer"),cpucCostPer:t.querySelector("#cpucCostPer"),nonBaselineCostPer:t.querySelector("#nonBaselineCostPer"),baselineCostPer:t.querySelector("#baselineCostPer"),lowIncomeKWH:t.querySelector("#lowIncomeKwh"),loadingOverlay:t.querySelector(".overlay-loading"),data:{basicCharge:7.2,baselineCostPer:.13425,nonBaselineCostPer:.15363,cpucCostPer:58e-5,damRemovalCostPer:.00202,carbonCostPer:.01188,discountPercentage:-.2,incentiveOffset:0,lowIncomeCostPer:.00674,taxCostPer:3e-4,baselineDelNorteSpaceHeatSummer:19.6,baselineDelNorteSpaceHeatWinter:34.3,baselineNonDelNorteSpaceHeatSummer:19.3,baselineNonDelNorteSpaceHeatWinter:35.8,baselineDelNorteBasicUseSummer:17.7,baselineDelNorteBasicUseWinter:123.9,baselineNonDelNorteBasicUseSummer:16.5,baselineNonDelNorteBasicUseWinter:22.2}},a=function(e){return Math.round(100*e)/100},s=function(){var e,t,n,a,s,i,l=6e4*r.priorDate.getTimezoneOffset(),c=Date.parse(r.priorDate)+l,u=Date.parse(r.currentDate)+l,d=u-c,p=Math.ceil(d/864e5),f=new Date(c),m=new Date(u),g=f.getMonth(),h=m.getMonth();switch(r.county){case"Del Norte":e=5,t=9;break;default:e=4,t=10}if((a=h>=e&&h<t?"summer":"winter")===(n=g>=e&&g<t?"summer":"winter"))"summer"===a?(o.daysSummer.innerHTML=p,o.days.innerHTML=p,o.daysWinter.innerHTML="0"):(o.daysWinter.innerHTML=p,o.daysSummer.innerHTML="0",o.days.innerHTML=p);else{switch(n){case"summer":s=(u-new Date(Date.UTC(f.getFullYear(),t,1)))/864e5+1,i=(new Date(Date.UTC(f.getFullYear(),t,1))-c)/864e5-1;break;case"winter":s=(new Date(Date.UTC(m.getFullYear(),e,1))-c)/864e5-1,i=(u-new Date(Date.UTC(m.getFullYear(),e,1)))/864e5+1}o.days.innerHTML=p,o.daysSummer.innerHTML=Math.round(i).toString(),o.daysWinter.innerHTML=Math.round(s).toString()}},i=function(){var e=o.data.baselineCostPer,t=o.data.cpucCostPer,n=o.data.damRemovalCostPer,a=o.data.carbonCostPer,s=o.data.taxCostPer,i=o.data.nonBaselineCostPer,l=o.data.lowIncomeCostPer,c=(o.data.discountPercentage,r.currentReading-r.priorReading);"care"===r.eligibility?o.careEligibility.innerHTML="Yes":o.careEligibility.innerHTML="No";var u,d,p,f,m,g=parseInt(o.daysSummer.innerHTML),h=parseInt(o.daysWinter.innerHTML);"Del Norte"!==r.county&&"Permanently Installed Electric Space Heating"===r.heatingSource?(u=o.data.baselineNonDelNorteSpaceHeatSummer,d=o.data.baselineNonDelNorteSpaceHeatWinter):"Del Norte"===r.county&&"Permanently Installed Electric Space Heating"===r.heatingSource?(u=o.data.baselineDelNorteSpaceHeatSummer,d=o.data.baselineDelNorteSpaceHeatWinter):"Del Norte"!==r.county&&"Basic Use and Electric Water Heating"===r.heatingSource?(u=o.data.baselineNonDelNorteBasicUseSummer,d=o.data.baselineNonDelNorteBasicUseWinter):(u=o.data.baselineDelNorteBasicUseSummer,d=o.data.baselineDelNorteBasicUseWinter),p=(f=Math.floor(g*u))+(m=Math.floor(h*d)),o.summerBaselinePerDay.innerHTML=u,o.winterBaselinePerDay.innerHTML=d,o.summerBaseAllowance.innerHTML=f,o.winterBaseAllowance.innerHTML=m,o.totalBaseline.innerHTML=p,o.nonBaselineKwhPerDay.innerHTML=c-p,o.baselineKwhPerDay.innerHTML=p,c<p&&(o.nonBaselineKwhPerDay.innerHTML=0,o.baselineKwhPerDay.innerHTML=c),o.priorMeterReading.innerHTML=r.priorDate.getUTCMonth()+1+"/"+r.priorDate.getUTCDate()+"/"+r.priorDate.getUTCFullYear()+" &ndash; "+r.priorReading+' <span class="transformless">kWh</span>',o.currentMeterReading.innerHTML=r.currentDate.getUTCMonth()+1+"/"+r.currentDate.getUTCDate()+"/"+r.currentDate.getUTCFullYear()+" &ndash; "+r.currentReading+' <span class="transformless">kWh</span>',o.meterReadingDifference.innerHTML=c,o.countyData.innerHTML=r.county,o.heatingSourceData.innerHTML=r.heatingSource,o.cpucSurchargeKwh.innerHTML=c,o.damRemovalKwh.innerHTML=c,o.pollutionPermitKwh.innerHTML=c,o.energyTaxKwh.innerHTML=c,o.discountPercentage.innerHTML="-20%",o.taxCostPer.innerHTML=parseFloat(s).toFixed(5),o.lowIncomeKWH.innerHTML=c,o.lowIncomeCostPer.innerHTML=parseFloat(l).toFixed(5),o.carbonCostPer.innerHTML=parseFloat(a).toFixed(5),o.damRemovalCostPer.innerHTML=parseFloat(n).toFixed(5),o.cpucCostPer.innerHTML=parseFloat(t).toFixed(5),o.baselineCostPer.innerHTML=parseFloat(e).toFixed(5),o.nonBaselineCostPer.innerHTML=parseFloat(i).toFixed(5)},l=function(){var t=o.data.basicCharge,n=o.data.cpucCostPer,s=o.data.damRemovalCostPer,i=o.data.carbonCostPer,l=o.data.taxCostPer,c=r.currentReading-r.priorReading,u=parseInt(o.totalBaseline.innerHTML),d=c>=u?u*o.data.baselineCostPer:c*o.data.baselineCostPer,p=c>=u?(c-u)*o.data.nonBaselineCostPer:0*o.data.nonBaselineCostPer;if("non care"===r.eligibility){var f=n*c,m=s*c,g=o.data.lowIncomeCostPer*c,h=i*c,v=a(l*c),y=a(e.roundToTwo(t)+e.roundToTwo(p)+e.roundToTwo(d)+e.roundToTwo(f)+e.roundToTwo(m)+e.roundToTwo(h)+e.roundToTwo(g)),b=a(y+v);o.baselineCharge.innerHTML=e.currencyFormatter(d),o.subTotal.innerHTML=e.currencyFormatter(y),o.totalCharges.innerHTML=e.currencyFormatter(b),o.lowIncomeCharge.innerHTML=e.currencyFormatter(g),o.cpucCharge.innerHTML=e.currencyFormatter(f),o.damRemovalCharge.innerHTML=e.currencyFormatter(m),o.pollutionPermitCharge.innerHTML=e.currencyFormatter(h),o.taxCharge.innerHTML=e.currencyFormatter(v),o.nonBaselineCharge.innerHTML=e.currencyFormatter(p)}else{var _=n*c,S=s*c,L=(o.data.lowIncomeCostPer,i*c),w=Math.round(100*d)/100+Math.round(100*_)/100+Math.round(100*S)/100+Math.round(100*t)/100+Math.round(100*L)/100+Math.round(100*p)/100,x=w*Math.abs(o.data.discountPercentage),k=a(e.roundToTwo(d)+e.roundToTwo(_)+e.roundToTwo(S)+e.roundToTwo(t)+e.roundToTwo(L)+e.roundToTwo(p)-e.roundToTwo(x)),C=a(l*c),T=a(k+C);o.baselineCharge.innerHTML=e.currencyFormatter(d),o.subTotal.innerHTML=e.currencyFormatter(k),o.totalCharges.innerHTML=e.currencyFormatter(T),o.lowIncomeKWH.innerHTML=0,o.lowIncomeCharge.innerHTML=e.currencyFormatter(0),o.nonBaselineCharge.innerHTML=e.currencyFormatter(p),o.careCredit.innerHTML=e.currencyFormatter(w),o.careCreditDiscount.innerHTML=e.currencyFormatter(-x),o.cpucCharge.innerHTML=e.currencyFormatter(_),o.damRemovalCharge.innerHTML=e.currencyFormatter(S),o.pollutionPermitCharge.innerHTML=e.currencyFormatter(L),o.taxCharge.innerHTML=e.currencyFormatter(C),o.nonBaselineCharge=e.currencyFormatter(p)}var M=document.querySelector("#nonCareHiddenCredit"),E=document.querySelector("#careHiddenLowIncome");E.removeAttribute("style"),M.removeAttribute("style"),"non care"===r.eligibility?M.style.display="none":E.style.display="none"},c=function(){o.Carecalculator.states.currentStep=2,o.Carecalculator.states.activeSteps={step1:document.querySelector(".care-calculator__step--one")},o.Carecalculator.methods.previousStep()};!function(){if(o.el.methods={reInitStep:c},o.btnBack.addEventListener("click",function(e){e.preventDefault(),c()}),o.btnStartOver.addEventListener("click",function(e){e.preventDefault(),window.location.reload()}),"#/"!==o.careCalcStep.getAttribute("action")){var t=new XMLHttpRequest;t.onreadystatechange=function(){4==t.readyState&&200==t.status&&(o.data=JSON.parse(t.responseText),e.markupCalculatorData(o.data,e.serialize(o.careCalcStep,"json"),!0),s(),i(),l())},t.open("get",o.careCalcStep.action,!0),t.send()}else e.markupCalculatorData(o.data,e.serialize(o.careCalcStep,"json"),!0),s(),i(),l();o.loadingOverlay.style.display="block",setTimeout(function(){o.loadingOverlay.style.display="none"},1e3)}()}}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){t.a=function(t){var n,r={el:t,form:document.querySelector(".signin__flyout form"),header:document.querySelector(".header--default"),inner:document.querySelector(".signin__inner"),signoutLink:document.querySelector(".signin__inner .signout"),signinLink:document.querySelector("a.signin"),logInFlyout:document.querySelector(".signin__flyout.logged-in"),logOutFlyout:document.querySelector(".signin__flyout.logged-out"),cookieUsername:document.querySelector(".cookie-username")};(n=e.getCookie("WCSSSignin"))&&(n=n.trim().toLowerCase()),t.innerHTML="true"===n?'\n\t  <img src="/etc.clientlibs/pcorp/clientlibs/main/resources/img/icon_circle_avatar_filled.svg" class="icon icon--icon_circle_avatar_filled icon--normal icon--default" alt="manage account" />\n    ':"Sign in","true"===n&&r.signinLink&&r.signinLink.setAttribute("href","#"),"true"===n?(r.header.classList.add("logged-in"),e.getCookie("WCSSCname")&&r.cookieUsername&&(r.cookieUsername.innerHTML=e.getCookie("WCSSCname")),r.logOutFlyout&&e.remove(r.logOutFlyout)):r.logInFlyout&&e.remove(r.logInFlyout)}}).call(this,n(0))},function(e,t,n){"use strict";(function(e){t.a=function(t){var n={el:t,stateList:document.querySelector('[data-modal="top-nav-location"] .state-list'),stateSelect:document.querySelector('[data-modal="top-nav-location"] .select'),stateSelectNative:document.querySelector('[data-modal="top-nav-location"] .select .field__native'),stateIcon:document.querySelector("img.icon--add-location")},r=function(){for(var e=n.stateList.querySelectorAll(".state-list__item"),t=e.length;t--;)e[t].classList.remove("state-list__item--active")},o=function(){var t=e.getCookie("PCState").toString();n.stateIcon.setAttribute("src","/etc.clientlibs/pcorp/clientlibs/main/resources/img/state-".concat(t.trim().toLowerCase(),"-icon.svg")),n.stateIcon.style.display="block"};!function(){if(n.stateList){for(var t=n.stateList.querySelectorAll("a"),a=t.length;a--;)e.getCookie("PCState")&&t[a].dataset.stateName.trim()===e.getCookie("PCState").trim()&&(t[a].classList.add("state-list__item--active"),o());n.stateSelect.addEventListener("change",function(e){var t=document.querySelector(".modal-visible [data-modal-close]");t&&t.click(),r(),n.stateList.querySelector('[data-state-abbr="'+n.stateSelectNative.value+'"]').parentNode.classList.add("state-list__item--active"),o()}),n.stateList.addEventListener("click",function(t){var a=t.target;if(a.dataset){r(),a.parentNode.classList.add("state-list__item--active"),n.stateSelect.handleSelection(a.dataset.stateAbbr);var s=location.hostname,i=s.split(".");i.length>1&&(s=".".concat(i[i.length-2],".").concat(i[i.length-1])),e.setCookie("PCState",a.dataset.stateName,365,"/",s),location.href="//".concat(location.host).concat(location.pathname),o()}})}}()}}).call(this,n(0))},function(e,t,n){"use strict";var r=n(36),o=n.n(r);t.a=function(e){var t,n={el:e};t=new o.a({el:n.el,value:n.el.innerHTML}),n.el.odometer=t}},function(e,t){(function(){var t,n,r,o,a,s,i,l,c,u,d,p,f,m,g,h,v,y,b,_,S,L,w=[].slice;n=/^\(?([^)]*)\)?(?:(.)(d+))?$/,t=2e3,r=2,o=1e3/30,g=document.createElement("div").style,i=null!=g.transition||null!=g.webkitTransition||null!=g.mozTransition||null!=g.oTransition,f=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||window.msRequestAnimationFrame,a=window.MutationObserver||window.WebKitMutationObserver||window.MozMutationObserver,c=function(e){var t;return(t=document.createElement("div")).innerHTML=e,t.children[0]},p=function(e,t){return e.className=e.className.replace(new RegExp("(^| )"+t.split(" ").join("|")+"( |$)","gi")," ")},l=function(e,t){return p(e,t),e.className+=" "+t},h=function(e,t){var n;if(null!=document.createEvent)return(n=document.createEvent("HTMLEvents")).initEvent(t,!0,!0),e.dispatchEvent(n)},d=function(){var e,t;return null!=(e=null!=(t=window.performance)&&"function"==typeof t.now?t.now():void 0)?e:+new Date},m=function(e,t){return null==t&&(t=0),t?(e*=Math.pow(10,t),e+=.5,(e=Math.floor(e))/Math.pow(10,t)):Math.round(e)},v=function(e){return e<0?Math.ceil(e):Math.floor(e)},u=function(e){return e-m(e)},b=!1,(y=function(){var e,t,n,r,o;if(!b&&null!=window.jQuery){for(b=!0,o=[],t=0,n=(r=["html","text"]).length;t<n;t++)e=r[t],o.push(function(e){var t;return t=window.jQuery.fn[e],window.jQuery.fn[e]=function(e){var n;return null==e||null==(null!=(n=this[0])?n.odometer:void 0)?t.apply(this,arguments):this[0].odometer.update(e)}}(e));return o}})(),setTimeout(y,0),(s=function(){function e(n){var a,s,i,l,c,u,d,p,f,m=this;if(this.options=n,this.el=this.options.el,null!=this.el.odometer)return this.el.odometer;for(a in this.el.odometer=this,d=e.options)i=d[a],null==this.options[a]&&(this.options[a]=i);null==(l=this.options).duration&&(l.duration=t),this.MAX_VALUES=this.options.duration/o/r|0,this.resetFormat(),this.value=this.cleanValue(null!=(p=this.options.value)?p:""),this.renderInside(),this.render();try{for(c=0,u=(f=["innerHTML","innerText","textContent"]).length;c<u;c++)s=f[c],null!=this.el[s]&&function(e){Object.defineProperty(m.el,e,{get:function(){var t;return"innerHTML"===e?m.inside.outerHTML:null!=(t=m.inside.innerText)?t:m.inside.textContent},set:function(e){return m.update(e)}})}(s)}catch(e){e,this.watchForMutations()}}return e.prototype.renderInside=function(){return this.inside=document.createElement("div"),this.inside.className="odometer-inside",this.el.innerHTML="",this.el.appendChild(this.inside)},e.prototype.watchForMutations=function(){var e=this;if(null!=a)try{return null==this.observer&&(this.observer=new a(function(t){var n;return n=e.el.innerText,e.renderInside(),e.render(e.value),e.update(n)})),this.watchMutations=!0,this.startWatchingMutations()}catch(e){e}},e.prototype.startWatchingMutations=function(){if(this.watchMutations)return this.observer.observe(this.el,{childList:!0})},e.prototype.stopWatchingMutations=function(){var e;return null!=(e=this.observer)?e.disconnect():void 0},e.prototype.cleanValue=function(e){var t;return"string"==typeof e&&(e=(e=(e=e.replace(null!=(t=this.format.radix)?t:".","<radix>")).replace(/[.,]/g,"")).replace("<radix>","."),e=parseFloat(e,10)||0),m(e,this.format.precision)},e.prototype.bindTransitionEnd=function(){var e,t,n,r,o,a,s=this;if(!this.transitionEndBound){for(this.transitionEndBound=!0,t=!1,a=[],n=0,r=(o="transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd".split(" ")).length;n<r;n++)e=o[n],a.push(this.el.addEventListener(e,function(){return!!t||(t=!0,setTimeout(function(){return s.render(),t=!1,h(s.el,"odometerdone")},0),!0)},!1));return a}},e.prototype.resetFormat=function(){var e,t,r,o,a,s,i,l;if((e=null!=(i=this.options.format)?i:"(,ddd).dd")||(e="d"),!(r=n.exec(e)))throw new Error("Odometer: Unparsable digit format");return s=(l=r.slice(1,4))[0],a=l[1],o=(null!=(t=l[2])?t.length:void 0)||0,this.format={repeating:s,radix:a,precision:o}},e.prototype.render=function(e){var t,n,r,o,a,s,l,c,d,p,f,m;for(null==e&&(e=this.value),this.stopWatchingMutations(),this.resetFormat(),this.inside.innerHTML="",s=this.options.theme,a=[],c=0,p=(t=this.el.className.split(" ")).length;c<p;c++)(n=t[c]).length&&((o=/^odometer-theme-(.+)$/.exec(n))?s=o[1]:/^odometer(-|$)/.test(n)||a.push(n));for(a.push("odometer"),i||a.push("odometer-no-transitions"),s?a.push("odometer-theme-"+s):a.push("odometer-auto-theme"),this.el.className=a.join(" "),this.ribbons={},this.digits=[],l=!this.format.precision||!u(e)||!1,d=0,f=(m=e.toString().split("").reverse()).length;d<f;d++)"."===(r=m[d])&&(l=!0),this.addDigit(r,l);return this.startWatchingMutations()},e.prototype.update=function(e){var t,n=this;if(t=(e=this.cleanValue(e))-this.value)return p(this.el,"odometer-animating-up odometer-animating-down odometer-animating"),l(this.el,t>0?"odometer-animating-up":"odometer-animating-down"),this.stopWatchingMutations(),this.animate(e),this.startWatchingMutations(),setTimeout(function(){return n.el.offsetHeight,l(n.el,"odometer-animating")},0),this.value=e},e.prototype.renderDigit=function(){return c('<span class="odometer-digit"><span class="odometer-digit-spacer">8</span><span class="odometer-digit-inner"><span class="odometer-ribbon"><span class="odometer-ribbon-inner"><span class="odometer-value"></span></span></span></span></span>')},e.prototype.insertDigit=function(e,t){return null!=t?this.inside.insertBefore(e,t):this.inside.children.length?this.inside.insertBefore(e,this.inside.children[0]):this.inside.appendChild(e)},e.prototype.addSpacer=function(e,t,n){var r;return(r=c('<span class="odometer-formatting-mark"></span>')).innerHTML=e,n&&l(r,n),this.insertDigit(r,t)},e.prototype.addDigit=function(e,t){var n,r,o,a;if(null==t&&(t=!0),"-"===e)return this.addSpacer(e,null,"odometer-negation-mark");if("."===e)return this.addSpacer(null!=(a=this.format.radix)?a:".",null,"odometer-radix-mark");if(t)for(o=!1;;){if(!this.format.repeating.length){if(o)throw new Error("Bad odometer format without digits");this.resetFormat(),o=!0}if(n=this.format.repeating[this.format.repeating.length-1],this.format.repeating=this.format.repeating.substring(0,this.format.repeating.length-1),"d"===n)break;this.addSpacer(n)}return(r=this.renderDigit()).querySelector(".odometer-value").innerHTML=e,this.digits.push(r),this.insertDigit(r)},e.prototype.animate=function(e){return i&&"count"!==this.options.animation?this.animateSlide(e):this.animateCount(e)},e.prototype.animateCount=function(e){var t,n,r,o,a,s=this;if(n=+e-this.value)return o=r=d(),t=this.value,(a=function(){var i,l;return d()-o>s.options.duration?(s.value=e,s.render(),void h(s.el,"odometerdone")):((i=d()-r)>50&&(r=d(),l=i/s.options.duration,t+=n*l,s.render(Math.round(t))),null!=f?f(a):setTimeout(a,50))})()},e.prototype.getDigitCount=function(){var e,t,n,r,o,a;for(e=o=0,a=(r=1<=arguments.length?w.call(arguments,0):[]).length;o<a;e=++o)n=r[e],r[e]=Math.abs(n);return t=Math.max.apply(Math,r),Math.ceil(Math.log(t+1)/Math.log(10))},e.prototype.getFractionalDigitCount=function(){var e,t,n,r,o,a,s;for(t=/^\-?\d*\.(\d*?)0*$/,e=a=0,s=(o=1<=arguments.length?w.call(arguments,0):[]).length;a<s;e=++a)r=o[e],o[e]=r.toString(),n=t.exec(o[e]),o[e]=null==n?0:n[1].length;return Math.max.apply(Math,o)},e.prototype.resetDigits=function(){return this.digits=[],this.ribbons=[],this.inside.innerHTML="",this.resetFormat()},e.prototype.animateSlide=function(e){var t,n,r,o,a,s,i,c,u,d,p,f,m,g,h,y,b,_,S,L,w,x,k,C,T,M,E;if(y=this.value,(c=this.getFractionalDigitCount(y,e))&&(e*=Math.pow(10,c),y*=Math.pow(10,c)),r=e-y){for(this.bindTransitionEnd(),o=this.getDigitCount(y,e),a=[],t=0,p=S=0;0<=o?S<o:S>o;p=0<=o?++S:--S){if(b=v(y/Math.pow(10,o-p-1)),s=(i=v(e/Math.pow(10,o-p-1)))-b,Math.abs(s)>this.MAX_VALUES){for(d=[],f=s/(this.MAX_VALUES+this.MAX_VALUES*t*.5),n=b;s>0&&n<i||s<0&&n>i;)d.push(Math.round(n)),n+=f;d[d.length-1]!==i&&d.push(i),t++}else d=function(){E=[];for(var e=b;b<=i?e<=i:e>=i;b<=i?e++:e--)E.push(e);return E}.apply(this);for(p=L=0,x=d.length;L<x;p=++L)u=d[p],d[p]=Math.abs(u%10);a.push(d)}for(this.resetDigits(),p=w=0,k=(M=a.reverse()).length;w<k;p=++w)for(d=M[p],this.digits[p]||this.addDigit(" ",p>=c),null==(_=this.ribbons)[p]&&(_[p]=this.digits[p].querySelector(".odometer-ribbon-inner")),this.ribbons[p].innerHTML="",r<0&&(d=d.reverse()),m=T=0,C=d.length;T<C;m=++T)u=d[m],(h=document.createElement("div")).className="odometer-value",h.innerHTML=u,this.ribbons[p].appendChild(h),m===d.length-1&&l(h,"odometer-last-value"),0===m&&l(h,"odometer-first-value");return b<0&&this.addDigit("-"),null!=(g=this.inside.querySelector(".odometer-radix-mark"))&&g.parent.removeChild(g),c?this.addSpacer(this.format.radix,this.digits[c-1],"odometer-radix-mark"):void 0}},e}()).options=null!=(S=window.odometerOptions)?S:{},setTimeout(function(){var e,t,n,r,o;if(window.odometerOptions){for(e in o=[],r=window.odometerOptions)t=r[e],o.push(null!=(n=s.options)[e]?(n=s.options)[e]:n[e]=t);return o}},0),s.init=function(){var e,t,n,r,o,a;if(null!=document.querySelectorAll){for(a=[],n=0,r=(t=document.querySelectorAll(s.options.selector||".odometer")).length;n<r;n++)e=t[n],a.push(e.odometer=new s({el:e,value:null!=(o=e.innerText)?o:e.textContent}));return a}},null!=(null!=(L=document.documentElement)?L.doScroll:void 0)&&null!=document.createEventObject?(_=document.onreadystatechange,document.onreadystatechange=function(){return"complete"===document.readyState&&!1!==s.options.auto&&s.init(),null!=_?_.apply(this,arguments):void 0}):document.addEventListener("DOMContentLoaded",function(){if(!1!==s.options.auto)return s.init()},!1),e.exports=s}).call(this)},function(e,t,n){"use strict";var r=function(e,t,n){if(e&&t&&n){var r={carecalculator:t,el:e,careCalcStep:document.querySelector(".care-calculator__step"),btnNext:e.querySelector(".steps-nav__next"),fieldsetDate:e.querySelector(".care-calculator__fieldset-date"),priorDate:e.querySelector("#priorDate"),currentDate:e.querySelector("#currentDate"),fieldsetReading:e.querySelector(".care-calculator__fieldset-reading"),priorReading:e.querySelector("#priorReading"),currentReading:e.querySelector("#currentReading"),heatingSelect:e.querySelector(".care-calculator__fieldset-heating"),countySelect:e.querySelector(".care-calculator__fieldset-county"),heatingSelectOption:e.querySelector(".care-calculator__fieldset-heating .field__native"),countySelectOption:e.querySelector(".care-calculator__fieldset-county .field__native"),eligibilityRadios:e.querySelectorAll('input[name="eligibility-radios"]'),calendarDifference:e.querySelector("#calendarDifference"),dateDiffCalc:e.querySelector(".care-calculator__fieldset-date"),kwhDiff:e.querySelector("#kwhDiff")},o={isValid:!1},a=function(){if(n.priorReading<0||n.priorReading>999999||n.currentReading<0||n.currentReading>999999)return!1;if(!n.priorReading>-1&&n.currentReading&&n.priorReading>=n.currentReading)return!1;if(n.priorDate&&n.currentDate){if(n.priorDate>n.currentDate)return!1;if(l()>60)return!1}return!!(n.county&&n.heatingSource&&n.currentReading&&n.priorDate&&n.currentDate&&n.eligibility)},s=function(){o.isValid=a(),r.btnNext.disabled=!o.isValid},i=function(){o.isValid&&r.carecalculator.methods.nextStep()},l=function(){var e=6e4*n.priorDate.getTimezoneOffset(),t=Date.parse(n.priorDate)+e;return(Date.parse(n.currentDate)+e-t)/864e5},c=function(){n.priorDate>=n.currentDate?(r.calendarDifference.innerHTML='\n      <div class="field__error-message--error">\n        <span class="field__error-message-inner">Current meter read date should be after Prior meter read date.</span>\n      </div>\n    ',r.priorDate.parentElement.classList.add("field__error--from-container"),r.currentDate.parentElement.classList.add("field__error--from-container")):Math.round(Number(l()))>60?r.calendarDifference.innerHTML='\n        <div class="field__error-message--error">\n          <span class="field__error-message-inner">Meter reading dates cannot be more than 60 days apart.</span>\n        </div>\n      ':n.priorDate&&n.currentDate&&Math.round(Number(l()))>0&&(r.calendarDifference.innerHTML=Math.ceil(Number(l())),r.priorDate.parentElement.classList.remove("field__error--from-container"),r.currentDate.parentElement.classList.remove("field__error--from-container"))},u=function(){var e=n.priorReading,t=n.currentReading,o=Math.round(t-e);n.priorReading<0||n.priorReading>999999||n.currentReading<0||n.currentReading>999999?r.kwhDiff.innerHTML='\n        <div class="field__error-message--error">\n          <span class="field__error-message-inner">Please enter a valid number between 0 and 999999.</span>\n        </div>\n      ':n.priorReading>=n.currentReading?r.kwhDiff.innerHTML='\n        <div class="field__error-message--error">\n          <span class="field__error-message-inner">Current meter reading should be greater than Prior meter reading.</span>\n        </div>\n      ':n.currentReading>n.priorReading&&(r.kwhDiff.innerHTML=o)},d=function(e){var t=e.target.value;n.eligibility=t,s()},p=function(){s()};!function(){r.el.methods={reInitStep:p},r.el.addEventListener("submit",function(e){e.preventDefault(),i()}),r.btnNext.addEventListener("click",function(e){e.preventDefault(),i()});for(var e=r.eligibilityRadios.length;e--;)r.eligibilityRadios[e].addEventListener("change",d);r.countySelect.addEventListener("change",function(){var e,t=r.countySelectOption.options[r.countySelectOption.selectedIndex];t&&t.value,e=r.countySelectOption.value,n.county=e,s()}),r.heatingSelect.addEventListener("change",function(){var e,t=r.heatingSelectOption.options[r.heatingSelectOption.selectedIndex];t&&t.value,e=r.heatingSelectOption.value,n.heatingSource=e,s()}),r.priorReading.addEventListener("change",function(){n.priorReading=parseInt(r.priorReading.value,10),s(),u()}),r.currentReading.addEventListener("change",function(){n.currentReading=parseInt(r.currentReading.value,10),s(),u()}),r.currentDate.addEventListener("change",function(){n.currentDate=new Date(r.currentDate.value),s(),a(),c()}),r.priorDate.addEventListener("change",function(){n.priorDate=new Date(r.priorDate.value),s(),a(),c()});var t=new Date,o="0".concat(t.getDate()).slice(-2),l="0".concat(t.getMonth()+1).slice(-2),f=t.getFullYear();r.priorDate.setAttribute("min","".concat(f-5,"-").concat(l,"-").concat(o)),r.priorDate.setAttribute("max","".concat(f,"-").concat(l,"-").concat(o)),r.currentDate.setAttribute("min","".concat(f-5,"-").concat(l,"-").concat(o)),r.currentDate.setAttribute("max","".concat(f,"-").concat(l,"-").concat(o))}()}},o=n(32);t.a=function(e){if(e){var t={el:e,steps:e.querySelectorAll(".care-calculator__step")},n={activeSteps:{},currentStep:1,stepsData:{}},a=function(e){switch(e){case 1:default:new r(t.steps[0],t.el,n.stepsData),n.activeSteps.step1=t.steps[0];break;case 2:new o.a(t.steps[1],t.el,n.stepsData),n.activeSteps.step2=t.steps[1]}},s=function(e){for(var n=0;n<t.steps.length;n++)t.steps[n].classList.remove("care-calculator__step--active");t.steps[e-1].classList.add("care-calculator__step--active")},i=function(){n.currentStep++;var e=n.activeSteps["step".concat(n.currentStep)];e?n.currentStep>1&&e.methods.reInitStep():a(n.currentStep),s(n.currentStep)},l=function(){n.currentStep--;var e=n.activeSteps["step".concat(n.currentStep)];e?n.currentStep>1&&e.methods.reInitStep():a(n.currentStep),s(n.currentStep)};n.totalSteps=t.steps.length,t.el.methods={nextStep:i,previousStep:l},t.el.states=n,a(1)}}},function(e,t,n){"use strict";var r=n(17),o=function(e,t,n){if(e&&t&&n){var r={calculator:t,el:e,btnNext:e.querySelector(".steps-nav__next"),btnBack:e.querySelector(".steps-nav__back"),lineTypeRadios:e.querySelectorAll('input[name="ec-line-type"]'),hvLinesRadios:e.querySelectorAll('input[name="ec-hv-extension"]'),radioLabels:e.querySelectorAll(".input-radio .field__label"),popin:e.querySelector(".extension-calculator__popin")},o={isValid:!1,popinNeeded:!1},a=function(){return n.distance>=200&&"A3/B3"===n.lineType},s=function(){o.isValid=!(!n.lineType||a()&&!n.hvLines),r.btnNext.disabled=!o.isValid},i=function(){var e=r.calculator;o.isValid&&r.calculator.methods.nextStep(),e.scrollIntoView({block:"center"})},l=function(){if(o.popinNeeded)r.popin.classList.add("extension-calculator__popin--active");else{r.popin.classList.remove("extension-calculator__popin--active"),delete n.hvLines;for(var e=0;e<r.hvLinesRadios.length;e++)r.hvLinesRadios[e].checked=!1}},c=function(e){var t=e.target.value;n.lineType=t,o.popinNeeded=a(),l(),s()},u=function(e){n.hvLines=e.target.value,s()},d=function(e){if(13===e.keyCode){var t,i=e.target.htmlFor;if(void 0!==i&&(t=r.el.querySelector("#"+i)),void 0!==t){var c=t.value;"ec-line-type"===t.name?(n.lineType=c,o.popinNeeded=a(),l()):n.hvLines=c,t.checked=!0,s(),e.preventDefault()}}},p=function(){o.popinNeeded=a(),l(),s()};!function(){r.el.methods={reInitStep:p},r.el.addEventListener("submit",function(e){e.preventDefault(),i()}),r.btnNext.addEventListener("click",function(e){e.preventDefault(),i()}),r.btnBack.addEventListener("click",function(e){e.preventDefault(),r.calculator.methods.previousStep(),r.calculator.scrollIntoView({block:"start"})});for(var e=0;e<r.lineTypeRadios.length;e++)r.lineTypeRadios[e].addEventListener("change",c);for(var t=0;t<r.hvLinesRadios.length;t++)r.hvLinesRadios[t].addEventListener("change",u);for(var n=0;n<r.radioLabels.length;n++)r.radioLabels[n].addEventListener("keydown",function(e){d(e)})}()}},a=n(18);t.a=function(e){if(e){var t,n={el:e,progress:e.querySelector(".progress"),progressBar:e.querySelector(".progress__bar"),progressHeading:e.querySelector(".progress__heading"),steps:e.querySelectorAll(".extension-calculator__step")},s={variablesEndpoint:e.getAttribute("data-variables-endpoint")||null},i={activeSteps:{},currentStep:1,stepsData:{}},l=function(e){switch(e){case 1:default:new r.a(n.steps[0],n.el,i.stepsData),i.activeSteps.step1=n.steps[0];break;case 2:new o(n.steps[1],n.el,i.stepsData),i.activeSteps.step2=n.steps[1];break;case 3:new a.a(n.steps[2],n.el,i.stepsData,s.variables),i.activeSteps.step3=n.steps[2]}},c=function(e){for(var t=0;t<n.steps.length;t++)n.steps[t].classList.remove("extension-calculator__step--active");n.steps[e-1].classList.add("extension-calculator__step--active"),function(e){var t=n.steps[e-1].getAttribute("data-step-title")||"Step ".concat(e),r=Math.floor(e/i.totalSteps*100);n.progressHeading.textContent=t,n.progress.setAttribute("aria-valuenow",e),n.progressBar.className="progress__bar progress__bar--".concat(r)}(e)},u=function(){i.currentStep++;var e=i.activeSteps["step".concat(i.currentStep)];e?i.currentStep>1&&e.methods.reInitStep():l(i.currentStep),c(i.currentStep)},d=function(){i.currentStep--;var e=i.activeSteps["step".concat(i.currentStep)];e?i.currentStep>1&&e.methods.reInitStep():l(i.currentStep),c(i.currentStep)};(t=new XMLHttpRequest).onreadystatechange=function(){4==t.readyState&&200==t.status&&(s.variables=JSON.parse(t.responseText),n.el.classList.add("extension-calculator--loaded"),i.totalSteps=n.steps.length,n.el.methods={nextStep:u,previousStep:d},n.el.states=i,l(1))},t.open("get",s.variablesEndpoint,!0),t.send()}}},function(e,t,n){"use strict";
/*!
 * perfect-scrollbar v1.4.0
 * (c) 2018 Hyunje Jun
 * @license MIT
 */function r(e){return getComputedStyle(e)}function o(e,t){for(var n in t){var r=t[n];"number"==typeof r&&(r+="px"),e.style[n]=r}return e}function a(e){var t=document.createElement("div");return t.className=e,t}var s="undefined"!=typeof Element&&(Element.prototype.matches||Element.prototype.webkitMatchesSelector||Element.prototype.mozMatchesSelector||Element.prototype.msMatchesSelector);function i(e,t){if(!s)throw new Error("No element matching method supported");return s.call(e,t)}function l(e){e.remove?e.remove():e.parentNode&&e.parentNode.removeChild(e)}function c(e,t){return Array.prototype.filter.call(e.children,function(e){return i(e,t)})}var u={main:"ps",element:{thumb:function(e){return"ps__thumb-"+e},rail:function(e){return"ps__rail-"+e},consuming:"ps__child--consume"},state:{focus:"ps--focus",clicking:"ps--clicking",active:function(e){return"ps--active-"+e},scrolling:function(e){return"ps--scrolling-"+e}}},d={x:null,y:null};function p(e,t){var n=e.element.classList,r=u.state.scrolling(t);n.contains(r)?clearTimeout(d[t]):n.add(r)}function f(e,t){d[t]=setTimeout(function(){return e.isAlive&&e.element.classList.remove(u.state.scrolling(t))},e.settings.scrollingThreshold)}var m=function(e){this.element=e,this.handlers={}},g={isEmpty:{configurable:!0}};m.prototype.bind=function(e,t){void 0===this.handlers[e]&&(this.handlers[e]=[]),this.handlers[e].push(t),this.element.addEventListener(e,t,!1)},m.prototype.unbind=function(e,t){var n=this;this.handlers[e]=this.handlers[e].filter(function(r){return!(!t||r===t)||(n.element.removeEventListener(e,r,!1),!1)})},m.prototype.unbindAll=function(){for(var e in this.handlers)this.unbind(e)},g.isEmpty.get=function(){var e=this;return Object.keys(this.handlers).every(function(t){return 0===e.handlers[t].length})},Object.defineProperties(m.prototype,g);var h=function(){this.eventElements=[]};function v(e){if("function"==typeof window.CustomEvent)return new CustomEvent(e);var t=document.createEvent("CustomEvent");return t.initCustomEvent(e,!1,!1,void 0),t}h.prototype.eventElement=function(e){var t=this.eventElements.filter(function(t){return t.element===e})[0];return t||(t=new m(e),this.eventElements.push(t)),t},h.prototype.bind=function(e,t,n){this.eventElement(e).bind(t,n)},h.prototype.unbind=function(e,t,n){var r=this.eventElement(e);r.unbind(t,n),r.isEmpty&&this.eventElements.splice(this.eventElements.indexOf(r),1)},h.prototype.unbindAll=function(){this.eventElements.forEach(function(e){return e.unbindAll()}),this.eventElements=[]},h.prototype.once=function(e,t,n){var r=this.eventElement(e),o=function(e){r.unbind(t,o),n(e)};r.bind(t,o)};var y=function(e,t,n,r,o){var a;if(void 0===r&&(r=!0),void 0===o&&(o=!1),"top"===t)a=["contentHeight","containerHeight","scrollTop","y","up","down"];else{if("left"!==t)throw new Error("A proper axis should be provided");a=["contentWidth","containerWidth","scrollLeft","x","left","right"]}!function(e,t,n,r,o){var a=n[0],s=n[1],i=n[2],l=n[3],c=n[4],u=n[5];void 0===r&&(r=!0);void 0===o&&(o=!1);var d=e.element;e.reach[l]=null,d[i]<1&&(e.reach[l]="start");d[i]>e[a]-e[s]-1&&(e.reach[l]="end");t&&(d.dispatchEvent(v("ps-scroll-"+l)),t<0?d.dispatchEvent(v("ps-scroll-"+c)):t>0&&d.dispatchEvent(v("ps-scroll-"+u)),r&&function(e,t){p(e,t),f(e,t)}(e,l));e.reach[l]&&(t||o)&&d.dispatchEvent(v("ps-"+l+"-reach-"+e.reach[l]))}(e,n,a,r,o)};function b(e){return parseInt(e,10)||0}var _={isWebKit:"undefined"!=typeof document&&"WebkitAppearance"in document.documentElement.style,supportsTouch:"undefined"!=typeof window&&("ontouchstart"in window||window.DocumentTouch&&document instanceof window.DocumentTouch),supportsIePointer:"undefined"!=typeof navigator&&navigator.msMaxTouchPoints,isChrome:"undefined"!=typeof navigator&&/Chrome/i.test(navigator&&navigator.userAgent)},S=function(e){var t=e.element,n=Math.floor(t.scrollTop);e.containerWidth=t.clientWidth,e.containerHeight=t.clientHeight,e.contentWidth=t.scrollWidth,e.contentHeight=t.scrollHeight,t.contains(e.scrollbarXRail)||(c(t,u.element.rail("x")).forEach(function(e){return l(e)}),t.appendChild(e.scrollbarXRail)),t.contains(e.scrollbarYRail)||(c(t,u.element.rail("y")).forEach(function(e){return l(e)}),t.appendChild(e.scrollbarYRail)),!e.settings.suppressScrollX&&e.containerWidth+e.settings.scrollXMarginOffset<e.contentWidth?(e.scrollbarXActive=!0,e.railXWidth=e.containerWidth-e.railXMarginWidth,e.railXRatio=e.containerWidth/e.railXWidth,e.scrollbarXWidth=L(e,b(e.railXWidth*e.containerWidth/e.contentWidth)),e.scrollbarXLeft=b((e.negativeScrollAdjustment+t.scrollLeft)*(e.railXWidth-e.scrollbarXWidth)/(e.contentWidth-e.containerWidth))):e.scrollbarXActive=!1,!e.settings.suppressScrollY&&e.containerHeight+e.settings.scrollYMarginOffset<e.contentHeight?(e.scrollbarYActive=!0,e.railYHeight=e.containerHeight-e.railYMarginHeight,e.railYRatio=e.containerHeight/e.railYHeight,e.scrollbarYHeight=L(e,b(e.railYHeight*e.containerHeight/e.contentHeight)),e.scrollbarYTop=b(n*(e.railYHeight-e.scrollbarYHeight)/(e.contentHeight-e.containerHeight))):e.scrollbarYActive=!1,e.scrollbarXLeft>=e.railXWidth-e.scrollbarXWidth&&(e.scrollbarXLeft=e.railXWidth-e.scrollbarXWidth),e.scrollbarYTop>=e.railYHeight-e.scrollbarYHeight&&(e.scrollbarYTop=e.railYHeight-e.scrollbarYHeight),function(e,t){var n={width:t.railXWidth},r=Math.floor(e.scrollTop);t.isRtl?n.left=t.negativeScrollAdjustment+e.scrollLeft+t.containerWidth-t.contentWidth:n.left=e.scrollLeft;t.isScrollbarXUsingBottom?n.bottom=t.scrollbarXBottom-r:n.top=t.scrollbarXTop+r;o(t.scrollbarXRail,n);var a={top:r,height:t.railYHeight};t.isScrollbarYUsingRight?t.isRtl?a.right=t.contentWidth-(t.negativeScrollAdjustment+e.scrollLeft)-t.scrollbarYRight-t.scrollbarYOuterWidth:a.right=t.scrollbarYRight-e.scrollLeft:t.isRtl?a.left=t.negativeScrollAdjustment+e.scrollLeft+2*t.containerWidth-t.contentWidth-t.scrollbarYLeft-t.scrollbarYOuterWidth:a.left=t.scrollbarYLeft+e.scrollLeft;o(t.scrollbarYRail,a),o(t.scrollbarX,{left:t.scrollbarXLeft,width:t.scrollbarXWidth-t.railBorderXWidth}),o(t.scrollbarY,{top:t.scrollbarYTop,height:t.scrollbarYHeight-t.railBorderYWidth})}(t,e),e.scrollbarXActive?t.classList.add(u.state.active("x")):(t.classList.remove(u.state.active("x")),e.scrollbarXWidth=0,e.scrollbarXLeft=0,t.scrollLeft=0),e.scrollbarYActive?t.classList.add(u.state.active("y")):(t.classList.remove(u.state.active("y")),e.scrollbarYHeight=0,e.scrollbarYTop=0,t.scrollTop=0)};function L(e,t){return e.settings.minScrollbarLength&&(t=Math.max(t,e.settings.minScrollbarLength)),e.settings.maxScrollbarLength&&(t=Math.min(t,e.settings.maxScrollbarLength)),t}function w(e,t){var n=t[0],r=t[1],o=t[2],a=t[3],s=t[4],i=t[5],l=t[6],c=t[7],d=t[8],m=e.element,g=null,h=null,v=null;function y(t){m[l]=g+v*(t[o]-h),p(e,c),S(e),t.stopPropagation(),t.preventDefault()}function b(){f(e,c),e[d].classList.remove(u.state.clicking),e.event.unbind(e.ownerDocument,"mousemove",y)}e.event.bind(e[s],"mousedown",function(t){g=m[l],h=t[o],v=(e[r]-e[n])/(e[a]-e[i]),e.event.bind(e.ownerDocument,"mousemove",y),e.event.once(e.ownerDocument,"mouseup",b),e[d].classList.add(u.state.clicking),t.stopPropagation(),t.preventDefault()})}var x={"click-rail":function(e){e.event.bind(e.scrollbarY,"mousedown",function(e){return e.stopPropagation()}),e.event.bind(e.scrollbarYRail,"mousedown",function(t){var n=t.pageY-window.pageYOffset-e.scrollbarYRail.getBoundingClientRect().top>e.scrollbarYTop?1:-1;e.element.scrollTop+=n*e.containerHeight,S(e),t.stopPropagation()}),e.event.bind(e.scrollbarX,"mousedown",function(e){return e.stopPropagation()}),e.event.bind(e.scrollbarXRail,"mousedown",function(t){var n=t.pageX-window.pageXOffset-e.scrollbarXRail.getBoundingClientRect().left>e.scrollbarXLeft?1:-1;e.element.scrollLeft+=n*e.containerWidth,S(e),t.stopPropagation()})},"drag-thumb":function(e){w(e,["containerWidth","contentWidth","pageX","railXWidth","scrollbarX","scrollbarXWidth","scrollLeft","x","scrollbarXRail"]),w(e,["containerHeight","contentHeight","pageY","railYHeight","scrollbarY","scrollbarYHeight","scrollTop","y","scrollbarYRail"])},keyboard:function(e){var t=e.element;e.event.bind(e.ownerDocument,"keydown",function(n){if(!(n.isDefaultPrevented&&n.isDefaultPrevented()||n.defaultPrevented)&&(i(t,":hover")||i(e.scrollbarX,":focus")||i(e.scrollbarY,":focus"))){var r,o=document.activeElement?document.activeElement:e.ownerDocument.activeElement;if(o){if("IFRAME"===o.tagName)o=o.contentDocument.activeElement;else for(;o.shadowRoot;)o=o.shadowRoot.activeElement;if(i(r=o,"input,[contenteditable]")||i(r,"select,[contenteditable]")||i(r,"textarea,[contenteditable]")||i(r,"button,[contenteditable]"))return}var a=0,s=0;switch(n.which){case 37:a=n.metaKey?-e.contentWidth:n.altKey?-e.containerWidth:-30;break;case 38:s=n.metaKey?e.contentHeight:n.altKey?e.containerHeight:30;break;case 39:a=n.metaKey?e.contentWidth:n.altKey?e.containerWidth:30;break;case 40:s=n.metaKey?-e.contentHeight:n.altKey?-e.containerHeight:-30;break;case 32:s=n.shiftKey?e.containerHeight:-e.containerHeight;break;case 33:s=e.containerHeight;break;case 34:s=-e.containerHeight;break;case 36:s=e.contentHeight;break;case 35:s=-e.contentHeight;break;default:return}e.settings.suppressScrollX&&0!==a||e.settings.suppressScrollY&&0!==s||(t.scrollTop-=s,t.scrollLeft+=a,S(e),function(n,r){var o=Math.floor(t.scrollTop);if(0===n){if(!e.scrollbarYActive)return!1;if(0===o&&r>0||o>=e.contentHeight-e.containerHeight&&r<0)return!e.settings.wheelPropagation}var a=t.scrollLeft;if(0===r){if(!e.scrollbarXActive)return!1;if(0===a&&n<0||a>=e.contentWidth-e.containerWidth&&n>0)return!e.settings.wheelPropagation}return!0}(a,s)&&n.preventDefault())}})},wheel:function(e){var t=e.element;function n(n){var o=function(e){var t=e.deltaX,n=-1*e.deltaY;return void 0!==t&&void 0!==n||(t=-1*e.wheelDeltaX/6,n=e.wheelDeltaY/6),e.deltaMode&&1===e.deltaMode&&(t*=10,n*=10),t!=t&&n!=n&&(t=0,n=e.wheelDelta),e.shiftKey?[-n,-t]:[t,n]}(n),a=o[0],s=o[1];if(!function(e,n,o){if(!_.isWebKit&&t.querySelector("select:focus"))return!0;if(!t.contains(e))return!1;for(var a=e;a&&a!==t;){if(a.classList.contains(u.element.consuming))return!0;var s=r(a);if([s.overflow,s.overflowX,s.overflowY].join("").match(/(scroll|auto)/)){var i=a.scrollHeight-a.clientHeight;if(i>0&&!(0===a.scrollTop&&o>0||a.scrollTop===i&&o<0))return!0;var l=a.scrollWidth-a.clientWidth;if(l>0&&!(0===a.scrollLeft&&n<0||a.scrollLeft===l&&n>0))return!0}a=a.parentNode}return!1}(n.target,a,s)){var i=!1;e.settings.useBothWheelAxes?e.scrollbarYActive&&!e.scrollbarXActive?(s?t.scrollTop-=s*e.settings.wheelSpeed:t.scrollTop+=a*e.settings.wheelSpeed,i=!0):e.scrollbarXActive&&!e.scrollbarYActive&&(a?t.scrollLeft+=a*e.settings.wheelSpeed:t.scrollLeft-=s*e.settings.wheelSpeed,i=!0):(t.scrollTop-=s*e.settings.wheelSpeed,t.scrollLeft+=a*e.settings.wheelSpeed),S(e),(i=i||function(n,r){var o=Math.floor(t.scrollTop),a=0===t.scrollTop,s=o+t.offsetHeight===t.scrollHeight,i=0===t.scrollLeft,l=t.scrollLeft+t.offsetWidth===t.scrollWidth;return!(Math.abs(r)>Math.abs(n)?a||s:i||l)||!e.settings.wheelPropagation}(a,s))&&!n.ctrlKey&&(n.stopPropagation(),n.preventDefault())}}void 0!==window.onwheel?e.event.bind(t,"wheel",n):void 0!==window.onmousewheel&&e.event.bind(t,"mousewheel",n)},touch:function(e){if(_.supportsTouch||_.supportsIePointer){var t=e.element,n={},o=0,a={},s=null;_.supportsTouch?(e.event.bind(t,"touchstart",d),e.event.bind(t,"touchmove",p),e.event.bind(t,"touchend",f)):_.supportsIePointer&&(window.PointerEvent?(e.event.bind(t,"pointerdown",d),e.event.bind(t,"pointermove",p),e.event.bind(t,"pointerup",f)):window.MSPointerEvent&&(e.event.bind(t,"MSPointerDown",d),e.event.bind(t,"MSPointerMove",p),e.event.bind(t,"MSPointerUp",f)))}function i(n,r){t.scrollTop-=r,t.scrollLeft-=n,S(e)}function l(e){return e.targetTouches?e.targetTouches[0]:e}function c(e){return(!e.pointerType||"pen"!==e.pointerType||0!==e.buttons)&&(!(!e.targetTouches||1!==e.targetTouches.length)||!(!e.pointerType||"mouse"===e.pointerType||e.pointerType===e.MSPOINTER_TYPE_MOUSE))}function d(e){if(c(e)){var t=l(e);n.pageX=t.pageX,n.pageY=t.pageY,o=(new Date).getTime(),null!==s&&clearInterval(s)}}function p(s){if(c(s)){var d=l(s),p={pageX:d.pageX,pageY:d.pageY},f=p.pageX-n.pageX,m=p.pageY-n.pageY;if(function(e,n,o){if(!t.contains(e))return!1;for(var a=e;a&&a!==t;){if(a.classList.contains(u.element.consuming))return!0;var s=r(a);if([s.overflow,s.overflowX,s.overflowY].join("").match(/(scroll|auto)/)){var i=a.scrollHeight-a.clientHeight;if(i>0&&!(0===a.scrollTop&&o>0||a.scrollTop===i&&o<0))return!0;var l=a.scrollLeft-a.clientWidth;if(l>0&&!(0===a.scrollLeft&&n<0||a.scrollLeft===l&&n>0))return!0}a=a.parentNode}return!1}(s.target,f,m))return;i(f,m),n=p;var g=(new Date).getTime(),h=g-o;h>0&&(a.x=f/h,a.y=m/h,o=g),function(n,r){var o=Math.floor(t.scrollTop),a=t.scrollLeft,s=Math.abs(n),i=Math.abs(r);if(i>s){if(r<0&&o===e.contentHeight-e.containerHeight||r>0&&0===o)return 0===window.scrollY&&r>0&&_.isChrome}else if(s>i&&(n<0&&a===e.contentWidth-e.containerWidth||n>0&&0===a))return!0;return!0}(f,m)&&s.preventDefault()}}function f(){e.settings.swipeEasing&&(clearInterval(s),s=setInterval(function(){e.isInitialized?clearInterval(s):a.x||a.y?Math.abs(a.x)<.01&&Math.abs(a.y)<.01?clearInterval(s):(i(30*a.x,30*a.y),a.x*=.8,a.y*=.8):clearInterval(s)},10))}}},k=function(e,t){var n=this;if(void 0===t&&(t={}),"string"==typeof e&&(e=document.querySelector(e)),!e||!e.nodeName)throw new Error("no element is specified to initialize PerfectScrollbar");for(var s in this.element=e,e.classList.add(u.main),this.settings={handlers:["click-rail","drag-thumb","keyboard","wheel","touch"],maxScrollbarLength:null,minScrollbarLength:null,scrollingThreshold:1e3,scrollXMarginOffset:0,scrollYMarginOffset:0,suppressScrollX:!1,suppressScrollY:!1,swipeEasing:!0,useBothWheelAxes:!1,wheelPropagation:!0,wheelSpeed:1},t)n.settings[s]=t[s];this.containerWidth=null,this.containerHeight=null,this.contentWidth=null,this.contentHeight=null;var i,l,c=function(){return e.classList.add(u.state.focus)},d=function(){return e.classList.remove(u.state.focus)};this.isRtl="rtl"===r(e).direction,this.isNegativeScroll=(l=e.scrollLeft,e.scrollLeft=-1,i=e.scrollLeft<0,e.scrollLeft=l,i),this.negativeScrollAdjustment=this.isNegativeScroll?e.scrollWidth-e.clientWidth:0,this.event=new h,this.ownerDocument=e.ownerDocument||document,this.scrollbarXRail=a(u.element.rail("x")),e.appendChild(this.scrollbarXRail),this.scrollbarX=a(u.element.thumb("x")),this.scrollbarXRail.appendChild(this.scrollbarX),this.scrollbarX.setAttribute("tabindex",0),this.event.bind(this.scrollbarX,"focus",c),this.event.bind(this.scrollbarX,"blur",d),this.scrollbarXActive=null,this.scrollbarXWidth=null,this.scrollbarXLeft=null;var p=r(this.scrollbarXRail);this.scrollbarXBottom=parseInt(p.bottom,10),isNaN(this.scrollbarXBottom)?(this.isScrollbarXUsingBottom=!1,this.scrollbarXTop=b(p.top)):this.isScrollbarXUsingBottom=!0,this.railBorderXWidth=b(p.borderLeftWidth)+b(p.borderRightWidth),o(this.scrollbarXRail,{display:"block"}),this.railXMarginWidth=b(p.marginLeft)+b(p.marginRight),o(this.scrollbarXRail,{display:""}),this.railXWidth=null,this.railXRatio=null,this.scrollbarYRail=a(u.element.rail("y")),e.appendChild(this.scrollbarYRail),this.scrollbarY=a(u.element.thumb("y")),this.scrollbarYRail.appendChild(this.scrollbarY),this.scrollbarY.setAttribute("tabindex",0),this.event.bind(this.scrollbarY,"focus",c),this.event.bind(this.scrollbarY,"blur",d),this.scrollbarYActive=null,this.scrollbarYHeight=null,this.scrollbarYTop=null;var f=r(this.scrollbarYRail);this.scrollbarYRight=parseInt(f.right,10),isNaN(this.scrollbarYRight)?(this.isScrollbarYUsingRight=!1,this.scrollbarYLeft=b(f.left)):this.isScrollbarYUsingRight=!0,this.scrollbarYOuterWidth=this.isRtl?function(e){var t=r(e);return b(t.width)+b(t.paddingLeft)+b(t.paddingRight)+b(t.borderLeftWidth)+b(t.borderRightWidth)}(this.scrollbarY):null,this.railBorderYWidth=b(f.borderTopWidth)+b(f.borderBottomWidth),o(this.scrollbarYRail,{display:"block"}),this.railYMarginHeight=b(f.marginTop)+b(f.marginBottom),o(this.scrollbarYRail,{display:""}),this.railYHeight=null,this.railYRatio=null,this.reach={x:e.scrollLeft<=0?"start":e.scrollLeft>=this.contentWidth-this.containerWidth?"end":null,y:e.scrollTop<=0?"start":e.scrollTop>=this.contentHeight-this.containerHeight?"end":null},this.isAlive=!0,this.settings.handlers.forEach(function(e){return x[e](n)}),this.lastScrollTop=Math.floor(e.scrollTop),this.lastScrollLeft=e.scrollLeft,this.event.bind(this.element,"scroll",function(e){return n.onScroll(e)}),S(this)};k.prototype.update=function(){this.isAlive&&(this.negativeScrollAdjustment=this.isNegativeScroll?this.element.scrollWidth-this.element.clientWidth:0,o(this.scrollbarXRail,{display:"block"}),o(this.scrollbarYRail,{display:"block"}),this.railXMarginWidth=b(r(this.scrollbarXRail).marginLeft)+b(r(this.scrollbarXRail).marginRight),this.railYMarginHeight=b(r(this.scrollbarYRail).marginTop)+b(r(this.scrollbarYRail).marginBottom),o(this.scrollbarXRail,{display:"none"}),o(this.scrollbarYRail,{display:"none"}),S(this),y(this,"top",0,!1,!0),y(this,"left",0,!1,!0),o(this.scrollbarXRail,{display:""}),o(this.scrollbarYRail,{display:""}))},k.prototype.onScroll=function(e){this.isAlive&&(S(this),y(this,"top",this.element.scrollTop-this.lastScrollTop),y(this,"left",this.element.scrollLeft-this.lastScrollLeft),this.lastScrollTop=Math.floor(this.element.scrollTop),this.lastScrollLeft=this.element.scrollLeft)},k.prototype.destroy=function(){this.isAlive&&(this.event.unbindAll(),l(this.scrollbarX),l(this.scrollbarY),l(this.scrollbarXRail),l(this.scrollbarYRail),this.removePsClasses(),this.element=null,this.scrollbarX=null,this.scrollbarY=null,this.scrollbarXRail=null,this.scrollbarYRail=null,this.isAlive=!1)},k.prototype.removePsClasses=function(){this.element.className=this.element.className.split(" ").filter(function(e){return!e.match(/^ps([-_].+|)$/)}).join(" ")};var C=k;t.a=function(e){var t;t=new C(e),e.perfectScroll=t,t.update(),e.perfectScroll=t}},function(e,t,n){"use strict";n.r(t);var r;n(41),n(52);(r=n(55)).keys().map(r)},function(e,t,n){n(42),n(43),n(44),n(45),n(46),n(47),n(48),n(49),n(50),n(51)},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){"use strict";(function(e){var t=n(39),r=n(5),o=n(6),a=n(7),s=n(8),i=n(9),l=n(10),c=n(11),u=n(12),d=n(13),p=n(14),f=n(15),m=n(1),g=n(16),h=n(38),v=n(20),y=n(23),b=n(24),_=n(25),S=n(26),L=n(28),w=n(29),x=n(30),k=(n(54),n(37)),C=n(33),T=n(34),M=n(35);document.addEventListener("DOMContentLoaded",function(){e.initComponent("Scrollbars",".scrollbars",t.a),e.initComponent("Signin",".signin",C.a),e.initComponent("Alert",".alert",r.a),e.initComponent("Modal",".modal",m.a),e.initComponent("Header",".header",L.a),e.initComponent("TopNav",".top-nav",o.a),e.initComponent("MobileNav",".mobile-nav",a.a),e.initComponent("Expandable",".expandable",s.a),e.initComponent("Input",".input",d.a),e.initComponent("Select",".select",l.a),e.initComponent("Textarea",".textarea",c.a),e.initComponent("Table","table",u.a),e.initComponent("Form",".form",i.a),e.initComponent("ExtensionRadios",".extension-radios",p.a),e.initComponent("InlineModal",".inline-modal",f.a),e.initComponent("Tabs",".tabs",g.a),e.initComponent("StateSelect",".state-select",y.a),e.initComponent("StateModal",".state-modal",T.a),e.initComponent("SiteSearch",".search",b.a),e.initComponent("GridSearch",".grid-results",_.a),e.initComponent("ListSearch",".list-search",S.a),e.initComponent("EnergyUseCalculator",".energy-use-calculator",w.a),e.initComponent("ExtensionCalculator",".extension-calculator",h.a),e.initComponent("SkyCalculator",".sky-calculator",v.a),e.initComponent("OutageMap",".outage-map",x.a),e.initComponent("CareCalculator",".care-calculator",k.a),e.initComponent("Odometer",".odometer",M.a)},!1)}).call(this,n(0))},function(e,t,n){e.exports=function(e){function t(r){if(n[r])return n[r].exports;var o=n[r]={exports:{},id:r,loaded:!1};return e[r].call(o.exports,o,o.exports,t),o.loaded=!0,o.exports}var n={};return t.m=e,t.c=n,t.p="",t(0)}([function(e,t,n){"use strict";n(84);var r=function(e){return e&&e.__esModule?e:{default:e}}(n(41)),o=function(){r.default.addPickerToOtherInputs(),r.default.supportsDateInput()||r.default.addPickerToDateInputs()};o(),document.addEventListener("DOMContentLoaded",function(){o()}),document.querySelector("body").addEventListener("mousedown",function(){o()})},function(e,t,n){e.exports=!n(11)(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a})},function(e,t){var n=e.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=n)},function(e,t){var n={}.hasOwnProperty;e.exports=function(e,t){return n.call(e,t)}},function(e,t,n){var r=n(9),o=n(32),a=n(25),s=Object.defineProperty;t.f=n(1)?Object.defineProperty:function(e,t,n){if(r(e),t=a(t,!0),r(n),o)try{return s(e,t,n)}catch(e){}if("get"in n||"set"in n)throw TypeError("Accessors not supported!");return"value"in n&&(e[t]=n.value),e}},function(e,t,n){var r=n(59),o=n(16);e.exports=function(e){return r(o(e))}},function(e,t,n){var r=n(4),o=n(14);e.exports=n(1)?function(e,t,n){return r.f(e,t,o(1,n))}:function(e,t,n){return e[t]=n,e}},function(e,t,n){var r=n(23)("wks"),o=n(15),a=n(2).Symbol,s="function"==typeof a;(e.exports=function(e){return r[e]||(r[e]=s&&a[e]||(s?a:o)("Symbol."+e))}).store=r},function(e,t){var n=e.exports={version:"2.4.0"};"number"==typeof __e&&(__e=n)},function(e,t,n){var r=n(12);e.exports=function(e){if(!r(e))throw TypeError(e+" is not an object!");return e}},function(e,t,n){var r=n(2),o=n(8),a=n(56),s=n(6),i="prototype",l=function(e,t,n){var c,u,d,p=e&l.F,f=e&l.G,m=e&l.S,g=e&l.P,h=e&l.B,v=e&l.W,y=f?o:o[t]||(o[t]={}),b=y[i],_=f?r:m?r[t]:(r[t]||{})[i];for(c in f&&(n=t),n)(u=!p&&_&&void 0!==_[c])&&c in y||(d=u?_[c]:n[c],y[c]=f&&"function"!=typeof _[c]?n[c]:h&&u?a(d,r):v&&_[c]==d?function(e){var t=function(t,n,r){if(this instanceof e){switch(arguments.length){case 0:return new e;case 1:return new e(t);case 2:return new e(t,n)}return new e(t,n,r)}return e.apply(this,arguments)};return t[i]=e[i],t}(d):g&&"function"==typeof d?a(Function.call,d):d,g&&((y.virtual||(y.virtual={}))[c]=d,e&l.R&&b&&!b[c]&&s(b,c,d)))};l.F=1,l.G=2,l.S=4,l.P=8,l.B=16,l.W=32,l.U=64,l.R=128,e.exports=l},function(e,t){e.exports=function(e){try{return!!e()}catch(e){return!0}}},function(e,t){e.exports=function(e){return"object"==typeof e?null!==e:"function"==typeof e}},function(e,t,n){var r=n(38),o=n(17);e.exports=Object.keys||function(e){return r(e,o)}},function(e,t){e.exports=function(e,t){return{enumerable:!(1&e),configurable:!(2&e),writable:!(4&e),value:t}}},function(e,t){var n=0,r=Math.random();e.exports=function(e){return"Symbol(".concat(void 0===e?"":e,")_",(++n+r).toString(36))}},function(e,t){e.exports=function(e){if(null==e)throw TypeError("Can't call method on  "+e);return e}},function(e,t){e.exports="constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",")},function(e,t){e.exports={}},function(e,t){e.exports=!0},function(e,t){t.f={}.propertyIsEnumerable},function(e,t,n){var r=n(4).f,o=n(3),a=n(7)("toStringTag");e.exports=function(e,t,n){e&&!o(e=n?e:e.prototype,a)&&r(e,a,{configurable:!0,value:t})}},function(e,t,n){var r=n(23)("keys"),o=n(15);e.exports=function(e){return r[e]||(r[e]=o(e))}},function(e,t,n){var r=n(2),o="__core-js_shared__",a=r[o]||(r[o]={});e.exports=function(e){return a[e]||(a[e]={})}},function(e,t){var n=Math.ceil,r=Math.floor;e.exports=function(e){return isNaN(e=+e)?0:(e>0?r:n)(e)}},function(e,t,n){var r=n(12);e.exports=function(e,t){if(!r(e))return e;var n,o;if(t&&"function"==typeof(n=e.toString)&&!r(o=n.call(e)))return o;if("function"==typeof(n=e.valueOf)&&!r(o=n.call(e)))return o;if(!t&&"function"==typeof(n=e.toString)&&!r(o=n.call(e)))return o;throw TypeError("Can't convert object to primitive value")}},function(e,t,n){var r=n(2),o=n(8),a=n(19),s=n(27),i=n(4).f;e.exports=function(e){var t=o.Symbol||(o.Symbol=a?{}:r.Symbol||{});"_"==e.charAt(0)||e in t||i(t,e,{value:s.f(e)})}},function(e,t,n){t.f=n(7)},function(e,t){"use strict";t.__esModule=!0,t.default=function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}},function(e,t,n){"use strict";t.__esModule=!0;var r=function(e){return e&&e.__esModule?e:{default:e}}(n(45));t.default=function(){function e(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),(0,r.default)(e,o.key,o)}}return function(t,n,r){return n&&e(t.prototype,n),r&&e(t,r),t}}()},function(e,t){var n={}.toString;e.exports=function(e){return n.call(e).slice(8,-1)}},function(e,t,n){var r=n(12),o=n(2).document,a=r(o)&&r(o.createElement);e.exports=function(e){return a?o.createElement(e):{}}},function(e,t,n){e.exports=!n(1)&&!n(11)(function(){return 7!=Object.defineProperty(n(31)("div"),"a",{get:function(){return 7}}).a})},function(e,t,n){"use strict";var r=n(19),o=n(10),a=n(39),s=n(6),i=n(3),l=n(18),c=n(61),u=n(21),d=n(67),p=n(7)("iterator"),f=!([].keys&&"next"in[].keys()),m="keys",g="values",h=function(){return this};e.exports=function(e,t,n,v,y,b,_){c(n,t,v);var S,L,w,x=function(e){if(!f&&e in M)return M[e];switch(e){case m:case g:return function(){return new n(this,e)}}return function(){return new n(this,e)}},k=t+" Iterator",C=y==g,T=!1,M=e.prototype,E=M[p]||M["@@iterator"]||y&&M[y],A=E||x(y),D=y?C?x("entries"):A:void 0,q="Array"==t&&M.entries||E;if(q&&(w=d(q.call(new e)))!==Object.prototype&&(u(w,k,!0),r||i(w,p)||s(w,p,h)),C&&E&&E.name!==g&&(T=!0,A=function(){return E.call(this)}),r&&!_||!f&&!T&&M[p]||s(M,p,A),l[t]=A,l[k]=h,y)if(S={values:C?A:x(g),keys:b?A:x(m),entries:D},_)for(L in S)L in M||a(M,L,S[L]);else o(o.P+o.F*(f||T),t,S);return S}},function(e,t,n){var r=n(9),o=n(35),a=n(17),s=n(22)("IE_PROTO"),i=function(){},l="prototype",c=function(){var e,t=n(31)("iframe"),r=a.length;for(t.style.display="none",n(58).appendChild(t),t.src="javascript:",(e=t.contentWindow.document).open(),e.write("<script>document.F=Object<\/script>"),e.close(),c=e.F;r--;)delete c[l][a[r]];return c()};e.exports=Object.create||function(e,t){var n;return null!==e?(i[l]=r(e),n=new i,i[l]=null,n[s]=e):n=c(),void 0===t?n:o(n,t)}},function(e,t,n){var r=n(4),o=n(9),a=n(13);e.exports=n(1)?Object.defineProperties:function(e,t){o(e);for(var n,s=a(t),i=s.length,l=0;i>l;)r.f(e,n=s[l++],t[n]);return e}},function(e,t,n){var r=n(38),o=n(17).concat("length","prototype");t.f=Object.getOwnPropertyNames||function(e){return r(e,o)}},function(e,t){t.f=Object.getOwnPropertySymbols},function(e,t,n){var r=n(3),o=n(5),a=n(55)(!1),s=n(22)("IE_PROTO");e.exports=function(e,t){var n,i=o(e),l=0,c=[];for(n in i)n!=s&&r(i,n)&&c.push(n);for(;t.length>l;)r(i,n=t[l++])&&(~a(c,n)||c.push(n));return c}},function(e,t,n){e.exports=n(6)},function(e,t,n){"use strict";function r(e,t){for(e=String(e),t=t||2;e.length<t;)e="0"+e;return e}function o(e){var t=new Date(e.getFullYear(),e.getMonth(),e.getDate());t.setDate(t.getDate()-(t.getDay()+6)%7+3);var n=new Date(t.getFullYear(),0,4);n.setDate(n.getDate()-(n.getDay()+6)%7+3);var r=t.getTimezoneOffset()-n.getTimezoneOffset();t.setHours(t.getHours()-r);var o=(t-n)/6048e5;return 1+Math.floor(o)}function a(e){var t=e.getDay();return 0===t&&(t=7),t}function s(e){return null===e?"null":void 0===e?"undefined":"object"!==(void 0===e?"undefined":(0,i.default)(e))?void 0===e?"undefined":(0,i.default)(e):Array.isArray(e)?"array":{}.toString.call(e).slice(8,-1).toLowerCase()}Object.defineProperty(t,"__esModule",{value:!0});var i=function(e){return e&&e.__esModule?e:{default:e}}(n(48)),l=function(){var e=/d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZWN]|'[^']*'|'[^']*'/g,t=/\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,n=/[^-+\dA-Z]/g;return function(i,c,u,d){if(1!==arguments.length||"string"!==s(i)||/\d/.test(i)||(c=i,i=void 0),(i=i||new Date)instanceof Date||(i=new Date(i)),isNaN(i))throw TypeError("Invalid date");var p=(c=String(l.masks[c]||c||l.masks.default)).slice(0,4);"UTC:"!==p&&"GMT:"!==p||(c=c.slice(4),u=!0,"GMT:"===p&&(d=!0));var f=u?"getUTC":"get",m=i[f+"Date"](),g=i[f+"Day"](),h=i[f+"Month"](),v=i[f+"FullYear"](),y=i[f+"Hours"](),b=i[f+"Minutes"](),_=i[f+"Seconds"](),S=i[f+"Milliseconds"](),L=u?0:i.getTimezoneOffset(),w=o(i),x=a(i),k={d:m,dd:r(m),ddd:l.i18n.dayNames[g],dddd:l.i18n.dayNames[g+7],m:h+1,mm:r(h+1),mmm:l.i18n.monthNames[h],mmmm:l.i18n.monthNames[h+12],yy:String(v).slice(2),yyyy:v,h:y%12||12,hh:r(y%12||12),H:y,HH:r(y),M:b,MM:r(b),s:_,ss:r(_),l:r(S,3),L:r(Math.round(S/10)),t:y<12?"a":"p",tt:y<12?"am":"pm",T:y<12?"A":"P",TT:y<12?"AM":"PM",Z:d?"GMT":u?"UTC":(String(i).match(t)||[""]).pop().replace(n,""),o:(L>0?"-":"+")+r(100*Math.floor(Math.abs(L)/60)+Math.abs(L)%60,4),S:["th","st","nd","rd"][m%10>3?0:(m%100-m%10!=10)*m%10],W:w,N:x};return c.replace(e,function(e){return e in k?k[e]:e.slice(1,e.length-1)})}}();l.masks={default:"ddd mmm dd yyyy HH:MM:ss",shortDate:"m/d/yy",mediumDate:"mmm d, yyyy",longDate:"mmmm d, yyyy",fullDate:"dddd, mmmm d, yyyy",shortTime:"h:MM TT",mediumTime:"h:MM:ss TT",longTime:"h:MM:ss TT Z",isoDate:"yyyy-mm-dd",isoTime:"HH:MM:ss",isoDateTime:"yyyy-mm-dd'T'HH:MM:sso",isoUtcDateTime:"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",expiresHeaderFormat:"ddd, dd mmm yyyy HH:MM:ss Z"},l.i18n={dayNames:["Sun","Mon","Tue","Wed","Thu","Fri","Sat","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],monthNames:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","January","February","March","April","May","June","July","August","September","October","November","December"]},t.default=l},function(e,t,n){"use strict";function r(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(t,"__esModule",{value:!0});var o=r(n(44)),a=r(n(28)),s=r(n(29)),i=r(n(43)),l=r(n(42)),c=r(n(40)),u=function(){function e(t){var n=this;(0,a.default)(this,e),this.element=t,this.element.setAttribute("data-has-picker",""),this.locale=this.element.getAttribute("lang")||document.body.getAttribute("lang")||"en",this.format=this.element.getAttribute("date-format")||document.body.getAttribute("date-format")||this.element.getAttribute("data-date-format")||document.body.getAttribute("data-date-format")||"yyyy-mm-dd",this.localeText=this.getLocaleText(),(0,o.default)(this.element,{valueAsDate:{get:function(){if(!n.element.value)return null;var e=n.format||"yyyy-mm-dd",t=n.element.value.match(/(\d+)/g),r=0,o={};return e.replace(/(yyyy|dd|mm)/g,function(e){o[e]=r++}),new Date(t[o.yyyy],t[o.mm]-1,t[o.dd])},set:function(e){n.element.value=(0,c.default)(e,n.format)}},valueAsNumber:{get:function(){return n.element.value?n.element.valueAsDate.valueOf():NaN},set:function(e){n.element.valueAsDate=new Date(e)}}});var r=function(e){var t=n.element;t.locale=n.localeText,i.default.attachTo(t)};this.element.addEventListener("focus",r),this.element.addEventListener("mouseup",r),this.element.addEventListener("keydown",function(e){var t=new Date;switch(e.keyCode){case 9:case 27:i.default.hide();break;case 38:n.element.valueAsDate&&(t.setDate(n.element.valueAsDate.getDate()+1),n.element.valueAsDate=t,i.default.pingInput());break;case 40:n.element.valueAsDate&&(t.setDate(n.element.valueAsDate.getDate()-1),n.element.valueAsDate=t,i.default.pingInput())}i.default.sync()}),this.element.addEventListener("keyup",function(e){i.default.sync()})}return(0,s.default)(e,[{key:"getLocaleText",value:function(){var e=this.locale.toLowerCase();for(var t in l.default){var n=t.split("_");if(n.map(function(e){return e.toLowerCase()}),~n.indexOf(e)||~n.indexOf(e.substr(0,2)))return l.default[t]}}}],[{key:"supportsDateInput",value:function(){var e=document.createElement("input");e.setAttribute("type","date");var t="not-a-date";return e.setAttribute("value",t),!(e.value===t)}},{key:"addPickerToDateInputs",value:function(){var t=document.querySelectorAll('input[type="date"]:not([data-has-picker])'),n=t.length;if(!n)return!1;for(var r=0;r<n;++r)new e(t[r])}},{key:"addPickerToOtherInputs",value:function(){var t=document.querySelectorAll('input[type="text"].date-polyfill:not([data-has-picker])'),n=t.length;if(!n)return!1;for(var r=0;r<n;++r)new e(t[r])}}]),e}();t.default=u},function(e,t){"use strict";Object.defineProperty(t,"__esModule",{value:!0}),t.default={"en_en-US_en-UK":{days:["Su","Mo","Tu","We","Th","Fr","Sa"],months:["January","February","March","April","May","June","July","August","September","October","November","December"]},"zh_zh-CN":{days:["星期天","星期一","星期二","星期三","星期四","星期五","星期六"],months:["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]},"zh-Hans_zh-Hans-CN":{days:["周日","周一","周二","周三","周四","周五","周六"],months:["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]},"zh-Hant_zh-Hant-TW":{days:["週日","週一","週二","週三","週四","週五","週六"],months:["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]},"de_de-DE":{days:["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"],months:["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]},"nl_nl-NL_nl-BE":{days:["Zondag","Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag"],months:["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"],today:"Vandaag",format:"D/M/Y"},"pt_pt-BR":{days:["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],months:["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],today:"Hoje"},"fr_fr-FR_fr-BE":{days:["Di","Lu","Ma","Me","Je","Ve","Sa"],months:["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],today:"Aujourd'hui",format:"D/M/Y"},"es_es-VE":{days:["Do","Lu","Ma","Mi","Ju","Vi","Sa"],months:["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],today:"Hoy",format:"D/M/Y"},"da_da-dk":{days:["Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag"],months:["Januar","Februar","Marts","April","Maj","Juni","Juli","August","September","Oktober","November","December"],today:"I dag",format:"dd/MM-YYYY"},"ru_ru-RU_ru-UA_ru-KZ_ru-MD":{days:["Вс","Пн","Вт","Ср","Чт","Пт","Сб"],months:["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],today:"Сегодня",format:"D.M.Y"},"uk_uk-UA":{days:["Нд","Пн","Вт","Ср","Чт","Пт","Сб"],months:["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"],today:"Cьогодні",format:"D.M.Y"},"sv_sv-SE":{days:["Söndag","Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag"],months:["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"],today:"Idag",format:"YYYY-MM-dd"},"test_test-TEST":{days:["Foo","Mon","Tue","Wed","Thu","Fri","Sat"],months:["Foo","February","March","April","May","June","July","August","September","October","November","December"]},ja:{days:["日","月","火","水","木","金","土"],months:["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"],today:"今日",format:"YYYY-MM-dd"}}},function(e,t,n){"use strict";function r(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(t,"__esModule",{value:!0});var o=r(n(28)),a=r(n(29)),s=function(){function e(){var t=this;if((0,o.default)(this,e),window.thePicker)return window.thePicker;this.date=new Date,this.input=null,this.isOpen=!1,this.container=document.createElement("date-input-polyfill"),this.year=document.createElement("select"),e.createRangeSelect(this.year,1890,this.date.getFullYear()+20),this.year.className="yearSelect",this.year.addEventListener("change",function(){t.date.setYear(t.year.value),t.refreshDaysMatrix()});var n=document.createElement("span");n.className="yearSelect-wrapper",n.appendChild(this.year),this.container.appendChild(n),this.month=document.createElement("select"),this.month.className="monthSelect",this.month.addEventListener("change",function(){t.date.setMonth(t.month.value),t.refreshDaysMatrix()});var r=document.createElement("span");r.className="monthSelect-wrapper",r.appendChild(this.month),this.container.appendChild(r),this.today=document.createElement("button"),this.today.textContent="Today",this.today.addEventListener("click",function(){var e=new Date;t.date=new Date(e.getFullYear()+"/"+("0"+(e.getMonth()+1)).slice(-2)+"/"+("0"+e.getDate()).slice(-2)),t.setInput()}),this.container.appendChild(this.today);var a=document.createElement("table");this.daysHead=document.createElement("thead"),this.days=document.createElement("tbody"),this.days.addEventListener("click",function(e){var n=e.target;if(!n.hasAttribute("data-day"))return!1;var r=t.days.querySelector("[data-selected]");r&&r.removeAttribute("data-selected"),n.setAttribute("data-selected",""),t.date.setDate(parseInt(n.textContent)),t.setInput()}),a.appendChild(this.daysHead),a.appendChild(this.days),this.container.appendChild(a),this.hide(),document.body.appendChild(this.container),this.removeClickOut=function(e){if(t.isOpen){for(var n=e.target,r=n===t.container||n===t.input;!r&&(n=n.parentNode);)r=n===t.container;("date"!==e.target.getAttribute("type")&&!r||!r)&&t.hide()}},this.removeBlur=function(e){t.isOpen&&t.hide()}}return(0,a.default)(e,[{key:"hide",value:function(){this.container.setAttribute("data-open",this.isOpen=!1),this.input&&this.input.blur(),document.removeEventListener("mousedown",this.removeClickOut),document.removeEventListener("touchstart",this.removeClickOut)}},{key:"show",value:function(){var e=this;this.container.setAttribute("data-open",this.isOpen=!0),setTimeout(function(){document.addEventListener("mousedown",e.removeClickOut),document.addEventListener("touchstart",e.removeClickOut)},500),window.onpopstate=function(){e.hide()}}},{key:"goto",value:function(e){var t=this,n=e.getBoundingClientRect();this.container.style.top=n.top+n.height+(document.documentElement.scrollTop||document.body.scrollTop)+3+"px";var r=this.container.getBoundingClientRect(),o=r.width?r.width:280,a=function(){return t.container.className.replace("polyfill-left-aligned","").replace("polyfill-right-aligned","").replace(/\s+/g," ").trim()},s=n.right-o;n.right<o?(s=n.left,this.container.className=a()+" polyfill-left-aligned"):this.container.className=a()+" polyfill-right-aligned",this.container.style.left=s+(document.documentElement.scrollLeft||document.body.scrollLeft)+"px",this.show()}},{key:"attachTo",value:function(e){return!(e===this.input&&this.isOpen||(this.input=e,this.refreshLocale(),this.sync(),this.goto(this.input),0))}},{key:"sync",value:function(){isNaN(Date.parse(this.input.valueAsDate))?this.date=new Date:this.date=e.absoluteDate(this.input.valueAsDate),this.year.value=this.date.getFullYear(),this.month.value=this.date.getMonth(),this.refreshDaysMatrix()}},{key:"setInput",value:function(){var e=this;this.input.valueAsDate=this.date,this.input.focus(),setTimeout(function(){e.hide()},100),this.pingInput()}},{key:"refreshLocale",value:function(){if(this.locale===this.input.locale)return!1;this.locale=this.input.locale,this.today.textContent=this.locale.today||"Today";for(var t=["<tr>"],n=0,r=this.locale.days.length;n<r;++n)t.push('<th scope="col">'+this.locale.days[n]+"</th>");this.daysHead.innerHTML=t.join(""),e.createRangeSelect(this.month,0,11,this.locale.months)}},{key:"refreshDaysMatrix",value:function(){this.refreshLocale();for(var t=this.date.getFullYear(),n=this.date.getMonth(),r=new Date(t,n,1).getDay(),o=new Date(this.date.getFullYear(),n+1,0).getDate(),a=e.absoluteDate(this.input.valueAsDate)||!1,s=a&&t===a.getFullYear()&&n===a.getMonth(),i=[],l=0;l<o+r;++l)if(l%7==0&&i.push("\n          "+(0!==l?"</tr>":"")+"\n          <tr>\n        "),l+1<=r)i.push("<td></td>");else{var c=l+1-r,u=s&&a.getDate()===c;i.push("<td data-day "+(u?"data-selected":"")+">\n          "+c+"\n        </td>")}this.days.innerHTML=i.join("")}},{key:"pingInput",value:function(){var e=void 0,t=void 0;try{e=new Event("input"),t=new Event("change")}catch(n){(e=document.createEvent("KeyboardEvent")).initEvent("input",!0,!1),(t=document.createEvent("KeyboardEvent")).initEvent("change",!0,!1)}this.input.dispatchEvent(e),this.input.dispatchEvent(t)}}],[{key:"createRangeSelect",value:function(e,t,n,r){e.innerHTML="";for(var o=t;o<=n;++o){var a=document.createElement("option");e.appendChild(a);var s=r?r[o-t]:o;a.text=s,a.value=o}return e}},{key:"absoluteDate",value:function(e){return e&&new Date(e.getTime()+60*e.getTimezoneOffset()*1e3)}}]),e}();window.thePicker=new s,t.default=window.thePicker},function(e,t,n){e.exports={default:n(49),__esModule:!0}},function(e,t,n){e.exports={default:n(50),__esModule:!0}},function(e,t,n){e.exports={default:n(51),__esModule:!0}},function(e,t,n){e.exports={default:n(52),__esModule:!0}},function(e,t,n){"use strict";function r(e){return e&&e.__esModule?e:{default:e}}t.__esModule=!0;var o=r(n(47)),a=r(n(46)),s="function"==typeof a.default&&"symbol"==typeof o.default?function(e){return typeof e}:function(e){return e&&"function"==typeof a.default&&e.constructor===a.default?"symbol":typeof e};t.default="function"==typeof a.default&&"symbol"===s(o.default)?function(e){return void 0===e?"undefined":s(e)}:function(e){return e&&"function"==typeof a.default&&e.constructor===a.default?"symbol":void 0===e?"undefined":s(e)}},function(e,t,n){n(73);var r=n(8).Object;e.exports=function(e,t){return r.defineProperties(e,t)}},function(e,t,n){n(74);var r=n(8).Object;e.exports=function(e,t,n){return r.defineProperty(e,t,n)}},function(e,t,n){n(77),n(75),n(78),n(79),e.exports=n(8).Symbol},function(e,t,n){n(76),n(80),e.exports=n(27).f("iterator")},function(e,t){e.exports=function(e){if("function"!=typeof e)throw TypeError(e+" is not a function!");return e}},function(e,t){e.exports=function(){}},function(e,t,n){var r=n(5),o=n(70),a=n(69);e.exports=function(e){return function(t,n,s){var i,l=r(t),c=o(l.length),u=a(s,c);if(e&&n!=n){for(;c>u;)if((i=l[u++])!=i)return!0}else for(;c>u;u++)if((e||u in l)&&l[u]===n)return e||u||0;return!e&&-1}}},function(e,t,n){var r=n(53);e.exports=function(e,t,n){if(r(e),void 0===t)return e;switch(n){case 1:return function(n){return e.call(t,n)};case 2:return function(n,r){return e.call(t,n,r)};case 3:return function(n,r,o){return e.call(t,n,r,o)}}return function(){return e.apply(t,arguments)}}},function(e,t,n){var r=n(13),o=n(37),a=n(20);e.exports=function(e){var t=r(e),n=o.f;if(n)for(var s,i=n(e),l=a.f,c=0;i.length>c;)l.call(e,s=i[c++])&&t.push(s);return t}},function(e,t,n){e.exports=n(2).document&&document.documentElement},function(e,t,n){var r=n(30);e.exports=Object("z").propertyIsEnumerable(0)?Object:function(e){return"String"==r(e)?e.split(""):Object(e)}},function(e,t,n){var r=n(30);e.exports=Array.isArray||function(e){return"Array"==r(e)}},function(e,t,n){"use strict";var r=n(34),o=n(14),a=n(21),s={};n(6)(s,n(7)("iterator"),function(){return this}),e.exports=function(e,t,n){e.prototype=r(s,{next:o(1,n)}),a(e,t+" Iterator")}},function(e,t){e.exports=function(e,t){return{value:t,done:!!e}}},function(e,t,n){var r=n(13),o=n(5);e.exports=function(e,t){for(var n,a=o(e),s=r(a),i=s.length,l=0;i>l;)if(a[n=s[l++]]===t)return n}},function(e,t,n){var r=n(15)("meta"),o=n(12),a=n(3),s=n(4).f,i=0,l=Object.isExtensible||function(){return!0},c=!n(11)(function(){return l(Object.preventExtensions({}))}),u=function(e){s(e,r,{value:{i:"O"+ ++i,w:{}}})},d=e.exports={KEY:r,NEED:!1,fastKey:function(e,t){if(!o(e))return"symbol"==typeof e?e:("string"==typeof e?"S":"P")+e;if(!a(e,r)){if(!l(e))return"F";if(!t)return"E";u(e)}return e[r].i},getWeak:function(e,t){if(!a(e,r)){if(!l(e))return!0;if(!t)return!1;u(e)}return e[r].w},onFreeze:function(e){return c&&d.NEED&&l(e)&&!a(e,r)&&u(e),e}}},function(e,t,n){var r=n(20),o=n(14),a=n(5),s=n(25),i=n(3),l=n(32),c=Object.getOwnPropertyDescriptor;t.f=n(1)?c:function(e,t){if(e=a(e),t=s(t,!0),l)try{return c(e,t)}catch(e){}if(i(e,t))return o(!r.f.call(e,t),e[t])}},function(e,t,n){var r=n(5),o=n(36).f,a={}.toString,s="object"==typeof window&&window&&Object.getOwnPropertyNames?Object.getOwnPropertyNames(window):[];e.exports.f=function(e){return s&&"[object Window]"==a.call(e)?function(e){try{return o(e)}catch(e){return s.slice()}}(e):o(r(e))}},function(e,t,n){var r=n(3),o=n(71),a=n(22)("IE_PROTO"),s=Object.prototype;e.exports=Object.getPrototypeOf||function(e){return e=o(e),r(e,a)?e[a]:"function"==typeof e.constructor&&e instanceof e.constructor?e.constructor.prototype:e instanceof Object?s:null}},function(e,t,n){var r=n(24),o=n(16);e.exports=function(e){return function(t,n){var a,s,i=String(o(t)),l=r(n),c=i.length;return l<0||l>=c?e?"":void 0:(a=i.charCodeAt(l))<55296||a>56319||l+1===c||(s=i.charCodeAt(l+1))<56320||s>57343?e?i.charAt(l):a:e?i.slice(l,l+2):s-56320+(a-55296<<10)+65536}}},function(e,t,n){var r=n(24),o=Math.max,a=Math.min;e.exports=function(e,t){return(e=r(e))<0?o(e+t,0):a(e,t)}},function(e,t,n){var r=n(24),o=Math.min;e.exports=function(e){return e>0?o(r(e),9007199254740991):0}},function(e,t,n){var r=n(16);e.exports=function(e){return Object(r(e))}},function(e,t,n){"use strict";var r=n(54),o=n(62),a=n(18),s=n(5);e.exports=n(33)(Array,"Array",function(e,t){this._t=s(e),this._i=0,this._k=t},function(){var e=this._t,t=this._k,n=this._i++;return!e||n>=e.length?(this._t=void 0,o(1)):o(0,"keys"==t?n:"values"==t?e[n]:[n,e[n]])},"values"),a.Arguments=a.Array,r("keys"),r("values"),r("entries")},function(e,t,n){var r=n(10);r(r.S+r.F*!n(1),"Object",{defineProperties:n(35)})},function(e,t,n){var r=n(10);r(r.S+r.F*!n(1),"Object",{defineProperty:n(4).f})},function(e,t){},function(e,t,n){"use strict";var r=n(68)(!0);n(33)(String,"String",function(e){this._t=String(e),this._i=0},function(){var e,t=this._t,n=this._i;return n>=t.length?{value:void 0,done:!0}:(e=r(t,n),this._i+=e.length,{value:e,done:!1})})},function(e,t,n){"use strict";var r=n(2),o=n(3),a=n(1),s=n(10),i=n(39),l=n(64).KEY,c=n(11),u=n(23),d=n(21),p=n(15),f=n(7),m=n(27),g=n(26),h=n(63),v=n(57),y=n(60),b=n(9),_=n(5),S=n(25),L=n(14),w=n(34),x=n(66),k=n(65),C=n(4),T=n(13),M=k.f,E=C.f,A=x.f,D=r.Symbol,q=r.JSON,I=q&&q.stringify,R="prototype",O=f("_hidden"),P=f("toPrimitive"),H={}.propertyIsEnumerable,N=u("symbol-registry"),F=u("symbols"),B=u("op-symbols"),j=Object[R],Y="function"==typeof D,W=r.QObject,z=!W||!W[R]||!W[R].findChild,X=a&&c(function(){return 7!=w(E({},"a",{get:function(){return E(this,"a",{value:7}).a}})).a})?function(e,t,n){var r=M(j,t);r&&delete j[t],E(e,t,n),r&&e!==j&&E(j,t,r)}:E,U=function(e){var t=F[e]=w(D[R]);return t._k=e,t},K=Y&&"symbol"==typeof D.iterator?function(e){return"symbol"==typeof e}:function(e){return e instanceof D},V=function(e,t,n){return e===j&&V(B,t,n),b(e),t=S(t,!0),b(n),o(F,t)?(n.enumerable?(o(e,O)&&e[O][t]&&(e[O][t]=!1),n=w(n,{enumerable:L(0,!1)})):(o(e,O)||E(e,O,L(1,{})),e[O][t]=!0),X(e,t,n)):E(e,t,n)},J=function(e,t){b(e);for(var n,r=v(t=_(t)),o=0,a=r.length;a>o;)V(e,n=r[o++],t[n]);return e},Z=function(e){var t=H.call(this,e=S(e,!0));return!(this===j&&o(F,e)&&!o(B,e))&&(!(t||!o(this,e)||!o(F,e)||o(this,O)&&this[O][e])||t)},G=function(e,t){if(e=_(e),t=S(t,!0),e!==j||!o(F,t)||o(B,t)){var n=M(e,t);return!n||!o(F,t)||o(e,O)&&e[O][t]||(n.enumerable=!0),n}},$=function(e){for(var t,n=A(_(e)),r=[],a=0;n.length>a;)o(F,t=n[a++])||t==O||t==l||r.push(t);return r},Q=function(e){for(var t,n=e===j,r=A(n?B:_(e)),a=[],s=0;r.length>s;)!o(F,t=r[s++])||n&&!o(j,t)||a.push(F[t]);return a};Y||(i((D=function(){if(this instanceof D)throw TypeError("Symbol is not a constructor!");var e=p(arguments.length>0?arguments[0]:void 0),t=function(n){this===j&&t.call(B,n),o(this,O)&&o(this[O],e)&&(this[O][e]=!1),X(this,e,L(1,n))};return a&&z&&X(j,e,{configurable:!0,set:t}),U(e)})[R],"toString",function(){return this._k}),k.f=G,C.f=V,n(36).f=x.f=$,n(20).f=Z,n(37).f=Q,a&&!n(19)&&i(j,"propertyIsEnumerable",Z,!0),m.f=function(e){return U(f(e))}),s(s.G+s.W+s.F*!Y,{Symbol:D});for(var ee="hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables".split(","),te=0;ee.length>te;)f(ee[te++]);for(ee=T(f.store),te=0;ee.length>te;)g(ee[te++]);s(s.S+s.F*!Y,"Symbol",{for:function(e){return o(N,e+="")?N[e]:N[e]=D(e)},keyFor:function(e){if(K(e))return h(N,e);throw TypeError(e+" is not a symbol!")},useSetter:function(){z=!0},useSimple:function(){z=!1}}),s(s.S+s.F*!Y,"Object",{create:function(e,t){return void 0===t?w(e):J(w(e),t)},defineProperty:V,defineProperties:J,getOwnPropertyDescriptor:G,getOwnPropertyNames:$,getOwnPropertySymbols:Q}),q&&s(s.S+s.F*(!Y||c(function(){var e=D();return"[null]"!=I([e])||"{}"!=I({a:e})||"{}"!=I(Object(e))})),"JSON",{stringify:function(e){if(void 0!==e&&!K(e)){for(var t,n,r=[e],o=1;arguments.length>o;)r.push(arguments[o++]);return"function"==typeof(t=r[1])&&(n=t),!n&&y(t)||(t=function(e,t){if(n&&(t=n.call(this,e,t)),!K(t))return t}),r[1]=t,I.apply(q,r)}}}),D[R][P]||n(6)(D[R],P,D[R].valueOf),d(D,"Symbol"),d(Math,"Math",!0),d(r.JSON,"JSON",!0)},function(e,t,n){n(26)("asyncIterator")},function(e,t,n){n(26)("observable")},function(e,t,n){n(72);for(var r=n(2),o=n(6),a=n(18),s=n(7)("toStringTag"),i=["NodeList","DOMTokenList","MediaList","StyleSheetList","CSSRuleList"],l=0;l<5;l++){var c=i[l],u=r[c],d=u&&u.prototype;d&&!d[s]&&o(d,s,c),a[c]=a.Array}},function(e,t,n){(e.exports=n(82)()).push([e.id,"date-input-polyfill{background:#fff;color:#000;text-shadow:none;border:0;padding:0;height:auto;width:auto;line-height:normal;font-family:sans-serif;font-size:14px;position:absolute!important;text-align:center;box-shadow:0 3px 10px 1px rgba(0,0,0,.22);cursor:default;z-index:1;border-radius:5px;-moz-border-radius:5px;-webkit-border-radius:5px;overflow:hidden;display:block}date-input-polyfill[data-open=false]{visibility:hidden;z-index:-100!important;top:0}date-input-polyfill[data-open=true]{visibility:visible}date-input-polyfill select,date-input-polyfill table,date-input-polyfill td,date-input-polyfill th{background:#fff;color:#000;text-shadow:none;border:0;padding:0;height:auto;width:auto;line-height:normal;font-family:sans-serif;font-size:14px;box-shadow:none;font-family:Lato,Helvetica,Arial,sans-serif}date-input-polyfill button,date-input-polyfill select{border:0;border-radius:0;border-bottom:1px solid #dadfe1;height:24px;vertical-align:top;-webkit-appearance:none;-moz-appearance:none}date-input-polyfill .monthSelect-wrapper{width:55%;display:inline-block}date-input-polyfill .yearSelect-wrapper{width:25%;display:inline-block}date-input-polyfill select{width:100%}date-input-polyfill select:first-of-type{border-right:1px solid #dadfe1;border-radius:5px 0 0 0;-moz-border-radius:5px 0 0 0;-webkit-border-radius:5px 0 0 0}date-input-polyfill button{width:20%;background:#dadfe1;border-radius:0 5px 0 0;-moz-border-radius:0 5px 0 0;-webkit-border-radius:0 5px 0 0}date-input-polyfill button:hover{background:#eee}date-input-polyfill table{border-collapse:separate!important;border-radius:0 0 5px 5px;-moz-border-radius:0 0 5px 5px;-webkit-border-radius:0 0 5px 5px;overflow:hidden;max-width:280px;width:280px}date-input-polyfill td,date-input-polyfill th{width:32px;padding:4px;text-align:center;box-sizing:content-box}date-input-polyfill td[data-day]{cursor:pointer}date-input-polyfill td[data-day]:hover{background:#dadfe1}date-input-polyfill [data-selected]{font-weight:700;background:#d8eaf6}",""])},function(e,t){e.exports=function(){var e=[];return e.toString=function(){for(var e=[],t=0;t<this.length;t++){var n=this[t];n[2]?e.push("@media "+n[2]+"{"+n[1]+"}"):e.push(n[1])}return e.join("")},e.i=function(t,n){"string"==typeof t&&(t=[[null,t,""]]);for(var r={},o=0;o<this.length;o++){var a=this[o][0];"number"==typeof a&&(r[a]=!0)}for(o=0;o<t.length;o++){var s=t[o];"number"==typeof s[0]&&r[s[0]]||(n&&!s[2]?s[2]=n:n&&(s[2]="("+s[2]+") and ("+n+")"),e.push(s))}},e}},function(e,t,n){function r(e,t){for(var n=0;n<e.length;n++){var r=e[n],o=f[r.id];if(o){o.refs++;for(var a=0;a<o.parts.length;a++)o.parts[a](r.parts[a]);for(;a<r.parts.length;a++)o.parts.push(c(r.parts[a],t))}else{var s=[];for(a=0;a<r.parts.length;a++)s.push(c(r.parts[a],t));f[r.id]={id:r.id,refs:1,parts:s}}}}function o(e){for(var t=[],n={},r=0;r<e.length;r++){var o=e[r],a=o[0],s={css:o[1],media:o[2],sourceMap:o[3]};n[a]?n[a].parts.push(s):t.push(n[a]={id:a,parts:[s]})}return t}function a(e,t){var n=h(),r=b[b.length-1];if("top"===e.insertAt)r?r.nextSibling?n.insertBefore(t,r.nextSibling):n.appendChild(t):n.insertBefore(t,n.firstChild),b.push(t);else{if("bottom"!==e.insertAt)throw new Error("Invalid value for parameter 'insertAt'. Must be 'top' or 'bottom'.");n.appendChild(t)}}function s(e){e.parentNode.removeChild(e);var t=b.indexOf(e);t>=0&&b.splice(t,1)}function i(e){var t=document.createElement("style");return t.type="text/css",a(e,t),t}function l(e){var t=document.createElement("link");return t.rel="stylesheet",a(e,t),t}function c(e,t){var n,r,o;if(t.singleton){var a=y++;n=v||(v=i(t)),r=u.bind(null,n,a,!1),o=u.bind(null,n,a,!0)}else e.sourceMap&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&"function"==typeof URL.revokeObjectURL&&"function"==typeof Blob&&"function"==typeof btoa?(n=l(t),r=p.bind(null,n),o=function(){s(n),n.href&&URL.revokeObjectURL(n.href)}):(n=i(t),r=d.bind(null,n),o=function(){s(n)});return r(e),function(t){if(t){if(t.css===e.css&&t.media===e.media&&t.sourceMap===e.sourceMap)return;r(e=t)}else o()}}function u(e,t,n,r){var o=n?"":r.css;if(e.styleSheet)e.styleSheet.cssText=_(t,o);else{var a=document.createTextNode(o),s=e.childNodes;s[t]&&e.removeChild(s[t]),s.length?e.insertBefore(a,s[t]):e.appendChild(a)}}function d(e,t){var n=t.css,r=t.media;if(r&&e.setAttribute("media",r),e.styleSheet)e.styleSheet.cssText=n;else{for(;e.firstChild;)e.removeChild(e.firstChild);e.appendChild(document.createTextNode(n))}}function p(e,t){var n=t.css,r=t.sourceMap;r&&(n+="\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(r))))+" */");var o=new Blob([n],{type:"text/css"}),a=e.href;e.href=URL.createObjectURL(o),a&&URL.revokeObjectURL(a)}var f={},m=function(e){var t;return function(){return void 0===t&&(t=e.apply(this,arguments)),t}},g=m(function(){return/msie [6-9]\b/.test(window.navigator.userAgent.toLowerCase())}),h=m(function(){return document.head||document.getElementsByTagName("head")[0]}),v=null,y=0,b=[];e.exports=function(e,t){void 0===(t=t||{}).singleton&&(t.singleton=g()),void 0===t.insertAt&&(t.insertAt="bottom");var n=o(e);return r(n,t),function(e){for(var a=[],s=0;s<n.length;s++){var i=n[s];(l=f[i.id]).refs--,a.push(l)}for(e&&r(o(e),t),s=0;s<a.length;s++){var l;if(0===(l=a[s]).refs){for(var c=0;c<l.parts.length;c++)l.parts[c]();delete f[l.id]}}}};var _=function(){var e=[];return function(t,n){return e[t]=n,e.filter(Boolean).join("\n")}}()},function(e,t,n){var r=n(81);"string"==typeof r&&(r=[[e.id,r,""]]),n(83)(r,{}),r.locals&&(e.exports=r.locals)}])},function(e,t,n){e.exports=n.p+"resources/img/favicon.ico"},function(e,t,n){var r={"./atoms/Button/Button.css":56,"./atoms/Heading/Heading.css":57,"./atoms/Icon/Icon.css":58,"./atoms/Icon/assets/add-location.svg":59,"./atoms/Icon/assets/baseline-phone.svg":60,"./atoms/Icon/assets/calendar-icon.svg":61,"./atoms/Icon/assets/cancel.svg":62,"./atoms/Icon/assets/check-green.svg":63,"./atoms/Icon/assets/chevron.svg":64,"./atoms/Icon/assets/clock-white.svg":65,"./atoms/Icon/assets/close-thin.svg":66,"./atoms/Icon/assets/close.svg":67,"./atoms/Icon/assets/dl-pdf.svg":68,"./atoms/Icon/assets/down-gray.svg":69,"./atoms/Icon/assets/down-white.svg":70,"./atoms/Icon/assets/down.svg":71,"./atoms/Icon/assets/earth.svg":72,"./atoms/Icon/assets/fb.svg":73,"./atoms/Icon/assets/get-rebates-save.svg":74,"./atoms/Icon/assets/go-paperless.svg":75,"./atoms/Icon/assets/heart-tag.svg":76,"./atoms/Icon/assets/icon_accordion_arrow.svg":77,"./atoms/Icon/assets/icon_accounthelp_green.svg":78,"./atoms/Icon/assets/icon_autopay.svg":79,"./atoms/Icon/assets/icon_billingnotice.svg":80,"./atoms/Icon/assets/icon_bluesky.svg":81,"./atoms/Icon/assets/icon_cancel_remove.svg":82,"./atoms/Icon/assets/icon_circle_avatar_filled.svg":83,"./atoms/Icon/assets/icon_close_X.svg":84,"./atoms/Icon/assets/icon_close_X_blue.svg":85,"./atoms/Icon/assets/icon_close_X_dark.svg":86,"./atoms/Icon/assets/icon_datepicker.svg":87,"./atoms/Icon/assets/icon_electric_vehicle_green.svg":88,"./atoms/Icon/assets/icon_email.svg":89,"./atoms/Icon/assets/icon_equalpay.svg":90,"./atoms/Icon/assets/icon_greencheck_small.svg":91,"./atoms/Icon/assets/icon_hamburger_filled.svg":92,"./atoms/Icon/assets/icon_hidedetails.svg":93,"./atoms/Icon/assets/icon_largecheck_green.svg":94,"./atoms/Icon/assets/icon_list.svg":95,"./atoms/Icon/assets/icon_map.svg":96,"./atoms/Icon/assets/icon_mobileapp_black.svg":97,"./atoms/Icon/assets/icon_mobileapp_green.svg":98,"./atoms/Icon/assets/icon_needtime_white.svg":99,"./atoms/Icon/assets/icon_outage_green.svg":100,"./atoms/Icon/assets/icon_outagereport_green.svg":101,"./atoms/Icon/assets/icon_paperless.svg":102,"./atoms/Icon/assets/icon_paperless_green.svg":103,"./atoms/Icon/assets/icon_password_empty.svg":104,"./atoms/Icon/assets/icon_password_no.svg":105,"./atoms/Icon/assets/icon_password_yes.svg":106,"./atoms/Icon/assets/icon_payment_reminder.svg":107,"./atoms/Icon/assets/icon_paymentconfirmation.svg":108,"./atoms/Icon/assets/icon_pdf_blue.svg":109,"./atoms/Icon/assets/icon_pdf_white.svg":110,"./atoms/Icon/assets/icon_powerout.svg":111,"./atoms/Icon/assets/icon_projectedbill.svg":112,"./atoms/Icon/assets/icon_question_white.svg":113,"./atoms/Icon/assets/icon_showdetails.svg":114,"./atoms/Icon/assets/icon_social_facebook.svg":115,"./atoms/Icon/assets/icon_social_instagram.svg":116,"./atoms/Icon/assets/icon_social_linkedin.svg":117,"./atoms/Icon/assets/icon_social_twitter.svg":118,"./atoms/Icon/assets/icon_social_youtube.svg":119,"./atoms/Icon/assets/icon_stormsafety_green.svg":120,"./atoms/Icon/assets/icon_streetlight_green.svg":121,"./atoms/Icon/assets/icon_truck_green.svg":122,"./atoms/Icon/assets/icons_custservice_green.svg":123,"./atoms/Icon/assets/in.svg":124,"./atoms/Icon/assets/li.svg":125,"./atoms/Icon/assets/map-arrow.svg":126,"./atoms/Icon/assets/map-list.svg":127,"./atoms/Icon/assets/menu.svg":128,"./atoms/Icon/assets/minus-blue.svg":129,"./atoms/Icon/assets/minus.svg":130,"./atoms/Icon/assets/outage-cluster.svg":4,"./atoms/Icon/assets/outage-marker.svg":2,"./atoms/Icon/assets/outage-planned.svg":3,"./atoms/Icon/assets/phone_dark.svg":131,"./atoms/Icon/assets/plus-blue.svg":132,"./atoms/Icon/assets/plus.svg":133,"./atoms/Icon/assets/report-outage.svg":134,"./atoms/Icon/assets/search.svg":135,"./atoms/Icon/assets/sign-up-alerts.svg":136,"./atoms/Icon/assets/start-stop-move-service.svg":137,"./atoms/Icon/assets/state-california-icon.svg":138,"./atoms/Icon/assets/state-california.svg":139,"./atoms/Icon/assets/state-idaho-icon.svg":140,"./atoms/Icon/assets/state-idaho.svg":141,"./atoms/Icon/assets/state-oregon-icon.svg":142,"./atoms/Icon/assets/state-oregon.svg":143,"./atoms/Icon/assets/state-utah-icon.svg":144,"./atoms/Icon/assets/state-utah.svg":145,"./atoms/Icon/assets/state-washington-icon.svg":146,"./atoms/Icon/assets/state-washington.svg":147,"./atoms/Icon/assets/state-wyoming-icon.svg":148,"./atoms/Icon/assets/state-wyoming.svg":149,"./atoms/Icon/assets/tw.svg":150,"./atoms/Icon/assets/two-people.svg":151,"./atoms/Icon/assets/view-pay-bill.svg":152,"./atoms/Icon/assets/x-red.svg":153,"./atoms/Icon/assets/yt.svg":154,"./atoms/Image/Image.css":155,"./atoms/Image/assets/Pacific-Power-FooterLogo.svg":156,"./atoms/Image/assets/Pacific-Power-Logo.svg":157,"./atoms/Image/assets/Pacific-Power-logo-new.svg":158,"./atoms/Image/assets/Rocky-Mountain-Power-logo.svg":159,"./atoms/Image/assets/apple-touch-icon.png":160,"./atoms/Image/assets/homepage-hero.jpg":161,"./atoms/Image/assets/outage-cluster-10.png":162,"./atoms/Image/assets/outage-cluster-100.png":163,"./atoms/Image/assets/outage-cluster-1000.png":164,"./atoms/Image/assets/outage-cluster-50.png":165,"./atoms/Image/assets/outage-map-lg.jpg":166,"./atoms/Image/assets/outage-map.jpg":167,"./atoms/Image/assets/outage-planned.png":168,"./atoms/Image/assets/outages-and-safety-lg.jpg":169,"./atoms/Image/assets/outages-and-safety-md.jpg":170,"./atoms/Image/assets/outages-and-safety-mobile-2x.jpg":171,"./atoms/Image/assets/outages-and-safety-mobile.jpg":172,"./atoms/Image/assets/pacificorp-logo.svg":173,"./atoms/Image/assets/pp-logo.svg":174,"./atoms/Image/assets/rancheria-falls-lg.jpg":175,"./atoms/Image/assets/rancheria-falls-md.jpg":176,"./atoms/Image/assets/rancheria-falls.jpg":177,"./atoms/Image/assets/report-problem-lg.jpg":178,"./atoms/Image/assets/report-problem.jpg":179,"./atoms/Image/assets/rm-logo.svg":180,"./atoms/Image/assets/safety-tips-contractors-lg.jpg":181,"./atoms/Image/assets/safety-tips-farmranch-lg.jpg":182,"./atoms/Image/assets/safety-tips-firstresponders-lg.jpg":183,"./atoms/Image/assets/safety-tips-outlet-lg.jpg":184,"./atoms/Image/assets/safety-tips-outlet.jpg":185,"./atoms/Link/Link.css":186,"./atoms/List/List.css":187,"./atoms/Padding/Padding.css":188,"./atoms/Progress/Progress.css":189,"./atoms/Rhythm/Rhythm.css":190,"./atoms/Table/Table.css":191,"./atoms/Text/Text.css":192,"./atoms/Video/Video.css":193,"./atoms/Wrapper/Wrapper.css":194,"./modifiers/AEMExtend/AEMExtend.css":195,"./modifiers/Dividers/Dividers.css":196,"./modifiers/Flex/Flex.css":197,"./modifiers/FullWidth/FullWidth.css":198,"./modifiers/Hide/Hide.css":199,"./molecules/Alert/Alert.css":200,"./molecules/Brand/Brand.css":201,"./molecules/Brand/Brand.generic.css":202,"./molecules/CalculatorLegend/CalculatorLegend.css":203,"./molecules/CalculatorLegend/assets/existing-hv.png":204,"./molecules/CalculatorLegend/assets/existing-padmount-transformer.png":205,"./molecules/CalculatorLegend/assets/existing-transformer.png":206,"./molecules/CalculatorLegend/assets/hv-aerial.png":207,"./molecules/CalculatorLegend/assets/hv-underground.png":208,"./molecules/CalculatorLegend/assets/lv-aerial.png":209,"./molecules/CalculatorLegend/assets/lv-underground.png":210,"./molecules/CalculatorLegend/assets/new-transformer.png":211,"./molecules/CalculatorLegend/assets/overhead-transformer.png":212,"./molecules/CalculatorLegend/assets/residence.png":213,"./molecules/Card/Card.css":214,"./molecules/Expandable/Expandable.css":215,"./molecules/ExtensionRadios/ExtensionRadios.css":216,"./molecules/ExtensionRadios/assets/long-overhead-underground.png":217,"./molecules/ExtensionRadios/assets/long-overhead.png":218,"./molecules/ExtensionRadios/assets/long-underground-from-underground.png":219,"./molecules/ExtensionRadios/assets/long-underground.png":220,"./molecules/ExtensionRadios/assets/short-overhead.png":221,"./molecules/ExtensionRadios/assets/short-underground-from-underground.png":222,"./molecules/ExtensionRadios/assets/short-underground.png":223,"./molecules/Fieldset/Fieldset.css":224,"./molecules/Figure/Figure.css":225,"./molecules/Form/Form.css":226,"./molecules/IconCard/IconCard.css":227,"./molecules/InlineModal/InlineModal.css":228,"./molecules/Input/Input.css":229,"./molecules/Input/assets/checkbox-checked.svg":230,"./molecules/Input/assets/checkbox-unchecked.svg":231,"./molecules/Input/assets/radio-checked.svg":232,"./molecules/Input/assets/radio-unchecked.svg":233,"./molecules/Legend/Legend.css":234,"./molecules/Media/Media.css":235,"./molecules/Media/assets/randy-savage.jpg":236,"./molecules/MobileNav/MobileNav.css":237,"./molecules/Modal/Modal.css":238,"./molecules/Odometer/Odometer.css":239,"./molecules/Scrollbars/Scrollbars.css":240,"./molecules/Search/Search.css":241,"./molecules/Select/Select.css":242,"./molecules/Select/assets/down-white.svg":243,"./molecules/Separator/Separator.css":244,"./molecules/Signin/LoginFlyout.css":245,"./molecules/Signin/LogoutFlyout.css":246,"./molecules/Signin/Signin.css":247,"./molecules/StateList/StateList.css":248,"./molecules/StateModal/StateModal.css":249,"./molecules/StateSelect/StateSelect.css":250,"./molecules/StepsNav/StepsNav.css":251,"./molecules/StylizedTitle/StylizedTitle.css":252,"./molecules/Tabs/Tabs.css":253,"./molecules/Textarea/Textarea.css":254,"./molecules/TopNav/TopNav.css":255,"./organisms/CardContainer/CardContainer.css":256,"./organisms/CareCalculator/CareCalculator.css":257,"./organisms/EnergyUseCalculator/EnergyUseCalculator.css":258,"./organisms/ExtensionCalculator/ExtensionCalculator.css":259,"./organisms/ExtensionCalculator/assets/padmount-switch-cabinet.jpg":260,"./organisms/ExtensionCalculator/assets/padmount-transformer-diagram.jpg":261,"./organisms/ExtensionCalculator/assets/padmount-transformer.jpg":262,"./organisms/ExtensionCalculator/assets/pole-with-transformer.jpg":263,"./organisms/ExtensionCalculator/assets/pole-without-transformer-2.jpg":264,"./organisms/ExtensionCalculator/assets/pole-without-transformer.jpg":265,"./organisms/Faq/Faq.css":266,"./organisms/Footer/Footer.css":267,"./organisms/GridSearch/GridSearch.css":268,"./organisms/Header/Header.css":269,"./organisms/Hero/Hero.css":270,"./organisms/ListSearch/ListSearch.css":271,"./organisms/News/News.css":272,"./organisms/OutageMap/OutageMap.css":273,"./organisms/OutageMap/assets/down-white.svg":274,"./organisms/SideNav/SideNav.css":275,"./organisms/SkyCalculator/SkyCalculator.css":276,"./organisms/SkyCalculator/assets/big-salmon.svg":277,"./organisms/SkyCalculator/assets/electric-vehicle.svg":278,"./organisms/SkyCalculator/assets/led-bulb.svg":279,"./organisms/SkyCalculator/assets/washing-machine.svg":280,"./organisms/SkyCalculator/assets/weight-pound-filled.svg":281,"./organisms/TabbedContent/TabbedContent.css":282,"./templates/TwoColumn/TwoColumn.css":283};function o(e){var t=a(e);return n(t)}function a(e){if(!n.o(r,e)){var t=new Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}return r[e]}o.keys=function(){return Object.keys(r)},o.resolve=a,e.exports=o,o.id=55},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/add-location.svg"},function(e,t,n){e.exports=n.p+"resources/img/baseline-phone.svg"},function(e,t,n){e.exports=n.p+"resources/img/calendar-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/cancel.svg"},function(e,t,n){e.exports=n.p+"resources/img/check-green.svg"},function(e,t,n){e.exports=n.p+"resources/img/chevron.svg"},function(e,t,n){e.exports=n.p+"resources/img/clock-white.svg"},function(e,t,n){e.exports=n.p+"resources/img/close-thin.svg"},function(e,t,n){e.exports=n.p+"resources/img/close.svg"},function(e,t,n){e.exports=n.p+"resources/img/dl-pdf.svg"},function(e,t,n){e.exports=n.p+"resources/img/down-gray.svg"},function(e,t,n){e.exports=n.p+"resources/img/down-white.svg"},function(e,t,n){e.exports=n.p+"resources/img/down.svg"},function(e,t,n){e.exports=n.p+"resources/img/earth.svg"},function(e,t,n){e.exports=n.p+"resources/img/fb.svg"},function(e,t,n){e.exports=n.p+"resources/img/get-rebates-save.svg"},function(e,t,n){e.exports=n.p+"resources/img/go-paperless.svg"},function(e,t,n){e.exports=n.p+"resources/img/heart-tag.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_accordion_arrow.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_accounthelp_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_autopay.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_billingnotice.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_bluesky.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_cancel_remove.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_circle_avatar_filled.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_close_X.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_close_X_blue.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_close_X_dark.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_datepicker.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_electric_vehicle_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_email.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_equalpay.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_greencheck_small.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_hamburger_filled.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_hidedetails.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_largecheck_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_list.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_map.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_mobileapp_black.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_mobileapp_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_needtime_white.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_outage_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_outagereport_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_paperless.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_paperless_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_password_empty.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_password_no.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_password_yes.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_payment_reminder.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_paymentconfirmation.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_pdf_blue.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_pdf_white.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_powerout.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_projectedbill.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_question_white.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_showdetails.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_social_facebook.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_social_instagram.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_social_linkedin.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_social_twitter.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_social_youtube.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_stormsafety_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_streetlight_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icon_truck_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/icons_custservice_green.svg"},function(e,t,n){e.exports=n.p+"resources/img/in.svg"},function(e,t,n){e.exports=n.p+"resources/img/li.svg"},function(e,t,n){e.exports=n.p+"resources/img/map-arrow.svg"},function(e,t,n){e.exports=n.p+"resources/img/map-list.svg"},function(e,t,n){e.exports=n.p+"resources/img/menu.svg"},function(e,t,n){e.exports=n.p+"resources/img/minus-blue.svg"},function(e,t,n){e.exports=n.p+"resources/img/minus.svg"},function(e,t,n){e.exports=n.p+"resources/img/phone_dark.svg"},function(e,t,n){e.exports=n.p+"resources/img/plus-blue.svg"},function(e,t,n){e.exports=n.p+"resources/img/plus.svg"},function(e,t,n){e.exports=n.p+"resources/img/report-outage.svg"},function(e,t,n){e.exports=n.p+"resources/img/search.svg"},function(e,t,n){e.exports=n.p+"resources/img/sign-up-alerts.svg"},function(e,t,n){e.exports=n.p+"resources/img/start-stop-move-service.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-california-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-california.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-idaho-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-idaho.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-oregon-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-oregon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-utah-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-utah.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-washington-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-washington.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-wyoming-icon.svg"},function(e,t,n){e.exports=n.p+"resources/img/state-wyoming.svg"},function(e,t,n){e.exports=n.p+"resources/img/tw.svg"},function(e,t,n){e.exports=n.p+"resources/img/two-people.svg"},function(e,t,n){e.exports=n.p+"resources/img/view-pay-bill.svg"},function(e,t,n){e.exports=n.p+"resources/img/x-red.svg"},function(e,t,n){e.exports=n.p+"resources/img/yt.svg"},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/Pacific-Power-FooterLogo.svg"},function(e,t,n){e.exports=n.p+"resources/img/Pacific-Power-Logo.svg"},function(e,t,n){e.exports=n.p+"resources/img/Pacific-Power-logo-new.svg"},function(e,t,n){e.exports=n.p+"resources/img/Rocky-Mountain-Power-logo.svg"},function(e,t,n){e.exports=n.p+"resources/img/apple-touch-icon.png"},function(e,t,n){e.exports=n.p+"resources/img/homepage-hero.jpg"},function(e,t,n){e.exports=n.p+"resources/img/outage-cluster-10.png"},function(e,t,n){e.exports=n.p+"resources/img/outage-cluster-100.png"},function(e,t,n){e.exports=n.p+"resources/img/outage-cluster-1000.png"},function(e,t,n){e.exports=n.p+"resources/img/outage-cluster-50.png"},function(e,t,n){e.exports=n.p+"resources/img/outage-map-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/outage-map.jpg"},function(e,t,n){e.exports=n.p+"resources/img/outage-planned.png"},function(e,t,n){e.exports=n.p+"resources/img/outages-and-safety-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/outages-and-safety-md.jpg"},function(e,t,n){e.exports=n.p+"resources/img/outages-and-safety-mobile-2x.jpg"},function(e,t,n){e.exports=n.p+"resources/img/outages-and-safety-mobile.jpg"},function(e,t,n){e.exports=n.p+"resources/img/pacificorp-logo.svg"},function(e,t,n){e.exports=n.p+"resources/img/pp-logo.svg"},function(e,t,n){e.exports=n.p+"resources/img/rancheria-falls-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/rancheria-falls-md.jpg"},function(e,t,n){e.exports=n.p+"resources/img/rancheria-falls.jpg"},function(e,t,n){e.exports=n.p+"resources/img/report-problem-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/report-problem.jpg"},function(e,t,n){e.exports=n.p+"resources/img/rm-logo.svg"},function(e,t,n){e.exports=n.p+"resources/img/safety-tips-contractors-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/safety-tips-farmranch-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/safety-tips-firstresponders-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/safety-tips-outlet-lg.jpg"},function(e,t,n){e.exports=n.p+"resources/img/safety-tips-outlet.jpg"},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/existing-hv.png"},function(e,t,n){e.exports=n.p+"resources/img/existing-padmount-transformer.png"},function(e,t,n){e.exports=n.p+"resources/img/existing-transformer.png"},function(e,t,n){e.exports=n.p+"resources/img/hv-aerial.png"},function(e,t,n){e.exports=n.p+"resources/img/hv-underground.png"},function(e,t,n){e.exports=n.p+"resources/img/lv-aerial.png"},function(e,t,n){e.exports=n.p+"resources/img/lv-underground.png"},function(e,t,n){e.exports=n.p+"resources/img/new-transformer.png"},function(e,t,n){e.exports=n.p+"resources/img/overhead-transformer.png"},function(e,t,n){e.exports=n.p+"resources/img/residence.png"},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/long-overhead-underground.png"},function(e,t,n){e.exports=n.p+"resources/img/long-overhead.png"},function(e,t,n){e.exports=n.p+"resources/img/long-underground-from-underground.png"},function(e,t,n){e.exports=n.p+"resources/img/long-underground.png"},function(e,t,n){e.exports=n.p+"resources/img/short-overhead.png"},function(e,t,n){e.exports=n.p+"resources/img/short-underground-from-underground.png"},function(e,t,n){e.exports=n.p+"resources/img/short-underground.png"},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/checkbox-checked.svg"},function(e,t,n){e.exports=n.p+"resources/img/checkbox-unchecked.svg"},function(e,t,n){e.exports=n.p+"resources/img/radio-checked.svg"},function(e,t,n){e.exports=n.p+"resources/img/radio-unchecked.svg"},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/randy-savage.jpg"},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/down-white.svg"},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/padmount-switch-cabinet.jpg"},function(e,t,n){e.exports=n.p+"resources/img/padmount-transformer-diagram.jpg"},function(e,t,n){e.exports=n.p+"resources/img/padmount-transformer.jpg"},function(e,t,n){e.exports=n.p+"resources/img/pole-with-transformer.jpg"},function(e,t,n){e.exports=n.p+"resources/img/pole-without-transformer-2.jpg"},function(e,t,n){e.exports=n.p+"resources/img/pole-without-transformer.jpg"},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/down-white.svg"},function(e,t,n){},function(e,t,n){},function(e,t,n){e.exports=n.p+"resources/img/big-salmon.svg"},function(e,t,n){e.exports=n.p+"resources/img/electric-vehicle.svg"},function(e,t,n){e.exports=n.p+"resources/img/led-bulb.svg"},function(e,t,n){e.exports=n.p+"resources/img/washing-machine.svg"},function(e,t,n){e.exports=n.p+"resources/img/weight-pound-filled.svg"},function(e,t,n){},function(e,t,n){}]);
/*
 *  This code allows all tables in AEM to have the ability to gain focus, 
 *  then when it has focus allows the arrow keys to move it horizontally.
 *
 *  NOTE: This JavaScript must be run after the tables are filled by 
 *    JavaScript.  Otherwise the keyboard navigation will be broken.
 */

// Determine if an element has a either a 'vertical' scrollbar or 
//   'horizontal' scrollbar.
function hasScrollBar(el, direction) {
    direction = (direction === 'vertical') ? 'scrollTop' : 'scrollLeft';
    var result = !! el[direction];

    if (!result) {
        el[direction] = 1;
        result = !!el[direction];
        el[direction] = 0;
    }
    return result;
}

// Make a table focusable if there is a scrollbar
function setTableTabIndex(table) {
	if (hasScrollBar(table, 'horizontal')) {  // Scroll bar is present
        table.tabIndex = 0;
    } else {
        table.tabIndex = -1;
    }
}

// Go through all tables to see whether they can gain focus
function checkTablesForScrollbar(e) {
    var tIndex;
    for (tIndex = 0; tIndex < tableList.length; ++tIndex) {
        var tableEntry = tableList[tIndex];
        setTableTabIndex(tableEntry);
    }
};

var resizeEventListenerAdded = false;
var tableList = [];

document.addEventListener('DOMContentLoaded', function() {
	// Set a 1 second delay to execute this code, since all tables should have been
    //   rendered with data by that time.
    setTimeout(function() {
	    // Make table's parent focusable when they have a scrollbar
		var tables = document.querySelectorAll('table');
    	var index;
        for (index = 0; index < tables.length; ++index) {
            var table = tables[index];

			var target = table.parentElement;
			
            // If the browser doesn't support IntersectionObserver (IE11),
            //   just set the tableIndex to 0.
            if (window.IntersectionObserver) {
				
				target.style.overflowX = "auto";  // Make all tables scrollable when screen is too small
                
                // Handle when the visibilty of table changes
                var observer = new IntersectionObserver(
                    function(entries) {
                        if (entries[0].intersectionRatio) {
                          setTableTabIndex(entries[0].target);
                        } else {
                          entries[0].target.tabIndex = -1;
                        }
                    }, 
                    {root: document.body}
                );
                observer.observe(target);
            
                // Handle when the table size changes
                setTableTabIndex(target);
                tableList.push(target);
                if (!resizeEventListenerAdded) {
                    resizeEventListenerAdded = true;
                    window.addEventListener('resize', checkTablesForScrollbar);
                }
            } else {
                target.tabIndex = 0;
            }
        };
	}, 1000);
}, false);
