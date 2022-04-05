/** COMMON game-related info
 * This script is intended to be loaded after config.js and common.js and before background/content/popup JS scripts, so they can use the common functionality.
 * Namespace of all background scripts is shared (same applies for content/popup namespaces), so it works.
 * */


/**Get sidebar (action list) - the menu on the left side of the page.
 * return: (optional) sidebar elem*/
function getSideBar() {
    return document.getElementsByClassName('action_list');
}
