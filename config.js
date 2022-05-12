/**
 * This script is intended to be loaded before all JS scripts, so they can use the config constants.
 * NOTE: Any new config (I mean a whole new config, not just config-key) must be added to "saveDefaultConfigToChromeStorage" in common.js (or background.js),
 * so it can be initialized in FIRST RUN INITIALIZATION to work.
 * */


// Configuration related to program in general
const CONFIG = {
    firstRunEver: false, //to initialize on the very first run
    extensionActive: false, //general on/off switch
    lastRunningVersion: '0.0', //used to detect updates
};

const CONFIG_KEYS = {
    firstRunEver: 'firstRunEver',
    extensionActive: 'extensionActive',
    lastRunningVersion: 'lastRunningVersion',
};


// Settings that can be enabled by user via extension GUI (game tweaks)
const SETTINGS = {
    sidebarAddArmyLeaderOption: false,  //add a sidebar option to add clan leader (hero) to the army
    //maxEquipmentButton: false,
    quickAttackButton: false, //add option to all events/confrontations to 1-click attack&clear them
    sidebarCopyArmyOption: false, //button to quickly copy current army into clipboard, so it can be easily pasted into simulator
    clanQuickSwitchButtons: false,
    vulkanAutoBuyFireMage: false, //before next turn, ensure (auto-buy) there is equipment to recruit at least 1 mage of fire (to recruit arch mage of fire)
    alertFrancoxSect: false, //show alert when soothsayer from Francox's sect arrives with a riddle
    plunderWatchdog: false, //watchdog for plundering (monitor, alert, auto attack) to not miss the needed places
    mainPageUiTweaks: false, //various details on main page
};

const SETTINGS_KEYS = {
    sidebarAddArmyLeaderOption: 'sidebarAddArmyLeaderOption',
    //maxEquipmentButton: 'maxEquipmentButton',
    quickAttackButton: 'quickAttackButton',
    sidebarCopyArmyOption: 'sidebarCopyArmyOption',
    clanQuickSwitchButtons: 'clanQuickSwitchButtons',
    vulkanAutoBuyFireMage: 'vulkanAutoBuyFireMage',
    alertFrancoxSect: 'alertFrancoxSect',
    plunderWatchdog: 'plunderWatchdog',
    mainPageUiTweaks: 'mainPageUiTweaks',
};