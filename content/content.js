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

/**Show buttons to quickly switch between all clans directly on the main page*/
function tweak_clanQuickSwitchButtons() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

    let topLeftMenu = document.getElementsByClassName('menu-left').item(0);
    let existingSwitchElems = Array.from(topLeftMenu.getElementsByTagName('a'))
    let clansListSettingsKey = 'quickClanSwitchInfo' //clan list is loaded/saved to storage under this key

    let reloadButton = createReloadButton();
    reloadButton.addEventListener('click', function () {
        parseClansInfoAndSaveAndReload()
    })

    // load clans info from storage and add switches for all clans
    chrome.storage.local.get(clansListSettingsKey, function (result) {
        if (isEmpty(result)) {console.log('No clan info found - use the reload button (not browser refresh)'); return} //first run only
        let existingSwitches = existingSwitchElems.map(item => item.getAttribute('href'));
        let currentActiveClanName = document.getElementsByClassName('klan-name').item(0);
        currentActiveClanName = currentActiveClanName.firstElementChild.textContent.replace('Klan ', '');
        //create clan switches
        let clans = result[clansListSettingsKey].map(info => Object.create({id: info[0], name: info[1], leader: info[2], img: info[3]}))
        for (let clan of clans) {
            if (existingSwitches.includes(clan.id)) {continue} //dont duplicate
            let clanButton = createClanButton(clan);
            if (clan.name === currentActiveClanName) {
                clanButton.setAttribute('class', 'activate-clan tooltip active'); //makes the current clan img glow
                continue; //no need to set click listener to activate the clan (already active) -> skip
            }
            //add click listener to button to load the selected clan
            //NOTE: Loi sends ID through some form (there is JS function for it), I am lazy to investigate "how", so I just switch in background and refresh page
            clanButton.addEventListener('click', function (event) {
                event.preventDefault() //don't load the switch link directly - it wouldn't work, or it would redirect to settings
                fetch(`http://heaven.landofice.com/settings/changeClan/${clan.id}`)
                    .then(result => {
                        if (result.ok) {clickSidebarOption('Obnovit')}
                        else {alert(`Switching to clan ${clan.id} failed, LoI server returned error: ${result.status} ${result.statusText}`)}
                    })
                    .then(result => clickSidebarOption('Obnovit'))
                    .catch(fail => alert(`Switching to clan ${clan.id} failed: ${fail}`))
            })
        }
        // resize menu container, so they fit next to each other
        //const switchWidth = getComputedStyle(existingSwitchElems[0]).width; --> string 54px
        const resizedMenuWidth = clans.length * 64 + 50 //64 is size of 1 switch, 50 is reserve for reload button, padding etc.
        topLeftMenu.style.width = `${resizedMenuWidth}px`
    })

    function createReloadButton() {
        let updateButton = document.createElement('button');
        updateButton.textContent = '🔄'
        updateButton.setAttribute('type', 'button');
        updateButton.setAttribute('class', 'qol-quick-clan-switch');
        topLeftMenu.appendChild(updateButton);
        return updateButton
    }

    function createClanButton(clan) {
        let clanSwitchButton = document.createElement('a');
        // loi is sending ID through form -> href is just clan ID, not the actual link "...settings/changeClan/<ID>" which redirects to settings
        clanSwitchButton.setAttribute('href', clan.id);
        //clanSwitchButton.setAttribute('href', clan.id);
        clanSwitchButton.setAttribute('class', 'activate-clan tooltip ');

        let clanImg = document.createElement('img');
        clanImg.setAttribute('src', clan.img);
        clanSwitchButton.appendChild(clanImg);

        let hoverDescription = document.createElement('span');
        hoverDescription.textContent = `${clan.name} id: ${clan.id}`;
        clanSwitchButton.appendChild(hoverDescription);

        topLeftMenu.insertBefore(clanSwitchButton, reloadButton);
        return clanSwitchButton
    }

    function parseClansInfoAndSaveAndReload() {
        fetch('http://heaven.landofice.com/settings')
            .then(result => result.text())
            .then(resultHtmlString => {
                const resultDoc = new DOMParser().parseFromString(resultHtmlString, 'text/html');

                //parse clans info
                let clans = []
                let tableFrame = resultDoc.getElementsByClassName('opaque-frame globalstats').item(0);
                let table = tableFrame.getElementsByTagName('tbody').item(0);
                let i = -1 //row index
                for (let row of table.getElementsByTagName('tr')) {
                    i++
                    if (i % 2 === 1) {continue} //even rows have info about plunder cooldown, all main info is on odd rows

                    let cols = row.getElementsByTagName('td')
                    let img = '/images/avatars/def_avatar.jpg' //default img (empty)
                    let imgElem = cols.item(0).getElementsByTagName('img').item(0)
                    if (imgElem) {img = imgElem.getAttribute('src')}
                    let id = cols.item(1).textContent
                    let leader = cols.item(2).textContent
                    let name = cols.item(3).textContent

                    clans.push([id, name, leader, img])
                }
                //save clans to storage, must be primitives (no objects) -> list of lists
                chrome.storage.local.set({[clansListSettingsKey]: clans}) //[key] -> use key's value as the key, not the variable name ("key")
            })
            .then(result => clickSidebarOption('Obnovit')) //refresh the page -> new clan info will be reflected
    }
}

/**Vulkan equipment: make sure there is at least 5 equipment for fire mages every round, so it recruits fire mage(s) -> 1 arch mage of fire comes as bonus.*/
function tweak_vulkanAutoBuyFireMage() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

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
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

    let turnInfoSection = document.getElementsByClassName('odehraj odehraj-odtah').item(0);
    if (getElementByText('Vyslechnout jej', turnInfoSection, 'a', false)) { //don't use exact match (whitespaces)
        alert('Přišel k nám věštec francoxovy sekty!\nNezapomeň jej vyslechnout.\nŘešení známých hádanek např. zde:\nloi.dobrodruh.net/rubriky/land-of-ice/hadanky');
    }
    console.log(`Tweak "${SETTINGS_KEYS.alertFrancoxSect}": Activated`);
}

/**TODO how it works, disabled elems, buttons, refresh...*/
function tweak_plunderWatchdog() {
    if (window.location.pathname !== '/plunder') {return} //works only on the plunder page

    const SECOND = 1000; //ms
    const MINUTE = 60000; //ms
    let updateIntervalLong = MINUTE; //in ms
    let updateIntervalShort = 2*SECOND; //in ms
    let nextUpdateTimeout = SECOND; //first update watchdog after 1s to quickly update basic time info; later this var is modified dynamically as needed

    //CONTROL SECTION - create tweak control section above the plundering (right below the main header)
    let mainHeader = getElementByText('Plenění', document, 'h3', true);
    let controlSection = document.createElement('div');
    mainHeader.insertAdjacentElement('afterend', controlSection);
    let controlSectionTitle = document.createElement('h4');
    controlSectionTitle.textContent = 'Plunder watchdog control section';
    controlSection.appendChild(controlSectionTitle);

    //checkboxes/buttons are by default disabled, only after settings are loaded from storage (later), they can be set to correct values and enabled
    let monitoring = createWatchdogOptionCheckbox(controlSection, 'MonitoringTODO', 'qol-plunder-checkbox', 'monitoringToggle');
    let showAlert = createWatchdogOptionCheckbox(controlSection, 'Alert', 'qol-plunder-checkbox', 'alertToggle');
    let autoAttack = createWatchdogOptionCheckbox(controlSection, 'AutoAttack', 'qol-plunder-checkbox', 'autoAttackToggle');
    controlSection.appendChild(document.createElement('br'))
    let targets = createWatchdogTargetList(controlSection);
    controlSection.appendChild(document.createElement('br'))
    let mainSwitch = createWatchdogMainSwitch(controlSection);
    controlSection.appendChild(document.createElement('br'))
    let timeIntervalSelectors = createTimeIntervalSelectors(controlSection); //TODO currently only shows hardcoded intervals, make selectors, so user can choose
    controlSection.appendChild(document.createElement('br'))
    let updateStatusArea = createUpdateStatusArea(controlSection);
    controlSection.appendChild(document.createElement('br'))
    createButtonsToAddOrRemoveTargets();

    let options = [mainSwitch, targets, monitoring, showAlert, autoAttack];
    let plunderPlaces = getAllPlunderPlaces(document);

    loadSettings(options) //load states of the plunder settings
        .then(result => {
            monitoring.checkbox.checked = monitoring.settingsValue;
            showAlert.checkbox.checked = showAlert.settingsValue;
            autoAttack.checkbox.checked = autoAttack.settingsValue;
            mainSwitch.setStatus(mainSwitch.settingsValue);
            targets.refreshTargetsList()
            //config loaded -> enable controls, so player can interact with them
            mainSwitch.button.disabled = false;
            for (let checkbox of [monitoring, showAlert, autoAttack]) {checkbox.checkbox.disabled = false}
            for (let addButton of document.getElementsByClassName('qol-plunder-add-target')) {addButton.disabled = false}
            for (let rmButton of document.getElementsByClassName('qol-plunder-remove-target')) {rmButton.disabled = false}

            //TODO this happens after page is opened
            if (mainSwitch.settingsValue === true) {
                nextUpdateTimeout = SECOND
                scheduleNextUpdate()
            } //else - watchdog is off -> do nothing

            //TODO this happens if main switch button is clicked
            mainSwitch.button.addEventListener('click', function () {
                mainSwitch.settingsValue = !mainSwitch.settingsValue;
                saveOptionState(mainSwitch);
                mainSwitch.setStatus(mainSwitch.settingsValue);
                if (mainSwitch.settingsValue === true) {
                    nextUpdateTimeout = SECOND
                    scheduleNextUpdate()
                } else {
                    updateStatusArea.nextUpdateTime.textContent = '-'
                    clearAllTimeouts()
                }
            })
        })

    function update () {
        //TODO targets by ID
        //TODO places attribute statusInfo, expectedTime
        //TODO common var with lastUpdate time, timeoutInterval var which will be calculated in some func and set later in update
        //TODO set loading animation and reset stautus after end
        clearAllTimeouts() //TODO rm later, now is to not spam LoI by debugging stuff

        updateStatusArea.setStatusLoading()
        fetch('http://heaven.landofice.com/plunder')
            .then(result => {
                    if (result.ok) {
                        console.log('Update: fetch plundering - result ok')
                        return result.text()
                    } else {
                        updateStatusArea.setStatusFail()
                        console.warn('Update: result not ok (server error or logout?):', result)
                        //TODO Handle logout - solve logout and retry immediately (SECOND), or stop updates completely. Will logout return error or 200???
                        return Promise.reject(result) //this will propagate to "catch" case where update is rescheduled
                    }
                }
            )
            .then(resultHtmlString => {
                const resultDoc = new DOMParser().parseFromString(resultHtmlString, 'text/html');
                let newPlaces = getAllPlunderPlaces(resultDoc);

                //TODO monitoring; compare function, place: expected min time, expected max time, place last status, current status
                // for (let i = 0; i < plunderPlaces.length; i++) {
                //     let oldPlace = plunderPlaces[i];
                //     let newPlace = newPlaces[i];
                // }

                //update statuses and attack buttons of all places
                updatePlacesWithNewInfo(plunderPlaces, newPlaces);

                //CHECK ALL TARGETS AND DO ACTION IF NEEDED
                nextUpdateTimeout = getRandomInt(updateIntervalLong-5*SECOND, updateIntervalLong+5*SECOND);
                for (let id of targets.settingsValue) {
                    let target = plunderPlaces[id];
                    if (target.isAttackReady()) {
                        //ATTACK TARGET
                        if (autoAttack.checkbox.checked) {
                            attackPlace(target);
                            break;
                        }
                        //SHOW ALERT
                        if (showAlert.checkbox.checked) {
                            alert(`${target.name} is ready to attack!`);
                        }
                        //keep long interval (so refresh doesn't interfere with attacks, or alert doesn't spam user when trying to attack manually)
                    } else if (target.status() === plunderStates.lessThan30Min) {
                        //SET SHORT UPDATE INTERVAL if any target is appearing soon
                        nextUpdateTimeout = getRandomInt(updateIntervalShort, updateIntervalShort+SECOND);
                    }
                }

                scheduleNextUpdate();
                updateStatusArea.setStatusSuccess()
            })
            .catch(error => {
                console.warn('Update failed - promise returned error (rejected):', error)
                updateStatusArea.setStatusFail()
                clearAllTimeouts()
                scheduleNextUpdate() //next update interval (long/short) is kept same as for the last update
            })
    }

    function attackPlace(place) {
        let url = place.attackElem.getAttribute('href'); //example http://heaven.landofice.com/utok.php?utok=pleneni_13
        fetch(url)
            .then(result => {
                // TODO add handling of http://heaven.landofice.com/nogame/error.php?err=attack-none "bitva nepristupna" - will return OK or FAIL??
                if (result.ok) {
                    return result.text()
                } else {
                    console.error(`Auto attack on "${place.name}" failed on fetching attack table (== clicking the attack)! Server error or somebody was faster?`);
                    return Promise.reject(result) //--> next .then won't happen
                }
            })
            .then(resultHtmlString => {
                const resultDocument = new DOMParser().parseFromString(resultHtmlString, 'text/html');

                //submit the attack form with all units (attackForm is the table/sheet where unit numbers are filled by player)
                let attackForm = resultDocument.getElementsByClassName('utok-formular').item(0);
                fetch(url, {method: 'post', body: new FormData(attackForm)})
                    .then(result => {
                        if (result.ok) {
                            console.log(`Auto attack on "${place.name}" - success B-)`)
                        } else {
                            console.error(`Auto attack on "${place.name}" failed on submitting attack form! Server error or somebody was faster?`);
                        }
                    })
            })
            .catch(error => {
                console.error(`Auto attack on "${place.name}" failed! Maybe network error? Error: `, error);
            })
    }

    function scheduleNextUpdate() {
        clearAllTimeouts();
        setTimeout(update, nextUpdateTimeout);
        updateStatusArea.setNextUpdateTime(nextUpdateTimeout); //reflect in UI, so player can see it
        console.log(`Scheduled next update - in ${nextUpdateTimeout/1000} s`);
    }

    function updatePlacesWithNewInfo(oldPlaces, newPlaces) {
        //replace current place info (status & attack) with the new place info (to reflect changes in UI)
        for (let i = 0; i < oldPlaces.length ; i++) {
            let oldPlace = oldPlaces[i]; let newPlace = newPlaces[i];
            oldPlace.replaceStatusElem(newPlace.statusElem);
            oldPlace.replaceAttackElem(newPlace.attackElem);
            oldPlace.replaceSpecialMessage(newPlace.specialMessage());
        }
    }

    console.log(`Tweak "${SETTINGS_KEYS.plunderWatchdog}": Activated`);
    //TODO by default DISABLE all plunder settings, until main switch state is loaded - it will be enabled in there, so everything is loaded correctly
    // TODO this is to ensure all settings are loaded
    // TODO timers check the real time, cos e.g. PC goes to sleep it is inaccurate https://stackoverflow.com/a/41507793/7684041
    //TODO move outside functions to this scope, no need to pass params (still should anyway), can customise them maybe better though

    const plunderStates = {
        attackReady: 'No status -> attack ready',
        lessThan30Min: 'Na tohle místo je možné zaútočit za Méně než 30 minut',
        cd30MinTo2Hours: 'Na tohle místo je možné zaútočit za 30 minut až 2 hodiny',
        cd2To8Hours: 'Na tohle místo je možné zaútočit za 2 - 8 hodin',
        armyNotReady: 'Na takovýto útok potřebujeme přípravu'
    }

    function getAllPlunderPlaces(doc) {
        let plunderPlaces = []
        let i = -1;
        for (let placeContainer of doc.getElementsByClassName('pleneni-table f-left t-c')) {
            i++;
            let p = {
                id: i,
                name: placeContainer.getElementsByTagName('h4').item(0).textContent,
                containerElem: placeContainer,
                bodyContainerElem: placeContainer.getElementsByClassName('zmerchspodek').item(0), //div with all info (e.g. status), except the name
                attackElem: placeContainer.getElementsByTagName('a').item(0), //if attack on cooldown -> null
                statusElem: placeContainer.getElementsByTagName('i').item(1), //if attack ready -> no status -> null
            }
            //there is either attackElem, statusElem or special message (army not ready/place under construction/...)
            p.specialMessage = function () {
                if (p.attackElem || p.statusElem) return null;
                return p.bodyContainerElem.lastChild.textContent; //message is just a simple text (no element, no tag) at the end of body container
            };
            p.replaceSpecialMessage = function (newSpecialMsg) {
                if (newSpecialMsg) {
                    if (p.specialMessage()) p.bodyContainerElem.lastChild.textContent = newSpecialMsg;
                    else p.bodyContainerElem.append(newSpecialMsg);
                } else {
                    if (p.specialMessage()) p.bodyContainerElem.lastChild.textContent = '';
                }
            }
            p.createStatusElem = function(statusText) {
                let statusElem = document.createElement('i');
                statusElem.textContent = statusText;
                p.bodyContainerElem.appendChild(statusElem);
            };
            p.replaceStatusElem = function(newStatusElem) {
                if (newStatusElem) {
                    console.log('REPLACING STATUS - removing elem: ', p.statusElem, 'NEW ELEM', newStatusElem)
                    if (p.statusElem) {p.bodyContainerElem.replaceChild(newStatusElem, p.statusElem);}
                    else {
                        if (p.specialMessage()) p.replaceSpecialMessage('');
                        p.createStatusElem(newStatusElem.textContent)
                    }
                } else {
                    console.log('REPLACING STATUS - removing elem: ', p.statusElem)
                    if (p.statusElem) {p.bodyContainerElem.removeChild(p.statusElem)}
                }
                p.statusElem = newStatusElem
            };
            p.replaceAttackElem = function(newAttackElem) {
                if (newAttackElem) {
                    if (p.attackElem) {p.bodyContainerElem.replaceChild(newAttackElem, p.attackElem);}
                    else {
                        if (p.specialMessage()) p.replaceSpecialMessage('');
                        p.bodyContainerElem.appendChild(newAttackElem)
                    }
                } else {
                    if (p.attackElem) {p.bodyContainerElem.removeChild(p.attackElem)}
                }
                p.attackElem = newAttackElem
            };
            p.status = function () {
                if (p.statusElem) {return p.statusElem.textContent}
                else {return plunderStates.attackReady}
            };
            p.isAttackReady = function () {return (p.attackElem !== null)};
            plunderPlaces.push(p);
        }
        return plunderPlaces
    }

    function createButtonsToAddOrRemoveTargets() {
        for (let place of getAllPlunderPlaces(document)) {
            let addTarget = document.createElement('button');
            addTarget.textContent = 'Add'
            addTarget.setAttribute('type', 'button');
            addTarget.setAttribute('class', 'qol-plunder-add-target');
            addTarget.disabled = true;
            place.containerElem.appendChild(addTarget);
            addTarget.addEventListener('click', function (event) {
                targets.addTarget(place)
            })

            let removeTarget = document.createElement('button');
            removeTarget.textContent = 'Remove'
            removeTarget.setAttribute('type', 'button');
            removeTarget.setAttribute('class', 'qol-plunder-remove-target');
            removeTarget.disabled = true;
            place.containerElem.appendChild(removeTarget);
            removeTarget.addEventListener('click', function (event) {
                targets.removeTarget(place)
            })
        }
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
        targets.refreshTargetsList = function () { //update/show current targets in UI
            let targetNames = [];
            for (let [i, place] of getAllPlunderPlaces(document).entries()) {
                if (targets.settingsValue.includes(i)) {targetNames.push(place.name)}
            }
            targets.listElem.textContent = targetNames.toString();
        }
        targets.addTarget = function (plunderPlace) {
            if (!targets.settingsValue.includes(plunderPlace.id)) {
                targets.settingsValue.push(plunderPlace.id);
                saveOptionState(targets);
                targets.refreshTargetsList();
            }
        }
        targets.removeTarget = function (plunderPlace) {
            if (targets.settingsValue.includes(plunderPlace.id)) {
                targets.settingsValue = removeValueFromArray(plunderPlace.id, targets.settingsValue);
                saveOptionState(targets);
                targets.refreshTargetsList();
            }
        }
        return targets
    }

    function createUpdateStatusArea(parent) {
        let statusLabel = document.createElement('label');
        statusLabel.textContent = 'Last update status:'
        statusLabel.setAttribute('class', 'qol-plunder-update-status')
        let status = document.createElement('span')
        status.setAttribute('class', 'qol-plunder-update-status')
        status.textContent = '⏾'
        //TODO fancy loading gif? let status = document.createElement('img'); status.setAttribute('src', chrome.runtime.getURL('data/loading_circle32.gif'))
        let time = document.createElement('span')
        time.setAttribute('class', 'qol-plunder-update-status')
        time.textContent = new Date().toLocaleTimeString();
        let nextUpdate = document.createElement('label');
        nextUpdate.textContent = 'Next update:'
        nextUpdate.setAttribute('class', 'qol-plunder-update-status')
        let nextUpdateTime = document.createElement('span')
        nextUpdateTime.setAttribute('class', 'qol-plunder-update-status')
        nextUpdateTime.textContent = '-'; //will be set later when scheduling updates etc.

        parent.appendChild(statusLabel);
        parent.appendChild(status);
        parent.appendChild(time);
        parent.appendChild(nextUpdate);
        parent.appendChild(nextUpdateTime);

        let updateStatusArea = {label: statusLabel, status: status, time: time, nextUpdateLabel: nextUpdate, nextUpdateTime: nextUpdateTime}
        updateStatusArea.setNextUpdateTime = function (nextUpdateTimeoutMs) {
            let currentDate = new Date();
            currentDate.setMilliseconds(currentDate.getMilliseconds()+nextUpdateTimeoutMs);
            updateStatusArea.nextUpdateTime.textContent = currentDate.toLocaleTimeString()
        };
        updateStatusArea.setStatusSuccess = function () {
            updateStatusArea.status.textContent = '✅';
            time.textContent = new Date().toLocaleTimeString()
        };
        updateStatusArea.setStatusFail = function () {
            updateStatusArea.status.textContent = '❌';
            time.textContent = new Date().toLocaleTimeString()
        };
        updateStatusArea.setStatusLoading = function () {
            updateStatusArea.status.textContent = '⏳';
            time.textContent = new Date().toLocaleTimeString()
        };
        return updateStatusArea
    }

    function createTimeIntervalSelectors(parent) {
        //TODO currently only hardcoded labels, make it selectable and save/load settings
        let longIntervalLabel = document.createElement('label');
        longIntervalLabel.textContent = `Long interval (over 30 min): ${updateIntervalLong/1000} s`
        longIntervalLabel.setAttribute('class', 'qol-plunder-update-time-selector')
        let shortIntervalLabel = document.createElement('label');
        shortIntervalLabel.textContent = `Short interval (less than 30 min): ${updateIntervalShort/1000} s`
        shortIntervalLabel.setAttribute('class', 'qol-plunder-update-time-selector')
        parent.appendChild(longIntervalLabel)
        parent.appendChild(shortIntervalLabel)
        return {longIntervalLabel: longIntervalLabel, shortIntervalLabel: shortIntervalLabel}
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
    label.textContent = 'Watchdog status:'
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
            mainSwitch.statusElem.textContent = '⬤';
            mainSwitch.button.textContent = 'START';
        }
    }

    return mainSwitch
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