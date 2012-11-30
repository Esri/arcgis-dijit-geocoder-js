require([
//define([
    "dojo/_base/declare",
    "dojo/_base/Deferred",
    "dojo/dom-construct",
    "dojo/i18n!./nls/jsapi.js",
    //"dojo/i18n!esri/nls/jsapi",
    "dojo/json",
    "dojo/keys",
    "dojo/on",
    "dojo/query",
    "dojo/text!./templates/Geocoder.html",
    //"dojo/text!esri/dijit/templates/Geocoder.html",
    "dojo/uacss",
    "dijit/_OnDijitClickMixin",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetBase",
    "esri", // We're not directly using anything defined in esri.js but geometry, locator and utils are not AMD. So, the only way to get reference to esri object is through esri module (ie. esri/main)
    "esri/geometry",
    "esri/tasks/locator",
    "esri/utils"
],
function(declare, Deferred, domConstruct, i18n, JSON, keys, on, query, template, has, _OnDijitClickMixin, _TemplatedMixin, _WidgetBase, esri) {
    declare("esri.dijit.Geocoder", [_WidgetBase, _OnDijitClickMixin, _TemplatedMixin], {
        // Set template file HTML
        templateString: template,
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
            this.watch("esriGeocoder", this._updateGeocoder);
        },
        // start widget
        startup: function() {
            // if all required options are set
            if (this.domNode && this.map) {
                // add clear button if already populated
                if (this.value) {
                    this._checkStatus();
                }
                // setup connections
                this._setDelegations();
            } else {
                console.log('Map or domNode undefined.');
            }
        },
        // post create widget function
        postCreate: function() {
            // set widget ready
            this.ready = true;
            // build geocoder list
            this._updateGeocoder();
        },
        // destroy widget
        destroy: function() {
            // remove html
            domConstruct.empty(this.domNode);
            var i;
            // if delegations
            if (this._delegations) {
                // disconnect all events
                for (i = 0; i < this._delegations.length; i++) {
                    this._delegations[i].remove();
                }
            }
        },
        // query for results and then execute a function
        query: function(e) {
            var _self = this;
            if (!e) {
                e = {
                    delay: 0
                };
            }
            if (this._deferred) {
                this._deferred.cancel('stop query');
            }
            // set deferred variable if needed to cancel it
            this._deferred = new Deferred();
            // timeout
            this._queryTimer = setTimeout(function() {
                _self.onSearchStart();
            }, e.delay);
            return this._deferred;
        },
        /* ---------------- */
        /* Public Events */
        /* ---------------- */
        // called after search has been selected
        onSelect: function(e) {
            // new locator
            if (e && e.hasOwnProperty('extent')) {
                // set map extent to location
                this.map.setExtent(e.extent);
            }
            return e;
        },
        // called on results
        onSearchResults: function(e) {
            this._select(e);
        },
        // called on results
        onAutoComplete: function(e) {
            this._showSuggestions(e);
        },
        // when geocoder search starts
        onSearchStart: function() {
            // if query isn't empty
            if (this.value) {
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
                // this
                var _self = this;
                // query prefix
                if (this.activeGeocoder.prefix) {
                    singleLine += this.activeGeocoder.prefix;
                }
                // query value
                singleLine += this.value;
                // query postfix
                if (this.activeGeocoder.postfix) {
                    singleLine += this.activeGeocoder.postfix;
                }
                // if we can use the find function
                if (this.activeGeocoder === this._esriGeocoder) {
                    // get geographic center point
                    var centerPoint = esri.geometry.webMercatorToGeographic(this.map.extent.getCenter());
                    // Query object
                    params = {
                        "text": singleLine,
                        "outSR": this.map.spatialReference.wkid,
                        "location": Math.round(centerPoint.x * 1000) / 1000 + ',' + Math.round(centerPoint.y * 1000) / 1000,
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
                            "spatialReference": {
                                "wkid": this.activeGeocoder.searchExtent.spatialReference.wkid
                            }
                        };
                        params.bbox = JSON.stringify(bbox);
                    }
                    // send request
                    var requestHandle = esri.request({
                        url: this.activeGeocoder.url + '/find',
                        content: params,
                        handleAs: 'json',
                        callbackParamName: 'callback',
                        // on load
                        load: function(response) {
                            _self._receivedResults(response.locations);
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
                    this._task = new esri.tasks.Locator(this.activeGeocoder.url);
                    this._task.outSpatialReference = this.map.spatialReference;
                    // query for location
                    this._task.addressToLocations(params, function(response) {
                        _self._receivedResults(response);
                    }, function(response) {
                        _self._receivedResults(response);
                    });
                }
            } else {
                this._hideLoading();
                this._deferred.resolve();
            }
        },
        // when geocoder selected
        onGeocoderSelect: function(e) {},
        // when geocoder selected
        onClear: function() {
            // if geocoder is ready
            if (this.ready) {
                // empty input value
                query(this.inputNode).attr('value', '');
            }
            // set current text
            this.value = '';
            // empty results
            this.results = [];
            // get node of reset button and remove it's active class
            if (this.ready) {
                query(this.clearNode).removeClass(this._clearButtonActiveClass).attr('title', '');
            }
            // remove active menus
            this._hideMenus();
            // hide loading
            this._hideLoading();
        },
        /* ---------------- */
        /* Public Functions */
        /* ---------------- */
        // clear the input box
        clear: function() {
            // clear event
            this.onClear();
        },
        // show widget
        show: function() {
            if (this.ready) {
                query(this.domNode).style('display', 'block');
            }
        },
        // hide widget
        hide: function() {
            if (this.ready) {
                query(this.domNode).style('display', 'none');
            }
        },
        // submit button selected
        search: function() {
            var _self = this;
            // query and then Locate
            _self.query({
                delay: 0
            }).then(function(response) {
                _self.onSearchResults(response);
            });
        },
        // focus on input
        focus: function() {
            if (this.ready) {
                this.inputNode.focus();
            }
        },
        // blur input
        blur: function() {
            if (this.ready) {
                this.inputNode.blur();
            }
        },
        /* ---------------- */
        /* Private Functions */
        /* ---------------- */
        // default settings
        _setPublicDefaults: function() {
            // show autocomplete?
            this.autocomplete = false;
            // use esri geocoder
            this.esriGeocoder = true;
            // Value of input
            this.value = '';
            // Theme
            this.theme = 'arcgisTheme';
            // default geocoder index
            this.activeGeocoderIndex = 0;
            // Maximum result locations to return
            this.maxLocations = 6;
            // Minimum amount of characters before searching
            this.minCharacters = 3;
            // Delay before doing the query. To avoid being too chatty.
            this.searchDelay = 350;
            // Show geocoder menu if necessary
            this.geocoderMenu = true;
        },
        // set variables that aren't to be modified
        _setPrivateDefaults: function() {
            this._i18n = i18n;
            // results holder
            this.results = [];
            // css classes
            this._GeocoderClass = 'esriGeocoder';
            this._GeocoderIconClass = 'esriGeocoderIcon';
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
        },
        // setup esri geocoder
        _setEsriGeocoder: function() {
            if (this.esriGeocoder) {
                // if object defined for esri geocoder
                if (typeof this.esriGeocoder === 'object') {
                    this._esriGeocoder = this.esriGeocoder;
                } else {
                    this._esriGeocoder = {};
                }
                // set esri geocoder options
                this._esriGeocoder.url = location.protocol + "//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
                // if name not set
                if (!this._esriGeocoder.name) {
                    this._esriGeocoder.name = i18n.widgets.Geocoder.esriGeocoderName;
                }
                this.esriGeocoder = this._esriGeocoder;
            } else {
                this.esriGeocoder = false;
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
            if (this.esriGeocoder) {
                geocoders = geocoders.concat([this._esriGeocoder]);
            }
            if (this.geocoder && this.geocoder.length) {
                geocoders = geocoders.concat(this.geocoder);
            }
            this._geocoders = geocoders;
        },
        // Update geocoder nodes
        _updateGeocoder: function() {
            this.activeGeocoderIndex = 0;
            this._setEsriGeocoder();
            this._setGeocoderList();
            this._setActiveGeocoder();
            this._insertGeocoderMenuItems();
        },
        // Update placeholder nodes
        _updatePlaceholder: function() {
            if (this.ready) {
                this._placeholder = '';
                // if placeholder of active geocoder is set
                if (this.activeGeocoder && this.activeGeocoder.placeholder) {
                    this._placeholder = this.activeGeocoder.placeholder;
                }
                query(this.inputNode).attr('placeholder', this._placeholder);
                query(this.submitNode).attr('title', this._placeholder);
            }
        },
        // update value of text box
        _updateValue: function(attr, oldVal, newVal) {
            if (this.ready) {
                query(this.inputNode).attr('value', newVal);
                this._checkStatus();
            }
        },
        // update theme
        _updateTheme: function(attr, oldVal, newVal) {
            if (this.ready) {
                query(this.domNode).removeClass(oldVal).addClass(newVal);
            }
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
        // called on AC Results
        _showSuggestions: function(e) {
            var _self = this;
            // hide menu to toggle geocoder
            _self._hideGeolocatorMenu();
            // string to set
            var html = '';
            // if results and result node
            if (_self.results && _self.results.length && _self.resultsNode) {
                // textbox value
                var partialMatch = _self.value,
                    i;
                // partial match highlight
                var regex = new RegExp('(' + partialMatch + ')', 'gi');
                html += '<ul role="presentation">';
                // for each result
                for (i = 0; i < _self.results.length; ++i) {
                    // set layer class
                    var layerClass = this._resultsItemClass + ' ';
                    // if it's odd
                    if (i % 2 === 0) {
                        // set it to odd
                        layerClass += _self._resultsItemOddClass;
                    } else {
                        layerClass += _self._resultsItemEvenClass;
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
            _self.query({
                delay: this.searchDelay
            }).then(function(response) {
                _self.onAutoComplete(response);
            });
        },
        // received results
        _receivedResults: function(response) {
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
                "value": _self.value
            };
            _self._deferred.resolve(obj);
        },
        // show loading spinner
        _showLoading: function() {
            if (this.ready) {
                query(this.clearNode).addClass(this._loadingClass);
            }
        },
        // hide loading spinner
        _hideLoading: function() {
            if (this.ready) {
                query(this.clearNode).removeClass(this._loadingClass);
            }
        },
        // show geocoder selection menu
        _showGeolocatorMenu: function() {
            if (this.ready) {
                // container node
                var container = query(this.containerNode);
                // add class to container
                container.addClass(this._activeMenuClass);
                // display menu node
                query(this.geocoderMenuNode).style('display', 'block');
                // aria
                query(this.geocoderMenuInsertNode).attr('aria-hidden', 'false');
                query(this.geocoderMenuArrowNode).attr('aria-expanded', 'true');
            }
        },
        // hide geocoder selection menu
        _hideGeolocatorMenu: function() {
            if (this.ready) {
                // container node
                var container = query(this.containerNode);
                // add class to container
                container.removeClass(this._activeMenuClass);
                query(this.geocoderMenuNode).style('display', 'none');
                // aria
                query(this.geocoderMenuInsertNode).attr('aria-hidden', 'true');
                query(this.geocoderMenuArrowNode).attr('aria-expanded', 'false');
            }
        },
        // toggle geocoder selection menu
        _toggleGeolocatorMenu: function() {
            this._hideResultsMenu();
            if (this.ready) {
                var display = query(this.geocoderMenuNode).style('display');
                if (display[0] === 'block') {
                    this._hideGeolocatorMenu();
                } else {
                    this._showGeolocatorMenu();
                }
            }
        },
        // show autolocate menu
        _showResultsMenu: function() {
            if (this.ready) {
                // node of the search box container
                var container = query(this.containerNode);
                // add class to container
                container.addClass(this._GeocoderActiveClass);
                // show node
                query(this.resultsNode).style('display', 'block');
                // aria
                query(this.resultsNode).attr('aria-hidden', 'false');
            }
        },
        // hide the results menu
        _hideResultsMenu: function() {
            if (this.ready) {
                // hide
                query(this.resultsNode).style('display', 'none');
                // add class to container
                query(this.containerNode).removeClass(this._GeocoderActiveClass);
                // aria
                query(this.resultsNode).attr('aria-hidden', 'true');
            }
        },
        // hide both menus
        _hideMenus: function() {
            this._hideGeolocatorMenu();
            this._hideResultsMenu();
        },
        // create menu for changing active geocoder
        _insertGeocoderMenuItems: function() {
            if (this.ready) {
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
                    query(this.geocoderMenuNode).style('display', 'none');
                    query(this.geocoderMenuArrowNode).style('display', 'block');
                } else {
                    this.geocoderMenuInsertNode.innerHTML = '';
                    query(this.geocoderMenuNode).style('display', 'none');
                    query(this.geocoderMenuArrowNode).style('display', 'none');
                }
            }
        },
        // check input box's status
        _checkStatus: function() {
            if (this.ready) {
                // if input value is not empty
                if (this.value) {
                    // set class and title
                    query(this.clearNode).addClass(this._clearButtonActiveClass).attr('title', i18n.widgets.Geocoder.main.clearButtonTitle);
                } else {
                    // clear address
                    this.clear();
                }
            }
        },
        // set up connections
        _setDelegations: function() {
            // isntance of class
            var _self = this;
            // array of all connections
            this._delegations = [];
            // close on click
            var closeOnClick = on(document, "click", function(event) {
                _self._hideResultsMenu(event);
            });
            this._delegations.push(closeOnClick);
            // input key up
            var inputKeyUp = on(this.inputNode, "keyup", function(event) {
                _self._inputKeyUp(event);
            });
            this._delegations.push(inputKeyUp);
            // input key down
            var inputKeyDown = on(this.inputNode, "keydown", function(event) {
                _self._inputKeyDown(event);
            });
            this._delegations.push(inputKeyDown);
            // arrow key down
            var geocoderMenuButtonKeyDown = on(this.geocoderMenuArrowNode, "keydown", _self._geocoderMenuButtonKeyDown());
            this._delegations.push(geocoderMenuButtonKeyDown);
            // list item click
            var listClick = on(this.resultsNode, '[data-item="true"]:click, [data-item="true"]:keydown', function(event) {
                clearTimeout(_self._queryTimer);
                // all items
                var lists = query('[data-item="true"]', _self.resultsNode);
                // index of this list item
                var resultIndex = parseInt(query(this).attr('data-index')[0], 10);
                // input box text
                var locTxt = query(this).attr('data-text');
                // next/previous index
                var newIndex;
                if (event.type === 'click' || (event.type === 'keydown' && event.keyCode === keys.ENTER)) {
                    // set input text value to this text
                    query(_self.inputNode).attr('value', locTxt);
                    // set current text var
                    _self.value = locTxt;
                    // Locate
                    _self._select({
                        "results": [_self.results[resultIndex]]
                    });
                } else if (event.type === 'keydown' && event.keyCode === keys.UP_ARROW) {
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        _self.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.type === 'keydown' && event.keyCode === keys.DOWN_ARROW) {
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        _self.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.keyCode === keys.ESCAPE) { // esc key
                    // clear timer
                    clearTimeout(_self._queryTimer);
                    // hide menus
                    _self._hideMenus();
                }
            });
            this._delegations.push(listClick);
            // select geocoder item
            var geocoderMenuClick = on(this.geocoderMenuInsertNode, '[data-item="true"]:click, [data-item="true"]:keydown', function(event) {
                // all items
                var lists = query('[data-item="true"]', _self.geocoderMenuInsertNode);
                // index of this list item
                var resultIndex = parseInt(query(this).attr('data-index')[0], 10);
                // next/previous index
                var newIndex;
                if (event.type === 'click' || (event.type === 'keydown' && event.keyCode === keys.ENTER)) {
                    _self._setActiveGeocoderIndex(null, null, resultIndex);
                    _self._hideGeolocatorMenu();
                } else if (event.type === 'keydown' && event.keyCode === keys.UP_ARROW) {
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        _self.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.type === 'keydown' && event.keyCode === keys.DOWN_ARROW) {
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        _self.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.keyCode === keys.ESCAPE) { // esc key
                    _self._hideGeolocatorMenu();
                }
            });
            this._delegations.push(geocoderMenuClick);
        },
        // key up event on input box
        _inputKeyUp: function(event) {
            if (event) {
                var _self = this;
                // Reset timer between keys
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
                var lists = query('[data-item="true"]', this.resultsNode);
                // ignored keys
                if (event.keyCode === event.shiftKey || event.keyCode === keys.UP_ARROW || event.keyCode === keys.DOWN_ARROW || event.keyCode === keys.LEFT_ARROW || event.keyCode === keys.RIGHT_ARROW) {
                    return;
                } else if (event && event.keyCode === keys.ENTER) { // if enter key was pushed
                    // query then Locate
                    this.search();
                    // if up arrow pushed
                } else if (event && event.keyCode === keys.ESCAPE) { // esc key
                    // clear timer
                    clearTimeout(this._queryTimer);
                    // hide menus
                    this._hideMenus();
                } else if (this.autocomplete && alength >= this.minCharacters) {
                    this._autocomplete();
                } else {
                    // hide menus
                    this._hideMenus();
                }
                // check status of search box
                this._checkStatus();
            }
        },
        // key down event on input box
        _inputKeyDown: function(event) {
            var lists = query('[data-item="true"]', this.resultsNode);
            if (event && event.keyCode === keys.TAB) {
                // hide menus if opened
                this._hideMenus();
                if (this._deferred) {
                    // cancel deferred
                    this._deferred.cancel('stop query');
                }
                // stop
                return;
            } else if (event && event.keyCode === keys.UP_ARROW) {
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (event && event.keyCode === keys.DOWN_ARROW) {
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
            }
        },
        // geocoder menu arrow key down
        _geocoderMenuButtonKeyDown: function(event) {
            var lists = query('[data-item="true"]', this.geocoderMenuInsertNode);
            if (event && event.keyCode === keys.UP_ARROW) {
                this._showGeolocatorMenu();
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
            } else if (event && event.keyCode === keys.DOWN_ARROW) {
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
            if (!this.value) {
                // clear address
                this.clear();
                // hide menus
                this._hideMenus();
            }
            // check status of text box
            this._checkStatus();
        },
        // calculate radius of extent
        _getRadius: function() {
            var extent = this.map.extent;
            // get length of extent in meters
            var meters = esri.geometry.getLength(new esri.geometry.Point(extent.xmin, extent.ymin, this.map.spatialReference), new esri.geometry.Point(extent.xmax, extent.ymin, this.map.spatialReference));
            // get radius
            var radius = meters / 2;
            // return rounded result
            return Math.round(radius * 1000) / 1000;
        },
        // go to a location
        _select: function(e) {
            // if we have results
            if (e.results && e.results.length) {
                // locate result
                this.onSelect(e.results[0]);
            }
            // hide menus
            this._hideMenus();
            // hide loading spinner
            this._hideLoading();
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
                    // result to add
                    var newResult = {},
                        geometry;
                    // find geocoder
                    if (e[i].hasOwnProperty('extent')) {
                        // set extent
                        newResult.extent = new esri.geometry.Extent(e[i].extent);
                        // set spatial ref
                        newResult.extent.setSpatialReference(new esri.SpatialReference(_self.map.spatialReference));
                        // set name
                        if (e[i].hasOwnProperty('name')) {
                            newResult.name = e[i].name;
                        }
                        // Set feature
                        if (e[i].hasOwnProperty('feature')) {
                            newResult.feature = new esri.Graphic(e[i].feature);
                            geometry = newResult.feature.geometry;
                            // fix goemetry SR
                            if (geometry) {
                                geometry.setSpatialReference(_self.map.spatialReference);
                            }
                        }
                    }
                    // address candidates geocoder
                    else if (e[i].hasOwnProperty('location')) {
                        // create point
                        var point = new esri.geometry.Point(e[i].location.x, e[i].location.y, _self.map.spatialReference);
                        // create extent from point
                        newResult.extent = _self.map.extent.centerAt(point).expand(0.0625);
                        // set name
                        if (e[i].hasOwnProperty('address')) {
                            newResult.name = e[i].address;
                        }
                        // create attributes
                        var attributes = {};
                        // set attributes
                        if (e[i].hasOwnProperty('attributes')) {
                            attributes = e[i].attributes;
                        }
                        // set score
                        if (e[i].hasOwnProperty('score')) {
                            attributes.score = e[i].score;
                        }
                        newResult.feature = new esri.Graphic(point, null, attributes, null);
                    }
                    // add to return array
                    results.push(newResult);
                }
            }
            return results;
        }
    });
});