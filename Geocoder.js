require([
    "dojo/_base/declare",
    "dijit/_WidgetBase",
    "dijit/_OnDijitClickMixin",
    "dijit/_TemplatedMixin",
    "dojo/on",
    "dojo/query",
    "dojo/dom-geometry",
    "dojo/json",
    "dojo/i18n!./nls/jsapi.js",
    "dojo/dom-construct",
    "esri/tasks/locator",
    "dojo/keys",
    "dojo/text!./templates/Geocoder.html",
    "dojo/_base/Deferred",
    "dojo/uacss"], function (declare, _WidgetBase, _OnDijitClickMixin, _TemplatedMixin, on, query, domGeom, JSON, i18n, domConstruct, locator, keys, template, Deferred) {
    declare("esri.dijit.Geocoder", [_WidgetBase, _OnDijitClickMixin, _TemplatedMixin], {

        // Set template file HTML
        templateString: template,

        // init
        constructor: function (options, srcRefNode) {
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
        startup: function () {
            // if all required options are set
            if (this.domNode && this.map) {
                // add clear button if already populated
                if (this.value) {
                    this._checkStatus();
                }
                // set positions for menus
                this._setMenuPositions();
                // setup connections
                this._setDelegations();
            } else {
                console.log('Map or domNode undefined.');
            }
        },

        // post create widget function
        postCreate: function () {
            // set widget ready
            this.ready = true;
            // build geocoder list
            this._updateGeocoder();
        },

        // destroy widget
        destroy: function () {
            // remove html
            domConstruct.empty(this.domNode);
            // if delegations
            if (this._delegations) {
                // disconnect all events
                for (var i = 0; i < this._delegations.length; i++) {
                    this._delegations[i].remove();
                }
            }
        },

        /* ---------------- */
        /* Public Events */
        /* ---------------- */

        // called after search has been selected
        onSelect: function (result) {
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
                    if (this.activeGeocoder.hasOwnProperty('zoom')) {
                        // use point and zoom
                        this.map.centerAndZoom(result.location, this.activeGeocoder.zoom);
                    } else {
                        // use point
                        this.map.centerAt(result.location);
                    }
                }
            }
        },

        // query for results and then execute a function
        onStart: function () {
            // create deferred
            var deferred = new Deferred();
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
                        load: function (response) {
                            deferred.resolve(response.locations);
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
                    this._task.addressToLocations(params, function (response) {
                        deferred.resolve(response);
                    }, function (response) {
                        deferred.resolve(response);
                    });
                }
            } else {
                deferred.resolve(false);
            }
            return deferred;
        },

        // called on AC Results
        onResults: function (results) {
            var instance = this;
            // hide menu to toggle geocoder
            instance._hideGeolocatorMenu();
            // set results
            instance.results = results;
            // field that holds address name
            var addressFieldName;
            // if using esri geocoder
            if (instance.activeGeocoder === instance._esriGeocoder) {
                addressFieldName = 'name';
            } else {
                // set results
                addressFieldName = 'address';
            }
            // string to set
            var html = '';
            // if results and result node
            if (results && results.length > 0 && instance.resultsNode) {
                // textbox value
                var partialMatch = instance.value;
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
                        layerClass += instance._resultsItemOddClass;
                    } else {
                        layerClass += instance._resultsItemEvenClass;
                    }
                    // create list item
                    html += '<li data-text="' + results[i][addressFieldName] + '" data-item="true" data-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + results[i][addressFieldName].replace(regex, '<strong class="' + instance._resultsPartialMatchClass + '">' + partialMatch + '</strong>') + '</li>';
                }
                // close list
                html += '</ul>';
                // insert HTML
                if (instance.resultsNode) {
                    instance.resultsNode.innerHTML = html;
                }
                // hide loading
                instance._hideLoading();
                // show!
                instance._showResultsMenu();
            }
        },
		
		// when geocoder selected
        onGeocoderSelect: function (attr, oldVal, newVal) {},

        /* ---------------- */
        /* Public Functions */
        /* ---------------- */

        // clear the input box
        clear: function () {
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

        // show widget
        show: function () {
            if (this.ready) {
                query(this.domNode).style('display', 'block');
            }
        },

        // hide widget
        hide: function () {
            if (this.ready) {
                query(this.domNode).style('display', 'none');
            }
        },

        /* ---------------- */
        /* Private Functions */
        /* ---------------- */

        // default settings
        _setPublicDefaults: function () {
            // show autocomplete?
            this.autocomplete = true;
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
        _setPrivateDefaults: function () {
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
        _setEsriGeocoder: function () {
            if (this.esriGeocoder) {
                // if object defined for esri geocoder
                if (typeof this.esriGeocoder === 'object') {
                    this._esriGeocoder = this.esriGeocoder;
                } else {
                    this._esriGeocoder = {};
                }
                // set esri geocoder options
                this._esriGeocoder.url = location.protocol + "//geocodedev.arcgis.com/arcgis/rest/services/World/GeocodeServer";
                // if name not set
                if (!this._esriGeocoder.name) {
                    this._esriGeocoder.name = i18n.widgets.Geocoder.esriGeocoderName;
                }
                if (!this._esriGeocoder.sourceCountry) {
                    this._esriGeocoder.sourceCountry = "USA";
                }
                this.esriGeocoder = this._esriGeocoder;
            } else {
                this.esriGeocoder = false;
            }
        },

        // sets current locator object
        _setActiveGeocoder: function () {
            // set current active geocoder object
            this.activeGeocoder = this._geocoder[this.activeGeocoderIndex];
            // update placeholder nodes
            this._updatePlaceholder();
        },

        // Combine and count all geocoders
        _setGeocoderList: function () {
            var geocoders = [];
            if (this.esriGeocoder) {
                geocoders = geocoders.concat([this._esriGeocoder]);
            }
            if (this.geocoder && this.geocoder.length > 0) {
                geocoders = geocoders.concat(this.geocoder);
            }
            this._geocoder = geocoders;
            this._geocoderCount = geocoders.length;
        },

        // Update geocoder nodes
        _updateGeocoder: function () {
            this.activeGeocoderIndex = 0;
            this._setEsriGeocoder();
            this._setGeocoderList();
            this._setActiveGeocoder();
            this._insertGeocoderMenuItems();
        },

        // Update placeholder nodes
        _updatePlaceholder: function () {
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

        // set CSS position of menus
        _setMenuPositions: function () {
            if (this.ready) {
                var container = query(this.containerNode);
                // position and height of the search box
                var position = domGeom.position(container[0]);
                // set params
                var params = {
                    'top': position.h + 'px'
                };
                // position the menus
                query(this.geocoderMenuNode).style(params);
                query(this.resultsNode).style(params);
            }
        },

        // update value of text box
        _updateValue: function (attr, oldVal, newVal) {
            if (this.ready) {
                query(this.inputNode).attr('value', newVal);
                this._checkStatus();
            }
        },

        // update theme
        _updateTheme: function (attr, oldVal, newVal) {
            if (this.ready) {
                query(this.domNode).removeClass(oldVal).addClass(newVal);
            }
        },

        // change active geocoder
        _setActiveGeocoderIndex: function (attr, oldVal, newVal) {
            this.activeGeocoderIndex = newVal;
            // set geocoder object
            this._setActiveGeocoder();
            this._hideMenus();
            this._insertGeocoderMenuItems();
            this.onGeocoderSelect(this.activeGeocoder, oldVal, newVal);
        },

        // show loading spinner
        _showLoading: function () {
            if (this.ready) {
                query(this.clearNode).addClass(this._loadingClass);
            }
        },

        // hide loading spinner
        _hideLoading: function () {
            if (this.ready) {
                query(this.clearNode).removeClass(this._loadingClass);
            }
        },

        // show geocoder selection menu
        _showGeolocatorMenu: function () {
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
        _hideGeolocatorMenu: function () {
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
        _toggleGeolocatorMenu: function () {
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
        _showResultsMenu: function () {
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
        _hideResultsMenu: function () {
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
        _hideMenus: function () {
            this._hideGeolocatorMenu();
            this._hideResultsMenu();
        },

        // create menu for changing active geocoder
        _insertGeocoderMenuItems: function () {
            if (this.ready) {
                if (this.geocoderMenu && this._geocoderCount > 1) {
                    var html = '';
                    var layerClass = '';
                    html += '<ul role="presentation">';
                    for (i = 0; i < this._geocoder.length; i++) {
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
                        var geocoderName = this._geocoder[i].name || i18n.widgets.Geocoder.main.untitledGeocoder;
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
                    dojo.query(this.geocoderMenuNode).style('display', 'none');
                    dojo.query(this.geocoderMenuArrowNode).style('display', 'block');
                } else {
                    this.geocoderMenuInsertNode.innerHTML = '';
                    dojo.query(this.geocoderMenuNode).style('display', 'none');
                    dojo.query(this.geocoderMenuArrowNode).style('display', 'none');
                }
            }
        },

        // check input box's status
        _checkStatus: function () {
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
        _setDelegations: function () {
            // isntance of class
            var instance = this;
            // array of all connections
            this._delegations = [];
            // close on click
            var closeOnClick = on(document, "click", function (event) {
                instance._hideResultsMenu(event);
            });
            this._delegations.push(closeOnClick);
            // input key up
            var inputKeyUp = on(this.inputNode, "keyup", function (event) {
                instance._inputKeyUp(event);
            });
            this._delegations.push(inputKeyUp);
            // input key down
            var inputKeyDown = on(this.inputNode, "keydown", function (event) {
                instance._inputKeyDown(event);
            });
            this._delegations.push(inputKeyDown);
            // arrow key down
            var geocoderMenuButtonKeyDown = on(this.geocoderMenuArrowNode, "keydown", instance._geocoderMenuButtonKeyDown());
            this._delegations.push(geocoderMenuButtonKeyDown);
            // list item click
            var listClick = on(this.resultsNode, '[data-item="true"]:click, [data-item="true"]:keydown', function (event) {
                clearTimeout(instance._queryTimer);
                // all items
                var lists = query('[data-item="true"]', instance.resultsNode);
                // index of this list item
                var resultIndex = parseInt(query(this).attr('data-index')[0], 10);
                // input box text
                var locTxt = query(this).attr('data-text');
                // next/previous index
                var newIndex;
                if (event.type === 'click' || (event.type === 'keydown' && event.keyCode === keys.ENTER)) {
                    // set input text value to this text
                    query(instance.inputNode).attr('value', locTxt);
                    // set current text var
                    instance.value = locTxt;
                    // Locate
                    instance._select(instance.results, resultIndex);
                    // hide menus
                    instance._hideMenus();
                } else if (event.type === 'keydown' && event.keyCode === keys.UP_ARROW) {
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        instance.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.type === 'keydown' && event.keyCode === keys.DOWN_ARROW) {
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        instance.inputNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.keyCode === keys.ESCAPE) { // esc key
                    // clear timer
                    clearTimeout(instance._queryTimer);
                    // hide menus
                    instance._hideMenus();
                }
            });
            this._delegations.push(listClick);
            // select geocoder item
            var geocoderMenuClick = on(this.geocoderMenuInsertNode, '[data-item="true"]:click, [data-item="true"]:keydown', function (event) {
                // all items
                var lists = query('[data-item="true"]', instance.geocoderMenuInsertNode);
                // index of this list item
                var resultIndex = parseInt(query(this).attr('data-index')[0], 10);
                // next/previous index
                var newIndex;
                if (event.type === 'click' || (event.type === 'keydown' && event.keyCode === keys.ENTER)) {
                    instance._setActiveGeocoderIndex(null, null, resultIndex);
                    instance._hideGeolocatorMenu();
                } else if (event.type === 'keydown' && event.keyCode === keys.UP_ARROW) {
                    // go to previous item
                    newIndex = resultIndex - 1;
                    if (newIndex < 0) {
                        instance.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.type === 'keydown' && event.keyCode === keys.DOWN_ARROW) {
                    // go to next item
                    newIndex = resultIndex + 1;
                    if (newIndex >= lists.length) {
                        instance.geocoderMenuArrowNode.focus();
                    } else {
                        lists[newIndex].focus();
                    }
                } else if (event.keyCode === keys.ESCAPE) { // esc key
                    instance._hideGeolocatorMenu();
                }
            });
            this._delegations.push(geocoderMenuClick);
        },

        // key up event on input box
        _inputKeyUp: function (event) {
            if (event) {
                var instance = this;
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
                if (event.keyCode === keys.TAB || event.shiftKey || event.keyCode === keys.UP_ARROW || event.keyCode === keys.DOWN_ARROW || event.keyCode === keys.LEFT_ARROW || event.keyCode === keys.RIGHT_ARROW) {
                    return;
                } else if (event && event.keyCode === keys.ENTER) { // if enter key was pushed
                    // query then Locate
                    this.onStart().then(function (results) {
                        instance._select(results);
                    });
                    // hide menus
                    this._hideMenus();
                    // if up arrow pushed
                } else if (event && event.keyCode === keys.ESCAPE) { // esc key
                    // clear timer
                    clearTimeout(this._queryTimer);
                    // hide menus
                    this._hideMenus();
                } else if (this.autocomplete && alength >= this.minCharacters) {
                    if (this.searchDelay) {
                        // set timer for showing
                        this._queryTimer = setTimeout(function () {
                            // query then show
                            instance.onStart().then(function (response) {
                                instance.onResults(response);
                            });
                        }, this.searchDelay);
                    } else {
                        // query then show
                        instance.onStart().then(function (response) {
                            instance.onResults(response);
                        });
                    }
                } else {
                    // hide menus
                    this._hideMenus();
                }
                // check status of search box
                this._checkStatus();
            }
        },

        // key down event on input box
        _inputKeyDown: function (event) {
            var lists = query('[data-item="true"]', this.resultsNode);
            if (event && event.keyCode === keys.UP_ARROW) {
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
        _geocoderMenuButtonKeyDown: function (event) {
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

        // submit button selected
        _submit: function () {
            var instance = this;
            // query and then Locate
            this.onStart().then(function (results) {
                instance._select(results);
            });
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

		// calculate radius of extent
        _getRadius: function () {
            var extent = this.map.extent;
            // get length of extent in meters
            var meters = esri.geometry.getLength(new esri.geometry.Point(extent.xmin, extent.ymin, map.spatialReference), new esri.geometry.Point(extent.xmax, extent.ymin, map.spatialReference));
            // get radius
            var radius = meters / 2;
            // return rounded result
            return Math.round(radius * 1000) / 1000;
        },

        // go to a location
        _select: function (results, resultNumber) {
            // save results
            this.results = results;
            // if we have results
            if (results && results.length > 0) {
                // selected result
                var numResult = resultNumber || 0;
                // result object
                var result = results[numResult];
                // locate result
                this.onSelect(result);
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
});