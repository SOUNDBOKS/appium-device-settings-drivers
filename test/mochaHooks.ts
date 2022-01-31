import { Brand, ISettingsDriver, WebdriverBrowser } from "../src/lib/types"
import { createSettingsDriver } from "../src/lib"

import * as WebdriverIO from "webdriverio"
import * as fs from "fs/promises"
import * as fsOld from "fs"

import { PhoneDriver } from "../src/lib/PhoneDriver"

type Pod = {
    udid: string;
    deviceName: string;
    brand: Brand,
    platformVersion: string;
    testDevice: string;
    portOffset: number;
}

export let client: WebdriverBrowser;
export let driver: ISettingsDriver;
export let pod: Pod;

console.log("Loading pod file: " + process.env.POD_FILE)
pod = JSON.parse(fsOld.readFileSync(process.env.POD_FILE!, { encoding: "utf-8" }))

let phoneDriver: PhoneDriver;

const automationName = {
    'Android': 'UiAutomator2',
    'iOS': 'XCuiTest'
};


export const mochaHooks = {
    async beforeAll() {
        pod.portOffset = Number(pod.portOffset)
        
        const platformName = pod.brand === Brand.iPhone ? "iOS" : "Android";

        client = await WebdriverIO.remote({
            logLevel: "warn",
            path: "/",
            port: 7200 + pod.portOffset,
            capabilities: {
                platformName,
                "appium:wdaLocalPort": 8000 + pod.portOffset,
                "appium:systemPort": 8000 + pod.portOffset,
                "appium:automationName": automationName[platformName],
                "appium:deviceName": pod.deviceName,
                "appium:platformVersion": pod.platformVersion,
                "appium:udid": pod.udid,
                "appium:autoAcceptAlerts": false,
                "appium:autoGrantPermissions": false,
                "appium:language": "en",
                "appium:locale": "US",
                "appium:locationServicesEnabled": true,
                "appium:showXcodeLog": false,
            }
        } as any)

        driver = createSettingsDriver(client, pod.brand, pod.platformVersion)
        phoneDriver = driver as any as PhoneDriver
    },
    async beforeEach() {
    },
    async afterEach() {
        await phoneDriver.printScreen()
    },
    async afterAll() {
        await phoneDriver.client.deleteSession()
    }
}
