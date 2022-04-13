/** COMMON game-related info
 * This script is intended to be loaded after config.js and common.js and before background/content/popup JS scripts, so they can use the common functionality.
 * Namespace of all background scripts is shared (same applies for content/popup namespaces), so it works.
 * */


/**Get sidebar (action list) - the menu on the left side of the main page.
 * return: (optional) sidebar elem*/
function sidebar() {
    return document.getElementsByClassName('action-list').item(0);
}

/**
 * Get sidebar element with given text.
 * @param {string} name: text displayed on the option, e.g. 'Obnovit'
 * @returns {Node & ParentNode} sidebar option <li> element
 */
function getSidebarOption(name) {
    //options are <li> elements that contain <a> anchors (e.g. <li> <a>Option</a> </li>) -> must search text in <a>, but return the <li> parent
    let option = getElementByText(name, sidebar(), 'a', true);
    if (!option) {console.error(`Sidebar option "${name}" not found!`); return null}
    return option.parentNode
}

/**
 * Create an option element for the main page sidebar.
 * @param {string} name: text displayed on the option
 * @param {string} href: (optional) anchor/link to visit/call if the option is clicked. By default void action (do nothing). Pass ''/null = no href attribute
 * @returns {HTMLLIElement} sidebar option element
 */
function createSidebarOption(name, href = 'javascript:void(0);') {
    //STRUCTURE: sidebar options are <a> anchors wrapped in <li> elements, e.g. <li> <a href=link> Option1 </a> </li>)
    let optionContent = document.createElement('a');
    optionContent.textContent = name;
    if (href) {optionContent.setAttribute('href', href);}

    let optionWrap = document.createElement('li');
    optionWrap.appendChild(optionContent);

    return optionWrap
}

/**Get all possible attack events offered on the main page each turn (elements like <a href="utok.php?utok=name">Name</a>) */
function getPossibleAttackEvents() {
    let attacksContainer = document.getElementsByClassName('odehraj odehraj-hlavni-utoky').item(0);
    return attacksContainer.getElementsByTagName('a')
}
