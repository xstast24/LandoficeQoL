// Check if extension is active and run active tweaks
chrome.storage.local.get([CONFIG_KEYS.extensionActive], function (result) {
    if (result[CONFIG_KEYS.extensionActive]) {
        console.log('Extension is ON -> running content tweaks');
        runContentTweaks();
    } else {
        console.log('Extension is OFF');
    }
});


/**Check all content tweaks. If turned ON -> apply it. If turned OFF -> ignore it.*/
function runContentTweaks() {
    for (const tweak in SETTINGS_KEYS) {
        console.debug(`Tweak "${tweak}": Checking...`);
        chrome.storage.local.get(tweak, function (result) {
            if (result[tweak]) {
                window['tweak_' + tweak](); // run tweak - evaluate dynamically by method name
                //further logging should be done in the tweak itself, cos here we don't yet know if the conditions were met
            } else {
                console.debug(`Tweak "${tweak}": OFF`);
            }
        });
    }
}

/**TODO*/
function tweak_sidebarAddArmyLeaderOption() {
    let sidebar = getSideBar();
    //TODO
    console.log(`Tweak "${SETTINGS_KEYS.sidebarAddArmyLeaderOption}": Activated`);
}

/**TODO*/
function tweak_maxEquipmentButton() {
    //TODO
    console.log(`Tweak "${SETTINGS_KEYS.maxEquipmentButton}": Activated`);
}

/**TODO*/
function tweak_quickAttackButton() {
    //TODO
    console.log(`Tweak "${SETTINGS_KEYS.quickAttackButton}": Activated`);
}
