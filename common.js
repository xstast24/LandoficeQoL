/** COMMON JS/HTML/CHROME STUFF
 * This script is intended to be loaded after config.js and before background/content/popup JS scripts, so they can use the common functionality.
 * Namespace of all background scripts is shared (same applies for content/popup namespaces), so it works.
 * */


/**Save default configs to chrome storage. Use param 'clearOldStorage'=true to delete old storage data before saving the new data.*/
function saveDefaultConfigToChromeStorage(clearOldStorage = false) {
    if (clearOldStorage) {
        chrome.storage.local.clear();
        console.log('Cleared Chrome storage')
    }

    chrome.storage.local.set(CONFIG, function () {
        console.log('Default config initialized in local storage')
    });
    chrome.storage.local.set(SETTINGS, function () {
        console.log('Default feature settings initialized in local storage')
    });
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
