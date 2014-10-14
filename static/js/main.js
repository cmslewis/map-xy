$(document).ready(function() {


  // Constants
  // =========

  var KeyCodes = {
    TAB   : 9,
    ENTER : 13
  };

  var SF_COORDINATES = {
    lat :   37.757719928168605,
    lng : -122.43760000000003
  };

  var NY_COORDINATES = {
    lat :  40.75908947336607,
    lng : -73.96923099999998
  };


  // Variables
  // =========

  var mapX = null;
  var mapY = null;

  var currentPlaceOnMapX = null;
  var currentPlaceOnMapY = null;

  var wasZoomChangeDoneProgrammatically = false;

  var $ui = {
    panels             : $('.panels'),
    stackedModeTrigger : $('.js-stacked-mode-trigger'),
    switchMapsTrigger  : $('.js-switch-maps-trigger'),
    mapX               : $('.js-map-x'),
    mapY               : $('.js-map-y'),
    autocompleteFields : $('.search input'),
    autocompleteLabels : $('.search label'),
    autocompleteX      : $('.js-autocomplete-x'),
    autocompleteY      : $('.js-autocomplete-y'),
    recenterTriggers   : $('.recenter-button'),
    recenterTriggerX   : $('.js-recenter-trigger-x'),
    recenterTriggerY   : $('.js-recenter-trigger-y'),
    titleTriggerX      : $('.js-title-trigger-x'),
    titleTriggerY      : $('.js-title-trigger-y')
  };


  // Helpers
  // =======

  function initialize() {
    var maps = initializeMaps(SF_COORDINATES, NY_COORDINATES);

    mapX = maps[0];
    mapY = maps[1];

    initializeButtons(mapX, mapY);
    initializeSearch(mapX, $ui.autocompleteX, $ui.autocompleteY);
    initializeSearch(mapY, $ui.autocompleteY);

    $ui.autocompleteX.focus();
  }

  function propagateZoomLevel(fromMap, toMap) {
    google.maps.event.addListener(fromMap, 'zoom_changed', function() {

      if (wasZoomChangeDoneProgrammatically) {
        wasZoomChangeDoneProgrammatically = false;
      } else {
        // Change the zoom level in the other map. Be sure to set the flag before changing the zoom of the other map,
        // because this listener will be fired immediately after the other map's zoom level changes.
        wasZoomChangeDoneProgrammatically = true;
        toMap.setZoom(fromMap.getZoom());
      }
    });
  }

  function initializeMaps(mapXInitialCoords, mapYInitialCoords) {
    var mapXOptions = getMapOptions(mapXInitialCoords);
    var mapYOptions = getMapOptions(mapYInitialCoords);

    mapX = new google.maps.Map($ui.mapX[0], mapXOptions);
    mapY = new google.maps.Map($ui.mapY[0], mapYOptions);

    propagateZoomLevel(mapX, mapY);
    propagateZoomLevel(mapY, mapX);

    return [mapX, mapY];
  }

  function getMapOptions(centerCoords) {
    return {

      // Basic Options

      center : centerCoords,
      zoom   : 12,

      // Enabled Controls

      scaleControl : true,

      // Disabled Controls

      mapTypeControl     : false,
      panControl         : false,
      overviewMapControl : false,
      streetViewControl  : false,
      zoomControl        : false

    };
  }

  function initializeSearch(map, $input, $nextInput) {
    var autocompleteService = new google.maps.places.AutocompleteService();
    var autocomplete        = new google.maps.places.Autocomplete($input[0]);
    var placesService       = new google.maps.places.PlacesService(map);

    autocomplete.bindTo('bounds', map);

    // We only want to search for coarse, geocode-able locations; not businesses, landmarks, and other small stuff.
    autocomplete.setTypes(['geocode']);

    // Counterintuitively, the 'place_changed' event is fire not only when the user explicitly selects a place from
    // the autosuggest menu, but also when they press Enter without selecting a place at all. In the former case, we
    // can just recenter the map on the autocompleted place. In the latter case, we need to programmatically query
    // the top few autocomplete results using the string currently in the input field, grab the first result if it
    // exists, then recenter the map on that.
    google.maps.event.addListener(autocomplete, 'place_changed', function() {
      var place = autocomplete.getPlace();

      if (place.geometry) {
        saveCurrentPlaceOnMap(map, place);
        recenterMapAndChangeFocus(map, place, $input, $nextInput);
      } else {

        var queryOptions = {
          input : $input.val()
        };

        autocompleteService.getQueryPredictions(queryOptions, function(predictions, status) {
          if (status !== google.maps.places.PlacesServiceStatus.OK) {
            return;
          }

          if (predictions.length === 0) {
            return;
          }

          var detailsOptions = {
            placeId : predictions[0].place_id
          };

          placesService.getDetails(detailsOptions, function(_place, _status) {
            if (_status !== google.maps.places.PlacesServiceStatus.OK) {
              return;
            }
            saveCurrentPlaceOnMap(map, _place);
            recenterMapAndChangeFocus(map, _place, $input, $nextInput);
            $input.val(_place.formatted_address);
          });
        });
      }
    });
  }

  function initializeButtons(mapX, mapY) {

    // Title Triggers
    // --------------

    $ui.titleTriggerX.on('click', function() {
      $ui.autocompleteX.focus();
    });

    $ui.titleTriggerY.on('click', function() {
      $ui.autocompleteY.focus();
    });

    // 'Stacked Mode' Trigger
    // ----------------------

    $ui.stackedModeTrigger.on('click', function() {
      if ($ui.panels.attr('data-view-mode') === 'stacked') {
        $ui.panels.attr('data-view-mode', '');
        $(this).removeClass('is-impressed');
      } else {
        $ui.panels.attr('data-view-mode', 'stacked');
        $(this).addClass('is-impressed');
      }

      // We need to let the Maps API know when the size of the Map X container changes.
      google.maps.event.trigger(mapX, 'resize');
    });

    $ui.stackedModeTrigger.on('mouseenter', function() {
      if ($ui.panels.attr('data-view-mode') === 'stacked') {
        return;
      } else {
        $ui.panels.attr('data-view-mode', 'stacked-preview');
      }
    });

    $ui.stackedModeTrigger.on('mouseleave', function() {
      if ($ui.panels.attr('data-view-mode') === 'stacked') {
        return;
      } else {
        $ui.panels.attr('data-view-mode', '');
      }
    });

    // 'Switch Maps' Trigger
    // ---------------------

    $ui.switchMapsTrigger.on('click', function() {
      var newMapXCenter = mapY.getCenter();
      var newMapYCenter = mapX.getCenter();
      mapX.panTo(newMapXCenter);
      mapY.panTo(newMapYCenter);

      var newAutocompleteXText = $ui.autocompleteY.val();
      var newAutocompleteYText = $ui.autocompleteX.val();
      $ui.autocompleteX.val(newAutocompleteXText);
      $ui.autocompleteY.val(newAutocompleteYText);
    });

    // Autocomplete Fields
    // -------------------

    $ui.autocompleteFields.on('focus', function() { $(this).closest('.input').addClass('focus'); });
    $ui.autocompleteFields.on('blur',  function() { $(this).closest('.input').removeClass('focus'); });

    $ui.autocompleteLabels.on('click', function() {
      $ui.autocompleteFields.blur();
      $(this).siblings('.input').find('input').focus();
    });

    $ui.autocompleteX.on('keyup', function(ev) {
      if ($(this).val().length === 0) {
        currentPlaceOnMapX = null;
        disableRecenterTrigger($ui.recenterTriggerX);
      }
    });

    $ui.autocompleteY.on('keyup', function(ev) {
      if ($(this).val().length === 0) {
        currentPlaceOnMapY = null;
        disableRecenterTrigger($ui.recenterTriggerY);
      }
    });

    // Some elements within the maps are visible in the tabbing order. This ensures that tabbing only toggles focus
    // between the two search fields.
    $ui.autocompleteY.on('keydown', function(ev) {
      if (ev.keyCode == KeyCodes.TAB) {
        ev.preventDefault();
        $(this).blur();
        $ui.autocompleteX.focus();
      }
    });

    // Recenter Triggers
    // -----------------

    activateRecenterTrigger($ui.recenterTriggerX, mapX);
    activateRecenterTrigger($ui.recenterTriggerY, mapY);
  }

  function saveCurrentPlaceOnMap(map, place) {
    if (map === mapX) {
      currentPlaceOnMapX = place;
      enableRecenterTrigger($ui.recenterTriggerX);
    } else if (map == mapY) {
      currentPlaceOnMapY = place;
      enableRecenterTrigger($ui.recenterTriggerY);
    }
  }

  function recenterMapAndChangeFocus(map, place, $input, $nextInput) {
      centerMapOnPlace(map, place);

      $input.blur();
      if ($nextInput != null) {
        $nextInput.focus();
      }
  }

  function activateRecenterTrigger($trigger, map) {
    $trigger.on('click', function() {
      if (map === mapX) {
        centerMapOnPlaceIfNecessary(mapX, currentPlaceOnMapX);
      } else if (map === mapY) {
        centerMapOnPlaceIfNecessary(mapY, currentPlaceOnMapY);
      }
    });
  }

  function enableRecenterTrigger($trigger) {
    $trigger.addClass('is-enabled');
  }

  function disableRecenterTrigger($trigger) {
    $trigger.removeClass('is-enabled');
  }

  function centerMapOnPlaceIfNecessary(map, place) {
    if (place != null) {
      centerMapOnPlace(map, place);
    }
  }

  function centerMapOnPlace(map, place) {
    if (place.geometry.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
    }
  }


  // Main
  // ====

  initialize();

});
