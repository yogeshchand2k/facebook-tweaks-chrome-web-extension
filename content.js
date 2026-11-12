const DEFAULT_PROFILE = {
  largerText: true,
  reduceMotion: true,
  hideMedia: false,
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

const NAVIGATION_SELECTOR = '[role="navigation"]';
const COMPLEMENTARY_SELECTOR = '[role="complementary"]';
const POST_BAR_CLASS = "xod5an3";
const CREATE_POST_REGION_SELECTOR = '[role="region"][aria-label="Create a post"]';
const STORIES_REGION_SELECTOR = '[role="region"][aria-label="Stories"][data-focus-target="stories_tray"]';
const FACEBOOK_TAB_BAR_SELECTOR = '[role="navigation"][aria-label="Facebook"]';
const REELS_GRID_SELECTOR = '[role="grid"][aria-label="Reels"]';
const NEW_MESSAGE_BUTTON_SELECTOR = '[role="button"][aria-label="New message"]';
const FACEBOOK_FEED_SELECTOR = '[role="main"] > :first-child';
const POST_IMAGE_SELECTOR = "img, picture, svg image";
const FACEBOOK_TAB_LABELS = ["Home", "Reels", "Friends", "Marketplace", "Groups"];
const HIDDEN_LEFT_PANEL_ATTRIBUTE = "data-page-tweaks-facebook-left-panel";
const HIDDEN_RIGHT_PANEL_ATTRIBUTE = "data-page-tweaks-facebook-right-panel";
const HIDDEN_POST_BAR_ATTRIBUTE = "data-page-tweaks-facebook-top-post-bar";
const HIDDEN_STORY_BAR_ATTRIBUTE = "data-page-tweaks-facebook-story-bar";
const HIDDEN_TAB_BAR_ATTRIBUTE = "data-page-tweaks-facebook-tab-bar";
const HIDDEN_REELS_ATTRIBUTE = "data-page-tweaks-facebook-reels-section";
const HIDDEN_NEW_MESSAGE_BUTTON_ATTRIBUTE = "data-page-tweaks-facebook-new-message-button";
const PREVIEW_PANEL_CLASS = "website-tweaks-preview";

const hostname = location.hostname;
const site = hostname === "facebook.com" || hostname.endsWith(".facebook.com")
  ? "facebook"
  : null;
let settings = { ...DEFAULT_PROFILE };
let settingsRevision = 0;
let scanScheduled = false;
let fullScanRequested = false;
let hoverPopupTimer = 0;
const pendingScanNodes = new Set();
let previewPanel = null;

function upgradeInitialDefaults(savedSettings) {
  if (
    savedSettings.settingsDefaultsVersion >= DEFAULTS_VERSION
    || !savedSettings.siteSettings
  ) {
    return savedSettings;
  }

  const siteSettings = {};
  const facebookProfile = savedSettings.siteSettings.facebook;
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
    ...savedSettings,
    siteSettings,
    settingsDefaultsVersion: DEFAULTS_VERSION
  };
  chrome.storage.sync.set({
    siteSettings,
    settingsDefaultsVersion: DEFAULTS_VERSION
  }).catch((error) => {
    console.error("Facebook Tweaks: Could not update default settings.", error);
  });
  return upgradedSettings;
}

function isSidebar(element, side) {
  const bounds = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxSidebarWidth = Math.min(520, viewportWidth * 0.45);

  const isOnRequestedSide = side === "left"
    ? bounds.left <= viewportWidth * 0.25 && bounds.right <= viewportWidth * 0.5
    : bounds.right >= viewportWidth * 0.75 && bounds.left >= viewportWidth * 0.5;

  return bounds.width > 0
    && bounds.height >= viewportHeight * 0.35
    && isOnRequestedSide
    && bounds.width <= maxSidebarWidth;
}

function updateSidebarIn(node, selector, setting, attribute, side) {
  if (!settings[setting] || !(node instanceof Element)) {
    return;
  }

  const candidates = [
    ...(node.matches(selector) ? [node] : []),
    ...node.querySelectorAll(selector)
  ];
  for (const candidate of candidates) {
    if (candidate.hasAttribute(attribute)) {
      continue;
    }
    if (isSidebar(candidate, side)) {
      candidate.setAttribute(attribute, "");
    }
  }
}

function updateFacebookPanelsIn(node) {
  if (site !== "facebook") {
    return;
  }
  updateSidebarIn(
    node,
    NAVIGATION_SELECTOR,
    "hideLeftNavigation",
    HIDDEN_LEFT_PANEL_ATTRIBUTE,
    "left"
  );
  updateSidebarIn(
    node,
    COMPLEMENTARY_SELECTOR,
    "hideRightPanel",
    HIDDEN_RIGHT_PANEL_ATTRIBUTE,
    "right"
  );
}

function isTopPostBar(element) {
  return element.querySelector(CREATE_POST_REGION_SELECTOR) !== null;
}

function updateTopPostBarIn(node) {
  if (site !== "facebook" || !settings.hideTopPostBar || !(node instanceof Element)) {
    return;
  }

  const candidates = new Set(node.querySelectorAll(`.${POST_BAR_CLASS}`));
  if (node.classList.contains(POST_BAR_CLASS)) {
    candidates.add(node);
  }
  for (const hiddenElement of document.querySelectorAll(`[${HIDDEN_POST_BAR_ATTRIBUTE}]`)) {
    candidates.add(hiddenElement);
  }

  for (const candidate of candidates) {
    const shouldHide = candidate.classList.contains(POST_BAR_CLASS)
      && isTopPostBar(candidate);
    if (shouldHide && !candidate.hasAttribute(HIDDEN_POST_BAR_ATTRIBUTE)) {
      candidate.setAttribute(HIDDEN_POST_BAR_ATTRIBUTE, "");
    } else if (!shouldHide && candidate.hasAttribute(HIDDEN_POST_BAR_ATTRIBUTE)) {
      candidate.removeAttribute(HIDDEN_POST_BAR_ATTRIBUTE);
    }
  }
}

function updateStoryBarIn(node) {
  if (site !== "facebook" || !settings.hideStoryBar || !(node instanceof Element)) {
    return;
  }

  const candidates = new Set(node.querySelectorAll(STORIES_REGION_SELECTOR));
  if (node.matches(STORIES_REGION_SELECTOR)) {
    candidates.add(node);
  }
  for (const candidate of candidates) {
    if (!candidate.hasAttribute(HIDDEN_STORY_BAR_ATTRIBUTE)) {
      candidate.setAttribute(HIDDEN_STORY_BAR_ATTRIBUTE, "");
    }
  }
}

function isFacebookTabBar(element) {
  const links = new Set(
    [...element.querySelectorAll('a[role="link"][aria-label]')]
      .map((link) => link.getAttribute("aria-label"))
  );
  return FACEBOOK_TAB_LABELS.every((label) => links.has(label));
}

function updateTabBarIn(node) {
  if (site !== "facebook" || !settings.hideTabBar || !(node instanceof Element)) {
    return;
  }

  const candidates = new Set(node.querySelectorAll(FACEBOOK_TAB_BAR_SELECTOR));
  if (node.matches(FACEBOOK_TAB_BAR_SELECTOR)) {
    candidates.add(node);
  }
  for (const candidate of candidates) {
    if (isFacebookTabBar(candidate) && !candidate.hasAttribute(HIDDEN_TAB_BAR_ATTRIBUTE)) {
      candidate.setAttribute(HIDDEN_TAB_BAR_ATTRIBUTE, "");
    }
  }
}

function findReelsSection(grid) {
  let section = grid.parentElement;
  for (let depth = 0; section && depth < 8; depth += 1, section = section.parentElement) {
    const hasReelsHeading = [...section.querySelectorAll("h3")]
      .some((heading) => heading.textContent.trim() === "Reels");
    if (hasReelsHeading) {
      return section;
    }
  }
  return null;
}

function updateReelsSectionIn(node) {
  if (site !== "facebook" || !settings.hideReelsSection || !(node instanceof Element)) {
    return;
  }

  const grids = new Set(node.querySelectorAll(REELS_GRID_SELECTOR));
  if (node.matches(REELS_GRID_SELECTOR)) {
    grids.add(node);
  }
  const sections = new Set(
    document.querySelectorAll(`[${HIDDEN_REELS_ATTRIBUTE}]`)
  );
  for (const grid of grids) {
    const section = findReelsSection(grid);
    if (section) {
      sections.add(section);
    }
  }
  for (const section of sections) {
    if (!section.hasAttribute(HIDDEN_REELS_ATTRIBUTE)) {
      section.setAttribute(HIDDEN_REELS_ATTRIBUTE, "");
    }
  }
}

function updateNewMessageButtonIn(node) {
  if (site !== "facebook" || !settings.hideNewMessageButton || !(node instanceof Element)) {
    return;
  }

  const buttons = new Set(node.querySelectorAll(NEW_MESSAGE_BUTTON_SELECTOR));
  if (node.matches(NEW_MESSAGE_BUTTON_SELECTOR)) {
    buttons.add(node);
  }
  for (const button of buttons) {
    if (!button.hasAttribute(HIDDEN_NEW_MESSAGE_BUTTON_ATTRIBUTE)) {
      button.setAttribute(HIDDEN_NEW_MESSAGE_BUTTON_ATTRIBUTE, "");
    }
  }
}

function restorePanel(attribute) {
  for (const element of document.querySelectorAll(`[${attribute}]`)) {
    element.removeAttribute(attribute);
  }
}

function getPreviewUrl(value, baseUrl, allowedProtocols) {
  try {
    const url = new URL(value, baseUrl);
    return allowedProtocols.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function fitPreviewImage(image) {
  if (!previewPanel || !image.naturalWidth || !image.naturalHeight) {
    return;
  }

  const scale = Math.min(
    previewPanel.clientWidth / image.naturalWidth,
    previewPanel.clientHeight / image.naturalHeight
  );
  image.style.width = `${Math.floor(image.naturalWidth * scale)}px`;
  image.style.height = `${Math.floor(image.naturalHeight * scale)}px`;
}

function showPreviewPlaceholder() {
  if (!previewPanel) {
    return;
  }
  const placeholder = document.createElement("p");
  placeholder.className = "website-tweaks-preview__empty";
  placeholder.textContent = "Hover your pointer over images to see them here.";
  previewPanel.replaceChildren(placeholder);
  delete previewPanel.dataset.sourceUrl;
  delete previewPanel.dataset.contentType;
}

function showPostPreview(sourceUrl) {
  if (!document.body) {
    return;
  }
  if (!previewPanel) {
    previewPanel = document.createElement("section");
    previewPanel.className = PREVIEW_PANEL_CLASS;
    previewPanel.setAttribute("aria-label", "Post preview");
    previewPanel.setAttribute("aria-live", "polite");
    document.body.append(previewPanel);
  }
  if (
    previewPanel.dataset.sourceUrl === sourceUrl
    && previewPanel.dataset.contentType === "image"
  ) {
    return;
  }

  const preview = document.createElement("img");
  preview.alt = "";
  preview.addEventListener("load", () => fitPreviewImage(preview));
  previewPanel.replaceChildren(preview);
  previewPanel.dataset.sourceUrl = sourceUrl;
  previewPanel.dataset.contentType = "image";
  preview.src = sourceUrl;
  if (preview.complete) {
    fitPreviewImage(preview);
  }
}

function previewHoveredPostContent(event) {
  if (site !== "facebook" || !settings.moveFeedToRight || !(event.target instanceof Element)) {
    return;
  }

  const feed = document.querySelector(FACEBOOK_FEED_SELECTOR);
  if (!feed || !feed.contains(event.target)) {
    return;
  }

  const media = event.target.closest(POST_IMAGE_SELECTOR);
  if (media) {
    const image = media.matches("picture") ? media.querySelector("img") : media;
    const imageUrl = image?.currentSrc
      || image?.src
      || media.getAttribute("href")
      || media.getAttribute("xlink:href")
      || media.href?.baseVal;
    const safeImageUrl = getPreviewUrl(
      imageUrl,
      document.baseURI,
      new Set(["http:", "https:", "blob:"])
    );
    if (safeImageUrl) {
      showPostPreview(safeImageUrl);
    }
  }
}

function updatePostPreviewPanel() {
  if (site === "facebook" && settings.moveFeedToRight) {
    if (!previewPanel && document.body) {
      previewPanel = document.createElement("section");
      previewPanel.className = PREVIEW_PANEL_CLASS;
      previewPanel.setAttribute("aria-label", "Post preview");
      previewPanel.setAttribute("aria-live", "polite");
      document.body.append(previewPanel);
    }
    if (!previewPanel.hasChildNodes() && !previewPanel.dataset.sourceUrl) {
      showPreviewPlaceholder();
    }
    return;
  }
  previewPanel?.remove();
  previewPanel = null;
}

function expandHoveredProfilePopup(event) {
  if (site !== "facebook" || !settings.moveFeedToRight || !(event.target instanceof Element)) {
    return;
  }
  const feed = document.querySelector(FACEBOOK_FEED_SELECTOR);
  const link = event.target.closest("a[href]");
  if (!feed || !link || !feed.contains(link)) {
    return;
  }

  let destination;
  try {
    destination = new URL(link.href);
  } catch {
    return;
  }

  window.clearTimeout(hoverPopupTimer);
  hoverPopupTimer = window.setTimeout(() => {
    const feedBounds = feed.getBoundingClientRect();
    const width = Math.min(feedBounds.width, window.innerWidth);
    if (!width) {
      return;
    }

    for (const popup of document.querySelectorAll('[style*="translate("]')) {
      if (!(popup instanceof HTMLElement) || getComputedStyle(popup).position !== "fixed") {
        continue;
      }
      const popupBounds = popup.getBoundingClientRect();
      if (popupBounds.width < 160 || popupBounds.height < 80) {
        continue;
      }
      const matchesHoveredLink = [...popup.querySelectorAll("a[href]")].some((popupLink) => {
        try {
          const popupDestination = new URL(popupLink.href);
          return popupDestination.origin === destination.origin
            && popupDestination.pathname === destination.pathname;
        } catch {
          return false;
        }
      });
      if (!matchesHoveredLink) {
        continue;
      }

      popup.style.setProperty("position", "fixed", "important");
      popup.style.setProperty("left", `${feedBounds.left}px`, "important");
      popup.style.setProperty("right", "auto", "important");
      popup.style.setProperty(
        "top",
        `${Math.max(56, Math.min(popupBounds.top, window.innerHeight - popupBounds.height))}px`,
        "important"
      );
      popup.style.setProperty("transform", "none", "important");
      popup.style.setProperty("width", `${width}px`, "important");
      popup.style.setProperty("max-width", `${width}px`, "important");
      popup.style.setProperty("box-sizing", "border-box", "important");
      popup.style.setProperty("z-index", "1000", "important");
      return;
    }
  }, 500);
}

function scanPageTweaks() {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  updatePostPreviewPanel();
  updateFacebookPanelsIn(root);
  updateTopPostBarIn(root);
  updateStoryBarIn(root);
  updateTabBarIn(root);
  updateReelsSectionIn(root);
  updateNewMessageButtonIn(root);
}

function scanFacebookPanels(node = document.documentElement) {
  if (!node) {
    return;
  }
  updateFacebookPanelsIn(node);
  updateTopPostBarIn(node);
  updateStoryBarIn(node);
  updateTabBarIn(node);
  updateReelsSectionIn(node);
  updateNewMessageButtonIn(node);
}

function flushScheduledScans() {
  scanScheduled = false;
  if (fullScanRequested) {
    fullScanRequested = false;
    pendingScanNodes.clear();
    scanPageTweaks();
    return;
  }

  const nodes = [...pendingScanNodes];
  pendingScanNodes.clear();
  for (const node of nodes) {
    scanFacebookPanels(node);
  }
}

function requestScheduledScan() {
  if (scanScheduled || !site) {
    return;
  }

  scanScheduled = true;
  window.requestAnimationFrame(flushScheduledScans);
}

function schedulePageScan() {
  fullScanRequested = true;
  requestScheduledScan();
}

function scheduleNodeScan(node) {
  const element = node instanceof Element ? node : node?.parentElement;
  if (!element) {
    return;
  }

  pendingScanNodes.add(element);
  for (const selector of [
    NAVIGATION_SELECTOR,
    COMPLEMENTARY_SELECTOR,
    `.${POST_BAR_CLASS}`,
    STORIES_REGION_SELECTOR,
    FACEBOOK_TAB_BAR_SELECTOR,
    REELS_GRID_SELECTOR,
    NEW_MESSAGE_BUTTON_SELECTOR
  ]) {
    const ancestor = element.closest(selector);
    if (ancestor) {
      pendingScanNodes.add(ancestor);
    }
  }
  requestScheduledScan();
}

function schedulePanelAncestorScan(node) {
  const element = node instanceof Element ? node : node?.parentElement;
  if (!element) {
    return;
  }

  for (const selector of [
    NAVIGATION_SELECTOR,
    COMPLEMENTARY_SELECTOR,
    `.${POST_BAR_CLASS}`,
    STORIES_REGION_SELECTOR,
    FACEBOOK_TAB_BAR_SELECTOR,
    REELS_GRID_SELECTOR,
    NEW_MESSAGE_BUTTON_SELECTOR
  ]) {
    const ancestor = element.closest(selector);
    if (ancestor) {
      pendingScanNodes.add(ancestor);
    }
  }
  requestScheduledScan();
}

function applySettings(
  previousSettings = DEFAULT_PROFILE,
  shouldScanPage = true
) {
  const root = document.documentElement;
  if (!root) {
    document.addEventListener("DOMContentLoaded", applySettings, { once: true });
    return;
  }

  root.toggleAttribute(
    "data-page-tweaks-facebook-hide-ad-sections",
    site === "facebook" && settings.hideAdSections
  );
  root.toggleAttribute(
    "data-page-tweaks-facebook-move-feed-right",
    site === "facebook" && settings.moveFeedToRight
  );
  updatePostPreviewPanel();
  if (
    site === "facebook"
    && !settings.hideLeftNavigation
    && previousSettings.hideLeftNavigation
  ) {
    restorePanel(HIDDEN_LEFT_PANEL_ATTRIBUTE);
  }
  if (site === "facebook" && !settings.hideRightPanel && previousSettings.hideRightPanel) {
    restorePanel(HIDDEN_RIGHT_PANEL_ATTRIBUTE);
  }
  if (site === "facebook" && !settings.hideTopPostBar && previousSettings.hideTopPostBar) {
    restorePanel(HIDDEN_POST_BAR_ATTRIBUTE);
  }
  if (site === "facebook" && !settings.hideStoryBar && previousSettings.hideStoryBar) {
    restorePanel(HIDDEN_STORY_BAR_ATTRIBUTE);
  }
  if (site === "facebook" && !settings.hideTabBar && previousSettings.hideTabBar) {
    restorePanel(HIDDEN_TAB_BAR_ATTRIBUTE);
  }
  if (site === "facebook" && !settings.hideReelsSection && previousSettings.hideReelsSection) {
    restorePanel(HIDDEN_REELS_ATTRIBUTE);
  }
  if (
    site === "facebook"
    && !settings.hideNewMessageButton
    && previousSettings.hideNewMessageButton
  ) {
    restorePanel(HIDDEN_NEW_MESSAGE_BUTTON_ATTRIBUTE);
  }
  if (shouldScanPage) {
    scanPageTweaks();
  }
}

function loadSettings() {
  if (!site) {
    return Promise.resolve();
  }

  const revision = settingsRevision;
  return chrome.storage.sync.get(null)
    .then((storedSettings) => {
      if (revision !== settingsRevision) {
        return;
      }
      const savedSettings = upgradeInitialDefaults(storedSettings);
      const legacySettings = Object.fromEntries(
        Object.keys(DEFAULT_PROFILE).map((key) => [key, Boolean(savedSettings[key])])
      );
      const hasLegacySettings = Object.keys(DEFAULT_PROFILE)
        .some((key) => Object.hasOwn(savedSettings, key));
      const nextSettings = {
        ...DEFAULT_PROFILE,
        ...(
          savedSettings.siteSettings?.[site]
          ?? (hasLegacySettings
            ? legacySettings
            : DEFAULT_PROFILE)
        )
      };
      const previousSettings = settings;
      settings = nextSettings;
      applySettings(previousSettings);
    })
    .catch((error) => {
      console.error("Facebook Tweaks: Could not load saved settings for this page.", error);
    });
}

loadSettings();

document.addEventListener("DOMContentLoaded", schedulePageScan, { once: true });
for (const delay of [100, 300, 750, 1500, 3000, 6000]) {
  setTimeout(() => {
    if (site === "facebook") {
      pendingScanNodes.add(document.documentElement);
      requestScheduledScan();
    }
  }, delay);
}

const mediaObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      for (const node of mutation.addedNodes) {
        scheduleNodeScan(node);
      }
      schedulePanelAncestorScan(mutation.target);
    } else {
      scheduleNodeScan(mutation.target);
    }
  }
});
mediaObserver.observe(document, {
  attributes: true,
  attributeFilter: ["aria-label", "role"],
  childList: true,
  characterData: true,
  subtree: true
});
window.addEventListener("resize", () => {
  if (site === "facebook") {
    const previewImage = previewPanel?.querySelector("img");
    if (previewImage) {
      fitPreviewImage(previewImage);
    }
    pendingScanNodes.add(document.documentElement);
    requestScheduledScan();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !site || !changes.siteSettings) {
    return;
  }

  settingsRevision += 1;
  const previousSettings = settings;
  settings = {
    ...DEFAULT_PROFILE,
    ...changes.siteSettings.newValue?.[site]
  };
  const changedSettings = Object.keys(DEFAULT_PROFILE).filter(
    (key) => Boolean(previousSettings[key]) !== Boolean(settings[key])
  );
  applySettings(
    previousSettings,
    changedSettings.some((key) => key !== "hideAdSections")
  );
});

document.addEventListener("pointerover", previewHoveredPostContent);
document.addEventListener("pointerover", expandHoveredProfilePopup);
