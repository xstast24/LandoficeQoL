/**Plunder watchdog*/
async function plunderWatchdog() {
    if (window.location.pathname !== '/plunder') {return} //works only on the plunder page

    const SECOND = 1000; //ms
    const MINUTE = 60000; //ms
    let updateIntervalLong = MINUTE; //in ms
    let updateIntervalShort = 0.7*SECOND; //in ms
    let nextUpdateTimeout = SECOND; //first update watchdog after 1s to quickly update basic time info; later this var is modified dynamically as needed
    //give some time between switching from short to long interval, so player can play & attack events (army gets exhausted for a few seconds) while waiting for plunder
    let gracePeriodBeforeSwitchingToLongInterval = MINUTE;
    //save time of the last time we noticed that any place is soon ready to attack
    let placeReadySoonLastDetectionTime = 1; //[ms] 1 means a "long time ago in history"

    //CONTROL SECTION - create tweak control section above the plundering (right below the main header)
    let controlSection = createControlSection();
    //LEFT SIDE
    //checkboxes/buttons are by default disabled, only after settings are loaded from storage (later), they can be set to correct values and enabled
    let monitoring = createWatchdogOptionCheckbox(controlSection.leftSide, 'MonitoringTODO', 'qol-plunder-checkbox', 'monitoringToggle');
    let showAlert = createWatchdogOptionCheckbox(controlSection.leftSide, 'Alert', 'qol-plunder-checkbox', 'alertToggle');
    let autoAttack = createWatchdogOptionCheckbox(controlSection.leftSide, 'AutoAttack', 'qol-plunder-checkbox', 'autoAttackToggle');
    controlSection.leftSide.appendChild(document.createElement('br'))
    let targets = createWatchdogTargetList(controlSection.leftSide);
    controlSection.leftSide.appendChild(document.createElement('br'))
    let mainSwitch = createWatchdogMainSwitch(controlSection.leftSide);
    controlSection.leftSide.appendChild(document.createElement('br'))
    let timeIntervalSelectors = createTimeIntervalSelectors(controlSection.leftSide); //TODO currently only shows hardcoded intervals, make selectors, so user can choose
    controlSection.leftSide.appendChild(document.createElement('br'))
    let updateStatusArea = createUpdateStatusArea(controlSection.leftSide);
    controlSection.leftSide.appendChild(document.createElement('br'))
    let attackInfoArea = createAttackInfoArea(controlSection.leftSide);
    controlSection.leftSide.appendChild(document.createElement('br'))
    createButtonsToAddOrRemoveTargets();
    //RIGHT side
    let alertSettings = createAlertSettings(controlSection.rightSide);

    let options = [mainSwitch, targets, monitoring, showAlert, autoAttack];
    let plunderPlaces = getAllPlunderPlaces(document);

    loadSettings(options) //load states of the plunder settings
        .then(result => {
            alertSettings.loadSettings();
            monitoring.checkbox.checked = monitoring.settingsValue;
            showAlert.checkbox.checked = showAlert.settingsValue;
            autoAttack.checkbox.checked = autoAttack.settingsValue;
            mainSwitch.setStatus(mainSwitch.settingsValue);
            targets.refreshTargetsList()
            //config loaded -> enable controls, so player can interact with them
            mainSwitch.button.disabled = false;
            targets.clearButton.disabled = false;
            for (let checkbox of [monitoring, showAlert, autoAttack]) {checkbox.checkbox.disabled = false}
            monitoring.checkbox.disabled = true //TODO remove after monitoring is implemented
            for (let addButton of document.getElementsByClassName('qol-plunder-add-target')) {addButton.disabled = false}
            for (let rmButton of document.getElementsByClassName('qol-plunder-remove-target')) {rmButton.disabled = false}

            //this happens if main switch button is clicked
            mainSwitch.button.addEventListener('click', function () {
                if (mainSwitch.settingsValue === false) { //watchdog was turned off -> turn it on
                    initAudioEngine() //needed to play sound alert later
                    mainSwitch.startWatchdog()
                } else {
                    mainSwitch.stopWatchdog()
                }
            })

            //This happens after page is opened.
            // If watchdog is running, stop it, so user must manually start it:
            // --> avoid incidental attacks on places from previous sessions with different clans
            // --> needed to init audio engine (must be run from user action like click)
            if (mainSwitch.settingsValue === true) {
                mainSwitch.button.click() //STOP
                clearAllTimeouts() //not needed (already done in stop action), just to be 140% sure if anything changes in future etc.
            } //else - watchdog is off -> do nothing
        })

    function update () {
        //TODO places attribute expectedTime, common var with lastUpdate time for monitoring to check real time intervals?
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
                let previousUpdateTimeout = nextUpdateTimeout;
                let nextTimeout = -1; //reset/unset the next update time
                for (let id of targets.settingsValue) {
                    let target = plunderPlaces[id];
                    if (target.isAttackReady()) {
                        //ATTACK TARGET
                        if (autoAttack.checkbox.checked) {
                            attackPlace(target);
                            //sometimes attack fails with err (network, too fast/slow etc.) -> retry quickly (if all goes well, the next retry will be long, no need to worry)
                            nextTimeout = updateIntervalShort;
                            break;
                        }
                        //SHOW ALERT
                        if (showAlert.checkbox.checked) {
                            playDoubleBeep(alertSettings)
                                .then(r => {alert(`${target.name} is ready to attack!`)}) //can't show alert before beep, cos alert blocks everything
                                .catch(err => {console.error('Alert not shown! Probably BEEP failed sooner: ', err)})
                            nextTimeout = updateIntervalLong;
                            break;
                        }
                        //keep long interval (so refresh doesn't interfere with attacks, or alert doesn't spam user when trying to attack manually)
                    } else if (target.status() === plunderStates.lessThan30Min) {
                        //SET SHORT UPDATE INTERVAL if any target is appearing soon
                        placeReadySoonLastDetectionTime = Date.now();
                        nextTimeout = updateIntervalShort;
                    }
                }

                //update interval not set (no targets found) -> set it now
                if (nextTimeout === -1) {
                    if (previousUpdateTimeout === updateIntervalLong) {
                        //keep the long interval, no problem here
                        nextTimeout = updateIntervalLong;
                    } else if (previousUpdateTimeout === updateIntervalShort) {
                        //Give some grace period while switching to long interval. This is needed to let player play while waiting.
                        //E.g. can attack events -> getting the army exhausted for a few seconds -> don't set long interval immediately, keep short one for some itme
                        //E.g. can switch to exhausted clan to help friend's city which is under siege -> can't plunder for a few seconds -> same as above
                        let timeSinceLastEventWasSeenReady = Date.now() - placeReadySoonLastDetectionTime;
                        if (timeSinceLastEventWasSeenReady > gracePeriodBeforeSwitchingToLongInterval) {
                            nextTimeout = updateIntervalLong; //place not seen ready for longer than the grace period -> we can switch to long interval
                        } else {
                            nextTimeout = updateIntervalShort; //place not ready for a short while - don't set long interval just yet, wait a bit more
                        }
                    } else {console.error('Update interval not equal to short/long interval - this shouldnt happen, weird.'); nextTimeout = updateIntervalShort}
                }

                //add some random jitter to the time interval, so it is not too regular and can't be detected on backend
                let randomizedTimeout;
                if (nextTimeout === updateIntervalLong) {
                    randomizedTimeout = getRandomInt(updateIntervalLong-5*SECOND, updateIntervalLong+5*SECOND);
                } else if (nextTimeout === updateIntervalShort) {
                    randomizedTimeout = getRandomInt(updateIntervalShort, updateIntervalShort + 0.2*SECOND);
                }

                scheduleNextUpdate(randomizedTimeout);
                updateStatusArea.setStatusSuccess();
                nextUpdateTimeout = nextTimeout;
            })
            .catch(error => {
                console.warn('Update failed - promise returned error (rejected):', error)
                updateStatusArea.setStatusFail()
                clearAllTimeouts()
                scheduleNextUpdate(nextUpdateTimeout) //next update interval (long/short) is kept same as for the last update
            })
    }

    function attackPlace(place) {
        let url = place.attackElem().getAttribute('href'); //example http://heaven.landofice.com/utok.php?utok=pleneni_13
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
                            attackInfoArea.setAttackStatus(place, true)
                            mainSwitch.stopWatchdog()
                            sleep(1000) //FIXME showing blank page sometimes - will sleep help?
                                .then(r => openResultInTab(result, 'current')); //load fight results directly in the plunder tab after the attack is finished)
                        } else {
                            console.error(`Auto attack on "${place.name}" failed on submitting attack form! Server error or somebody was faster?`);
                            attackInfoArea.setAttackStatus(place, false)
                        }
                    })
            })
            .catch(error => {
                console.error(`Auto attack on "${place.name}" failed! Maybe network error? Error: `, error);
                attackInfoArea.setAttackStatus(place, false)
            })
    }

    function scheduleNextUpdate(timeout) {
        setTimeout(update, timeout);
        updateStatusArea.setNextUpdateTime(timeout); //reflect in UI, so player can see it
        console.log(`Scheduled next update - in ${timeout/1000} s`);
    }

    function updatePlacesWithNewInfo(oldPlaces, newPlaces) {
        //replace current place info (status & attack) with the new place info (to reflect changes in UI)
        for (let i = 0; i < oldPlaces.length ; i++) {
            let oldPlace = oldPlaces[i]; let newPlace = newPlaces[i];
            oldPlace.replaceStatusElem(newPlace.statusElem());
            oldPlace.replaceAttackElem(newPlace.attackElem());
            oldPlace.replaceSpecialMessage(newPlace.specialMessage());
        }
    }

    console.log(`Tweak "${SETTINGS_KEYS.plunderWatchdog}": Activated`);
    // TODO monitoring - timers check the real time cos e.g. PC goes to sleep it is inaccurate https://stackoverflow.com/a/41507793/7684041
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
            }
            //must find attack/status/speciaMsg dynamically, cos static assignment on creation would not work later (after the elems got replaced by updated status/msg)
            p.attackElem = function () {return p.bodyContainerElem.getElementsByTagName('a').item(0)} //if attack on cooldown -> null
            p.statusElem = function () {return p.bodyContainerElem.getElementsByTagName('i').item(1)} //if attack ready -> no status -> null
            //there is either attackElem, statusElem or special message (army not ready/place under construction/...)
            p.specialMessage = function () {
                if (p.attackElem() || p.statusElem()) return null;
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
                    if (p.statusElem()) {p.bodyContainerElem.replaceChild(newStatusElem, p.statusElem());}
                    else {
                        if (p.specialMessage()) p.replaceSpecialMessage('');
                        p.createStatusElem(newStatusElem.textContent)
                    }
                } else {
                    if (p.statusElem()) {p.bodyContainerElem.removeChild(p.statusElem())}
                }
            };
            p.replaceAttackElem = function(newAttackElem) {
                if (newAttackElem) {
                    if (p.attackElem()) {p.bodyContainerElem.replaceChild(newAttackElem, p.attackElem());}
                    else {
                        if (p.specialMessage()) p.replaceSpecialMessage('');
                        p.bodyContainerElem.appendChild(newAttackElem)
                    }
                } else {
                    if (p.attackElem()) {p.bodyContainerElem.removeChild(p.attackElem())}
                }
            };
            p.status = function () {
                if (p.statusElem()) {return p.statusElem().textContent}
                else {return plunderStates.attackReady}
            };
            p.isAttackReady = function () {return (p.attackElem() !== null)};
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
        let clearButton = document.createElement('button')
        clearButton.textContent = 'Clear'
        clearButton.setAttribute('type', 'button');
        clearButton.setAttribute('class', 'qol-plunder-target-list')
        clearButton.disabled = true;
        parent.appendChild(label)
        parent.appendChild(list)
        parent.appendChild(clearButton)

        let targets = {labelElem: label, listElem: list, clearButton: clearButton};
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
        clearButton.addEventListener('click', function () {
            targets.settingsValue = targets.settingsValueDefault;
            saveOptionState(targets);
            targets.refreshTargetsList();
        })
        return targets
    }

    function createAttackInfoArea(parent) {
        let attackLabel = document.createElement('label')
        attackLabel.textContent = 'Last attack status:'
        attackLabel.setAttribute('class', 'qol-plunder-attack-status')
        let attackStatus = document.createElement('label')
        attackStatus.textContent = '-'
        attackStatus.setAttribute('class', 'qol-plunder-attack-status')
        parent.appendChild(attackLabel)
        parent.appendChild(attackStatus)

        let attackInfoArea = {attackLabel: attackLabel, attackStatus: attackStatus}
        attackInfoArea.setAttackStatus = function (place, attackSucceeded) {
            let state = attackSucceeded ? '✅' : '❌'
            let time = new Date().toLocaleTimeString([], {hour12: false})
            attackInfoArea.attackStatus.textContent = `${state} ${place.name}  ${time}`
        }
        return attackInfoArea
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
        time.textContent = new Date().toLocaleTimeString([], {hour12: false});
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
            let nextUpdateDate = new Date();
            nextUpdateDate.setMilliseconds(nextUpdateDate.getMilliseconds() + nextUpdateTimeoutMs);
            updateStatusArea.nextUpdateTime.textContent = nextUpdateDate.toLocaleTimeString([], {hour12: false})
        };
        updateStatusArea.setStatusSuccess = function () {
            updateStatusArea.status.textContent = '✅';
            time.textContent = new Date().toLocaleTimeString([], {hour12: false})
        };
        updateStatusArea.setStatusFail = function () {
            updateStatusArea.status.textContent = '❌';
            time.textContent = new Date().toLocaleTimeString([], {hour12: false})
        };
        updateStatusArea.setStatusLoading = function () {
            updateStatusArea.status.textContent = '⏳';
            time.textContent = new Date().toLocaleTimeString([], {hour12: false})
        };
        return updateStatusArea
    }

    function createTimeIntervalSelectors(parent) {
        //TODO currently only hardcoded labels, make it selectable and save/load settings
        let longIntervalLabel = document.createElement('label');
        longIntervalLabel.textContent = `Long interval (>30 min): ${updateIntervalLong/1000} s`
        longIntervalLabel.setAttribute('class', 'qol-plunder-update-time-selector')
        let shortIntervalLabel = document.createElement('label');
        shortIntervalLabel.textContent = `Short interval (<30 min): ${updateIntervalShort/1000} s`
        shortIntervalLabel.setAttribute('class', 'qol-plunder-update-time-selector')
        shortIntervalLabel.updateLabel = function () {shortIntervalLabel.textContent = `Short interval (<30 min): ${(updateIntervalShort/1000).toFixed(1)} s`}
        let shortIntervalSelector = document.createElement('input');
        shortIntervalSelector.setAttribute('class', 'qol-plunder-update-time-selector')
        shortIntervalSelector.style.width = 'auto';
        shortIntervalSelector.setAttribute('type', 'range')
        shortIntervalSelector.setAttribute('min', `${0.1*SECOND}`)
        shortIntervalSelector.setAttribute('max', `${1.5*SECOND}`)
        shortIntervalSelector.value = updateIntervalShort
        shortIntervalSelector.addEventListener('change', function () {
            updateIntervalShort = Number(shortIntervalSelector.value)
            shortIntervalLabel.updateLabel()
        })

        parent.appendChild(longIntervalLabel)
        parent.appendChild(document.createElement('br'))
        parent.appendChild(shortIntervalLabel)
        parent.appendChild(shortIntervalSelector)
        return {longIntervalLabel: longIntervalLabel, shortIntervalLabel: shortIntervalLabel, shortIntervalSelector: shortIntervalSelector}
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
        mainSwitch.settingsValueDefault = false; //false = watchdog is turned off; true = watchdog is running
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
        mainSwitch.startWatchdog = function () {
            mainSwitch.settingsValue = true;
            mainSwitch.setStatus(mainSwitch.settingsValue);
            nextUpdateTimeout = updateIntervalShort;
            updateStatusArea.setNextUpdateTime(nextUpdateTimeout);
            saveOptionState(mainSwitch);
            scheduleNextUpdate(nextUpdateTimeout);
        }
        mainSwitch.stopWatchdog = function () {
            mainSwitch.settingsValue = false;
            mainSwitch.setStatus(mainSwitch.settingsValue);
            updateStatusArea.nextUpdateTime.textContent = '-';
            saveOptionState(mainSwitch);
            clearAllTimeouts();
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

    function createControlSection() {
        let mainHeader = getElementByText('Plenění', document, 'h3', true);
        let controlSectionTitle = document.createElement('h4');
        controlSectionTitle.textContent = 'Plunder watchdog control section';
        let controlSection = document.createElement('div');
        controlSection.setAttribute('id', 'qol-plunder-control-section-container')
        let controlSectionLeft = document.createElement('div');
        controlSectionLeft.setAttribute('id', 'qol-plunder-control-section-left')
        let controlSectionRight = document.createElement('div');
        controlSectionRight.setAttribute('id', 'qol-plunder-control-section-right')
        mainHeader.insertAdjacentElement('afterend', controlSectionTitle);
        controlSectionTitle.insertAdjacentElement('afterend', controlSection);
        controlSection.appendChild(controlSectionLeft);
        controlSection.appendChild(controlSectionRight);
        return {mainContainer: controlSection, leftSide: controlSectionLeft, rightSide: controlSectionRight}
    }

    function createAlertSettings(parent) {
        let volumeLabel = document.createElement('label')
        volumeLabel.textContent = 'Alert sound volume:'
        let volumeSelector = document.createElement('input')
        volumeSelector.setAttribute('type', 'range')
        volumeSelector.setAttribute('min', '0')
        volumeSelector.setAttribute('max', '100')
        volumeSelector.style.minWidth = '50%';
        let frequencyLabel = document.createElement('label')
        frequencyLabel.textContent = 'Alert sound frequency:'
        let frequencySelector = document.createElement('input')
        frequencySelector.setAttribute('type', 'range')
        frequencySelector.setAttribute('min', '0') //will recalculate to Hz later using logarithmic scale
        frequencySelector.setAttribute('max', '100')
        frequencySelector.style.minWidth = '50%';
        let playButton = document.createElement('button')
        playButton.textContent = 'Play'
        let saveButton = document.createElement('button')
        saveButton.textContent = 'Save'
        parent.appendChild(volumeLabel)
        parent.appendChild(volumeSelector)
        parent.appendChild(document.createElement('br'))
        parent.appendChild(frequencyLabel)
        parent.appendChild(frequencySelector)
        parent.appendChild(document.createElement('br'))
        parent.appendChild(playButton)
        parent.appendChild(saveButton)

        let alertSettings = {volumeSelector: volumeSelector, frequencySelector: frequencySelector}
        alertSettings.settingsKey = 'plunderAlertSoundSettings'
        let minFreq = 65; let maxFreq = 6271; //reasonable range C2-G8 (65-6271 Hz), see all notes https://pages.mtu.edu/~suits/notefreqs.html
        alertSettings.defaultSettings = [0.5, 440]; //[VOLUME, FREQUENCY]
        alertSettings.currentSettings = function () {
            return [
                parseInt(volumeSelector.value)/100.0, //0-100 --> [0-1]
                linearValueToLogarithmicScale(frequencySelector.value/100, minFreq, maxFreq).toFixed() //0-100 --> logarithmic frequency Hz
            ]
        }
        alertSettings.volumeValue = function () {return alertSettings.currentSettings()[0]}
        alertSettings.frequencyValue = function () {return alertSettings.currentSettings()[1]}
        alertSettings.setSettingsToSelectors = function (settingsArray) {
            volumeSelector.value = (settingsArray[0] * 100).toFixed().toString(); //[0-1] --> 0-100
            frequencySelector.value = (logarithmicValueToLinearScale(settingsArray[1], minFreq, maxFreq) * 100).toFixed().toString(); //log freq Hz --> 0-100
        }
        alertSettings.saveSettings = function (settingsArray) {
            chrome.storage.local.set({[alertSettings.settingsKey]: settingsArray}) //[key] -> use key's value as the key, not the variable name ("key")
        }
        alertSettings.loadSettings = function () {
            chrome.storage.local.get(alertSettings.settingsKey, function (result) {
                if (isEmpty(result) || (alertSettings.defaultSettings.length !== result[alertSettings.settingsKey].length)) {
                    //first run or config was saved in old version where were fewer/more options -> init default value
                    alertSettings.saveSettings(alertSettings.defaultSettings);
                    alertSettings.setSettingsToSelectors(alertSettings.defaultSettings)
                } else {
                    alertSettings.setSettingsToSelectors(result[alertSettings.settingsKey]);
                }
            });
        }

        saveButton.addEventListener('click', function () {alertSettings.saveSettings(alertSettings.currentSettings())})
        playButton.addEventListener('click', function (event) {
            if (!audioEngineInitialized()) initAudioEngine();
            playDoubleBeep(alertSettings);
        })
        return alertSettings
    }

    /**Play 2x beep sound with pause [ms] in between. See beep() function description for exact info about parameters.
     * Audio engine must be first initialized within user action!*/
    function playDoubleBeep(alertSettings) {
        const duration = 200; const pause = 100; const type = 'square';
        const freq = alertSettings.frequencyValue()
        const volume = alertSettings.volumeValue()
        return new Promise((resolve, reject) => {
            if (!audioEngineInitialized()) {console.error('Playing beep failed - audio engine not ready')} //no need to reject here, will be rejected in beep later
            beep(duration, freq, volume, type)
                .then(r => {return sleep(pause)})
                .then(r => {return beep(duration, freq, volume, type)})
                .then(r => resolve(r))
                .catch(err => reject(err))
        })
    }
}
