// initialize default config at the very first run
chrome.storage.local.get(CONFIG_KEYS.firstRunEver, function (result) {
    if (result[CONFIG_KEYS.firstRunEver] === false) {
        console.log('Config already initialized')
    } else {
        console.log('First run ever -> initializing defaults...');
        saveDefaultConfigToChromeStorage(true);
    }
});

// reload config on update
chrome.storage.local.get(CONFIG_KEYS.lastRunningVersion, function (result) {
    const previous_version = result[CONFIG_KEYS.lastRunningVersion];
    const this_version = chrome.runtime.getManifest().version;
    if (previous_version === this_version) {
        console.log(`No update. Current version matches the last running version: ${this_version}`)
    } else {
        console.log(`Extension updated. New version: ${this_version}. Previous version: ${previous_version}. Reloading config...`);
        saveDefaultConfigToChromeStorage(true);  //TODO maybe write only new config keys, to not overwrite old user settings?
        chrome.storage.local.set({[CONFIG_KEYS.lastRunningVersion]: this_version}, function () {
            console.debug(`Saving current version ${this_version} as last running version`)
        });
    }
});
