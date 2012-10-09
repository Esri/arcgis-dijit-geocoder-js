dojo.provide("esri.dijit.Autocomplete");

// dependencies
dojo.require("dojo.cache");
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");
dojo.require("dojox.NodeList.delegate");
dojo.require("dojo.NodeList-manipulate");

// define the autocomplete widget
dojo.declare("esri.dijit.Autocomplete", [dijit._Widget, dijit._Templated], {

    templatePath: "templates/Autocomplete.html",
    widgetsInTemplate: false,

    // default settings
    setDefaults: function () {
        // text values which could be set for each locale
        this.value = '';
        this.placeholder = '';
        this.resetTitle = '';
        // flavor
        this.theme = '';
        // default locator index
        this.activeLocator = 0;
        // locators
        this.locators = [{
            url: location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer',
            name: 'World'
        }];
        this.maxLocations = 6; // Maximum result locations to return
        this.minCharacters = 1; // Minimum amount of characters before searching
        this.useBoundingBox = false; // Contain searches within bounding box
        this.hideDelay = 6000; // Hide autocomplete that's been active for this long
        this.searchDelay = 300; // Delay before doing the autocomplete query. To avoid being too chatty.
        this.zoomLevel = 12;
        this.locateFunction = 'findAddressCandidates';
        // css classes
        this._autoCompleteClass = 'esriAc';
        this._autoCompleteActiveClass = 'esriAcActive';
        this._resultsContainerClass = 'esriAcResults';
        this._searchButtonClass = 'esriAcSearch';
        this._clearButtonClass = 'esriAcClear';
        this._clearButtonActiveClass = 'esriAcClearActive';
        this._loadingClass = 'esriAcLoading';
        this._locatorMenuClass = 'esriAcLocatorMenu';
    },

    // init
    constructor: function (options, srcRefNode) {
        // set default settings
        this.setDefaults();
        // mix in settings and defaults
        dojo.safeMixin(this, options);
        // watch updates of public properties and update the widget accordingly
        this.watch("value", this._updateValue);
        this.watch("placeholder", this._updatePlaceholder);
        this.watch("resetTitle", this._updateResetTitle);
        this.watch("theme", this._updateTheme);
        this.watch("activeLocator", this._updateActiveLocator);
        this.watch("locators", this._createLocatorMenu);
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

    // change active locator
    _changeLocator: function (value) {
        this.activeLocator = value;
        this._updateActiveLocator();
    },

    // change active locator
    _updateActiveLocator: function () {
        this._hide();
        this._inputKeyup();
    },

    // create menu for changing active locator
    _createLocatorMenu: function () {
        if (this.locators.length > 1) {
            if (this.locatorMenuNode) {
                var html = '';
                html += '<select tabindex="0">';
                for (var i = 0; i < this.locators.length; i++) {
                    html += '<option value="' + i + '">' + this.locators[i].name + '</option>';
                }
                html += '</select>';
                this.locatorMenuNode.innerHTML = html;
            }
        }
    },

    // post create widget function
    postCreate: function () {
        this._createLocatorMenu();
    },

    // start widget
    startup: function () {
        // if all required options are set
        if (this.domNode && this.map) {
            // check searchbox status
            this._checkStatus();
            // setup connections
            this._setDelegations();
        }
    },

    // called after search
    onLocate: function (results) {},

    // called on return of AC results
    onAutoComplete: function (results) {},

    // clear autocomplete address
    clear: function () {
        this._clearAddress();
    },

    // destroy widget
    destroy: function () {
        var instance = this;
        // remove html
        dojo.empty(this.domNode);
        // if delegations
        if (instance.delegations) {
            // disconnect all events
            for (var i = 0; i < instance.delegations.length; i++) {
                dojo.disconnect(instance.delegations[i]);
            }
        }
    },

    // hide results
    hide: function () {
        this._hide();
    },

    // clear the input box
    _clearAddress: function () {
        // empty input value
        dojo.query(this.inputNode).attr('value', '');
        // set current text
        this.value = '';
        // get node of reset button and remove it's active class
        dojo.query(this.clearNode).removeClass(this._clearButtonActiveClass).attr('title', '');
    },

    // show loading spinner
    _showLoading: function () {
        dojo.query(this.clearNode).addClass(this._loadingClass);
    },

    // hide loading spinner
    _hideLoading: function () {
        dojo.query(this.clearNode).removeClass(this._loadingClass);
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
        var instance = this;
        clearTimeout(instance.hideTimer);
        instance.hideTimer = setTimeout(function () {
            instance._hide();
        }, instance.hideDelay);
    },

    // show autocomplete
    _show: function (results) {
        var candidates = results.candidates;
        // if results and result node
        if (results && candidates.length > 0 && this.resultsNode) {
            // set results
            this.results = results;
            // clear hide timer
            this._resetHideTimer();
            // string to set
            var html = '';
            // node of the search box container
            var container = dojo.query(this.containerNode);
            // add class to container
            container.addClass(this._autoCompleteActiveClass);
            // position and height of the search box
            var position = dojo.position(container[0]);
            // textbox value
            var partialMatch = this.value;
            // partial match highlight
            var regex = new RegExp('(' + partialMatch + ')', 'gi');
            // position the autocomplete
            dojo.query(this.resultsNode).style({
                'top': position.h + 'px'
            });
            // create list
            html += '<ul>';
            // for each result
            for (var i = 0; i < candidates.length && i < this.maxLocations; ++i) {
                // set layer class
                var layerClass = 'even';
                // if it's odd
                if (i % 2 === 0) {
                    // set it to odd
                    layerClass = 'odd';
                }
                // create list item
                html += '<li data-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + candidates[i].address.replace(regex, '<strong>' + partialMatch + '</strong>') + '</li>';
            }
            // close list
            html += '</ul>';
            // set HTML
            this.resultsNode.innerHTML = html;
            // show!
            dojo.query(this.resultsNode).style('display', 'block');
        } else {
            // hide!
            this._hide();
        }
        // hide loading
        this._hideLoading();
        // call autocomplete event
        this.onAutoComplete(results);
    },

    // set up connections
    _setDelegations: function () {
        // isntance of class
        var instance = this;
        // array of all connections
        instance.delegations = [];
        // search button keyup
        var searchButton = dojo.connect(this.submitNode, "onkeyup", this, "_submitSearch");
        instance.delegations.push(searchButton);
        // clear button keyup
        var clearButton = dojo.connect(this.clearNode, "onkeyup", this, "_clearAutocomplete");
        instance.delegations.push(clearButton);
        // input key up
        var inputKey = dojo.connect(this.inputNode, "onkeyup", this, "_inputKeyup");
        instance.delegations.push(inputKey);
        // hover over results, reset timer
        var widgetHover = dojo.query(instance.resultsNode).delegate('ul', 'mousemove', function (event) {
            // stop results from hiding
            instance._resetHideTimer();
        });
        instance.delegations.push(widgetHover);
        // list item click
        var listClick = dojo.query(instance.resultsNode).delegate('ul li', 'onclick,keyup', function (event) {
            // clear timers
            instance._resetHideTimer();
            clearTimeout(instance.showTimer);
            // size of lists
            var liSize = instance.results.candidates.length;
            // input box text
            var locTxt = dojo.query(this).text();
            // index of this list item
            var locNum = parseInt(dojo.query(this).attr('data-index')[0], 10);
            // next/previous index
            var newIndex;
            // if click or enter key pushed
            if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
                // set input text value to this text
                dojo.query('input', instance.domNode).attr('value', locTxt);
                // set current text var
                instance.value = locTxt;
                // _locate
                instance._locate(instance.results, locNum);
                // hide autocomplete
                instance._hide();
            } else if (event.type === 'keyup' && event.keyCode === 38) {
                // go to previous item
                newIndex = locNum - 1;
                if (newIndex < 0) {
                    newIndex = liSize - 1;
                }
                dojo.query('li', instance.resultsNode)[newIndex].focus();
            } else if (event.type === 'keyup' && event.keyCode === 40) {
                // go to next item
                newIndex = locNum + 1;
                if (newIndex >= liSize) {
                    newIndex = 0;
                }
                dojo.query('li', instance.resultsNode)[newIndex].focus();
            }
            // esc key
            else if (event.keyCode === 27) {
                // clear timers
                clearTimeout(instance.hideTimer);
                clearTimeout(instance.showTimer);
                // hide autocomplete
                instance._hide();
            }
        });
        instance.delegations.push(listClick);
        // Locator menu change
        var locatorMenuChange = dojo.query(instance.locatorMenuNode).delegate('select', 'onchange', function () {
            var value = parseInt(dojo.query(this).attr('value')[0], 10);
            instance._changeLocator(value);
        });
        instance.delegations.push(locatorMenuChange);
    },

    _inputKeyup: function (event) {
        var instance = this;
        // clear timers
        instance._resetHideTimer();
        clearTimeout(instance.showTimer);
        // get textbox value
        var aquery = this.inputNode.value;
        // update current text variable
        instance.value = aquery;
        // length of value
        var alength = 0;
        // if value
        if (aquery) {
            // set length of value
            alength = aquery.length;
        }
        var lists;
        // if enter key was pushed
        if (event && event.keyCode === 13) {
            // query then _locate
            instance._query(instance._locate);
            // hide autocomplete
            instance._hide();
            // if up arrow pushed
        } else if (event && event.keyCode === 38) {
            // get all list items
            lists = dojo.query('li', instance.resultsNode);
            // get list item length
            var listsLen = lists.length;
            // if not zero
            if (listsLen) {
                // go to previous list item
                lists[listsLen - 1].focus();
            }
            // if down arrow pushed
        } else if (event && event.keyCode === 40) {
            // get all lists
            lists = dojo.query('li', instance.resultsNode);
            // if first item
            if (lists[0]) {
                // focus first item
                lists[0].focus();
            }
            // if input value is larger than 2
        }
        // esc key
        else if (event && event.keyCode === 27) {
            // clear timers
            clearTimeout(instance.hideTimer);
            clearTimeout(instance.showTimer);
            // hide autocomplete
            instance._hide();
        } else if (alength >= (instance.minCharacters)) {
            // set timer for showing
            instance.showTimer = setTimeout(function () {
                // query then show autocomplete
                instance._query(instance._show);
            }, instance.searchDelay);
        } else {
            // hide autocomplete
            instance._hide();
        }
        // check status of search box
        instance._checkStatus();
    },

    _submitSearch: function (event) {
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
            var instance = this;
            // query and then _locate
            instance._query(instance._locate);
            // hide autocomplete
            instance._hide();
        }
    },

    _inputClick: function () {
        var instance = this;
        // if input value is empty
        if (!this.inputNode.value) {
            // clear address
            instance._clearAddress();
        }
        // hide autocomplete
        instance._hide();
        // check status of text box
        instance._checkStatus();
    },

    _clearAutocomplete: function (event) {
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
            var instance = this;
            // hide autocomplete
            instance._hide();
            // clear address
            instance._clearAddress();
            // hide loading
            instance._hideLoading();
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
        var instance = this;
        // if query isn't empty
        if (instance.value) {
            // show loading
            instance._showLoading();
            // Query object
            var queryContent = {
                "SingleLine": instance.value,
                "outSR": instance.map.spatialReference.wkid,
                "outFields": "*",
                "f": "json"
            };
            // if max locations set
            if (instance.maxLocations) {
                queryContent.maxLocations = instance.maxLocations;
            }
            // local results only
            if (instance.useBoundingBox) {
                var bbox = {
                    "xmin": instance.map.extent.xmin,
                    "ymin": instance.map.extent.ymin,
                    "xmax": instance.map.extent.xmax,
                    "ymax": instance.map.extent.ymax,
                    "spatialReference": {
                        "wkid": instance.map.spatialReference.wkid
                    }
                };
                queryContent.searchExtent = dojo.toJson(bbox);
            }
            // send request
            var requestHandle = esri.request({
                url: instance.locators[instance.activeLocator].url + '/' + instance.locateFunction,
                content: queryContent,
                handleAs: 'json',
                callbackParamName: 'callback',
                // on load
                load: function (data) {
                    if (typeof callback === 'function') {
                        // call callback function
                        callback.call(instance, data);
                    }
                }
            });
        }
    },

    // go to a location
    _locate: function (results, resultNumber) {
        // this
        var instance = this;
        var candidates = results.candidates;
        // if we have results
        if (results && candidates.length > 0) {
            // selected result
            var numResult = 0;
            // if it's not zero
            if (resultNumber) {
                numResult = resultNumber;
            }
            console.log(candidates[numResult]);
            // if result has attributes
            if (candidates[numResult].attributes) {
                var extent;
                if (
                candidates[numResult].attributes.hasOwnProperty('Xmin') && candidates[numResult].attributes.hasOwnProperty('Ymin') && candidates[numResult].attributes.hasOwnProperty('Xmax') && candidates[numResult].attributes.hasOwnProperty('Ymax')) {
                    // if result has extent attributes
                    console.log('extent 1');
                    // new extent
                    extent = new esri.geometry.Extent({
                        "xmin": candidates[numResult].attributes.Xmin,
                        "ymin": candidates[numResult].attributes.Ymin,
                        "xmax": candidates[numResult].attributes.Xmax,
                        "ymax": candidates[numResult].attributes.Ymax,
                        "spatialReference": results.spatialReference
                    });
                    // set map extent to location
                    instance.map.setExtent(esri.geometry.geographicToWebMercator(extent));
                } else if (
                candidates[numResult].attributes.hasOwnProperty('westLon') && candidates[numResult].attributes.hasOwnProperty('southLat') && candidates[numResult].attributes.hasOwnProperty('eastLon') && candidates[numResult].attributes.hasOwnProperty('northLat')) {
                    // result has lat/lon extent attributes
                    console.log('extent 2');
                    // new extent
                    extent = new esri.geometry.Extent({
                        "xmin": candidates[numResult].attributes.westLon,
                        "ymin": candidates[numResult].attributes.southLat,
                        "xmax": candidates[numResult].attributes.eastLon,
                        "ymax": candidates[numResult].attributes.northLat,
                        "spatialReference": results.spatialReference
                    });
                    // set map extent to location
                    instance.map.setExtent(esri.geometry.geographicToWebMercator(extent));
                } else {
                    // use point
                    console.log('point');
                    instance.map.centerAndZoom(candidates[numResult].location, instance.zoomLevel);
                }
            }
        } else {
            // clear address box
            instance._clearAddress();
        }
        // hide autocomplete
        instance._hide();
        // hide loading
        instance._hideLoading();
        // on search call
        instance.onLocate(results);
    }
});