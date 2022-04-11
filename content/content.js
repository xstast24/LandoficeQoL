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

/**TODO*/
function tweak_quickAttackButton() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar
    return //TODO
    let villageAttack = document.createElement('li')
    let villageAttackLink = document.createElement('a');
    //villageAttackLink.setAttribute('href', 'main.php?obnovit');
    villageAttackLink.textContent = 'TEST utok'
    villageAttack.appendChild(villageAttackLink)
    villageAttack.addEventListener('click', function () {
        console.log('UTOK clicked -> submitting')
        //let url = 'http://heaven.landofice.com/utok.php?utok=vesnice&'; //attack URL
        let url = 'http://heaven.landofice.com/utok.php?utok=barbari&'; //attack URL
        fetch(url)
            .then(result => result.text()) //TODO add response success check?
            .then(resultHtmlString => {
            console.log(`UTOK submitted, answer delivered -> parsing html to DOM`);
            const resultDocument = new DOMParser().parseFromString(resultHtmlString, 'text/html');
            console.log('UTOK parsed DOM');
            //TODO add error handling if e.g. clicked 2x same link and it is already cleared -> no attack form found
            //attackForm = sheet where unit numbers are filled by player, by default all units
            let attackForm = resultDocument.getElementsByClassName('utok-formular').item(0);
            console.log(`UTOK got attack form ${attackForm}, info below:`);
            console.log(`UTOK submitting form...`);
            fetch(url, {
                method: 'post',
                body: new FormData(attackForm)
            }).then(r => {console.log('UTOK form sent, DONE, result:'); console.log(r)})
            //console.log('UTOK WAITING a bit, then doing second request - is it seen in network, or submit doesnt work at all?')
            //sleep(200);
            console.log(`UTOK submit complete, should be done`);
        })
    })
    sidebar().insertBefore(villageAttack, sidebar().firstChild)
    'http://heaven.landofice.com/utok.php?utok=vesnice&'
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
                //{unitName = unit.getElementsByClassName('unit_unique').item(0).textContent;} //works only for leader (nested <a> link to skill tree)
                if (!unitName) {unitName = unit.getElementsByTagName('font').item(0).textContent;} //works for all specials

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
