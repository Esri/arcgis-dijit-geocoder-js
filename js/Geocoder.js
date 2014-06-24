define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/Deferred",
    "dojo/_base/event",
    "dojo/dom-attr",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/keys",
    "dojo/on",
    "dojo/query",
    "dojo/i18n!application/nls/jsapi",
    "dojo/text!application/dijit/templates/Geocoder.html",
    "dojo/uacss",
    "dijit/a11yclick",
    "dijit/_TemplatedMixin",
    "dijit/focus",
    "esri/kernel",
    "esri/SpatialReference",
    "esri/graphic",
    "esri/dijit/_EventedWidget",
    "esri/geometry/Point",
    "esri/geometry/Extent",
    "esri/tasks/locator",
    "esri/tasks/query",
    "esri/tasks/QueryTask",
    "esri/geometry/scaleUtils"
],
function (
    declare, lang, Deferred, event, domAttr, domClass, domStyle, domConstruct, keys, on, query, i18n, template, has,
    a11yclick, _TemplatedMixin, focusUtil,
    esriNS, SpatialReference, Graphic, _EventedWidget,
    Point, Extent, Locator, Query, QueryTask, scaleUtils) {
    var Widget = declare("esri.dijit.Geocoder", [_EventedWidget, _TemplatedMixin], {
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
        constructor: function (options, srcRefNode) {
            // class names
            this._css = {
                GeocoderContainerClass: 'esriGeocoderContainer',
                GeocoderClass: 'esriGeocoder',
                GeocoderMultipleClass: 'esriGeocoderMultiple',
                GeocoderIconClass: 'esriGeocoderIcon',
                GeocoderActiveClass: 'esriGeocoderActive',
                GeocoderResultsOpenClass: 'esriGeocoderResultsOpen',
                GeocoderMenuOpenClass: 'esriGeocoderMenuOpen',
                loadingClass: 'esriGeocoderLoading',
                resultsContainerClass: 'esriGeocoderResults',
                resultsItemClass: 'esriGeocoderResult',
                resultsItemEvenClass: 'esriGeocoderResultEven',
                resultsItemOddClass: 'esriGeocoderResultOdd',
                resultsItemFirstClass: 'esriGeocoderResultFirst',
                resultsItemLastClass: 'esriGeocoderResultLast',
                resultsPartialMatchClass: 'esriGeocoderResultPartial',
                searchButtonClass: 'esriGeocoderSearch',
                clearButtonClass: 'esriGeocoderReset',
                hasValueClass: 'esriGeocoderHasValue',
                geocoderMenuClass: 'esriGeocoderMenu',
                geocoderMenuHeaderClass: 'esriGeocoderMenuHeader',
                geocoderMenuCloseClass: 'esriGeocoderMenuClose',
                activeMenuClass: 'esriGeocoderMenuActive',
                geocoderMenuArrowClass: 'esriGeocoderMenuArrow',
                geocoderSelectedClass: 'esriGeocoderSelected',
                geocoderSelectedCheckClass: 'esriGeocoderSelectedCheck',
                GeocoderClearClass: 'esriGeocoderClearFloat'
            };
            // default settings
            this.options = {
                autoComplete: false, // show autoComplete?
                arcgisGeocoder: true, // use esri geocoder
                value: "", // Value of input
                theme: "simpleGeocoder", // Theme
                activeGeocoderIndex: 0, // default geocoder index
                maxLocations: 6, // Maximum result locations to return
                minCharacters: 3, // Minimum amount of characters before searching
                searchDelay: 300, // Delay before doing the query. To avoid being too chatty.
                geocoderMenu: true, // Show geocoder menu if necessary
                autoNavigate: true, // Automatically navigate
                showResults: true, // show result suggestions
                map: null,
                activeGeocoder: null,
                geocoders: null,
                zoomScale: 10000
            };
            // mix in settings and defaults
            var defaults = lang.mixin({}, this.options, options);
            // settings
            this.set("autoComplete", defaults.autoComplete);
            this.set("arcgisGeocoder", defaults.arcgisGeocoder);
            this.set("value", defaults.value);
            this.set("theme", defaults.theme);
            this.set("activeGeocoderIndex", defaults.activeGeocoderIndex);
            this.set("maxLocations", defaults.maxLocations);
            this.set("minCharacters", defaults.minCharacters);
            this.set("searchDelay", defaults.searchDelay);
            this.set("geocoderMenu", defaults.geocoderMenu);
            this.set("autoNavigate", defaults.autoNavigate);
            this.set("showResults", defaults.showResults);
            this.set("map", defaults.map);
            this.set("activeGeocoder", defaults.activeGeocoder);
            this.set("geocoders", defaults.geocoders);
            this.set("zoomScale", defaults.zoomScale);
            // results holder
            this.set("results", []);
            // languages
            this._i18n = i18n;
            // deferreds
            this._deferreds = [];
            // default Spatial Ref
            this._defaultSR = new SpatialReference(4326);
            // watch updates of public properties and update the widget accordingly
            this.watch("value", this._updateValue);
            this.watch("theme", this._updateTheme);
            this.watch("activeGeocoder", this._setActiveGeocoder);
            this.watch("activeGeocoderIndex", this._setActiveGeocoderIndex);
            this.watch("geocoders", this._updateGeocoder);
            this.watch("arcgisGeocoder", this._updateGeocoder);
            this.watch("geocoderMenu", this._updateGeocoder);
            this.watch("map", this._setupEvents);
            // widget node
            this.domNode = srcRefNode;
        },
        /* ---------------- */
        /* Public Functions */
        /* ---------------- */
        // start widget
        startup: function () {
            if (!this._geocoders.length) {
                console.log('Geocoder:: No geocoders defined.');
                this.destroy();
                return;
            }
            if (!this.domNode) {
                console.log('Geocoder:: domNode is undefined.');
                this.destroy();
                return;
            }
            // if map is in options
            if (this.get("map")) {
                // once map is loaded
                if (this.get("map").loaded) {
                    this._init();
                } else {
                    on.once(this.get("map"), "load", lang.hitch(this, function () {
                        this._init();
                    }));
                }
            } else {
                // lets go
                this._init();
            }
        },
        // post create widget function
        postCreate: function () {
            this.inherited(arguments);
            // submit button
            this.own(
                on(this.submitNode, a11yclick, lang.hitch(this, this._findThenSelect))
            );
            // geocoder menu
            this.own(
                on(this.geocoderMenuArrowNode, a11yclick, lang.hitch(this, this._toggleGeolocatorMenu))
            );
            // input click
            this.own(
                on(this.inputNode, a11yclick, lang.hitch(this, this._inputClick))
            );
            // clear text
            this.own(
                on(this.clearNode, a11yclick, lang.hitch(this, this.clear))
            );
            // hide menu
            this.own(
                on(this.geocoderMenuCloseNode, a11yclick, lang.hitch(this, this._hideGeolocatorMenu))
            );
            // build geocoder list
            this._updateGeocoder();
            // setup connections
            this._setupEvents();
            // add clear button if already populated
            if (this.get("value")) {
                this._checkStatus();
            }
            // hide menus
            this._hideMenus();
        },
        destroy: function () {
            this._removeEvents();
            // remove html
            domConstruct.empty(this.domNode);
            this.inherited(arguments);
        },
        // clear the input box
        clear: function () {
            // clear event
            this.onClear();
            // empty input value
            domAttr.set(this.inputNode, 'value', '');
            // set current text
            this.set("value", '');
            // empty results
            this.set("results", []);
            // get node of reset button and remove it's active class
            domClass.remove(this.containerNode, this._css.hasValueClass);
            domAttr.set(this.clearNode, 'title', '');
            // remove active menus
            this._hideMenus();
            // hide loading
            this._hideLoading();
        },
        // show widget
        show: function () {
            domStyle.set(this.domNode, 'display', 'block');
        },
        // hide widget
        hide: function () {
            domStyle.set(this.domNode, 'display', 'none');
        },
        // submit button selected
        find: function (search) {
            // set deferred variable
            var def = new Deferred();
            if (search) {
                if (typeof search === 'string') {
                    // search string
                    this._findQuery(search).then(function (resp) {
                        def.resolve(resp);
                    });
                } else if (typeof search === 'object' && search.hasOwnProperty("geometry")) {
                    // geometry
                    var point;
                    switch (search.geometry.type) {
                    case "extent":
                        // get oint from center of extent
                        point = search.geometry.getCenter();
                        break;
                    case "multipoint":
                        // get extent from multipoint, then get center of that
                        point = search.geometry.getExtent().getCenter();
                        break;
                    case "point":
                        // use geometry as is
                        point = search.geometry;
                        break;
                    case "polygon":
                        // get extent from polygon then get center
                        point = search.geometry.getExtent().getCenter();
                        break;
                    case "polyline":
                        // get extent from line, then get center
                        point = search.geometry.getExtent().getCenter();
                        break;
                    }
                    // if we now have a point
                    if (point) {
                        // reverse geocode point for address
                        this._reverseGeocodePoint(point, search.geometry).then(function (resp) {
                            // if we have a result
                            if (resp.results[0]) {
                                // if it has attributes
                                if (search.hasOwnProperty("attributes")) {
                                    resp.results[0].feature.setAttributes(lang.mixin(resp.results[0].feature.attributes, search.attributes));
                                }
                                // if we have an infotemplate
                                if (search.hasOwnProperty("infoTemplate")) {
                                    resp.results[0].feature.setInfoTemplate(search.infoTemplate);
                                }
                                // if we have a symbol
                                if (search.hasOwnProperty("symbol")) {
                                    resp.results[0].feature.setSymbol(search.symbol);
                                }
                            }
                            // return response
                            def.resolve(resp);
                        }, function (error) {
                            // return error
                            def.reject(error);
                        });
                    }
                } else if (typeof search === 'object' && search.type === 'point') {
                    // point geometry
                    this._reverseGeocodePoint(search).then(function (resp) {
                        def.resolve(resp);
                    }, function (error) {
                        def.reject(error);
                    });
                } else if (search instanceof Array && search.length === 2) {
                    // long, lat
                    var pt = new Point(search, new SpatialReference({
                        wkid: 4326
                    }));
                    // reverse geocode from lat/lon point
                    this._reverseGeocodePoint(pt).then(function (resp) {
                        def.resolve(resp);
                    }, function (error) {
                        def.reject(error);
                    });
                } else {
                    def.reject('Geocoder:: Invalid find type');
                }
            } else {
                // default use text string of input
                this._findQuery(this.get('value')).then(function (resp) {
                    def.resolve(resp);
                });
            }
            // give me my deferred
            return def.promise;
        },
        // focus on input
        focus: function () {
            focusUtil.focus(this.inputNode);
        },
        // blur input
        blur: function () {
            // if current focus exists
            if (focusUtil.curNode) {
                // remove focus
                focusUtil.curNode.blur();
            }
            // remove focus from input node
            this.inputNode.blur();
            // hide any menus
            this._hideMenus();
        },
        // go to a location
        select: function (e) {
            // event
            this.onSelect(e);
            // hide menus
            this._hideMenus();
            // hide loading spinner
            this._hideLoading();
            // has extent and autoNavigate
            if (this.get("autoNavigate") && e && e.hasOwnProperty('extent') && this.get("map")) {
                // set map extent to location
                this.get("map").setExtent(e.extent);
            }
        },
        /* ---------------- */
        /* Public Events */
        /* ---------------- */
        // called after search has been selected
        onSelect: function () {},
        // called on results
        onFindResults: function () {},
        // called on results
        onAutoComplete: function () {},
        // when geocoder selected
        onGeocoderSelect: function () {},
        // when geocoder selected
        onClear: function () {},
        // on enter key
        onEnterKeySelect: function () {},
        // widget loaded
        onLoad: function () {},
        /* ---------------- */
        /* Private Functions */
        /* ---------------- */
        // ac query
        _autoComplete: function () {
            // query with delay set
            this._query({
                delay: this.get("searchDelay"),
                autoComplete: true,
                search: this.get("value")
            }).then(lang.hitch(this, function (response) {
                // emit autocomplete event
                this.onAutoComplete(response);
                if (this.get("showResults")) {
                    // show results if allowed
                    this._showResults(response);
                }
            }));
        },
        _init: function () {
            // set widget ready
            this.set("loaded", true);
            // loaded
            this.onLoad();
        },
        _containsNonLatinCharacter: function(s) {
          for (var i = 0; i < s.length; i++) {
            if (s.charCodeAt(i) > 255) {
              return true;
            }
          }
          return false;
        },
        _findQuery: function (search) {
            var def = new Deferred();
            // query and then Locate
            this._query({
                delay: 0,
                search: search
            }).then(lang.hitch(this, function (response) {
                // emit event with response
                this.onFindResults(response);
                def.resolve(response);
            }), lang.hitch(this, function (error) {
                // emit result error
                this.onFindResults(error);
                def.reject(error);
            }));
            return def.promise;
        },
        _reverseGeocodePoint: function (pt, geometry) {
            var def = new Deferred();
            if (pt && this.get("activeGeocoder")) {
                var geo = geometry || pt;
                // default distance
                var distance = this.get("activeGeocoder").distance || 1500;
                // spatial ref output
                this._task.outSpatialReference = this._defaultSR;
                if (this.get("map")) {
                    this._task.outSpatialReference = this.get("map").spatialReference;
                }
                // reverse geocode
                this._task.locationToAddress(pt, distance, lang.hitch(this, function (response) {
                    // convert result to what we need
                    var result = this._hydrateResult(response);
                    // event object
                    var obj = {
                        "results": [result],
                        "geometry": geo
                    };
                    this.onFindResults(obj);
                    def.resolve(obj);
                }), lang.hitch(this, function (error) {
                    def.reject(error);
                }));
            } else {
                def.reject("Geocoder:: no point or active geocoder defined");
            }
            return def.promise;
        },
        // setup esri geocoder
        _setEsriGeocoder: function () {
            if (this.get("arcgisGeocoder")) {
                // if object defined for esri geocoder
                if (typeof this.get("arcgisGeocoder") === 'object') {
                    this._arcgisGeocoder = this.get("arcgisGeocoder");
                } else {
                    this._arcgisGeocoder = {};
                }
                // ArcGIS Geocoder URL
                if (!this._arcgisGeocoder.hasOwnProperty('suggest')) {
                    // set esri geocoder options
                    this._arcgisGeocoder.suggest = true;
                }
                // ArcGIS Geocoder Single Line
                if (!this._arcgisGeocoder.hasOwnProperty('singleLineFieldName')) {
                    // set esri geocoder options
                    this._arcgisGeocoder.singleLineFieldName = "SingleLine";
                }
                // ArcGIS Geocoder URL
                if (!this._arcgisGeocoder.url) {
                    // set esri geocoder options
                    this._arcgisGeocoder.url = (location.protocol === "file:" ? "http:" : location.protocol) + "//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
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
                this.set("arcgisGeocoder", this._arcgisGeocoder);
            } else {
                this.set("arcgisGeocoder", false);
            }
        },
        // sets current locator object
        _setActiveGeocoder: function () {
            // set current active geocoder object
            this.set("activeGeocoder", this._geocoders[this.get("activeGeocoderIndex")]);
            if(this.activeGeocoder.type === 'query'){
                this._task = new QueryTask(this.get("activeGeocoder").url);
            }
            else{
                // create locator task
                this._task = new Locator(this.get("activeGeocoder").url);    
            }
            // update placeholder nodes
            this._updatePlaceholder();
        },
        // Combine and count all geocoders
        _setGeocoderList: function () {
            var geocoders = [];
            if (this.get("arcgisGeocoder")) {
                geocoders = geocoders.concat([this._arcgisGeocoder]);
            }
            if (this.get("geocoders") && this.get("geocoders").length) {
                geocoders = geocoders.concat(this.get("geocoders"));
            }
            this._geocoders = geocoders;
        },
        // Update geocoder nodes
        _updateGeocoder: function () {
            this.set("activeGeocoderIndex", 0);
            this._setEsriGeocoder();
            this._setGeocoderList();
            this._setActiveGeocoder();
            this._insertGeocoderMenuItems();
        },
        // Update placeholder nodes
        _updatePlaceholder: function () {
            // reset placehodler text to nothing
            this._placeholder = '';
            // if placeholder of active geocoder is set
            if (this.get("activeGeocoder") && this.get("activeGeocoder").placeholder) {
                // set placeholder to active geocoder placeholder
                this._placeholder = this.get("activeGeocoder").placeholder;
            }
            // set placeholder onto nodes
            domAttr.set(this.inputNode, 'placeholder', this._placeholder);
            domAttr.set(this.submitNode, 'title', this._placeholder);
        },
        // update value of text box
        _updateValue: function () {
            var newVal = arguments[2];
            // If we want to update value of input
            if (!this._ignoreUpdateValue) {
                domAttr.set(this.inputNode, 'value', newVal);
                // check input box's status
                this._checkStatus();
            }
        },
        // update theme
        _updateTheme: function () {
            var oldVal = arguments[1];
            var newVal = arguments[2];
            domClass.remove(this.domNode, oldVal);
            domClass.add(this.domNode, newVal);
        },
        // change active geocoder
        _setActiveGeocoderIndex: function () {
            var oldVal = arguments[1];
            var newVal = arguments[2];
            this.set("activeGeocoderIndex", newVal);
            // set geocoder object
            this._setActiveGeocoder();
            this._hideMenus();
            this._insertGeocoderMenuItems();
            // event object
            var evt = {
                attr: this.get("activeGeocoder"),
                oldVal: oldVal,
                newVal: newVal
            };
            // emit event
            this.onGeocoderSelect(evt);
        },
        // clear timeout for query
        _clearQueryTimeout: function () {
            // if timer exists
            if (this._queryTimer) {
                // remove timeout
                clearTimeout(this._queryTimer);
            }
        },
        // query for results and then execute a function
        _query: function (e) {
            // default query object
            if (!e) {
                // immediate, no delay
                e = {
                    delay: 0
                };
            }
            // default search query
            if (!e.search) {
                e.search = this.get("value");
            }
            // set deferred variable if needed to cancel it
            var def = new Deferred();
            this._deferreds.push(def);
            // if we have a delay
            if(e.delay){
                // clear timeout for query
                this._clearQueryTimeout();
                // timeout
                this._queryTimer = setTimeout(lang.hitch(this, function () {
                    // start the task
                    this._performTask(def, e);
                }), e.delay);
            }
            else{
                // start the task
                this._performTask(def, e);
            }
            return def.promise;
        },
        // when geocoder search starts
        _performTask: function (def, e) {
            // if query isn't empty
            if (e.search) {
                // hide menu to toggle geocoder
                this._hideGeolocatorMenu();
                // show loading spinner
                this._showLoading();
                // single line query
                var singleLine = '';
                // query prefix
                if (this.get("activeGeocoder").prefix) {
                    singleLine += this.get("activeGeocoder").prefix;
                }
                // query value
                singleLine += e.search;
                // query suffix
                if (this.get("activeGeocoder").suffix) {
                    singleLine += this.get("activeGeocoder").suffix;
                }
                // Fields
                var outFields = this.get("activeGeocoder").outFields;
                // if outfields
                if (outFields) {
                    // if outfields is not an array
                    if(!(outFields instanceof Array)){
                        outFields = [outFields];
                    }
                }
                // max results
                var num = this.get("maxLocations") || 6;
                // constrain to extent
                var searchExtent = this.get("activeGeocoder").searchExtent;
                // spatial ref output
                var outSpatialReference = this._defaultSR;
                if (this.get("map")) {
                    outSpatialReference = this.get("map").spatialReference;
                }
                // layer query task?
                if(this.get("activeGeocoder").type === 'query'){
                    var q = new Query();
                    // spatial ref
                    q.outSpatialReference = outSpatialReference; 
                    q.returnGeometry = true;
                    q.num = num;
                    if(searchExtent){
                        q.geometry = searchExtent;
                    }
                    var exactMatch = this.get("activeGeocoder").exactMatch;
                    var field = this.get("activeGeocoder").field;
                    // Fix for non latin characters
                    var nlc = '';
                    if(this._containsNonLatinCharacter(singleLine)){
                      nlc = 'N';
                    }
                    if(exactMatch){
                        q.where = field + " = " + nlc + "'" + singleLine + "'";
                    }
                    else{
                        q.where = "UPPER(" + field + ") LIKE " + nlc + "'%" + singleLine.toUpperCase() + "%'";
                    }
                    // outfields
                    if (outFields) {
                        q.outFields = outFields;
                    }
                    // search
                    this._task.execute(q, lang.hitch(this, function (response) {
                        this._receivedResults(response.features, def, e);
                    }), lang.hitch(this, function (response) {
                        this._receivedResults([], def, e);
                    }));
                }
                else{
                    // query parameters
                    var params = {
                        address: {}
                    };
                    // maximum results
                    params.maxLocations = num;
                    // Esri Geocoder country
                    if (this.get("activeGeocoder").sourceCountry) {
                        params.sourceCountry = this.get("activeGeocoder").sourceCountry;
                    }
                    // within extent
                    if (searchExtent) {
                        params.searchExtent = searchExtent;
                    }
                    // spatial ref output
                    this._task.outSpatialReference = outSpatialReference;
                    // distance and point
                    if (this.get("map") && this.get("activeGeocoder").localSearchOptions && this.get("activeGeocoder").localSearchOptions.hasOwnProperty('distance') && this.get("activeGeocoder").localSearchOptions.hasOwnProperty('minScale')) {
                        // current scale of map
                        var scale = this.get("map").getScale();
                        // location search will be performed when the map scale is less than minScale.
                        if (!this.get("activeGeocoder").localSearchOptions.minScale || (scale && scale <= parseFloat(this.get("activeGeocoder").localSearchOptions.minScale))) {
                            params.location = this.get("map").extent.getCenter();
                            params.distance = this.get("activeGeocoder").localSearchOptions.distance;
                        }
                    }
                    if (this.get("activeGeocoder").suggest && e.autoComplete) {
                        // text for suggestions
                        params.text = singleLine;
                        // query for suggestions
                        this._task.suggestLocations(params).then(lang.hitch(this, function (response) {
                            this._receivedResults(response, def, e);
                        }), lang.hitch(this, function (response) {
                            this._receivedResults(response, def, e);
                        }));
                    } else {
                        if (e.magicKey) {
                            params.magicKey = e.magicKey;
                        }
                        if (this.get("activeGeocoder").singleLineFieldName) {
                            params.address[this.get("activeGeocoder").singleLineFieldName] = singleLine;
                        } else {
                            params.address["Single Line Input"] = singleLine;
                        }
                        // if outfields
                        if (outFields) {
                            params.outFields = outFields;
                        }
                        // query for location
                        this._task.addressToLocations(params, lang.hitch(this, function (response) {
                            this._receivedResults(response, def, e);
                        }), lang.hitch(this, function (response) {
                            this._receivedResults(response, def, e);
                        }));
                    }
                }
            } else {
                this._hideLoading();
                def.reject('Geocoder:: no search to perform');
            }
        },
        // called on AC Results
        _showResults: function () {
            // hide menu to toggle geocoder
            this._hideGeolocatorMenu();
            // string to set
            var html = '';
            // if results and result node
            if (this.get("results") && this.get("results").length && this.resultsNode) {
                // textbox value
                var partialMatch = this.get("value"),
                    i;
                // partial match highlight
                var r = new RegExp('(' + partialMatch + ')', 'gi');
                html += '<ul role="presentation">';
                // for each result
                for (i = 0; i < this.get("results").length && i < 5; ++i) {
                    // location text
                    var text = this.get("results")[i].text || this.get("results")[i].name;
                    // set layer class
                    var layerClass = this._css.resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += this._css.resultsItemOddClass;
                    } else {
                        // even
                        layerClass += this._css.resultsItemEvenClass;
                    }
                    if (i === 0) {
                        // first item
                        layerClass += ' ' + this._css.resultsItemFirstClass;
                    } else if (i === (this.get("results").length - 1)) {
                        // last item
                        layerClass += ' ' + this._css.resultsItemLastClass;
                    }
                    // create list item
                    html += '<li title="' + text + '" data-text="' + text + '" data-item="true" data-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + text.replace(r, '<strong class="' + this._css.resultsPartialMatchClass + '">$1</strong>') + '</li>';
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
            } else {
                // set to blank HTML string
                if (this.resultsNode) {
                    this.resultsNode.innerHTML = html;
                }
                // hide menu
                this._hideResultsMenu();
            }
        },
        // received results
        _receivedResults: function (response, def) {
            // hide loading spinner
            this._hideLoading();
            // convert results to desired format
            var results = this._hydrateResults(response);
            // save results
            this.set("results", results);
            // results object
            var obj = {
                "results": results,
                "value": this.get("value")
            };
            def.resolve(obj);
        },
        // show loading spinner
        _showLoading: function () {
            domClass.add(this.containerNode, this._css.loadingClass);
        },
        // hide loading spinner
        _hideLoading: function () {
            domClass.remove(this.containerNode, this._css.loadingClass);
        },
        // show geocoder selection menu
        _showGeolocatorMenu: function () {
            // add class to container                
            domClass.add(this.containerNode, this._css.activeMenuClass);
            domClass.add(this.domNode, this._css.GeocoderMenuOpenClass);
            // display menu node
            domStyle.set(this.geocoderMenuNode, 'display', 'block');
            // aria
            domAttr.set(this.geocoderMenuInsertNode, 'aria-hidden', 'false');
            domAttr.set(this.geocoderMenuArrowNode, 'aria-expanded', 'true');
        },
        // hide geocoder selection menu
        _hideGeolocatorMenu: function () {
            domClass.remove(this.containerNode, this._css.activeMenuClass);
            domClass.remove(this.domNode, this._css.GeocoderMenuOpenClass);
            domStyle.set(this.geocoderMenuNode, 'display', 'none');
            // aria
            domAttr.set(this.geocoderMenuInsertNode, 'aria-hidden', 'true');
            domAttr.set(this.geocoderMenuArrowNode, 'aria-expanded', 'false');
        },
        // toggle geocoder selection menu
        _toggleGeolocatorMenu: function () {
            // hide results
            this._hideResultsMenu();
            var display = domStyle.get(this.geocoderMenuNode, 'display');
            // if geocoder menu is displayed
            if (display === 'block') {
                this._hideGeolocatorMenu();
            } else {
                this._showGeolocatorMenu();
            }
        },
        // show autolocate menu
        _showResultsMenu: function () {
            // add class to container
            domClass.add(this.containerNode, this._css.GeocoderActiveClass);
            domClass.add(this.domNode, this._css.GeocoderResultsOpenClass);
            // show node
            domStyle.set(this.resultsNode, 'display', 'block');
            // aria
            domAttr.set(this.resultsNode, 'aria-hidden', 'false');
        },
        // hide the results menu
        _hideResultsMenu: function () {
            // hide
            domStyle.set(this.resultsNode, 'display', 'none');
            // add class to container
            domClass.remove(this.containerNode, this._css.GeocoderActiveClass);
            domClass.remove(this.domNode, this._css.GeocoderResultsOpenClass);
            // aria
            domAttr.set(this.resultsNode, 'aria-hidden', 'true');
        },
        // hide both menus
        _hideMenus: function () {
            this._hideGeolocatorMenu();
            this._hideResultsMenu();
        },
        // create menu for changing active geocoder
        _insertGeocoderMenuItems: function () {
            if (this.get("geocoderMenu") && this._geocoders && this._geocoders.length > 1) {
                var html = '';
                var layerClass = '',
                    i;
                html += '<ul role="presentation">';
                for (i = 0; i < this._geocoders.length; i++) {
                    // set layer class
                    layerClass = this._css.resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += this._css.resultsItemOddClass;
                    } else {
                        // even
                        layerClass += this._css.resultsItemEvenClass;
                    }
                    if (i === this.get("activeGeocoderIndex")) {
                        // currently selected geocoder
                        layerClass += ' ' + this._css.geocoderSelectedClass;
                    }
                    if (i === 0) {
                        // first in list
                        layerClass += ' ' + this._css.resultsItemFirstClass;
                    } else if (i === (this._geocoders.length - 1)) {
                        // last in list
                        layerClass += ' ' + this._css.resultsItemLastClass;
                    }
                    // geocoder name
                    var geocoderName = this._geocoders[i].name || i18n.widgets.Geocoder.main.untitledGeocoder;
                    // create list item
                    html += '<li data-index="' + i + '" data-item="true" role="menuitem" tabindex="0" class="' + layerClass + '">';
                    html += '<div class="' + this._css.geocoderSelectedCheckClass + '"></div>';
                    html += geocoderName;
                    html += '<div class="' + this._css.GeocoderClearClass + '"></div>';
                    html += '</li>';
                }
                // close list
                html += '</ul>';
                this.geocoderMenuInsertNode.innerHTML = html;
                // create menu event
                this._geocoderMenuEvent();
                // set display for nodes
                domStyle.set(this.geocoderMenuNode, 'display', 'none');
                domStyle.set(this.geocoderMenuArrowNode, 'display', 'block');
                // add class
                domClass.add(this.containerNode, this._css.GeocoderMultipleClass);
            } else {
                // remove html
                this.geocoderMenuInsertNode.innerHTML = '';
                // set display for nodes
                domStyle.set(this.geocoderMenuNode, 'display', 'none');
                domStyle.set(this.geocoderMenuArrowNode, 'display', 'none');
                // add class
                domClass.remove(this.containerNode, this._css.GeocoderMultipleClass);
            }
        },
        // check input box's status
        _checkStatus: function () {
            // if input value is not empty
            if (this.get("value")) {
                // add class to dom
                domClass.add(this.containerNode, this._css.hasValueClass);
                // set class and title
                domAttr.set(this.clearNode, 'title', i18n.widgets.Geocoder.main.clearButtonTitle);
            } else {
                // clear address
                this.clear();
            }
        },
        _autoCompleteEvent: function () {
            // list items
            var lists = query('[data-item="true"]', this.resultsNode);
            // remove event
            if (this._acEvent) {
                this._acEvent.remove();
            }
            // list item click
            this._acEvent = on(lists, 'click, keydown', lang.hitch(this, function (e) {
                // clear timeout for query
                this._clearQueryTimeout();
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
                    // we have results and index
                    if (this.get("results") && this.get("results")[resultIndex]) {
                        // result
                        var result = this.get("results")[resultIndex];
                        // if result has name
                        if (result.name) {
                            // select result
                            this.select(result);
                        } else {
                            // its a a suggest result
                            var text = result.text;
                            var magicKey = result.magicKey || null;
                            // new immediate query for result
                            var params = {
                                delay: 0,
                                search: text,
                                magicKey: magicKey
                            };
                            // perform query
                            this._query(params).then(lang.hitch(this, function (response) {
                                // select location
                                this.select(response.results[0]);
                            }));
                        }
                    }
              }
              else if (e.type === 'keydown' && (e.keyCode === keys.BACKSPACE || e.keyCode === keys.DELETE)) {
                event.stop(e);
                this.inputNode.focus();
                // backspace from current value
                var newVal = this.inputNode.value.slice(0,-1);
                domAttr.set(this.inputNode, 'value', newVal);
                this.set("value", newVal);
              }  
              else if (e.type === 'keydown' && e.keyCode === keys.UP_ARROW) {
                    event.stop(e);
                    // go to previous item
                    newIndex = resultIndex - 1;
                    // if first item
                    if (newIndex < 0) {
                        // go back to input
                        this.inputNode.focus();
                    } else {
                        // go to previous item
                        lists[newIndex].focus();
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.DOWN_ARROW) {
                    event.stop(e);
                    // go to next item
                    newIndex = resultIndex + 1;
                    // if last item
                    if (newIndex >= lists.length) {
                        // go to input node
                        this.inputNode.focus();
                    } else {
                        // go to next item
                        lists[newIndex].focus();
                    }
                } else if (e.keyCode === keys.ESCAPE) { // esc key
                    // hide menus
                    this._hideMenus();
                }
            }));
        },
        _geocoderMenuEvent: function () {
            // list items
            var lists = query('[data-item="true"]', this.geocoderMenuInsertNode);
            // remove event
            if (this._gmEvent) {
                this._gmEvent.remove();
            }
            // select geocoder item
            this._gmEvent = on(lists, 'click, keydown', lang.hitch(this, function (e) {
                // index of list item
                var resultIndex = parseInt(domAttr.get(e.currentTarget, 'data-index'), 10);
                // next/previous index
                var newIndex;
                if (e.type === 'click' || (e.type === 'keydown' && e.keyCode === keys.ENTER)) {
                    // change to geocoder
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
        _removeEvents: function () {
            var i;
            // if delegations
            if (this._events && this._events.length) {
                // disconnect all events
                for (i = 0; i < this._events.length; i++) {
                    this._events[i].remove();
                }
            }
            if (this._acEvent) {
                this._acEvent.remove();
            }
            if (this._gmEvent) {
                this._gmEvent.remove();
            }
            // array of all connections
            this._events = [];
        },
        // set up connections
        _setupEvents: function () {
            this._removeEvents();
            // close on click
            var closeOnClick = on(document, "click", lang.hitch(this, function (e) {
                this._hideResultsMenu(e);
            }));
            this._events.push(closeOnClick);
            // input key up
            var inputKeyUp = on(this.inputNode, "keyup", lang.hitch(this, function (e) {
                this._inputKeyUp(e);
            }));
            this._events.push(inputKeyUp);
            // input key down
            var inputKeyDown = on(this.inputNode, "keydown", lang.hitch(this, function (e) {
                this._inputKeyDown(e);
            }));
            this._events.push(inputKeyDown);
            // arrow key down
            var geocoderMenuButtonKeyDown = on(this.geocoderMenuArrowNode, "keydown", this._geocoderMenuButtonKeyDown());
            this._events.push(geocoderMenuButtonKeyDown);
            // if map set
            if (this.get("map")) {
                var mapClick = on(this.get("map"), "click", lang.hitch(this, function () {
                    this.blur();
                }));
                this._events.push(mapClick);
            }
            this._geocoderMenuEvent();
            this._autoCompleteEvent();
        },
        // find then immediately select first result
        _findThenSelect: function () {
            this.find().then(lang.hitch(this, function (response) {
                // if we have a result
                if (response.results && response.results.length) {
                    // select result
                    this.select(response.results[0]);
                    // emit event
                    this.onEnterKeySelect();
                }
            }));
        },
        // key up event on input box
        _inputKeyUp: function (e) {
            if (e) {
                // Reset timer between keys
                this._clearQueryTimeout();
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
                if (e.ctrlKey || e.shiftKey || e.metaKey || e.altKey || e.keyCode === keys.copyKey || e.keyCode === keys.ALT || e.keyCode === keys.CTRL || e.keyCode === keys.META || e.keyCode === keys.SHIFT || e.keyCode === keys.UP_ARROW || e.keyCode === keys.DOWN_ARROW || e.keyCode === keys.LEFT_ARROW || e.keyCode === keys.RIGHT_ARROW) {
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
                } else if (this.get("autoComplete") && alength >= this.get("minCharacters")) {
                    this._autoComplete();
                } else {
                    // hide menus
                    this._hideMenus();
                }
                // check status of search box
                this._checkStatus();
            }
        },
        // stop existing queries
        _cancelDeferreds: function () {
            if (this._deferreds.length) {
                for (var i = 0; i < this._deferreds.length; i++) {
                    // cancel deferred
                    this._deferreds[i].cancel('Geocoder:: stop query');
                }
                this._deferreds = [];
            }
        },
        // key down event on input box
        _inputKeyDown: function (e) {
            var lists = query('[data-item="true"]', this.resultsNode);
            if (e && e.keyCode === keys.TAB) {
                this._cancelDeferreds();
                // hide menus if opened
                this._hideMenus();
                // stop
                return;
            } else if (e && e.keyCode === keys.UP_ARROW) {
                event.stop(e);
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (e && e.keyCode === keys.DOWN_ARROW) {
                event.stop(e);
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
            }
        },
        // geocoder menu arrow key down
        _geocoderMenuButtonKeyDown: function (e) {
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
        _inputClick: function () {
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
        _hydrateResult: function (e) {
            // result to add
            var newResult = {}, sR = this._defaultSR, attributes, geometry;
            // set default spatial reference
            if (this.get("map")) {
                sR = this.get("map").spatialReference;
            }
            // suggest api result
            if (e.hasOwnProperty('text') && e.hasOwnProperty('magicKey')) {
                // don't do anything
                return e;
            }
            // need feature graphic
            if (e.hasOwnProperty('feature')) {
                // create graphic feature
                newResult.feature = new Graphic(e.feature);
                geometry = newResult.feature.geometry;
                // fix goemetry SR
                if (geometry) {
                    geometry.setSpatialReference(sR);
                }
            }
            // already a feature
            else if (e.hasOwnProperty('geometry')) {
                // create graphic feature
                var symbol = e.symbol || null;
                attributes = e.attributes || {};
                var infoTemplate = e.infoTemplate || null;
                newResult.feature = new Graphic(e.geometry, symbol, attributes, infoTemplate);
                geometry = newResult.feature.geometry;
                // fix goemetry SR
                if (geometry) {
                    geometry.setSpatialReference(sR);
                }
            }
            // address candidates geocoder
            else if (e.hasOwnProperty('location')) {
                // create point
                var pt = new Point(e.location.x, e.location.y, sR);
                // create attributes
                attributes = {};
                // set attributes
                if (e.hasOwnProperty('attributes')) {
                    attributes = e.attributes;
                }
                // set score
                if (e.hasOwnProperty('score')) {
                    attributes.score = e.score;
                }
                // create graphic feature
                newResult.feature = new Graphic(pt, null, attributes, null);
            } else {
                newResult.feature = null;
            }
            // need extent
            if (e.hasOwnProperty('extent')) {
                // set extent
                newResult.extent = new Extent(e.extent);
                // set spatial ref
                newResult.extent.setSpatialReference(new SpatialReference(sR));
            } else if (newResult.feature && newResult.feature.geometry) {
                // create extent from geometry
                switch (newResult.feature.geometry.type) {
                case "extent":
                    // get oint from center of extent
                    newResult.extent = newResult.feature.geometry;
                    break;
                case "multipoint":
                    // get extent from multipoint, then get center of that
                    newResult.extent = newResult.feature.geometry.getExtent();
                    break;
                case "polygon":
                    // get extent from polygon then get center
                    newResult.extent = newResult.feature.geometry.getExtent();
                    break;
                case "polyline":
                    // get extent from line, then get center
                    newResult.extent = newResult.feature.geometry.getExtent();
                    break;
                case "point":
                    // use geometry as is
                    if (this.get("map")) {
                        // current map scale is greater than zoomScale
                        if (this.get("map").getScale() > this.get("zoomScale")) {
                            // get extent for scale at zoom scale
                            newResult.extent = scaleUtils.getExtentForScale(this.get("map"), this.get("zoomScale")).centerAt(newResult.feature.geometry);
                        } else {
                            // use centered extent at current scale
                            newResult.extent = this.get("map").extent.centerAt(newResult.feature.geometry);
                        }
                    } else {
                        // create extent
                        newResult.extent = new Extent({
                            "xmin": newResult.feature.geometry.x - 0.25,
                            "ymin": newResult.feature.geometry.y - 0.25,
                            "xmax": newResult.feature.geometry.x + 0.25,
                            "ymax": newResult.feature.geometry.y + 0.25,
                            "spatialReference": {
                                "wkid": 4326
                            }
                        });
                    }
                    break;
                }  
            } else {
                newResult.extent = null;
            }
            // need name
            if (e.hasOwnProperty('name')) {
                newResult.name = e.name;
            }
            // set name for layer query
            else if (this.activeGeocoder.type === 'query' && this.activeGeocoder.field && e.hasOwnProperty('attributes') && e.attributes.hasOwnProperty(this.activeGeocoder.field)) {
                newResult.name = e.attributes[this.activeGeocoder.field];
            }
            // set name for address
            else if (e.hasOwnProperty('address') && typeof e.address === 'string') {
                newResult.name = e.address;
            }
            // set name for address 2
            else if (e.hasOwnProperty('address') && typeof e.address === 'object' && e.address.hasOwnProperty('Address')) {
                newResult.name = e.address.Address;
            }
            // set name for x,y
            else if (newResult.feature && newResult.feature.geometry) {
                newResult.name = newResult.feature.geometry.x + ',' + newResult.feature.geometry.y;
            } else {
                newResult.name = '';
            }
            return newResult;
        },
        // create Extent and Graphic objects from JSON
        _hydrateResults: function (e) {
            // return results array
            var results = [],
                i = 0;
            // if results
            if (e && e.length) {
                for (i; i < e.length; i++) {
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