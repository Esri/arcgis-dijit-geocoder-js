define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/Deferred",
    "dojo/_base/event",
    "dojo/dom-attr",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/json",
    "dojo/keys",
    "dojo/on",
    "dojo/query",
	//"dojo/i18n!esri/nls/jsapi",
    //"dojo/text!esri/dijit/templates/Geocoder.html",
    "dojo/i18n!./nls/jsapi",
    "dojo/text!./templates/Geocoder.html",
    "dojo/uacss",

    "dijit/_OnDijitClickMixin",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetBase",
    "dijit/focus",

    "esri/kernel",
    "esri/SpatialReference",
    "esri/graphic",
    "esri/request",
    "esri/dijit/_EventedWidget",

    "esri/geometry/Point",
    "esri/geometry/Extent",
    "esri/tasks/locator"
],
function(
declare, lang, Deferred, event, domAttr, domClass, domStyle, domConstruct, JSON, keys, on, query, i18n, template, has,
_OnDijitClickMixin, _TemplatedMixin, _WidgetBase, focusUtil,
esriNS, SpatialReference, Graphic, esriRequest, _EventedWidget,
Point, Extent, Locator) {
    var Widget = declare([_EventedWidget, /*_WidgetBase,*/ _OnDijitClickMixin, _TemplatedMixin], {
        declaredClass: "esri.dijit.Geocoder",
        // Set template file HTML
        templateString: template,
        // On to Connect Event Mapping
        _eventMap: {
            "select": ["result"],
            "find-results": ["results"],
            "auto-complete": ["results"],
            "geocoder-select": ["geocoder"],
            "clear": true,
            "enter-key-select": true,
            "load": true
        },
        // init
        constructor: function(options, srcRefNode) {
            // set default settings
            this._setPublicDefaults();
            // mix in settings and defaults
            declare.safeMixin(this, options);
            // private variables
            this._setPrivateDefaults();
            // watch updates of public properties and update the widget accordingly
            this.watch("value", this._updateValue);
            this.watch("theme", this._updateTheme);
            this.watch("activeGeocoder", this._setActiveGeocoder);
            this.watch("activeGeocoderIndex", this._setActiveGeocoderIndex);
            this.watch("geocoder", this._updateGeocoder);
            this.watch("arcgisGeocoder", this._updateGeocoder);
            // widget node
            this.domNode = srcRefNode;
        },
        /* ---------------- */
        /* Public Functions */
        /* ---------------- */
        // start widget
        startup: function() {
            if (!this._geocoders.length) {
                console.log('No geocoders defined.');
                this.destroy();
                return;
            }
            if (!this.domNode) {
                console.log('domNode is undefined.');
                this.destroy();
                return;
            }
            // add clear button if already populated
            if (this.get("value")) {
                this._checkStatus();
            }
            // if map is in options
            if (this.map) {
                // once map is loaded
                if (this.map.loaded) {
                    this._init();
                } else {
                    on(this.map, "load", lang.hitch(this, function() {
                        this._init();
                    }));
                }
            } else {
                // lets go
                this._init();
            }
        },
        // post create widget function
        postCreate: function() {
            // build geocoder list
            this._updateGeocoder();
            // setup connections
            this._setDelegations();
        },
        destroy: function() {
            var i;
            // if delegations
            if (this._delegations) {
                // disconnect all events
                for (i = 0; i < this._delegations.length; i++) {
                    this._delegations[i].remove();
                }
            }
            if(this._acEvent){
                this._acEvent.remove();
            }
            if(this._gmEvent){
                this._gmEvent.remove();
            }
            // remove html
            domConstruct.empty(this.domNode);
            this.inherited(arguments);
        },
        // clear the input box
        clear: function() {
            // clear event
            this.onClear();
            // empty input value
            domAttr.set(this.inputNode, 'value', '');
            // set current text
            this.set("value", '');
            // empty results
            this.results = [];
            // get node of reset button and remove it's active class
            domClass.remove(this.containerNode, this._hasValueClass);
            domAttr.set(this.clearNode, 'title', '');
            // remove active menus
            this._hideMenus();
            // hide loading
            this._hideLoading();
        },
        // show widget
        show: function() {
            domStyle.set(this.domNode, 'display', 'block');
        },
        // hide widget
        hide: function() {
            domStyle.set(this.domNode, 'display', 'none');
        },
        // submit button selected
        find: function(search) {
            // set deferred variable
            var def = new Deferred();
            if (search) {
                if (typeof search === 'string') {
                    this._queryDeferred(search).then(function(resp) {
                        def.resolve(resp);
                    });
                } else if (typeof search === 'object' && search.hasOwnProperty("geometry")) {
                    var point;
                    switch (search.geometry.type) {
                    case "extent":
                        point = search.geometry.getCenter();
                        break;
                    case "multipoint":
                        point = search.geometry.getExtent().getCenter();
                        break;
                    case "point":
                        point = search.geometry;
                        break;
                    case "polygon":
                        point = search.geometry.getExtent().getCenter();
                        break;
                    case "polyline":
                        point = search.geometry.getExtent().getCenter();
                        break;
                    }
                    if (point) {
                        this._reverseGeocodePoint(point, search.geometry).then(function(resp) {
                            if (resp.results[0]) {
                                if (search.hasOwnProperty("attributes")) {
                                    resp.results[0].feature.setAttributes(lang.mixin(resp.results[0].feature.attributes, search.attributes));
                                }
                                if (search.hasOwnProperty("infoTemplate")) {
                                    resp.results[0].feature.setInfoTemplate(search.infoTemplate);
                                }
                                if (search.hasOwnProperty("symbol")) {
                                    resp.results[0].feature.setSymbol(search.symbol);
                                }
                            }
                            def.resolve(resp);
                        }, function(error) {
                            def.reject(error);
                        });
                    }
                } else if (typeof search === 'object' && search.type === 'point') {
                    // point geometry
                    this._reverseGeocodePoint(search).then(function(resp) {
                        def.resolve(resp);
                    }, function(error) {
                        def.reject(error);
                    });
                } else if (search instanceof Array && search.length === 2) {
                    // long, lat
                    var pt = new Point(search, new SpatialReference({
                        wkid: 4326
                    }));
                    this._reverseGeocodePoint(pt).then(function(resp) {
                        def.resolve(resp);
                    }, function(error) {
                        def.reject(error);
                    });
                } else {
                    def.reject('Invalid find type');
                }
            } else {
                this._queryDeferred(this.get('value')).then(function(resp) {
                    def.resolve(resp);
                });
            }
            // give me my deferred
            return def;
        },
        // focus on input
        focus: function() {
            focusUtil.focus(this.inputNode);
        },
        // blur input
        blur: function() {
            if (focusUtil.curNode) {
                focusUtil.curNode.blur();
            }
            this.inputNode.blur();
            this._hideMenus();
        },
        // go to a location
        select: function(e) {
            // event
            this.onSelect(e);
            // hide menus
            this._hideMenus();
            // hide loading spinner
            this._hideLoading();
            // has extent and autoNavigate
            if (this.autoNavigate && e && e.hasOwnProperty('extent') && this.map) {
                // set map extent to location
                this.map.setExtent(e.extent);
            }
        },
        /* ---------------- */
        /* Public Events */
        /* ---------------- */
        // called after search has been selected
        onSelect: function() {},
        // called on results
        onFindResults: function() {},
        // called on results
        onAutoComplete: function() {},
        // when geocoder selected
        onGeocoderSelect: function() {},
        // when geocoder selected
        onClear: function() {},
        // on enter key
        onEnterKeySelect: function() {},
        // widget loaded
        onLoad: function() {},
        /* ---------------- */
        /* Private Functions */
        /* ---------------- */
        _init: function() {
            // set widget ready
            this.loaded = true;
            // loaded
            this.onLoad();
            // hide menus
            this._hideMenus();
        },
        _queryDeferred: function(search) {
            var def = new Deferred();
            // query and then Locate
            this._query({
                delay: 0,
                search: search
            }).then(lang.hitch(this, function(response) {
                this.onFindResults(response);
                def.resolve(response);
            }), lang.hitch(this, function(error) {
                this.onFindResults(error);
                def.reject(error);
            }));
            return def;
        },
        _reverseGeocodePoint: function(pt, geometry) {
            var def = new Deferred();
            if (pt && this.activeGeocoder) {
                var geo = geometry || pt;
                // reverse Geocoder
                this._reverseTask = new Locator(this.activeGeocoder.url);
                // spatial ref output
                this._reverseTask.outSpatialReference = this._defaultSR;
                if (this.map) {
                    this._reverseTask.outSpatialReference = this.map.spatialReference;
                }
                var distance = this.activeGeocoder.distance || 1500;
                this._reverseTask.locationToAddress(pt, distance, lang.hitch(this, function(response) {
                    var result = this._hydrateResult(response);
                    var obj = {
                        "results": [result],
                        "geometry": geo
                    };
                    this.onFindResults(obj);
                    def.resolve(obj);
                }), lang.hitch(this, function(error) {
                    def.reject(error);
                }));
            } else {
                def.reject("no point or active geocoder defined");
            }
            return def;
        },
        // default settings
        _setPublicDefaults: function() {
            // show autocomplete?
            this.autoComplete = false;
            // use esri geocoder
            this.arcgisGeocoder = true;
            // Value of input
            this.set("value", '');
            // Theme
            this.set("theme", 'simpleGeocoder');
            // default geocoder index
            this.activeGeocoderIndex = 0;
            // Maximum result locations to return
            this.maxLocations = 5;
            // Minimum amount of characters before searching
            this.minCharacters = 0;
            // Delay before doing the query. To avoid being too chatty.
            this.searchDelay = 100;
            // Show geocoder menu if necessary
            this.geocoderMenu = true;
            // Automatically navigate
            this.autoNavigate = true;
            // show result suggestions
            this.showResults = true;
        },
        // set variables that aren't to be modified
        _setPrivateDefaults: function() {
            this._i18n = i18n;
            // deferreds
            this._deferreds = [];
            // results holder
            this.results = [];
            // default Spatial Ref
            this._defaultSR = new SpatialReference(4326);
            // css classes
            this._GeocoderContainerClass = 'esriGeocoderContainer';
            this._GeocoderClass = 'esriGeocoder';
            this._GeocoderMultipleClass = 'esriGeocoderMultiple';
            this._GeocoderIconClass = 'esriGeocoderIcon';
            this._GeocoderActiveClass = 'esriGeocoderActive';
            this._GeocoderResultsOpenClass = 'esriGeocoderResultsOpen';
            this._loadingClass = 'esriGeocoderLoading';
            this._resultsContainerClass = 'esriGeocoderResults';
            this._resultsItemClass = 'esriGeocoderResult';
            this._resultsItemEvenClass = 'esriGeocoderResultEven';
            this._resultsItemOddClass = 'esriGeocoderResultOdd';
            this._resultsItemFirstClass = 'esriGeocoderResultFirst';
            this._resultsItemLastClass = 'esriGeocoderResultLast';
            this._resultsPartialMatchClass = 'esriGeocoderResultPartial';
            this._searchButtonClass = 'esriGeocoderSearch';
            this._clearButtonClass = 'esriGeocoderReset';
            this._hasValueClass = 'esriGeocoderHasValue';
            this._geocoderMenuClass = 'esriGeocoderMenu';
            this._geocoderMenuHeaderClass = 'esriGeocoderMenuHeader';
            this._geocoderMenuCloseClass = 'esriGeocoderMenuClose';
            this._activeMenuClass = 'esriGeocoderMenuActive';
            this._geocoderMenuArrowClass = 'esriGeocoderMenuArrow';
            this._geocoderSelectedClass = 'esriGeocoderSelected';
            this._geocoderSelectedCheckClass = 'esriGeocoderSelectedCheck';
            this._GeocoderClearClass = 'esriGeocoderClearFloat';
        },
        // setup esri geocoder
        _setEsriGeocoder: function() {
            if (this.arcgisGeocoder) {
                // if object defined for esri geocoder
                if (typeof this.arcgisGeocoder === 'object') {
                    this._arcgisGeocoder = this.arcgisGeocoder;
                } else {
                    this._arcgisGeocoder = {};
                }
                // ArcGIS Geocoder URL
                if (!this._arcgisGeocoder.hasOwnProperty('suggest')) {
                    // set esri geocoder options
                    this._arcgisGeocoder.suggest = true;
                }
                // ArcGIS Geocoder URL
                if (!this._arcgisGeocoder.url) {
                    // set esri geocoder options
                    this._arcgisGeocoder.url = location.protocol + "//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
                }
                // if name not set
                if (!this._arcgisGeocoder.name) {
                    this._arcgisGeocoder.name = i18n.widgets.Geocoder.esriGeocoderName;
                }
                // local search
                if (!this._arcgisGeocoder.hasOwnProperty('localSearchOptions')) {
                    this._arcgisGeocoder.localSearchOptions = {
                        minScale: 300000,
                        distance: 50000
                    };
                }
                this.arcgisGeocoder = this._arcgisGeocoder;
            } else {
                this.arcgisGeocoder = false;
            }
        },
        // sets current locator object
        _setActiveGeocoder: function() {
            // set current active geocoder object
            this.activeGeocoder = this._geocoders[this.activeGeocoderIndex];
            // update placeholder nodes
            this._updatePlaceholder();
        },
        // Combine and count all geocoders
        _setGeocoderList: function() {
            var geocoders = [];
            if (this.arcgisGeocoder) {
                geocoders = geocoders.concat([this._arcgisGeocoder]);
            }
            if (this.geocoders && this.geocoders.length) {
                geocoders = geocoders.concat(this.geocoders);
            }
            this._geocoders = geocoders;
        },
        // Update geocoder nodes
        _updateGeocoder: function() {
            this.set("activeGeocoderIndex", 0);
            this._setEsriGeocoder();
            this._setGeocoderList();
            this._setActiveGeocoder();
            this._insertGeocoderMenuItems();
        },
        // Update placeholder nodes
        _updatePlaceholder: function() {
            this._placeholder = '';
            // if placeholder of active geocoder is set
            if (this.activeGeocoder && this.activeGeocoder.placeholder) {
                this._placeholder = this.activeGeocoder.placeholder;
            }
            domAttr.set(this.inputNode, 'placeholder', this._placeholder);
            domAttr.set(this.submitNode, 'title', this._placeholder);
        },
        // update value of text box
        _updateValue: function(attr, oldVal, newVal) {
            if (!this._ignoreUpdateValue) {
                domAttr.set(this.inputNode, 'value', newVal);
                this._checkStatus();
            }
        },
        // update theme
        _updateTheme: function(attr, oldVal, newVal) {
            domClass.remove(this.domNode, oldVal);
            domClass.add(this.domNode, newVal);
        },
        // change active geocoder
        _setActiveGeocoderIndex: function(attr, oldVal, newVal) {
            this.activeGeocoderIndex = newVal;
            // set geocoder object
            this._setActiveGeocoder();
            this._hideMenus();
            this._insertGeocoderMenuItems();
            var evt = {
                attr: this.activeGeocoder,
                oldVal: oldVal,
                newVal: newVal
            };
            this.onGeocoderSelect(evt);
        },
        // query for results and then execute a function
        _query: function(e) {
            if (!e) {
                e = {
                    delay: 0
                };
            }
            if (!e.search) {
                e.search = this.get("value");
            }
            // set deferred variable if needed to cancel it
            var def = new Deferred();
            this._deferreds.push(def);
            // timeout
            this._queryTimer = setTimeout(lang.hitch(this, function() {
                this._performQuery(def, e);
            }), e.delay);
            return def;
        },
        // when geocoder search starts
        _performQuery: function(def, e) {
            // if query isn't empty
            if (e.search) {
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
                // query prefix
                if (this.activeGeocoder.prefix) {
                    singleLine += this.activeGeocoder.prefix;
                }
                // query value
                singleLine += e.search;
                // query suffix
                if (this.activeGeocoder.suffix) {
                    singleLine += this.activeGeocoder.suffix;
                }
                // if we can use the find function
                if (this.activeGeocoder === this._arcgisGeocoder) {
                    var mapSR = this._defaultSR;
                    if (this.map) {
                        mapSR = this.map.spatialReference;
                    }
                    // Query object
                    params = {
                        "text": singleLine,
                        "outSR": mapSR.wkid || JSON.stringify(mapSR.toJson()),
                        "f": "json"
                    };
                    if (this.map && this.activeGeocoder.localSearchOptions && this.activeGeocoder.localSearchOptions.hasOwnProperty('distance') && this.activeGeocoder.localSearchOptions.hasOwnProperty('minScale')) {
                        // set center point
                        var normalizedPoint = this.map.extent.getCenter().normalize();
                        // current scale of map
                        var scale = this.map.getScale();
                        // location search will be performed when the map scale is less than minScale.
                        if (!this.activeGeocoder.localSearchOptions.minScale || (scale && scale <= parseFloat(this.activeGeocoder.localSearchOptions.minScale))) {
                            params.location = JSON.stringify(normalizedPoint.toJson());
                            params.distance = this.activeGeocoder.localSearchOptions.distance;
                        }
                    }
                    // if magic key
                    if (e.magicKey) {
                        params.magicKey = e.magicKey;
                    }
                    // if outfields
                    if (outFields) {
                        params.outFields = outFields;
                    }
                    // if max locations set
                    if (this.maxLocations) {
                        params.maxLocations = this.maxLocations;
                    }
                    // Esri Geocoder country
                    if (this.activeGeocoder.sourceCountry) {
                        params.sourceCountry = this.activeGeocoder.sourceCountry;
                    }
                    // local results only
                    if (this.activeGeocoder.searchExtent) {
                        var bbox = {
                            "xmin": this.activeGeocoder.searchExtent.xmin,
                            "ymin": this.activeGeocoder.searchExtent.ymin,
                            "xmax": this.activeGeocoder.searchExtent.xmax,
                            "ymax": this.activeGeocoder.searchExtent.ymax,
                            "spatialReference": this.activeGeocoder.searchExtent.spatialReference.toJson()
                        };
                        params.bbox = JSON.stringify(bbox);
                    }
                    var path = '/find';
                    if (e.autocomplete && this.activeGeocoder.suggest) {
                        path = '/suggest';
                    }
                    // send request
                    esriRequest({
                        url: this.activeGeocoder.url + path,
                        content: params,
                        handleAs: 'json',
                        callbackParamName: 'callback',
                        // on load
                        load: lang.hitch(this, function(response) {
                            var results = response.suggestions || response.locations;
                            this._receivedResults(results, def, e);
                        })
                    });
                } else {
                    // Params
                    params = {
                        address: {}
                    };
                    if (e.magicKey) {
                        params.magicKey = e.magicKey;
                    }
                    if (this.activeGeocoder.singleLineFieldName) {
                        params.address[this.activeGeocoder.singleLineFieldName] = singleLine;
                    } else {
                        params.address["Single Line Input"] = singleLine;
                    }
                    // if outfields
                    if (outFields) {
                        params.outFields = [outFields];
                    }
                    // within extent
                    if (this.activeGeocoder.searchExtent) {
                        params.searchExtent = this.activeGeocoder.searchExtent;
                    }
                    // Geocoder
                    this._task = new Locator(this.activeGeocoder.url);
                    // spatial ref output
                    this._task.outSpatialReference = this._defaultSR;
                    if (this.map) {
                        this._task.outSpatialReference = this.map.spatialReference;
                    }
                    // query for location
                    this._task.addressToLocations(params, lang.hitch(this, function(response) {
                        this._receivedResults(response, def, e);
                    }), lang.hitch(this, function(response) {
                        this._receivedResults(response, def, e);
                    }));
                }
            } else {
                this._hideLoading();
                def.reject('no search to perform');
            }
        },
        // called on AC Results
        _showResults: function() {
            // hide menu to toggle geocoder
            this._hideGeolocatorMenu();
            // string to set
            var html = '';
            // if results and result node
            if (this.results && this.results.length && this.resultsNode) {
                // textbox value
                var partialMatch = this.get("value"),
                    i;
                // partial match highlight
                var regex = new RegExp('(' + partialMatch + ')', 'gi');
                html += '<ul role="presentation">';
                // for each result
                for (i = 0; i < this.results.length; ++i) {
                    // location text
                    var text = this.results[i].text || this.results[i].name;
                    // set layer class
                    var layerClass = this._resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += this._resultsItemOddClass;
                    } else {
                        layerClass += this._resultsItemEvenClass;
                    }
                    if (i === 0) {
                        layerClass += ' ' + this._resultsItemFirstClass;
                    } else if (i === (this.results.length - 1)) {
                        layerClass += ' ' + this._resultsItemLastClass;
                    }
                    // create list item
                    html += '<li data-text="' + text + '" data-item="true" data-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + text.replace(regex, '<strong class="' + this._resultsPartialMatchClass + '">' + partialMatch + '</strong>') + '</li>';
                }
                // close list
                html += '</ul>';
                // insert HTML
                if (this.resultsNode) {
                    this.resultsNode.innerHTML = html;
                }
                this._autoCompleteEvent();
                // show!
                this._showResultsMenu();
            }
            else{
               if (this.resultsNode) {
                    this.resultsNode.innerHTML = html;
                }
                this._hideResultsMenu(); 
            }
        },
        // ac query
        _autocomplete: function() {
            this._query({
                delay: this.searchDelay,
                autocomplete: true,
                search: this.get("value")
            }).then(lang.hitch(this, function(response) {
                this.onAutoComplete(response);
                if (this.showResults) {
                    this._showResults(response);
                }
            }));
        },
        // received results
        _receivedResults: function(response, def) {
            // hide loading spinner
            this._hideLoading();
            var results = this._hydrateResults(response);
            // save results
            this.results = results;
            // results object
            var obj = {
                "results": results,
                "value": this.get("value")
            };
            def.resolve(obj);
        },
        // show loading spinner
        _showLoading: function() {
            domClass.add(this.containerNode, this._loadingClass);
        },
        // hide loading spinner
        _hideLoading: function() {
            domClass.remove(this.containerNode, this._loadingClass);
        },
        // show geocoder selection menu
        _showGeolocatorMenu: function() {
            // add class to container                
            domClass.add(this.containerNode, this._activeMenuClass);
            // display menu node
            domStyle.set(this.geocoderMenuNode, 'display', 'block');
            // aria
            domAttr.set(this.geocoderMenuInsertNode, 'aria-hidden', 'false');
            domAttr.set(this.geocoderMenuArrowNode, 'aria-expanded', 'true');
        },
        // hide geocoder selection menu
        _hideGeolocatorMenu: function() {
            domClass.remove(this.containerNode, this._activeMenuClass);
            domStyle.set(this.geocoderMenuNode, 'display', 'none');
            // aria
            domAttr.set(this.geocoderMenuInsertNode, 'aria-hidden', 'true');
            domAttr.set(this.geocoderMenuArrowNode, 'aria-expanded', 'false');
        },
        // toggle geocoder selection menu
        _toggleGeolocatorMenu: function() {
            this._hideResultsMenu();
            var display = domStyle.get(this.geocoderMenuNode, 'display');
            if (display === 'block') {
                this._hideGeolocatorMenu();
            } else {
                this._showGeolocatorMenu();
            }
        },
        // show autolocate menu
        _showResultsMenu: function() {
            // add class to container
            domClass.add(this.containerNode, this._GeocoderActiveClass);
            domClass.add(this.domNode, this._GeocoderResultsOpenClass);
            // show node
            domStyle.set(this.resultsNode, 'display', 'block');
            // aria
            domAttr.set(this.resultsNode, 'aria-hidden', 'false');
        },
        // hide the results menu
        _hideResultsMenu: function() {
            // hide
            domStyle.set(this.resultsNode, 'display', 'none');
            // add class to container
            domClass.remove(this.containerNode, this._GeocoderActiveClass);
            domClass.remove(this.domNode, this._GeocoderResultsOpenClass);
            // aria
            domAttr.set(this.resultsNode, 'aria-hidden', 'true');
        },
        // hide both menus
        _hideMenus: function() {
            this._hideGeolocatorMenu();
            this._hideResultsMenu();
        },
        // create menu for changing active geocoder
        _insertGeocoderMenuItems: function() {
            if (this.geocoderMenu && this._geocoders.length > 1) {
                var html = '';
                var layerClass = '',
                    i;
                html += '<ul role="presentation">';
                for (i = 0; i < this._geocoders.length; i++) {
                    // set layer class
                    layerClass = this._resultsItemClass + ' ';
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
                    if (i === 0) {
                        layerClass += ' ' + this._resultsItemFirstClass;
                    } else if (i === (this._geocoders.length - 1)) {
                        layerClass += ' ' + this._resultsItemLastClass;
                    }
                    // geocoder name
                    var geocoderName = this._geocoders[i].name || i18n.widgets.Geocoder.main.untitledGeocoder;
                    // create list item
                    html += '<li data-index="' + i + '" data-item="true" role="menuitem" tabindex="0" class="' + layerClass + '">';
                    html += '<div class="' + this._geocoderSelectedCheckClass + '"></div>';
                    html += geocoderName;
                    html += '<div class="' + this._GeocoderClearClass + '"></div>';
                    html += '</li>';
                }
                // close list
                html += '</ul>';
                this.geocoderMenuInsertNode.innerHTML = html;
                this._geocoderMenuEvent();
                domStyle.set(this.geocoderMenuNode, 'display', 'none');
                domStyle.set(this.geocoderMenuArrowNode, 'display', 'block');
                domClass.add(this.containerNode, this._GeocoderMultipleClass);
            } else {
                this.geocoderMenuInsertNode.innerHTML = '';
                domStyle.set(this.geocoderMenuNode, 'display', 'none');
                domStyle.set(this.geocoderMenuArrowNode, 'display', 'none');
                domClass.remove(this.containerNode, this._GeocoderMultipleClass);
            }
        },
        // check input box's status
        _checkStatus: function() {
            // if input value is not empty
            if (this.get("value")) {
                // add class to dom
                domClass.add(this.containerNode, this._hasValueClass);
                // set class and title
                domAttr.set(this.clearNode, 'title', i18n.widgets.Geocoder.main.clearButtonTitle);
            } else {
                // clear address
                this.clear();
            }
        },
        _autoCompleteEvent: function(){
            // list items
            var lists = query('[data-item="true"]', this.resultsNode);
            // remove event
            if(this._acEvent){
                this._acEvent.remove();
            }
            // list item click
            this._acEvent = on(lists, 'click, keydown', lang.hitch(this, function(e) {
                clearTimeout(this._queryTimer);
                // index of list item
                var resultIndex = parseInt(domAttr.get(e.currentTarget, 'data-index'), 10);
                // input box text
                var locTxt = domAttr.get(e.currentTarget, 'data-text');
                // next/previous index
                var newIndex;
                if (e.type === 'click' || (e.type === 'keydown' && e.keyCode === keys.ENTER)) {
                    // set input text value to text
                    domAttr.set(this.inputNode, 'value', locTxt);
                    // set current text var
                    this.set("value", locTxt);
                    if (this.results && this.results[resultIndex]) {
                        if (this.results[resultIndex].name) {
                            this.select(this.results[resultIndex]);
                        } else {
                            var text = this.results[resultIndex].text;
                            var magicKey = this.results[resultIndex].magicKey || null;
                            var params = {
                                delay: 0,
                                search: text,
                                magicKey: magicKey
                            };
                            this._query(params).then(lang.hitch(this, function(response) {
                                // Locate
                                this.select(response.results[0]);
                            }));
                        }
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.UP_ARROW) {
                    event.stop(e);
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        this.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.DOWN_ARROW) {
                    event.stop(e);
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        this.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.keyCode === keys.ESCAPE) { // esc key
                    // hide menus
                    this._hideMenus();
                }
            }));
        },
        _geocoderMenuEvent: function(){
            // list items
            var lists = query('[data-item="true"]', this.geocoderMenuInsertNode);
            // remove event
            if(this._gmEvent){
                this._gmEvent.remove();
            }
            // select geocoder item
            this._gmEvent = on(lists, 'click, keydown', lang.hitch(this, function(e) {
                // index of list item
                var resultIndex = parseInt(domAttr.get(e.currentTarget, 'data-index'), 10);
                // next/previous index
                var newIndex;
                if (e.type === 'click' || (e.type === 'keydown' && e.keyCode === keys.ENTER)) {
                    this._setActiveGeocoderIndex(null, null, resultIndex);
                    this._hideGeolocatorMenu();
                } else if (e.type === 'keydown' && e.keyCode === keys.UP_ARROW) {
                    event.stop(e);
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        this.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.DOWN_ARROW) {
                    event.stop(e);
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        this.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.keyCode === keys.ESCAPE) { // esc key
                    this._hideGeolocatorMenu();
                }
            }));
        },
        // set up connections
        _setDelegations: function() {
            // array of all connections
            this._delegations = [];
            // close on click
            var closeOnClick = on(document, "click", lang.hitch(this, function(e) {
                this._hideResultsMenu(e);
            }));
            this._delegations.push(closeOnClick);
            // input key up
            var inputKeyUp = on(this.inputNode, "keyup", lang.hitch(this, function(e) {
                this._inputKeyUp(e);
            }));
            this._delegations.push(inputKeyUp);
            // input key down
            var inputKeyDown = on(this.inputNode, "keydown", lang.hitch(this, function(e) {
                this._inputKeyDown(e);
            }));
            this._delegations.push(inputKeyDown);
            // arrow key down
            var geocoderMenuButtonKeyDown = on(this.geocoderMenuArrowNode, "keydown", this._geocoderMenuButtonKeyDown());
            this._delegations.push(geocoderMenuButtonKeyDown);
        },
        _findThenSelect: function() {
            this.find().then(lang.hitch(this, function(response) {
                if (response.results && response.results.length) {
                    this.select(response.results[0]);
                    this.onEnterKeySelect();
                }
            }));
        },
        // key up event on input box
        _inputKeyUp: function(e) {
            if (e) {
                // Reset timer between keys
                clearTimeout(this._queryTimer);
                // get textbox value
                var aquery = this.inputNode.value;
                // don't update input
                this._ignoreUpdateValue = true;
                // update current text variable
                this.set("value", aquery);
                // update input
                this._ignoreUpdateValue = false;
                // length of value
                var alength = 0;
                // if value
                if (aquery) {
                    // set length of value
                    alength = aquery.length;
                }
                // ignored keys
                if (e.keyCode === e.copyKey || e.ctrlKey || e.shiftKey || e.metaKey || e.altKey || e.keyCode === e.ALT || e.keyCode === e.CTRL || e.keyCode === e.META || e.keyCode === e.shiftKey || e.keyCode === keys.UP_ARROW || e.keyCode === keys.DOWN_ARROW || e.keyCode === keys.LEFT_ARROW || e.keyCode === keys.RIGHT_ARROW) {
                    return e;
                } else if (e && e.keyCode === keys.ENTER) { // if enter key was pushed
                    this._cancelDeferreds();
                    // query then Locate
                    this._findThenSelect();
                    // if up arrow pushed
                } else if (e && e.keyCode === keys.ESCAPE) { // esc key
                    this._cancelDeferreds();
                    this._hideMenus();
                } else if (e && e.keyCode === keys.TAB) {
                    this._cancelDeferreds();
                    this._hideMenus();
                } else if (this.autoComplete && alength >= this.minCharacters) {
                    this._autocomplete();
                } else {
                    // hide menus
                    this._hideMenus();
                }
                // check status of search box
                this._checkStatus();
            }
        },
        _cancelDeferreds: function() {
            if (this._deferreds.length) {
                for (var i = 0; i < this._deferreds.length; i++) {
                    // cancel deferred
                    this._deferreds[i].cancel('stop query');
                }
                this._deferreds = [];
            }
        },
        // key down event on input box
        _inputKeyDown: function(e) {
            var lists = query('[data-item="true"]', this.resultsNode);
            if (e && e.keyCode === keys.TAB) {
                this._cancelDeferreds();
                // hide menus if opened
                this._hideMenus();
                // stop
                return;
            } else if (e && e.keyCode === keys.UP_ARROW) {
                event.stop(e);
                //this._cancelDeferreds();
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (e && e.keyCode === keys.DOWN_ARROW) {
                event.stop(e);
                //this._cancelDeferreds();
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
            }
        },
        // geocoder menu arrow key down
        _geocoderMenuButtonKeyDown: function(e) {
            var lists = query('[data-item="true"]', this.geocoderMenuInsertNode);
            if (e && e.keyCode === keys.UP_ARROW) {
                event.stop(e);
                this._showGeolocatorMenu();
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (e && e.keyCode === keys.DOWN_ARROW) {
                event.stop(e);
                this._showGeolocatorMenu();
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
            }
        },
        // input box clicked
        _inputClick: function() {
            // hide geolocator switch
            this._hideGeolocatorMenu();
            // if input value is empty
            if (!this.get("value")) {
                // clear address
                this.clear();
                // hide menus
                this._hideMenus();
            }
            // check status of text box
            this._checkStatus();
        },
        _hydrateResult: function(e) {
            var sR = this._defaultSR;
            if (this.map) {
                sR = this.map.spatialReference;
            }
            // result to add
            var newResult = {},
                geometry;
            // suggest api result
            if (e.hasOwnProperty('text') && e.hasOwnProperty('magicKey')) {
                return e;
            }
            // find geocoder
            if (e.hasOwnProperty('extent')) {
                // set extent
                newResult.extent = new Extent(e.extent);
                // set spatial ref
                newResult.extent.setSpatialReference(new SpatialReference(sR));
                // set name
                if (e.hasOwnProperty('name')) {
                    newResult.name = e.name;
                }
                // Set feature
                if (e.hasOwnProperty('feature')) {
                    newResult.feature = new Graphic(e.feature);
                    geometry = newResult.feature.geometry;
                    // fix goemetry SR
                    if (geometry) {
                        geometry.setSpatialReference(sR);
                    }
                }
            }
            // address candidates geocoder
            else if (e.hasOwnProperty('location')) {
                // create point
                var point = new Point(e.location.x, e.location.y, sR);
                // create extent from point
                if (this.map) {
                    newResult.extent = this.map.extent.centerAt(point);
                } else {
                    // create extent
                    newResult.extent = new Extent({
                        "xmin": point.x - 0.25,
                        "ymin": point.y - 0.25,
                        "xmax": point.x + 0.25,
                        "ymax": point.y + 0.25,
                        "spatialReference": {
                            "wkid": 4326
                        }
                    });
                }
                // set name
                if (e.hasOwnProperty('address') && typeof e.address === 'string') {
                    newResult.name = e.address;
                } else if (e.hasOwnProperty('address') && typeof e.address === 'object' && e.address.hasOwnProperty('Address')) {
                    newResult.name = e.address.Address;
                } else {
                    newResult.name = '';
                }
                // create attributes
                var attributes = {};
                // set attributes
                if (e.hasOwnProperty('attributes')) {
                    attributes = e.attributes;
                }
                // set score
                if (e.hasOwnProperty('score')) {
                    attributes.score = e.score;
                }
                newResult.feature = new Graphic(point, null, attributes, null);
            }
            return newResult;
        },
        // create Extent and Graphic objects from JSON
        _hydrateResults: function(e) {
            // return results array
            var results = [];
            // if results
            if (e && e.length) {
                var i = 0;
                for (i; i < e.length && i < this.maxLocations; i++) {
                    var newResult = this._hydrateResult(e[i]);
                    // add to return array
                    results.push(newResult);
                }
            }
            return results;
        }
    });
    if (has("extend-esri")) {
        lang.setObject("dijit.Geocoder", Widget, esriNS);
    }
    return Widget;
});