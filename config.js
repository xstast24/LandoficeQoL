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
};

const SETTINGS_KEYS = {
    sidebarAddArmyLeaderOption: 'sidebarAddArmyLeaderOption',
    //maxEquipmentButton: 'maxEquipmentButton',
    quickAttackButton: 'quickAttackButton',
    sidebarCopyArmyOption: 'sidebarCopyArmyOption',
};