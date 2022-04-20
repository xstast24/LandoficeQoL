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

/**Add option to sidebar on the main page "Add clan leader to army", so user can simply 1-click it (no need to open army, scroll, add, close...) */
function tweak_sidebarAddArmyLeaderOption() {
    if (window.location.pathname !== '/main.php') {
        return
    } //option works only on the main page with sidebar

    let addLeaderURL = 'http://heaven.landofice.com/clanarmy/addCommander'

    //2) Putting addLeaderURL into the option would open the clan army page, so we process the request silently in background (event listener below)
    let addLeaderOption = createSidebarOption('Velitel do armády'); //If it feels unresponsive, add 'main.php?obnovit' href to reload main page? Probbaly OK
    addLeaderOption.addEventListener('click', function (event) {
        fetch(addLeaderURL).then(
            success => {
                event.target.textContent = 'Velitel ✅'
            },
            fail => {
                event.target.textContent = 'Velitel selhal ❌'
            })
    });

    // insert the option into sidebar (after Clan Army option)
    let clanArmyOption = getSidebarOption('Klanová armáda');
    sidebar().insertBefore(addLeaderOption, clanArmyOption.nextSibling);

    console.log(`Tweak "${SETTINGS_KEYS.sidebarAddArmyLeaderOption}": Activated`);
}

/**Add quick attack option to all attack events on main page -> 1 click attacks the event and plays the next turn immediately after that*/
function tweak_quickAttackButton() {
    if (window.location.pathname !== '/main.php') {
        return
    } //option works only on the main page with sidebar
    for (let attackEventLink of getPossibleAttackEvents()) {
        let quickAttackButton = document.createElement('button');
        quickAttackButton.setAttribute('type', 'button');
        quickAttackButton.textContent = '⚔ ♻ ⚔';
        quickAttackButton.style.fontSize = 'large';
        quickAttackButton.style.cursor = 'pointer'; //change cursor same as on events
        quickAttackButton.style.marginRight = '10px'; //space between event & button (horizontal)
        quickAttackButton.style.marginTop = '7px'; //space between button & other button (vertical, for multiple events)
        quickAttackButton.style.padding = '2px'; //button area around text
        quickAttackButton.style.backgroundColor = '#15497b';
        quickAttackButton.style.color = '#c0d6ee';
        quickAttackButton.style.border = '2px solid #0a192d';
        quickAttackButton.style.borderRadius = '5px';

        attackEventLink.insertAdjacentElement('beforebegin', quickAttackButton) //put button before the event link

        quickAttackButton.addEventListener('click', function (event) {
            let url = attackEventLink.href; //example attack URL 'http://heaven.landofice.com/utok.php?utok=vesnice&'
            fetch(url)
                .then(result => {
                    if (result.ok) {
                        return result.text()
                    } else { // TODO add handling of http://heaven.landofice.com/nogame/error.php?err=attack-none "bitva nepristupna" (pri opakovanem kliknuti na utok)
                        quickAttackButton.textContent = '❌';
                        console.error('Quick attack failed on fetching attack table (== clicking the event)!');
                        return Promise.reject(result)
                    } //--> next .then won't happen
                })
                .then(resultHtmlString => {
                    const resultDocument = new DOMParser().parseFromString(resultHtmlString, 'text/html');

                    //submit the attack form with all units (attackForm is the table/sheet where unit numbers are filled by player)
                    let attackForm = resultDocument.getElementsByClassName('utok-formular').item(0);
                    fetch(url, {method: 'post', body: new FormData(attackForm)})
                        .then(result => {
                            if (result.ok) {
                                quickAttackButton.textContent = '✅';
                            } else {
                                quickAttackButton.textContent = '❌';
                                console.error('Quick attack failed (submitting attack form)!');
                                return Promise.reject(result)
                            } //--> next .then won't happen
                        })
                        .then(result => nextTurn()) //play next turn after clearing the attack event
                })
        })
    }
    console.log(`Tweak "${SETTINGS_KEYS.quickAttackButton}": Activated`);
}

/**Add option "Copy Army" into sidebar on the main page, so user can simply 1-click copy and easily paste into simulator (saves much time) */
function tweak_sidebarCopyArmyOption() {
    if (window.location.pathname !== '/main.php') {
        return
    } //option works only on the main page with sidebar

    let clanArmyURL = 'http://heaven.landofice.com/clanarmy';

    let copyArmyOption = createSidebarOption('Zkopírovat armádu');
    copyArmyOption.addEventListener('click', function (event) {
        fetch(clanArmyURL) //TODO convert to common method to get resultDocument easily
            .then(result => result.text())
            .then(resultHtmlString => {
                const resultDocument = new DOMParser().parseFromString(resultHtmlString, 'text/html');

                let armyTable = resultDocument.getElementsByTagName('tbody').item(0);
                //unit name & item are stored in child nodes in <td class="t-l">...</td>; unit count is in the <td> in the following column
                let unitCells = armyTable.getElementsByClassName('t-l');
                let clanArmy = ''; //final text with clan army info
                for (let unit of unitCells) {
                    let unitName = getTextExcludingChildren(unit);
                    //unique units have name in color font tag, so it must be obtained specially
                    if (!unitName) {
                        unitName = unit.getElementsByTagName('font').item(0).textContent;
                    } //works for all specials

                    //WORKAROUND: simulator has bug - it doesn't know Dralgar units called *kopiník*, it needs to input them with extra J like *kopijník*
                    if (unitName.includes('kopiník')) {
                        unitName = unitName.replace('kopiník', 'kopijník')
                    }

                    let unitCount = unit.nextElementSibling.textContent; //count is in the next column (next <td> on the same elem level)

                    let unitItem = '';
                    try {
                        unitItem = unit.getElementsByClassName('predmet').item(0).textContent; //if no item, 'null.textContent' raises error
                    } catch (error) {
                    } //do nothing, unitItem is already pre-set to empty string

                    clanArmy += `${unitCount} x ${unitName}`
                    if (unitItem) {
                        clanArmy += ` (${unitItem})`
                    }
                    clanArmy += '\n'
                }

                copyToClipboard(clanArmy);
                event.target.textContent = 'Zkopírováno ✅';
            })
    })

    // insert the option into sidebar (after Clan Army option)
    let clanArmyOption = getSidebarOption('Klanová armáda');
    sidebar().insertBefore(copyArmyOption, clanArmyOption.nextSibling);

    console.log(`Tweak "${SETTINGS_KEYS.sidebarCopyArmyOption}": Activated`);
}

/**Vulkan equipment: make sure there is at least 5 equipment for fire mages every round, so it recruits fire mage(s) -> 1 arch mage of fire comes as bonus.*/
function tweak_vulkanAutoBuyFireMage() {
    if (window.location.pathname !== '/main.php') {
        return
    } //option works only on the main page with sidebar

    let firemageBuilding = getBuildingByName('Ohnivá Sekta');
    if (!firemageBuilding) {
        firemageBuilding = getBuildingByName('Chrám Ohnivé Sekty')
    } //building for fire mages not found, check for the upgraded one
    if (!firemageBuilding) {
        return
    } //2nd bulding not found at all
    //Note: Decided to not check lava golems building - it is case of first few moves, not worth. And it would need many checks for upgraded building names
    //if (!getBuilding('Ohnivé Jezero')) {return} //vulkan building for fire golems not found

    //When player clicked next turn, check if there is enough equipment, buy equipment if needed
    getSidebarOption('Průzkum pustiny (1 tah)').firstChild.addEventListener('click', function (event) {
        let equipment = getElementByText('Celkem vybavení:', firemageBuilding, 'p', false);
        let equipmentCount = parseInt(equipment.textContent.replace('Celkem vybavení: ', ''));
        if (equipmentCount < 5) { //5 equipment needed for 1 fire mage
            //NOTE: 'click' listener is blocking (happens before the anchor's href), but 'fetch' is asynchronous (non blocking) -> need to stop the next turn
            event.preventDefault(); //don't load the next turn just yet, wait for the asynchronous equipment purchase
            //Buy equipment, then play next turn
            fetch('http://heaven.landofice.com/main.php?budovaaction=1100&bu_kolik=5')
                .then(result => { //don't block player action -> play next turn regardless of result (worse scenario is "no recruit", which is fine)
                    window.open('http://heaven.landofice.com/main.php?odehraj&pustina&', '_self')
                })
        }
        // else - equipment OK, no need to do anything
    })

    console.log(`Tweak "${SETTINGS_KEYS.vulkanAutoBuyFireMage}": Activated`);
}

/**Alert player if soothsayer from Francox sect arrives with a riddle, so player doesn't miss it*/
function tweak_alertFrancoxSect() {
    if (window.location.pathname !== '/main.php') {
        return
    } //option works only on the main page with sidebar

    let turnInfoSection = document.getElementsByClassName('odehraj odehraj-odtah').item(0);
    if (getElementByText('Vyslechnout jej', turnInfoSection, 'a', false)) { //don't use exact match (whitespaces)
        alert('Přišel k nám věštec francoxovy sekty!\nNezapomeň jej vyslechnout.\nŘešení známých hádanek např. zde:\nloi.dobrodruh.net/rubriky/land-of-ice/hadanky');
    }
    console.log(`Tweak "${SETTINGS_KEYS.alertFrancoxSect}": Activated`);
}

/**TODO how it works, disabled elems, buttons, refresh...*/
function tweak_plunderWatchdog() {
    if (window.location.pathname !== '/plunder') {
        return
    } //works only on the plunder page

    //CONTROL SECTION - create tweak control section above the plundering (right below the main header)
    let mainHeader = getElementByText('Plenění', document, 'h3', true);
    let controlSection = document.createElement('div');
    mainHeader.insertAdjacentElement('afterend', controlSection);
    let controlSectionTitle = document.createElement('h4');
    controlSectionTitle.textContent = 'Plunder watchdog control section';
    controlSection.appendChild(controlSectionTitle);

    //TODO better comment - plunder settings, why disabled
    let targets = createWatchdogTargetList(controlSection);
    controlSection.appendChild(document.createElement('br'))

    let monitoring = createWatchdogOptionCheckbox(controlSection, 'Monitoring', 'qol-plunder-checkbox', 'monitoringToggle');
    let alert = createWatchdogOptionCheckbox(controlSection, 'Alert', 'qol-plunder-checkbox', 'alertToggle');
    let autoAttack = createWatchdogOptionCheckbox(controlSection, 'AutoAttack', 'qol-plunder-checkbox', 'autoAttackToggle');
    controlSection.appendChild(document.createElement('br'))

    let mainSwitch = createWatchdogMainSwitch(controlSection);
    controlSection.appendChild(document.createElement('br'))

    createButtonsToAddOrRemoveTargets();

    let options = [mainSwitch, targets, monitoring, alert, autoAttack];
    loadSettings(options) //load states of the plunder settings
        .then(result => {
            monitoring.checkbox.checked = monitoring.settingsValue;
            alert.checkbox.checked = alert.settingsValue;
            autoAttack.checkbox.checked = autoAttack.settingsValue;
            mainSwitch.setStatus(mainSwitch.settingsValue);
            targets.refreshTargetsList()

            //config loaded -> enable controls, so player can interact with them
            mainSwitch.button.disabled = false;
            for (let checkbox of [monitoring, alert, autoAttack]) {checkbox.checkbox.disabled = false}
            for (let addButton of document.getElementsByClassName('qol-plunder-add-target')) {addButton.disabled = false}
            for (let rmButton of document.getElementsByClassName('qol-plunder-remove-target')) {rmButton.disabled = false}

            mainSwitch.button.addEventListener('click', function () {
                mainSwitch.settingsValue = !mainSwitch.settingsValue;
                saveOptionState(mainSwitch);
                mainSwitch.setStatus(mainSwitch.settingsValue);
                if (mainSwitch.settingsValue === true) {
                    // TODO set timers...
                } else {
                    // TODO clear timers
                }
            })
        })
    

    console.log(`Tweak "${SETTINGS_KEYS.plunderWatchdog}": Activated`);
    //TODO by default DISABLE all plunder settings, until main switch state is loaded - it will be enabled in there, so everything is loaded correctly
    // TODO this is to ensure all settings are loaded
    // TODO timers check the real time, cos e.g. PC goes to sleep it is inaccurate https://stackoverflow.com/a/41507793/7684041


    function createButtonsToAddOrRemoveTargets() {
        for (let place of getAllPlunderPlaces(document)) {
            let addTarget = document.createElement('button');
            addTarget.textContent = 'Add'
            addTarget.setAttribute('type', 'button');
            addTarget.setAttribute('class', 'qol-plunder-add-target');
            addTarget.disabled = true;
            place.containerElem.appendChild(addTarget);
            addTarget.addEventListener('click', function (event) {
                targets.addTarget(place.name)
            })

            let removeTarget = document.createElement('button');
            removeTarget.textContent = 'Remove'
            removeTarget.setAttribute('type', 'button');
            removeTarget.setAttribute('class', 'qol-plunder-remove-target');
            removeTarget.disabled = true;
            place.containerElem.appendChild(removeTarget);
            removeTarget.addEventListener('click', function (event) {
                targets.removeTarget(place.name)
            })
        }
    }
}

/**Load all 'settingsValue' attribute for all given option objects. Do it asynchronously, return a promise */
function loadSettings(plunderOptions) {
    return new Promise(function (resolve, reject) {
        let keys = plunderOptions.map(option => option.settingsKey);
        chrome.storage.local.get(keys, function (result) {
            for (let option of plunderOptions) {
                if (result[option.settingsKey] === undefined) { //first run - initialize setting with the default value
                    saveOptionState(option);
                } else {
                    option.settingsValue = result[option.settingsKey];
                }
            }
            resolve(result); //inspired by https://stackoverflow.com/a/59441208/7684041
        });
    })
}

function saveOptionState(option) {
    chrome.storage.local.set({[option.settingsKey]: option.settingsValue}) //[key] -> use key's value as the key, not the variable name ("key")
}

function createWatchdogMainSwitch(parent) {
    let label = document.createElement('label')
    label.textContent = 'Status:'
    label.setAttribute('class', 'qol-plunder-main-switch')

    let status = document.createElement('span')
    status.textContent = '⏾'
    status.setAttribute('class', 'qol-plunder-main-switch')

    let button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('class', 'qol-plunder-main-switch');
    button.textContent = 'START';
    button.disabled = true;

    parent.appendChild(label);
    parent.appendChild(status);
    parent.appendChild(button);

    let mainSwitch = {label: label, statusElem: status, button: button};
    mainSwitch.settingsKey = 'plunderMainSwitch';
    mainSwitch.settingsValueDefault = false;
    mainSwitch.settingsValue = mainSwitch.settingsValueDefault;
    mainSwitch.isRunning = function () {
        return mainSwitch.settingsValue
    }
    mainSwitch.setStatus = function (isRunning) {
        if (isRunning) {
            mainSwitch.statusElem.textContent = '🟢';
            mainSwitch.button.textContent = 'STOP';
        } else {
            mainSwitch.statusElem.textContent = '⏾';
            mainSwitch.button.textContent = 'START';
        }
    }

    return mainSwitch
}

function createWatchdogTargetList(parent) {
    let label = document.createElement('label')
    label.textContent = 'Selected targets:'
    label.setAttribute('class', 'qol-plunder-target-list')
    let list = document.createElement('span')
    list.textContent = 'None'
    list.setAttribute('class', 'qol-plunder-target-list')
    parent.appendChild(label)
    parent.appendChild(list)

    let targets = {labelElem: label, listElem: list};
    targets.settingsKey = 'plunderTargetList';
    targets.settingsValueDefault = [];
    targets.settingsValue = targets.settingsValueDefault;
    targets.refreshTargetsList = function () {targets.listElem.textContent = targets.settingsValue} //update/show current targets in UI
    targets.addTarget = function (targetName) {
        if (!targets.settingsValue.includes(targetName)) {
            targets.settingsValue.push(targetName);
            saveOptionState(targets);
            targets.refreshTargetsList();
        }
    }
    targets.removeTarget = function (targetName) {
        if (targets.settingsValue.includes(targetName)) {
            targets.settingsValue = removeValueFromArray(targetName, targets.settingsValue);
            saveOptionState(targets);
            targets.refreshTargetsList();
        }
    }
    return targets
}

    function createWatchdogOptionCheckbox(parent, name, css_class, id) {
        let checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.setAttribute('id', id);
        checkbox.setAttribute('class', css_class);
        checkbox.disabled = true;
        let label = document.createElement('label');
        label.textContent = name
        label.setAttribute('for', id)
        label.setAttribute('class', css_class)
        parent.appendChild(label);
        parent.appendChild(checkbox);

        let toggle = {checkbox: checkbox, label: label};
        toggle.settingsKey = `plunder${name}Checkbox`;
        toggle.settingsValueDefault = false;
        toggle.settingsValue = toggle.settingsValueDefault; //init default, real value will be later loaded from local config ASAP

        //save checkbox state to storage on change and update its value in the option object
        toggle.checkbox.addEventListener('change', function () {
            toggle.settingsValue = toggle.checkbox.checked;
            saveOptionState(toggle);
        })

        return toggle
    }

    function getAllPlunderPlaces(doc) {
        let plunderPlaces = []
        for (let placeContainer of doc.getElementsByClassName('pleneni-table f-left t-c')) {
            let p = {
                name: placeContainer.getElementsByTagName('h4').item(0).textContent,
                containerElem: placeContainer,
                attackElem: placeContainer.getElementsByTagName('a').item(0), //if attack on cooldown -> null
                statusElem: placeContainer.getElementsByTagName('i').item(1) //if attack ready -> no status -> null
            }
            plunderPlaces.push(p);
        }

        console.log(plunderPlaces) //TODO rm logs
        console.log(plunderPlaces[0])
        return plunderPlaces
    }