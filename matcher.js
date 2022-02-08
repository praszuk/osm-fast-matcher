/* jshint esversion: 6 */
const preElements = Array.from(document.getElementsByTagName('pre'));
const progressCurrentEl = document.getElementById('verify-progress-current');
const progressAcceptedEl = document.getElementById('verify-progress-accepted');
const progressRejectedEl = document.getElementById('verify-progress-rejected');
const rejectBtn = document.getElementById('btn-reject');
const acceptBtn = document.getElementById('btn-accept');

const KEY_REJECT = 'o';
const KEY_ACCEPT = 'p';

/**
 * Keeps raw json data from overpass file input
 * @type {!Object}
 */
var overpassData = null;
/**
 * Keeps raw json data from geojson file input
 * @type {!Object}
 */
var geojsonData = null;

/**
 * OsmIdTag (given by user from input) is used at generating changeset file
 * as key to fill accepted (verified) Match/Osm objects with a new tag
 * @type {!string}
 */
var osmIdTag = null;
/**
 * featureIdTag (given by user from input) is used at generating changeset file
 * as key to get value from feature object to fill accepted (verified)
 * Match/Osm objects with a new tag
 * @type {!(number|string)}
 */
var featureIdTag = null;

/**
 * [mapMatchManager description]
 * @type {!MapMatchManager}
 */
var mapMatchManager = null;

/**
 * Represents a match for Overpass Element data with any GeoJSON Feature(s).
 */
class Match{
    /**
     * Filtered array with overpass elements objects without additional nodes
     * @type {Object[]}
     */
    static overpassElements = null;
    /**
     * Object which contains only additional nodes, needed to recreate "WAY"
     * @type {Object}
     */
    static overpassExtraNodes = null;
    static geojsonFeatures = null;

    /**
     * @param {number} elementIndex – index from overpassElements
     * @param {number} featureMatchIndex – index from geojsonFeatures.
     * @param {array} [data=null] – additional data from classification matches
     * it contains arrays of matched featues indexes on various threshold/rules
     */
    constructor(elementIndex, featureMatchIndex, data = null){
        this.featureMatchIndex = featureMatchIndex;
        this.elementIndex = elementIndex;

        this.data = data;

        this.uncertain = false;
        this.verified = null;
    }

    /**
     * @return {Object} overpass element used to matching with features
     */
    get element(){
        return Match.overpassElements[this.elementIndex];
    }

    /**
     * @return {!Object} GeoJSON Feature matched with overpass element or null
     */
    get feature(){
        if (this.isMatched){
            return Match.geojsonFeatures[this.featureMatchIndex];
        }
        return null;
    }

    /**
     * @return {Boolean} is geojson feature matched with overpass element
     */
    get isMatched() {
        return this.featureMatchIndex != null;
    }
}

/**
 * MapMatchManager implements logic to serving Match objects for Map Matcher.
 * Match objects will be verified (accepted or rejected) by user.
 * It's a kind of Collection/Iterator class.
 */
class MapMatchManager{
    /**
     * @type {!Match[]}
     */
    #verifyObjects;
    /**
     * @type {number}
     */
    #currentVerifyIndex;
    /**
     * @type {number}
     */
    #acceptCounter;
    /**
     * @type {number}
     */
    #rejectCounter;

    /**
     * @param {!Match[]} [matches=null] – Array of Match objects to verify
     */
    constructor(matches = null){
        this.#verifyObjects = matches;
        this.#currentVerifyIndex = -1;
        this.#acceptCounter = 0;
        this.#rejectCounter = 0;
    }
    /**
     * @return {!Match} – if #verifyObjects is not null it should always return
     * current Match object which is pointed by #currentVerifyIndex
     */
    get current() {
        if (this.#currentVerifyIndex > -1){
            return this.#verifyObjects[this.#currentVerifyIndex];
        }
        return null;
    }

    /**
     * @return {number} – #currentVerifyIndex which point to Match object
     * if #verifyObjects is not null, else returns -1
     */
    get currentIndex(){
        return this.#currentVerifyIndex;
    }

    /**
     * @return {number} – length of #verifyObjects collection if not null
     * else returns -1
     */
    get size(){
        return this.#verifyObjects != null ? this.#verifyObjects.length:-1;
    }

    /**
     * @return {number} – number of Match objects accepted by user
     */
    get acceptCounter(){
        return this.#acceptCounter;
    }

    /**
     * @return {number} – number of Match objects rejected by user
     */
    get rejectCounter(){
        return this.#rejectCounter;
    }

    /**
     * @return {number} – accepted Match objects by user (verified=true)
     */
    get acceptedMatches(){
        if (this.#verifyObjects){
            return this.#verifyObjects.filter((obj) => obj.verified);
        }
        return null;
    }

    /**
     * @return {number} – rejected Match objects by user (verified=false)
     */
    get rejectedMatches(){
        if (this.#verifyObjects){
            return this.#verifyObjects.filter((obj) => obj.verified == false);
        }
        return null;
    }

    /**
     * Increase #currentVerifyIndex if it isn't last element in #verifyObjects
     * @return {!Match} – next Match object or null if it's last object
     */
    next(){
        if (this.#currentVerifyIndex + 1 == this.#verifyObjects.length){
            return null;
        }
        this.#currentVerifyIndex++;

        return this.current;
    }

    /**
     * Decrease #currentVerifyIndex if it isn't first element in #verifyObjects
     * @return {!Match} – next Match object or null if it's first object
     */
    previous(){
        if (this.#currentVerifyIndex - 1 < 0){
            return null;
        }
        this.#currentVerifyIndex--;

        return this.current;
    }

    /**
     * Action performed when user clicks Accept button.
     * It increases/decreases counters (accept/reject) and change
     * Match object verified=true.
     * @param  {Boolean} [moveToNext=true] if true then change current Match
     * object to next after updating current
     */
    accept(moveToNext = true){

        if (this.current.verified == false){
            this.#rejectCounter--;
            this.#acceptCounter++;
        }
        else if (this.current.verified == null){
            this.#acceptCounter++;
        }

        this.current.verified = true;

        if (moveToNext){
            this.next();
        }
    }

    /**
     * Action performed when user clicks Reject button.
     * It increases/decreases counters (accept/reject) and change
     * Match object verified=false.
     * @param  {Boolean} [moveToNext=true] if true then change current Match
     * object to next after updating current
     */
    reject(moveToNext = true){
        if (this.current.verified == true){
            this.#acceptCounter--;
            this.#rejectCounter++;
        }
        else if (this.current.verified == null){
            this.#rejectCounter++;
        }

        this.current.verified = false;

        if (moveToNext){
            this.next();
        }
    }
}

/**
 * Ask user before site exit (if map element is active) to avoid data loss.
 */
window.onbeforeunload = function () {
    return isMapMatcherActive();
};

/**
 * Reading files using promises. It's limited to specific file dataType.
 * It saves content of file to global variable overpassData or geojsonData.
 * @param  {File} file – filename
 * @param  {string} dataType – it can be overpassData or geojsonData
 * @return {Promise}
 */
function readFile(file, dataType){
    return new Promise((resolve, reject) => {
        let fr = new FileReader();
        fr.onload = () => {
            try {
                if (dataType === 'overpassData'){
                    overpassData = JSON.parse(fr.result);
                }
                else if (dataType === 'geojsonData'){
                    geojsonData = JSON.parse(fr.result);
                }
            }catch (error){
                reject('Parsing data error: ' + error);
            }
            resolve(true);
        };
        fr.onerror = reject;
        fr.readAsText(file, 'UTF-8');
    });
}

/**
 * Check if every Overpass Element contains meta data like uid/user etc.
 * Overpass query must contain "out meta;" which is needed later to recreate
 * changeset's file.
 * @param  {Object} overpassElement
 * @return {Boolean}
 */
function hasMetadata(overpassElement){
    const tags = ['version', 'user', 'timestamp', 'changeset'];
    return tags.every((tag) => tag in overpassElement);
}

/**
 * Check if user input all required fields to file-form
 * @return {Boolean}
 */
function isFormFilled(){
    const elements = Array.from(document.getElementById('file-form').elements);
    const isUnfilled = elements.some((inputField) => {
        if (inputField.value === '' && inputField.hasAttribute('required')){
            return true;
        }
    });
    return !isUnfilled;
}

/**
 * Transform data from array of Objects to Object (like dictionary)
 * with using custom key instead of index
 *
 * @param  {Function} funcGetKey – function to obtain custom key from object
 * @param  {Object[]} data – array of objects to tranform
 * @return {Object} Object with objects where key is derrived by funcGetKey
 */
function arrObjectsToObject(funcGetKey, data){
    return Object.assign({}, ...data.map((e) => ({[funcGetKey(e)]: e})));
}

/**
 * Separate Overpass quered elements from "empty nodes"
 * which are only "extra data" used to define way (element type) geometry
 * @param  {Object[]} elements – Overpass Elements (nodes/ways)
 * @return {Array.<Object[], Object>} – 2 elements array where first element is
 * array with overpass elements (without "extra nodes") and second element is
 * Object with "extra nodes" where key is nodeId (from OSM).
 */
function divideToElementsAndExtraNodes(elements){
    const overpassElementsAll = arrObjectsToObject((e) => e['id'], elements);
    const overpassElements = elements.filter(hasMetadata);

    let overpassExtraNodes = {};
    Object.values(overpassElements).forEach((elem) => {
        if (elem['type'] == 'way'){
            elem['nodes'].forEach((nodeId) => {
                overpassExtraNodes[nodeId] = overpassElementsAll[nodeId];
            });
        }
    });

    return [overpassElements, overpassExtraNodes];
}

/**
 * Filter Overpass Elements by excluding relation element type.
 * @param  {Object[]} overpassElements
 * @return {Object[]} filtered overpassElements
 */
function excludeRelations(overpassElements){
    return Object.values(overpassElements).filter((elem) => {
        return elem['type'] != 'relation';
    });
}

/**
 * Filter GeoJSON features by given tag.
 * It checks if feature has give tag in feature['properties']
 * @param  {Object[]} geojsonFeatures
 * @param  {string} tag – key of properties key/value
 * @return {Object[]} filtered geojson features
 */
function filterFeaturesByProperty(geojsonFeatures, tag){
    return geojsonFeatures.filter((feature) => tag in feature['properties']);
}

/**
 * Action performed when user clicks Load files button.
 *
 * It read and parse the files and changes all UI elements associated with this
 * action
 * At the end prepare site elements (show/hide) to next step/form.
 */
function loadFiles(){
    if(!isFormFilled()){
        alert('There are some required fields in the form!');
        return;
    }

    document.getElementById('btn-file-load').disabled = true;
    document.getElementById('overpass-json-file').disabled = true;
    document.getElementById('geojson-data-file').disabled = true;

    document.getElementById('btn-file-load').innerText = 'Reading data...';
    osmIdTag = document.getElementById('osm-id-tag').value;
    featureIdTag = document.getElementById('feature-id-tag').value;

    const filePromises = [
        readFile(
            document.getElementById('overpass-json-file').files[0],
            'overpassData'
        ),
        readFile(
            document.getElementById('geojson-data-file').files[0],
            'geojsonData'
        )
    ];

    Promise.all(filePromises).then(() => {
        const [elements, extraNodes] = divideToElementsAndExtraNodes(
            overpassData['elements']
        );
        Match.overpassElements = excludeRelations(elements);
        Match.overpassExtraNodes = extraNodes;
        Match.geojsonFeatures = filterFeaturesByProperty(
            geojsonData['features'],
            featureIdTag
        );

        document.getElementById('btn-file-load').hidden = true;
        document.getElementById('load-status').innerText = `
            Loaded ${Match.overpassElements.length} elements from Overpass file.
            Loaded ${Match.geojsonFeatures.length} features from GeoJSON file.
        `;

        // Next section preparation
        document.getElementById('analyze').hidden = false;
        document.getElementById('btn-file-analyze').disabled = false;

    }).catch((error) => {
        console.error(error);
        document.getElementById('btn-file-load').innerText = 'Stopped';
        document.getElementById('load-status').innerText = `
            Parsing files error!
        `;
    });
}
/**
 * Action performed when user clicks Analyze files button.
 *
 * It generally execute measureDistances function to get recommended/safe
 * distance between features to use it in next step with matching/classifing
 * objects
 *
 * At the end prepare site elements (show/hide) to next step.
 */
function analyzeFiles(){
    const analyzeBtn = document.getElementById('btn-file-analyze');
    const analyzingStatusElem = document.getElementById('analyzing-status');

    document.getElementById('btn-file-load').hidden = true;
    analyzeBtn.disabled = true;
    analyzeBtn.innerText = 'Measuring distances...';

    setTimeout(()=>{
        let distances = measureDistances(Match.geojsonFeatures);
        let threeDistances = distances.slice(0, 3).map(
            (distance) => Math.round(distance * 100000) / 100 // km -> meters
        );

        analyzeBtn.disable = true;
        analyzeBtn.hidden = true;
        analyzingStatusElem.innerText = `
            Measured distances for: ${Match.geojsonFeatures.length} features.
            Three smallest distances (in meters): ${threeDistances}.
        `;

        // Next section
        const minFeaturesDistanceMeters = distances[0] * 1000;

        // safeDistance (max recommended) – half of minFeaturesDistance
        const safeDistance = Math.round(minFeaturesDistanceMeters * 50) / 100;

        document.getElementById('find-matches').hidden = false;
        document.getElementById('btn-file-find-matches').disabled = false;
        document.getElementById('distance-radius-input').value = safeDistance;
    }, 1);
}

/**
 * Action performed when user clicks Find matches button.
 *
 * Launch findMatches, classifyMatches and interprets their results
 * to prepare data of raw Match objects to initialize MapMatchManager.
 * It's update too some sites elements to show statics about classification.
 *
 * At the end prepare site elements (show/hide) to next step (run Map Matcher).
 */
function findMatches(){
    const distanceRadiusEl = document.getElementById('distance-radius-input');
    const distanceRadiusMeters = distanceRadiusEl.value;
    if (distanceRadiusMeters === '' || distanceRadiusMeters === -1){
        alert('Range is required!');
        return;
    }

    distanceRadiusEl.disabled = true;
    document.getElementById('btn-file-find-matches').disabled = true;

    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-start').hidden = true;

    let distanceRadiusKm = distanceRadiusMeters / 1000;
    setTimeout(()=>{
        const unclassifiedRawMatches = matchFeatures(
            Match.overpassElements,
            Match.geojsonFeatures,
            distanceRadiusKm
        );
        matchesObjects = classifyMatches(unclassifiedRawMatches);

        let likelyMatches = 0;
        let uncertainMatches = 0;
        let noMatches = 0;
        let totalLen = matchesObjects.length;

        matchesObjects.forEach((m) =>{
            if (m.isMatched){
                if (m.uncertain){
                    uncertainMatches++;
                }
                else{
                    likelyMatches++;
                }
            }
            else{
                noMatches++;
            }
        });
        const verifyObjects = matchesObjects.filter((elem) => elem.isMatched)
            .sort((a, b) => a.uncertain - b.uncertain);

        const likelyEl = document.getElementById('likely-matches');
        const uncertainEl = document.getElementById('uncertain-matches');
        const noEl = document.getElementById('no-matches');

        let percentRounded = (val, total) => Math.round(val * 100 / total);

        const likelyPerc = percentRounded(likelyMatches, totalLen);
        const uncertainPerc = percentRounded(uncertainMatches, totalLen);
        const noPerc = percentRounded(noMatches, totalLen);

        likelyEl.innerText = `${likelyMatches} (${likelyPerc}%)`;
        uncertainEl.innerText = `${uncertainMatches} (${uncertainPerc}%)`;
        noEl.innerText = `${noMatches} (${noPerc}%)`;

        document.getElementById('btn-file-find-matches').disabled = false;
        document.getElementById('distance-radius-input').disabled = false;


        // Next section preparation
        mapMatchManager = new MapMatchManager(verifyObjects);

        document.getElementById('btn-start').disabled = false;
        document.getElementById('btn-start').hidden = false;
    }, 1);
}

/**
 * Main function responsible for matching overpassElements with geojsonFeatures
 * It uses brute-force algorithm :).
 *
 * For each overpass elements it checks all features objects and compare their
 * radius distance do distanceRadiusKm parameter.
 * It implements simple logic (element-feature) with 2 threshold.
 * For each overpass element result is keeped in 2 array elements as array.
 *
 * if distance <= distanceRadiusKm then keep feature in the first element ([0])
 * else distanceRadiusKm < distance <= diameter then in the second ([1])
 *
 * Example:
 * result for element: [[featureIndex1], [featureIndex2, featureIndex3]]
 * – featureIndex1 in range distanceRadius
 * – featureIndex2, featureIndex3 in range diameter
 *
 * Arrays keep only indexes which pointing to objects in given order from
 * overpassElements and geojsoneFeatures parameters.
 *
 * @param  {Object[]} overpassElements
 * @param  {Object[]} geojsonFeatures
 * @param  {float} distanceRadiusKm – in kilometers
 * @return {Object[]} rawMatches – Array with length == overpassElements.length
 * where return arr[index] corresponds to overpassElements[index]
 * which contains 2 element array with arrays with feature indexes
 * which correspond with order to geojsonFeatures
 */
function matchFeatures(overpassElements, geojsonFeatures, distanceRadiusKm){
    let rawMatches = new Array(overpassElements.length);

    overpassElements.forEach((overpassElement, index) => {
        rawMatches[index] = [[], []];

        let pos1 = getLatLonFromElement(overpassElement);
        if (pos1[0] === null || pos1[1] === null){
            return;
        }

        geojsonFeatures.forEach((feature, featureIndex) => {
            let pos2 = getLatLonFromFeature(feature);
            if (pos2[0] === null || pos2[1] === null){
                return;
            }
            let distance = haversine(...pos1, ...pos2);

            if (distance <= distanceRadiusKm){
                rawMatches[index][0].push(featureIndex);
            }
            else if(distance <= distanceRadiusKm * 2){
                rawMatches[index][1].push(featureIndex);
            }
        });
    });

    return rawMatches;
}

/**
 * Ciassifies rawMatches from matchFeatures results as 3 different classes
 * to create Match objects with matched feature's index (certain or not)
 *  or with no match at all.
 * @param  {Object[]} rawMatches – array of 2 elements arrays returned by
 * matchFeatures function.
 * @return {Match[]}
 */
function classifyMatches(rawMatches){
    let classifiedMatches = [];

    rawMatches.forEach((matchIndexes, overpassElementIndex) => {
        let matchObj = new Match(overpassElementIndex, null, matchIndexes);

        if (matchIndexes[0].length == 1 && matchIndexes[1].length == 0){
            matchObj.featureMatchIndex = matchIndexes[0][0];
        }
        else if (matchIndexes[0].length == 1){
            matchObj.featureMatchIndex = matchIndexes[0][0];
            matchObj.uncertain = true;
        }
        else if (matchIndexes[0].length == 0 && matchIndexes[1].length == 1){
            matchObj.featureMatchIndex  = matchIndexes[1][0];
            matchObj.uncertain = true;
        }

        classifiedMatches.push(matchObj);
    });

    return classifiedMatches;
}

/**
 * Get position (latitude and longitude) from given GeoJSON Feature.
 * @param  {Object} geojsonFeature – it supports Point and Polygon types.
 * Polygon position is calculated from average of positions for all points.
 * @return {Array.<float, float>} [latitude, longitude]
 */
function getLatLonFromFeature(geojsonFeature){
    if (geojsonFeature['geometry']['type'] === 'Point'){
        let [lon, lat] = geojsonFeature['geometry']['coordinates'];
        return [lat, lon];
    }

    // simple center (avg)
    else if(geojsonFeature['geometry']['type'] === 'Polygon'){
        let latSum = 0;
        let lonSum = 0;
        const size = geojsonFeature['geometry']['coordinates'].length;
        geojsonFeature['geometry']['coordinates'].forEach(([lon, lat]) => {
            latSum += lat;
            lonSum += lon;
        });

        return [latSum / size, lonSum / size];
    }
    else{
        alert(`
            Unsupported GeoJSON feature geometry type.
            Allowed: Point/Polygon.
            Found: ${geojsonFeature['geometry']['type']}`
        );
        return [null, null];
    }
}

/**
 * Get position (latitude and longitude) from given Overpass Element.
 * @param  {Object} overpassElement – it supports node and way types.
 * Way position is calculated from average of all nodes position.
 * Node position is obtained from Match.overpassExtraNodes by nodeId
 * @return {Array.<float, float>} [latitude, longitude]
 */
function getLatLonFromElement(overpassElement){
    if (overpassElement['type'] === 'node'){
        return [overpassElement['lat'], overpassElement['lon']];
    }

    // simple center (avg)
    else if(overpassElement['type'] === 'way'){
        let latSum = 0;
        let lonSum = 0;
        const size = overpassElement['nodes'].length;
        overpassElement['nodes'].forEach((nodeId) => {
            latSum += Match.overpassExtraNodes[nodeId]['lat'];
            lonSum += Match.overpassExtraNodes[nodeId]['lon'];
        });

        return [latSum / size, lonSum / size];
    }
    else{
        alert(`
            Unsupported Overpass Element type.
            Allowed: node/way.
            Found: ${overpassElement['type']}`
        );
        return [null, null];
    }
}

/**
 * Haversine is function to calculate distance between to points.
 * So, in other words, it is a great-circle distance.
 * It is a modified snippet from SO: https://stackoverflow.com/a/15737218
 *
 * @param  {float} lat1
 * @param  {float} lon1
 * @param  {float} lat2
 * @param  {float} lon2
 * @return {float} distance between points in kilometers
 */
function haversine(lat1, lon1, lat2, lon2) {
    let toDegrees = (angle) => angle * (180 / Math.PI);
    let toRadians = (angle) => angle * (Math.PI / 180);

    let lat1Rad = toRadians(lat1);
    let lon1Rad = toRadians(lon1);
    let lat2Rad = toRadians(lat2);
    let lon2Rad = toRadians(lon2);

    let dlon = lon2Rad - lon1Rad;
    let dlat = lat2Rad - lat1Rad;
    let a = Math.pow(Math.sin(dlat/2), 2);
    a += Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.pow(Math.sin(dlon/2), 2);

    let c = 2 * Math.asin(Math.sqrt(a));
    let km = 6371 * c;

    return km;
}


/**
 * Measures distance between geojson features
 * @param  {Object[]}  geojsonFeatures
 * @param  {Boolean} [sorted=true] sort asc by default
 * @return {float[]} distances (in kilometers) between all features
 */
function measureDistances(geojsonFeatures, sorted = true){
    const dataSize = geojsonFeatures.length;
    let distances = [];

    for (let i=0; i<dataSize; i++){

        let pos1 = getLatLonFromFeature(geojsonFeatures[i]);
        if (pos1[0] === null || pos1[1] === null){
            continue;
        }

        for (let j=i + 1; j<dataSize; j++){

            let pos2 = getLatLonFromFeature(geojsonFeatures[j]);
            if (pos2[0] === null || pos2[1] === null){
                continue;
            }
            let distance = haversine(...pos1, ...pos2);
            distances.push(distance);
        }
    }

    if (sorted){
        distances.sort();
    }

    return distances;
}

/**
 * Simple formatter for GeoJSON feature properties/Overpass elements tags
 * to put into pre element as more readable text
 * @param  {Object} object
 * @return {string} formmated object
 */
function formatObjectToPre(object){
    return JSON.stringify(object, null, 2);
}

/**
 * Action performed when user clicks Start button.
 *
 * Add event listeners for matcher buttons/actions
 * hide previous steps, show the map and load the first Match object
 */
function startFastMapMatcher(){

    document.getElementById('input-settings').hidden = true;

    acceptBtn.textContent = `${acceptBtn.textContent} (${KEY_ACCEPT})`;
    acceptBtn.addEventListener('click', () => {
        mapMatchManager.accept();
        loadMatchObjectOnMap(mapMatchManager.current);
    });

    rejectBtn.textContent = `${rejectBtn.textContent} (${KEY_REJECT})`;
    rejectBtn.addEventListener('click', () => {
        mapMatchManager.reject();
        loadMatchObjectOnMap(mapMatchManager.current);
    });

    window.addEventListener('keydown', (event) =>{
        switch(event.key){
            case 'Left': // IE/Edge specific value
            case 'ArrowLeft':
                loadMatchObjectOnMap(mapMatchManager.previous());
                break;
            case 'Right': // IE/Edge specific value
            case 'ArrowRight':
                loadMatchObjectOnMap(mapMatchManager.next());
                break;

            case KEY_REJECT:
                mapMatchManager.reject();
                loadMatchObjectOnMap(mapMatchManager.current);
                break;
            case KEY_ACCEPT:
                mapMatchManager.accept();
                loadMatchObjectOnMap(mapMatchManager.current);
                break;
        }
    });

    document.getElementById('map-matcher').hidden = false;
    map.invalidateSize();
    loadMatchObjectOnMap(mapMatchManager.next());
}

/**
 * Update counters: current/accepted/rejected match objects for the matcher.
 */
function updateProgressElements(){
    const index = mapMatchManager.currentIndex;
    const size = mapMatchManager.size;
    let current = '';
    if (index >= 0 && size > 0){
        current = `${index + 1}/${size}`;
    }
    else if (index >= 0){
        current = `${index + 1}/inf`;
    }

    progressCurrentEl.innerText = current;
    progressAcceptedEl.innerText = mapMatchManager.acceptCounter;
    progressRejectedEl.innerText = mapMatchManager.rejectCounter;
}

/**
 * Draw marker and line on the map and zoom at it.
 * Marker is at GeoJSON feature position.
 * Line is from GeoJSON feature marker to OverpassElement position.
 * @param {Match} currentMatchObj
 */
function addMatchObjToMap(currentMatchObj){
    const elementPos = getLatLonFromElement(currentMatchObj.element);
    const featurePos = getLatLonFromFeature(currentMatchObj.feature);

    L.marker(featurePos).addTo(map);
    const line = L.polyline([featurePos, elementPos]).addTo(map);
    map.fitBounds(line.getBounds());
}

/**
 * Fill object-data-col with current Match object data:
 * - GeoJSON Feature's properties
 * - Overpass Element's tags
 * @param  {Match} currentMatchObj
 */
function updatePreElementsData(currentMatchObj){
    const formattedProperties = formatObjectToPre(
        currentMatchObj.feature['properties']
    );
    const formattedTags = formatObjectToPre(currentMatchObj.element['tags']);

    preElements[0].innerText = formattedProperties;
    preElements[1].innerText = formattedTags;
}

/**
 * Keeps object-data-col element (for feature's properties/element tags) with
 * same width.
 */
function resizePreElements(){
    // Max-width pre trick
    const offsetWidth = document.getElementById('object-data-col').offsetWidth;
    // preElements.forEach(elem => elem.style.width = '0px');
    preElements.forEach(elem => elem.style.width = offsetWidth + 'px');
}

/**
 * Load given Match object for the user
 * @param  {Match} matchObject
 */
function loadMatchObjectOnMap(matchObject){
    if (!matchObject){
        return;
    }
    updateProgressElements();
    updateVerifyButtonsColor(matchObject);

    addMatchObjToMap(matchObject);

    updatePreElementsData(matchObject);
    resizePreElements();
}

/**
 * Change button style if selected (basing on match verify state)
 * @param  {Match} matchObj
 */
function updateVerifyButtonsColor(matchObj){
    const CLASS_STYLE = ['border-primary', 'border-10'];

    switch(matchObj.verified){
        case null:
            acceptBtn.classList.remove(...CLASS_STYLE);
            rejectBtn.classList.remove(...CLASS_STYLE);
            break;
        case true:
            acceptBtn.classList.add(...CLASS_STYLE);
            rejectBtn.classList.remove(...CLASS_STYLE);
            break;
        case false:
            acceptBtn.classList.remove(...CLASS_STYLE);
            rejectBtn.classList.add(...CLASS_STYLE);
            break;
    }
}

/**
 * Creates XML Document in OsmChange .osc file format, which allows to use it
 * with external tools to upload changes to the OpenStreetMap
 * https://wiki.openstreetmap.org/wiki/OsmChange
 *
 * @param  {Match[]} verifiedObjects – must verify==true
 * @param  {string} osmTag – key which will be used in changeset for the new
 * tag (pair key-value for given match object) as key
 * @param  {string} featureTag – key which is used to obtain value from feature
 * properties which is used in changeset for the new tag
 * (pair key-value for given match object) as value
 * @return {Document} new changeset as xml document
 */
function createOsmChangeXml(verifiedObjects, osmTag, featureTag){

    function fillElementWithTags(doc, rootElem, tags){
        Object.entries(tags).forEach(([key, value]) => {
            let tagElement = doc.createElement('tag');
            tagElement.setAttribute('k', key);
            tagElement.setAttribute('v', value);
            rootElem.appendChild(tagElement);
        });
    }

    let doc = document.implementation.createDocument('', '', null);

    let osmChangeElem = doc.createElement('osmChange');
    osmChangeElem.setAttribute('version', '0.6');
    osmChangeElem.setAttribute('generator', 'OSMFastMatcher');


    osmChangeElem.appendChild(doc.createElement('create'));
    let modifyElem = doc.createElement('modify');

    verifiedObjects.forEach((obj) => {
        let element = obj.element;
        let feature = obj.feature;

        let tags = JSON.parse(JSON.stringify(element['tags']));
        tags[osmTag] = feature['properties'][featureTag];


        if (element['type'] === 'node'){
            let nodeElem = doc.createElement('node');
            nodeElem.setAttribute('id', element['id']);
            nodeElem.setAttribute('lon', element['lon']);
            nodeElem.setAttribute('lat', element['lat']);
            nodeElem.setAttribute('version', element['version']);

            fillElementWithTags(doc, nodeElem, tags);

            modifyElem.appendChild(nodeElem);
        }
        else if (element['type'] === 'way'){
            let wayElem = doc.createElement('way');
            wayElem.setAttribute('id', element['id']);
            wayElem.setAttribute('version', element['version']);

            element['nodes'].forEach((nodeId) => {
                let nodeRefElem = doc.createElement('nd');
                nodeRefElem.setAttribute('ref', nodeId);
                wayElem.appendChild(nodeRefElem);
            });
            fillElementWithTags(doc, wayElem, tags);

            modifyElem.appendChild(wayElem);
        }
    });

    osmChangeElem.appendChild(modifyElem);

    let deleteElem = doc.createElement('delete');
    deleteElem.setAttribute('if-unused', 'true');
    osmChangeElem.appendChild(deleteElem);

    doc.appendChild(osmChangeElem);

    return doc;
}

/**
 * Download generated content as file from JavaScript.
 * https://stackoverflow.com/a/18197341
 * @param  {string} filename
 * @param  {string} text – content
 */
function downloadFile(filename, text) {
    let element = document.createElement('a');
    element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    );
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

/**
 * Download accepted matches objects (verified==true) as changeset file
 */
function downloadAccepted(){
    const osmChangeXml = createOsmChangeXml(
        mapMatchManager.acceptedMatches.sort((a, b) => {
            let x = a.element['type'];
            let y = b.element['type'];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        }),
        osmIdTag,
        featureIdTag
    );

    const serializer = new XMLSerializer();
    const osmChangeXmlStr = serializer.serializeToString(osmChangeXml);

    downloadFile('accepted.osc', osmChangeXmlStr);
}

/**
 * Download rejected matches objects (verified==false) as GeoJSON which
 * contains GeoJSON Features only.
 */
function downloadRejected(){
    const geojson = {
        'type': 'FeatureCollection',
        'features': []
    };

    mapMatchManager.rejectedMatches.forEach((obj) => {
        geojson['features'].push(obj.feature);
    });

    downloadFile('rejected.geojson', JSON.stringify(geojson, null, 2));
}

/**
 * Is map-matcher element is not hidden
 * @return {Boolean}
 */
function isMapMatcherActive(){
    return !document.getElementById('map-matcher').hidden;
}

const map = L.map('map').setView([52.197, 19.987], 7);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">'
        + 'OpenStreetMap</a> contributors'
}).addTo(map);