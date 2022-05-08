/** COMMON JS/HTML/CHROME STUFF
 * This script is intended to be loaded after config.js and before background/content/popup JS scripts, so they can use the common functionality.
 * Namespace of all background scripts is shared (same applies for content/popup namespaces), so it works.
 * */

/**Get value from local storage for the given 'key'. If key doesn't exist in the storage, return 'default_value' instead.*/
async function readKeyFromLocalStorage(key, default_value=undefined) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], function (result) {
            if (result[key] === undefined) {
                resolve(default_value)
            } else {
                resolve(result[key]);
            }
        });
    })
}

/**Save given key-value pair to local storage. Await this function to ensure the config was added*/
async function saveKeyToLocalStorage(key, value) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({[key]: value}, function (result) { //[key] -> use key's value as the key, not the variable name ("key")
            resolve(true)
        });
    })
}

/**Save default configs to chrome storage. Overwrites existing values!*/
async function saveDefaultConfigToChromeStorage() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(CONFIG, function () {
            console.log('Default config saved to local storage');
            chrome.storage.local.set(SETTINGS, function () {
                console.log('Default feature settings saved to local storage')
                resolve(true)
            });
        });
    })
}

/**Save default config values to chrome storage only if not existing yet (doesn't overwrite any existing values)*/
async function saveFeatureSettingsToStorageIfMissing() {
    for (let settingKey in SETTINGS) {
        let settingValue = await readKeyFromLocalStorage(settingKey, undefined);
        if (settingValue === undefined) {
            console.log(`Key "${settingKey}" not found in storage, saving now`)
            await saveKeyToLocalStorage(settingKey, SETTINGS[settingKey]);
        }
    }
}

/**
 * Compares two software version numbers (e.g. "1.7.13" or "2.1"). Compare naturally by value (not lexicographically), so e.g. 1.10 is bigger than 1.2.
 * Letters (like "1.1b") not allowed, only numbers. Inspired by: http://stackoverflow.com/a/6832721
 * @param {string} v1 The first version to be compared.
 * @param {string} v2 The second version to be compared.
 * @param {boolean} zeroExtend true - if one ver has fewer parts than the other, the shorter one is padded with "zero" parts instead of being considered lower/older
 *                             false - if one ver has fewer parts, it is considered lower/older, e.g. 1.1 > 1, also 1.2.0 > 1.2
 * @returns {number|NaN} 0 if v1 == v2; negative integer if v1 < v2; positive integer if v1 > v2; NaN if any version has wrong format
 */
function versionCompare(v1, v2, zeroExtend=true) {
    let v1parts = v1.split('.')
    let v2parts = v2.split('.')

    function isValidPart(x) {
        return /^\d+$/.test(x);
    }
    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    v1parts = v1parts.map(Number);
    v2parts = v2parts.map(Number);
    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push(0);
        while (v2parts.length < v1parts.length) v2parts.push(0);
    }

    for (let i = 0; i < v1parts.length; i++) {
        if (v2parts.length === i) {
            return 1; //v2 is shorter than v1 and all previous parts were same -> consider v2 older, v1 newer (it has additional parts)
        }

        if (v1parts[i] === v2parts[i]) {
            continue;
        }
        else if (v1parts[i] > v2parts[i]) {
            return 1;
        }
        else {
            return -1;
        }
    }

    if (v1parts.length !== v2parts.length) {
        return -1; //v1 is shorter than v2 and all previous parts were same -> consider v1 older, v2 newer (it has additional parts)
    }

    return 0;
}

/**Get just the direct text of given element, not of its children. E.g. <div>directText<red>childText</red></div> returns only "directText"*/
function getTextExcludingChildren(element) {
    return element.childNodes[0].nodeValue
}

/**Get element by xpath. Search only in given context (element).
 * return: (optional) matching element* */
function getElementByXpath(xpath, contextElement = document) {
    return document.evaluate(xpath, contextElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

/**Get first element with given text. Searches in children of given context element, based on element type.
 * text: text that must be in the element (either contained or exactly matched - set via exactMatch param)
 * contextElement: search only in a context of this element (and its children recursively)
 * elementType: final element must be of this type, e.g. div/tr/a/td, or asterisk to for any type
 * exactMatch: if disabled, element must contain the text and possibly anything else, e.g. searching for 'bar' will return element with 'foobarbaz',
 *      if enabled, search only for exact text match (not recommended)
 * return: (optional) element containing the given text*/
function getElementByText(text, contextElement = document, elementType = '*', exactMatch = false) {
    let query = exactMatch ? `.//${elementType}[text()='${text}']` : `.//${elementType}[contains(text(), '${text}')]`;
    return getElementByXpath(query, contextElement)
}

/**Get first element matching given attribute's value. Searches in children of given context element, based on element type.
 * attribute: attribute of the element
 * value: value of the attribute
 * contextElement: search only in a context of this element (and its children recursively)
 * elementType: final element must be of this type, e.g. div/tr/a/td, or asterisk to for any type
 * return: (optional) matching element*/
function getElementByAttributeValue(attribute, value, contextElement = document, elementType = '*') {
    let query = `.//${elementType}[@${attribute}="${value}"]`;
    return getElementByXpath(query, contextElement)
}

function sumArray(array) {
    // 0 is initial value. The '+' before a/b is just to convert string-numbers to numbers, it doesn't affect negative numbers or anything.
    return array.reduce((a,b) => +a + +b, 0)
}

/** Async sleep method. Can be only used in "async function", pauses only execution of that function, nothing else.
 * Example usage: while(x==y){await sleep(1000); console.log(do something every second);} */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exitScriptExecution() {
    throw new Error('NOT ERROR: Just intentionally stopping script execution.');
}

/** Show alert to user to copy given text manually. Text is pre-selected. SUGGESTION: use copyToClipboard() instead of this.*/
function copyToClipboardManual(text) {
    prompt("Copy to clipboard: Ctrl+C & Enter", text);
}

/** Copy given text into the clipboard automatically, silently in the background. Return false if failed. SUGGESTION: use copyToClipboard() instead of this.
 * WARNING: Must be called by a user action (e.g. in click event handler). Works only in secure content of HTTPS or localhost. Undefined for HTTP!*/
function copyToClipboardAuto(text) {
    if (navigator.clipboard) {
        //try native cross-platform copy; doc https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard
        navigator.clipboard.writeText(text).then(
            success => {return true},
            fail => {console.warn("Automatic copy to clipboard failed:", fail); return false})
    } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
        //create element with given text at the bottom of the page (shouldn't be visible by user), select its content and use a copy command
        //source https://stackoverflow.com/a/33928558/7684041, copy cmd doc https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
        let textArea = document.createElement("textarea");
        textArea.textContent = text;
        textArea.style.position = "fixed";  // Prevent scrolling to bottom of page in Microsoft Edge
        document.body.appendChild(textArea);
        textArea.select();
        try {
            return document.execCommand("copy");
        } catch (ex) { // Security exception may be thrown by some browsers.
            console.warn("Automatic copy to clipboard failed:", ex);
            return false
        } finally {
            document.body.removeChild(textArea);
        }
    } else {
        console.warn("Automatic copy to clipboard failed - API unavailable. Make sure to call copy in user action (click event handler) and HTTPS");
        return false
    }
}

/** Copy the given string to the clipboard automatically, if not possible, show manual prompt.
 * Try automatic copy (if possible) - must be called within a user action (e.g. click event handler) and in HTTPS or localhost!
 * If automatic copy failed, display a prompt to user, so they can easily copy manually (Ctrl+C)*/
function copyToClipboard(text) {
    let copyResult = copyToClipboardAuto(text);
    if (copyResult === false) {
        copyToClipboardManual(text);
    }
}

/**Return True if given object is empty {}, False if not empty.*/
function isEmpty(object) {
    return Object.keys(object).length === 0;
}

/**Remove all occurrences of the given value and return the filtered array. NOTE: assign the returned array to your array (doesn't work in-situ).*/
function removeValueFromArray(value, array) {
    return array.filter(item => item !== value)
}

/**Clear all scheduled timeout actions. Should probably clear also scheduled timeout intervals. https://stackoverflow.com/a/8345814/7684041*/
function clearAllTimeouts() {
    const highestTimeoutId = setTimeout(function () {}, 0); // Set a fake timeout to get the highest timeout id
    for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i);
    }
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive). Source: https://stackoverflow.com/a/1527820/7684041
 * The value is no lower than min (or the next integer greater than min if min isn't an integer)
 * and no greater than max (or the next integer lower than max if max isn't an integer)
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Initialize audio engine. Must be called within a user action, e.g. click listener.
 * Inspiration: https://stackoverflow.com/a/41077092/7684041, https://stackoverflow.com/a/33723682/7684041
 * */
function initAudioEngine() {
    window.globalAudioContext = new window.AudioContext();
    window.globalAudioContext.gainNode = window.globalAudioContext.createGain(); //https://developer.mozilla.org/en-US/docs/Web/API/GainNode
    window.globalAudioContext.gainNode.connect(window.globalAudioContext.destination);
    window.globalAudioContext.oscillator = window.globalAudioContext.createOscillator(); //https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode
    window.globalAudioContext.oscillator.start()
}

/**Check if audio engine was initialized, see initAudioEngine() for more info*/
function audioEngineInitialized() {
    return window.globalAudioContext ? true : false
}

/**
 * Play a sound with defined params. Returns a promise.
 * duration: [ms] how long to play the sound
 * volume: 0-1 where 1 = the loudest
 * type: style of the sound - sine, triangle, square, sawtooth
 * frequency: [MHz] frequency of the tone, usually between 40-6000, e.g. 440 is middle-A note
 * */
function beep(duration = 100, frequency = 440, volume = 0.5, type = 'square') {
    if (!window.globalAudioContext) {
        console.error('Before playing beep sound, audio engine must be initialized by initAudioEngine(), must be called within user action like click!')
    }
    return new Promise((resolve, reject) => {
        if (!audioEngineInitialized()) reject('Beep - audio engine not initialized! See initAudioEngine()');
        let audio = window.globalAudioContext
        audio.gainNode.gain.value = volume;
        audio.oscillator.frequency.value = frequency;
        audio.oscillator.type = type;
        //start sound
        audio.oscillator.connect(audio.gainNode);
        //stop sound
        setTimeout(function () {
            audio.oscillator.disconnect();
            resolve();
        }, duration)
    })
}

/**
 * Get value from a logarithmic scale (with given min/max value) that corresponds to given linear value from interval [0-1], https://stackoverflow.com/a/846249/7684041
 * value: [0-1] the position on the logarithmic scale that we want (0 = minValue, 1 = maxValue)
 * minValue, maxValue: min/max value of the logarithmic scale
 * */
function linearValueToLogarithmicScale(linValue, minLogValue, maxLogValue) {
    // The result should be between minValue an maxValue
    let minV = Math.log(minLogValue);
    let maxV = Math.log(maxLogValue);
    let scale = maxV - minV; // calculate adjustment factor
    return Math.exp(minV + scale * linValue);
}

/**Return value from linear interval [0-1] corresponding to given log scale. Inverse to linearValueToLofarithmicScale(), https://stackoverflow.com/a/846249/7684041*/
function logarithmicValueToLinearScale(logValue, minLogValue, maxLogValue) {
    let minV = Math.log(minLogValue);
    let maxV = Math.log(maxLogValue);
    let scale = maxV - minV;
    return (Math.log(logValue)-minV) / scale;
}
