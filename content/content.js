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

    //1) Page refresh ("?obnovit") not needed (we could use void link), but it feels unresponsive (player don't know if it worked) -> refresh solves this
    //2) Putting addLeaderURL into the option would open the clan army page, so we process the request silently in background (event listener below)
    let addLeaderOption = createSidebarOption('Velitel do armády', 'main.php?obnovit');
    addLeaderOption.addEventListener('click', function() {
        fetch(addLeaderURL).then(result => {console.log(`Added clan leader to the army`)})
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
