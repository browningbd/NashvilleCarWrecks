require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/GeoJSONLayer",
    "esri/renderers/UniqueValueRenderer",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/PopupTemplate",
    "esri/widgets/Expand",
    "esri/widgets/Legend",
    "esri/widgets/Home",
    "esri/widgets/ScaleBar",
    "esri/widgets/Fullscreen",
    "esri/rest/support/Query",
    "esri/core/reactiveUtils"
], (
    Map,
    MapView,
    GeoJSONLayer,
    UniqueValueRenderer,
    SimpleMarkerSymbol,
    PopupTemplate,
    Expand,
    Legend,
    Home,
    ScaleBar,
    Fullscreen,
    Query,
    reactiveUtils
) => {

    // Set default center and zoom for showing all features.
    let defaultCenter = [-86.78, 36.2];
    let defaultZoom = 10;

    const wreckTypeSelect = document.getElementById("collisionTypeSelect");
    const precinctSelect = document.getElementById("precinctSelect");
    const weatherSelect = document.getElementById("weatherSelect");
    const lightingSelect = document.getElementById("lightingSelect");

    const resultCount = document.getElementById("resultCount");

    // Create a renderer for the wrecks layer
    const wreckRenderer = new UniqueValueRenderer({
        field: "illumination_description",
        legendOptions: {
            title: "Lighting Condition",
        },
        // Vary points by size
        visualVariables: [{
            type: "size",
            field: "number_of_motor_vehicles",
            legendOptions: {
                title: "Number of Vehicles Involved"
            },
            minDataValue: 1,
            maxDataValue: 15,
            minSize: 4,
            maxSize: 60
        }]
    });

    // Use this function to set classes for a UniqueValues renderer.
    const addUniqueVal = function (val, col, lbl, renderer) {
        var sym = new SimpleMarkerSymbol({
            style: "circle",
            color: col,
            outline: null
        });
        renderer.addUniqueValueInfo({
            value: val,
            symbol: sym,
            label: lbl
        });
    };

    // Set Class Breaks
    addUniqueVal("DARK - NOT LIGHTED", "#0B2370", "Dark, Not Lighted", wreckRenderer);
    addUniqueVal("DARK - LIGHTED", "#35459C", "Dark, Lighted", wreckRenderer);
    addUniqueVal("DUSK", "#7399EB", "Dusk", wreckRenderer);
    addUniqueVal("DAYLIGHT", "#FFD13C", "Daylight", wreckRenderer);
    addUniqueVal("DAWN", "#F7A01E", "Dawn", wreckRenderer);


    // Set Popup Contents
    const wrecksPopup = new PopupTemplate({
        title: "Car Wreck #{accident_number}",
        content: [{
            type: "fields",
            fieldInfos: [{
                fieldName: "accident_number",
                label: "Accident Number"
            }, {
                fieldName: "date_and_time",
                label: "Date and Time"
            }, {
                fieldName: "collision_type_description",
                label: "Collision Type Description"
            }, {
                fieldName: "weather_description",
                label: "Weather Condition"
            }, {
                fieldName: "illumination_description",
                label: "Lighting Condition"
            }, {
                fieldName: "harmfuldescriptions",
                label: "Description of Harm"
            }, {
                fieldName: "street_address",
                label: "Street Address"
            }, {
                fieldName: "precinct",
                label: "Precinct"
            }, {
                fieldName: "number_of_motor_vehicles",
                label: "Number of Motor Vehicles"
            }, {
                fieldName: "number_of_injuries",
                label: "Number of Injuries"
            }, {
                fieldName: "number_of_fatalities",
                label: "Number of Fatalities"
            }, {
                fieldName: "property_damage",
                label: "Property Damage"
            }]
        }]
    });

    const precinctPopup = new PopupTemplate({
        title: "{PrecinctName} PRECINCT"
    });

    // Creates the wrecks layer pulling from Nashville Data Portal API
    const wrecksLayer = new GeoJSONLayer({
        url: "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Traffic_Accidents_2/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        renderer: wreckRenderer,
        popupTemplate: wrecksPopup,
        outFields: ["*"],
    });

    // Creates the precincts layer pulling from Nashville Data Portal API
    const precinctsLayer = new GeoJSONLayer({
        url: "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Police_Precinct_Boundaries_view/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [0, 0, 0, 0.45],
                outline: {
                    color: [0, 0, 0]
                }
            }
        },
        popupTemplate: precinctPopup,
    });

    const map = new Map({
        basemap: "topo-vector",
        layers: [precinctsLayer, wrecksLayer],
    });

    const view = new MapView({
        map: map,
        container: "viewDiv",
        center: defaultCenter,
        zoom: defaultZoom,
    });


    // Add a few UI features including HTML selector
    const homeBtn = new Home({
        view: view,
        viewpoint: precinctsLayer.fullExtent
    });

    view.ui.add(homeBtn, "top-left");

    const legend = new Expand({     // Allows legend to be opened and closed
        content: new Legend({
            view: view,
            layerInfos: [
                {
                    layer: wrecksLayer,
                    title: "Wrecks",
                },
                {
                    layer: precinctsLayer,
                    title: "Precinct Boundaries"
                }
            ]
        }),
        view: view,
        expanded: true
    });

    view.ui.add(legend, "bottom-left");

    view.ui.add(document.getElementById("optionsDiv"), {
        position: "top-right",
        index: 0
    });

    const sBar = new ScaleBar({
        view: view,
        style: "ruler",
        unit: "non-metric"
    });

    view.ui.add(sBar, {
        position: "bottom-right",
        index: 1
    })

    const fullscreen = new Fullscreen({
        view: view
    });

    view.ui.add(fullscreen, "top-left");


    // Parent function that can take variables for a selector
    const populateSelect = function (selector, layer, field) {
        view.when(function () {
            return layer.when(function () {
                const query = layer.createQuery();
                return layer.queryFeatures(query);
            });
        })
            .then(getValues)
            .then(getUniqueValues)
            .then(addToSelect)

        // Gets each value for every feature
        function getValues(response) {
            const features = response.features;
            const values = features.map(function (feature) {
                return feature.attributes[field];
            });
            return values;
        }

        // Puts only the unique values into a list
        function getUniqueValues(values) {
            const uniqueValues = [];

            values.forEach(function (item, i) {
                if (
                    (uniqueValues.length < 1 || uniqueValues.indexOf(item) === -1) &&
                    item !== ""
                ) {
                    uniqueValues.push(item);
                }
            });
            return uniqueValues;
        }

        // Adds a selector option for each unique value.
        function addToSelect(values) {
            values.sort();
            values.forEach(function (value) {
                const option = document.createElement("option");
                option.text = value;
                selector.add(option);
            });
        }
    };

    // Uses the parent function to populate each selector with the correct information.
    populateSelect(wreckTypeSelect, wrecksLayer, "Collision_Type_Description");
    populateSelect(precinctSelect, precinctsLayer, "PrecinctName");
    populateSelect(weatherSelect, wrecksLayer, "Weather_Description");
    populateSelect(lightingSelect, wrecksLayer, "Illumination_Description");


    // Waits for changes to the selector using an event listen and then runs queryWrecks function.
    let button = document.getElementById("filterWrecks")
    button.addEventListener("click", queryWrecks);


    function queryWrecks() {
        let precinct = precinctSelect.value;
        let precinctQuery = "precinct = '" + precinct + "'"; // Used for precinctLayer

        // Creates a dictionary containing precinct abbreviations found in wrecksLayer 
        let precinctAbbr = {
            "HERMITAGE": "HERMIT", "NORTH": "NORTH", "EAST": "EAST", "CENTRAL": "CENTRA", "WEST": "WEST", "SOUTH": "SOUTH",
            "MIDTOWN HILLS": "MIDTOW", "MADISON": "MADISO"
        };

        // Creates a dictionary of input values and corresponding queries for wrecksLayer
        let queryLookup = [{ input: precinct, query: "precinct = '" + precinctAbbr[precinct] + "'" },
        { input: wreckTypeSelect.value, query: "collision_type_description = '" + wreckTypeSelect.value + "'" },
        { input: weatherSelect.value, query: "weather_description = '" + weatherSelect.value + "'" },
        { input: lightingSelect.value, query: "illumination_description = '" + lightingSelect.value + "'" },
        ];

        // Get the necessary queries and join them together
        let queryList = [];
        queryLookup.forEach(function (item) {
            if (item.input != "ALL") {
                queryList.push(item.query);
            }
        });
        let finalQuery = queryList.join(" AND "); 

        // Create query for wrecksLayer
        const wrecksQuery = new Query({
            where: finalQuery,
        });

        // Changes the definition expression and view for the precinctsLayer
        if (precinct != "ALL") {
            view.whenLayerView(precinctsLayer).then(function (layerView) {  // Client-side Querying necessary for GeoJSONs
                precinctsLayer.definitionExpression = precinctQuery;
                let handle = reactiveUtils.when(
                    () => !layerView.updating, // Activates query once expression set
                    () => {
                        layerView.queryExtent()
                            .then(function (results) {
                                let extent = results.extent
                                view.goTo(extent);
                                homeBtn.viewpoint = extent
                                handle.remove(); // Prevents from acting on view changes made by user.
                            })
                    })
            });
        }

        else if (precinct == "ALL") {
            view.whenLayerView(precinctsLayer).then(function (layerView) {
                precinctsLayer.definitionExpression = null;
                let handle = reactiveUtils.when(
                    () => !layerView.updating,
                    () => {
                        view.goTo(precinctsLayer.fullExtent);
                        homeBtn.viewpoint = precinctsLayer.fullExtent;
                        handle.remove();
                    })
            });
        };

        view.whenLayerView(wrecksLayer).then(function (layerView) {
            wrecksLayer.definitionExpression = finalQuery;
            let handle = reactiveUtils.when(
                () => !layerView.updating,
                () => {
                    layerView.queryFeatureCount(wrecksQuery).then(function (count) {
                        resultCount.innerHTML = count + " features found";
                        handle.remove();
                    })
                })
        });
    };
});
