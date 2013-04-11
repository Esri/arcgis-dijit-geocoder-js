define([
    "dojo/_base/declare",
    "dojo/_base/connect",
    "dojo/_base/lang",
    "dojo/_base/Deferred",
    "dojo/_base/event",
    "dojo/dom-construct",
    "dojo/json",
    "dojo/keys",
    "dojo/on",
    "dojo/query",
    "dojo/i18n!./nls/jsapi",
    "dojo/text!./templates/Geocoder.html",
	//"dojo/i18n!esri/nls/jsapi",
    //"dojo/text!esri/dijit/templates/Geocoder.html",
    "dojo/uacss",

    "dijit/_OnDijitClickMixin",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetBase",
    "dijit/focus",

    "esri/kernel",
    "esri/SpatialReference",
    "esri/graphic",
    "esri/request",

    "esri/geometry/Point",
    "esri/geometry/Extent",
    "esri/tasks/locator"
],
function(
declare, connect, lang, Deferred, event, domConstruct, JSON, keys, on, query, i18n, template, has, _OnDijitClickMixin, _TemplatedMixin, _WidgetBase, focusUtil, esriNS, SpatialReference, Graphic, esriRequest, Point, Extent, Locator) {
    var Widget = declare([_WidgetBase, _OnDijitClickMixin, _TemplatedMixin], {
        declaredClass: "esri.dijit.Geocoder",
        // Set template file HTML
        templateString: template,
        // init
        constructor: function(options, srcRefNode) {
            var _self = this;
            // set default settings
            _self._setPublicDefaults();
            // mix in settings and defaults
            declare.safeMixin(_self, options);
            // private variables
            _self._setPrivateDefaults();
            // watch updates of public properties and update the widget accordingly
            _self.watch("value", _self._updateValue);
            _self.watch("theme", _self._updateTheme);
            _self.watch("activeGeocoder", _self._setActiveGeocoder);
            _self.watch("activeGeocoderIndex", _self._setActiveGeocoderIndex);
            _self.watch("geocoder", _self._updateGeocoder);
            _self.watch("arcgisGeocoder", _self._updateGeocoder);
        },
        /* ---------------- */
        /* Public Functions */
        /* ---------------- */
        // start widget
        startup: function() {
            var _self = this;
            if (!_self._geocoders.length) {
                console.log('No geocoders defined.');
                _self.destroy();
                return;
            }
            if (!_self.domNode) {
                console.log('domNode is undefined.');
                _self.destroy();
                return;
            }
            // add clear button if already populated
            if (_self.get("value")) {
                _self._checkStatus();
            }
            // if map is in options
            if (_self.map) {
                // once map is loaded
                if (_self.map.loaded) {
                    _self._init();
                } else {
                    connect.connect(_self.map, "onLoad", function() {
                        _self._init();
                    });
                }
            } else {
                // lets go
                _self._init();
            }
        },
        // post create widget function
        postCreate: function() {
            var _self = this;
            // build geocoder list
            _self._updateGeocoder();
            // reverse Geocoder
            _self._reverseTask = new Locator(_self._arcgisGeocoder.url);
            // spatial ref output
            _self._reverseTask.outSpatialReference = _self._defaultSR;
            if (_self.map) {
                _self._reverseTask.outSpatialReference = _self.map.spatialReference;
            }
            // setup connections
            _self._setDelegations();
        },
        destroy: function() {
            var i;
            var _self = this;
            // if delegations
            if (_self._delegations) {
                // disconnect all events
                for (i = 0; i < _self._delegations.length; i++) {
                    _self._delegations[i].remove();
                }
            }
            // remove html
            domConstruct.empty(_self.domNode);
            _self.inherited(arguments);
        },
        // clear the input box
        clear: function() {
            var _self = this;
            // clear event
            _self.onClear();
            // if geocoder is ready
            if (_self.loaded) {
                // empty input value
                query(_self.inputNode).attr('value', '');
            }
            // set current text
            _self.set("value", '');
            // empty results
            _self.results = [];
            // get node of reset button and remove it's active class
            if (_self.loaded) {
                query(_self.containerNode).removeClass(_self._hasValueClass);
                query(_self.clearNode).attr('title', '');
            }
            // remove active menus
            _self._hideMenus();
            // hide loading
            _self._hideLoading();
        },
        // show widget
        show: function() {
            var _self = this;
            if (_self.loaded) {
                query(_self.domNode).style('display', 'block');
            }
        },
        // hide widget
        hide: function() {
            var _self = this;
            if (_self.loaded) {
                query(_self.domNode).style('display', 'none');
            }
        },
        // submit button selected
        find: function(search) {
            var _self = this;
            // set deferred variable
            var def = new Deferred();
            if (search) {
                if (typeof search === 'string') {
                    _self._queryThenLocate(def, search);
                } else if (typeof search === 'object' && search.type === 'point') {
                    // point geometry
                    _self._reverseGeocodePoint(search, def);
                } else if (search instanceof Array && search.length === 2) {
                    // long, lat
                    var pt = new Point(search, new SpatialReference({
                        wkid: 4326
                    }));
                    _self._reverseGeocodePoint(pt, def);
                } else {
                    def.cancel('Invalid find type');
                }
            } else {
                _self._queryThenLocate(def, _self.get('value'));
            }
            // give me my deferred
            return def;
        },
        // focus on input
        focus: function() {
            var _self = this;
            if (_self.loaded) {
                focusUtil.focus(_self.inputNode);
            }
        },
        // blur input
        blur: function() {
            var _self = this;
            if (_self.loaded && focusUtil.curNode) {
                focusUtil.curNode.blur();
            }
        },
        // go to a location
        select: function(e) {
            var _self = this;
            // event
            _self.onSelect(e);
            // hide menus
            _self._hideMenus();
            // hide loading spinner
            _self._hideLoading();
            // has extent and autoNavigate
            if (_self.autoNavigate && e && e.hasOwnProperty('extent') && _self.map) {
                // set map extent to location
                _self.map.setExtent(e.extent);
            }
        },
        /* ---------------- */
        /* Public Events */
        /* ---------------- */
        // called after search has been selected
        onSelect: function(e) {},
        // called on results
        onFindResults: function(e) {},
        // called on results
        onAutoComplete: function(e) {},
        // when geocoder selected
        onGeocoderSelect: function(e) {},
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
            var _self = this;
            // set widget ready
            _self.loaded = true;
            // loaded
            _self.onLoad();
        },
        _queryThenLocate: function(def, search) {
            var _self = this;
            // query and then Locate
            _self._query({
                delay: 0,
                search: search
            }).then(function(response) {
                _self.onFindResults(response);
                if (def) {
                    def.resolve(response);
                }
            });
        },
        _reverseGeocodePoint: function(pt, def) {
            var _self = this;
            if (pt) {
                _self._reverseTask.locationToAddress(pt, _self.locatorDistance, function(response) {
                    var result = _self._hydrateResult(response);
                    _self.onFindResults(result);
                    if (def) {
                        def.resolve(result);
                    }
                }, function(error) {
                    def.cancel(error);
                });
            }
        },
        // default settings
        _setPublicDefaults: function() {
            var _self = this;
            // show autocomplete?
            _self.autoComplete = false;
            // use esri geocoder
            _self.arcgisGeocoder = true;
            // Value of input
            _self.set("value", '');
            // Theme
            _self.set("theme", 'simpleGeocoder');
            // locator distance
            _self.locatorDistance = 1000;
            // default geocoder index
            _self.activeGeocoderIndex = 0;
            // Maximum result locations to return
            _self.maxLocations = 6;
            // Minimum amount of characters before searching
            _self.minCharacters = 3;
            // Delay before doing the query. To avoid being too chatty.
            _self.searchDelay = 350;
            // Show geocoder menu if necessary
            _self.geocoderMenu = true;
            // Automatically navigate
            _self.autoNavigate = true;
            // show result suggestions
            _self.showResults = true;
        },
        // set variables that aren't to be modified
        _setPrivateDefaults: function() {
            var _self = this;
            _self._i18n = i18n;
            // deferreds
            _self._deferreds = [];
            // results holder
            _self.results = [];
            // default Spatial Ref
            _self._defaultSR = new SpatialReference(4326);
            // css classes
            _self._GeocoderContainerClass = 'esriGeocoderContainer';
            _self._GeocoderClass = 'esriGeocoder';
            _self._GeocoderMultipleClass = 'esriGeocoderMultiple';
            _self._GeocoderIconClass = 'esriGeocoderIcon';
            _self._GeocoderActiveClass = 'esriGeocoderActive';
            _self._loadingClass = 'esriGeocoderLoading';
            _self._resultsContainerClass = 'esriGeocoderResults';
            _self._resultsItemClass = 'esriGeocoderResult';
            _self._resultsItemEvenClass = 'esriGeocoderResultEven';
            _self._resultsItemOddClass = 'esriGeocoderResultOdd';
            _self._resultsItemFirstClass = 'esriGeocoderResultFirst';
            _self._resultsItemLastClass = 'esriGeocoderResultLast';
            _self._resultsPartialMatchClass = 'esriGeocoderResultPartial';
            _self._searchButtonClass = 'esriGeocoderSearch';
            _self._clearButtonClass = 'esriGeocoderReset';
            _self._hasValueClass = 'esriGeocoderHasValue';
            _self._geocoderMenuClass = 'esriGeocoderMenu';
            _self._geocoderMenuHeaderClass = 'esriGeocoderMenuHeader';
            _self._geocoderMenuCloseClass = 'esriGeocoderMenuClose';
            _self._activeMenuClass = 'esriGeocoderMenuActive';
            _self._geocoderMenuArrowClass = 'esriGeocoderMenuArrow';
            _self._geocoderSelectedClass = 'esriGeocoderSelected';
            _self._geocoderSelectedCheckClass = 'esriGeocoderSelectedCheck';
            _self._GeocoderClearClass = 'esriGeocoderClearFloat';
        },
        // setup esri geocoder
        _setEsriGeocoder: function() {
            var _self = this;
            if (_self.arcgisGeocoder) {
                // if object defined for esri geocoder
                if (typeof _self.arcgisGeocoder === 'object') {
                    _self._arcgisGeocoder = _self.arcgisGeocoder;
                } else {
                    _self._arcgisGeocoder = {};
                }
                // ArcGIS Geocoder URL
                if (!_self._arcgisGeocoder.url) {
                    // set esri geocoder options
                    _self._arcgisGeocoder.url = location.protocol + "//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
                }
                // if name not set
                if (!_self._arcgisGeocoder.name) {
                    _self._arcgisGeocoder.name = i18n.widgets.Geocoder.esriGeocoderName;
                }
                // local search
                if (!_self._arcgisGeocoder.hasOwnProperty('localSearchOptions')) {
                    _self._arcgisGeocoder.localSearchOptions = {
                        minScale: 150000,
                        distance: 12000
                    };
                }
                _self.arcgisGeocoder = _self._arcgisGeocoder;
            } else {
                _self.arcgisGeocoder = false;
            }
        },
        // sets current locator object
        _setActiveGeocoder: function() {
            var _self = this;
            // set current active geocoder object
            _self.activeGeocoder = _self._geocoders[_self.activeGeocoderIndex];
            // update placeholder nodes
            _self._updatePlaceholder();
        },
        // Combine and count all geocoders
        _setGeocoderList: function() {
            var _self = this;
            var geocoders = [];
            if (_self.arcgisGeocoder) {
                geocoders = geocoders.concat([_self._arcgisGeocoder]);
            }
            if (_self.geocoders && _self.geocoders.length) {
                geocoders = geocoders.concat(_self.geocoders);
            }
            _self._geocoders = geocoders;
        },
        // Update geocoder nodes
        _updateGeocoder: function() {
            var _self = this;
            _self.set("activeGeocoderIndex", 0);
            _self._setEsriGeocoder();
            _self._setGeocoderList();
            _self._setActiveGeocoder();
            _self._insertGeocoderMenuItems();
        },
        // Update placeholder nodes
        _updatePlaceholder: function() {
            var _self = this;
            if (_self.loaded) {
                _self._placeholder = '';
                // if placeholder of active geocoder is set
                if (_self.activeGeocoder && _self.activeGeocoder.placeholder) {
                    _self._placeholder = _self.activeGeocoder.placeholder;
                }
                query(_self.inputNode).attr('placeholder', _self._placeholder);
                query(_self.submitNode).attr('title', _self._placeholder);
            }
        },
        // update value of text box
        _updateValue: function(attr, oldVal, newVal) {
            var _self = this;
            if (_self.loaded && !_self._ignoreUpdateValue) {
                query(_self.inputNode).attr('value', newVal);
                _self._checkStatus();
            }
        },
        // update theme
        _updateTheme: function(attr, oldVal, newVal) {
            var _self = this;
            if (_self.loaded) {
                query(_self.domNode).removeClass(oldVal).addClass(newVal);
            }
        },
        // change active geocoder
        _setActiveGeocoderIndex: function(attr, oldVal, newVal) {
            var _self = this;
            _self.activeGeocoderIndex = newVal;
            // set geocoder object
            _self._setActiveGeocoder();
            _self._hideMenus();
            _self._insertGeocoderMenuItems();
            var evt = {
                attr: _self.activeGeocoder,
                oldVal: oldVal,
                newVal: newVal
            };
            _self.onGeocoderSelect(evt);
        },
        // query for results and then execute a function
        _query: function(e) {
            var _self = this;
            if (!e) {
                e = {
                    delay: 0,
                };
            }
            if(!e.search){
                e.search = _self.get("value");
            }
            // set deferred variable if needed to cancel it
            var def = new Deferred();
            _self._deferreds.push(def);
            // timeout
            _self._queryTimer = setTimeout(function() {
                _self._performQuery(def, e);
            }, e.delay);
            return def;
        },
        // when geocoder search starts
        _performQuery: function(def, e) {
            var _self = this;
            // if query isn't empty
            if (e.search) {
                // hide menu to toggle geocoder
                _self._hideGeolocatorMenu();
                // show loading spinner
                _self._showLoading();
                // query parameters
                var params;
                // Fields
                var outFields = _self.activeGeocoder.outFields || '';
                // single line query
                var singleLine = '';
                // query prefix
                if (_self.activeGeocoder.prefix) {
                    singleLine += _self.activeGeocoder.prefix;
                }
                // query value
                singleLine += e.search;
                // query suffix
                if (_self.activeGeocoder.suffix) {
                    singleLine += _self.activeGeocoder.suffix;
                }
                // if we can use the find function
                if (_self.activeGeocoder === _self._arcgisGeocoder) {
                    var mapSR = _self._defaultSR;
                    if (_self.map) {
                        mapSR = _self.map.spatialReference;
                    }
                    // Query object
                    params = {
                        "text": singleLine,
                        "outSR": mapSR.wkid || JSON.stringify(mapSR.toJson()),
                        "f": "json"
                    };
                    if (_self.map && _self.activeGeocoder.localSearchOptions && _self.activeGeocoder.localSearchOptions.hasOwnProperty('distance') && _self.activeGeocoder.localSearchOptions.hasOwnProperty('minScale')) {
                        // set center point
                        var normalizedPoint = _self.map.extent.getCenter().normalize();
                        // current scale of map
                        var scale = _self.map.getScale();
                        // location search will be performed when the map scale is less than minScale.
                        if (!_self.activeGeocoder.localSearchOptions.minScale || (scale && scale <= parseFloat(_self.activeGeocoder.localSearchOptions.minScale))) {
                            params.location = JSON.stringify(normalizedPoint.toJson());
                            params.distance = _self.activeGeocoder.localSearchOptions.distance;
                        }
                    }
                    // if outfields
                    if (outFields) {
                        params.outFields = outFields;
                    }
                    // if max locations set
                    if (_self.maxLocations) {
                        params.maxLocations = _self.maxLocations;
                    }
                    // Esri Geocoder country
                    if (_self.activeGeocoder.sourceCountry) {
                        params.sourceCountry = _self.activeGeocoder.sourceCountry;
                    }
                    // local results only
                    if (_self.activeGeocoder.searchExtent) {
                        var bbox = {
                            "xmin": _self.activeGeocoder.searchExtent.xmin,
                            "ymin": _self.activeGeocoder.searchExtent.ymin,
                            "xmax": _self.activeGeocoder.searchExtent.xmax,
                            "ymax": _self.activeGeocoder.searchExtent.ymax,
                            "spatialReference": _self.activeGeocoder.searchExtent.spatialReference.toJson()
                        };
                        params.bbox = JSON.stringify(bbox);
                    }
                    // send request
                    var requestHandle = esriRequest({
                        url: _self.activeGeocoder.url + '/find',
                        content: params,
                        handleAs: 'json',
                        callbackParamName: 'callback',
                        // on load
                        load: function(response) {
                            _self._receivedResults(response.locations, def);
                        }
                    });
                } else {
                    // Params
                    params = {
                        address: {}
                    };
                    if (_self.activeGeocoder.singleLineFieldName) {
                        params.address[_self.activeGeocoder.singleLineFieldName] = singleLine;
                    } else {
                        params.address["Single Line Input"] = singleLine;
                    }
                    // if outfields
                    if (outFields) {
                        params.outFields = [outFields];
                    }
                    // within extent
                    if (_self.activeGeocoder.searchExtent) {
                        params.searchExtent = _self.activeGeocoder.searchExtent;
                    }
                    // Geocoder
                    _self._task = new Locator(_self.activeGeocoder.url);
                    // spatial ref output
                    _self._task.outSpatialReference = _self._defaultSR;
                    if (_self.map) {
                        _self._task.outSpatialReference = _self.map.spatialReference;
                    }
                    // query for location
                    _self._task.addressToLocations(params, function(response) {
                        _self._receivedResults(response, def);
                    }, function(response) {
                        _self._receivedResults(response, def);
                    });
                }
            } else {
                _self._hideLoading();
                def.resolve();
            }
        },
        // called on AC Results
        _showResults: function(e) {
            var _self = this;
            // hide menu to toggle geocoder
            _self._hideGeolocatorMenu();
            // string to set
            var html = '';
            // if results and result node
            if (_self.results && _self.results.length && _self.resultsNode) {
                // textbox value
                var partialMatch = _self.get("value"),
                    i;
                // partial match highlight
                var regex = new RegExp('(' + partialMatch + ')', 'gi');
                html += '<ul role="presentation">';
                // for each result
                for (i = 0; i < _self.results.length; ++i) {
                    // set layer class
                    var layerClass = _self._resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += _self._resultsItemOddClass;
                    } else {
                        layerClass += _self._resultsItemEvenClass;
                    }
                    if (i === 0) {
                        layerClass += ' ' + _self._resultsItemFirstClass;
                    } else if (i === (_self.results.length - 1)) {
                        layerClass += ' ' + _self._resultsItemLastClass;
                    }
                    // create list item
                    html += '<li data-text="' + _self.results[i].name + '" data-item="true" data-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + _self.results[i].name.replace(regex, '<strong class="' + _self._resultsPartialMatchClass + '">' + partialMatch + '</strong>') + '</li>';
                }
                // close list
                html += '</ul>';
                // insert HTML
                if (_self.resultsNode) {
                    _self.resultsNode.innerHTML = html;
                }
                // show!
                _self._showResultsMenu();
            }
        },
        // ac query
        _autocomplete: function() {
            var _self = this;
            _self._query({
                delay: _self.searchDelay,
                search: _self.get("value")
            }).then(function(response) {
                _self.onAutoComplete(response);
                if (_self.showResults) {
                    _self._showResults(response);
                }
            });
        },
        // received results
        _receivedResults: function(response, def) {
            var _self = this;
            // hide loading spinner
            _self._hideLoading();
            // format results
            var results = _self._hydrateResults(response);
            // save results
            _self.results = results;
            // results object
            var obj = {
                "results": results,
                "value": _self.get("value")
            };
            def.resolve(obj);
        },
        // show loading spinner
        _showLoading: function() {
            var _self = this;
            if (_self.loaded) {
                query(_self.containerNode).addClass(_self._loadingClass);
            }
        },
        // hide loading spinner
        _hideLoading: function() {
            var _self = this;
            if (_self.loaded) {
                query(_self.containerNode).removeClass(_self._loadingClass);
            }
        },
        // show geocoder selection menu
        _showGeolocatorMenu: function() {
            var _self = this;
            if (_self.loaded) {
                // add class to container
                query(_self.containerNode).addClass(_self._activeMenuClass);
                // display menu node
                query(_self.geocoderMenuNode).style('display', 'block');
                // aria
                query(_self.geocoderMenuInsertNode).attr('aria-hidden', 'false');
                query(_self.geocoderMenuArrowNode).attr('aria-expanded', 'true');
            }
        },
        // hide geocoder selection menu
        _hideGeolocatorMenu: function() {
            var _self = this;
            if (_self.loaded) {
                // container node
                var container = query(_self.containerNode);
                // add class to container
                container.removeClass(_self._activeMenuClass);
                query(_self.geocoderMenuNode).style('display', 'none');
                // aria
                query(_self.geocoderMenuInsertNode).attr('aria-hidden', 'true');
                query(_self.geocoderMenuArrowNode).attr('aria-expanded', 'false');
            }
        },
        // toggle geocoder selection menu
        _toggleGeolocatorMenu: function() {
            var _self = this;
            _self._hideResultsMenu();
            if (_self.loaded) {
                var display = query(_self.geocoderMenuNode).style('display');
                if (display[0] === 'block') {
                    _self._hideGeolocatorMenu();
                } else {
                    _self._showGeolocatorMenu();
                }
            }
        },
        // show autolocate menu
        _showResultsMenu: function() {
            var _self = this;
            if (_self.loaded) {
                // add class to container
                query(_self.containerNode).addClass(_self._GeocoderActiveClass);
                // show node
                query(_self.resultsNode).style('display', 'block');
                // aria
                query(_self.resultsNode).attr('aria-hidden', 'false');
            }
        },
        // hide the results menu
        _hideResultsMenu: function() {
            var _self = this;
            if (_self.loaded) {
                // hide
                query(_self.resultsNode).style('display', 'none');
                // add class to container
                query(_self.containerNode).removeClass(_self._GeocoderActiveClass);
                // aria
                query(_self.resultsNode).attr('aria-hidden', 'true');
            }
        },
        // hide both menus
        _hideMenus: function() {
            var _self = this;
            _self._hideGeolocatorMenu();
            _self._hideResultsMenu();
        },
        // create menu for changing active geocoder
        _insertGeocoderMenuItems: function() {
            var _self = this;
            if (_self.loaded) {
                if (_self.geocoderMenu && _self._geocoders.length > 1) {
                    var html = '';
                    var layerClass = '',
                        i;
                    html += '<ul role="presentation">';
                    for (i = 0; i < _self._geocoders.length; i++) {
                        // set layer class
                        layerClass = _self._resultsItemClass + ' ';
                        // if it's odd
                        if (i % 2 === 0) {
                            // set it to odd
                            layerClass += _self._resultsItemOddClass;
                        } else {
                            layerClass += _self._resultsItemEvenClass;
                        }
                        if (i === _self.activeGeocoderIndex) {
                            layerClass += ' ' + _self._geocoderSelectedClass;
                        }
                        if (i === 0) {
                            layerClass += ' ' + _self._resultsItemFirstClass;
                        } else if (i === (_self._geocoders.length - 1)) {
                            layerClass += ' ' + _self._resultsItemLastClass;
                        }
                        // geocoder name
                        var geocoderName = _self._geocoders[i].name || i18n.widgets.Geocoder.main.untitledGeocoder;
                        // create list item
                        html += '<li data-index="' + i + '" data-item="true" role="menuitem" tabindex="0" class="' + layerClass + '">';
                        html += '<div class="' + _self._geocoderSelectedCheckClass + '"></div>';
                        html += geocoderName;
                        html += '<div class="' + _self._GeocoderClearClass + '"></div>';
                        html += '</li>';
                    }
                    // close list
                    html += '</ul>';
                    _self.geocoderMenuInsertNode.innerHTML = html;
                    query(_self.geocoderMenuNode).style('display', 'none');
                    query(_self.geocoderMenuArrowNode).style('display', 'block');
                    query(_self.containerNode).addClass(_self._GeocoderMultipleClass);
                } else {
                    _self.geocoderMenuInsertNode.innerHTML = '';
                    query(_self.geocoderMenuNode).style('display', 'none');
                    query(_self.geocoderMenuArrowNode).style('display', 'none');
                    query(_self.containerNode).removeClass(_self._GeocoderMultipleClass);
                }
            }
        },
        // check input box's status
        _checkStatus: function() {
            var _self = this;
            if (_self.loaded) {
                // if input value is not empty
                if (_self.get("value")) {
                    // add class to dom
                    query(_self.containerNode).addClass(_self._hasValueClass);
                    // set class and title
                    query(_self.clearNode).attr('title', i18n.widgets.Geocoder.main.clearButtonTitle);
                } else {
                    // clear address
                    _self.clear();
                }
            }
        },
        // set up connections
        _setDelegations: function() {
            // isntance of class
            var _self = this;
            // array of all connections
            _self._delegations = [];
            // close on click
            var closeOnClick = on(document, "click", function(e) {
                _self._hideResultsMenu(e);
            });
            _self._delegations.push(closeOnClick);
            // input key up
            var inputKeyUp = on(_self.inputNode, "keyup", function(e) {
                _self._inputKeyUp(e);
            });
            _self._delegations.push(inputKeyUp);
            // input key down
            var inputKeyDown = on(_self.inputNode, "keydown", function(e) {
                _self._inputKeyDown(e);
            });
            _self._delegations.push(inputKeyDown);
            // arrow key down
            var geocoderMenuButtonKeyDown = on(_self.geocoderMenuArrowNode, "keydown", _self._geocoderMenuButtonKeyDown());
            _self._delegations.push(geocoderMenuButtonKeyDown);
            // list item click
            var listClick = on(_self.resultsNode, '[data-item="true"]:click, [data-item="true"]:keydown', function(e) {
                clearTimeout(_self._queryTimer);
                // all items
                var lists = query('[data-item="true"]', _self.resultsNode);
                // index of list item
                var resultIndex = parseInt(query(this).attr('data-index')[0], 10);
                // input box text
                var locTxt = query(this).attr('data-text');
                // next/previous index
                var newIndex;
                if (e.type === 'click' || (e.type === 'keydown' && e.keyCode === keys.ENTER)) {
                    // set input text value to text
                    query(_self.inputNode).attr('value', locTxt);
                    // set current text var
                    _self.set("value", locTxt);
                    if (_self.results && _self.results[resultIndex]) {
                        // Locate
                        _self.select(_self.results[resultIndex]);
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.UP_ARROW) {
                    event.stop(e);
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        _self.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.DOWN_ARROW) {
                    event.stop(e);
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        _self.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.keyCode === keys.ESCAPE) { // esc key
                    // clear timer
                    clearTimeout(_self._queryTimer);
                    // hide menus
                    _self._hideMenus();
                }
            });
            _self._delegations.push(listClick);
            // select geocoder item
            var geocoderMenuClick = on(_self.geocoderMenuInsertNode, '[data-item="true"]:click, [data-item="true"]:keydown', function(e) {
                // all items
                var lists = query('[data-item="true"]', _self.geocoderMenuInsertNode);
                // index of list item
                var resultIndex = parseInt(query(this).attr('data-index')[0], 10);
                // next/previous index
                var newIndex;
                if (e.type === 'click' || (e.type === 'keydown' && e.keyCode === keys.ENTER)) {
                    _self._setActiveGeocoderIndex(null, null, resultIndex);
                    _self._hideGeolocatorMenu();
                } else if (e.type === 'keydown' && e.keyCode === keys.UP_ARROW) {
                    event.stop(e);
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        _self.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.type === 'keydown' && e.keyCode === keys.DOWN_ARROW) {
                    event.stop(e);
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        _self.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (e.keyCode === keys.ESCAPE) { // esc key
                    _self._hideGeolocatorMenu();
                }
            });
            _self._delegations.push(geocoderMenuClick);
        },
        _findThenSelect: function() {
            var _self = this;
            _self.find().then(function(response) {
                if (response.results && response.results.length) {
                    _self.select(response.results[0]);
                    _self.onEnterKeySelect();
                }
            });
        },
        // key up event on input box
        _inputKeyUp: function(e) {
            var _self = this;
            if (e) {
                // Reset timer between keys
                clearTimeout(_self._queryTimer);
                // get textbox value
                var aquery = _self.inputNode.value;
                // don't update input
                _self._ignoreUpdateValue = true;
                // update current text variable
                _self.set("value", aquery);
                // update input
                _self._ignoreUpdateValue = false;
                // length of value
                var alength = 0;
                // if value
                if (aquery) {
                    // set length of value
                    alength = aquery.length;
                }
                var lists = query('[data-item="true"]', _self.resultsNode);
                // ignored keys
                if (e.keyCode === e.copyKey || e.ctrlKey || e.shiftKey || e.metaKey || e.altKey || e.keyCode === e.ALT || e.keyCode === e.CTRL || e.keyCode === e.META || e.keyCode === e.shiftKey || e.keyCode === keys.UP_ARROW || e.keyCode === keys.DOWN_ARROW || e.keyCode === keys.LEFT_ARROW || e.keyCode === keys.RIGHT_ARROW) {
                    return;
                } else if (e && e.keyCode === keys.ENTER) { // if enter key was pushed
                    // query then Locate
                    _self._findThenSelect();
                    // if up arrow pushed
                } else if (e && e.keyCode === keys.ESCAPE) { // esc key
                    // clear timer
                    clearTimeout(_self._queryTimer);
                    // hide menus
                    _self._hideMenus();
                } else if (_self.autoComplete && alength >= _self.minCharacters) {
                    _self._autocomplete();
                } else {
                    // hide menus
                    _self._hideMenus();
                }
                // check status of search box
                _self._checkStatus();
            }
        },
        _cancelDeferreds: function() {
            var _self = this;
            if (_self._deferreds.length) {
                for (var i = 0; i < _self._deferreds.length; i++) {
                    // cancel deferred
                    _self._deferreds[i].cancel('stop query');
                    _self._deferreds.splice(i, 1);
                }
            }
        },
        // key down event on input box
        _inputKeyDown: function(e) {
            var _self = this;
            var lists = query('[data-item="true"]', _self.resultsNode);
            if (e && e.keyCode === keys.TAB) {
                // hide menus if opened
                _self._hideMenus();
                _self._cancelDeferreds();
                // stop
                return;
            } else if (e && e.keyCode === keys.UP_ARROW) {
                event.stop(e);
                _self._cancelDeferreds();
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (e && e.keyCode === keys.DOWN_ARROW) {
                event.stop(e);
                _self._cancelDeferreds();
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
            }
        },
        // geocoder menu arrow key down
        _geocoderMenuButtonKeyDown: function(e) {
            var _self = this;
            var lists = query('[data-item="true"]', _self.geocoderMenuInsertNode);
            if (e && e.keyCode === keys.UP_ARROW) {
                event.stop(e);
                _self._showGeolocatorMenu();
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (e && e.keyCode === keys.DOWN_ARROW) {
                event.stop(e);
                _self._showGeolocatorMenu();
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
            }
        },
        // input box clicked
        _inputClick: function() {
            var _self = this;
            // hide geolocator switch
            _self._hideGeolocatorMenu();
            // if input value is empty
            if (!_self.get("value")) {
                // clear address
                _self.clear();
                // hide menus
                _self._hideMenus();
            }
            // check status of text box
            _self._checkStatus();
        },
        _hydrateResult: function(e) {
            var _self = this;
            var sR = _self._defaultSR;
            if (_self.map) {
                sR = _self.map.spatialReference;
            }
            // result to add
            var newResult = {},
                geometry;
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
                if (_self.map) {
                    newResult.extent = _self.map.extent.centerAt(point);
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
                } else if (e.hasOwnProperty('address') && typeof e.address === 'object') {
                    var address = '';
                    if (e.address.Address) {
                        address += e.address.Address + ' ';
                    }
                    if (e.address.City) {
                        address += e.address.City + ' ';
                    }
                    if (e.address.Region) {
                        address += e.address.Region + ' ';
                    }
                    if (e.address.Postal) {
                        address += e.address.Postal + ' ';
                    }
                    if (e.address.CountryCode) {
                        address += e.address.CountryCode + ' ';
                    }
                    newResult.name = lang.trim(address);
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
            var _self = this;
            // return results array
            var results = [];
            // if results
            if (e && e.length) {
                var i = 0;
                for (i; i < e.length && i < _self.maxLocations; i++) {
                    var newResult = _self._hydrateResult(e[i]);
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