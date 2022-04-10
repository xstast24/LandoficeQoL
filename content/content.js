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
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

    let armyLeaderOption = document.createElement('li');
    let armyLeaderOptionLink = document.createElement('a');
    //armyLeaderOptionLink.setAttribute('href', 'main.php?obnovit');
    //void link -> show mouse pointer as on link/anchor https://stackoverflow.com/questions/8260546/make-a-html-link-that-does-nothing-literally-nothing
    armyLeaderOptionLink.setAttribute('href', 'javascript:void(0);');
    //real link would cause the page to load the clan army page; so we just send http request in background and do nothing
    armyLeaderOptionLink.textContent = 'Velitel do boje';
    armyLeaderOption.appendChild(armyLeaderOptionLink);
    armyLeaderOption.addEventListener('click', function() {
        fetch('http://heaven.landofice.com/clanarmy/addCommander').then(result => {console.log(`Added leader to the army`)})
    });

    //options are wrapped in <li><a>option</a></li> -> need the <li> parent
    let sidebarClanArmy = getElementByText('Klanová armáda', sidebar(), 'a', true).parentNode;

    // insert the option after Clan Army item
    sidebar().insertBefore(armyLeaderOption, sidebarClanArmy.nextSibling);

    console.log(`Tweak "${SETTINGS_KEYS.sidebarAddArmyLeaderOption}": Activated`);
}

/**TODO*/
function tweak_quickAttackButton() {
    if (window.location.pathname !== '/main.php') {return} //option works only on the main page with sidebar

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
