const DEFAULT_PROFILE = {
  largerText: true,
  reduceMotion: true,
  hideMedia: false
};

const DEFAULTS_VERSION = 9;
const PREVIOUS_BASE_DEFAULTS = {
  largerText: true,
  reduceMotion: true,
  hideMedia: false
};
const PREVIOUS_FACEBOOK_DEFAULTS = {
  ...PREVIOUS_BASE_DEFAULTS,
  hideLeftNavigation: true,
  hideRightPanel: true,
  hideTopPostBar: true,
  hideStoryBar: true,
  hideTabBar: true,
  hideReelsSection: true,
  hideAdSections: false,
  hideNewMessageButton: true
};
const PREVIOUS_FACEBOOK_COMPACT_DEFAULTS = {
  ...PREVIOUS_FACEBOOK_DEFAULTS,
  moveFeedToRight: true
};

const FACEBOOK_DEFAULTS = {
  ...DEFAULT_PROFILE,
  hideLeftNavigation: true,
  hideRightPanel: true,
  hideTopPostBar: true,
  hideStoryBar: true,
  hideTabBar: true,
  hideReelsSection: true,
  hideAdSections: false,
  hideNewMessageButton: true,
  moveFeedToRight: false
};
const settingsElement = document.querySelector("#settings");
const statusElement = document.querySelector("#status");
const controls = [...settingsElement.querySelectorAll('input[type="checkbox"]')];
let profile = { ...FACEBOOK_DEFAULTS };
let saveQueue = Promise.resolve();
let changeSequence = 0;
let statusSequence = 0;
const editVersions = {};

function copyProfile(source) {
  return { ...FACEBOOK_DEFAULTS, ...source };
}

async function upgradeInitialDefaults(storedSettings) {
  if (
    storedSettings.settingsDefaultsVersion >= DEFAULTS_VERSION
    || !storedSettings.siteSettings
  ) {
    return storedSettings;
  }

  const siteSettings = {};
  const facebookProfile = storedSettings.siteSettings.facebook;
  const isPreviousFacebookDefault = [PREVIOUS_FACEBOOK_DEFAULTS, PREVIOUS_FACEBOOK_COMPACT_DEFAULTS]
    .some((previousDefaults) => facebookProfile
      && Object.keys(previousDefaults).every((key) => facebookProfile[key] === previousDefaults[key])
      && Object.keys(facebookProfile).length === Object.keys(previousDefaults).length);
  if (facebookProfile) {
    siteSettings.facebook = {
      ...facebookProfile,
      ...(isPreviousFacebookDefault ? { hideMedia: false, moveFeedToRight: false } : {})
    };
  }

  const upgradedSettings = {
    ...storedSettings,
    siteSettings,
    settingsDefaultsVersion: DEFAULTS_VERSION
  };
  await chrome.storage.sync.set({
    siteSettings,
    settingsDefaultsVersion: DEFAULTS_VERSION
  });
  return upgradedSettings;
}

function showStatus(message, isError = false) {
  statusElement.textContent = isError ? message : "";
  statusElement.dataset.error = String(isError);
}

function displayProfile() {
  for (const control of controls) {
    control.checked = Boolean(profile[control.name]);
  }
}

async function loadSettings() {
  try {
    const storedSettings = await upgradeInitialDefaults(
      await chrome.storage.sync.get(null)
    );
    if (!storedSettings.siteSettings && Object.keys(storedSettings).length === 0) {
      profile = { ...FACEBOOK_DEFAULTS };
      await chrome.storage.sync.set({
        siteSettings: { facebook: copyProfile(profile) },
        settingsDefaultsVersion: DEFAULTS_VERSION
      });
    } else {
      const legacyProfile = Object.fromEntries(
        Object.keys(DEFAULT_PROFILE).map((key) => [key, Boolean(storedSettings[key])])
      );
      legacyProfile.hideLeftNavigation = false;
      legacyProfile.hideRightPanel = false;
      legacyProfile.hideTopPostBar = false;
      legacyProfile.hideStoryBar = false;
      legacyProfile.hideTabBar = false;
      legacyProfile.hideReelsSection = false;
      legacyProfile.hideAdSections = false;
      legacyProfile.hideNewMessageButton = false;
      const facebookSettings = storedSettings.siteSettings
        ? storedSettings.siteSettings.facebook ?? FACEBOOK_DEFAULTS
        : legacyProfile;
      profile = { ...FACEBOOK_DEFAULTS, ...facebookSettings };
      if (!storedSettings.siteSettings && Object.keys(storedSettings).length > 0) {
        await chrome.storage.sync.set({
          siteSettings: { facebook: copyProfile(profile) },
          settingsDefaultsVersion: DEFAULTS_VERSION
        });
      }
    }
    displayProfile();
    settingsElement.disabled = false;
    showStatus("");
  } catch (error) {
    console.error("Facebook Tweaks: Could not load saved tweaks.", error);
    showStatus("Could not load tweaks. Try reopening this panel.", true);
  }
}

async function saveSetting(event) {
  const control = event.currentTarget;
  const previousValue = profile[control.name];
  const value = control.checked;
  const version = ++changeSequence;
  const currentStatus = ++statusSequence;
  editVersions[control.name] = version;
  profile[control.name] = value;
  showStatus("Saving tweaks…");

  try {
    const save = saveQueue.catch(() => {}).then(() =>
      chrome.storage.sync.set({
        siteSettings: { facebook: copyProfile(profile) },
        settingsDefaultsVersion: DEFAULTS_VERSION
      })
    );
    saveQueue = save;
    await save;
    if (currentStatus === statusSequence) {
      showStatus("Saved Facebook tweaks.");
    }
  } catch (error) {
    if (editVersions[control.name] === version) {
      profile[control.name] = previousValue;
      control.checked = previousValue;
    }
    console.error("Facebook Tweaks: Could not save tweak.", error);
    if (currentStatus === statusSequence) {
      showStatus("Could not save tweak. Please try again.", true);
    }
  }
}

for (const control of controls) {
  control.addEventListener("change", saveSetting);
}

loadSettings();
