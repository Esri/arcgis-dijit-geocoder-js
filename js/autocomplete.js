// dependencies
dojo.require("dojox.NodeList.delegate");
dojo.require("dojo.NodeList-manipulate");

// define the autocomplete
dojo.declare("esri.autocomplete", null, {

    // text values which could be set for each locale
    defaultText: '',
    placeholder: '',
    popupTitle: '',
    resetTitle: '',

    // various settings
    locator: 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer', // locator URL
    maxLocations: 6, // Maximum result locations to return
    minCharacters: 1, // Minimum amount of characters before searching
    showPoint: false, // Show location point after searching
    useBoundingBox: false, // Contain searches within bounding box
    hideDelay: 6000, // Hide autocomplete that's been active for this long
    searchDelay: 300, // Delay before doing the autocomplete query. To avoid being too chatty.

    // init
    constructor: function (node, args) {
        // mix in settings and defaults
        dojo.safeMixin(this, args);
        // set default settings
        this.setDefaults();
        // node
        this.searchNode = node;
        // new node properties
        var props = {};
        // if theme set
        if (this.theme) {
            // add theme to search node
            dojo.query(this.searchNode).addClass(this.theme);
            // add theme class
            props.className = this.theme;
        }
        // create results node and add to body
        this.resultNode = dojo.create("div", props, dojo.body());
        // if all required options are set
        if (this.searchNode && this.map) {
            // set HTML
            this.setHTML();
            // check searchbox status
            this.checkStatus();
            // setup connections
            this.setDelegations();
        }
    },

    // default settings
    setDefaults: function () {
        // style classes
        this.autoCompleteClass = 'acContainer';
        this.autoCompleteActiveClass = 'acActive';
        this.resultsClass = 'acResults';
        this.searchButtonClass = 'acSearch';
        this.clearButtonClass = 'acClear';
        this.clearButtonActiveClass = 'acClearActive';
        this.loadingClass = 'acLoading';
    },

    // called after search
    onSearch: function () {},

    // called if no results were returned
    onNoResults: function () {},

    // show loading spinner
    showLoading: function () {
        dojo.query('.' + this.clearButtonClass, this.searchNode).addClass(this.loadingClass);
    },

    // hide loading spinner
    hideLoading: function () {
        dojo.query('.' + this.clearButtonClass, this.searchNode).removeClass(this.loadingClass);
    },

    // clear the input box
    clearAddress: function () {
        // empty input value
        dojo.query('input', this.searchNode).attr('value', '');
        // set current text
        this.currentText = '';
        // get node of reset button and remove it's active class
        dojo.query('.' + this.clearButtonClass, this.searchNode).removeClass(this.clearButtonActiveClass).attr('title', '');
    },

    // check input box's status
    checkStatus: function () {
        // if input value is not empty
        if (this.currentText) {
            // set class and title
            dojo.query('.' + this.clearButtonClass, this.searchNode).addClass(this.clearButtonActiveClass).attr('title', this.resetTitle);
        } else {
            // clear address
            this.clearAddress();
        }
    },

    // set required HTML
    setHTML: function () {
        var html = '';
        html += '<div class="' + this.autoCompleteClass + '">';
        html += '<div tabindex="0" class="' + this.searchButtonClass + '" title="' + this.placeholder + '"></div>';
        html += '<input tabindex="0" placeholder="' + this.placeholder + '" title="' + this.placeholder + '" value="' + this.defaultText + '" autocomplete="off" type="text">';
        html += '<div tabindex="0" class="' + this.clearButtonClass + '"></div>';
        html += '</div>';
        var node = this.searchNode;
        if (node) {
            node.innerHTML = html;
        }
    },

    // clear auto hide timer and reset it
    resetHideTimer: function () {
        var instance = this;
        clearTimeout(instance.hideTimer);
        instance.hideTimer = setTimeout(function () {
            instance.hide();
        }, instance.hideDelay);
    },

    // show autocomplete
    show: function (results) {
        // if results and result node
        if (results && results.locations.length > 0 && this.resultNode) {
            // set results
            this.results = results;
            // clear hide timer
            this.resetHideTimer();
            // string to set
            var html = '';
            // node of the search box container
            var container = dojo.query('.' + this.autoCompleteClass, this.searchNode);
            // add class to container
            container.addClass(this.autoCompleteActiveClass);
            // position and height of the search box
            var position = dojo.position(container[0]);
            // textbox value
            var partialMatch = this.currentText;
            // partial match highlight
            var regex = new RegExp('(' + partialMatch + ')', 'gi');
            // position the autocomplete
            dojo.query(this.resultNode).style({
                'position': 'absolute',
                'zIndex': 99,
                'left': position.x + 'px',
                'top': position.y + position.h + 'px'
            });
            // create list
            html += '<ul class="' + this.resultsClass + '">';
            // for each result
            for (var i = 0; i < results.locations.length; ++i) {
                // set layer class
                var layerClass = 'even';
                // if it's odd
                if (i % 2 === 0) {
                    // set it to odd
                    layerClass = 'odd';
                }
                // create list item
                html += '<li data-index="' + i + '" tabindex="0" class="' + layerClass + '">' + results.locations[i].name.replace(regex, '<strong>' + partialMatch + '</strong>') + '</li>';
            }
            // close list
            html += '</ul>';
            // set HTML
            this.resultNode.innerHTML = html;
            // show!
            dojo.query(this.resultNode).style('display', 'block');
        } else {
            // hide!
            this.hide();
        }
        // hide loading
        this.hideLoading();
    },

    // set up connections
    setDelegations: function () {
        // isntance of class
        var instance = this;

        // search button click
        dojo.query(instance.searchNode).delegate('.' + instance.searchButtonClass, 'onclick,keyup', function (event) {
            if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
                // remove results
                instance.removeResults();
                // query and then locate
                instance.query(instance.locate);
                // hide autocomplete
                instance.hide();
            }
        });

        // input key up
        dojo.query(instance.searchNode).delegate('input', 'keyup', function (event) {
            // clear timers
            instance.resetHideTimer();
            clearTimeout(instance.showTimer);
            // get textbox value
            var aquery = this.value;
            // update current text variable
            instance.currentText = aquery;
            // length of value
            var alength = 0;
            // if value
            if (aquery) {
                // set length of value
                alength = aquery.length;
            }
            var lists;
            // if enter key was pushed
            if (event.keyCode === 13) {
                // remove results
                instance.removeResults();
                // query then locate
                instance.query(instance.locate);
                // hide autocomplete
                instance.hide();
                // if up arrow pushed
            } else if (event.keyCode === 38) {
                // get all list items
                lists = dojo.query('li', instance.resultNode);
                // get list item length
                var listsLen = lists.length;
                // if not zero
                if (listsLen) {
                    // go to previous list item
                    lists[listsLen - 1].focus();
                }
                // if down arrow pushed
            } else if (event.keyCode === 40) {
                // get all lists
                lists = dojo.query('li', instance.resultNode);
                // if first item
                if (lists[0]) {
                    // focus first item
                    lists[0].focus();
                }
                // if input value is larger than 2
            }
            // esc key
            else if (event.keyCode === 27) {
                // clear timers
                clearTimeout(instance.hideTimer);
                clearTimeout(instance.showTimer);
                // hide autocomplete
                instance.hide();
            } else if (alength >= (instance.minCharacters)) {
                // set timer for showing
                instance.showTimer = setTimeout(function () {
                    // query then show autocomplete
                    instance.query(instance.show);
                }, instance.searchDelay);
            } else {
                // hide autocomplete
                instance.hide();
            }
            // check status of search box
            instance.checkStatus();
        });

        // input click
        dojo.query(instance.searchNode).delegate('input', 'onclick', function (event) {
            if (event.type === 'click') {
                // if input value is empty
                if (!this.value) {
                    // clear address
                    instance.clearAddress();
                }
                // hide autocomplete
                instance.hide();
                // check status of text box
                instance.checkStatus();
            }
        });

        // list item click
        dojo.query(instance.resultNode).delegate('ul li', 'onclick,keyup', function (event) {
            // clear timers
            instance.resetHideTimer();
            clearTimeout(instance.showTimer);
            // size of lists
            var liSize = instance.results.locations.length;
            // input box text
            var locTxt = dojo.query(this).text();
            // index of this list item
            var locNum = parseInt(dojo.query(this).attr('data-index')[0], 10);
            // next/previous index
            var newIndex;
            // if click or enter key pushed
            if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
                // set input text value to this text
                dojo.query('input', instance.searchNode).attr('value', locTxt);
                // set current text var
                instance.currentText = locTxt;
                // locate
                instance.locate(instance.results, locNum);
                // hide autocomplete
                instance.hide();
            } else if (event.type === 'keyup' && event.keyCode === 38) {
                // go to previous item
                newIndex = locNum - 1;
                if (newIndex < 0) {
                    newIndex = liSize - 1;
                }
                dojo.query('li', instance.resultNode)[newIndex].focus();
            } else if (event.type === 'keyup' && event.keyCode === 40) {
                // go to next item
                newIndex = locNum + 1;
                if (newIndex >= liSize) {
                    newIndex = 0;
                }
                dojo.query('li', instance.resultNode)[newIndex].focus();
            }
            // esc key
            else if (event.keyCode === 27) {
                // clear timers
                clearTimeout(instance.hideTimer);
                clearTimeout(instance.showTimer);
                // hide autocomplete
                instance.hide();
            }
        });

        // clear button click
        dojo.query(instance.searchNode).delegate('.' + instance.clearButtonClass, 'onclick,keyup', function (event) {
            if (event.type === 'click' || (event.type === 'keyup' && event.keyCode === 13)) {
                // remove results
                instance.removeResults();
                // hide autocomplete
                instance.hide();
                // clear address
                instance.clearAddress();
                // hide loading
                instance.hideLoading();
            }
        });
    },

    // hide the autocomplete
    hide: function () {
        // hide
        dojo.query(this.resultNode).style('display', 'none');
        // add class to container
        dojo.query('.' + this.autoCompleteClass, this.searchNode).removeClass(this.autoCompleteActiveClass);
    },

    // query for results and then execute a function
    query: function (callback) {
        var instance = this;
        // if query isn't empty
        if (instance.currentText) {
            // show loading
            instance.showLoading();
            // Query object
            var queryContent = {
                "text": instance.currentText,
                "outSR": instance.map.spatialReference.wkid,
                "f": "json"
            };
            // if max locations set
            if (instance.maxLocations) {
                queryContent.maxLocations = instance.maxLocations;
            }
            // local results only
            if (instance.useBoundingBox) {
                var bbox = '';
                bbox += '{';
                bbox += '"xmin":' + instance.map.extent.xmin + ',';
                bbox += '"ymin":' + instance.map.extent.ymin + ',';
                bbox += '"xmax":' + instance.map.extent.xmax + ',';
                bbox += '"ymax":' + instance.map.extent.ymax + ',';
                bbox += '"spatialReference":';
                bbox += '{';
                bbox += '"wkid":' + instance.map.extent.spatialReference.wkid;
                bbox += '}';
                bbox += '}';
                queryContent.bbox = bbox;
            }
            // send request
            var requestHandle = esri.request({
                url: instance.locator + '/find',
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

    // remove result layer from map
    removeResults: function () {
        if (this.resultLayer && this.map) {
            dojo.disconnect(this.resultConnect);
            this.map.removeLayer(this.resultLayer);
            this.resultLayer = false;
        }
    },

    // reset popup
    clearPopup: function () {
        if (this.map && this.map.infoWindow) {
            this.map.infoWindow.setContent('');
            this.map.infoWindow.setTitle('');
            this.map.infoWindow.clearFeatures();
            this.map.infoWindow.hide();
        }
    },

    // go to a location
    locate: function (results, resultNumber) {
        // this
        var instance = this;
        // if we have results
        if (results && results.locations.length > 0) {
            // selected result
            var numResult = 0;
            // if it's not zero
            if (resultNumber) {
                numResult = resultNumber;
            }
            // new extent
            var extent = new esri.geometry.Extent(results.locations[numResult].extent);
            // If option to show point is on and a symbol is defined
            if (instance.showPoint && instance.pointSymbol) {
                // center of extent
                var point = extent.getCenter();
                // create point graphic
                var locationGraphic = new esri.Graphic(point, instance.pointSymbol);
                instance.removeResults();
                instance.clearPopup();
                // if the result layer doesn't exist
                if (!instance.resultLayer) {
                    // create result layer
                    instance.resultLayer = new esri.layers.GraphicsLayer();
                    // set up connection
                    instance.resultConnect = dojo.connect(instance.resultLayer, 'onClick', function (evt) {
                        // stop overriding events
                        dojo.stopEvent(evt);
                        // clear popup
                        instance.clearPopup();
                        // set popup content
                        instance.map.infoWindow.setContent('<strong>' + evt.graphic.attributes.address + '</strong>');
                        // set popup title
                        instance.map.infoWindow.setTitle(instance.popupTitle);
                        // set popup geometry
                        instance.map.infoWindow.show(evt.graphic.geometry);
                    });
                    // add layer to map
                    instance.map.addLayer(instance.resultLayer);
                }
                // graphic with address
                locationGraphic.setAttributes({
                    "address": results.locations[numResult].name
                });
                // add graphic to graphics layer
                instance.resultLayer.add(locationGraphic);
            }
            // set map extent to location
            instance.map.setExtent(extent);
        } else {
            // no results call
            instance.onNoResults(instance);
            // remove results
            instance.removeResults();
            // clear address box
            instance.clearAddress();
        }
        // hide autocomplete
        instance.hide();
        // hide loading
        instance.hideLoading();
        // on search call
        instance.onSearch(instance);
    }
});