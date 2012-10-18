dojo.provide("esri.dijit.Autocomplete");

// dependencies
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");
dojo.require("dojo.on");
dojo.require("esri.tasks.locator");

// Localization
dojo.requireLocalization("esriTemplate", "template");

// define the autocomplete widget
dojo.declare("esri.dijit.Autocomplete", [dijit._Widget, dijit._Templated], {

    templatePath: "templates/Autocomplete.html",
    widgetsInTemplate: false,

    // init
    constructor: function (options, srcRefNode) {
        // Esri global locator
        this._esriWorldGeocoder = '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
        // set default settings
        this._setPublicDefaults();
        // mix in settings and defaults
        dojo.safeMixin(this, options);
        // private variables
        this._setPrivateVars();
        // watch updates of public properties and update the widget accordingly
        this.watch("value", this._updateValue);
        this.watch("theme", this._updateTheme);
        this.watch("activeGeocoderIndex", this._changeGeocoder);
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
        if (this._delegations) {
            // disconnect all events
            for (var i = 0; i < this._delegations.length; i++) {
                dojo.disconnect(this._delegations[i]);
            }
        }
    },

    /* ---------------- */
    /* Public Functions */
    /* ---------------- */
    getActiveGeocoder: function(){
        if(this.geocoder && this.geocoder[this.activeGeocoderIndex]){
            return this.geocoder[this.activeGeocoderIndex];
        }
        return {};
    },

    // called after search has been selected
    onSelect: function (result) {},

    // called on AC Init
    onAutocompleteStart: function () {},

    // called on AC Results
    onAutocompleteResults: function (results) {},

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
        this.geocoder = [
            {
                url: location.protocol + this._esriWorldGeocoder,
                name: 'World Geocode Server',
                placeholder: 'Find Address or Place',
                zoom: 12
            }
        ];
        // Value of input
        this.value = '';
        // Language
        this.i18n = dojo.i18n.getLocalization("esriTemplate", "template");
        // Theme
        this.theme = 'esriAutocomplete'; // flavor
        // Options
        this.activeGeocoderIndex = 0; // default geocoder index
        this.maxLocations = 6; // Maximum result locations to return
        this.minCharacters = 3; // Minimum amount of characters before searching
        this.hideDelay = 6000; // Hide autocomplete that's been active for this long
        this.searchDelay = 350; // Delay before doing the autocomplete query. To avoid being too chatty.
        this.geocoderMenu = true;
    },

    // set variables that aren't to be modified
    _setPrivateVars: function () {
        // results holder
        this.results = [];
        // set geocoder to array if string
        if(typeof this.geocoder === 'string'){
            this.geocoder = [
                {
                    url: this.geocoder,
                    name: 'World Geocode Server',
                    placeholder: 'Find Address or Place',
                }
            ];
        }
        var currentGeocoder = this.getActiveGeocoder();
        // default place holder text
        this._placeholder = currentGeocoder.placeholder || '';
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

    // update theme
    _updateTheme: function (attr, oldVal, newVal) {
        dojo.query(this.domNode).removeClass(oldVal).addClass(newVal);
    },

    // change active geocoder
    _changeGeocoder: function (attr, oldVal, newVal) {
        this.activeGeocoderIndex = newVal;
        var currentGeocoder = this.getActiveGeocoder();
        var placeholder = currentGeocoder.placeholder || '';
        this._hide();
        dojo.query(this.inputNode).attr('placeholder', placeholder);
        dojo.query(this.inputNode).attr('title', placeholder);
        dojo.query(this.submitNode).attr('title', placeholder);
        this._createGeocoderMenu();
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
                    if (i === this.activeGeocoderIndex) {
                        layerClass += ' ' + this._geocoderSelectedClass;
                    }
                    // geocoder name
                    var geocoderName = this.geocoder[i].name || 'Untitled geocoder';
                    // create list item
                    html += '<li data-item="true" role="menuitem" tabindex="0" class="' + layerClass + '">' + geocoderName + '</li>';
                }
                // close list
                html += '</ul>';
                this.geocoderMenuNode.innerHTML = html;
            }
        }
    },

    // check input box's status
    _checkStatus: function () {
        // if input value is not empty
        if (this.value) {
            // set class and title
            dojo.query(this.clearNode).addClass(this._clearButtonActiveClass).attr('title', this.i18n.Autocomplete.main.clearButtonTitle);
        } else {
            // clear address
            this.clear();
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
        // current geocoder
        var currentGeocoder = this.getActiveGeocoder();
        // field that holds address name
        var addressFieldName;
        // if using esri geocoder
        if(this._isEsriGeocoder(currentGeocoder)){
            addressFieldName = 'name';
        }
        else{
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
        this.onAutocompleteStart();
    },

    // set up connections
    _setDelegations: function () {
        // isntance of class
        var instance = this;
        // array of all connections
        this._delegations = [];
        // close on click
        var closeOnClick = dojo.connect(document, "onclick", this, "_hide");
        this._delegations.push(closeOnClick);
        // search button key
        var searchButton = dojo.connect(this.submitNode, "onkeyup", this, "_submitSearch");
        this._delegations.push(searchButton);
        // clear button key
        var clearButton = dojo.connect(this.clearNode, "onkeyup", this, "_clearAutocomplete");
        this._delegations.push(clearButton);
        // input key up
        var inputKeyUp = dojo.connect(this.inputNode, "onkeyup", this, "_inputKeyUp");
        this._delegations.push(inputKeyUp);
        // input key down
        var inputKeyDown = dojo.connect(this.inputNode, "onkeydown", this, "_inputKeyDown");
        this._delegations.push(inputKeyDown);
        // hover over results, reset timer
        var widgetHover = dojo.on(this.resultsNode, '[data-item="true"]:mousemove', function (event) {
            // stop results from hiding
            instance._resetHideTimer();
        });
        this._delegations.push(widgetHover);
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
        this._delegations.push(listClick);
        // select geocoder item
        var geocoderMenuClick = dojo.on(this.geocoderMenuNode, '[data-item="true"]:click', function (event) {
            // all items
            var lists = dojo.query('[data-item="true"]', instance.geocoderMenuNode);
            // index of current item
            var currentIndex = dojo.indexOf(lists, this);
            instance._changeGeocoder(null, null, currentIndex);
            instance._hideGeocoderMenu();
        });
        this._delegations.push(geocoderMenuClick);
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
            this.clear();
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
            this.clear();
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

    _isEsriGeocoder: function(geocoder){
        // if geocoder string is matched in url
        if(geocoder && geocoder.url.indexOf(this._esriWorldGeocoder) !== -1){
            return true;
        }
        return false;
    },

    // query for results and then execute a function
    _query: function (callback) {
        // if query isn't empty
        if (this.value) {
            // hide menu to toggle geocoder
            this._hideGeocoderMenu();
            // show loading spinner
            this._showLoading();
            // current geocoder
            var currentGeocoder = this.getActiveGeocoder();
            // query parameters
            var params;
            // Fields
            var outFields = currentGeocoder.outFields || '';
            // single line query
            var singleLine = '';
            // instance
            var instance = this;
            // query prefix
            if(currentGeocoder.prefix){
                singleLine += currentGeocoder.prefix;
                singleLine += ' ';
            }
            // query value
            singleLine += this.value;
            // query postfix
            if(currentGeocoder.postfix){
                singleLine += ' ';
                singleLine += currentGeocoder.postfix;
            }
            // if we can use the find function
            if(this._isEsriGeocoder(currentGeocoder)){
                // Query object
                params = {
                    "text": singleLine,
                    "outSR": this.map.spatialReference.wkid,
                    "f": "json"
                };
                // if max locations set
                if (this.maxLocations) {
                    params.maxLocations = this.maxLocations;
                }
                // local results only
                if (currentGeocoder.searchExtent) {
                    var bbox = {
    					"xmin": currentGeocoder.searchExtent.xmin,
    					"ymin": currentGeocoder.searchExtent.ymin,
    					"xmax": currentGeocoder.searchExtent.xmax,
    					"ymax": currentGeocoder.searchExtent.ymax,
    					"spatialReference": {
    						"wkid": currentGeocoder.searchExtent.spatialReference.wkid
    					}
                    };
                    params.bbox = dojo.toJson(bbox);
                }
                // send request
                var requestHandle = esri.request({
                    url: currentGeocoder.url + '/find',
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
            }
            else{
                // Params
                params = {
                    address: {
                        "singleLine": singleLine
                    },
                    outFields: [outFields]
                };
                // within extent
                if (currentGeocoder.searchExtent) {
                    params.searchExtent = currentGeocoder.searchExtent;
                }
                // Geocoder
                this._geocoder = new esri.tasks.Locator(currentGeocoder.url);
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
    _locateResult: function (result) {
        // if result has attributes
        if (result) {
            // new locator
            if(result.hasOwnProperty('extent')){
                // create extent
                var extent = new esri.geometry.Extent(result.extent);
                // set map extent to location
                this.map.setExtent(extent);
            }
            else {
                // get active geocoder object
                var currentGeocoder = this.getActiveGeocoder();
                // if zoom set in geocodoer object
                if(currentGeocoder.zoom){
                    // use point and zoom
                    this.map.centerAndZoom(result.location, currentGeocoder.zoom);
                }
                else{
                    // use point
                    this.map.centerAt(result.location);
                }
            }
            // on search call
            this.onSelect(result);
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
            this.clear();
        }
        // hide autocomplete
        this._hide();
        // hide loading spinner
        this._hideLoading();
    }

});