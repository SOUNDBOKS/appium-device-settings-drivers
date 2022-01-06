# Appium Device Settings Drivers

Collection of drivers for the settings menus of various devices built for webdriverio.


## Usage

The library exports one function `createSettingsDriver` which takes an existing WebdriverIO session, a brand and a platform version and returns an implementation of ISettingsDriver or throws. 


## Supported devices

We currently explicitly support these devices. Note that this generally refers to the latest 1-2 OS versions. Don't expect Android 7 devices to work with these drivers.

- Huawei
- iOS
- LG
- OnePlus
- Samsung
- Stock Android (Google Pixel)


## Device Compatibility, Contributing & Testing

This library is used extensively at SOUNDBOKS for our internal E2E testing and thus is well battle-tested for the devices we test actively, which will generally include the most common vendors and latest OS versions (List to follow). If you have a need to support other devices and want to add a driver, you are free to submit a PR or ask us if we are interested in adding that device to our testing rig and we might.  
  
There is a small test suite included in this repo which covers the use cases that can be covered easily with any well-behaving bluetooth device. There is things not covered in there that we do implement and test internally, such as BT pincodes.  
  
Importantly this is not currently intended to be a feature complete implementation of everything you can access through the settings application. We will generally only implement features that are relevant to end-to-end testing bluetooth devices.