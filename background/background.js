// initialize default config at the very first run
async function checkIfFirstRunAndInitIfNeeded() {
    let firstRunEver = await readKeyFromLocalStorage(CONFIG_KEYS.firstRunEver, true);
    if (firstRunEver === false) {
        console.log('Not a first run -> config already initialized');
        return
    }

    console.log('First run ever -> initializing defaults...');
    await chrome.storage.local.clear();
    await saveDefaultConfigToChromeStorage();
}

async function checkIfUpdatedAndReflectSettings() {
    // reload config on update
    const thisVersion = chrome.runtime.getManifest().version;
    const previousVersion = await readKeyFromLocalStorage(CONFIG_KEYS.lastRunningVersion, thisVersion)
    if (versionCompare(thisVersion, previousVersion) === 0) {
        console.log('No update. Current version matches the previous version:', thisVersion)
    } else {
        console.log(`Extension updated. New version: ${thisVersion}. Previous version: ${previousVersion}. Updating config...`);

        let thisV = thisVersion.split('.').map(Number)
        let previousV = previousVersion.split('.').map(Number)
        if (thisV[0] > previousVersion[0]) {
            //major update
            await chrome.storage.local.clear(); //TODO will remove all user settings etc. Instead add 'reset' button to extension UI, so user can fix problems on demand
            await saveDefaultConfigToChromeStorage()
        } else if (thisV[1] > previousVersion[1]) {
            //minor update
            await saveFeatureSettingsToStorageIfMissing() //if new feature setting was added, this will add its value, not overwriting the existing player config
            //BUGFIX HERE - put any config change/fix here if needed for the given release (e.g. changed feature -> turn it off, so players have to re-enable it)
        } else if (thisV[2] > previousVersion[2]) {
            //patch/bugfix update
            await saveFeatureSettingsToStorageIfMissing()
            //BUGFIX HERE - put any config change/fix here if needed for the given release
        }

        //save/update current version
        chrome.storage.local.set({[CONFIG_KEYS.lastRunningVersion]: thisVersion}, function () {
            console.log(`Saving current version ${thisVersion} as last running version`)
        })
    }
}


//Check for first run or updates and init/update config accordingly
checkIfFirstRunAndInitIfNeeded()
    .then(result => checkIfUpdatedAndReflectSettings())
