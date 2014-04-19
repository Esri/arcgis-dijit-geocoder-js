var map, geocoder;

require([
    "esri/map",
    "application/Geocoder",
    "dojo/on",
    "esri/symbols/SimpleMarkerSymbol",
    "dojo/_base/Color",
    "esri/InfoTemplate",
    "esri/graphic",
    "esri/geometry/Extent",
    "esri/geometry/Multipoint",
    "esri/geometry/Polygon",
    "esri/geometry/Polyline",
    "esri/geometry/ScreenPoint",

    "dojo/domReady!"
], function (
    Map,
    Geocoder,
    on,
    SimpleMarkerSymbol,
    Color,
    InfoTemplate,
    Graphic,
    Extent,
    Multipoint,
    Polygon,
    Polyline,
    ScreenPoint
) {
    map = new Map("map", {
        basemap: "gray",
        center: [-120.435, 46.159], // lon, lat
        zoom: 7
    });

    var geocoders = [{
        url: "http://geocodedev.arcgis.com/arcgis/rest/services/World/GeocodeServer",
        name: "geocode.arcgis.com",
        outFields: "Xmin, Xmax, Ymin, Ymax",
        singleLineFieldName: "SingleLine"
    }, {
        url: "http://geocodedev.arcgis.com/arcgis/rest/services/World/GeocodeServer",
        name: "geocodedev.arcgis.com",
        outFields: "Xmin, Xmax, Ymin, Ymax",
        singleLineFieldName: "SingleLine"
    }];

    geocoder = new Geocoder({
        autoComplete: true, // show autocomplete?
        //arcgisGeocoder: true, // use esri geocoder
        //value: "", // Value of input
        //theme: "simpleGeocoder", // Theme
        //maxLocations: 15, // Maximum result locations to return
        //minCharacters: 3, // Minimum amount of characters before searching
        //searchDelay: 300, // Delay before doing the query. To avoid being too chatty.
        //geocoderMenu: true, // Show geocoder menu if necessary
        //autoNavigate: true, // Automatically navigate
        //showResults: true, // show result suggestions
        //geocoders: geocoders,
        map: map
    }, "search");
    geocoder.startup();


    // on search results
    on(geocoder, 'find-results', function (results) {
        console.log('search', results);
    });

    // on search results
    on(geocoder, 'geocoder-select', function (results) {
        console.log('onselect', results);
    });

    // on search results
    on(geocoder, 'auto-complete', function (results) {
        console.log('autocomplete', results);
    });

    // on params
    on(geocoder, 'select', function (results) {
        console.log('params', results);
    });


    geocoder.on('load', function () {

        // text
        //geocoder.find('texas');

        // test graphic        
        var sms = new SimpleMarkerSymbol().setStyle(SimpleMarkerSymbol.STYLE_SQUARE).setColor(new Color([255, 0, 0, 0.5]));
        var attr = {
            test: true
        };
        var infoTemplate = new InfoTemplate("");
        var graphic = new Graphic(null, sms, attr, infoTemplate);

        // point
        var geom_point;
        geom_point = map.extent.getCenter();
        graphic.setGeometry(geom_point);
        //geocoder.find(graphic);

        // extent
        var geom_extent;
        geom_extent = new Extent({
            "xmin": -8607039.231829444,
            "ymin": 4739475.8781803325,
            "xmax": -7875689.745196914,
            "ymax": 5432301.102557136,
            "spatialReference": {
                "wkid": 102100
            }
        });
        graphic.setGeometry(geom_extent);
        //geocoder.find(graphic);

        // multi point
        var geom_multipoint;
        var mpJson = {
            "points": [
                [-8241364.488513179, 5085888.490368734],
                [-8561177.01485834, 5036968.792266224],
                [-8602147.262019193, 4615647.892358353]
            ],
            "spatialReference": map.spatialReference
        };
        geom_multipoint = new Multipoint(mpJson);
        graphic.setGeometry(geom_multipoint);
        //geocoder.find(graphic);

        // polygon
        var geom_polygon;
        var polygonJson = {
            "rings": [
                [
                    [-10877122.9377, 4196874.6838999987],
                    [-10877491.073, 4198404.1431000009],
                    [-10872792.0978, 4200666.6297999993],
                    [-10869221.4416, 4203604.6297999993],
                    [-10868091.3254, 4204880.5675000027],
                    [-10867864.0249, 4205058.9556000009],
                    [-10865494.3689, 4206307.3962000012],
                    [-10865420.8832, 4206341.5020999983],
                    [-10863431.2126, 4207145.8369999975],
                    [-10863259.1166, 4207194.0028000027],
                    [-10859556.0197, 4207797.7686000019],
                    [-10858907.9518, 4208275.2923000008],
                    [-10858569.7756, 4208420.0349999964],
                    [-10850438.3532, 4209847.744599998],
                    [-10846954.0065, 4210534.0552999973],
                    [-10846936.3718, 4210537.3250999972],
                    [-10842751.9891, 4211265.0438999981],
                    [-10842701.9025, 4211272.1406000033],
                    [-10840681.1836, 4211493.9178000018],
                    [-10840505.6094, 4209894.1766000018],
                    [-10842501.1728, 4209675.1603000015],
                    [-10846651.7896, 4208953.3138],
                    [-10850135.4967, 4208267.1291000023],
                    [-10850145.7183, 4208265.184299998],
                    [-10850151.8497, 4208264.0833000019],
                    [-10858105.3848, 4206867.6070000008],
                    [-10858757.6235, 4206387.0101],
                    [-10859105.4681, 4206240.6305000037],
                    [-10862911.4035, 4205620.0974999964],
                    [-10864780.1148, 4204864.6609999985],
                    [-10866983.9587, 4203703.5776999965],
                    [-10868058.7866, 4202490.0622999966],
                    [-10868149.8824, 4202402.2205],
                    [-10871844.4038, 4199362.3020000011],
                    [-10872006.5951, 4199258.6595999971],
                    [-10876792.9088, 4196954.1207000017],
                    [-10877122.9377, 4196874.6838999987]
                ]
            ],
            "spatialReference": map.spatialReference
        };
        geom_polygon = new Polygon(polygonJson);
        graphic.setGeometry(geom_polygon);
        //geocoder.find(graphic);

        // poly line
        var geom_polyline;
        var polylineJson = {
            "paths": [
                [
                    [-10872006.5951, 4199258.6595999971],
                    [-10876792.9088, 4196954.1207000017],
                    [-10877122.9377, 4196874.6838999987]
                ]
            ],
            "spatialReference": map.spatialReference
        };
        geom_polyline = new Polyline(polylineJson);
        graphic.setGeometry(geom_polyline);
        //geocoder.find(graphic);

        // screen point
        var geom_screenpoint;
        geom_screenpoint = new ScreenPoint({
            x: 287,
            y: 411
        });
        graphic.setGeometry(geom_polygon);
        geocoder.find(geom_screenpoint);
    });


});