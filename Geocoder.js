dojo.provide("esri.dijit.Geocoder");

// dependencies
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");
dojo.require("dojo.on");
dojo.require("esri.tasks.locator");

// Localization
dojo.requireLocalization("esriTemplate", "template");

// define the widget
dojo.declare("esri.dijit.Geocoder", [dijit._Widget, dijit._Templated], {

    templatePath: "templates/Geocoder.html",
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
        this.watch("theme", this._updateTheme);
        this.watch("activeGeocoder", this._setActiveGeocoder);
        this.watch("activeGeocoderIndex", this._changeGeocoder);
        this.watch("geocoder", this._insertGeocoderMenuItems);
    },

    // start widget
    startup: function () {
        // if all required options are set
        if (this.domNode && this.map) {
            // add clear button if already populated
            if (this.value) {
                this._checkStatus();
            }
            // if only 1 geocoder, destroy arrow node
            if (this.geocoderMenu && (this._geocoder.length < 2)) {
                dojo.destroy(this.geocoderMenuArrowNode);
            }
            // set positions for menus
            this._setMenuPositions();
            // setup connections
            this._setDelegations();
        }
    },

    // post create widget function
    postCreate: function () {
        this._insertGeocoderMenuItems();
    },

    // destroy widget
    destroy: function () {
        // remove html
        dojo.empty(this.domNode);
        // if delegations
        if (this._delegations) {
            // disconnect all events
            for (var i = 0; i < this._delegations.length; i++) {
                dojo.disconnect(this._delegations[i]);
            }
        }
    },

    /* ---------------- */
    /* Public Events */
    /* ---------------- */

    // called after search has been selected
    onSelect: function (result) {},

    // called on AC Init
    onStart: function () {},

    // called on AC Results
    onResults: function (results) {},

    /* ---------------- */
    /* Public Functions */
    /* ---------------- */

    // clear the input box
    clear: function () {
        // empty input value
        dojo.query(this.inputNode).attr('value', '');
        // set current text
        this.value = '';
        // empty results
        this.results = [];
        // get node of reset button and remove it's active class
        dojo.query(this.clearNode).removeClass(this._clearButtonActiveClass).attr('title', '');
        this._hideMenus();
        // hide loading
        this._hideLoading();
    },

    // show widget
    show: function () {
        dojo.query(this.domNode).style('display', 'block');
    },

    // hide widget
    hide: function () {
        dojo.query(this.domNode).style('display', 'none');
    },

    /* ---------------- */
    /* Private Functions */
    /* ---------------- */

    // sets current locator object
    _setActiveGeocoder: function () {
        if (this._geocoder && this._geocoder[this.activeGeocoderIndex]) {
            this.activeGeocoder = this._geocoder[this.activeGeocoderIndex];
        }
        else{
            this.activeGeocoder = {};
        }
    },

    // default settings
    _setPublicDefaults: function () {
        // Language
        this.i18n = dojo.i18n.getLocalization("esriTemplate", "template");
        // use esri geocoder
        this.esriGeocoder = true;
        // Geocoder country
        this.esriGeocoderCountry = 'USA';
        // public geocoder
        this.geocoder = null;
        // Value of input
        this.value = '';
        // Theme
        this.theme = 'esriTheme'; // flavor
        // Options
        this.activeGeocoderIndex = 0; // default geocoder index
        this.maxLocations = 6; // Maximum result locations to return
        this.minCharacters = 3; // Minimum amount of characters before searching
        this.searchDelay = 350; // Delay before doing the query. To avoid being too chatty.
        this.geocoderMenu = true;
    },

    // set variables that aren't to be modified
    _setPrivateVars: function () {
        // geocoder holder
        this._geocoder = [];
        // Esri global locator
        this._esriWorldGeocoder = '//geocodedev.arcgis.com/arcgis/rest/services/World/GeocodeServer';
        // results holder
        this.results = [];
        // if esri geocoder enabled
        if (this.esriGeocoder) {
            // add it to geocoder array
            this._geocoder.push({
                url: location.protocol + this._esriWorldGeocoder,
                name: this.i18n.Geocoder.geocoder.esriWorldGeocoderTitle,
                placeholder: this.i18n.Geocoder.geocoder.defaultPlaceholder,
                zoom: 12
            });
        }
        // set geocoder to array if string
        if (typeof this.geocoder === 'string') {
            this._geocoder.push({
                url: this.geocoder,
                name: this.i18n.Geocoder.geocoder.untitledGeocoder,
                placeholder: this.i18n.Geocoder.geocoder.defaultPlaceholder
            });
        } else { // geocoder is an object. hopefully an array!
            if(this.geocoder){
                // for each array item
                for (var i = 0; i < this.geocoder.length; i++) {
                    // add to private geocoder object
                    this._geocoder.push(this.geocoder[i]);
                }
            }
        }
        // update geocoder public property
        this.geocoder = this._geocoder;
        // set geocoder object
        this._setActiveGeocoder();
        // default place holder text
        this._placeholder = this.activeGeocoder.placeholder || '';
        // css classes
        this._GeocoderClass = 'esriGeocoder';
        this._GeocoderActiveClass = 'esriGeocoderActive';
        this._loadingClass = 'esriGeocoderLoading';
        this._resultsContainerClass = 'esriGeocoderResults';
        this._resultsItemClass = 'esriGeocoderResult';
        this._resultsItemEvenClass = 'esriGeocoderResultEven';
        this._resultsItemOddClass = 'esriGeocoderResultOdd';
        this._resultsPartialMatchClass = 'esriGeocoderResultPartial';
        this._searchButtonClass = 'esriGeocoderSearch';
        this._clearButtonClass = 'esriGeocoderReset';
        this._clearButtonActiveClass = 'esriGeocoderResetActive';
        this._geocoderMenuClass = 'esriGeocoderMenu';
        this._geocoderMenuHeaderClass = 'esriGeocoderMenuHeader';
        this._geocoderMenuCloseClass = 'esriGeocoderMenuClose';
        this._activeMenuClass = 'esriGeocoderMenuActive';
        this._geocoderMenuArrowClass = 'esriGeocoderMenuArrow';
        this._geocoderSelectedClass = 'esriGeocoderSelected';
        this._geocoderSelectedCheckClass = 'esriGeocoderSelectedCheck';
        this._GeocoderClearClass = 'esriGeocoderClearFloat';
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
        // position the menus
        dojo.query(this.geocoderMenuNode).style(params);
        dojo.query(this.resultsNode).style(params);
    },

    // update value of text box
    _updateValue: function (attr, oldVal, newVal) {
        dojo.query(this.inputNode).attr('value', newVal);
        this._checkStatus();
    },

    // update theme
    _updateTheme: function (attr, oldVal, newVal) {
        dojo.query(this.domNode).removeClass(oldVal).addClass(newVal);
    },

    // change active geocoder
    _changeGeocoder: function (attr, oldVal, newVal) {
        this.activeGeocoderIndex = newVal;
        // set geocoder object
        this._setActiveGeocoder();
        var placeholder = this.activeGeocoder.placeholder || '';
        this._hideMenus();
        dojo.query(this.inputNode).attr('placeholder', placeholder);
        dojo.query(this.inputNode).attr('title', placeholder);
        dojo.query(this.submitNode).attr('title', placeholder);
        this._insertGeocoderMenuItems();
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
    _showGeolocatorMenu: function () {
        // container node
        var container = dojo.query(this.containerNode);
        // add class to container
        container.addClass(this._activeMenuClass);
        // display menu node
        dojo.query(this.geocoderMenuNode).style('display', 'block');
        // aria
        dojo.query(this.geocoderMenuInsertNode).attr('aria-hidden', 'false');
        dojo.query(this.geocoderMenuArrowNode).attr('aria-expanded', 'true');
    },

    // hide geocoder selection menu
    _hideGeolocatorMenu: function () {
        // container node
        var container = dojo.query(this.containerNode);
        // add class to container
        container.removeClass(this._activeMenuClass);
        dojo.query(this.geocoderMenuNode).style('display', 'none');
        // aria
        dojo.query(this.geocoderMenuInsertNode).attr('aria-hidden', 'true');
        dojo.query(this.geocoderMenuArrowNode).attr('aria-expanded', 'false');
    },

    // toggle geocoder selection menu
    _toggleGeolocatorMenu: function () {
        this._hideResultsMenu();
        var display = dojo.query(this.geocoderMenuNode).style('display');
        if (display[0] === 'block') {
            this._hideGeolocatorMenu();
        } else {
            this._showGeolocatorMenu();
        }
    },

    // show autolocate menu
    _showResultsMenu: function () {
        // node of the search box container
        var container = dojo.query(this.containerNode);
        // add class to container
        container.addClass(this._GeocoderActiveClass);
        // show node
        dojo.query(this.resultsNode).style('display', 'block');
        // aria
        dojo.query(this.resultsNode).attr('aria-hidden', 'false');
    },

    // hide the results menu
    _hideResultsMenu: function () {
        // hide
        dojo.query(this.resultsNode).style('display', 'none');
        // add class to container
        dojo.query(this.containerNode).removeClass(this._GeocoderActiveClass);
        // aria
        dojo.query(this.resultsNode).attr('aria-hidden', 'true');
    },

    // hide both menus
    _hideMenus: function () {
        this._hideGeolocatorMenu();
        this._hideResultsMenu();
    },

    // create menu for changing active geocoder
    _insertGeocoderMenuItems: function () {
        if (this._geocoder.length > 1) {
            if (this.geocoderMenuInsertNode) {
                var html = '';
                html += '<ul role="presentation">';
                // for each result
                for (var i = 0; i < this._geocoder.length; i++) {
                    // set layer class
                    var layerClass = this._resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += this._resultsItemOddClass;
                    } else {
                        layerClass += this._resultsItemEvenClass;
                    }
                    if (i === this.activeGeocoderIndex) {
                        layerClass += ' ' + this._geocoderSelectedClass;
                    }
                    // geocoder name
                    var geocoderName = this._geocoder[i].name || this.i18n.Geocoder.geocoder.untitledGeocoder;
                    // create list item
                    html += '<li data-item="true" role="menuitem" tabindex="0" class="' + layerClass + '">';
                    html += '<div class="' + this._geocoderSelectedCheckClass + '"></div>';
                    html += geocoderName;
                    html += '<div class="' + this._GeocoderClearClass + '"></div>';
                    html += '</li>';
                }
                // close list
                html += '</ul>';
                this.geocoderMenuInsertNode.innerHTML = html;
            }
        }
        // set public geocoder
        this.geocoder = this._geocoder;
    },

    // check input box's status
    _checkStatus: function () {
        // if input value is not empty
        if (this.value) {
            // set class and title
            dojo.query(this.clearNode).addClass(this._clearButtonActiveClass).attr('title', this.i18n.Geocoder.main.clearButtonTitle);
        } else {
            // clear address
            this.clear();
        }
    },

    // insert results HTML and show
    _insertResultsMenuItems: function (results) {
        // hide menu to toggle geocoder
        this._hideGeolocatorMenu();
        // set results
        this.results = results;
        // field that holds address name
        var addressFieldName;
        // if using esri geocoder
        if (this._isEsriGeocoder(this.activeGeocoder)) {
            addressFieldName = 'name';
        } else {
            // set results
            addressFieldName = 'address';
        }
        // string to set
        var html = '';
        // if results and result node
        if (results && results.length > 0 && this.resultsNode) {
            // textbox value
            var partialMatch = this.value;
            // partial match highlight
            var regex = new RegExp('(' + partialMatch + ')', 'gi');
            html += '<ul role="presentation">';
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
                html += '<li data-text="' + results[i][addressFieldName] + '" data-item="true" data-result-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + results[i][addressFieldName].replace(regex, '<strong class="' + this._resultsPartialMatchClass + '">' + partialMatch + '</strong>') + '</li>';
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
            this._showResultsMenu();
            // results
            this.onResults(results);
        }
    },

    // set up connections
    _setDelegations: function () {
        // isntance of class
        var instance = this;
        // array of all connections
        this._delegations = [];
        // close on click
        var closeOnClick = dojo.connect(document, "onclick", this, "_hideResultsMenu");
        this._delegations.push(closeOnClick);
        // input key up
        var inputKeyUp = dojo.connect(this.inputNode, "onkeyup", this, "_inputKeyUp");
        this._delegations.push(inputKeyUp);
        // input key down
        var inputKeyDown = dojo.connect(this.inputNode, "onkeydown", this, "_inputKeyDown");
        this._delegations.push(inputKeyDown);
        // arrow key down
        var geocoderMenuButtonKeyDown = dojo.connect(this.geocoderMenuArrowNode, "onkeydown", this, "_geocoderMenuButtonKeyDown");
        this._delegations.push(geocoderMenuButtonKeyDown);
        // list item click
        var listClick = dojo.on(this.resultsNode, '[data-item="true"]:click, [data-item="true"]:keydown', function (event) {
            clearTimeout(instance._queryTimer);
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
                instance._select(instance.results, resultIndex);
                // hide menus
                instance._hideMenus();
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
                // clear timer
                clearTimeout(instance._queryTimer);
                // hide menus
                instance._hideMenus();
            }
        });
        this._delegations.push(listClick);
        // select geocoder item
        var geocoderMenuClick = dojo.on(this.geocoderMenuInsertNode, '[data-item="true"]:click, [data-item="true"]:keydown', function (event) {
            // all items
            var lists = dojo.query('[data-item="true"]', instance.geocoderMenuInsertNode);
            // index of current item
            var currentIndex = dojo.indexOf(lists, this);
            // next/previous index
            var newIndex;
            if (event.type === 'click' || (event.type === 'keydown' && event.keyCode === instance._enterKey)) { // if click or enter key pushed
                instance._changeGeocoder(null, null, currentIndex);
                instance._hideGeolocatorMenu();
            } else if (event.type === 'keydown' && event.keyCode === instance._upArrow) { // Up arrow key
                // go to previous item
                newIndex = currentIndex - 1;
                if (newIndex < 0) {
                    instance.geocoderMenuArrowNode.focus();
                } else {
                    lists[newIndex].focus();
                }
            } else if (event.type === 'keydown' && event.keyCode === instance._downArrow) { //Down arrow key
                // go to next item
                newIndex = currentIndex + 1;
                if (newIndex >= lists.length) {
                    instance.geocoderMenuArrowNode.focus();
                } else {
                    lists[newIndex].focus();
                }
            } else if (event.keyCode === instance._escKey) { // esc key
                instance._hideGeolocatorMenu();
            }
        });
        this._delegations.push(geocoderMenuClick);
    },

    // key up event on input box
    _inputKeyUp: function (event) {
        var instance = this;
        clearTimeout(this._queryTimer);
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
            this._query(this._select);
            // hide menus
            this._hideMenus();
            // if up arrow pushed
        } else if (event && event.keyCode === this._escKey) { // esc key
            // clear timer
            clearTimeout(this._queryTimer);
            // hide menus
            this._hideMenus();
        } else if (alength >= (this.minCharacters) && event && event.keyCode !== this._tabKey) {
            if (this.searchDelay) {
                // set timer for showing
                this._queryTimer = setTimeout(function () {
                    // query then show
                    instance._query(instance._insertResultsMenuItems);
                }, this.searchDelay);
            } else {
                // query then show
                instance._query(instance._insertResultsMenuItems);
            }
        } else {
            // hide menus
            this._hideMenus();
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

    // geocoder menu arrow key down
    _geocoderMenuButtonKeyDown: function (event) {
        var lists = dojo.query('[data-item="true"]', this.geocoderMenuInsertNode);
        if (event && event.keyCode === this._upArrow) {
            this._showGeolocatorMenu();
            // get list item length
            var listsLen = lists.length;
            // if not zero
            if (listsLen) {
                // go to previous list item
                lists[listsLen - 1].focus();
            }
        } else if (event && event.keyCode === this._downArrow) {
            this._showGeolocatorMenu();
            // if first item
            if (lists[0]) {
                // focus first item
                lists[0].focus();
            }
        }
    },

    // submit button selected
    _submit: function () {
        // query and then Locate
        this._query(this._select);
        // hide menus
        this._hideMenus();
    },

    // input box clicked
    _inputClick: function () {
        // hide geolocator switch
        this._hideGeolocatorMenu();
        // if input value is empty
        if (!this.value) {
            // clear address
            this.clear();
            // hide menus
            this._hideMenus();
        }
        // check status of text box
        this._checkStatus();
    },

    // If locator is the esri world locator
    _isEsriGeocoder: function (geocoder) {
        // if geocoder string is matched in url
        if (geocoder && geocoder.url.indexOf(this._esriWorldGeocoder) !== -1) {
            return true;
        }
        return false;
    },

    _getRadius: function () {
        var extent = this.map.extent;
        // get length of extent in meters
        var meters = esri.geometry.getLength(new esri.geometry.Point(extent.xmin, extent.ymin, map.spatialReference), new esri.geometry.Point(extent.xmax, extent.ymin, map.spatialReference));
        // get radius
        var radius = meters / 2;
        // round radius
        var rounded = Math.round(radius, 0);
        // return result
        return rounded;
    },

    // query for results and then execute a function
    _query: function (callback) {
        // if query isn't empty
        if (this.value) {
            // call start event
            this.onStart();
            // hide menu to toggle geocoder
            this._hideGeolocatorMenu();
            // show loading spinner
            this._showLoading();
            // query parameters
            var params;
            // Fields
            var outFields = this.activeGeocoder.outFields || '';
            // single line query
            var singleLine = '';
            // instance
            var instance = this;
            // query prefix
            if (this.activeGeocoder.prefix) {
                singleLine += this.activeGeocoder.prefix;
                singleLine += ' ';
            }
            // query value
            singleLine += this.value;
            // query postfix
            if (this.activeGeocoder.postfix) {
                singleLine += ' ';
                singleLine += this.activeGeocoder.postfix;
            }
            // if we can use the find function
            if (this._isEsriGeocoder(this.activeGeocoder)) {
                // get geographic center point
                var centerPoint = esri.geometry.webMercatorToGeographic(this.map.extent.getCenter());
                // Query object
                params = {
                    "text": singleLine,
                    "outSR": this.map.spatialReference.wkid,
                    "location": Math.round(centerPoint.x * 100)/100 + ',' + Math.round(centerPoint.y * 100)/100,
                    "distance": this._getRadius(),
                    "f": "json"
                };
                // if outfields
                if (outFields) {
                    params.outFields = outFields;
                }
                // if max locations set
                if (this.maxLocations) {
                    params.maxLocations = this.maxLocations;
                }
                // Esri Geocoder country
                if(this.esriGeocoderCountry){
                    params.sourceCountry = this.esriGeocoderCountry;
                }
                // local results only
                if (this.activeGeocoder.searchExtent) {
                    var bbox = {
                        "xmin": this.activeGeocoder.searchExtent.xmin,
                        "ymin": this.activeGeocoder.searchExtent.ymin,
                        "xmax": this.activeGeocoder.searchExtent.xmax,
                        "ymax": this.activeGeocoder.searchExtent.ymax,
                        "spatialReference": {
                            "wkid": this.activeGeocoder.searchExtent.spatialReference.wkid
                        }
                    };
                    params.bbox = dojo.toJson(bbox);
                }
                // send request
                var requestHandle = esri.request({
                    url: this.activeGeocoder.url + '/find',
                    content: params,
                    handleAs: 'json',
                    callbackParamName: 'callback',
                    // on load
                    load: function (response) {
                        if (typeof callback === 'function') {
                            // call callback function
                            callback.call(instance, response.locations);
                        }
                    }
                });
            } else {
                // Params
                params = {
                    address: {
                        "singleLine": singleLine
                    }
                };
                // if outfields
                if (outFields) {
                    params.outFields = [outFields];
                }
                // within extent
                if (this.activeGeocoder.searchExtent) {
                    params.searchExtent = this.activeGeocoder.searchExtent;
                }
                // Geocoder
                this._geocoder = new esri.tasks.Locator(this.activeGeocoder.url);
                this._geocoder.outSpatialReference = this.map.spatialReference;
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
        }
    },

    // locate geocoder result
    _selectResult: function (result) {
        // if result has attributes
        if (result) {
            // new locator
            if (result.hasOwnProperty('extent')) {
                // create extent
                var extent = new esri.geometry.Extent(result.extent);
                // set map extent to location
                this.map.setExtent(extent);
            } else {
                // if zoom set in geocodoer object
                if (this.activeGeocoder.zoom) {
                    // use point and zoom
                    this.map.centerAndZoom(result.location, this.activeGeocoder.zoom);
                } else {
                    // use point
                    this.map.centerAt(result.location);
                }
            }
            // on search call
            this.onSelect(result);
        }
    },

    // go to a location
    _select: function (results, resultNumber) {
        // save results
        this.results = results;
        // if we have results
        if (results.length > 0) {
            // selected result
            var numResult = resultNumber || 0;
            // result object
            var result = results[numResult];
            // locate result
            this._selectResult(result);
        } else {
            // clear address box
            this.clear();
        }
        // hide menus
        this._hideMenus();
        // hide loading spinner
        this._hideLoading();
    }

});