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
        this.noResultsText = 'No results';
        // flavor
        this.theme = 'esriAutocomplete';
        // results holder
        this.results = [];
        // default locator index
        this.activeLocator = 0;
        // locators
        this.locators = [{
            url: location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer',
            name: 'World'
        }];
        this.maxLocations = 3; // Maximum result locations to return
        this.minCharacters = 1; // Minimum amount of characters before searching
        this.useBoundingBox = false; // Contain searches within bounding box
        this.hideDelay = 6000; // Hide autocomplete that's been active for this long
        this.searchDelay = 300; // Delay before doing the autocomplete query. To avoid being too chatty.
        this.zoomLevel = 12;
        this._locateFunction = 'findAddressCandidates';
        // css classes
        this._autoCompleteClass = 'esriAc';
        this._autoCompleteActiveClass = 'esriAcActive';
        this._noResultsClass = 'esriAcNoResults';
        this._resultsContainerClass = 'esriAcResults';
        this._resultsLoadingClass = 'esriAcResultsLoading';
        this._resultsItemClass = 'esriAcItem';
        this._resultsItemEvenClass = 'even';
        this._resultsItemOddClass = 'odd';
        this._resultsPartialMatchClass = 'esriAcPartial';
        this._searchButtonClass = 'esriAcSearch';
        this._clearButtonClass = 'esriAcClear';
        this._clearButtonActiveClass = 'esriAcClearActive';
        this._locatorHeaderClass = 'esriAcHeader';
        this._autoCompleteClearClass = 'esriAcClearFloat';
        // keys
        this._submitKey = 13;
        this._previousKey = 38;
        this._nextKey = 40;
        this._cancelKey = 27;
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

    // called on AC Init
    onAutoComplete: function () {},

    // called on AC Results
    onAutoCompleteResults: function (results, locatorIndex) {},

    // return results
    getResults: function () {
        return this.results;
    },

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
        if(instance.hideDelay){
            clearTimeout(instance.hideTimer);
            instance.hideTimer = setTimeout(function () {
                instance._hide();
            }, instance.hideDelay);
        }
    },

    _insertLocatorResults: function (results, locatorIndex) {
        // reset timer
        this._resetHideTimer();
        // set canidates
        var candidates = results.candidates;
        // set results
        this.results[locatorIndex] = results;
        // string to set
        var html = '';
        // if results and result node
        if (results && candidates.length > 0 && this.resultsNode) {
            // textbox value
            var partialMatch = this.value;
            // partial match highlight
            var regex = new RegExp('(' + partialMatch + ')', 'gi');
            html += '<ul>';
            // for each result
            for (var i = 0; i < candidates.length && i < this.maxLocations; ++i) {
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
                html += '<li data-item="true" data-locator-index="' + locatorIndex + '" data-result-index="' + i + '" role="menuitem" tabindex="0" class="' + layerClass + '">' + candidates[i].address.replace(regex, '<strong class="' + this._resultsPartialMatchClass + '">' + partialMatch + '</strong>') + '</li>';
            }
            // close list
            html += '</ul>';
        } else {
            html += '<div class="' + this._noResultsClass + '">' + this.noResultsText + '</div>';
        }
        var node = dojo.query('[data-locator-results="' + locatorIndex + '"]', this.resultsNode)[0];
        // set HTML
        if (node) {
            node.innerHTML = html;
        }
        // autocomplete results
        this.onAutoCompleteResults(results, locatorIndex);
    },

    _show: function () {
        // node of the search box container
        var container = dojo.query(this.containerNode);
        // position and height of the search box
        var position = dojo.position(container[0]);
        // position the autocomplete
        dojo.query(this.resultsNode).style({
            'top': position.h + 'px'
        });
        // add class to container
        container.addClass(this._autoCompleteActiveClass);
        // clear hide timer
        this._resetHideTimer();
        dojo.query(this.resultsNode).style('display', 'block');
    },

    _showAll: function () {
        // string to set
        var html = '';
        // for each result
        for (var i = 0; i < this.locators.length; ++i) {
            // if more than 1 locator
            if (this.locators.length > 1) {
                html += '<div class="' + this._locatorHeaderClass + '">' + this.locators[i].name + '</div>';
            }
            html += '<div data-locator-results="' + i + '"">';
            html += '<div class="' + this._resultsLoadingClass + '"></div>';
            html += '</div>';
        }
        // set HTML
        this.resultsNode.innerHTML = html;
        // for each locator
        for (var j = 0; j < this.locators.length; ++j) {
            // insert results
            this._query(j, this._insertLocatorResults);
        }
        // show!
        this._show();
        // call autocomplete event
        this.onAutoComplete();
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
        var widgetHover = dojo.query(instance.resultsNode).delegate('[data-item="true"]', 'mousemove', function (event) {
            // stop results from hiding
            instance._resetHideTimer();
        });
        instance.delegations.push(widgetHover);
        // list item click
        var listClick = dojo.query(instance.resultsNode).delegate('[data-item="true"]', 'onclick,keyup', function (event) {
            // clear timers
            instance._resetHideTimer();
            clearTimeout(instance.showTimer);
            // all items
            var lists = dojo.query('[data-item="true"]', instance.resultsNode);
            // index of current item
            var currentIndex = dojo.indexOf(lists, this);
            // input box text
            var locTxt = dojo.query(this).text();
            // next/previous index
            var newIndex;
            if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === instance._submitKey)) { // if click or enter key pushed
                // index of the locator to locate with
                var locatorIndex = parseInt(dojo.query(this).attr('data-locator-index')[0], 10);
                // index of this list item
                var resultIndex = parseInt(dojo.query(this).attr('data-result-index')[0], 10);
                // set input text value to this text
                dojo.query(instance.inputNode).attr('value', locTxt);
                // set current text var
                instance.value = locTxt;
                // Locate
                instance._locate(instance.results[locatorIndex], resultIndex);
                // hide autocomplete
                instance._hide();
            } else if (event.type === 'keyup' && event.keyCode === instance._previousKey) { // Up arrow key
                // go to previous item
                newIndex = currentIndex - 1;
                if (newIndex < 0) {
                    newIndex = lists.length - 1;
                }
                lists[newIndex].focus();
            } else if (event.type === 'keyup' && event.keyCode === instance._nextKey) { //Down arrow key
                // go to next item
                newIndex = currentIndex + 1;
                if (newIndex >= lists.length) {
                    newIndex = 0;
                }
                lists[newIndex].focus();
            } else if (event.keyCode === instance._cancelKey) { // esc key
                // clear timers
                clearTimeout(instance.hideTimer);
                clearTimeout(instance.showTimer);
                // hide autocomplete
                instance._hide();
            }
        });
        instance.delegations.push(listClick);
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
        var lists = dojo.query('[data-item="true"]', instance.resultsNode);
        // if enter key was pushed
        if (event && event.keyCode === instance._submitKey) {
            // query then Locate
            instance._query(instance.activeLocator, instance._locate);
            // hide autocomplete
            instance._hide();
            // if up arrow pushed
        } else if (event && event.keyCode === instance._previousKey) {
            // get list item length
            var listsLen = lists.length;
            // if not zero
            if (listsLen) {
                // go to previous list item
                lists[listsLen - 1].focus();
            }
            // if down arrow pushed
        } else if (event && event.keyCode === instance._nextKey) {
            // if first item
            if (lists[0]) {
                // focus first item
                lists[0].focus();
            }
            // if input value is larger than 2
        }
        // esc key
        else if (event && event.keyCode === instance._cancelKey) {
            // clear timers
            clearTimeout(instance.hideTimer);
            clearTimeout(instance.showTimer);
            // hide autocomplete
            instance._hide();
        } else if (alength >= (instance.minCharacters)) {
            if(instance.searchDelay){
                // set timer for showing
                instance.showTimer = setTimeout(function () {
                    // query then show autocomplete
                    instance._showAll();
                }, instance.searchDelay);
            }
            else{
                // query then show autocomplete
                instance._showAll();
            }
        } else {
            // hide autocomplete
            instance._hide();
        }
        // check status of search box
        instance._checkStatus();
    },

    _submitSearch: function (event) {
        var instance = this;
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === instance._submitKey)) {
            // query and then Locate
            instance._query(instance.activeLocator, instance._locate);
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
        var instance = this;
        if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === instance._submitKey)) {
            // hide autocomplete
            instance._hide();
            // clear address
            instance._clearAddress();
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
    _query: function (activeLocator, callback) {
        var instance = this;
        // if query isn't empty
        if (instance.value) {
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
                url: instance.locators[activeLocator].url + '/' + instance._locateFunction,
                content: queryContent,
                handleAs: 'json',
                callbackParamName: 'callback',
                // on load
                load: function (data) {
                    if (typeof callback === 'function') {
                        // call callback function
                        callback.call(instance, data, activeLocator);
                    }
                },
                error: function () {
                    if (typeof callback === 'function') {
                        // call callback function
                        callback.call(instance, null, activeLocator);
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
            // if result has attributes
            if (candidates[numResult].attributes) {
                var extent;
                if (
                candidates[numResult].attributes.hasOwnProperty('Xmin') && candidates[numResult].attributes.hasOwnProperty('Ymin') && candidates[numResult].attributes.hasOwnProperty('Xmax') && candidates[numResult].attributes.hasOwnProperty('Ymax')) {
                    // if result has extent attributes
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
                    instance.map.centerAndZoom(candidates[numResult].location, instance.zoomLevel);
                }
            }
        } else {
            // clear address box
            instance._clearAddress();
        }
        // hide autocomplete
        instance._hide();
        // on search call
        instance.onLocate(results);
    }
});