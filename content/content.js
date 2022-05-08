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
async function runContentTweaks() {
    let settingsKeys = Object.keys(SETTINGS_KEYS);
    chrome.storage.local.get(settingsKeys, function (result) {
        for (let settingKey in SETTINGS_KEYS) {
            if (result[settingKey]) {
                window['tweak_' + settingKey](); // run tweak - evaluate dynamically by method name
                //further logging should be done in the tweak itself, cos here we don't yet know if the conditions were met
            } else {
                console.debug(`Tweak "${settingKey}": OFF`);
            }
        }
    });
}


/**Add option to sidebar on the main page "Add clan leader to army", so user can simply 1-click it (no need to open army, scroll, add, close...) */
async function tweak_sidebarAddArmyLeaderOption() {
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
async function tweak_quickAttackButton() {
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
            quickAttackButton.textContent = '⏳';
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
                .catch(err => console.error(`Attack failed on ${url}... Reason: `, err))
        })
    }
    console.log(`Tweak "${SETTINGS_KEYS.quickAttackButton}": Activated`);
}

/**Add option "Copy Army" into sidebar on the main page, so user can simply 1-click copy and easily paste into simulator (saves much time) */
async function tweak_sidebarCopyArmyOption() {
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
async function tweak_clanQuickSwitchButtons() {
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
async function tweak_vulkanAutoBuyFireMage() {
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
async function tweak_alertFrancoxSect() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

    let turnInfoSection = document.getElementsByClassName('odehraj odehraj-odtah').item(0);
    if (getElementByText('Vyslechnout jej', turnInfoSection, 'a', false)) { //don't use exact match (whitespaces)
        alert('Přišel k nám věštec francoxovy sekty!\nNezapomeň jej vyslechnout.\nŘešení známých hádanek např. zde:\nloi.dobrodruh.net/rubriky/land-of-ice/hadanky');
    }
    console.log(`Tweak "${SETTINGS_KEYS.alertFrancoxSect}": Activated`);
}

/**Plunder watchdog*/
async function tweak_plunderWatchdog() {
    plunderWatchdog()
}
