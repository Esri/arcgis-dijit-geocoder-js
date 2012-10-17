dojo.provide("esri.dijit.Autocomplete");

// dependencies
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");
dojo.require("dojo.on");
dojo.require("esri.tasks.locator");

// define the autocomplete widget
dojo.declare("esri.dijit.Autocomplete", [dijit._Widget, dijit._Templated], {

    templatePath: "templates/Autocomplete.html",
    widgetsInTemplate: false,

    // init
    constructor: function (options, srcRefNode) {
        // set default settings
        this._setPublicDefaults();
        // mix in settings and defaults
        dojo.safeMixin(this, options);
        // private variables
        this._setPrivateVars();
        // watch updates of public properties and update the widget accordingly
        this.watch("value", this._updateValue);
        this.watch("placeholder", this._updatePlaceholder);
        this.watch("resetTitle", this._updateResetTitle);
        this.watch("theme", this._updateTheme);
        this.watch("activeGeocoder", this._updateActiveGeocoder);
        this.watch("geocoder", this._createGeocoderMenu);
    },

    // start widget
    startup: function () {
        // if all required options are set
        if (this.domNode && this.map) {
            if (this.value) {
                this._checkStatus();
            }
            if (this.geocoderMenu && (this.geocoder.length < 2 || typeof this.geocoder === 'string')) {
                dojo.destroy(this.geocoderMenuArrowNode);
            }
            this._setMenuPositions();
            // setup connections
            this._setDelegations();
        }
    },

    // post create widget function
    postCreate: function () {
        this._createGeocoderMenu();
    },

    // destroy widget
    destroy: function () {
        // remove html
        dojo.empty(this.domNode);
        // if delegations
        if (this.delegations) {
            // disconnect all events
            for (var i = 0; i < this.delegations.length; i++) {
                dojo.disconnect(this.delegations[i]);
            }
        }
    },

    /* ---------------- */
    /* Public Functions */
    /* ---------------- */

    // called after search
    onLocate: function (result) {},

    // called on AC Init
    onAutocomplete: function () {},

    // called on AC Results
    onAutocompleteResults: function (results) {},

    // clear autocomplete address
    clear: function () {
        this._clearAddress();
    },

    // hide results
    hide: function () {
        this._hide();
    },

    /* ---------------- */
    /* Private Functions */
    /* ---------------- */

    // default settings
    _setPublicDefaults: function () {
        // geocoder
        this.geocoder = location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
        // Value of input
        this.value = '';
        // Language
        this.placeholder = '';
        this.resetTitle = '';
        this.toggleGeocoderTitle = '';
        // Theme
        this.theme = 'esriAutocomplete'; // flavor
        // Options
        this.activeGeocoder = 0; // default geocoder index
        this.maxLocations = 6; // Maximum result locations to return
        this.minCharacters = 3; // Minimum amount of characters before searching
        this.hideDelay = 6000; // Hide autocomplete that's been active for this long
        this.searchDelay = 300; // Delay before doing the autocomplete query. To avoid being too chatty.
        this.zoom = 12;
        this.searchExtent = false; // Contain searches within bounding box
        this.geocoderMenu = true;
    },

    // set variables that aren't to be modified
    _setPrivateVars: function () {
        // results holder
        this.results = [];
        // css classes
        this._autoCompleteClass = 'esriAc';
        this._autoCompleteActiveClass = 'esriAcActive';
        this._loadingClass = 'esriAcLoading';
        this._resultsContainerClass = 'esriAcResults';
        this._resultsItemClass = 'esriAcResult';
        this._resultsItemEvenClass = 'esriAcResultEven';
        this._resultsItemOddClass = 'esriAcResultOdd';
        this._resultsPartialMatchClass = 'esriAcResultPartial';
        this._searchButtonClass = 'esriAcSearch';
        this._clearButtonClass = 'esriAcReset';
        this._clearButtonActiveClass = 'esriAcResetActive';
        this._geocoderMenuClass = 'esriAcMenu';
        this._geocoderMenuActiveClass = 'esriAcMenuActive';
        this._geocoderMenuArrowClass = 'esriAcMenuArrow';
        this._geocoderSelectedClass = 'esriAcSelected';
        this._autoCompleteClearClass = 'esriAcClearFloat';
        // keys
        this._enterKey = 13;
        this._escKey = 27;
        this._tabKey = 9;
        this._shiftKey = 16;
        this._leftArrow = 37;
        this._upArrow = 38;
        this._rightArrow = 39;
        this._downArrow = 40;
    },

    // set CSS position of menus
    _setMenuPositions: function () {
        var container = dojo.query(this.containerNode);
        // position and height of the search box
        var position = dojo.position(container[0]);
        // set params
        var params = {
            'top': position.h + 'px'
        };
        // position the autocomplete
        dojo.query(this.geocoderMenuNode).style(params);
        dojo.query(this.resultsNode).style(params);
    },

    // update value of text box
    _updateValue: function (attr, oldVal, newVal) {
        dojo.query(this.inputNode).attr('value', newVal);
        this._checkStatus();
    },

    // update input placeholder
    _updatePlaceholder: function (attr, oldVal, newVal) {
        dojo.query(this.inputNode).attr('placeholder', newVal);
        dojo.query(this.inputNode).attr('title', newVal);
        dojo.query(this.submitNode).attr('title', newVal);
    },

    // update clear title
    _updateResetTitle: function (attr, oldVal, newVal) {
        dojo.query(this.clearNode).attr('title', newVal);
    },

    // update theme
    _updateTheme: function (attr, oldVal, newVal) {
        dojo.query(this.domNode).removeClass(oldVal).addClass(newVal);
    },

    // change active geocoder
    _changeGeocoder: function (value) {
        this.activeGeocoder = value;
        this._updateActiveGeocoder();
        this._createGeocoderMenu();
    },

    // change active geocoder
    _updateActiveGeocoder: function () {
        this._hide();
    },

    // show loading spinner
    _showLoading: function () {
        dojo.query(this.clearNode).addClass(this._loadingClass);
    },

    // hide loading spinner
    _hideLoading: function () {
        dojo.query(this.clearNode).removeClass(this._loadingClass);
    },

    // show geocoder selection menu
    _showGeocoderMenu: function () {
        // clear timer
        clearTimeout(this.hideTimer);
        // container node
        var container = dojo.query(this.containerNode);
        // add class to container
        container.addClass(this._geocoderMenuActiveClass);
        // display menu node
        dojo.query(this.geocoderMenuNode).style('display', 'block');
    },

    // hide geocoder selection menu
    _hideGeocoderMenu: function () {
        var container = dojo.query(this.containerNode);
        // add class to container
        container.removeClass(this._geocoderMenuActiveClass);
        dojo.query(this.geocoderMenuNode).style('display', 'none');
    },

    // toggle geocoder selection menu
    _toggleGeocoderMenu: function () {
        this._hide();
        var display = dojo.query(this.geocoderMenuNode).style('display');
        if (display[0] === 'block') {
            this._hideGeocoderMenu();
        } else {
            this._showGeocoderMenu();
        }
    },

    // create menu for changing active geocoder
    _createGeocoderMenu: function () {
        if (this.geocoder.length > 1 && typeof this.geocoder !== 'string') {
            if (this.geocoderMenuNode) {
                var html = '';
                html += '<ul>';
                // for each result
                for (var i = 0; i < this.geocoder.length; i++) {
                    // set layer class
                    var layerClass = this._resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += this._resultsItemOddClass;
                    } else {
                        layerClass += this._resultsItemEvenClass;
                    }
                    if (i === this.activeGeocoder) {
                        layerClass += ' ' + this._geocoderSelectedClass;
                    }
                    // create list item
                    html += '<li data-item="true" role="menuitem" tabindex="0" class="' + layerClass + '">' + this.geocoder[i].name + '</li>';
                }
                // close list
                html += '</ul>';
                this.geocoderMenuNode.innerHTML = html;
            }
        }
    },

    // clear the input box
    _clearAddress: function () {
        // empty input value
        dojo.query(this.inputNode).attr('value', '');
        // set current text
        this.value = '';
        // empty results
        this.results = [];
        // get node of reset button and remove it's active class
        dojo.query(this.clearNode).removeClass(this._clearButtonActiveClass).attr('title', '');
    },

    // check input box's status
    _checkStatus: function () {
        // if input value is not empty
        if (this.value) {
            // set class and title
            dojo.query(this.clearNode).addClass(this._clearButtonActiveClass).attr('title', this.resetTitle);
        } else {
            // clear address
            this._clearAddress();
        }
    },

    // clear auto hide timer and reset it
    _resetHideTimer: function () {
        if (this.hideDelay) {
            clearTimeout(this.hideTimer);
            var instance = this;
            this.hideTimer = setTimeout(function () {
                instance._hide();
            }, this.hideDelay);
        }
    },

    // insert results HTML and show
    _insertGeocoderResults: function (results) {
        // reset timer
        this._resetHideTimer();
        // set results
        this.results = results;
        // string to set
        var html = '';
        // if results and result node
        if (results && results.length > 0 && this.resultsNode) {
            // textbox value
            var partialMatch = this.value;
            // partial match highlight
            var regex = new RegExp('(' + partialMatch + ')', 'gi');
            html += '<ul>';
            // for each result
            for (var i = 0; i < results.length && i < this.maxLocations; ++i) {
                // set layer class
                var layerClass = this._resultsItemClass + ' ';
                // if it's odd
                if (i % 2 === 0) {
                    // set it to odd
                    layerClass += this._resultsItemOddClass;
                } else {
                    layerClass += this._resultsItemEvenClass;
                }
                // create list item
                html += '<li data-text="' + results[i].address + '" data-item="true" data-result-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + results[i].address.replace(regex, '<strong class="' + this._resultsPartialMatchClass + '">' + partialMatch + '</strong>') + '</li>';
            }
            // close list
            html += '</ul>';
            // insert HTML
            if (this.resultsNode) {
                this.resultsNode.innerHTML = html;
            }
            // hide loading
            this._hideLoading();
            // show!
            this._show();
            // autocomplete results
            this.onAutocompleteResults(results);
        }
    },

    // show autolocate menu
    _show: function () {
        this.map.container.blur();
        // node of the search box container
        var container = dojo.query(this.containerNode);
        // add class to container
        container.addClass(this._autoCompleteActiveClass);
        // clear hide timer
        this._resetHideTimer();
        // show node
        dojo.query(this.resultsNode).style('display', 'block');
    },

    // autolocate and query
    _autoLocate: function () {
        // query active geocoder
        this._query(this._insertGeocoderResults);
        // call autocomplete event
        this.onAutocomplete();
    },

    // set up connections
    _setDelegations: function () {
        // isntance of class
        var instance = this;
        // array of all connections
        this.delegations = [];
        // close on click
        var closeOnClick = dojo.connect(document, "onclick", this, "_hide");
        this.delegations.push(closeOnClick);
        // search button key
        var searchButton = dojo.connect(this.submitNode, "onkeyup", this, "_submitSearch");
        this.delegations.push(searchButton);
        // clear button key
        var clearButton = dojo.connect(this.clearNode, "onkeyup", this, "_clearAutocomplete");
        this.delegations.push(clearButton);
        // input key up
        var inputKeyUp = dojo.connect(this.inputNode, "onkeyup", this, "_inputKeyUp");
        this.delegations.push(inputKeyUp);
        // input key down
        var inputKeyDown = dojo.connect(this.inputNode, "onkeydown", this, "_inputKeyDown");
        this.delegations.push(inputKeyDown);
        // hover over results, reset timer
        var widgetHover = dojo.on(this.resultsNode, '[data-item="true"]:mousemove', function (event) {
            // stop results from hiding
            instance._resetHideTimer();
        });
        this.delegations.push(widgetHover);
        // list item click
        var listClick = dojo.on(this.resultsNode, '[data-item="true"]:click, [data-item="true"]:keydown', function (event) {
            // clear timers
            instance._resetHideTimer();
            clearTimeout(instance.showTimer);
            // all items
            var lists = dojo.query('[data-item="true"]', instance.resultsNode);
            // index of current item
            var currentIndex = dojo.indexOf(lists, this);
            // input box text
            var locTxt = dojo.query(this).attr('data-text');
            // next/previous index
            var newIndex;
            if (event.type === 'click' || (event.type === 'keydown' && event.keyCode === instance._enterKey)) { // if click or enter key pushed
                // index of the geocoder to locate with
                var geocoderIndex = parseInt(dojo.query(this).attr('data-geocoder-index')[0], 10);
                // index of this list item
                var resultIndex = parseInt(dojo.query(this).attr('data-result-index')[0], 10);
                // set input text value to this text
                dojo.query(instance.inputNode).attr('value', locTxt);
                // set current text var
                instance.value = locTxt;
                // Locate
                instance._locate(instance.results, resultIndex);
                // hide autocomplete
                instance._hide();
            } else if (event.type === 'keydown' && event.keyCode === instance._upArrow) { // Up arrow key
                // go to previous item
                newIndex = currentIndex - 1;
                if (newIndex < 0) {
                    instance.inputNode.focus();
                } else {
                    lists[newIndex].focus();
                }
            } else if (event.type === 'keydown' && event.keyCode === instance._downArrow) { //Down arrow key
                // go to next item
                newIndex = currentIndex + 1;
                if (newIndex >= lists.length) {
                    instance.inputNode.focus();
                } else {
                    lists[newIndex].focus();
                }
            } else if (event.keyCode === instance._escKey) { // esc key
                // clear timers
                clearTimeout(instance.hideTimer);
                clearTimeout(instance.showTimer);
                // hide autocomplete
                instance._hide();
            }
        });
        this.delegations.push(listClick);
        // select geocoder item
        var geocoderMenuClick = dojo.on(this.geocoderMenuNode, '[data-item="true"]:click', function (event) {
            // all items
            var lists = dojo.query('[data-item="true"]', instance.geocoderMenuNode);
            // index of current item
            var currentIndex = dojo.indexOf(lists, this);
            instance._changeGeocoder(currentIndex);
            instance._hideGeocoderMenu();
        });
        this.delegations.push(geocoderMenuClick);
    },

    // key up event on input box
    _inputKeyUp: function (event) {
        // clear timers
        this._resetHideTimer();
        clearTimeout(this.showTimer);
        // get textbox value
        var aquery = this.inputNode.value;
        // update current text variable
        this.value = aquery;
        // length of value
        var alength = 0;
        // if value
        if (aquery) {
            // set length of value
            alength = aquery.length;
        }
        var lists = dojo.query('[data-item="true"]', this.resultsNode);
        if (event && event.keyCode === this._tabKey || event.keyCode === this._shiftKey || event.keyCode === this._upArrow || event.keyCode === this._downArrow || event.keyCode === this._leftArrow || event.keyCode === this._rightArrow) {
            return;
        } else if (event && event.keyCode === this._enterKey) { // if enter key was pushed
            // query then Locate
            this._query(this._locate);
            // hide autocomplete
            this._hide();
            // if up arrow pushed
        } else if (event && event.keyCode === this._escKey) { // esc key
            // clear timers
            clearTimeout(this.hideTimer);
            clearTimeout(this.showTimer);
            // hide autocomplete
            this._hide();
        } else if (alength >= (this.minCharacters) && event && event.keyCode !== this._tabKey) {
            if (this.searchDelay) {
                var instance = this;
                // set timer for showing
                this.showTimer = setTimeout(function () {
                    // query then show autocomplete
                    instance._autoLocate();
                }, this.searchDelay);
            } else {
                // query then show autocomplete
                this._autoLocate();
            }
        } else {
            // hide autocomplete
            this._hide();
        }
        // check status of search box
        this._checkStatus();
    },

    // key down event on input box
    _inputKeyDown: function (event) {
        var lists = dojo.query('[data-item="true"]', this.resultsNode);
        if (event && event.keyCode === this._upArrow) {
            // get list item length
            var listsLen = lists.length;
            // if not zero
            if (listsLen) {
                // go to previous list item
                lists[listsLen - 1].focus();
            }
        } else if (event && event.keyCode === this._downArrow) {
            // if first item
            if (lists[0]) {
                // focus first item
                lists[0].focus();
            }
        }
    },

    // submit button selected
    _submitSearch: function (event) {
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === this._enterKey)) {
            // query and then Locate
            this._query(this._locate);
            // hide autocomplete
            this._hide();
        }
    },

    // input box clicked
    _inputClick: function () {
        // if input value is empty
        if (!this.value) {
            // clear address
            this._clearAddress();
            // hide autocomplete
            this._hide();
        }
        // check status of text box
        this._checkStatus();
    },

    // reset autocomplete box
    _clearAutocomplete: function (event) {
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === this._enterKey)) {
            // hide autocomplete
            this._hide();
            // clear address
            this._clearAddress();
            // hide loading
            this._hideLoading();
        }
    },

    // hide the autocomplete
    _hide: function () {
        // hide
        dojo.query(this.resultsNode).style('display', 'none');
        // add class to container
        dojo.query(this.containerNode).removeClass(this._autoCompleteActiveClass);
        // empty results
        dojo.empty(this.resultsNode);
    },

    // query for results and then execute a function
    _query: function (callback) {
        // if query isn't empty
        if (this.value) {
            this._hideGeocoderMenu();
            // show loading spinner
            this._showLoading();
            // Params
            var params = {
                address: {
                    "singleLine": this.value
                },
                outFields: ["*"]
            };
            // within extent
            if (this.searchExtent) {
                params.searchExtent = this.searchExtent;
            }
            // Geocoder
            if (typeof this.geocoder === 'string') {
                this._geocoder = new esri.tasks.Locator(this.geocoder);
            } else {
                this._geocoder = new esri.tasks.Locator(this.geocoder[this.activeGeocoder].url);
            }
            this._geocoder.outSpatialReference = this.map.spatialReference;
            // instance
            var instance = this;
            // query for location
            this._geocoder.addressToLocations(params, function (response) {
                if (typeof callback === 'function') {
                    // call callback function
                    callback.call(instance, response);
                }
            }, function (response) {
                if (typeof callback === 'function') {
                    // call callback function
                    callback.call(instance, response);
                }
            });
        }
    },

    // locate geocoder result
    _locateResult: function (result) {
        // if result has attributes
        if (result) {
            var extent;
            if (result.attributes && result.attributes.hasOwnProperty('Xmin') && result.attributes.hasOwnProperty('Ymin') && result.attributes.hasOwnProperty('Xmax') && result.attributes.hasOwnProperty('Ymax')) {
                // if result has extent attributes
                // new extent
                extent = new esri.geometry.Extent({
                    "xmin": result.attributes.Xmin,
                    "ymin": result.attributes.Ymin,
                    "xmax": result.attributes.Xmax,
                    "ymax": result.attributes.Ymax,
                    "spatialReference": this.map.spatialReference
                });
                // set map extent to location
                this.map.setExtent(esri.geometry.geographicToWebMercator(extent));
            } else if (result.attributes && result.attributes.hasOwnProperty('westLon') && result.attributes.hasOwnProperty('southLat') && result.attributes.hasOwnProperty('eastLon') && result.attributes.hasOwnProperty('northLat')) {
                // result has lat/lon extent attributes
                // new extent
                extent = new esri.geometry.Extent({
                    "xmin": result.attributes.westLon,
                    "ymin": result.attributes.southLat,
                    "xmax": result.attributes.eastLon,
                    "ymax": result.attributes.northLat,
                    "spatialReference": this.map.spatialReference
                });
                // set map extent to location
                this.map.setExtent(esri.geometry.geographicToWebMercator(extent));
            } else {
                // use point
                this.map.centerAndZoom(result.location, this.zoom);
            }
            // on search call
            this.onLocate(result);
        }
    },

    // go to a location
    _locate: function (results, resultNumber) {
        // save results
        this.results = results;
        // if we have results
        if (results.length > 0) {
            // selected result
            var numResult = resultNumber || 0;
            // result object
            var result = results[numResult];
            // locate result
            this._locateResult(result);
        } else {
            // clear address box
            this._clearAddress();
        }
        // hide autocomplete
        this._hide();
        // hide loading spinner
        this._hideLoading();
    }

});