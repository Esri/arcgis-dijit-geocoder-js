define({ root:
({
  io: {
    proxyNotSet:"esri.config.defaults.io.proxyUrl is not set."
  },

  map: {
    deprecateReorderLayerString: "Map.reorderLayer(/*String*/ id, /*Number*/ index) deprecated. Use Map.reorderLayer(/*Layer*/ layer, /*Number*/ index).",
    deprecateShiftDblClickZoom: "Map.(enable/disable)ShiftDoubleClickZoom deprecated. Shift-Double-Click zoom behavior will not be supported."
  },

  geometry: {
    deprecateToScreenPoint:"esri.geometry.toScreenPoint deprecated. Use esri.geometry.toScreenGeometry.",
    deprecateToMapPoint:"esri.geometry.toMapPoint deprecated. Use esri.geometry.toMapGeometry."
  },

  layers: {
    tiled: {
      tileError:"Unable to load tile"
    },

    dynamic: {
      imageError:"Unable to load image"
    },

    graphics: {
      drawingError:"Unable to draw graphic "
    },

    agstiled: {
      deprecateRoundrobin:"Constructor option 'roundrobin' deprecated. Use option 'tileServers'."
    },

    imageParameters: {
      deprecateBBox:"Property 'bbox' deprecated. Use property 'extent'."
    },

    FeatureLayer: {
      noOIDField: "objectIdField is not set [url: ${url}]",
      fieldNotFound: "unable to find '${field}' field in the layer 'fields' information [url: ${url}]",
      noGeometryField: "unable to find a field of type 'esriFieldTypeGeometry' in the layer 'fields' information. If you are using a map service layer, features will not have geometry [url: ${url}]",
      invalidParams: "query contains one or more unsupported parameters",
      updateError: "an error occurred while updating the layer",

      createUserSeconds: "Created by ${userId} seconds ago",
      createUserMinute: "Created by ${userId} a minute ago",
      editUserSeconds: "Edited by ${userId} seconds ago",
      editUserMinute: "Edited by ${userId} a minute ago",
      createSeconds: "Created seconds ago",
      createMinute: "Created a minute ago",
      editSeconds: "Edited seconds ago",
      editMinute: "Edited a minute ago",

      createUserMinutes: "Created by ${userId} ${minutes} minutes ago",
      createUserHour: "Created by ${userId} an hour ago",
      createUserHours: "Created by ${userId} ${hours} hours ago",
      createUserWeekDay: "Created by ${userId} on ${weekDay} at ${formattedTime}",
      createUserFull: "Created by ${userId} on ${formattedDate} at ${formattedTime}",

      editUserMinutes: "Edited by ${userId} ${minutes} minutes ago",
      editUserHour: "Edited by ${userId} an hour ago",
      editUserHours: "Edited by ${userId} ${hours} hours ago",
      editUserWeekDay: "Edited by ${userId} on ${weekDay} at ${formattedTime}",
      editUserFull: "Edited by ${userId} on ${formattedDate} at ${formattedTime}",

      createUser: "Created by ${userId}",
      editUser: "Edited by ${userId}",

      createMinutes: "Created ${minutes} minutes ago",
      createHour: "Created an hour ago",
      createHours: "Created ${hours} hours ago",
      createWeekDay: "Created on ${weekDay} at ${formattedTime}",
      createFull: "Created on ${formattedDate} at ${formattedTime}",

      editMinutes: "Edited ${minutes} minutes ago",
      editHour: "Edited an hour ago",
      editHours: "Edited ${hours} hours ago",
      editWeekDay: "Edited on ${weekDay} at ${formattedTime}",
      editFull: "Edited on ${formattedDate} at ${formattedTime}"
    }
  },

  tasks: {
    gp: {
      gpDataTypeNotHandled:"GP Data type not handled."
    },

    na: {
      route: {
        routeNameNotSpecified: "'RouteName' not specified for atleast 1 stop in stops FeatureSet."
      }
    },

    query: {
      invalid: "Unable to perform query. Please check your parameters."
    }
  },

  toolbars: {
    draw: {
      convertAntiClockwisePolygon: "Polygons drawn in anti-clockwise direction will be reversed to be clockwise.",
      addPoint: "Click to add a point",
      addShape: "Click to add a shape",
      addMultipoint: "Click to start adding points",
      freehand: "Press down to start and let go to finish",
      start: "Click to start drawing",
      resume: "Click to continue drawing",
      complete: "Double-click to complete",
      finish: "Double-click to finish",
      invalidType: "Unsupported geometry type"
    },
    edit: {
      invalidType: "Unable to activate the tool. Check if the tool is valid for the given geometry type.",
      deleteLabel: "Delete"
    }
  },

  virtualearth: {
    // minMaxTokenDuration:"Token duration must be greater than 15 minutes and lesser than 480 minutes (8 hours).",

    vetiledlayer: {
      //tokensNotSpecified:"Either clientToken & serverToken must be provided or tokenUrl must be specified."
      bingMapsKeyNotSpecified: "BingMapsKey must be provided."
    },

    vegeocode: {
      //tokensNotSpecified:"Either serverToken must be provided or tokenUrl must be specified.",
      bingMapsKeyNotSpecified: "BingMapsKey must be provided.",
      requestQueued: "Server token not retrieved. Queing request to be executed after server token retrieved."
    }
  },
  widgets: {
    attributeInspector: {
      NLS_first: "First",
      NLS_previous: "Previous",
      NLS_next: "Next",
      NLS_last: "Last",
      NLS_deleteFeature: "Delete",
      NLS_title: "Edit Attributes",
      NLS_errorInvalid: "Invalid",
      NLS_validationInt: "Value must be an integer.",
      NLS_validationFlt: "Value must be a float.",
      NLS_of: "of",
      NLS_noFeaturesSelected: "No features selected"
    },
    overviewMap: {
      NLS_drag: "Drag To Change The Map Extent",
      NLS_show: "Show Map Overview",
      NLS_hide: "Hide Map Overview",
      NLS_maximize: "Maximize",
      NLS_restore: "Restore",
      NLS_noMap: "'map' not found in input parameters",
      NLS_noLayer: "main map does not have a base layer",
      NLS_invalidSR: "spatial reference of the given layer is not compatible with the main map",
      NLS_invalidType: "unsupported layer type. Valid types are 'TiledMapServiceLayer' and 'DynamicMapServiceLayer'"
    },
    timeSlider: {
      NLS_first: "First",
      NLS_previous: "Previous",
      NLS_next: "Next",
      NLS_play: "Play/Pause",
      NLS_invalidTimeExtent: "TimeExtent not specified, or in incorrect format."
    },
    attachmentEditor: {
      NLS_attachments: "Attachments:",
      NLS_add: "Add",
      NLS_none: "None",
      NLS_error: "There was an error.",
      NLS_fileNotSupported: "This file type is not supported."
    },
    editor: {
      tools: {
        NLS_attributesLbl: "Attributes",
        NLS_cutLbl: "Cut",
        NLS_deleteLbl: "Delete",
        NLS_extentLbl: "Extent",
        NLS_freehandPolygonLbl: "Freehand Polygon",
        NLS_freehandPolylineLbl: "Freehand Polyline",
        NLS_pointLbl: "Point",
        NLS_polygonLbl: "Polygon",
        NLS_polylineLbl: "Polyline",
        NLS_reshapeLbl: "Reshape",
        NLS_selectionNewLbl: "New selection",
        NLS_selectionAddLbl: "Add to selection",
        NLS_selectionClearLbl: "Clear selection",
        NLS_selectionRemoveLbl: "Subtract from selection",
        NLS_selectionUnionLbl: "Union",
        NLS_autoCompleteLbl: "Auto Complete",
        NLS_unionLbl: "Union",
        NLS_rectangleLbl: "Rectangle",
        NLS_circleLbl: "Circle",
        NLS_ellipseLbl: "Ellipse",
        NLS_triangleLbl: "Triangle",
        NLS_arrowLbl: "Arrow",
        NLS_arrowLeftLbl: "Left Arrow",
        NLS_arrowUpLbl: "Up Arrow",
        NLS_arrowDownLbl: "Down Arrow",
        NLS_arrowRightLbl: "Right Arrow",
        NLS_undoLbl: "Undo",
        NLS_redoLbl: "Redo"
      }
    },
    Geocoder: {
    	main: {
            clearButtonTitle: "Clear Search",
            searchButtonTitle: "Search",
            geocoderMenuButtonTitle: "Change Geocoder",
            geocoderMenuHeader: "Select geocoder",
			geocoderMenuCloseTitle:"Close Menu",
			untitledGeocoder: "Untitled geocoder"
        },
        esriGeocoderName: "Esri World Geocoder"
    },
    legend: {
      NLS_creatingLegend: "Creating legend",
      NLS_noLegend: "No legend"
    },
    popup: {
      NLS_moreInfo: "More info",
      NLS_searching: "Searching",
      NLS_prevFeature: "Previous feature",
      NLS_nextFeature: "Next feature",
      NLS_close: "Close",
      NLS_prevMedia: "Previous media",
      NLS_nextMedia: "Next media",
      NLS_noInfo: "No information available",
      NLS_noAttach: "No attachments found",
      NLS_maximize: "Maximize",
      NLS_restore: "Restore",
      NLS_zoomTo: "Zoom to",
      NLS_pagingInfo: "(${index} of ${total})",
      NLS_attach: "Attachments"
    },
    measurement: {
      NLS_distance: "Distance",
      NLS_area: "Area",
      NLS_location: "Location",
      NLS_resultLabel: "Measurement Result",
      NLS_length_miles: "Miles",
      NLS_length_kilometers: "Kilometers",
      NLS_length_feet: "Feet",
      NLS_length_meters: "Meters",
      NLS_length_yards: "Yards",
      NLS_area_acres: "Acres",
      NLS_area_sq_miles: "Sq Miles",
      NLS_area_sq_kilometers: "Sq Kilometers",
      NLS_area_hectares: "Hectares",
      NLS_area_sq_yards: "Sq Yards",
      NLS_area_sq_feet: "Sq Feet",
      NLS_area_sq_meters: "Sq Meters",
      NLS_deg_min_sec: "DMS",
      NLS_decimal_degrees: "Degrees",
      NLS_map_coordinate: "Map Coordinate",
      NLS_longitude: "Longitude",
      NLS_latitude: "Latitude"
    },
    bookmarks: {
      NLS_add_bookmark: "Add Bookmark",
      NLS_new_bookmark: "Untitled",
      NLS_bookmark_edit: "Edit",
      NLS_bookmark_remove: "Remove"
    },
    print: {
      NLS_print: "Print",
      NLS_printing: "Printing",
      NLS_printout: "Printout"
    },
    templatePicker: {
      creationDisabled: "Feature creation is disabled for all layers.",
      loading: "Loading.."
    }
  },
  arcgis: {
    utils: {
      baseLayerError: "Unable to load the base map layer",
      geometryServiceError: "Provide a geometry service to open Web Map."
    }
  },

  identity: {
    lblItem: "item",
    title: "Sign in",
    info: "Please sign in to access the item on ${server} ${resource}",
    lblUser: "User Name:",
    lblPwd: "Password:",
    lblOk: "OK",
    lblSigning: "Signing in...",
    lblCancel: "Cancel",
    errorMsg: "Invalid username/password. Please try again.",
    invalidUser: "The username or password you entered is incorrect.",
    forbidden: "The username and password are valid, but you don't have access to this resource.",
    noAuthService: "Unable to access the authentication service."
  }
}),
"ar":1,
"da":1,
"de":1,
"es":1,
"fr":1,
"he":1,
"it":1,
"ja":1,
"ko":1,
"lt":1,
"nl":1,
"nb":1,
"pl":1,
"pt-br":1,
"pt-pt":1,
"ro":1,
"ru":1,
"sv":1,
"zh":1,
"zh-cn":1
});