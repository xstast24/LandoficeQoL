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
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

    let addLeaderURL = 'http://heaven.landofice.com/clanarmy/addCommander'

    //2) Putting addLeaderURL into the option would open the clan army page, so we process the request silently in background (event listener below)
    let addLeaderOption = createSidebarOption('Velitel do armády'); //If it feels unresponsive, add 'main.php?obnovit' href to reload main page? Probbaly OK
    addLeaderOption.addEventListener('click', function(event) {
        fetch(addLeaderURL).then(
            success => {event.target.textContent = 'Velitel ✅'},
            fail => {event.target.textContent = 'Velitel selhal ❌'})
    });

    // insert the option into sidebar (after Clan Army option)
    let clanArmyOption = getSidebarOption('Klanová armáda');
    sidebar().insertBefore(addLeaderOption, clanArmyOption.nextSibling);

    console.log(`Tweak "${SETTINGS_KEYS.sidebarAddArmyLeaderOption}": Activated`);
}

/**Add quick attack option to all attack events on main page -> 1 click attacks the event and plays the next turn immediately after that*/
function tweak_quickAttackButton() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar
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

        attackEventLink.insertAdjacentElement('beforebegin', quickAttackButton) //put button after the event link

        quickAttackButton.addEventListener('click', function (event) {
            let url = attackEventLink.href; //example attack URL 'http://heaven.landofice.com/utok.php?utok=vesnice&'
            fetch(url)
                .then(result => {
                    if (result.ok) {return result.text()}
                    else { // TODO add handling of http://heaven.landofice.com/nogame/error.php?err=attack-none "bitva nepristupna" (pri opakovanem kliknuti na utok)
                        quickAttackButton.textContent = '❌'; console.error('Quick attack failed on fetching attack table (== clicking the event)!');
                        return Promise.reject(result)} //--> next .then won't happen
                })
                .then(resultHtmlString => {
                    const resultDocument = new DOMParser().parseFromString(resultHtmlString, 'text/html');

                    //submit the attack form with all units (attackForm is the table/sheet where unit numbers are filled by player)
                    let attackForm = resultDocument.getElementsByClassName('utok-formular').item(0);
                    fetch(url, {method: 'post', body: new FormData(attackForm)})
                        .then( result => {
                            if (result.ok) {quickAttackButton.textContent = '✅';}
                            else {
                                quickAttackButton.textContent = '❌'; console.error('Quick attack failed (submitting attack form)!');
                                return Promise.reject(result)} //--> next .then won't happen
                        })
                        .then(result => nextTurn()) //play next turn after clearing the attack event
                })
        })
    }
    console.log(`Tweak "${SETTINGS_KEYS.quickAttackButton}": Activated`);
}

/**Add option "Copy Army" into sidebar on the main page, so user can simply 1-click copy and easily paste into simulator (saves much time) */
function tweak_sidebarCopyArmyOption() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

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
                if (!unitName) {unitName = unit.getElementsByTagName('font').item(0).textContent;} //works for all specials

                //WORKAROUND: simulator has bug - it doesn't know Dralgar units called *kopiník*, it needs to input them with extra J like *kopijník*
                if (unitName.includes('kopiník')) {unitName = unitName.replace('kopiník', 'kopijník')}

                let unitCount = unit.nextElementSibling.textContent; //count is in the next column (next <td> on the same elem level)

                let unitItem = '';
                try {
                    unitItem = unit.getElementsByClassName('predmet').item(0).textContent; //if no item, 'null.textContent' raises error
                } catch (error) {} //do nothing, unitItem is already pre-set to empty string

                clanArmy += `${unitCount} x ${unitName}`
                if (unitItem) {clanArmy += ` (${unitItem})`}
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
